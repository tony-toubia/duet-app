'use client';

import { useState } from 'react';

interface ShareModalProps {
  visible: boolean;
  roomCode: string;
  onClose: () => void;
}

export function ShareModal({ visible, roomCode, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = roomCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/app/room/${roomCode}`;
    const shareData = {
      title: 'Join me on Duet!',
      text: `Join me on Duet! Enter code: ${roomCode}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Share cancelled
      }
    } else {
      // Fallback: copy the URL
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-white rounded-3xl p-7 w-full max-w-[340px] text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[22px] font-bold text-[#1a1a2e] mb-1.5">Your Room Code</h2>
        <p className="text-sm text-[#6b6b80] mb-6 leading-5">
          Share this code with your partner to connect
        </p>

        <button
          onClick={handleCopy}
          className="bg-[#f5f5fa] border border-[#e8e8f0] rounded-2xl py-4.5 px-8 w-full mb-6 hover:bg-[#ebebf2] transition-colors"
        >
          <div className="text-[32px] font-extrabold text-[#1a1a2e] tracking-[6px]">{roomCode}</div>
          <div className="text-[11px] text-[#9a9aaa] mt-1.5">
            {copied ? 'Copied!' : 'Tap to copy'}
          </div>
        </button>

        <button
          onClick={handleShare}
          className="bg-primary text-white rounded-2xl py-3.5 px-8 w-full font-bold text-base mb-3 hover:bg-primary-light transition-colors"
        >
          Share Code
        </button>

        <button
          onClick={handleClose}
          className="text-[#9a9aaa] text-[15px] font-semibold py-2 px-6"
        >
          Done
        </button>
      </div>
    </div>
  );
}
