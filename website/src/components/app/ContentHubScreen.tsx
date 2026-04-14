'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContentService, type ContentItem } from '@/services/ContentService';
import { LocationService } from '@/services/LocationService';
import { ContentCard } from './ContentCard';
import { Spinner } from '@/components/ui/Spinner';

export function ContentHubScreen() {
  const router = useRouter();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [items, userCity] = await Promise.all([
          ContentService.fetchContent(),
          LocationService.fetchCity(),
        ]);
        setCity(userCity);
        setContent(ContentService.filterContentByCity(items, userCity));
      } catch (e) {
        console.warn('[ContentHub] Failed to load:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleListenTogether = (item: ContentItem) => {
    // Copy the deep link to share in a room
    navigator.clipboard.writeText(item.deepLink).then(() => {
      alert('Link copied! Start a room and share with your partner.');
    });
  };

  if (isLoading) {
    return (
      <div className="h-screen-safe bg-background flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen-safe bg-background">
      {/* Header */}
      <div className="flex items-center px-5 pt-4 pb-3">
        <button
          onClick={() => router.push('/app')}
          className="bg-glass border border-glass-border rounded-2xl py-1.5 px-3.5 text-text-main text-sm font-medium hover:bg-white/20 transition-colors"
        >
          ← Back
        </button>
        <h1 className="flex-1 text-center text-text-main text-lg font-bold">
          Content Hub
        </h1>
        <div className="w-[72px]" /> {/* Spacer to center title */}
      </div>

      {/* Location badge */}
      {city && (
        <div className="px-5 mb-3">
          <span className="inline-block bg-primary/15 border border-primary/30 rounded-full px-3 py-1 text-primary text-xs font-semibold">
            📍 {city}
          </span>
        </div>
      )}

      {/* Content list */}
      <div className="px-5 pb-8 flex flex-col gap-4 max-w-2xl mx-auto">
        {content.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text-muted text-sm">
              No content available yet. Check back soon!
            </p>
          </div>
        ) : (
          content.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onListenTogether={handleListenTogether}
            />
          ))
        )}
      </div>
    </div>
  );
}
