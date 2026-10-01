'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuthStore';
import { AuthScreen } from '@/components/app/AuthScreen';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';
import { checkAdmin } from '@/services/AdminService';


const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/campaigns', label: 'Batch Campaigns', icon: 'campaigns' },
  { href: '/admin/messages', label: 'Messages', icon: 'messages' },
  { href: '/admin/segments', label: 'Segments', icon: 'segments' },
  { href: '/admin/journeys', label: 'Journeys', icon: 'journeys' },
  { href: '/admin/assets', label: 'Assets', icon: 'assets' },
  { href: '/admin/reporting', label: 'Reporting', icon: 'reporting' },
  { href: '/admin/subscribers', label: 'Subscribers', icon: 'subscribers' },
  { href: '/admin/content-hub', label: 'Content Hub', icon: 'dashboard' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, initializeAuth } = useAuthStore();
  const pathname = usePathname();

  // Admin access is decided by the server (fails closed). The old client-side
  // NEXT_PUBLIC_ADMIN_UIDS check allowed everyone when unset and exposed the
  // admin UIDs in the public JavaScript bundle.
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    const unsub = initializeAuth();
    return unsub;
  }, [initializeAuth]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setAccess('checking');
    checkAdmin().then((isAdmin) => {
      if (!cancelled) setAccess(isAdmin ? 'allowed' : 'denied');
    });
    return () => { cancelled = true; };
  }, [user]);

  if (isLoading || (user && access === 'checking')) {
    return (
      <div className="min-h-screen bg-lobby-dark flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen emailLinkError={null} isUpgrade={false} />;
  }

  if (access !== 'allowed') {
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/icons/${item.icon}.png`}
                  alt=""
                  width={20}
                  height={20}
                  className={cn(
                    'flex-shrink-0 w-5 h-5 object-contain',
                    isActive ? 'opacity-100' : 'opacity-60'
                  )}
                />
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
