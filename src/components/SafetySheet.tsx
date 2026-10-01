import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '@/theme';
import { blockService } from '@/services/BlockService';
import { submitReport, REPORT_REASONS, ReportReason, ReportContext } from '@/services/ReportService';

export interface SafetyPerson {
  uid: string;
  displayName: string;
}

interface SafetySheetProps {
  visible: boolean;
  /** One person, or several to choose from (party rooms) */
  people: SafetyPerson[];
  context: ReportContext;
  roomCode?: string | null;
  onClose: () => void;
  /** Called after someone is blocked (e.g. to leave the room) */
  onBlocked?: (uid: string) => void;
}

type Step = 'choose' | 'menu' | 'confirmBlock' | 'report' | 'done';

/**
 * Report and block, reachable from rooms and the friends list. Blocking is
 * silent (the other person isn't told); reports go to Duet's moderators.
 */
export const SafetySheet = ({ visible, people, context, roomCode, onClose, onBlocked }: SafetySheetProps) => {
  const [step, setStep] = useState<Step>('menu');
  const [person, setPerson] = useState<SafetyPerson | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState('');

  useEffect(() => {
    if (!visible) return;
    const single = people.length === 1 ? people[0] : null;
    setPerson(single);
    setStep(single ? 'menu' : 'choose');
    setReason(null);
    setDetails('');
    setAlsoBlock(true);
    setBusy(false);
    setError(null);
  }, [visible]);

  const name = person?.displayName || 'this person';

  const doBlock = async () => {
    if (!person) return;
    setBusy(true);
    setError(null);
    try {
      await blockService.block(person.uid, person.displayName);
      setDoneMessage(`You blocked ${name}. They can't send you friend requests or invitations, or join rooms you create. They won't be notified.`);
      setStep('done');
      onBlocked?.(person.uid);
    } catch {
      setError('Could not block. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const doReport = async () => {
    if (!person || !reason) return;
    setBusy(true);
    setError(null);
    try {
      await submitReport({ reportedUid: person.uid, reason, context, details, roomCode });
      if (alsoBlock) {
        await blockService.block(person.uid, person.displayName);
        onBlocked?.(person.uid);
      }
      setDoneMessage(
        'Thanks for telling us. Our team reviews every report.' +
          (alsoBlock ? ` You've also blocked ${name}.` : '') +
          (reason === 'self_harm' ? ' If someone is in immediate danger, contact local emergency services.' : '')
      );
      setStep('done');
    } catch {
      setError('Could not send the report. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const renderBody = () => {
    switch (step) {
      case 'choose':
        return (
          <>
            <Text style={styles.title}>Who do you want to report or block?</Text>
            {people.map((p) => (
              <TouchableOpacity key={p.uid} style={styles.option} onPress={() => { setPerson(p); setStep('menu'); }}>
                <Text style={styles.optionText}>{p.displayName}</Text>
              </TouchableOpacity>
            ))}
          </>
        );
      case 'menu':
        return (
          <>
            <Text style={styles.title}>{name}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('report')}>
              <Text style={styles.primaryBtnText}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, styles.dangerBtn]} onPress={() => setStep('confirmBlock')}>
              <Text style={styles.primaryBtnText}>Block</Text>
            </TouchableOpacity>
          </>
        );
      case 'confirmBlock':
        return (
          <>
            <Text style={styles.title}>Block {name}?</Text>
            <Text style={styles.message}>
              They won't be able to send you friend requests or invitations, or join rooms you create, and you'll stop
              connecting with them in group rooms. They won't be notified. You can unblock them from your Profile.
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, styles.dangerBtn]} onPress={doBlock} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Block</Text>}
            </TouchableOpacity>
          </>
        );
      case 'report':
        return (
          <>
            <Text style={styles.title}>Report {name}</Text>
            <Text style={styles.message}>What's going on? Duet doesn't record audio, so tell us what happened.</Text>
            {REPORT_REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.option, reason === r.value && styles.optionSelected]}
                onPress={() => setReason(r.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: reason === r.value }}
              >
                <Text style={[styles.optionText, reason === r.value && styles.optionTextSelected]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.input}
              placeholder="Add details (optional)"
              placeholderTextColor="#9a9aaa"
              value={details}
              onChangeText={setDetails}
              maxLength={1000}
              multiline
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Also block {name}</Text>
              <Switch value={alsoBlock} onValueChange={setAlsoBlock} trackColor={{ false: '#d0d0d8', true: colors.primary }} />
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, !reason && styles.disabledBtn]}
              onPress={doReport}
              disabled={!reason || busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send Report</Text>}
            </TouchableOpacity>
          </>
        );
      case 'done':
        return (
          <>
            <Text style={styles.title}>Done</Text>
            <Text style={styles.message}>{doneMessage}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
              <Text style={styles.primaryBtnText}>OK</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {renderBody()}
            {error && <Text style={styles.error}>{error}</Text>}
            {step !== 'done' && (
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
  },
  content: {
    padding: 24,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'center',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#6b6b80',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 6,
  },
  option: {
    borderWidth: 1,
    borderColor: '#e0e0e8',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(232, 115, 74, 0.1)',
  },
  optionText: {
    fontSize: 15,
    color: '#1a1a2e',
  },
  optionTextSelected: {
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e8',
    borderRadius: 12,
    padding: 12,
    minHeight: 72,
    fontSize: 15,
    color: '#1a1a2e',
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 15,
    color: '#1a1a2e',
    flex: 1,
    marginRight: 12,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  dangerBtn: {
    backgroundColor: colors.danger,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#9a9aaa',
    fontSize: 15,
    fontWeight: '600',
  },
});
