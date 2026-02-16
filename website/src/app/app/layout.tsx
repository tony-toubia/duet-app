'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { authService } from '@/services/AuthService';
import { AuthScreen } from '@/components/app/AuthScreen';
import { Spinner } from '@/components/ui/Spinner';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, initializeAuth, completeSignInWithEmailLink } = useAuthStore();
  const [emailLinkError, setEmailLinkError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = initializeAuth();
    return unsub;
  }, [initializeAuth]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen emailLinkError={emailLinkError} />;
  }

  return <>{children}</>;
}
