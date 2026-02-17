import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DuetAudio } from '@/native/DuetAudio';
import { colors } from '@/theme';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { StepForwardIcon } from './icons/StepForwardIcon';
import { StepBackwardIcon } from './icons/StepBackwardIcon';

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
        <View style={styles.minimizedLeft}>
          {isPlaying ? <PlayIcon size={12} color={colors.text} /> : <PauseIcon size={12} color={colors.text} />}
          <Text style={styles.minimizedText}>
            {isPlaying ? 'Now Playing' : 'Paused'}
          </Text>
        </View>
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
          <StepBackwardIcon size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
          {isPlaying ? <PauseIcon size={24} color="#ffffff" /> : <PlayIcon size={24} color="#ffffff" />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallBtn} onPress={() => DuetAudio.mediaNext()}>
          <StepForwardIcon size={20} color={colors.text} />
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
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  minimizedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
