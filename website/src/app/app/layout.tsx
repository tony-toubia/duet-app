'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useDuetStore } from '@/hooks/useDuetStore';
import { authService } from '@/services/AuthService';
import { AuthScreen } from '@/components/app/AuthScreen';
import { Spinner } from '@/components/ui/Spinner';
import { AgeGate, AgeBlocked } from '@/components/app/AgeGate';
import { ageGateService } from '@/services/AgeGateService';
import { blockService } from '@/services/BlockService';
import type { AgeGateResult } from '@/lib/ageGate';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, showUpgradeAuth, initializeAuth, completeSignInWithEmailLink } = useAuthStore();
  const initializeDuet = useDuetStore((s) => s.initialize);
  const [emailLinkError, setEmailLinkError] = useState<string | null>(null);
  // undefined until read from localStorage (client only); null = not yet asked
  const [ageResult, setAgeResult] = useState<AgeGateResult | null | undefined>(undefined);

  useEffect(() => {
    setAgeResult(ageGateService.getResult());
  }, []);

  // Under the minimum age: never stay signed in.
  // NEEDS COUNSEL: whether an existing account's data must also be deleted.
  useEffect(() => {
    if (ageResult === 'blocked' && user) useAuthStore.getState().signOut().catch(() => {});
  }, [ageResult, user]);

  // Keep the block list loaded while signed in
  useEffect(() => {
    if (!user) return;
    return blockService.start();
  }, [user]);

  useEffect(() => {
    const unsub = initializeAuth();
    return unsub;
  }, [initializeAuth]);

  // Initialize the duet store once on mount so cold-start telemetry fires.
  useEffect(() => {
    initializeDuet();
  }, [initializeDuet]);

  // Handle email link sign-in when user arrives via the link
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = window.location.href;
    if (!authService.checkSignInWithEmailLink(url)) return;

    const email = authService.getPendingSignInEmail();
    if (email) {
      completeSignInWithEmailLink(url, email)
        .then(() => {
          // Clean the URL so the link params don't persist
          window.history.replaceState({}, '', '/app');
        })
        .catch((err: any) => {
          if (err?.message === 'EMAIL_REQUIRED') {
            setEmailLinkError('Please enter your email to complete sign-in.');
          } else {
            setEmailLinkError(err?.message || 'Could not complete sign-in.');
          }
        });
    } else {
      setEmailLinkError('Please enter your email to complete sign-in.');
    }
  }, [completeSignInWithEmailLink]);

  if (ageResult === null) {
    return <AgeGate onDone={setAgeResult} />;
  }
  if (ageResult === 'blocked') {
    return <AgeBlocked />;
  }

  if (isLoading || ageResult === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user || showUpgradeAuth) {
    return <AuthScreen emailLinkError={emailLinkError} isUpgrade={showUpgradeAuth} />;
  }

  return <>{children}</>;
}
