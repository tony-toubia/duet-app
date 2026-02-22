'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJourneys, updateJourney, seedJourneys } from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';
import { AnimatedPageIcon } from '@/components/admin/AnimatedPageIcon';

const TRIGGER_LABELS: Record<string, string> = {
  user_created: 'New user sign-up',
  room_created: 'First room created',
  manual: 'Manual enrollment',
};

export default function JourneysPage() {
  const router = useRouter();
  const [journeys, setJourneys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const { journeys: data } = await fetchJourneys();
      setJourneys(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    setError(null);
    try {
      const { journeys: data } = await seedJourneys();
      setJourneys(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (e: React.MouseEvent, id: string, currentEnabled: boolean) => {
    e.stopPropagation();
    setTogglingId(id);
    setError(null);
    try {
      await updateJourney(id, { enabled: !currentEnabled });
      setJourneys((prev) =>
        prev.map((j) => (j.id === id ? { ...j, enabled: !currentEnabled } : j))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AnimatedPageIcon name="journeys" />
          <h1 className="text-2xl font-bold text-white">Journeys</h1>
        </div>
        <div className="flex gap-2">
          {journeys.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="px-3 py-2 bg-glass border border-glass-border text-text-muted rounded-lg text-sm hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSeeding && <Spinner size="sm" />}
              Seed Welcome Flow
            </button>
          )}
          <button
            onClick={() => router.push('/admin/journeys/new')}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
          >
            New Journey
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {journeys.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted mb-2">No journeys yet.</p>
          <p className="text-sm text-text-muted/60">
            Create a new journey or seed the default welcome flow.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {journeys.map((journey: any) => {
            const isFlow = !!journey.flow;
            const nodeCount = isFlow ? (journey.flow.nodes?.length || 0) : 0;
            const stepCount = !isFlow && journey.steps
              ? Object.keys(journey.steps).length
              : 0;

            return (
              <div
                key={journey.id}
                onClick={() => {
                  if (isFlow) router.push(`/admin/journeys/${journey.id}`);
                }}
                className={`bg-surface rounded-xl border border-glass-border overflow-hidden ${
                  isFlow ? 'cursor-pointer hover:border-primary/40 transition-colors' : ''
                }`}
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white">
                        {journey.name}
                      </h3>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          journey.enabled
                            ? 'bg-success/20 text-success'
                            : 'bg-text-muted/20 text-text-muted'
                        }`}
                      >
                        {journey.enabled ? 'Active' : 'Paused'}
                      </span>
                      {!isFlow && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-text-muted/20 text-text-muted">
                          Legacy
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-xs text-text-muted">
                        Trigger: {TRIGGER_LABELS[journey.trigger] || journey.trigger}
                      </p>
                      <p className="text-xs text-text-muted">
                        {isFlow ? `${nodeCount} nodes` : `${stepCount} steps`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleToggle(e, journey.id, journey.enabled)}
                    disabled={togglingId === journey.id}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      journey.enabled ? 'bg-success' : 'bg-text-muted/30'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        journey.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Mini flow preview for flow-based journeys */}
                {isFlow && journey.flow.nodes?.length > 0 && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {(journey.flow.nodes as any[])
                        .sort((a: any, b: any) => a.position.y - b.position.y)
                        .slice(0, 8)
                        .map((node: any, i: number) => (
                          <div key={node.id} className="flex items-center gap-1">
                            {i > 0 && (
                              <span className="text-text-muted/40 text-[10px]">&rarr;</span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                node.type === 'trigger'
                                  ? 'bg-success/20 text-success'
                                  : node.type === 'action'
                                  ? 'bg-primary/20 text-primary'
                                  : node.type === 'condition'
                                  ? 'bg-warning/20 text-warning'
                                  : node.type === 'delay'
                                  ? 'bg-text-muted/20 text-text-muted'
                                  : 'bg-danger/20 text-danger'
                              }`}
                            >
                              {node.type}
                            </span>
                          </div>
                        ))}
                      {(journey.flow.nodes as any[]).length > 8 && (
                        <span className="text-[10px] text-text-muted">
                          +{(journey.flow.nodes as any[]).length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Legacy steps preview */}
                {!isFlow && journey.steps && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {Object.entries(journey.steps)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([idx, step]: [string, any], i: number) => (
                          <div key={idx} className="flex items-center gap-1">
                            {i > 0 && (
                              <span className="text-text-muted/40 text-[10px]">&rarr;</span>
                            )}
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary">
                              {step.templateId}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
