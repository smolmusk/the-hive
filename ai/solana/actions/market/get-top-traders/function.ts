import { getTopTraders as getTopTradersBirdeye } from '@/services/birdeye';

import type { GetTopTradersArgumentsType, GetTopTradersResultBodyType } from './types';
import type { SolanaActionResult } from '../../solana-action';
import { recordTiming } from '@/lib/metrics';
import { capCache } from '@/lib/cache-utils';

const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 50;
const cacheByKey = new Map<
  string,
  { timestamp: number; value: SolanaActionResult<GetTopTradersResultBodyType> }
>();
const inflightByKey = new Map<string, Promise<SolanaActionResult<GetTopTradersResultBodyType>>>();

/**
 * Gets the trending tokens from Birdeye API.
 *
 * @param solanaKit - The Solana agent kit instance
 * @param args - The input arguments for the action
 * @returns A message containing the trending tokens information
 */
export async function getTopTraders(
  args: GetTopTradersArgumentsType,
): Promise<SolanaActionResult<GetTopTradersResultBodyType>> {
  const key = JSON.stringify({ timeFrame: args.timeFrame });
  const cached = cacheByKey.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  const inflight = inflightByKey.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const startedAt = Date.now();
    try {
      const response = await getTopTradersBirdeye(args.timeFrame);

      const result = {
        message: `Found ${response.items.length} top traders. The user is shown the traders, do not list them. Ask the user what they want to do with the traders.`,
        body: {
          traders: response.items,
        },
      };
      cacheByKey.set(key, { timestamp: Date.now(), value: result });
      capCache(cacheByKey, MAX_CACHE_ENTRIES);
      return result;
    } catch (error) {
      return {
        message: `Error getting top traders: ${error}`,
        body: {
          traders: [],
        },
      };
    } finally {
      const durationMs = Date.now() - startedAt;
      recordTiming('tool.market.top-traders', durationMs);
    }
  })();

  inflightByKey.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightByKey.delete(key);
  }
}
