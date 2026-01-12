import type { SolanaActionResult } from '../../solana-action';
import type { GetTokenDataArgumentsType, GetTokenDataResultBodyType } from './types';
import { searchTokens, getTokenOverview } from '@/services/birdeye';
import { recordTiming } from '@/lib/metrics';
import { capCache } from '@/lib/cache-utils';

const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const cacheByKey = new Map<
  string,
  { timestamp: number; value: SolanaActionResult<GetTokenDataResultBodyType> }
>();
const inflightByKey = new Map<string, Promise<SolanaActionResult<GetTokenDataResultBodyType>>>();

export async function getTokenData(
  args: GetTokenDataArgumentsType,
): Promise<SolanaActionResult<GetTokenDataResultBodyType>> {
  const key = JSON.stringify({ search: args.search });
  const cached = cacheByKey.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  const inflight = inflightByKey.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const startedAt = Date.now();
    try {
      const { items } = await searchTokens({
        keyword: args.search,
        target: 'token',
        sort_by: 'volume_24h_usd',
        sort_type: 'desc',
        offset: 0,
        limit: 10,
      });

      const token = items?.[0]?.result?.[0];

      if (!token) {
        return {
          message: `No token found for ${args.search}`,
        };
      }

      const result = {
        message: `Token data for ${args.search}`,
        body: {
          token: await getTokenOverview(token.address),
        },
      };

      cacheByKey.set(key, { timestamp: Date.now(), value: result });
      capCache(cacheByKey, MAX_CACHE_ENTRIES);
      return result;
    } catch (error) {
      console.error(error);
      return {
        message: `Error getting token data: ${error}`,
      };
    } finally {
      const durationMs = Date.now() - startedAt;
      recordTiming('tool.token.data', durationMs);
    }
  })();

  inflightByKey.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightByKey.delete(key);
  }
}
