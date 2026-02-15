import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Image } from 'react-native';
import { PulseRings } from './PulseRings';
import { colors } from '@/theme';

const CIRCLE_SIZE = 100;
const CONTAINER_SIZE = 120; // Larger than circle to contain pulse rings
const LABEL_AREA_HEIGHT = 40; // Fixed height so labels don't shift the circle

interface AvatarCircleProps {
  label: string;
  initials: string;
  isSpeaking: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
  avatarUrl?: string | null;
}

export const AvatarCircle = ({
  label,
  initials,
  isSpeaking,
  isMuted,
  isDeafened,
  avatarUrl,
}: AvatarCircleProps) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isSpeaking ? 1.05 : 1,
      useNativeDriver: true,
      friction: 6,
    }).start();
  }, [isSpeaking]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.circleContainer}>
        <PulseRings active={isSpeaking} />
        <Animated.View
          style={[
            styles.circle,
            isSpeaking && styles.circleActive,
            { transform: [{ scale }] },
          ]}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.initials}>{initials}</Text>
          )}
        </Animated.View>
      </View>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        {isMuted && <Text style={styles.status}>Muted</Text>}
        {isDeafened && <Text style={styles.status}>Deafened</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: 140,
  },
  circleContainer: {
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(232, 115, 74, 0.2)',
  },
  avatarImage: {
    width: CIRCLE_SIZE - 6, // Account for border
    height: CIRCLE_SIZE - 6,
    borderRadius: (CIRCLE_SIZE - 6) / 2,
  },
  initials: {
    color: colors.text,
    fontSize: 32,
    fontWeight: 'bold',
  },
  labelContainer: {
    height: LABEL_AREA_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 4,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  status: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
