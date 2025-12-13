import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Share,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useDuetStore } from './src/hooks/useDuetStore';

// Color palette
const colors = {
  background: '#1a1a2e',
  surface: '#16213e',
  primary: '#e94560',
  secondary: '#0f3460',
  text: '#ffffff',
  textMuted: '#a0a0a0',
  success: '#4ade80',
  warning: '#fbbf24',
  danger: '#ef4444',
};

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Animated values for visual feedback
  const speakingScale = React.useRef(new Animated.Value(1)).current;
  const partnerScale = React.useRef(new Animated.Value(1)).current;
  
  const {
    connectionState,
    roomCode,
    isMuted,
    isDeafened,
    isSpeaking,
    isPartnerSpeaking,
    initialize,
    createRoom,
    joinRoom,
    leaveRoom,
    setMuted,
    setDeafened,
  } = useDuetStore();
  
  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initialize();
        setIsInitialized(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to initialize audio. Please restart the app.');
      }
    };
    init();
    
    return () => {
      leaveRoom();
    };
  }, []);
  
  // Animate when speaking
  useEffect(() => {
    Animated.spring(speakingScale, {
      toValue: isSpeaking ? 1.1 : 1,
      useNativeDriver: true,
    }).start();
  }, [isSpeaking]);
  
  useEffect(() => {
    Animated.spring(partnerScale, {
      toValue: isPartnerSpeaking ? 1.1 : 1,
      useNativeDriver: true,
    }).start();
  }, [isPartnerSpeaking]);
  
  const handleCreateRoom = async () => {
    setIsLoading(true);
    try {
      const code = await createRoom();
      
      // Offer to share the code
      Alert.alert(
        'Room Created',
        `Share this code with your partner: ${code}`,
        [
          { text: 'Copy & Share', onPress: () => shareCode(code) },
          { text: 'OK' },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleJoinRoom = async () => {
    if (joinCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-character room code');
      return;
    }
    
    setIsLoading(true);
    try {
      await joinRoom(joinCode.toUpperCase());
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLeave = () => {
    Alert.alert(
      'Leave Room',
      'Are you sure you want to disconnect?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leaveRoom },
      ]
    );
  };
  
  const shareCode = async (code: string) => {
    try {
      await Share.share({
        message: `Join me on Duet! Enter code: ${code}`,
      });
    } catch (error) {
      console.log('Share cancelled');
    }
  };
  
  const getConnectionColor = () => {
    switch (connectionState) {
      case 'connected': return colors.success;
      case 'connecting':
      case 'reconnecting': return colors.warning;
      case 'failed': return colors.danger;
      default: return colors.textMuted;
    }
  };
  
  const getConnectionText = () => {
    switch (connectionState) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'reconnecting': return 'Reconnecting...';
      case 'failed': return 'Connection Failed';
      default: return 'Disconnected';
    }
  };
  
  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Initializing audio...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Lobby view (not in a room)
  if (!roomCode) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        <View style={styles.header}>
          <Text style={styles.title}>Duet</Text>
          <Text style={styles.subtitle}>Stay connected while exploring</Text>
        </View>
        
        <View style={styles.lobbyContent}>
          {/* Create Room */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCreateRoom}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buttonText}>Create Room</Text>
            )}
          </TouchableOpacity>
          
          <Text style={styles.orText}>or</Text>
          
          {/* Join Room */}
          <View style={styles.joinSection}>
            <TextInput
              style={styles.codeInput}
              placeholder="ENTER CODE"
              placeholderTextColor={colors.textMuted}
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.secondaryButton, joinCode.length !== 6 && styles.buttonDisabled]}
              onPress={handleJoinRoom}
              disabled={isLoading || joinCode.length !== 6}
            >
              <Text style={styles.buttonText}>Join</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🎵 Play music on Spotify or Apple Music{'\n'}
            Your partner's voice will overlay on top
          </Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Connected view
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Duet</Text>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, { backgroundColor: getConnectionColor() }]} />
          <Text style={[styles.statusText, { color: getConnectionColor() }]}>
            {getConnectionText()}
          </Text>
        </View>
      </View>
      
      {/* Room Code */}
      <View style={styles.roomCodeSection}>
        <Text style={styles.roomCodeLabel}>Room Code</Text>
        <TouchableOpacity onPress={() => shareCode(roomCode)}>
          <Text style={styles.roomCode}>{roomCode}</Text>
        </TouchableOpacity>
        <Text style={styles.tapToShare}>Tap to share</Text>
      </View>
      
      {/* Voice Indicators */}
      <View style={styles.voiceSection}>
        {/* You */}
        <Animated.View style={[
          styles.voiceIndicator,
          { transform: [{ scale: speakingScale }] },
          isSpeaking && styles.voiceIndicatorActive,
        ]}>
          <Text style={styles.voiceEmoji}>🎤</Text>
          <Text style={styles.voiceLabel}>You</Text>
          {isMuted && <Text style={styles.mutedLabel}>MUTED</Text>}
        </Animated.View>
        
        {/* Partner */}
        <Animated.View style={[
          styles.voiceIndicator,
          { transform: [{ scale: partnerScale }] },
          isPartnerSpeaking && styles.voiceIndicatorActive,
        ]}>
          <Text style={styles.voiceEmoji}>👤</Text>
          <Text style={styles.voiceLabel}>Partner</Text>
          {isDeafened && <Text style={styles.mutedLabel}>DEAFENED</Text>}
        </Animated.View>
      </View>
      
      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={() => setMuted(!isMuted)}
        >
          <Text style={styles.controlEmoji}>{isMuted ? '🔇' : '🎤'}</Text>
          <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlButton, isDeafened && styles.controlButtonActive]}
          onPress={() => setDeafened(!isDeafened)}
        >
          <Text style={styles.controlEmoji}>{isDeafened ? '🔕' : '🔊'}</Text>
          <Text style={styles.controlLabel}>{isDeafened ? 'Undeafen' : 'Deafen'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.controlButton, styles.leaveButton]}
          onPress={handleLeave}
        >
          <Text style={styles.controlEmoji}>📵</Text>
          <Text style={styles.controlLabel}>Leave</Text>
        </TouchableOpacity>
      </View>
      
      {/* Tip */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🎵 Music from other apps will automatically{'\n'}
          lower when your partner speaks
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 4,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
  },
  lobbyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  orText: {
    color: colors.textMuted,
    fontSize: 16,
    marginVertical: 24,
  },
  joinSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  codeInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 4,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: 180,
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 16,
  },
  roomCodeSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  roomCodeLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  roomCode: {
    color: colors.text,
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 8,
    marginVertical: 8,
  },
  tapToShare: {
    color: colors.textMuted,
    fontSize: 12,
  },
  voiceSection: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  voiceIndicator: {
    backgroundColor: colors.surface,
    borderRadius: 100,
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
  voiceIndicatorActive: {
    borderColor: colors.success,
    backgroundColor: colors.secondary,
  },
  voiceEmoji: {
    fontSize: 36,
  },
  voiceLabel: {
    color: colors.text,
    fontSize: 14,
    marginTop: 8,
  },
  mutedLabel: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 24,
  },
  controlButton: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    minWidth: 80,
  },
  controlButtonActive: {
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  leaveButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  controlEmoji: {
    fontSize: 24,
  },
  controlLabel: {
    color: colors.text,
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
