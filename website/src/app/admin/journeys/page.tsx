'use client';

import { useEffect, useState } from 'react';
import { fetchJourneys, updateJourney, seedJourneys } from '@/services/AdminService';
import { Spinner } from '@/components/ui/Spinner';

const TRIGGER_LABELS: Record<string, string> = {
  user_created: 'New user sign-up',
  room_created: 'First room created',
  manual: 'Manual enrollment',
};

const DELAY_LABELS: Record<number, string> = {
  0: 'Immediately',
  3600000: '1 hour',
  86400000: '1 day',
  172800000: '2 days',
  259200000: '3 days',
  604800000: '7 days',
};

function formatDelay(ms: number): string {
  if (DELAY_LABELS[ms]) return DELAY_LABELS[ms];
  const hours = ms / 3600000;
  if (hours < 24) return `${hours}h`;
  const days = hours / 24;
  return `${days}d`;
}

export default function JourneysPage() {
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

  const handleToggle = async (id: string, currentEnabled: boolean) => {
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
        <h1 className="text-2xl font-bold text-white">Journeys</h1>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {journeys.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted mb-4">No journeys configured yet.</p>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {isSeeding && <Spinner size="sm" />}
            Seed Welcome Journey
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {journeys.map((journey: any) => {
            const steps = journey.steps
              ? Object.entries(journey.steps).sort(
                  ([a], [b]) => parseInt(a) - parseInt(b)
                )
              : [];

            return (
              <div
                key={journey.id}
                className="bg-surface rounded-xl border border-glass-border overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-glass-border/50">
                  <div>
                    <h3 className="text-sm font-medium text-white">{journey.name}</h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Trigger: {TRIGGER_LABELS[journey.trigger] || journey.trigger}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle(journey.id, journey.enabled)}
                    disabled={togglingId === journey.id}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
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

                {/* Steps visualization */}
                {steps.length > 0 && (
                  <div className="p-4">
                    <div className="flex items-start gap-0">
                      {steps.map(([idx, step]: [string, any], i: number) => (
                        <div key={idx} className="flex items-start">
                          {/* Step node */}
                          <div className="flex flex-col items-center min-w-[120px]">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                journey.enabled
                                  ? 'bg-primary/20 text-primary border border-primary/40'
                                  : 'bg-glass text-text-muted border border-glass-border'
                              }`}
                            >
                              {parseInt(idx) + 1}
                            </div>
                            <div className="mt-2 text-center">
                              <p className="text-xs font-medium text-white">
                                {step.templateId}
                              </p>
                              <p className="text-[10px] text-text-muted mt-0.5">
                                {step.channel === 'email' ? 'Email' : 'Push'}
                              </p>
                              <p className="text-[10px] text-primary mt-0.5">
                                {formatDelay(step.delayMs)}
                              </p>
                              {step.condition && (
                                <p className="text-[10px] text-warning mt-0.5">
                                  if: {step.condition}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Connector line */}
                          {i < steps.length - 1 && (
                            <div className="flex items-center mt-3.5">
                              <div
                                className={`w-8 h-px ${
                                  journey.enabled ? 'bg-primary/40' : 'bg-glass-border'
                                }`}
                              />
                              <div
                                className={`text-[10px] px-1 ${
                                  journey.enabled ? 'text-primary/60' : 'text-text-muted/40'
                                }`}
                              >
                                &rarr;
                              </div>
                              <div
                                className={`w-8 h-px ${
                                  journey.enabled ? 'bg-primary/40' : 'bg-glass-border'
                                }`}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status badge */}
                <div className="px-4 pb-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      journey.enabled
                        ? 'bg-success/20 text-success'
                        : 'bg-text-muted/20 text-text-muted'
                    }`}
                  >
                    {journey.enabled ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
