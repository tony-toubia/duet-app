import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { WorldCupService, MatchScore } from '@/services/WorldCupService';
import { colors } from '@/theme';

export const MatchBanner = () => {
  const [matches, setMatches] = useState<MatchScore[]>([]);
  const flashAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsub = WorldCupService.subscribeLiveMatches((data) => {
      setMatches(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const hasLive = matches.some(m => m.status === 'IN_PLAY');
    if (hasLive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 0.5, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      ).start();
    } else {
      flashAnim.setValue(1);
    }
  }, [matches]);

  if (matches.length === 0) return null;

  return (
    <View style={styles.bannerContainer}>
      <Text style={styles.bannerLabel}>WORLD CUP 2026</Text>
      <View style={styles.matchesRow}>
        {matches.slice(0, 2).map((m) => (
          <View key={m.id} style={styles.matchItem}>
            <View style={styles.teams}>
              <Text style={styles.teamText} numberOfLines={1}>{m.homeTeam}</Text>
              <Text style={styles.scoreText}>{m.homeScore} - {m.awayScore}</Text>
              <Text style={styles.teamText} numberOfLines={1}>{m.awayTeam}</Text>
            </View>
            {m.status === 'IN_PLAY' ? (
              <Animated.Text style={[styles.statusTextLive, { opacity: flashAnim }]}>
                {m.minute ? `${m.minute}'` : 'LIVE'}
              </Animated.Text>
            ) : (
              <Text style={styles.statusText}>{m.status}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: 'rgba(232, 115, 74, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 115, 74, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bannerLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#e8734a',
    letterSpacing: 2,
    marginBottom: 6,
  },
  matchesRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    width: '100%',
  },
  matchItem: {
    flex: 1,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    maxWidth: 160,
  },
  teams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  teamText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  scoreText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  statusTextLive: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: 'bold',
  }
});
