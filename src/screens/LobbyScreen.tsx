import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDuetStore } from '@/hooks/useDuetStore';
import { colors } from '@/theme';
import type { LobbyScreenProps } from '@/navigation/types';

export const LobbyScreen = ({ navigation, route }: LobbyScreenProps) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const insets = useSafeAreaInsets();

  const {
    roomCode,
    initialize,
    createRoom,
    joinRoom,
  } = useDuetStore();

  // Navigate to room when connected
  useEffect(() => {
    if (roomCode) {
      navigation.replace('Room');
    }
  }, [roomCode, navigation]);

  // Handle auto-join from push notification
  useEffect(() => {
    const autoJoinCode = route.params?.autoJoinCode;
    if (autoJoinCode && isInitialized) {
      handleJoinWithCode(autoJoinCode);
    }
  }, [route.params?.autoJoinCode, isInitialized]);

  useEffect(() => {
    const init = async () => {
      try {
        await initialize();
        setIsInitialized(true);
      } catch (error: any) {
        console.error('[Lobby] Init failed:', error);
        Alert.alert('Error', error?.message || 'Failed to initialize audio. Please restart the app.');
      }
    };
    init();
  }, []);

  const shareCode = async (code: string) => {
    try {
      await Share.share({
        message: `Join me on Duet! Enter code: ${code}`,
      });
    } catch (error) {
      console.log('Share cancelled');
    }
  };

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
      console.error('[Lobby] Create room failed:', error);
      Alert.alert('Error', error?.message || 'Failed to create room. Please restart the app and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinWithCode = async (code: string) => {
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-character room code');
      return;
    }
    setIsLoading(true);
    try {
      await joinRoom(code.toUpperCase());
      setShowJoinInput(false);
    } catch (error: any) {
      console.error('[Lobby] Join room failed:', error);
      Alert.alert('Error', error?.message || 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = () => handleJoinWithCode(joinCode);

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

  return (
    <View style={styles.lobbyContainer}>
      <StatusBar style="light" />
      <View style={styles.lobbyTopBg} />
      <View style={styles.lobbyBottomBg} />
      <View style={styles.lobbyImageContainer}>
        <Image
          source={require('../../assets/duet-home-bg.png')}
          style={styles.lobbyImage}
          resizeMode="contain"
        />
      </View>
      <View style={[styles.lobbyOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.lobbyHeader}>
          <Image
            source={require('../../assets/duet-logo.png')}
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
};

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
