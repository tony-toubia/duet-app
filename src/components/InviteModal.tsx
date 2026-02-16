import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { colors } from '@/theme';

interface Friend {
  uid: string;
  displayName: string;
}

interface InviteModalProps {
  visible: boolean;
  friends: Friend[];
  onInvite: (uid: string, name: string) => void;
  onClose: () => void;
}

export const InviteModal = ({ visible, friends, onInvite, onClose }: InviteModalProps) => {
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
          <Text style={styles.title}>Invite Friend</Text>
          <Text style={styles.subtitle}>Choose a friend to invite to this room</Text>

          <ScrollView style={styles.list} bounces={false}>
            {friends.map((friend) => (
              <TouchableOpacity
                key={friend.uid}
                style={styles.friendRow}
                onPress={() => onInvite(friend.uid, friend.displayName)}
              >
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendInitial}>
                    {friend.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.friendName}>{friend.displayName}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
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
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b6b80',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  list: {
    width: '100%',
    maxHeight: 240,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendInitial: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  friendName: {
    color: '#1a1a2e',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  cancelBtnText: {
    color: '#9a9aaa',
    fontSize: 15,
    fontWeight: '600',
  },
});
