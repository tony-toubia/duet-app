'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuthStore';
import { AuthScreen } from '@/components/app/AuthScreen';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';

const ADMIN_UIDS = (process.env.NEXT_PUBLIC_ADMIN_UIDS || '').split(',').filter(Boolean);

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/campaigns', label: 'Campaigns', icon: '📨' },
  { href: '/admin/segments', label: 'Segments', icon: '👥' },
  { href: '/admin/journeys', label: 'Journeys', icon: '🔄' },
  { href: '/admin/assets', label: 'Assets', icon: '🖼️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, initializeAuth } = useAuthStore();
  const pathname = usePathname();

  useEffect(() => {
    const unsub = initializeAuth();
    return unsub;
  }, [initializeAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-lobby-dark flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen emailLinkError={null} isUpgrade={false} />;
  }

  if (ADMIN_UIDS.length > 0 && !ADMIN_UIDS.includes(user.uid)) {
    return (
      <div className="min-h-screen bg-lobby-dark flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-lobby-warm/60">You are not authorized to access the admin panel.</p>
          <Link href="/" className="inline-block mt-4 text-primary hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lobby-dark flex">
      {/* Sidebar */}
      <aside className="w-56 bg-surface border-r border-glass-border flex flex-col">
        <div className="p-4 border-b border-glass-border">
          <Link href="/admin" className="text-lg font-bold text-white">
            Duet Admin
          </Link>
        </div>
        <nav className="flex-1 p-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors',
                  isActive
                    ? 'bg-primary/20 text-primary'
                    : 'text-text-muted hover:bg-glass hover:text-white'
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-glass-border">
          <Link href="/" className="text-xs text-text-muted hover:text-white transition-colors">
            &larr; Back to site
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
