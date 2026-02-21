'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchCustomSegment, updateCustomSegment, refreshSegments } from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';
import SegmentBuilder from '../SegmentBuilder';
import type { SegmentRuleSet } from '@/lib/segmentFields';

export default function EditSegmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [segment, setSegment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCustomSegment(id);
        setSegment(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  const handleSave = async (name: string, description: string, rules: SegmentRuleSet) => {
    await updateCustomSegment(id, { name, description, rules });
    await refreshSegments();
    router.push('/admin/segments');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !segment) {
    return (
      <div className="text-center py-20">
        <p className="text-danger mb-4">{error || 'Segment not found'}</p>
        <button
          onClick={() => router.push('/admin/segments')}
          className="text-sm text-primary hover:text-primary-light"
        >
          Back to Segments
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Edit Segment</h1>
      <SegmentBuilder
        initialName={segment.name}
        initialDescription={segment.description || ''}
        initialRules={segment.rules}
        onSave={handleSave}
        saveLabel="Save Changes"
      />
    </div>
  );
}
