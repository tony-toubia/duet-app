import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '@/theme';

interface VoiceSensitivityProps {
  value: number;
  onChange: (val: number) => void;
}

const levels = [
  { value: 20, label: 'Low' },
  { value: 35, label: '' },
  { value: 50, label: 'Med' },
  { value: 65, label: '' },
  { value: 80, label: 'High' },
];

export const VoiceSensitivity = ({ value, onChange }: VoiceSensitivityProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Voice Sensitivity</Text>
      <View style={styles.track}>
        {levels.map((level, i) => {
          const isActive = value >= level.value - 7;
          return (
            <TouchableOpacity
              key={level.value}
              style={[
                styles.segment,
                isActive && styles.segmentActive,
                i === 0 && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
                i === levels.length - 1 && { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
              ]}
              onPress={() => onChange(level.value)}
            />
          );
        })}
      </View>
      <View style={styles.labels}>
        <Text style={styles.labelText}>Low</Text>
        <Text style={styles.labelText}>Med</Text>
        <Text style={styles.labelText}>High</Text>
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
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
  },
  track: {
    flexDirection: 'row',
    height: 8,
    gap: 3,
  },
  segment: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  labelText: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
