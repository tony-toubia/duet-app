import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DuetAudio } from '@/native/DuetAudio';
import { colors } from '@/theme';

interface MediaPlayerProps {
  minimized: boolean;
  onToggleMinimized: () => void;
}

export const MediaPlayer = ({ minimized, onToggleMinimized }: MediaPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);

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
    setIsPlaying(prev => !prev);
  };

  if (minimized) {
    return (
      <TouchableOpacity style={styles.minimized} onPress={onToggleMinimized}>
        <Text style={styles.minimizedText}>
          {isPlaying ? '\u25b6  Now Playing' : '\u23f8  Paused'}
        </Text>
        <Text style={styles.expandIcon}>{'\u25b2'}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.minimizeBar} onPress={onToggleMinimized}>
        <Text style={styles.collapseIcon}>{'\u25bc'}</Text>
      </TouchableOpacity>
      <Text style={styles.trackTitle}>Media Controls</Text>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.smallBtn} onPress={() => DuetAudio.mediaPrevious()}>
          <Text style={styles.smallBtnText}>{'\u23ee'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
          <Text style={styles.playBtnText}>{isPlaying ? '\u23f8' : '\u25b6'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallBtn} onPress={() => DuetAudio.mediaNext()}>
          <Text style={styles.smallBtnText}>{'\u23ed'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  minimizeBar: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  collapseIcon: {
    color: colors.textMuted,
    fontSize: 10,
  },
  trackTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  smallBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: {
    fontSize: 18,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    fontSize: 22,
  },
  minimized: {
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
  minimizedText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  expandIcon: {
    color: colors.textMuted,
    fontSize: 10,
  },
});
