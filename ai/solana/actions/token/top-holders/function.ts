import type { TopHoldersArgumentsType, TopHoldersResultBodyType } from './types';
import type { SolanaActionResult } from '../../solana-action';
import { getTokenLargestAccounts } from '@/services/helius';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import { recordTiming } from '@/lib/metrics';
import { capCache } from '@/lib/cache-utils';

const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const cacheByKey = new Map<
  string,
  { timestamp: number; value: SolanaActionResult<TopHoldersResultBodyType> }
>();
const inflightByKey = new Map<string, Promise<SolanaActionResult<TopHoldersResultBodyType>>>();

export async function getTopHolders(
  args: TopHoldersArgumentsType,
): Promise<SolanaActionResult<TopHoldersResultBodyType>> {
  const key = JSON.stringify({ tokenAddress: args.tokenAddress });
  const cached = cacheByKey.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }
  const inflight = inflightByKey.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const startedAt = Date.now();
    try {
      const topHolders = await getTokenLargestAccounts(args.tokenAddress);

      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);

      const mintInfo = await connection.getTokenSupply(new PublicKey(args.tokenAddress));
      const totalSupply = Number(
        BigInt(mintInfo.value.amount) / BigInt(Math.pow(10, mintInfo.value.decimals)),
      );

      const result = {
        message: `The top holders have been retrieved and displayed to the user. Now ask them what they want to do next.`,
        body: {
          topHolders: await Promise.all(
            topHolders.map(async (holder) => {
              const tokenAccount = await getAccount(connection, new PublicKey(holder.address));
              return {
                ...holder,
                owner: tokenAccount.owner.toString(),
                percentageOwned: (holder.uiAmount / totalSupply) * 100,
              };
            }),
          ),
          percentageOwned:
            topHolders.reduce((acc, holder) => acc + Number(holder.uiAmount), 0) / totalSupply,
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
      recordTiming('tool.token.top-holders', durationMs);
    }
  })();

  inflightByKey.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightByKey.delete(key);
  }
}
