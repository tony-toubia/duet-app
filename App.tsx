import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
  Animated,
  ScrollView,
  useWindowDimensions,
  Switch,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDuetStore } from './src/hooks/useDuetStore';
import { NavigationWidget } from './src/components/NavigationWidget';

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

// Responsive breakpoint
const TABLET_MIN_WIDTH = 600;
const CONTENT_MAX_WIDTH = 480;

function useLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const contentWidth = isTablet ? Math.min(CONTENT_MAX_WIDTH, width * 0.6) : width;
  const scale = isTablet ? 1.25 : 1;
  return { width, height, isTablet, contentWidth, scale };
}

// VAD Sensitivity Control Component
const SensitivityControl = ({
  value,
  onChange,
  scale,
}: {
  value: number;
  onChange: (val: number) => void;
  scale: number;
}) => {
  const levels = [
    { value: 20, label: 'Low' },
    { value: 35, label: '' },
    { value: 50, label: 'Med' },
    { value: 65, label: '' },
    { value: 80, label: 'High' },
  ];

  const dotSize = 32 * scale;

  return (
    <View style={styles.sensitivityContainer}>
      <Text style={[styles.sensitivityTitle, { fontSize: 12 * scale }]}>Mic Sensitivity</Text>
      <View style={styles.sensitivityLevels}>
        {levels.map((level) => {
          const isActive = value >= level.value - 7;
          return (
            <TouchableOpacity
              key={level.value}
              style={[
                styles.sensitivityDot,
                { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
                isActive && styles.sensitivityDotActive,
              ]}
              onPress={() => onChange(level.value)}
            >
              {level.label ? (
                <Text style={[
                  styles.sensitivityLabel,
                  { fontSize: 9 * scale },
                  isActive && styles.sensitivityLabelActive,
                ]}>{level.label}</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.sensitivityHint, { fontSize: 11 * scale }]}>
        {value < 35 ? 'Best for quiet environments' :
         value > 65 ? 'Best for loud environments' :
         'Balanced for most situations'}
      </Text>
    </View>
  );
};

// Media Control Component
const MediaControls = ({ scale }: { scale: number }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const { DuetAudio } = require('./src/native/DuetAudio');

  const handlePrevious = () => {
    DuetAudio.mediaPrevious();
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    DuetAudio.mediaPlayPause();
  };

  const handleNext = () => {
    DuetAudio.mediaNext();
  };

  const mainBtnSize = 50 * scale;

  return (
    <View style={styles.mediaControls}>
      <Text style={[styles.mediaTitle, { fontSize: 12 * scale }]}>Media Controls</Text>
      <View style={styles.mediaButtons}>
        <TouchableOpacity style={styles.mediaButton} onPress={handlePrevious}>
          <Text style={[styles.mediaButtonText, { fontSize: 24 * scale }]}>⏮</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mediaButtonMain, { width: mainBtnSize, height: mainBtnSize, borderRadius: mainBtnSize / 2 }]}
          onPress={handlePlayPause}
        >
          <Text style={{ fontSize: 20 * scale }}>{isPlaying ? '⏸' : '▶️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mediaButton} onPress={handleNext}>
          <Text style={[styles.mediaButtonText, { fontSize: 24 * scale }]}>⏭</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

function AppContent() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const { isTablet, contentWidth, scale } = useLayout();

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
    vadSensitivity,
    duckingEnabled,
    initialize,
    createRoom,
    joinRoom,
    leaveRoom,
    setMuted,
    setDeafened,
    setVadSensitivity,
    setDuckingEnabled,
  } = useDuetStore();

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

  // Responsive sizes
  const voiceIndicatorSize = 120 * scale;
  const voiceEmojiSize = 36 * scale;
  const controlEmojiSize = 24 * scale;
  const controlMinWidth = 80 * scale;

  // Wrapper that centers content on tablet
  const ContentWrapper = ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <View style={[{ width: '100%', alignItems: 'center' }, style]}>
      <View style={{ width: contentWidth, maxWidth: '100%' }}>
        {children}
      </View>
    </View>
  );

  if (!isInitialized) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Initializing audio...</Text>
        </View>
      </View>
    );
  }

  // Lobby view (not in a room)
  if (!roomCode) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar style="light" />

        <View style={styles.header}>
          <Text style={[styles.title, { fontSize: 32 * scale }]}>Duet</Text>
          <Text style={[styles.subtitle, { fontSize: 16 * scale }]}>Stay connected while exploring</Text>
        </View>

        <View style={styles.lobbyContent}>
          <TouchableOpacity
            style={[styles.primaryButton, { paddingVertical: 16 * scale, paddingHorizontal: 48 * scale, minWidth: 200 * scale }]}
            onPress={handleCreateRoom}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={[styles.buttonText, { fontSize: 18 * scale }]}>Create Room</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.orText, { fontSize: 16 * scale }]}>or</Text>

          <View style={styles.joinSection}>
            <TextInput
              style={[styles.codeInput, { fontSize: 20 * scale, width: 180 * scale, paddingVertical: 16 * scale }]}
              placeholder="ENTER CODE"
              placeholderTextColor={colors.textMuted}
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.secondaryButton, { paddingVertical: 16 * scale, paddingHorizontal: 24 * scale }, joinCode.length !== 6 && styles.buttonDisabled]}
              onPress={handleJoinRoom}
              disabled={isLoading || joinCode.length !== 6}
            >
              <Text style={[styles.buttonText, { fontSize: 18 * scale }]}>Join</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { fontSize: 13 * scale }]}>
            Play music on Spotify or Apple Music{'\n'}
            Your partner's voice will overlay on top
          </Text>
        </View>
      </View>
    );
  }

  // Connected view - use ScrollView so it works on all screen sizes
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[styles.connectedScroll, { alignItems: 'center' }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: contentWidth, maxWidth: '100%' }}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { fontSize: 32 * scale }]}>Duet</Text>
            <View style={styles.connectionStatus}>
              <View style={[styles.statusDot, { backgroundColor: getConnectionColor() }]} />
              <Text style={[styles.statusText, { color: getConnectionColor(), fontSize: 14 * scale }]}>
                {getConnectionText()}
              </Text>
            </View>
          </View>

          {/* Room Code */}
          <View style={styles.roomCodeSection}>
            <Text style={[styles.roomCodeLabel, { fontSize: 14 * scale }]}>Room Code</Text>
            <TouchableOpacity onPress={() => shareCode(roomCode)}>
              <Text style={[styles.roomCode, { fontSize: 36 * scale }]}>{roomCode}</Text>
            </TouchableOpacity>
            <Text style={[styles.tapToShare, { fontSize: 12 * scale }]}>Tap to share</Text>
          </View>

          {/* Voice Indicators */}
          <View style={[styles.voiceSection, { gap: 32 * scale, paddingVertical: 24 * scale }]}>
            <Animated.View style={[
              styles.voiceIndicator,
              {
                width: voiceIndicatorSize,
                height: voiceIndicatorSize,
                borderRadius: voiceIndicatorSize / 2,
                transform: [{ scale: speakingScale }],
              },
              isSpeaking && styles.voiceIndicatorActive,
            ]}>
              <Text style={{ fontSize: voiceEmojiSize }}>🎤</Text>
              <Text style={[styles.voiceLabel, { fontSize: 14 * scale }]}>You</Text>
              {isMuted && <Text style={[styles.mutedLabel, { fontSize: 10 * scale }]}>MUTED</Text>}
            </Animated.View>

            <Animated.View style={[
              styles.voiceIndicator,
              {
                width: voiceIndicatorSize,
                height: voiceIndicatorSize,
                borderRadius: voiceIndicatorSize / 2,
                transform: [{ scale: partnerScale }],
              },
              isPartnerSpeaking && styles.voiceIndicatorActive,
            ]}>
              <Text style={{ fontSize: voiceEmojiSize }}>👤</Text>
              <Text style={[styles.voiceLabel, { fontSize: 14 * scale }]}>Partner</Text>
              {isDeafened && <Text style={[styles.mutedLabel, { fontSize: 10 * scale }]}>DEAFENED</Text>}
            </Animated.View>
          </View>

          {/* Controls */}
          <View style={[styles.controls, { gap: 16 * scale }]}>
            <TouchableOpacity
              style={[styles.controlButton, { minWidth: controlMinWidth, paddingVertical: 16 * scale, paddingHorizontal: 20 * scale }, isMuted && styles.controlButtonActive]}
              onPress={() => setMuted(!isMuted)}
            >
              <Text style={{ fontSize: controlEmojiSize }}>{isMuted ? '🔇' : '🎤'}</Text>
              <Text style={[styles.controlLabel, { fontSize: 12 * scale }]}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { minWidth: controlMinWidth, paddingVertical: 16 * scale, paddingHorizontal: 20 * scale }, isDeafened && styles.controlButtonActive]}
              onPress={() => setDeafened(!isDeafened)}
            >
              <Text style={{ fontSize: controlEmojiSize }}>{isDeafened ? '🔕' : '🔊'}</Text>
              <Text style={[styles.controlLabel, { fontSize: 12 * scale }]}>{isDeafened ? 'Undeafen' : 'Deafen'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.leaveButton, { minWidth: controlMinWidth, paddingVertical: 16 * scale, paddingHorizontal: 20 * scale }]}
              onPress={handleLeave}
            >
              <Text style={{ fontSize: controlEmojiSize }}>📵</Text>
              <Text style={[styles.controlLabel, { fontSize: 12 * scale }]}>Leave</Text>
            </TouchableOpacity>
          </View>

          {/* Media Controls */}
          <MediaControls scale={scale} />

          {/* Sensitivity Control */}
          <SensitivityControl value={vadSensitivity} onChange={setVadSensitivity} scale={scale} />

          {/* iOS Ducking Toggle */}
          {Platform.OS === 'ios' && (
            <View style={[styles.duckingContainer, { marginHorizontal: 20 }]}>
              <View style={styles.duckingRow}>
                <View style={styles.duckingTextContainer}>
                  <Text style={[styles.duckingTitle, { fontSize: 12 * scale }]}>Lower other audio</Text>
                  <Text style={[styles.duckingWarning, { fontSize: 10 * scale }]}>Some apps may pause instead</Text>
                </View>
                <Switch
                  value={duckingEnabled}
                  onValueChange={setDuckingEnabled}
                  trackColor={{ false: colors.secondary, true: colors.primary }}
                  thumbColor={colors.text}
                />
              </View>
            </View>
          )}

          {/* Navigation Widget */}
          <NavigationWidget />

          {/* Tip */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { fontSize: 13 * scale }]}>
              {duckingEnabled && Platform.OS === 'ios'
                ? `Other audio lowers when\nyour partner speaks`
                : `Your partner's voice mixes over\nany playing media`}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Main App with SafeAreaProvider
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
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
  connectedScroll: {
    flexGrow: 1,
    paddingBottom: 16,
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
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  voiceIndicator: {
    backgroundColor: colors.surface,
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
  voiceIndicatorActive: {
    borderColor: colors.success,
    backgroundColor: colors.secondary,
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
  controlLabel: {
    color: colors.text,
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Media Controls
  mediaControls: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  mediaTitle: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  mediaButton: {
    padding: 8,
  },
  mediaButtonMain: {
    backgroundColor: colors.secondary,
    borderRadius: 30,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  mediaButtonText: {
    fontSize: 24,
  },
  // Sensitivity Control
  sensitivityContainer: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sensitivityTitle: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  sensitivityLevels: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 8,
  },
  sensitivityDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sensitivityDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.text,
  },
  sensitivityLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  sensitivityLabelActive: {
    color: colors.text,
  },
  sensitivityHint: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  // Ducking Toggle
  duckingContainer: {
    backgroundColor: colors.surface,
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  duckingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  duckingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  duckingTitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  duckingWarning: {
    color: colors.warning,
    fontSize: 10,
    marginTop: 2,
  },
});
