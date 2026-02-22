'use client';

import { useState, useEffect } from 'react';

interface DeepLinkFieldProps {
  value: string;
  onChange: (url: string) => void;
}

type LinkType = 'lobby' | 'profile' | 'friends' | 'room' | 'custom';

const PRESETS: { type: LinkType; label: string; url: string }[] = [
  { type: 'lobby', label: 'Open App', url: 'duet://lobby' },
  { type: 'profile', label: 'Profile', url: 'duet://profile' },
  { type: 'friends', label: 'Friends', url: 'duet://friends' },
  { type: 'room', label: 'Join Room', url: 'duet://room/' },
];

function detectType(url: string): LinkType {
  if (!url) return 'custom';
  if (url === 'duet://lobby') return 'lobby';
  if (url === 'duet://profile') return 'profile';
  if (url === 'duet://friends') return 'friends';
  if (url.startsWith('duet://room/')) return 'room';
  return 'custom';
}

export function DeepLinkField({ value, onChange }: DeepLinkFieldProps) {
  const [activeType, setActiveType] = useState<LinkType>(() => detectType(value));
  const [roomCode, setRoomCode] = useState(() => {
    if (value.startsWith('duet://room/')) return value.replace('duet://room/', '');
    return '';
  });

  // Sync chips when value changes externally
  useEffect(() => {
    const detected = detectType(value);
    setActiveType(detected);
    if (detected === 'room') {
      setRoomCode(value.replace('duet://room/', ''));
    }
  }, [value]);

  const handleChipClick = (preset: (typeof PRESETS)[number]) => {
    setActiveType(preset.type);
    if (preset.type === 'room') {
      const code = roomCode || '';
      onChange(`duet://room/${code}`);
    } else {
      onChange(preset.url);
      setRoomCode('');
    }
  };

  const handleRoomCodeChange = (code: string) => {
    const sanitized = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    setRoomCode(sanitized);
    onChange(`duet://room/${sanitized}`);
  };

  const handleUrlInput = (url: string) => {
    onChange(url);
    // Detect type from manual input
    const detected = detectType(url);
    setActiveType(detected);
    if (detected === 'room') {
      setRoomCode(url.replace('duet://room/', ''));
    }
  };

  const chipBase =
    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer';
  const chipActive = 'bg-primary/20 text-primary border border-primary/40';
  const chipInactive =
    'bg-glass border border-glass-border text-text-muted hover:text-white hover:border-glass-border/80';

  return (
    <div>
      <label className="block text-sm text-text-muted mb-1">
        Action URL <span className="opacity-50">(optional — opens on tap)</span>
      </label>

      {/* Quick-pick chips */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {PRESETS.map((p) => (
          <button
            key={p.type}
            type="button"
            onClick={() => handleChipClick(p)}
            className={`${chipBase} ${activeType === p.type ? chipActive : chipInactive}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Room code sub-input */}
      {activeType === 'room' && (
        <div className="mb-2">
          <input
            type="text"
            value={roomCode}
            onChange={(e) => handleRoomCodeChange(e.target.value)}
            placeholder="Room code (e.g. ABC123)"
            maxLength={6}
            className="w-40 px-3 py-1.5 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary font-mono tracking-wider uppercase"
          />
        </div>
      )}

      {/* Full URL input */}
      <input
        type="text"
        value={value}
        onChange={(e) => handleUrlInput(e.target.value)}
        placeholder="duet://lobby or https://getduet.app"
        className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
      />
    </div>
  );
}
