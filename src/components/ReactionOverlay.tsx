import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, Dimensions } from 'react-native';
import { useDuetStore } from '@/hooks/useDuetStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ANIMATION_DURATION = 2000;

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  translateY: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  wobble: Animated.Value;
}

export const ReactionOverlay = () => {
  const incomingReaction = useDuetStore((s) => s.incomingReaction);
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);
  const emojiIdRef = useRef(0);

  useEffect(() => {
    if (!incomingReaction) return;

    const id = ++emojiIdRef.current;
    const translateY = new Animated.Value(0);
    const opacity = new Animated.Value(1);
    const scale = new Animated.Value(0.3);
    const wobble = new Animated.Value(0);

    // Random horizontal position in the middle 60% of screen
    const x = SCREEN_WIDTH * 0.2 + Math.random() * SCREEN_WIDTH * 0.6;

    const entry: FloatingEmoji = {
      id,
      emoji: incomingReaction.emoji,
      x,
      translateY,
      opacity,
      scale,
      wobble,
    };

    setEmojis((prev) => [...prev, entry]);

    // Animate: scale in, float up, wobble, fade out
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.6,
          duration: ANIMATION_DURATION * 0.6,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(translateY, {
        toValue: -SCREEN_HEIGHT * 0.5,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        delay: ANIMATION_DURATION * 0.3,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(wobble, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(wobble, {
            toValue: -1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start(() => {
      setEmojis((prev) => prev.filter((e) => e.id !== id));
    });
  }, [incomingReaction]);

  if (emojis.length === 0) return null;

  return (
    <>
      {emojis.map((e) => {
        const translateX = e.wobble.interpolate({
          inputRange: [-1, 1],
          outputRange: [-15, 15],
        });

        return (
          <Animated.View
            key={e.id}
            pointerEvents="none"
            style={[
              styles.emojiContainer,
              {
                left: e.x - 24,
                bottom: SCREEN_HEIGHT * 0.15,
                opacity: e.opacity,
                transform: [
                  { translateY: e.translateY },
                  { translateX },
                  { scale: e.scale },
                ],
              },
            ]}
          >
            <Text style={styles.emoji}>{e.emoji}</Text>
          </Animated.View>
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  emojiContainer: {
    position: 'absolute',
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  emoji: {
    fontSize: 40,
  },
});
