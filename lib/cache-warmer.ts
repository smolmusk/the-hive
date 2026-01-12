import { getBestLendingYields } from '@/services/lending/get-best-lending-yields';
import { getJupiterPools } from '@/services/lending/get-jupiter-pools';
import { getKaminoPools } from '@/services/lending/get-kamino-pools';
import { getBestLiquidStaking } from '@/services/staking-rewards';

const WARM_INTERVAL_MS = 4 * 60 * 1000;
const NETWORK_BACKOFF_MS = 10 * 60 * 1000;

declare global {
  var __cacheWarmersStarted: boolean | undefined;
}

let skipUntil = 0;

const isNetworkFailure = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const anyError = error as { code?: string; cause?: { code?: string } };
  const code = anyError.code || anyError.cause?.code;
  return code === 'ENOTFOUND' || code === 'ECONNRESET' || code === 'ETIMEDOUT';
};

async function warmCaches() {
  await Promise.all([
    getBestLendingYields({ forceRefresh: true }),
    getBestLiquidStaking({ forceRefresh: true }),
    getKaminoPools({ forceRefresh: true }),
    getJupiterPools({ forceRefresh: true }),
  ]);
}

/**
 * Kick off background jobs that keep lending/staking caches warm so users never hit cold upstreams.
 * Safe to call multiple times; the warmer only starts once per process.
 */
export function startCacheWarmers() {
  if (typeof globalThis === 'undefined') return;
  if (process.env.NEXT_RUNTIME === 'edge') return;
  if (process.env.DISABLE_CACHE_WARMER === 'true') return;
  if (globalThis.__cacheWarmersStarted) return;

  globalThis.__cacheWarmersStarted = true;

  const run = () => {
    if (skipUntil > Date.now()) return;
    return warmCaches().catch((error) => {
      if (isNetworkFailure(error)) {
        skipUntil = Date.now() + NETWORK_BACKOFF_MS;
      }
      console.error('Cache warm-up failed:', error);
    });
  };

  // Warm immediately on boot
  void run();
  // Keep re-warming before caches expire
  setInterval(run, WARM_INTERVAL_MS);
}
