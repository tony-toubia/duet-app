// src/services/firebase.ts
// Firebase configuration for WebRTC signaling
// Uses @react-native-firebase (native SDK)

import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

export const signIn = async (): Promise<string> => {
  const result = await auth().signInAnonymously();
  return result.user.uid;
};

export const createRoom = async (roomId: string, oderId: string) => {
  await database().ref(`rooms/${roomId}`).set({
    createdBy: oderId,
    createdAt: Date.now(),
    members: { [oderId]: true }
  });
  return roomId;
};

export const joinRoom = async (roomId: string, oderId: string) => {
  await database().ref(`rooms/${roomId}/members/${oderId}`).set(true);
};

export const leaveRoom = async (roomId: string, oderId: string) => {
  await database().ref(`rooms/${roomId}/members/${oderId}`).remove();
};

export const sendSignal = async (roomId: string, oderId: string, signal: any) => {
  await database().ref(`rooms/${roomId}/signals`).push({ oderId, signal, timestamp: Date.now() });
};

export const listenForSignals = (
  roomId: string,
  myPeerId: string,
  onSignal: (signal: any, fromPeerId: string) => void
) => {
  const signalsRef = database().ref(`rooms/${roomId}/signals`);
  signalsRef.on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (data.oderId !== myPeerId) {
      onSignal(data.signal, data.oderId);
    }
  });
  return () => signalsRef.off('child_added');
};

export const sendIceCandidate = async (roomId: string, oderId: string, candidate: any) => {
  await database().ref(`rooms/${roomId}/candidates`).push({ oderId, candidate, timestamp: Date.now() });
};

export const listenForIceCandidates = (
  roomId: string,
  myPeerId: string,
  onCandidate: (candidate: any) => void
) => {
  const candidatesRef = database().ref(`rooms/${roomId}/candidates`);
  candidatesRef.on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (data.oderId !== myPeerId) {
      onCandidate(data.candidate);
    }
  });
  return () => candidatesRef.off('child_added');
};
