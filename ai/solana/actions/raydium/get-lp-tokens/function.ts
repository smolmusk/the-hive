import { getLpTokensByAddress } from '@/services/raydium';

import type { GetLpTokensArgumentsType, GetLpTokensResultBodyType } from './types';
import type { SolanaActionResult } from '../../solana-action';
import { recordTiming } from '@/lib/metrics';
import { capCache } from '@/lib/cache-utils';

const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const cacheByKey = new Map<
  string,
  { timestamp: number; value: SolanaActionResult<GetLpTokensResultBodyType> }
>();
const inflightByKey = new Map<string, Promise<SolanaActionResult<GetLpTokensResultBodyType>>>();

/**
 * Gets the token data for a given ticker.
 *
 * @param connection - The Solana connection instance
 * @param args - The input arguments for the action
 * @returns A message containing the token data
 */
export async function getLpTokens(
  args: GetLpTokensArgumentsType,
): Promise<SolanaActionResult<GetLpTokensResultBodyType>> {
  const key = JSON.stringify({ address: args.address });
  const cached = cacheByKey.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  const inflight = inflightByKey.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const startedAt = Date.now();
    try {
      const lpTokens = await getLpTokensByAddress(args.address);

      const result = {
        body: {
          lpTokens,
        },
        message: `Successfully retrieved ${lpTokens.length} LP Tokens for address ${args.address}. DO NOT REITERATE THESE POOLS, THE USER IS SHOWN THEM IN THE UI.`,
      };
      cacheByKey.set(key, { timestamp: Date.now(), value: result });
      capCache(cacheByKey, MAX_CACHE_ENTRIES);
      return result;
    } catch (error) {
      return {
        message: `Failed to retrieve LP Tokens for address ${args.address}`,
      };
    } finally {
      const durationMs = Date.now() - startedAt;
      recordTiming('tool.raydium.lp-tokens', durationMs);
    }
  })();

  inflightByKey.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightByKey.delete(key);
  }
}
