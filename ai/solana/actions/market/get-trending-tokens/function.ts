import { getTrendingTokens as getTrendingTokensBirdeye } from '@/services/birdeye';

import type { GetTrendingTokensArgumentsType, GetTrendingTokensResultBodyType } from './types';
import type { SolanaActionResult } from '../../solana-action';
import { recordTiming } from '@/lib/metrics';
import { capCache } from '@/lib/cache-utils';

const CACHE_TTL_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 50;
const cacheByKey = new Map<
  string,
  { timestamp: number; value: SolanaActionResult<GetTrendingTokensResultBodyType> }
>();
const inflightByKey = new Map<
  string,
  Promise<SolanaActionResult<GetTrendingTokensResultBodyType>>
>();

/**
 * Gets the trending tokens from Birdeye API.
 *
 * @param solanaKit - The Solana agent kit instance
 * @param args - The input arguments for the action
 * @returns A message containing the trending tokens information
 */
export async function getTrendingTokens(
  args: GetTrendingTokensArgumentsType,
): Promise<SolanaActionResult<GetTrendingTokensResultBodyType>> {
  const key = JSON.stringify({ limit: args.limit });
  const cached = cacheByKey.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  const inflight = inflightByKey.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const startedAt = Date.now();
    try {
      const response = await getTrendingTokensBirdeye(0, args.limit);

      const result = {
        message: `Found ${response.tokens.length} trending tokens. The user is shown the tokens, do not list them. Ask the user what they want to do with the coin.`,
        body: {
          tokens: response.tokens,
        },
      };
      cacheByKey.set(key, { timestamp: Date.now(), value: result });
      capCache(cacheByKey, MAX_CACHE_ENTRIES);
      return result;
    } catch (error) {
      return {
        message: `Error getting trending tokens: ${error}`,
        body: {
          tokens: [],
        },
      };
    } finally {
      const durationMs = Date.now() - startedAt;
      recordTiming('tool.market.trending-tokens', durationMs);
    }
  })();

  inflightByKey.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightByKey.delete(key);
  }
}
