'use client';

import { useEffect, useRef, useState } from 'react';
import { useDuetStore } from '@/hooks/useDuetStore';

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  delay: number;
}

export function ReactionOverlay() {
  const incomingReaction = useDuetStore((s) => s.incomingReaction);
  const [emojis, setEmojis] = useState<FloatingEmoji[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (!incomingReaction) return;

    const id = ++idRef.current;
    // Random horizontal position in the middle 60% of screen
    const x = 20 + Math.random() * 60;

    setEmojis((prev) => [...prev, { id, emoji: incomingReaction.emoji, x, delay: 0 }]);

    // Remove after animation completes
    const timer = setTimeout(() => {
      setEmojis((prev) => prev.filter((e) => e.id !== id));
    }, 2200);

    return () => clearTimeout(timer);
  }, [incomingReaction]);

  if (emojis.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {emojis.map((e) => (
        <div
          key={e.id}
          className="absolute animate-float-emoji"
          style={{
            left: `${e.x}%`,
            bottom: '15%',
            fontSize: '40px',
          }}
        >
          {e.emoji}
        </div>
      ))}
    </div>
  );
}
