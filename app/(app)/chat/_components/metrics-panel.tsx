'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

type MetricsSnapshot = Record<
  string,
  {
    count: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    lastMs: number;
    p95Ms: number;
  }
>;

const REFRESH_INTERVAL_MS = 5000;
const METRICS_PANEL_ENABLED = process.env.NEXT_PUBLIC_ENABLE_METRICS_PANEL === 'true';
const ADMIN_IDS = (process.env.NEXT_PUBLIC_METRICS_ADMIN_IDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_METRICS_ADMIN_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const formatMs = (value: number) => `${value.toFixed(0)}ms`;

const MetricsPanel: React.FC = () => {
  const { user, ready } = usePrivy();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<MetricsSnapshot>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const isAdmin = useMemo(() => {
    if (!ready || !user) return false;
    if (!ADMIN_IDS.length && !ADMIN_EMAILS.length) return false;
    if (user.id && ADMIN_IDS.includes(user.id)) return true;
    const email = user.email?.address?.toLowerCase();
    if (email && ADMIN_EMAILS.includes(email)) return true;
    return false;
  }, [ready, user]);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/metrics', { cache: 'no-store' });
      if (!res.ok) {
        setAvailable(false);
        return;
      }
      const json = (await res.json()) as MetricsSnapshot;
      setAvailable(true);
      setMetrics(json);
      setLastUpdated(new Date());
    } catch {
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    if (!METRICS_PANEL_ENABLED || !isAdmin) return;
    void fetchMetrics();
  }, [fetchMetrics, isAdmin]);

  useEffect(() => {
    if (!open || !available) return;
    const interval = setInterval(() => {
      void fetchMetrics();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open, available, fetchMetrics]);

  const entries = useMemo(
    () => Object.entries(metrics).sort(([, a], [, b]) => (b?.p95Ms || 0) - (a?.p95Ms || 0)),
    [metrics],
  );

  if (!METRICS_PANEL_ENABLED || !isAdmin) return null;
  if (!available) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full bg-neutral-900/90 text-white px-2 py-0.5 text-[10px] shadow-sm hover:bg-neutral-800"
      >
        {open ? 'Hide metrics' : 'Metrics'}
      </button>
      {open && (
        <div className="w-[320px] max-h-[60vh] overflow-auto rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-lg">
          <div className="flex items-baseline justify-between">
            <div className="font-semibold text-neutral-800">Runtime metrics</div>
            {lastUpdated ? (
              <div className="text-[10px] text-neutral-400">
                Updated {lastUpdated.toLocaleTimeString()}
              </div>
            ) : null}
          </div>
          {entries.length === 0 ? (
            <div className="text-neutral-500">No metrics yet.</div>
          ) : (
            <div className="space-y-2">
              {entries.map(([name, stats]) => (
                <div key={name} className="border-b border-neutral-100 pb-2 last:border-b-0">
                  <div className="font-medium text-neutral-900">{name}</div>
                  <div className="text-neutral-500">
                    count {stats.count} · p95 {formatMs(stats.p95Ms)} · avg {formatMs(stats.avgMs)}{' '}
                    · last {formatMs(stats.lastMs)}
                  </div>
                  <div className="text-neutral-400">
                    min {formatMs(stats.minMs)} · max {formatMs(stats.maxMs)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MetricsPanel;
