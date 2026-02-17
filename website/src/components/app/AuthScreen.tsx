'use client';

import { useState } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { authService } from '@/services/AuthService';

type AuthMode = 'landing' | 'login' | 'register' | 'emailLink' | 'emailLinkSent';

function PasswordRequirements({ password, confirmPassword }: { password: string; confirmPassword: string }) {
  const rules = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /\d/.test(password) },
    { label: 'Special character (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
    { label: 'Passwords match', met: confirmPassword.length > 0 && password === confirmPassword },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      {rules.map((rule) => (
        <div key={rule.label} className="flex items-center gap-2">
          <span className={`text-sm w-4 text-center ${rule.met ? 'text-success' : 'text-text-muted'}`}>
            {rule.met ? '\u2713' : '\u2022'}
          </span>
          <span className={`text-xs ${rule.met ? 'text-success' : 'text-text-muted'}`}>
            {rule.label}
          </span>
        </div>
      ))}
    </div>
  );
}

interface AuthScreenProps {
  emailLinkError?: string | null;
}

export function AuthScreen({ emailLinkError }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(emailLinkError ? 'emailLink' : 'landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(emailLinkError ?? null);

  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendSignInLink, completeSignInWithEmailLink, continueAsGuest } = useAuthStore();

  const isPasswordValid = (pw: string) =>
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /\d/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw);

  const clearError = () => setError(null);

  const handleGoogleSignIn = async () => {
    clearError();
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError(err?.message || 'Could not sign in with Google. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    clearError();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      const msg = err?.code === 'auth/invalid-credential'
        ? 'Invalid email or password.'
        : err?.message || 'Could not sign in. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailRegister = async () => {
    clearError();
    if (!email || !password || !displayName || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (!isPasswordValid(password)) {
      setError('Please meet all password requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      await signUpWithEmail(email, password, displayName);
    } catch (err: any) {
      setError(err?.message || 'Could not create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    clearError();
    setIsLoading(true);
    try {
      await continueAsGuest();
    } catch (err: any) {
      setError('Could not continue as guest. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmailLink = async () => {
    clearError();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    try {
      await sendSignInLink(email);
      setMode('emailLinkSent');
    } catch (err: any) {
      setError(err?.message || 'Could not send sign-in link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteEmailLink = async () => {
    clearError();
    if (!email) {
      setError('Please enter the email address the link was sent to.');
      return;
    }
    setIsLoading(true);
    try {
      await completeSignInWithEmailLink(window.location.href, email);
      window.history.replaceState({}, '', '/app');
    } catch (err: any) {
      setError(err?.message || 'Could not complete sign-in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const canRegister =
    email.length > 0 &&
    displayName.length > 0 &&
    isPasswordValid(password) &&
    password === confirmPassword;

  const errorBanner = error && (
    <div className="bg-danger/15 border border-danger/30 rounded-xl px-4 py-3 text-sm text-danger">
      {error}
    </div>
  );

  // Email Link Sent
  if (mode === 'emailLinkSent') {
    return (
      <div className="min-h-screen-safe bg-background flex items-center justify-center px-8">
        <div className="max-w-sm w-full text-center flex flex-col items-center gap-4">
          <span className="text-5xl mb-2">{'\u2709\uFE0F'}</span>
          <h1 className="text-2xl font-bold text-text-main">Check your email</h1>
          <p className="text-text-muted leading-relaxed">
            We sent a sign-in link to<br />
            <span className="text-text-main font-semibold">{email}</span>
          </p>
          <p className="text-sm text-text-muted leading-relaxed">
            Tap the link in the email to sign in. The page will update automatically.
          </p>
          <button
            onClick={handleSendEmailLink}
            disabled={isLoading}
            className="text-primary-light text-sm font-medium mt-4 hover:underline disabled:opacity-50"
          >
            Resend link
          </button>
          <button
            onClick={() => { setMode('landing'); setEmail(''); clearError(); }}
            className="text-primary text-sm font-medium hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // Landing
  if (mode === 'landing') {
    return (
      <div className="h-screen-safe relative overflow-hidden bg-[#1a293d]">
        {/* Background image: scales to viewport height, width follows aspect ratio, max 600px */}
        <div className="absolute inset-0 flex justify-center overflow-hidden">
          <img src="/duet-home-bg.png" alt="" className="h-full w-auto max-w-[600px] object-top" />
        </div>

        <div className="absolute inset-0 z-10 flex justify-center">
          <div className="relative w-full max-w-sm h-full flex flex-col">
            <div className="text-center pt-12">
              <img src="/duet-logo.png" alt="Duet" className="w-14 h-14 mx-auto" style={{ filter: 'brightness(0) saturate(100%) invert(55%) sepia(80%) saturate(500%) hue-rotate(340deg)' }} />
              <h1 className="text-4xl font-bold text-white mt-2">Duet</h1>
              <p className="text-white/85 mt-2 leading-relaxed">
                Always-on voice connection.<br />Together, even when apart.
              </p>
            </div>
            <div className="flex-1" />
            <div className="px-2 pb-8 flex flex-col gap-3 w-full">
              {errorBanner}
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="bg-primary text-white py-4 rounded-full text-lg font-semibold hover:bg-primary-light transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign in with Google'}
              </button>
              <button
                onClick={() => { setMode('emailLink'); clearError(); }}
                disabled={isLoading}
                className="bg-[#f4dbc8] text-[#3d3d50] py-4 rounded-full text-lg font-semibold border-2 border-[#3d3d50] hover:bg-[#efd0b8] transition-colors"
              >
                Sign in with Email Link
              </button>
              <div className="flex justify-center items-center gap-3 py-2">
                <button
                  onClick={() => { setMode('login'); clearError(); }}
                  disabled={isLoading}
                  className="text-[#1a293d] text-sm font-semibold hover:underline"
                >
                  Sign in with Password
                </button>
                <span className="text-[#1a293d] opacity-40">|</span>
                <button
                  onClick={() => { setMode('register'); clearError(); }}
                  disabled={isLoading}
                  className="text-[#1a293d] text-sm font-semibold hover:underline"
                >
                  Create Account
                </button>
              </div>
              <button
                onClick={handleGuest}
                disabled={isLoading}
                className="text-[#1a293d] text-sm font-medium py-2 hover:underline"
              >
                Continue as Guest
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Email Link form
  const isCompletingLink = emailLinkError && typeof window !== 'undefined' && authService.checkSignInWithEmailLink(window.location.href);

  if (mode === 'emailLink') {
    return (
      <div className="min-h-screen-safe bg-background px-8 flex flex-col">
        <div className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center gap-4">
          <button
            onClick={() => { setMode('landing'); clearError(); }}
            className="text-primary text-base font-medium self-start mb-2"
          >
            Back
          </button>
          <h1 className="text-3xl font-bold text-text-main">
            {isCompletingLink ? 'Complete Sign In' : 'Passwordless Sign In'}
          </h1>
          <p className="text-text-muted text-sm">
            {isCompletingLink
              ? 'Enter the email address the sign-in link was sent to.'
              : "Enter your email and we\u2019ll send you a sign-in link. No password needed."}
          </p>
          {errorBanner}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white/10 border border-glass-border rounded-xl py-3.5 px-4 text-text-main placeholder:text-text-muted outline-none focus:border-primary transition-colors"
          />
          {isCompletingLink ? (
            <button
              onClick={handleCompleteEmailLink}
              disabled={isLoading}
              className="bg-primary text-white py-4 rounded-full text-lg font-semibold hover:bg-primary-light transition-colors disabled:opacity-50 mt-2"
            >
              {isLoading ? 'Signing in...' : 'Complete Sign In'}
            </button>
          ) : (
            <button
              onClick={handleSendEmailLink}
              disabled={isLoading}
              className="bg-primary text-white py-4 rounded-full text-lg font-semibold hover:bg-primary-light transition-colors disabled:opacity-50 mt-2"
            >
              {isLoading ? 'Sending...' : 'Send Sign-In Link'}
            </button>
          )}
          <button
            onClick={() => { setMode('login'); clearError(); }}
            className="text-primary-light text-sm text-center py-3 hover:underline"
          >
            Prefer to use a password? Sign in here
          </button>
        </div>
      </div>
    );
  }

  // Login or Register form
  return (
    <div className="min-h-screen-safe bg-background px-8 flex flex-col">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col justify-center gap-4">
        <button
          onClick={() => { setMode('landing'); clearError(); }}
          className="text-primary text-base font-medium self-start mb-2"
        >
          Back
        </button>
        <h1 className="text-3xl font-bold text-text-main">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-text-muted text-sm">
          {mode === 'login' ? 'Sign in to your Duet account' : 'Join Duet to stay connected'}
        </p>
        {errorBanner}

        {mode === 'register' && (
          <>
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="bg-primary text-white py-4 rounded-full text-lg font-semibold hover:bg-primary-light transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Register with Google'}
            </button>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-glass-border" />
              <span className="text-text-muted text-xs">or register with email</span>
              <div className="flex-1 h-px bg-glass-border" />
            </div>
          </>
        )}

        {mode === 'register' && (
          <input
            type="text"
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="bg-white/10 border border-glass-border rounded-xl py-3.5 px-4 text-text-main placeholder:text-text-muted outline-none focus:border-primary transition-colors"
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white/10 border border-glass-border rounded-xl py-3.5 px-4 text-text-main placeholder:text-text-muted outline-none focus:border-primary transition-colors"
        />

        <div className="flex items-center bg-white/10 border border-glass-border rounded-xl">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 py-3.5 px-4 bg-transparent text-text-main placeholder:text-text-muted outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="px-4 py-3.5 text-primary-light text-sm font-medium"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {mode === 'register' && (
          <>
            <div className="flex items-center bg-white/10 border border-glass-border rounded-xl">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="flex-1 py-3.5 px-4 bg-transparent text-text-main placeholder:text-text-muted outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="px-4 py-3.5 text-primary-light text-sm font-medium"
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <PasswordRequirements password={password} confirmPassword={confirmPassword} />
          </>
        )}

        <button
          onClick={mode === 'login' ? handleEmailLogin : handleEmailRegister}
          disabled={isLoading || (mode === 'register' && !canRegister)}
          className="bg-primary text-white py-4 rounded-full text-lg font-semibold hover:bg-primary-light transition-colors disabled:opacity-50 mt-2"
        >
          {isLoading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setConfirmPassword('');
            setShowPassword(false);
            setShowConfirmPassword(false);
            clearError();
          }}
          className="text-primary-light text-sm text-center py-3 hover:underline"
        >
          {mode === 'login'
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
