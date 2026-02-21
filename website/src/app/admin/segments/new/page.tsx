'use client';

import { useRouter } from 'next/navigation';
import { createCustomSegment, refreshSegments } from '@/services/AdminService';
import SegmentBuilder from '../SegmentBuilder';
import type { SegmentRuleSet } from '@/lib/segmentFields';

export default function NewSegmentPage() {
  const router = useRouter();

  const handleSave = async (name: string, description: string, rules: SegmentRuleSet) => {
    await createCustomSegment({ name, description, rules });
    await refreshSegments();
    router.push('/admin/segments');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">New Custom Segment</h1>
      <SegmentBuilder onSave={handleSave} saveLabel="Create Segment" />
    </div>
  );
}
