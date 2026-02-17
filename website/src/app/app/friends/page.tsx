'use client';

import { Suspense } from 'react';
import { FriendsScreen } from '@/components/app/FriendsScreen';
import { Spinner } from '@/components/ui/Spinner';

export default function FriendsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Spinner size="lg" /></div>}>
      <FriendsScreen />
    </Suspense>
  );
}
