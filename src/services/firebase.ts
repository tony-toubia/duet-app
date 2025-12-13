// src/services/firebase.ts
// Firebase configuration for WebRTC signaling

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, remove, push, onChildAdded } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

export const signIn = async (): Promise<string> => {
  const result = await signInAnonymously(auth);
  return result.user.uid;
};

export const createRoom = async (roomId: string, oderId: string) => {
  const roomRef = ref(database, `rooms/${roomId}`);
  await set(roomRef, {
    createdBy: oderId,
    createdAt: Date.now(),
    members: { [oderId]: true }
  });
  return roomId;
};

export const joinRoom = async (roomId: string, oderId: string) => {
  const memberRef = ref(database, `rooms/${roomId}/members/${oderId}`);
  await set(memberRef, true);
};

export const leaveRoom = async (roomId: string, oderId: string) => {
  const memberRef = ref(database, `rooms/${roomId}/members/${oderId}`);
  await remove(memberRef);
};

export const sendSignal = async (roomId: string, oderId: string, signal: any) => {
  const signalRef = ref(database, `rooms/${roomId}/signals`);
  await push(signalRef, { oderId, signal, timestamp: Date.now() });
};

export const listenForSignals = (
  roomId: string, 
  myPeerId: string,
  onSignal: (signal: any, fromPeerId: string) => void
) => {
  const signalsRef = ref(database, `rooms/${roomId}/signals`);
  return onChildAdded(signalsRef, (snapshot) => {
    const data = snapshot.val();
    if (data.oderId !== myPeerId) {
      onSignal(data.signal, data.oderId);
    }
  });
};

export const sendIceCandidate = async (roomId: string, oderId: string, candidate: any) => {
  const candidateRef = ref(database, `rooms/${roomId}/candidates`);
  await push(candidateRef, { oderId, candidate, timestamp: Date.now() });
};

export const listenForIceCandidates = (
  roomId: string,
  myPeerId: string,
  onCandidate: (candidate: any) => void
) => {
  const candidatesRef = ref(database, `rooms/${roomId}/candidates`);
  return onChildAdded(candidatesRef, (snapshot) => {
    const data = snapshot.val();
    if (data.oderId !== myPeerId) {
      onCandidate(data.candidate);
    }
  });
};

export { database, auth };
