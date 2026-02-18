import {
  ref,
  set,
  get,
  push,
  remove,
  onValue,
  onChildAdded,
  onDisconnect,
  serverTimestamp,
  child,
} from 'firebase/database';
import { firebaseAuth, firebaseDb } from './firebase';

export interface SignalingCallbacks {
  onOffer: (offer: RTCSessionDescriptionInit) => void;
  onAnswer: (answer: RTCSessionDescriptionInit) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onPartnerJoined: () => void;
  onPartnerLeft: () => void;
  onRoomDeleted: () => void;
  onError: (error: Error) => void;
}

export class SignalingService {
  private roomCode: string | null = null;
  private userId: string | null = null;
  private isOfferer = false;
  private callbacks: SignalingCallbacks;
  private unsubscribers: (() => void)[] = [];
  private partnerEverJoined = false;

  constructor(callbacks: SignalingCallbacks) {
    this.callbacks = callbacks;
  }

  async initialize(uid?: string): Promise<string> {
    // Accept uid directly to avoid race where firebaseAuth.currentUser
    // is briefly null during anonymous → Google sign-in transition.
    const resolvedUid = uid || firebaseAuth.currentUser?.uid;
    if (!resolvedUid) {
      const error = new Error('Not authenticated. User must sign in before initializing signaling.');
      this.callbacks.onError(error);
      throw error;
    }
    this.userId = resolvedUid;
    console.log('[Signaling] Authenticated as:', this.userId);
    return this.userId;
  }

  async createRoom(): Promise<string> {
    if (!this.userId) {
      throw new Error('Not authenticated. Call initialize() first.');
    }

    this.roomCode = this.generateRoomCode();
    this.isOfferer = true;

    const roomRef = ref(firebaseDb, `rooms/${this.roomCode}`);

    await set(roomRef, {
      createdAt: serverTimestamp(),
      createdBy: this.userId,
      members: {
        [this.userId]: {
          role: 'offerer',
          joinedAt: serverTimestamp(),
        },
      },
    });

    // Remove self from members on disconnect
    const memberRef = child(roomRef, `members/${this.userId}`);
    onDisconnect(memberRef).remove();

    // Re-add ourselves when Firebase reconnects (e.g., after tab hidden)
    this.listenForReconnect();

    this.listenForPartner();
    this.listenForAnswer();
    this.listenForIceCandidates('answerCandidates');

    console.log('[Signaling] Created room:', this.roomCode);
    return this.roomCode;
  }

  async joinRoom(roomCode: string): Promise<void> {
    if (!this.userId) {
      throw new Error('Not authenticated. Call initialize() first.');
    }

    this.roomCode = roomCode.toUpperCase();
    this.isOfferer = false;

    const roomRef = ref(firebaseDb, `rooms/${this.roomCode}`);

    const roomSnapshot = await get(roomRef);
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found');
    }

    // Check if this user is already in the room (same account on another device)
    const roomData = roomSnapshot.val();
    if (roomData?.members && roomData.members[this.userId]) {
      throw new Error('You are already in this room on another device. Please use a different account or leave the room on the other device first.');
    }

    const memberRef = child(roomRef, `members/${this.userId}`);
    await set(memberRef, {
      role: 'answerer',
      joinedAt: serverTimestamp(),
    });

    onDisconnect(memberRef).remove();

    // Re-add ourselves when Firebase reconnects (e.g., after tab hidden)
    this.listenForReconnect();

    this.listenForOffer();
    this.listenForIceCandidates('offerCandidates');
    this.listenForPartner();

