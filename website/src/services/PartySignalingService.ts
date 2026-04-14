import {
  ref,
  set,
  push,
  remove,
  onValue,
  onChildAdded,
  onChildChanged,
  onDisconnect,
  serverTimestamp,
  off,
} from 'firebase/database';
import { firebaseAuth, firebaseDb } from './firebase';

export interface PartySignalingCallbacks {
  onOffer: (fromUid: string, offer: RTCSessionDescriptionInit) => void;
  onAnswer: (fromUid: string, answer: RTCSessionDescriptionInit) => void;
  onIceCandidate: (fromUid: string, candidate: RTCIceCandidateInit) => void;
  onParticipantJoined: (uid: string) => void;
  onParticipantLeft: (uid: string) => void;
  onRoomDeleted: () => void;
  onError: (error: Error) => void;
}

export class PartySignalingService {
  private roomCode: string | null = null;
  private userId: string | null = null;
  private isHost = false;
  private callbacks: PartySignalingCallbacks;
  private unsubscribers: (() => void)[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private knownMembers = new Set<string>();

  constructor(callbacks: PartySignalingCallbacks) {
    this.callbacks = callbacks;
  }

  async initialize(uid?: string): Promise<string> {
    const resolvedUid = uid || firebaseAuth.currentUser?.uid;
    if (!resolvedUid) throw new Error('Not authenticated.');
    this.userId = resolvedUid;
    return this.userId;
  }

  async createRoom(): Promise<string> {
    if (!this.userId) throw new Error('Not authenticated.');

    this.isHost = true;
    let attempts = 0;
    let roomRef;

    do {
      this.roomCode = this.generateRoomCode();
      roomRef = ref(firebaseDb, `rooms/${this.roomCode}`);
      const snapshot = await (await import('firebase/database')).get(roomRef);
      if (!snapshot.exists()) break;
      attempts++;
    } while (attempts < 5);

    if (attempts >= 5) throw new Error('Failed to generate room code.');

    await set(roomRef!, {
      roomType: 'party',
      maxParticipants: 6,
      createdAt: serverTimestamp(),
      createdBy: this.userId,
      members: {
        [this.userId]: {
          role: 'host',
          joinedAt: serverTimestamp(),
        },
      },
      signaling: {},
    });

    this.setupRoomState();
    return this.roomCode;
  }

  async joinRoom(roomCode: string): Promise<string[]> {
    if (!this.userId) throw new Error('Not authenticated.');

    this.roomCode = roomCode.toUpperCase();
    this.isHost = false;

    const roomRef = ref(firebaseDb, `rooms/${this.roomCode}`);
    const { get: firebaseGet } = await import('firebase/database');
    const roomSnapshot = await firebaseGet(roomRef);
    if (!roomSnapshot.exists()) throw new Error('Room not found');

    const roomData = roomSnapshot.val();
    if (roomData.roomType !== 'party') {
      throw new Error('This room does not support party mode.');
    }

    const members = roomData.members || {};
    if (Object.keys(members).length >= (roomData.maxParticipants || 6)) {
      throw new Error('Room is full (max 6 participants).');
    }

    const memberRef = ref(
      firebaseDb,
      `rooms/${this.roomCode}/members/${this.userId}`
    );
    await set(memberRef, {
      role: 'member',
      joinedAt: serverTimestamp(),
    });

    this.setupRoomState();

    const existingUids = Object.keys(members).filter(
      (uid) => uid !== this.userId
    );
    existingUids.forEach((uid) => this.knownMembers.add(uid));

    return existingUids;
  }

  private setupRoomState() {
    const memberRef = ref(
      firebaseDb,
      `rooms/${this.roomCode}/members/${this.userId}`
    );
    onDisconnect(memberRef).remove();
    this.startHeartbeat();
    this.listenForMembers();
    this.listenForSignaling();
  }

  async sendOffer(
    toUid: string,
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.roomCode || !this.userId) return;
    const pairId = `${this.userId}_${toUid}`;
    await set(ref(firebaseDb, `rooms/${this.roomCode}/signaling/${pairId}/offer`), {
      type: offer.type,
      sdp: offer.sdp,
    });
  }

