'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [opened, setOpened] = useState(false);

  // There is no automated deletion backend yet: requests are handled by hand.
  // Submitting opens a pre-filled email to us instead of showing a
  // confirmation for a request that was never sent anywhere.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = 'Delete my Duet account';
    const body =
      `Please delete my Duet account and its data.\n\nAccount email: ${email}\n\n` +
      'I understand this is permanent and cannot be undone.';
    window.location.href =
      `mailto:hello@getduet.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setOpened(true);
  };

  return (
    <div className="min-h-screen bg-[#f8f6f3] text-lobby-dark">
      {/* Header */}
      <div className="bg-lobby-dark text-white py-10 px-5 text-center">
        <h1 className="text-3xl font-bold mb-1">Delete Your Account</h1>
        <p className="text-sm opacity-70">
          <Link href="/" className="text-primary hover:underline">getduet.app</Link>
        </p>
      </div>

      {/* Content */}
      <div className="max-w-[520px] mx-auto px-5 py-10 pb-20">
        {/* Info Box */}
        <div className="bg-white border border-[#e0dbd5] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-3 text-lobby-dark">What gets deleted</h2>
          <p className="text-sm text-[#3d4f5f] mb-3">Deleting your account permanently removes:</p>
          <ul className="pl-5 mb-3 list-disc">
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your profile (display name, email, profile photo)</li>
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your friends list and pending requests</li>
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your recent connections and last-partner history</li>
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your invitations, online status, and settings</li>
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your push notification tokens</li>
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your usage history and email records</li>
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your uploaded avatar image</li>
          </ul>
          <p className="text-sm text-[#3d4f5f]">Room data is already deleted when everyone leaves a room, and within about 24 hours of the room being created. Crash reports are kept by Firebase Crashlytics for 90 days.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-semibold text-lobby-dark mb-1.5">
              Email address associated with your account
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-3 text-[15px] border border-[#d0cbc5] rounded-lg bg-white text-lobby-dark outline-none focus:border-primary transition-colors placeholder:text-[#a0a0a0]"
            />
          </div>

          <div className="flex items-start gap-2.5 mb-5">
            <input
              type="checkbox"
              id="confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              required
              className="mt-0.5 w-[18px] h-[18px] accent-primary"
            />
            <label htmlFor="confirm" className="text-sm text-[#3d4f5f] leading-relaxed font-normal">
              I understand that this action is permanent and all my data will be deleted. This cannot be undone.
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 text-base font-semibold text-white rounded-lg transition-colors bg-[#c0392b] hover:bg-[#a93226] cursor-pointer"
          >
            Email Deletion Request
          </button>
        </form>

        {opened && (
          <div role="status" className="mt-4 rounded-lg border border-[#e0dbd5] bg-white p-4 text-sm text-[#3d4f5f] leading-relaxed">
            Your email app should now be open with the request filled in. <strong>Send that email to finish your request.</strong>{' '}
            If nothing opened, email <strong>hello@getduet.app</strong> from your account&apos;s email address with the subject &ldquo;Delete my Duet account&rdquo;.
          </div>
        )}

        {/* NEEDS COUNSEL / OPS: "within 30 days" is a commitment someone must now meet by
            hand. Guest accounts have no email, so guests cannot identify themselves
            through this page; an in-app deletion option is needed (and is required by
            the App Store for apps that let people create accounts). */}
        <p className="text-xs text-[#8a99a8] text-center mt-4 leading-relaxed">
          Requests are handled by our team by email. We aim to delete your data within 30 days and will reply to confirm when it&apos;s done.
          If you have questions, contact <a href="mailto:hello@getduet.app" className="text-primary">hello@getduet.app</a>.
        </p>
      </div>

      {/* Footer */}
      <div className="text-center py-8 px-5 text-[#8a99a8] text-sm border-t border-[#e0dbd5]">
        <p>&copy; 2026 Duet. All rights reserved. | <Link href="/" className="text-primary hover:underline">Home</Link> | <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link></p>
      </div>
    </div>
  );
}
