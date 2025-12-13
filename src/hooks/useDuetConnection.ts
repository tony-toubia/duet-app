// src/hooks/useDuetConnection.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { MediaStream } from 'react-native-webrtc';
import { WebRTCService, ConnectionState } from '../services/webrtc';
import { DuetAudio } from '../native/DuetAudio';
import { useDuetStore } from '../services/store';
import { signIn, createRoom, joinRoom } from '../services/firebase';

export function useDuetConnection() {
  const webrtcRef = useRef<WebRTCService | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setConnectionState = useDuetStore((s) => s.setConnectionState);
  const setRemoteStream = useDuetStore((s) => s.setRemoteStream);
  const setLocalStream = useDuetStore((s) => s.setLocalStream);
  const setPeerId = useDuetStore((s) => s.setPeerId);
  const setRoomId = useDuetStore((s) => s.setRoomId);
  const isMuted = useDuetStore((s) => s.isMuted);

  const initialize = useCallback(async () => {
    try {
      setError(null);
      const audioConfig = await DuetAudio.configureAudioSession();
      console.log('Audio session configured:', audioConfig);

      const oderId = await signIn();
      setPeerId(oderId);
      console.log('Signed in with peer ID:', oderId);

      webrtcRef.current = new WebRTCService({
        onConnectionStateChange: (state: ConnectionState) => {
          console.log('Connection state:', state);
          setConnectionState(state);
        },
        onRemoteStream: (stream: MediaStream) => {
          console.log('Got remote stream');
          setRemoteStream(stream);
        },
        onError: (err: Error) => {
          console.error('WebRTC error:', err);
          setError(err.message);
        },
      });

      const localStream = await webrtcRef.current.initializeLocalStream();
      setLocalStream(localStream);
      setIsInitialized(true);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize');
      console.error('Initialization error:', err);
    }
  }, [setConnectionState, setRemoteStream, setLocalStream, setPeerId]);

  const create = useCallback(async (roomCode: string) => {
    if (!webrtcRef.current || !isInitialized) return setError('Not initialized');
    const oderId = useDuetStore.getState().oderId;
    if (!oderId) return setError('No peer ID');
    try {
      await createRoom(roomCode, oderId);
      setRoomId(roomCode);
      await webrtcRef.current.createRoom(roomCode, oderId);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    }
  }, [isInitialized, setRoomId]);

  const join = useCallback(async (roomCode: string) => {
    if (!webrtcRef.current || !isInitialized) return setError('Not initialized');
    const oderId = useDuetStore.getState().oderId;
    if (!oderId) return setError('No peer ID');
    try {
      await joinRoom(roomCode, oderId);
      setRoomId(roomCode);
      await webrtcRef.current.joinRoom(roomCode, oderId);
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    }
  }, [isInitialized, setRoomId]);

  const disconnect = useCallback(async () => {
    webrtcRef.current?.disconnect();
    webrtcRef.current = null;
    await DuetAudio.deactivateAudioSession();
    setIsInitialized(false);
    setRoomId(null);
    setRemoteStream(null);
    setLocalStream(null);
  }, [setRoomId, setRemoteStream, setLocalStream]);

  useEffect(() => {
    webrtcRef.current?.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  return { isInitialized, error, initialize, create, join, disconnect };
}
