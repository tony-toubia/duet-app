'use client';

interface ParticipantInfo {
  uid: string;
  isSpeaking: boolean;
  isMuted: boolean;
  connectionState: string;
}

interface ParticipantGridProps {
  participants: ParticipantInfo[];
}

export function ParticipantGrid({ participants }: ParticipantGridProps) {
  return (
    <div className="flex flex-wrap justify-center gap-5 py-5 px-2.5">
      {participants.map((p, i) => (
        <div key={p.uid} className="flex flex-col items-center w-[100px]">
          <div className="relative">
            {p.isSpeaking && (
              <>
                <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute -inset-2 rounded-full bg-primary/15 animate-pulse" style={{ animationDuration: '2s' }} />
              </>
            )}
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white transition-all duration-300 ${
                p.isSpeaking
                  ? 'bg-primary scale-110'
                  : 'bg-glass border border-glass-border'
              }`}
            >
              {p.isMuted ? '🔇' : `P${i + 1}`}
            </div>
          </div>
          <span
            className={`mt-2 text-[10px] font-bold ${
              p.connectionState === 'connected'
                ? 'text-success'
                : 'text-warning'
            }`}
          >
            {p.connectionState}
          </span>
        </div>
      ))}
    </div>
  );
}
