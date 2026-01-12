export const capCache = <K, V>(cache: Map<K, V>, maxEntries: number): void => {
  if (!Number.isFinite(maxEntries) || maxEntries <= 0) return;
  while (cache.size > maxEntries) {
    const firstKey = cache.keys().next().value as K | undefined;
    if (firstKey === undefined) break;
    cache.delete(firstKey);
  }
};

export const capList = <T>(list: T[], maxEntries: number): T[] => {
  if (!Array.isArray(list)) return list;
  if (!Number.isFinite(maxEntries) || maxEntries <= 0) return list;
  return list.length > maxEntries ? list.slice(0, maxEntries) : list;
};
