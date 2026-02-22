'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchMessages } from '@/services/AdminService';

interface MessagePickerProps {
  channel: 'email' | 'push';
  value: string | null;
  onChange: (id: string | null) => void;
}

export function MessagePicker({ channel, value, onChange }: MessagePickerProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMessages()
      .then((data) => {
        const filtered = (data.messages || []).filter((m: any) => m.channel === channel);
        setMessages(filtered);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [channel]);

  const selected = value ? messages.find((m) => m.id === value) : null;

  return (
    <div className="space-y-2">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm focus:outline-none focus:border-primary"
      >
        <option value="">Select a message...</option>
        {isLoading && <option disabled>Loading...</option>}
        {messages.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {channel === 'email' && m.email?.subject ? ` — ${m.email.subject}` : ''}
            {channel === 'push' && m.push?.title ? ` — ${m.push.title}` : ''}
          </option>
        ))}
      </select>

      {/* Preview card */}
      {selected && (
        <div className="p-3 bg-glass border border-glass-border rounded-lg space-y-1.5">
          {channel === 'email' && selected.email && (
            <>
              <p className="text-xs text-text-muted">Subject: <span className="text-white">{selected.email.subject}</span></p>
              <pre className="text-xs text-text-muted font-mono whitespace-pre-wrap overflow-auto max-h-24 bg-surface rounded p-2">
                {selected.email.body?.substring(0, 300)}{selected.email.body?.length > 300 ? '...' : ''}
              </pre>
            </>
          )}
          {channel === 'push' && selected.push && (
            <>
              <p className="text-xs text-text-muted">Title: <span className="text-white">{selected.push.title}</span></p>
              <p className="text-xs text-text-muted">Body: <span className="text-white">{selected.push.body}</span></p>
              {selected.push.imageUrl && (
                <div className="rounded overflow-hidden border border-glass-border inline-block">
                  <img src={selected.push.imageUrl} alt="" className="max-h-16 object-contain" />
                </div>
              )}
            </>
          )}
          <Link
            href={`/admin/messages/${selected.id}`}
            className="text-primary text-xs hover:underline inline-block"
            target="_blank"
          >
            View in Messages
          </Link>
        </div>
      )}
    </div>
  );
}
