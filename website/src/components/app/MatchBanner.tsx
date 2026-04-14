'use client';

import { useEffect, useState } from 'react';
import { WorldCupService, type MatchScore } from '@/services/WorldCupService';

export function MatchBanner() {
  const [matches, setMatches] = useState<MatchScore[]>([]);

  useEffect(() => {
    const unsub = WorldCupService.subscribeLiveMatches((data) => {
      setMatches(data);
    });
    return () => unsub();
  }, []);

  if (matches.length === 0) return null;

  return (
    <div className="bg-[rgba(232,115,74,0.1)] border-b border-[rgba(232,115,74,0.3)] py-2 px-4 flex flex-col items-center">
      <span className="text-[10px] font-bold text-[#e8734a] tracking-[2px] mb-1.5">
        WORLD CUP 2026
      </span>
      <div className="flex gap-4 justify-center w-full">
        {matches.slice(0, 2).map((m) => (
          <div
            key={m.id}
            className="flex-1 max-w-[160px] bg-glass border border-glass-border rounded-lg p-2 flex flex-col items-center"
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-text-main text-xs font-semibold flex-1 text-center truncate">
                {m.homeTeam}
              </span>
              <span className="text-text-main text-sm font-bold mx-2">
                {m.homeScore} - {m.awayScore}
              </span>
              <span className="text-text-main text-xs font-semibold flex-1 text-center truncate">
                {m.awayTeam}
              </span>
            </div>
            {m.status === 'IN_PLAY' ? (
              <span className="text-[#4ade80] text-[10px] font-bold animate-pulse">
                {m.minute ? `${m.minute}'` : 'LIVE'}
              </span>
            ) : (
              <span className="text-text-muted text-[10px] font-semibold">
                {m.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
