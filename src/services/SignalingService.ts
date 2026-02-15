import database from '@react-native-firebase/database';
import auth from '@react-native-firebase/auth';
import { RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';

/**
 * Firebase Signaling Service
 * 
 * Handles WebRTC signaling (offer/answer/ICE candidates) via Firebase Realtime Database.
 * This is the "meeting point" where two devices coordinate to establish a direct connection.
 * 
 * Database structure:
 * /rooms/{roomCode}/
 *   - offer: RTCSessionDescription
 *   - answer: RTCSessionDescription
 *   - offerCandidates/: ICE candidates from offerer
 *   - answerCandidates/: ICE candidates from answerer
 *   - members/: { oderId: true, answererId: true }
 */

export interface SignalingCallbacks {
  onOffer: (offer: RTCSessionDescription) => void;
  onAnswer: (answer: RTCSessionDescription) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onPartnerJoined: () => void;
  onPartnerLeft: () => void;
  onError: (error: Error) => void;
}

export class SignalingService {
  private roomRef: any = null;
  private roomCode: string | null = null;
  private userId: string | null = null;
  private isOfferer: boolean = false;
  private callbacks: SignalingCallbacks;
  private unsubscribers: (() => void)[] = [];
  
  constructor(callbacks: SignalingCallbacks) {
    this.callbacks = callbacks;
  }
  
  /**
   * Initialize with the current authenticated user
   */
  async initialize(): Promise<string> {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      const error = new Error('Not authenticated. User must sign in before initializing signaling.');
      this.callbacks.onError(error);
      throw error;
    }
    this.userId = currentUser.uid;
    console.log('[Signaling] Authenticated as:', this.userId);
    return this.userId;
  }
  
  /**
   * Create a new room (you're the offerer)
   */
  async createRoom(): Promise<string> {
    if (!this.userId) {
      throw new Error('Not authenticated. Call initialize() first.');
    }
    
    // Generate 6-character room code
    this.roomCode = this.generateRoomCode();
    this.isOfferer = true;
    
    this.roomRef = database().ref(`rooms/${this.roomCode}`);
    
    // Set up the room with you as the first member
    await this.roomRef.set({
      createdAt: database.ServerValue.TIMESTAMP,
      createdBy: this.userId,
      members: {
        [this.userId]: {
          role: 'offerer',
          joinedAt: database.ServerValue.TIMESTAMP,
        },
      },
    });
    
    // Clean up room when you disconnect
    this.roomRef.onDisconnect().remove();
    
    // Listen for partner joining
    this.listenForPartner();
    
    // Listen for answer
    this.listenForAnswer();
    
    // Listen for answer ICE candidates
    this.listenForIceCandidates('answerCandidates');
    
    console.log('[Signaling] Created room:', this.roomCode);
    return this.roomCode;
  }
  
  /**
   * Join an existing room (you're the answerer)
   */
  async joinRoom(roomCode: string): Promise<void> {
    if (!this.userId) {
      throw new Error('Not authenticated. Call initialize() first.');
    }
    
    this.roomCode = roomCode.toUpperCase();
    this.isOfferer = false;
    
    this.roomRef = database().ref(`rooms/${this.roomCode}`);
    
    // Check if room exists
    const roomSnapshot = await this.roomRef.once('value');
    if (!roomSnapshot.exists()) {
      throw new Error('Room not found');
    }
    
    // Add yourself as a member
    await this.roomRef.child('members').child(this.userId).set({
      role: 'answerer',
      joinedAt: database.ServerValue.TIMESTAMP,
    });
    
    // Remove yourself when you disconnect
    this.roomRef.child('members').child(this.userId).onDisconnect().remove();
    
    // Listen for offer
    this.listenForOffer();
    
    // Listen for offer ICE candidates
    this.listenForIceCandidates('offerCandidates');
    
    // Listen for partner leaving
    this.listenForPartner();
    
    console.log('[Signaling] Joined room:', this.roomCode);
  }
  
  /**
   * Send offer (offerer only)
   */
  async sendOffer(offer: RTCSessionDescription): Promise<void> {
    if (!this.roomRef || !this.isOfferer) {
      throw new Error('Cannot send offer');
    }
    
    await this.roomRef.child('offer').set({
      type: offer.type,
      sdp: offer.sdp,
    });
    
    console.log('[Signaling] Sent offer');
  }
  
  /**
   * Send answer (answerer only)
   */
  async sendAnswer(answer: RTCSessionDescription): Promise<void> {
    if (!this.roomRef || this.isOfferer) {
      throw new Error('Cannot send answer');
    }
    
    await this.roomRef.child('answer').set({
      type: answer.type,
      sdp: answer.sdp,
    });
    
    console.log('[Signaling] Sent answer');
  }
  
  /**
   * Send ICE candidate
   */
  async sendIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.roomRef) {
      throw new Error('Not in a room');
    }
    
    const candidatesPath = this.isOfferer ? 'offerCandidates' : 'answerCandidates';
    
    await this.roomRef.child(candidatesPath).push({
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    });
  }
  
  /**
   * Listen for offer (answerer side)
   */
  private listenForOffer(): void {
    const offerRef = this.roomRef.child('offer');
    
    const unsubscribe = offerRef.on('value', (snapshot: any) => {
      const offer = snapshot.val();
      if (offer) {
        console.log('[Signaling] Received offer');
        this.callbacks.onOffer(offer as RTCSessionDescription);
      }
    });
    
    this.unsubscribers.push(() => offerRef.off('value', unsubscribe));
  }
  
  /**
   * Listen for answer (offerer side)
   */
  private listenForAnswer(): void {
    const answerRef = this.roomRef.child('answer');
    
    const unsubscribe = answerRef.on('value', (snapshot: any) => {
      const answer = snapshot.val();
      if (answer) {
        console.log('[Signaling] Received answer');
        this.callbacks.onAnswer(answer as RTCSessionDescription);
      }
    });
    
    this.unsubscribers.push(() => answerRef.off('value', unsubscribe));
  }
  
  /**
   * Listen for ICE candidates
   */
  private listenForIceCandidates(path: string): void {
    const candidatesRef = this.roomRef.child(path);
    
    const unsubscribe = candidatesRef.on('child_added', (snapshot: any) => {
      const candidate = snapshot.val();
      if (candidate) {
        console.log('[Signaling] Received ICE candidate');
        this.callbacks.onIceCandidate(candidate as RTCIceCandidate);
      }
    });
    
    this.unsubscribers.push(() => candidatesRef.off('child_added', unsubscribe));
  }
  
  /**
   * Listen for partner joining/leaving
   */
  private listenForPartner(): void {
    const membersRef = this.roomRef.child('members');

    const unsubscribe = membersRef.on('value', (snapshot: any) => {
      const members = snapshot.val();
      console.log('[Signaling] Members update:', members ? Object.keys(members).length : 0, 'members');
      if (members) {
        const memberCount = Object.keys(members).length;

        if (memberCount === 2) {
          console.log('[Signaling] Partner joined! Triggering onPartnerJoined callback');
          this.callbacks.onPartnerJoined();
        } else if (memberCount === 1) {
          // Only you left in the room
          console.log('[Signaling] Partner left (only 1 member remaining)');
          this.callbacks.onPartnerLeft();
        }
      }
    });

    this.unsubscribers.push(() => membersRef.off('value', unsubscribe));
  }
  
  /**
   * Generate a random 6-character room code
   */
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0,O,1,I)
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  
  /**
   * Get current room code
   */
  getRoomCode(): string | null {
    return this.roomCode;
  }
  
  /**
   * Leave room and cleanup
   */
  async leave(): Promise<void> {
    // Unsubscribe from all listeners
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    
    // Remove yourself from the room
    if (this.roomRef && this.userId) {
      await this.roomRef.child('members').child(this.userId).remove();
      
      // If you're the offerer, delete the whole room
      if (this.isOfferer) {
        await this.roomRef.remove();
      }
    }
    
    this.roomRef = null;
    this.roomCode = null;
    
    console.log('[Signaling] Left room');
  }
}

export default SignalingService;
