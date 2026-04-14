'use client';

import type { ContentItem } from '@/services/ContentService';

interface ContentCardProps {
  item: ContentItem;
  onListenTogether: (item: ContentItem) => void;
}

export function ContentCard({ item, onListenTogether }: ContentCardProps) {
  const handleOpen = () => {
    window.open(item.deepLink, '_blank', 'noopener');
  };

  return (
    <div className="bg-glass border border-glass-border rounded-2xl overflow-hidden flex flex-row">
      {item.image && (
        <img
          src={item.image}
          alt={item.title}
          className="w-[100px] h-full object-cover bg-[#3d3d50]"
        />
      )}
      <div className="flex-1 p-4 flex flex-col">
        <span className="text-primary text-[10px] font-bold tracking-wider mb-1">
          {item.type.replace('_', ' ').toUpperCase()}
        </span>
        <h3 className="text-text-main text-base font-bold mb-1 line-clamp-2">
          {item.title}
        </h3>
        {item.city && (
          <span className="text-text-muted text-xs italic mb-3">
            Localized for {item.city}
          </span>
        )}
        <div className="flex gap-2.5 mt-auto">
          <button
            onClick={handleOpen}
            className="bg-glass border border-glass-border px-4 py-2 rounded-full text-text-main text-xs font-semibold hover:bg-white/20 transition-colors"
          >
            Open
          </button>
          <button
            onClick={() => onListenTogether(item)}
            className="bg-primary px-4 py-2 rounded-full text-white text-xs font-semibold hover:bg-primary-light transition-colors"
          >
            Listen Together
          </button>
        </div>
      </div>
    </div>
  );
}
