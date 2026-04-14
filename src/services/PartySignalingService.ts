import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import { RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import { analyticsService } from './AnalyticsService';

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

    await this.roomRef.set({
      roomType: 'party',
      maxParticipants: 6,
      createdAt: database.ServerValue.TIMESTAMP,
      createdBy: this.userId,
      members: {
        [this.userId]: {
          role: 'host',
          joinedAt: database.ServerValue.TIMESTAMP,
        },
      },
      signaling: {}
    });

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
    if (Object.keys(members).length >= (roomData.maxParticipants || 6)) {
      throw new Error('Room is full (max 6 participants).');
    }

    await this.roomRef.child('members').child(this.userId).set({
      role: 'member',
      joinedAt: database.ServerValue.TIMESTAMP,
    });

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
    const pairId = `${this.userId}_${toUid}`;
    // Sent on the reverse pairId, keeping it consistent for the receiver
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

  private handleSignalingPair(snapshot: any) {
    const pairId = snapshot.key;
    const data = snapshot.val();
    if (!pairId || !data || !this.userId) return;

    const [senderId, receiverId] = pairId.split('_');
    
    // Process incoming signaling messages destined for US
    if (receiverId === this.userId) {
      if (data.offer) {
        this.callbacks.onOffer(senderId, data.offer as RTCSessionDescription);
      }
    }
    
    // Answer routing occurs on the SAME pair object but mapped backward, meaning
    // if I sent the offer (I am senderId), the answer will pop up on this pair.
    if (senderId === this.userId) {
      if (data.answer) {
         this.callbacks.onAnswer(receiverId, data.answer as RTCSessionDescription);
      }
    }

    // Processing incoming ICE candidates globally from any pair tracking we maintain
    if (data.candidates) {
      Object.values(data.candidates).forEach((cand: any) => {
        if (cand.sentBy !== this.userId) {
          this.callbacks.onIceCandidate(cand.sentBy, cand as RTCIceCandidate);
        }
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
