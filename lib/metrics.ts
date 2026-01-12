type MetricEntry = {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
  lastUpdatedAt: number;
  samples: number[];
};

const MAX_SAMPLES = 200;
const MAX_METRIC_ENTRIES = 200;
const metrics = new Map<string, MetricEntry>();

const capMetrics = () => {
  while (metrics.size > MAX_METRIC_ENTRIES) {
    const firstKey = metrics.keys().next().value as string | undefined;
    if (firstKey === undefined) break;
    metrics.delete(firstKey);
  }
};

export const recordTiming = (name: string, durationMs: number): void => {
  if (!name || !Number.isFinite(durationMs)) return;

  const now = Date.now();
  const entry = metrics.get(name) ?? {
    count: 0,
    totalMs: 0,
    minMs: durationMs,
    maxMs: durationMs,
    lastMs: durationMs,
    lastUpdatedAt: now,
    samples: [],
  };

  entry.count += 1;
  entry.totalMs += durationMs;
  entry.lastMs = durationMs;
  entry.lastUpdatedAt = now;
  entry.minMs = Math.min(entry.minMs, durationMs);
  entry.maxMs = Math.max(entry.maxMs, durationMs);

  entry.samples.push(durationMs);
  if (entry.samples.length > MAX_SAMPLES) {
    entry.samples.shift();
  }

  metrics.set(name, entry);
  capMetrics();
};

const percentile = (values: number[], pct: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
  return sorted[index];
};

const buildSnapshot = (entry: MetricEntry) => {
  const avgMs = entry.count ? entry.totalMs / entry.count : 0;
  return {
    count: entry.count,
    avgMs: Number(avgMs.toFixed(2)),
    minMs: Number(entry.minMs.toFixed(2)),
    maxMs: Number(entry.maxMs.toFixed(2)),
    lastMs: Number(entry.lastMs.toFixed(2)),
    p95Ms: Number(percentile(entry.samples, 95).toFixed(2)),
  };
};

const aggregateEntries = (entries: MetricEntry[]): MetricEntry | null => {
  if (!entries.length) return null;
  const aggregate: MetricEntry = {
    count: 0,
    totalMs: 0,
    minMs: Number.POSITIVE_INFINITY,
    maxMs: 0,
    lastMs: 0,
    lastUpdatedAt: 0,
    samples: [],
  };

  entries.forEach((entry) => {
    aggregate.count += entry.count;
    aggregate.totalMs += entry.totalMs;
    aggregate.minMs = Math.min(aggregate.minMs, entry.minMs);
    aggregate.maxMs = Math.max(aggregate.maxMs, entry.maxMs);
    if (entry.lastUpdatedAt >= aggregate.lastUpdatedAt) {
      aggregate.lastUpdatedAt = entry.lastUpdatedAt;
      aggregate.lastMs = entry.lastMs;
    }
    aggregate.samples.push(...entry.samples);
  });

  return aggregate;
};

export const getMetricsSnapshot = (): Record<
  string,
  {
    count: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    lastMs: number;
    p95Ms: number;
  }
> => {
  const snapshot: Record<string, any> = {};

  const toolEntries: Array<[string, MetricEntry]> = [];

  for (const [name, entry] of metrics.entries()) {
    snapshot[name] = buildSnapshot(entry);
    if (name.startsWith('tool.')) {
      toolEntries.push([name, entry]);
    }
  }

  if (toolEntries.length) {
    const aggregate = aggregateEntries(toolEntries.map(([, entry]) => entry));
    if (aggregate && !snapshot['tool.all']) {
      snapshot['tool.all'] = buildSnapshot(aggregate);
    }

    const grouped = new Map<string, MetricEntry[]>();
    toolEntries.forEach(([name, entry]) => {
      const remainder = name.slice('tool.'.length);
      const group = remainder.split('.')[0];
      if (!group) return;
      const existing = grouped.get(group) ?? [];
      existing.push(entry);
      grouped.set(group, existing);
    });

    grouped.forEach((entries, group) => {
      if (entries.length < 2) return;
      const aggregateGroup = aggregateEntries(entries);
      const key = `tool.${group}.all`;
      if (!aggregateGroup || snapshot[key]) return;
      snapshot[key] = buildSnapshot(aggregateGroup);
    });
  }

  return snapshot;
};

export const resetMetrics = (): void => {
  metrics.clear();
};
