import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/hooks/useAuthStore';
import { storageService } from '@/services/StorageService';
import { ConfirmModal } from '@/components/ConfirmModal';
import { colors } from '@/theme';
import type { ProfileScreenProps } from '@/navigation/types';

export const ProfileScreen = ({ navigation }: ProfileScreenProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const insets = useSafeAreaInsets();
  const { user, userProfile, isGuest, signOut, refreshProfile, preferences, updatePreferences } = useAuthStore();

  const handleChangePhoto = () => {
    setShowPhotoModal(true);
  };

  const handleCamera = async () => {
    setShowPhotoModal(false);
    try {
      const uri = await storageService.takePhoto();
      if (uri) {
        setIsUploading(true);
        await storageService.uploadAvatar(uri);
        await refreshProfile();
        setIsUploading(false);
      }
    } catch (error: any) {
      setIsUploading(false);
      Alert.alert('Error', error?.message || 'Failed to upload photo.');
    }
  };

  const handlePhotoLibrary = async () => {
    setShowPhotoModal(false);
    try {
      const uri = await storageService.pickImage();
      if (uri) {
        setIsUploading(true);
        await storageService.uploadAvatar(uri);
        await refreshProfile();
        setIsUploading(false);
      }
    } catch (error: any) {
      setIsUploading(false);
      Alert.alert('Error', error?.message || 'Failed to upload photo.');
    }
  };

  const handleSignOut = () => {
    setShowSignOutModal(true);
  };

  const handleConfirmSignOut = async () => {
    setShowSignOutModal(false);
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const displayName = userProfile?.displayName || user?.displayName || 'Duet User';
  const email = userProfile?.email || user?.email || null;
  const avatarUrl = userProfile?.avatarUrl || user?.photoURL || null;
  const initials = displayName.charAt(0).toUpperCase();
  const provider = userProfile?.authProvider || (isGuest ? 'anonymous' : 'unknown');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Profile</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleChangePhoto} disabled={isGuest || isUploading}>
            <View style={styles.avatarCircle}>
              {isUploading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>
            {!isGuest && (
              <View style={styles.changePhotoOverlay}>
                <Text style={styles.changePhotoText}>Edit</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.displayName}>{displayName}</Text>
          {email && <Text style={styles.email}>{email}</Text>}
          <View style={styles.providerBadge}>
            <Text style={styles.providerText}>
              {provider === 'google' ? 'Google Account' : provider === 'email' ? 'Email Account' : 'Guest'}
            </Text>
          </View>
        </View>

        {isGuest && (
          <View style={styles.upgradeCard}>
            <Text style={styles.upgradeTitle}>Upgrade Your Account</Text>
            <Text style={styles.upgradeText}>
              Create an account to save your profile, add friends, and get room invitations.
            </Text>
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => {
                signOut();
              }}
            >
              <Text style={styles.upgradeBtnText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Display Name</Text>
              <Text style={styles.infoValue}>{displayName}</Text>
            </View>
            {email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{email}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Account Type</Text>
              <Text style={styles.infoValue}>
                {provider === 'google' ? 'Google' : provider === 'email' ? 'Email' : 'Guest'}
              </Text>
            </View>
          </View>
        </View>

        {!isGuest && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.infoLabel}>Email Notifications</Text>
                  <Text style={styles.toggleDescription}>Receive marketing emails and updates</Text>
                </View>
                <Switch
                  value={preferences.emailOptIn}
                  onValueChange={(val) => updatePreferences({ emailOptIn: val })}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.primary }}
                  thumbColor={colors.text}
                />
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.infoLabel}>Push Notifications</Text>
                  <Text style={styles.toggleDescription}>Receive push alerts on this device</Text>
                </View>
                <Switch
                  value={preferences.pushOptIn}
                  onValueChange={(val) => updatePreferences({ pushOptIn: val })}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.primary }}
                  thumbColor={colors.text}
                />
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
      <ConfirmModal
        visible={showSignOutModal}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        buttons={[
          { text: 'Sign Out', style: 'destructive', onPress: handleConfirmSignOut },
          { text: 'Cancel', style: 'cancel', onPress: () => setShowSignOutModal(false) },
        ]}
        onClose={() => setShowSignOutModal(false)}
      />
      <ConfirmModal
        visible={showPhotoModal}
        title="Change Photo"
        message="Choose a source for your profile photo"
        buttons={[
          { text: 'Camera', style: 'default', onPress: handleCamera },
          { text: 'Photo Library', style: 'default', onPress: handlePhotoLibrary },
          { text: 'Cancel', style: 'cancel', onPress: () => setShowPhotoModal(false) },
        ]}
        onClose={() => setShowPhotoModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    gap: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backBtnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  screenTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarInitials: {
    color: colors.text,
    fontSize: 36,
    fontWeight: 'bold',
  },
  changePhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  changePhotoText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  displayName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  email: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  providerBadge: {
    marginTop: 8,
    backgroundColor: colors.glass,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  providerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  upgradeCard: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(232, 115, 74, 0.15)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(232, 115, 74, 0.3)',
    gap: 8,
  },
  upgradeTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  upgradeText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  upgradeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  upgradeBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    gap: 8,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleDescription: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  signOutBtn: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  signOutText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
});
