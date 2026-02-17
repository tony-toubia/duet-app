'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    // TODO: Wire up to backend deletion endpoint
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
          <p className="text-sm text-[#3d4f5f] mb-3">Requesting account deletion will permanently remove:</p>
          <ul className="pl-5 mb-3 list-disc">
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your profile (display name, email, profile photo)</li>
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your friends list and pending requests</li>
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your recent connections history</li>
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your push notification tokens</li>
            <li className="text-sm text-[#3d4f5f] mb-1.5">Your uploaded avatar image</li>
          </ul>
          <p className="text-sm text-[#3d4f5f]">Room data is already automatically deleted after 24 hours of inactivity. Crash reports are retained per Google&apos;s standard retention policy.</p>
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
            disabled={submitted}
            className={`w-full py-3.5 text-base font-semibold text-white rounded-lg transition-colors ${
              submitted
                ? 'bg-success cursor-not-allowed'
                : 'bg-[#c0392b] hover:bg-[#a93226] cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed'
            }`}
          >
            {submitted ? 'Request Submitted' : 'Request Account Deletion'}
          </button>
        </form>

        <p className="text-xs text-[#8a99a8] text-center mt-4 leading-relaxed">
          We will process your request within 30 days. You will receive a confirmation email once your data has been deleted.
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
