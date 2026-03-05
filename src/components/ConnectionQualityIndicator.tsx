import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebRTCService, ConnectionQuality } from '@/services/WebRTCService';

interface Props {
  webrtc: WebRTCService | null;
}

const BAR_COLORS: Record<ConnectionQuality['quality'], string> = {
  excellent: '#4ade80',
  good: '#4ade80',
  fair: '#fbbf24',
  poor: '#ef4444',
};

const BAR_COUNTS: Record<ConnectionQuality['quality'], number> = {
  excellent: 4,
  good: 3,
  fair: 2,
  poor: 1,
};

const INACTIVE_COLOR = 'rgba(255, 255, 255, 0.15)';

export const ConnectionQualityIndicator = ({ webrtc }: Props) => {
  const [stats, setStats] = useState<ConnectionQuality | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!webrtc) {
      setStats(null);
      return;
    }

    const poll = async () => {
      if (webrtc.connectionState === 'connected') {
        const result = await webrtc.getConnectionStats();
        setStats(result);
      } else {
        setStats(null);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [webrtc]);

  if (!stats) return null;

  const activeBars = BAR_COUNTS[stats.quality];
  const color = BAR_COLORS[stats.quality];

  return (
    <View style={styles.container}>
      <View style={styles.barsRow}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: 4 + i * 4,
                backgroundColor: i <= activeBars ? color : INACTIVE_COLOR,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.rttText, { color }]}>{stats.rtt}ms</Text>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 50,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 20,
  },
  bar: {
    width: 6,
    borderRadius: 2,
  },
  rttText: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
});
