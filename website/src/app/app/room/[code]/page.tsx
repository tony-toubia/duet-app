'use client';

import { useParams } from 'next/navigation';
import { RoomScreen } from '@/components/app/RoomScreen';

export default function RoomPage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();

  return <RoomScreen initialRoomCode={code} />;
}
