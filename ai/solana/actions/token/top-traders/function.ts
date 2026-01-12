import { getTopTradersByToken } from '@/services/birdeye';

import type { TopTokenTradersArgumentsType, TopTokenTradersResultBodyType } from './types';
import type { SolanaActionResult } from '../../solana-action';
import { recordTiming } from '@/lib/metrics';
import { capCache } from '@/lib/cache-utils';

const CACHE_TTL_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 100;
const cacheByKey = new Map<
  string,
  { timestamp: number; value: SolanaActionResult<TopTokenTradersResultBodyType> }
>();
const inflightByKey = new Map<string, Promise<SolanaActionResult<TopTokenTradersResultBodyType>>>();

export async function getTopTokenTraders(
  args: TopTokenTradersArgumentsType,
): Promise<SolanaActionResult<TopTokenTradersResultBodyType>> {
  const key = JSON.stringify({ tokenAddress: args.tokenAddress, timeFrame: args.timeFrame });
  const cached = cacheByKey.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  const inflight = inflightByKey.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const startedAt = Date.now();
    try {
      const topTraders = await getTopTradersByToken({
        address: args.tokenAddress,
        timeFrame: args.timeFrame,
        chain: 'solana',
      });

      const result = {
        message: `The top holders have been retrieved and displayed to the user. Now ask them what they want to do next. DO NOT REPEAT THE RESULTS OF THIS TOOL.`,
        body: {
          topTraders: topTraders.items,
        },
      };

      cacheByKey.set(key, { timestamp: Date.now(), value: result });
      capCache(cacheByKey, MAX_CACHE_ENTRIES);
      return result;
    } catch (error) {
      return {
        message: `Error getting top traders: ${error}`,
      };
    } finally {
      const durationMs = Date.now() - startedAt;
      recordTiming('tool.token.top-traders', durationMs);
    }
  })();

  inflightByKey.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightByKey.delete(key);
  }
}
