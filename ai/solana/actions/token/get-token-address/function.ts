import { resolveAssetSymbolToAddress } from '@/services/tokens/resolve-asset-symbol-to-address';

import type { SolanaActionResult } from '../../solana-action';
import type { GetTokenAddressArgumentsType, GetTokenAddressResultBodyType } from './types';
import { recordTiming } from '@/lib/metrics';
import { capCache } from '@/lib/cache-utils';

const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const cacheByKey = new Map<
  string,
  { timestamp: number; value: SolanaActionResult<GetTokenAddressResultBodyType> }
>();
const inflightByKey = new Map<string, Promise<SolanaActionResult<GetTokenAddressResultBodyType>>>();

export async function getTokenAddress(
  args: GetTokenAddressArgumentsType,
): Promise<SolanaActionResult<GetTokenAddressResultBodyType>> {
  const key = JSON.stringify({ keyword: args.keyword });
  const cached = cacheByKey.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  const inflight = inflightByKey.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const startedAt = Date.now();
    try {
      const address = await resolveAssetSymbolToAddress(args.keyword, 'solana');
      if (!address) {
        throw new Error('Failed to resolve token address');
      }

      const result = {
        message: `Found token address for ${args.keyword}. The user is shown the following token address in the UI, DO NOT REITERATE THE TOKEN ADDRESS. Ask the user what they want to do next.`,
        body: {
          address,
        },
      };
      cacheByKey.set(key, { timestamp: Date.now(), value: result });
      capCache(cacheByKey, MAX_CACHE_ENTRIES);
      return result;
    } catch (error) {
      return {
        message: `Error getting token data: ${error}`,
      };
    } finally {
      const durationMs = Date.now() - startedAt;
      recordTiming('tool.token.address', durationMs);
    }
  })();

  inflightByKey.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightByKey.delete(key);
  }
}
