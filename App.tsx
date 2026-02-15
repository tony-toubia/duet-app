import React, { useEffect, useState, useRef } from 'react';
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
  Easing,
  useWindowDimensions,
  Switch,
  Platform,
  Image,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDuetStore } from './src/hooks/useDuetStore';
import { DuetAudio } from './src/native/DuetAudio';
import { NavigationWidget } from './src/components/NavigationWidget';

// Brand color palette
const colors = {
  background: '#1a1a2e',
  surface: '#16213e',
  primary: '#e8734a',      // warm orange (brand)
  primaryLight: '#f0956e',
  secondary: '#0f3460',
  text: '#ffffff',
  textMuted: '#b0b8c8',
  textDark: '#2d3650',
  success: '#4ade80',
  warning: '#fbbf24',
  danger: '#ef4444',
  glass: 'rgba(255, 255, 255, 0.12)',
  glassBorder: 'rgba(255, 255, 255, 0.18)',
};

// Responsive breakpoint
const TABLET_MIN_WIDTH = 600;

function useLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const isLandscape = width > height;
  return { width, height, isTablet, isLandscape };
}

// =====================
// Animated pulse rings for active speaker
// =====================
const PulseRings = ({ active }: { active: boolean }) => {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      const createPulse = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1800,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );

      const a1 = createPulse(ring1, 0);
      const a2 = createPulse(ring2, 600);
      const a3 = createPulse(ring3, 1200);
      a1.start();
      a2.start();
      a3.start();

      return () => {
        a1.stop();
        a2.stop();
        a3.stop();
        ring1.setValue(0);
        ring2.setValue(0);
        ring3.setValue(0);
      };
    } else {
      ring1.setValue(0);
      ring2.setValue(0);
      ring3.setValue(0);
    }
  }, [active]);

  if (!active) return null;

  const makeRingStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: colors.primary,
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
  });

  return (
    <>
      <Animated.View style={makeRingStyle(ring1)} />
      <Animated.View style={makeRingStyle(ring2)} />
      <Animated.View style={makeRingStyle(ring3)} />
    </>
  );
};

// =====================
// Avatar circle component
// =====================
const AvatarCircle = ({
  label,
  initials,
  isSpeaking,
  isMuted,
  isDeafened,
}: {
  label: string;
  initials: string;
  isSpeaking: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isSpeaking ? 1.05 : 1,
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [isSpeaking]);

  return (
    <View style={roomStyles.avatarWrapper}>
      <PulseRings active={isSpeaking} />
      <Animated.View
        style={[
          roomStyles.avatarCircle,
          isSpeaking && roomStyles.avatarCircleActive,
          { transform: [{ scale }] },
        ]}
      >
        <Text style={roomStyles.avatarInitials}>{initials}</Text>
      </Animated.View>
      <Text style={roomStyles.avatarLabel}>{label}</Text>
      {isMuted && <Text style={roomStyles.avatarStatus}>Muted</Text>}
      {isDeafened && <Text style={roomStyles.avatarStatus}>Deafened</Text>}
    </View>
  );
};

