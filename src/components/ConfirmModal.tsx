import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { colors } from '@/theme';

interface ConfirmModalButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'destructive' | 'cancel';
}

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: ConfirmModalButton[];
  onClose: () => void;
}

export const ConfirmModal = ({ visible, title, message, buttons, onClose }: ConfirmModalProps) => {
  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const actionBtns = buttons.filter((b) => b.style !== 'cancel');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.buttonGroup}>
            {actionBtns.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.actionBtn,
                  btn.style === 'destructive' && styles.destructiveBtn,
                ]}
                onPress={btn.onPress}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    btn.style === 'destructive' && styles.destructiveBtnText,
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {cancelBtn && (
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelBtn.onPress}>
              <Text style={styles.cancelBtnText}>{cancelBtn.text}</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6b6b80',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  destructiveBtn: {
    backgroundColor: '#ef4444',
  },
  destructiveBtnText: {
    color: '#ffffff',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  cancelBtnText: {
    color: '#9a9aaa',
    fontSize: 15,
    fontWeight: '600',
  },
});
