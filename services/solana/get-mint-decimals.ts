import { Connection, PublicKey } from '@solana/web3.js';
import { capCache } from '@/lib/cache-utils';

const mintDecimalsCache = new Map<string, number>();
const MAX_CACHE_ENTRIES = 500;

/**
 * Fetch mint decimals from chain (cached). Throws if the mint cannot be parsed.
 */
export async function getMintDecimals(mintAddress: string): Promise<number> {
  if (mintDecimalsCache.has(mintAddress)) {
    return mintDecimalsCache.get(mintAddress)!;
  }

  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    process.env.SOLANA_RPC_URL ||
    'https://api.mainnet-beta.solana.com';

  const connection = new Connection(rpcUrl);
  const pubkey = new PublicKey(mintAddress);

  const accountInfo = await connection.getParsedAccountInfo(pubkey);
  const parsed: any = accountInfo.value?.data;
  const decimals = parsed?.parsed?.info?.decimals;

  if (typeof decimals !== 'number' || !Number.isFinite(decimals)) {
    throw new Error(`Unable to fetch decimals for mint ${mintAddress}`);
  }

  mintDecimalsCache.set(mintAddress, decimals);
  capCache(mintDecimalsCache, MAX_CACHE_ENTRIES);
  return decimals;
}
