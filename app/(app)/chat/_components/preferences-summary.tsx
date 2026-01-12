'use client';

import React from 'react';
import { Badge } from '@/components/ui';
import type { ChatMemory } from '@/lib/chat/memory';

type UserPrefs = NonNullable<ChatMemory['userPrefs']>;

const formatPref = (value?: string) => (value ? value[0]?.toUpperCase() + value.slice(1) : null);

const PreferencesSummary: React.FC<{ prefs?: ChatMemory['userPrefs'] | null }> = ({ prefs }) => {
  if (!prefs) return null;

  const riskLabel = formatPref(prefs.risk);
  const timeHorizonLabel = formatPref(prefs.timeHorizon);
  const hasAny = Boolean(riskLabel || timeHorizonLabel);

  if (!hasAny) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
      <span className="text-[11px] uppercase tracking-wide text-neutral-400">Preferences</span>
      {riskLabel ? <Badge variant="secondary">Risk: {riskLabel}</Badge> : null}
      {timeHorizonLabel ? <Badge variant="secondary">Horizon: {timeHorizonLabel}</Badge> : null}
    </div>
  );
};

export default PreferencesSummary;