// =====================
// Media Player Component (minimizable, with playback state detection)
// =====================
const MediaPlayer = ({ minimized, onToggleMinimized }: { minimized: boolean; onToggleMinimized: () => void }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Poll for media playback state
  useEffect(() => {
    let mounted = true;

    const pollState = async () => {
      try {
        const state = await DuetAudio.getMediaPlaybackState();
        if (mounted && !state.unknown) {
          setIsPlaying(state.isPlaying);
        }
      } catch {}
    };

    pollState();
    const interval = setInterval(pollState, 2000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const handlePlayPause = () => {
    DuetAudio.mediaPlayPause();
    // Optimistically toggle, will be corrected by next poll
    setIsPlaying(prev => !prev);
  };

  if (minimized) {
    return (
      <TouchableOpacity style={roomStyles.mediaMinimized} onPress={onToggleMinimized}>
        <Text style={roomStyles.mediaMinimizedText}>
          {isPlaying ? '▶  Now Playing' : '⏸  Paused'}
        </Text>
        <Text style={roomStyles.mediaExpandIcon}>▲</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={roomStyles.mediaCard}>
      <TouchableOpacity style={roomStyles.mediaMinimizeBar} onPress={onToggleMinimized}>
        <Text style={roomStyles.mediaCollapseIcon}>▼</Text>
      </TouchableOpacity>
      <Text style={roomStyles.mediaTrackTitle}>Media Controls</Text>
      <View style={roomStyles.mediaPlayerControls}>
        <TouchableOpacity style={roomStyles.mediaSmallBtn} onPress={() => DuetAudio.mediaPrevious()}>
          <Text style={roomStyles.mediaSmallBtnText}>⏮</Text>
        </TouchableOpacity>
        <TouchableOpacity style={roomStyles.mediaPlayBtn} onPress={handlePlayPause}>
          <Text style={roomStyles.mediaPlayBtnText}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={roomStyles.mediaSmallBtn} onPress={() => DuetAudio.mediaNext()}>
          <Text style={roomStyles.mediaSmallBtnText}>⏭</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// =====================
// Voice Sensitivity (horizontal bar style)
// =====================
const VoiceSensitivity = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) => {
  const levels = [
    { value: 20, label: 'Low' },
    { value: 35, label: '' },
    { value: 50, label: 'Med' },
    { value: 65, label: '' },
    { value: 80, label: 'High' },
  ];

  return (
    <View style={roomStyles.sensitivityCard}>
      <Text style={roomStyles.sensitivityTitle}>Voice Sensitivity</Text>
      <View style={roomStyles.sensitivityTrack}>
        {levels.map((level, i) => {
          const isActive = value >= level.value - 7;
          return (
            <TouchableOpacity
              key={level.value}
              style={[
                roomStyles.sensitivitySegment,
                isActive && roomStyles.sensitivitySegmentActive,
                i === 0 && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
                i === levels.length - 1 && { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
              ]}
              onPress={() => onChange(level.value)}
            />
          );
        })}
      </View>
      <View style={roomStyles.sensitivityLabels}>
        <Text style={roomStyles.sensitivityLabelText}>Low</Text>
        <Text style={roomStyles.sensitivityLabelText}>Med</Text>
        <Text style={roomStyles.sensitivityLabelText}>High</Text>
      </View>
    </View>
  );
};

// =====================
// Main App Content
// =====================
function AppContent() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [mediaMinimized, setMediaMinimized] = useState(false);
  const insets = useSafeAreaInsets();
  const { isTablet, isLandscape } = useLayout();
  const useTwoColumn = isTablet && isLandscape;

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
      } catch (error: any) {
        console.error('[App] Init failed:', error);
        Alert.alert('Error', error?.message || 'Failed to initialize audio. Please restart the app.');
      }
    };
    init();

    return () => {
      leaveRoom();
    };
  }, []);

  const handleCreateRoom = async () => {
    setIsLoading(true);
    try {
      const code = await createRoom();
      Alert.alert(
        'Room Created',
        `Share this code: ${code}`,
        [
          { text: 'Copy & Share', onPress: () => shareCode(code) },
          { text: 'OK' },
        ]
      );
    } catch (error: any) {
      console.error('[App] Create room failed:', error);
      Alert.alert('Error', error?.message || 'Failed to create room. Please restart the app and try again.');
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
      setShowJoinInput(false);
    } catch (error: any) {
      console.error('[App] Join room failed:', error);
      Alert.alert('Error', error?.message || 'Failed to join room');
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

  // Loading screen
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

  // =====================
  // LOBBY VIEW
  // =====================
  if (!roomCode) {
    return (
      <View style={styles.lobbyContainer}>
        <StatusBar style="light" />
        <View style={styles.lobbyTopBg} />
        <View style={styles.lobbyBottomBg} />
        <View style={styles.lobbyImageContainer}>
          <Image
            source={require('./assets/duet-home-bg.png')}
            style={styles.lobbyImage}
            resizeMode="contain"
          />
        </View>
        <View style={[styles.lobbyOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.lobbyHeader}>
            <Image
              source={require('./assets/duet-logo.png')}
              style={styles.lobbyLogo}
              resizeMode="contain"
            />
            <Text style={styles.lobbyTitle}>Duet</Text>
            <Text style={styles.lobbyTagline}>
              Always-on voice connection.{'\n'}Together, even when apart.
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={styles.lobbyButtons}>
            <TouchableOpacity
              style={styles.startRoomButton}
              onPress={handleCreateRoom}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.startRoomText}>Start a Room</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.joinRoomButton}
              onPress={() => setShowJoinInput(true)}
              disabled={isLoading}
            >
              <Text style={styles.joinRoomText}>Join Room</Text>
            </TouchableOpacity>
            {showJoinInput && (
              <View style={styles.joinInputRow}>
                <TextInput
                  style={styles.joinInput}
                  placeholder="ENTER CODE"
                  placeholderTextColor="#999"
                  value={joinCode}
                  onChangeText={(text) => setJoinCode(text.toUpperCase())}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.joinGoButton, joinCode.length !== 6 && styles.buttonDisabled]}
                  onPress={handleJoinRoom}
                  disabled={isLoading || joinCode.length !== 6}
                >
                  <Text style={styles.joinGoText}>Go</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  // =====================
  // ROOM VIEW (connected)
  // =====================
  const roomContent = (
    <>
      {/* Top Bar: Room ID left, connection status center, Leave right */}
      <View style={[roomStyles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => shareCode(roomCode)} style={roomStyles.roomIdContainer}>
          <View style={[roomStyles.statusDot, { backgroundColor: getConnectionColor() }]} />
          <Text style={roomStyles.roomIdText}>{roomCode}</Text>
        </TouchableOpacity>
        <Text style={[roomStyles.connectionText, { color: getConnectionColor() }]}>
          {getConnectionText()}
        </Text>
        <TouchableOpacity onPress={handleLeave} style={roomStyles.leaveBtn}>
          <Text style={roomStyles.leaveBtnText}>Leave</Text>
        </TouchableOpacity>
      </View>

      {/* Avatars */}
      <View style={roomStyles.avatarsRow}>
        <AvatarCircle
          label="You"
          initials="Y"
          isSpeaking={isSpeaking}
          isMuted={isMuted}
        />
        <AvatarCircle
          label="Partner"
          initials="P"
          isSpeaking={isPartnerSpeaking}
          isDeafened={isDeafened}
        />
      </View>

      {/* Mute / Deafen buttons */}
      <View style={roomStyles.actionRow}>
        <TouchableOpacity
          style={[roomStyles.actionBtn, isMuted && roomStyles.actionBtnActive]}
          onPress={() => setMuted(!isMuted)}
        >
          <Text style={roomStyles.actionIcon}>{isMuted ? '🔇' : '🎤'}</Text>
          <Text style={roomStyles.actionLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[roomStyles.actionBtn, isDeafened && roomStyles.actionBtnActive]}
          onPress={() => setDeafened(!isDeafened)}
        >
          <Text style={roomStyles.actionIcon}>{isDeafened ? '🔕' : '🔊'}</Text>
          <Text style={roomStyles.actionLabel}>{isDeafened ? 'Undeafen' : 'Deafen'}</Text>
        </TouchableOpacity>
      </View>

      {/* Voice Sensitivity */}
      <VoiceSensitivity value={vadSensitivity} onChange={setVadSensitivity} />

      {/* iOS Ducking Toggle */}
      {Platform.OS === 'ios' && (
        <View style={roomStyles.duckingCard}>
          <View style={roomStyles.duckingRow}>
            <View style={{ flex: 1 }}>
              <Text style={roomStyles.duckingTitle}>Lower other audio</Text>
              <Text style={roomStyles.duckingWarning}>Some apps may pause instead</Text>
            </View>
            <Switch
              value={duckingEnabled}
              onValueChange={setDuckingEnabled}
              trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.primary }}
              thumbColor={colors.text}
            />
          </View>
        </View>
      )}

      {/* Media Player */}
      <MediaPlayer minimized={mediaMinimized} onToggleMinimized={() => setMediaMinimized(!mediaMinimized)} />

      {/* Quick Launch */}
      <NavigationWidget />
    </>
  );

  // Tablet two-column layout
  if (useTwoColumn) {
    return (
      <ImageBackground
        source={require('./assets/duet-room-bg.png')}
        style={roomStyles.roomBg}
        resizeMode="cover"
      >
        <View style={roomStyles.roomOverlay}>
          <StatusBar style="light" />
          <View style={[roomStyles.topBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => shareCode(roomCode)} style={roomStyles.roomIdContainer}>
              <View style={[roomStyles.statusDot, { backgroundColor: getConnectionColor() }]} />
              <Text style={roomStyles.roomIdText}>{roomCode}</Text>
            </TouchableOpacity>
            <Text style={[roomStyles.connectionText, { color: getConnectionColor() }]}>
              {getConnectionText()}
            </Text>
            <TouchableOpacity onPress={handleLeave} style={roomStyles.leaveBtn}>
              <Text style={roomStyles.leaveBtnText}>Leave</Text>
            </TouchableOpacity>
          </View>

          <View style={roomStyles.twoColContainer}>
            {/* Left: Avatars + controls */}
            <View style={roomStyles.twoColLeft}>
              <View style={roomStyles.avatarsRow}>
                <AvatarCircle label="You" initials="Y" isSpeaking={isSpeaking} isMuted={isMuted} />
                <AvatarCircle label="Partner" initials="P" isSpeaking={isPartnerSpeaking} isDeafened={isDeafened} />
              </View>
              <View style={roomStyles.actionRow}>
                <TouchableOpacity
                  style={[roomStyles.actionBtn, isMuted && roomStyles.actionBtnActive]}
                  onPress={() => setMuted(!isMuted)}
                >
                  <Text style={roomStyles.actionIcon}>{isMuted ? '🔇' : '🎤'}</Text>
                  <Text style={roomStyles.actionLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[roomStyles.actionBtn, isDeafened && roomStyles.actionBtnActive]}
                  onPress={() => setDeafened(!isDeafened)}
                >
                  <Text style={roomStyles.actionIcon}>{isDeafened ? '🔕' : '🔊'}</Text>
                  <Text style={roomStyles.actionLabel}>{isDeafened ? 'Undeafen' : 'Deafen'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {/* Right: Sensitivity, media, nav */}
            <View style={roomStyles.twoColRight}>
              <VoiceSensitivity value={vadSensitivity} onChange={setVadSensitivity} />
              {Platform.OS === 'ios' && (
                <View style={roomStyles.duckingCard}>
                  <View style={roomStyles.duckingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={roomStyles.duckingTitle}>Lower other audio</Text>
                      <Text style={roomStyles.duckingWarning}>Some apps may pause instead</Text>
                    </View>
                    <Switch
                      value={duckingEnabled}
                      onValueChange={setDuckingEnabled}
                      trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.primary }}
                      thumbColor={colors.text}
                    />
                  </View>
                </View>
              )}
              <MediaPlayer minimized={mediaMinimized} onToggleMinimized={() => setMediaMinimized(!mediaMinimized)} />
              <NavigationWidget />
            </View>
          </View>
          <View style={{ height: insets.bottom }} />
        </View>
      </ImageBackground>
    );
  }

  // Single-column phone layout
  return (
    <ImageBackground
      source={require('./assets/duet-room-bg.png')}
      style={roomStyles.roomBg}
      resizeMode="cover"
    >
      <View style={roomStyles.roomOverlay}>
        <StatusBar style="light" />
        <ScrollView
          contentContainerStyle={[roomStyles.roomScroll, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          {roomContent}
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

// =====================
// Main App
// =====================
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

// =====================
// Room View Styles
// =====================
const roomStyles = StyleSheet.create({
  roomBg: {
    flex: 1,
  },
  roomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 40, 0.55)',
  },
  roomScroll: {
    flexGrow: 1,
    gap: 16,
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  roomIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  roomIdText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
  },
  connectionText: {
    fontSize: 12,
  },
  leaveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  leaveBtnText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
  },
  // Avatars
  avatarsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
    paddingVertical: 20,
  },
  avatarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 140,
    height: 170,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(232, 115, 74, 0.2)',
  },
  avatarInitials: {
    color: colors.text,
    fontSize: 32,
    fontWeight: 'bold',
  },
  avatarLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  avatarStatus: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  // Mute / Deafen action buttons
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(232, 115, 74, 0.25)',
    borderColor: colors.primary,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  // Sensitivity
  sensitivityCard: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sensitivityTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
  },
  sensitivityTrack: {
    flexDirection: 'row',
    height: 8,
    gap: 3,
  },
  sensitivitySegment: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  sensitivitySegmentActive: {
    backgroundColor: colors.primary,
  },
  sensitivityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sensitivityLabelText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  // Ducking toggle
  duckingCard: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  duckingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duckingTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  duckingWarning: {
    color: colors.warning,
    fontSize: 11,
    marginTop: 2,
  },
  // Media player
  mediaCard: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  mediaMinimizeBar: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  mediaCollapseIcon: {
    color: colors.textMuted,
    fontSize: 10,
  },
  mediaTrackTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  mediaPlayerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  mediaSmallBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaSmallBtnText: {
    fontSize: 18,
  },
  mediaPlayBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlayBtnText: {
    fontSize: 22,
  },
  // Media minimized
  mediaMinimized: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  mediaMinimizedText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  mediaExpandIcon: {
    color: colors.textMuted,
    fontSize: 10,
  },
  // Two-column layout
  twoColContainer: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  twoColLeft: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  twoColRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
});

// =====================
// Lobby + Shared Styles
// =====================
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
  loadingText: {
    color: colors.textMuted,
    marginTop: 16,
  },
  // Lobby screen
  lobbyContainer: {
    flex: 1,
    position: 'relative',
  },
  lobbyTopBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#1a293d',
  },
  lobbyBottomBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#f4dbc8',
  },
  lobbyImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lobbyImage: {
    width: '100%',
    height: '100%',
  },
  lobbyOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  lobbyHeader: {
    alignItems: 'center',
    paddingTop: 16,
  },
  lobbyLogo: {
    width: 60,
    height: 56,
    tintColor: '#e8734a',
  },
  lobbyTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  lobbyTagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  lobbyButtons: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    gap: 12,
  },
  startRoomButton: {
    backgroundColor: '#e8734a',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  startRoomText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  joinRoomButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3d3d50',
  },
  joinRoomText: {
    color: '#3d3d50',
    fontSize: 18,
    fontWeight: '600',
  },
  joinInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  joinInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#1a293d',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 4,
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 28,
  },
  joinGoButton: {
    backgroundColor: '#e8734a',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    justifyContent: 'center',
  },
  joinGoText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
