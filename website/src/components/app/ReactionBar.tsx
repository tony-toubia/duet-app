'use client';

import { useDuetStore } from '@/hooks/useDuetStore';

const REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥'];

export function ReactionBar() {
  const sendReaction = useDuetStore((s) => s.sendReaction);
  const connectionState = useDuetStore((s) => s.connectionState);

  if (connectionState !== 'connected') return null;

  return (
    <div className="flex justify-center gap-2 px-5 mt-4">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => sendReaction(emoji)}
          className="w-11 h-11 rounded-full bg-glass border border-glass-border flex items-center justify-center text-[22px] hover:bg-white/20 hover:scale-110 active:scale-95 transition-all"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
