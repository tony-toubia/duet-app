'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuthStore';
import { storageService } from '@/services/StorageService';

export function ProfileScreen() {
  const router = useRouter();
  const { user, userProfile, isGuest, signOut, refreshProfile, preferences, updatePreferences } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChangePhoto = async () => {
    setError(null);
    try {
      const file = await storageService.pickImage();
      if (!file) return;

      setIsUploading(true);
      await storageService.uploadAvatar(file);
      await refreshProfile();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload photo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = async () => {
    setShowSignOutModal(false);
    await signOut();
    router.push('/app');
  };

  const displayName = userProfile?.displayName || user?.displayName || 'Duet User';
  const email = userProfile?.email || user?.email || (isGuest ? 'Guest Account' : 'No email');
  const avatarUrl = userProfile?.avatarUrl || user?.photoURL;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen-safe bg-background text-text-main">
      {/* Header */}
      <div className="flex items-center px-5 pt-6 pb-4">
        <button
          onClick={() => router.push('/app')}
          className="text-primary text-base font-medium"
        >
          Back
        </button>
        <h1 className="text-xl font-bold ml-4">Profile</h1>
      </div>

      <div className="px-5 flex flex-col items-center gap-6 max-w-sm mx-auto w-full pb-8">
        {error && (
          <div className="w-full bg-danger/15 border border-danger/30 rounded-xl px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Avatar */}
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-3xl font-bold">
              {initial}
            </div>
          )}
          <button
            onClick={handleChangePhoto}
            disabled={isUploading || isGuest}
            className="absolute bottom-0 right-0 w-8 h-8 bg-surface border-2 border-background rounded-full flex items-center justify-center text-sm hover:bg-glass transition-colors disabled:opacity-50"
          >
            {isUploading ? '...' : '\u270F\uFE0F'}
          </button>
        </div>

        {/* Info */}
        <div className="text-center">
          <h2 className="text-2xl font-bold">{displayName}</h2>
          <p className="text-text-muted text-sm mt-1">{email}</p>
          {isGuest && (
            <p className="text-warning text-xs mt-2">
              Guest accounts have limited features. Sign in for the full experience.
            </p>
          )}
        </div>

        {/* Account info card */}
        {(userProfile?.authProvider === 'google' || userProfile?.createdAt) && (
          <div className="w-full bg-glass border border-glass-border rounded-2xl p-4 flex flex-col gap-3">
            {userProfile?.authProvider === 'google' && (
              <div className="flex justify-between">
                <span className="text-text-muted text-sm">Signed in with</span>
                <span className="text-sm font-medium">Google</span>
              </div>
            )}
            {userProfile?.createdAt && (
              <div className="flex justify-between">
                <span className="text-text-muted text-sm">Member Since</span>
                <span className="text-sm font-medium">
                  {new Date(userProfile.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        )}


        {/* Notifications */}
        {!isGuest && (
          <div className="w-full bg-glass border border-glass-border rounded-2xl p-4">
            <h3 className="text-xs text-text-muted uppercase tracking-wide font-semibold mb-3">Notifications</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-text-muted mt-0.5 opacity-70">Receive marketing emails and updates</p>
              </div>
              <button
                onClick={() => updatePreferences({ emailOptIn: !preferences.emailOptIn })}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  preferences.emailOptIn ? 'bg-primary' : 'bg-text-muted/30'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    preferences.emailOptIn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        {isGuest ? (
          <button
            onClick={() => signOut()}
            className="w-full bg-primary text-white rounded-full py-3.5 font-semibold text-base hover:bg-primary-light transition-colors"
          >
            Sign In to Full Account
          </button>
        ) : (
          <button
            onClick={() => setShowSignOutModal(true)}
            className="w-full bg-danger/15 border border-danger/30 text-danger rounded-full py-3.5 font-semibold text-base hover:bg-danger/25 transition-colors"
          >
            Sign Out
          </button>
        )}
      </div>

      {/* Sign out confirmation */}
      {showSignOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={() => setShowSignOutModal(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-3xl p-7 w-full max-w-[340px] text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">Sign Out</h2>
            <p className="text-sm text-[#6b6b80] mb-6">Are you sure you want to sign out?</p>
            <button
              onClick={handleSignOut}
              className="bg-danger text-white rounded-2xl py-3.5 w-full font-bold text-base mb-3 hover:bg-red-600 transition-colors"
            >
              Sign Out
            </button>
            <button
              onClick={() => setShowSignOutModal(false)}
              className="text-[#9a9aaa] text-[15px] font-semibold py-2 px-6"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
