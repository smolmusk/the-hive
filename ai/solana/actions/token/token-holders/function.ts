import type { TokenHoldersArgumentsType, TokenHoldersResultBodyType } from './types';
import type { SolanaActionResult } from '../../solana-action';
import { getTokenAccountsByMint } from '@/services/helius';
import { recordTiming } from '@/lib/metrics';
import { capCache } from '@/lib/cache-utils';

const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const cacheByKey = new Map<
  string,
  { timestamp: number; value: SolanaActionResult<TokenHoldersResultBodyType> }
>();
const inflightByKey = new Map<string, Promise<SolanaActionResult<TokenHoldersResultBodyType>>>();

export async function getNumHolders(
  args: TokenHoldersArgumentsType,
): Promise<SolanaActionResult<TokenHoldersResultBodyType>> {
  const key = JSON.stringify({
    tokenAddress: args.tokenAddress,
    threshold: args.threshold ?? null,
  });
  const cached = cacheByKey.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  const inflight = inflightByKey.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const startedAt = Date.now();
    try {
      let tokenAccounts = await getTokenAccountsByMint(args.tokenAddress);

      if (args.threshold && args.threshold > 0) {
        tokenAccounts = tokenAccounts.filter((account) => account.amount >= args.threshold!);
      }

      const result = {
        message: `The number of holders have been retrieved and displayed to the user. Now ask them what they want to do next.`,
        body: {
          numHolders: tokenAccounts.length,
        },
      };

      cacheByKey.set(key, { timestamp: Date.now(), value: result });
      capCache(cacheByKey, MAX_CACHE_ENTRIES);
      return result;
    } catch (error) {
      return {
        message: `Error getting top holders: ${error}`,
      };
    } finally {
      const durationMs = Date.now() - startedAt;
      recordTiming('tool.token.holders', durationMs);
    }
  })();

  inflightByKey.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightByKey.delete(key);
  }
}
