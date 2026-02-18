'use client';

import { Suspense } from 'react';
import { LobbyScreen } from '@/components/app/LobbyScreen';

export default function AppPage() {
  return (
    <Suspense>
      <LobbyScreen />
    </Suspense>
  );
}
