import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { colors } from '@/theme';

const RING_SIZE = 110;

export const PulseRings = ({ active }: { active: boolean }) => {
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
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
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
