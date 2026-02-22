'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminStore } from '@/hooks/useAdminStore';
import { Spinner } from '@/components/ui/Spinner';

export default function MessagesPage() {
  const { messages, isLoadingMessages, loadMessages } = useAdminStore();
  const [filter, setFilter] = useState<'all' | 'email' | 'push'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const filtered = messages.filter((m) => {
    if (filter !== 'all' && m.channel !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!m.name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getSnippet = (msg: any) => {
    if (msg.channel === 'email') {
      return msg.email?.subject || 'No subject';
    }
    return msg.push?.title || 'No title';
  };

  if (isLoadingMessages) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Messages</h1>
        <Link
          href="/admin/messages/new"
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
        >
          New Message
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
          {(['all', 'email', 'push'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-glass border border-glass-border text-text-muted hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'email' ? 'Email' : 'Push'}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name..."
          className="flex-1 max-w-xs px-3 py-2 bg-glass border border-glass-border rounded-lg text-white text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted mb-2">
            {messages.length === 0
              ? 'No messages yet.'
              : 'No messages match your filters.'}
          </p>
          {messages.length === 0 && (
            <Link
              href="/admin/messages/new"
              className="text-primary text-sm hover:underline"
            >
              Create your first message
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((msg) => (
            <Link
              key={msg.id}
              href={`/admin/messages/${msg.id}`}
              className="flex items-center gap-4 p-4 bg-glass border border-glass-border rounded-xl hover:border-primary transition-colors group"
            >
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                  msg.channel === 'email'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                {msg.channel}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-primary transition-colors">
                  {msg.name}
                </p>
                <p className="text-xs text-text-muted truncate mt-0.5">
                  {getSnippet(msg)}
                </p>
              </div>
              <span className="text-xs text-text-muted whitespace-nowrap">
                {msg.createdAt
                  ? new Date(msg.createdAt).toLocaleDateString()
                  : ''}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
