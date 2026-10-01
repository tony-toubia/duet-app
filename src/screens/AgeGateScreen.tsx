import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme';
import { ageGateService } from '@/services/AgeGateService';
import type { AgeGateResult } from '@/lib/ageGate';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Neutral age screen shown once, before sign-in. It asks for birth month and
 * year without hinting at the cut-off, and the answer can't be changed
 * afterwards on this device (see AgeGateService).
 */
export const AgeGateScreen = ({ onDone }: { onDone: (result: AgeGateResult) => void }) => {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);

  const yearNum = Number(year);
  const valid = month !== null && /^\d{4}$/.test(year) && yearNum >= 1900 && yearNum <= new Date().getFullYear();

  const handleContinue = async () => {
    if (!valid || month === null) return;
    try {
      onDone(await ageGateService.submit(month, yearNum));
    } catch {
      setError('Please check the date and try again.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Welcome to Duet</Text>
        <Text style={styles.subtitle}>When were you born?</Text>

        <Text style={styles.label}>Month</Text>
        <View style={styles.monthGrid}>
          {MONTHS.map((m, i) => (
            <TouchableOpacity
              key={m}
              style={[styles.month, month === i + 1 && styles.monthSelected]}
              onPress={() => setMonth(i + 1)}
              accessibilityRole="radio"
              accessibilityState={{ selected: month === i + 1 }}
            >
              <Text style={[styles.monthText, month === i + 1 && styles.monthTextSelected]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Year</Text>
        <TextInput
          style={styles.yearInput}
          value={year}
          onChangeText={(t) => { setYear(t.replace(/\D/g, '').slice(0, 4)); setError(null); }}
          placeholder="YYYY"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={4}
          accessibilityLabel="Birth year"
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.continueBtn, !valid && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!valid}
        >
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>
          We use this only to keep Duet age-appropriate. We don't store your birth date.
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://getduet.app/privacy')}>
          <Text style={styles.link}>Privacy Policy</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

/** Shown when the age gate result is under the minimum age. No way forward. */
export const AgeBlockedScreen = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <Text style={styles.title}>Sorry, you can't use Duet</Text>
      <Text style={[styles.subtitle, { textAlign: 'center' }]}>
        Duet isn't available to you based on the information you gave.
      </Text>
      <TouchableOpacity onPress={() => Linking.openURL('mailto:hello@getduet.app')}>
        <Text style={styles.link}>Questions? hello@getduet.app</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  content: {
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 8,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  month: {
    width: '22%',
    flexGrow: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    alignItems: 'center',
  },
  monthSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(232, 115, 74, 0.25)',
  },
  monthText: {
    color: colors.text,
    fontSize: 15,
  },
  monthTextSelected: {
    fontWeight: '700',
  },
  yearInput: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    color: colors.text,
    letterSpacing: 2,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  continueBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  footnote: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