  async sendAnswer(
    toUid: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.roomCode || !this.userId) return;
    const pairId = `${this.userId}_${toUid}`;
    await set(
      ref(firebaseDb, `rooms/${this.roomCode}/signaling/${pairId}/answer`),
      { type: answer.type, sdp: answer.sdp }
    );
  }

  async sendIceCandidate(
    toUid: string,
    candidate: RTCIceCandidate
  ): Promise<void> {
    if (!this.roomCode || !this.userId) return;
    const pairId = `${this.userId}_${toUid}`;
    const candidatesRef = ref(
      firebaseDb,
      `rooms/${this.roomCode}/signaling/${pairId}/candidates`
    );
    await push(candidatesRef, {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sentBy: this.userId,
    });
  }

  private listenForMembers() {
    const membersRef = ref(firebaseDb, `rooms/${this.roomCode}/members`);
    const unsub = onValue(membersRef, (snapshot) => {
      const members = snapshot.val() || {};

      if (Object.keys(members).length === 0) {
        this.callbacks.onRoomDeleted();
        return;
      }

      const currentUids = new Set(Object.keys(members));

      // Check for new joins
      currentUids.forEach((uid) => {
        if (uid !== this.userId && !this.knownMembers.has(uid)) {
          this.knownMembers.add(uid);
          this.callbacks.onParticipantJoined(uid);
        }
      });

      // Check for leaves
      this.knownMembers.forEach((uid) => {
        if (!currentUids.has(uid)) {
          this.knownMembers.delete(uid);
          this.callbacks.onParticipantLeft(uid);
        }
      });
    });

    this.unsubscribers.push(() => off(membersRef, 'value', unsub));
  }

  private listenForSignaling() {
    const signalingRef = ref(firebaseDb, `rooms/${this.roomCode}/signaling`);

    const unsubAdded = onChildAdded(signalingRef, (snapshot) => {
      this.handleSignalingPair(snapshot);
    });

    const unsubChanged = onChildChanged(signalingRef, (snapshot) => {
      this.handleSignalingPair(snapshot);
    });

    this.unsubscribers.push(() => off(signalingRef, 'child_added', unsubAdded));
    this.unsubscribers.push(() =>
      off(signalingRef, 'child_changed', unsubChanged)
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleSignalingPair(snapshot: any) {
    const pairId = snapshot.key;
    const data = snapshot.val();
    if (!pairId || !data || !this.userId) return;

    const [senderId, receiverId] = pairId.split('_');

    // Process incoming offers destined for us
    if (receiverId === this.userId && data.offer) {
      this.callbacks.onOffer(senderId, data.offer);
    }

    // Answers appear on the same pair object mapped backward
    if (senderId === this.userId && data.answer) {
      this.callbacks.onAnswer(receiverId, data.answer);
    }

    // ICE candidates from any pair
    if (data.candidates) {
      Object.values(data.candidates).forEach((cand: any) => {
        if (cand.sentBy !== this.userId) {
          this.callbacks.onIceCandidate(cand.sentBy, cand);
        }
      });
    }
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      if (this.roomCode && this.userId) {
        try {
          await set(
            ref(
              firebaseDb,
              `rooms/${this.roomCode}/members/${this.userId}/heartbeat`
            ),
            serverTimestamp()
          );
        } catch {
          // Silently fail heartbeat
        }
      }
    }, 10000);
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++)
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  async leave() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.unsubscribers.forEach((unsub) => unsub());

    if (this.roomCode && this.userId) {
      const memberRef = ref(
        firebaseDb,
        `rooms/${this.roomCode}/members/${this.userId}`
      );
      await onDisconnect(memberRef).cancel();
      await remove(memberRef);
      if (this.isHost) {
        await remove(ref(firebaseDb, `rooms/${this.roomCode}`));
      }
    }
  }
}
