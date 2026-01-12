import { getRaydiumPoolById } from '@/services/raydium';
import { getToken, getTokenBySymbol } from '@/db/services';
import { getTokenPairsFromAddress } from '@/services/dexscreener';

import type { GetPoolsArgumentsType, GetPoolsResultBodyType } from './types';
import type { SolanaActionResult } from '../../solana-action';
import { recordTiming } from '@/lib/metrics';
import { capCache } from '@/lib/cache-utils';

const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const cacheByKey = new Map<
  string,
  { timestamp: number; value: SolanaActionResult<GetPoolsResultBodyType> }
>();
const inflightByKey = new Map<string, Promise<SolanaActionResult<GetPoolsResultBodyType>>>();

/**
 * Gets the token data for a given ticker.
 *
 * @param connection - The Solana connection instance
 * @param args - The input arguments for the action
 * @returns A message containing the token data
 */
export async function getPools(
  args: GetPoolsArgumentsType,
): Promise<SolanaActionResult<GetPoolsResultBodyType>> {
  const key = JSON.stringify({ address: args.address ?? null, ticker: args.ticker ?? null });
  const cached = cacheByKey.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  const inflight = inflightByKey.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const startedAt = Date.now();
    try {
      if (args.address) {
        const token = await getToken(args.address);

        if (!token) throw new Error('No token data found');
        const dexscreenerPairs = await getTokenPairsFromAddress(args.address);

        const pools = await Promise.all(
          dexscreenerPairs
            .filter((pair) => pair.dexId === 'raydium')
            .map(async (pair) => {
              const raydiumPool = await getRaydiumPoolById(pair.pairAddress);
              return {
                pair,
                pool: raydiumPool,
              };
            }),
        );

        return {
          body: {
            pools,
          },
          message: `Found pools for ${args.address}. The user is shown pools in the UI, DO NOT REITERATE THE POOLS. Ask the user what they want to do next. DO NOT LIST THE POOLS IN TEXT.`,
        };
      } else if (args.ticker) {
        const token = await getTokenBySymbol(args.ticker);
        if (!token) throw new Error('No token data found');
        const dexscreenerPairs = await getTokenPairsFromAddress(token.id);
        const pools = await Promise.all(
          dexscreenerPairs
            .filter((pair) => pair.dexId === 'raydium')
            .map(async (pair) => {
              const raydiumPool = await getRaydiumPoolById(pair.pairAddress);
              return {
                pair,
                pool: raydiumPool,
              };
            }),
        );
        return {
          body: {
            pools,
          },
          message: `Found token data for ${args.ticker}. The user is shown the following token data in the UI, DO NOT REITERATE THE TOKEN DATA. Ask the user what they want to do next. DO NOT LIST THE POOLS IN TEXT.`,
        };
      } else {
        throw new Error('Invalid input');
      }
    } catch (error) {
      return {
        message: `Error getting pools: ${error}`,
      };
    } finally {
      const durationMs = Date.now() - startedAt;
      recordTiming('tool.raydium.pools', durationMs);
    }
  })();

  inflightByKey.set(key, promise);
  try {
    const result = await promise;
    if (!result.message.startsWith('Error getting pools')) {
      cacheByKey.set(key, { timestamp: Date.now(), value: result });
      capCache(cacheByKey, MAX_CACHE_ENTRIES);
    }
    return result;
  } finally {
    inflightByKey.delete(key);
  }
}