    console.log('[Signaling] Joined room:', this.roomCode);
  }

  async sendOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.roomCode || !this.isOfferer) {
      throw new Error('Cannot send offer');
    }
    await set(ref(firebaseDb, `rooms/${this.roomCode}/offer`), {
      type: offer.type,
      sdp: offer.sdp,
    });
    console.log('[Signaling] Sent offer');
  }

  async sendAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.roomCode || this.isOfferer) {
      throw new Error('Cannot send answer');
    }
    await set(ref(firebaseDb, `rooms/${this.roomCode}/answer`), {
      type: answer.type,
      sdp: answer.sdp,
    });
    console.log('[Signaling] Sent answer');
  }

  async sendIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.roomCode) {
      throw new Error('Not in a room');
    }
    const candidatesPath = this.isOfferer ? 'offerCandidates' : 'answerCandidates';
    const candidatesRef = ref(firebaseDb, `rooms/${this.roomCode}/${candidatesPath}`);
    await push(candidatesRef, {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    });
  }

  private listenForOffer(): void {
    const offerRef = ref(firebaseDb, `rooms/${this.roomCode}/offer`);
    const unsub = onValue(offerRef, (snapshot) => {
      const offer = snapshot.val();
      if (offer) {
        console.log('[Signaling] Received offer');
        this.callbacks.onOffer(offer as RTCSessionDescriptionInit);
      }
    });
    this.unsubscribers.push(unsub);
  }

  private listenForAnswer(): void {
    const answerRef = ref(firebaseDb, `rooms/${this.roomCode}/answer`);
    const unsub = onValue(answerRef, (snapshot) => {
      const answer = snapshot.val();
      if (answer) {
        console.log('[Signaling] Received answer');
        this.callbacks.onAnswer(answer as RTCSessionDescriptionInit);
      }
    });
    this.unsubscribers.push(unsub);
  }

  private listenForIceCandidates(path: string): void {
    const candidatesRef = ref(firebaseDb, `rooms/${this.roomCode}/${path}`);
    const unsub = onChildAdded(candidatesRef, (snapshot) => {
      const candidate = snapshot.val();
      if (candidate) {
        console.log('[Signaling] Received ICE candidate');
        this.callbacks.onIceCandidate(candidate as RTCIceCandidateInit);
      }
    });
    this.unsubscribers.push(unsub);
  }

  /**
   * Re-add ourselves as a member when Firebase reconnects after a disconnect
   * (e.g., tab was hidden and onDisconnect fired, removing our member entry).
   */
  private listenForReconnect(): void {
    const connRef = ref(firebaseDb, '.info/connected');
    const role = this.isOfferer ? 'offerer' : 'answerer';

    const unsub = onValue(connRef, async (snapshot) => {
      if (snapshot.val() === true && this.roomCode && this.userId) {
        // Firebase just reconnected — re-add ourselves and re-register onDisconnect
        const memberRef = ref(firebaseDb, `rooms/${this.roomCode}/members/${this.userId}`);
        await set(memberRef, {
          role,
          joinedAt: serverTimestamp(),
        });
        onDisconnect(memberRef).remove();
        console.log('[Signaling] Reconnected — re-registered as member');
      }
    });

    this.unsubscribers.push(unsub);
  }

  private listenForPartner(): void {
    const membersRef = ref(firebaseDb, `rooms/${this.roomCode}/members`);
    const unsub = onValue(membersRef, async (snapshot) => {
      const members = snapshot.val();
      const memberCount = members ? Object.keys(members).length : 0;
      console.log('[Signaling] Members update:', memberCount, 'members');

      if (memberCount >= 2) {
        this.partnerEverJoined = true;
        console.log('[Signaling] Partner joined!');
        this.callbacks.onPartnerJoined();
      } else if (memberCount <= 1 && this.partnerEverJoined) {
        console.log('[Signaling] Partner left (only', memberCount, 'member remaining)');
        this.callbacks.onPartnerLeft();
      } else if (memberCount === 0) {
        // Members node was deleted — check if room itself still exists
        console.log('[Signaling] Members empty, checking room existence...');
        const roomSnap = await get(ref(firebaseDb, `rooms/${this.roomCode}`));
        if (!roomSnap.exists()) {
          console.log('[Signaling] Room deleted entirely');
          this.callbacks.onRoomDeleted();
        }
        // If room exists but members is empty, host may have backgrounded — don't eject
      }
    });
    this.unsubscribers.push(unsub);
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  getRoomCode(): string | null {
    return this.roomCode;
  }

  getUserId(): string | null {
    return this.userId;
  }

  async getPartnerUid(): Promise<string | null> {
    if (!this.roomCode || !this.userId) return null;
    const membersSnap = await get(ref(firebaseDb, `rooms/${this.roomCode}/members`));
    const members = membersSnap.val();
    if (!members) return null;
    const uids = Object.keys(members);
    return uids.find((uid) => uid !== this.userId) || null;
  }

  async leave(): Promise<void> {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    if (this.roomCode && this.userId) {
      const memberRef = ref(firebaseDb, `rooms/${this.roomCode}/members/${this.userId}`);
      try {
        await onDisconnect(memberRef).cancel();
        await remove(memberRef);

        if (this.isOfferer) {
          await remove(ref(firebaseDb, `rooms/${this.roomCode}`));
        }
      } catch (e) {
        console.warn('[Signaling] Cleanup error:', e);
      }
    }

    this.roomCode = null;
    console.log('[Signaling] Left room');
  }
}
