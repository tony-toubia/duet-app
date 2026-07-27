import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import { RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import { analyticsService } from './AnalyticsService';

/**
 * Retry an RTDB write up to 3 times on permission_denied. RTDB WebSocket
 * auth state propagates separately from the Auth SDK and there's a brief
 * window after sign-in where a write can be evaluated against null auth.
 * Same approach as AuthService.ensureProfile.
 */
async function withAuthRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isPermDenied =
        msg.includes('permission_denied') ||
        msg.includes('PERMISSION_DENIED') ||
        err?.code === 'PERMISSION_DENIED';
      if (isPermDenied && attempt < 2) {
        console.warn(`[PartySignaling] ${label} attempt ${attempt + 1} hit permission_denied, retrying...`);
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${label}: retry exhausted`);
}

export interface PartySignalingCallbacks {
  onOffer: (fromUid: string, offer: RTCSessionDescription) => void;
  onAnswer: (fromUid: string, answer: RTCSessionDescription) => void;
  onIceCandidate: (fromUid: string, candidate: RTCIceCandidate) => void;
  onParticipantJoined: (uid: string) => void;
  onParticipantLeft: (uid: string) => void;
  onRoomDeleted: () => void;
  onError: (error: Error) => void;
}

export class PartySignalingService {
  private roomRef: any = null;
  private roomCode: string | null = null;
  private userId: string | null = null;
  private isHost: boolean = false;
  private callbacks: PartySignalingCallbacks;
  private unsubscribers: (() => void)[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private knownMembers = new Set<string>();

  constructor(callbacks: PartySignalingCallbacks) {
    this.callbacks = callbacks;
  }

  async initialize(): Promise<string> {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated.');
    }
    this.userId = currentUser.uid;
    return this.userId;
  }

  async createRoom(): Promise<string> {
    if (!this.userId) throw new Error('Not authenticated.');

    this.isHost = true;
    let attempts = 0;
    do {
      this.roomCode = this.generateRoomCode();
      this.roomRef = database().ref(`rooms/${this.roomCode}`);
      const existing = await this.roomRef.once('value');
      if (!existing.exists()) break;
      attempts++;
    } while (attempts < 5);
    
    if (attempts >= 5) throw new Error('Failed to generate room code.');

    await withAuthRetry('createRoom', () =>
      this.roomRef.set({
        roomType: 'party',
        maxParticipants: 6,
        createdAt: database.ServerValue.TIMESTAMP,
        createdBy: this.userId,
        members: {
          [this.userId!]: {
            role: 'host',
            joinedAt: database.ServerValue.TIMESTAMP,
          },
        },
        signaling: {}
      })
    );

    this.setupRoomState();
    return this.roomCode;
  }

  async joinRoom(roomCode: string): Promise<string[]> {
    if (!this.userId) throw new Error('Not authenticated.');
    
    this.roomCode = roomCode.toUpperCase();
    this.isHost = false;
    this.roomRef = database().ref(`rooms/${this.roomCode}`);

    const roomSnapshot = await this.roomRef.once('value');
    if (!roomSnapshot.exists()) throw new Error('Room not found');

    const roomData = roomSnapshot.val();
    if (roomData.roomType !== 'party') {
      throw new Error('This room does not support party mode.');
    }

    const members = roomData.members || {};
    // Our own uid in members is a stale entry from a crash or network drop —
    // treat it as a rejoin and overwrite rather than locking the user out.
    const isRejoin = !!members[this.userId];
    if (!isRejoin && Object.keys(members).length >= (roomData.maxParticipants || 6)) {
      throw new Error('Room is full (max 6 participants).');
    }

    await withAuthRetry('joinRoom', () =>
      this.roomRef.child('members').child(this.userId).set({
        role: 'member',
        joinedAt: database.ServerValue.TIMESTAMP,
      })
    );

    this.setupRoomState();
    
    const existingUids = Object.keys(members).filter(uid => uid !== this.userId);
    existingUids.forEach(uid => this.knownMembers.add(uid));
    
    return existingUids;
  }

  private setupRoomState() {
    this.roomRef.child('members').child(this.userId!).onDisconnect().remove();
    this.startHeartbeat();
    this.listenForMembers();
    this.listenForSignaling();
  }

  async sendOffer(toUid: string, offer: RTCSessionDescription): Promise<void> {
    if (!this.roomRef || !this.userId) return;
    const pairId = `${this.userId}_${toUid}`;
    await this.roomRef.child(`signaling/${pairId}/offer`).set({
      type: offer.type,
      sdp: offer.sdp,
    });
  }

  async sendAnswer(toUid: string, answer: RTCSessionDescription): Promise<void> {
    if (!this.roomRef || !this.userId) return;
    // The answer must land on the OFFERER's pair (`{offerer}_{answerer}`) —
    // handleSignalingPair delivers answers to the pair's sender side.
    const pairId = `${toUid}_${this.userId}`;
    await this.roomRef.child(`signaling/${pairId}/answer`).set({
      type: answer.type,
      sdp: answer.sdp,
    });
  }

  async sendIceCandidate(toUid: string, candidate: RTCIceCandidate): Promise<void> {
    if (!this.roomRef || !this.userId) return;
    const pairId = `${this.userId}_${toUid}`;
    await this.roomRef.child(`signaling/${pairId}/candidates`).push({
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sentBy: this.userId
    });
  }

  private listenForMembers() {
    const membersRef = this.roomRef.child('members');
    const unsubscribe = membersRef.on('value', (snapshot: any) => {
      const members = snapshot.val() || {};
      
      if (Object.keys(members).length === 0) {
        this.callbacks.onRoomDeleted();
        return;
      }

      const currentUids = new Set(Object.keys(members));

      // Check for new joins
      currentUids.forEach(uid => {
        if (uid !== this.userId && !this.knownMembers.has(uid)) {
          this.knownMembers.add(uid);
          this.callbacks.onParticipantJoined(uid);
        }
      });

      // Check for leaves
      this.knownMembers.forEach(uid => {
        if (!currentUids.has(uid)) {
          this.knownMembers.delete(uid);
          this.callbacks.onParticipantLeft(uid);
        }
      });
    });

    this.unsubscribers.push(() => membersRef.off('value', unsubscribe));
  }

  private listenForSignaling() {
    const signalingRef = this.roomRef.child('signaling');
    const unsubscribe = signalingRef.on('child_added', (snapshot: any) => {
      this.handleSignalingPair(snapshot);
    });

    const unsubscribeChanged = signalingRef.on('child_changed', (snapshot: any) => {
      this.handleSignalingPair(snapshot);
    });

    this.unsubscribers.push(() => signalingRef.off('child_added', unsubscribe));
    this.unsubscribers.push(() => signalingRef.off('child_changed', unsubscribeChanged));
  }

  // Dedup state: child_changed replays the whole pair object every time a
  // candidate lands, so offers/answers/candidates would otherwise be
  // re-processed on every event.
  private processedCandidates = new Set<string>();
  private lastProcessedOffer = new Map<string, string>();
  private lastProcessedAnswer = new Map<string, string>();

  private handleSignalingPair(snapshot: any) {
    const pairId = snapshot.key;
    const data = snapshot.val();
    if (!pairId || !data || !this.userId) return;

    const [senderId, receiverId] = pairId.split('_');

    // Ignore pairs between two OTHER participants — their signaling (and
    // especially their ICE candidates) must not leak into our connections.
    if (senderId !== this.userId && receiverId !== this.userId) return;

    // Offers addressed to us (we are the pair's receiver)
    if (receiverId === this.userId && data.offer) {
      if (this.lastProcessedOffer.get(pairId) !== data.offer.sdp) {
        this.lastProcessedOffer.set(pairId, data.offer.sdp);
        this.callbacks.onOffer(senderId, data.offer as RTCSessionDescription);
      }
    }

    // Answers live on the offerer's pair: if we sent the offer (we are the
    // pair's sender), the answer on this pair is addressed to us.
    if (senderId === this.userId && data.answer) {
      if (this.lastProcessedAnswer.get(pairId) !== data.answer.sdp) {
        this.lastProcessedAnswer.set(pairId, data.answer.sdp);
        this.callbacks.onAnswer(receiverId, data.answer as RTCSessionDescription);
      }
    }

    // ICE candidates from the other side of this pair
    if (data.candidates) {
      Object.entries(data.candidates).forEach(([key, cand]: [string, any]) => {
        if (cand.sentBy === this.userId) return;
        const dedupeKey = `${pairId}/${key}`;
        if (this.processedCandidates.has(dedupeKey)) return;
        this.processedCandidates.add(dedupeKey);
        this.callbacks.onIceCandidate(cand.sentBy, cand as RTCIceCandidate);
      });
    }
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      if (this.roomRef && this.userId) {
        try {
          await this.roomRef.child('members').child(this.userId).child('heartbeat').set(database.ServerValue.TIMESTAMP);
        } catch {}
      }
    }, 10000);
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  async leave() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.unsubscribers.forEach(unsub => unsub());
    this.processedCandidates.clear();
    this.lastProcessedOffer.clear();
    this.lastProcessedAnswer.clear();
    this.knownMembers.clear();
    
    if (this.roomRef && this.userId) {
      await this.roomRef.child('members').child(this.userId).onDisconnect().cancel();
      await this.roomRef.child('members').child(this.userId).remove();
      if (this.isHost) {
        await this.roomRef.remove();
      }
    }
  }
}

export default PartySignalingService;
