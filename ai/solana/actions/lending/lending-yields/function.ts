import type { SolanaActionResult } from '@/ai/solana/actions/solana-action';
import { getBestLendingYields } from '@/services/lending/get-best-lending-yields';
import { getKaminoPools } from '@/services/lending/get-kamino-pools';
import { getJupiterPools } from '@/services/lending/get-jupiter-pools';
import { getTokenBySymbol } from '@/db/services/tokens';
import { LendingYieldsResultBodyType } from './schema';
import { capitalizeWords } from '@/lib/string-utils';
import { LendingYieldsInputSchema } from './input-schema';
import { z } from 'zod';
import { recordTiming } from '@/lib/metrics';
import { capList } from '@/lib/cache-utils';

let cachedLendingYields: {
  timestamp: number;
  pools: LendingYieldsResultBodyType;
} | null = null;
let inflightLendingYields: Promise<LendingYieldsResultBodyType> | null = null;

const LENDING_YIELDS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_POOL_ENTRIES = 5000;
const DEFAULT_LIMIT = 3;
const ALL_POOLS_LIMIT = 50;

const normalizeProtocol = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/\s+/g, '-');
  if (normalized.includes('jupiter')) return 'jupiter-lend';
  if (normalized.includes('kamino')) return 'kamino-lend';
  if (normalized.includes('marginfi')) return 'marginfi';
  if (normalized.includes('maple')) return 'maple';
  if (normalized.includes('save')) return 'save';
  return normalized;
};

const applyFilters = (
  pools: LendingYieldsResultBodyType,
  args: z.infer<typeof LendingYieldsInputSchema> | undefined,
) => {
  if (!args) return pools;

  const symbol = args.tokenSymbol ? args.tokenSymbol.toUpperCase() : null;
  const protocol = normalizeProtocol(args.protocol);
  let filtered = pools;

  const matchesProtocol = (project?: string | null) => {
    if (!protocol) return true;
    const normalizedProject = (project || '').toLowerCase();
    if (protocol === 'jupiter-lend') {
      return normalizedProject.includes('jupiter-lend') || normalizedProject.includes('jup-lend');
    }
    return normalizedProject.includes(protocol);
  };

  if (symbol) {
    const bySymbol = filtered.filter((pool) => (pool.symbol || '').toUpperCase() === symbol);
    filtered = bySymbol.length ? bySymbol : filtered;
  }

  if (protocol) {
    const byProtocol = filtered.filter((pool) => matchesProtocol(pool.project));
    filtered = byProtocol.length ? byProtocol : filtered;
  }

  return filtered;
};

const applyLimit = (
  pools: LendingYieldsResultBodyType,
  args: z.infer<typeof LendingYieldsInputSchema> | undefined,
) => {
  if (args?.showAll) {
    return pools.slice(0, ALL_POOLS_LIMIT);
  }
  const requestedLimit = args?.limit;
  const rounded =
    requestedLimit && Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Math.round(requestedLimit), ALL_POOLS_LIMIT))
      : DEFAULT_LIMIT;
  const limit = rounded <= DEFAULT_LIMIT ? rounded : DEFAULT_LIMIT;
  return pools.slice(0, limit);
};

const buildPreferenceScorer = (args: z.infer<typeof LendingYieldsInputSchema> | undefined) => {
  const risk = args?.risk;
  const timeHorizon = args?.timeHorizon;
  if (!risk && !timeHorizon) return null;

  let apyWeight = 1.2;
  let tvlWeight = 0.2;

  if (risk === 'low') {
    apyWeight = 0.8;
    tvlWeight = 0.7;
  } else if (risk === 'high') {
    apyWeight = 1.6;
    tvlWeight = 0.1;
  } else if (risk === 'medium') {
    apyWeight = 1.2;
    tvlWeight = 0.25;
  }

  if (timeHorizon === 'short') {
    apyWeight += 0.4;
  } else if (timeHorizon === 'long') {
    tvlWeight += 0.25;
  }

  return (pool: any) => {
    const apy = Number(pool?.yield ?? pool?.apy ?? 0);
    const tvl = Number(pool?.tvlUsd ?? 0);
    const tvlScore = Math.log10(Math.max(1, tvl + 1));
    return apyWeight * apy + tvlWeight * tvlScore;
  };
};

const applyPreferenceSort = (
  pools: LendingYieldsResultBodyType,
  args: z.infer<typeof LendingYieldsInputSchema> | undefined,
) => {
  const scorer = buildPreferenceScorer(args);
  if (!scorer) return pools;
  return [...pools].sort((a, b) => scorer(b) - scorer(a));
};

const reorderTopThreeByApy = (pools: LendingYieldsResultBodyType) => {
  if (pools.length !== 3) return pools;
  const apy = (pool: any) => Number(pool?.yield ?? pool?.apy ?? 0);
  const highestIndex = pools.reduce((bestIdx, pool, idx) => {
    return apy(pool) > apy(pools[bestIdx]) ? idx : bestIdx;
  }, 0);
  if (highestIndex === 1) return pools;
  const next = [...pools];
  const temp = next[1];
  next[1] = next[highestIndex];
  next[highestIndex] = temp;
  return next;
};

const fetchLendingPools = async (): Promise<LendingYieldsResultBodyType> => {
  if (inflightLendingYields) return inflightLendingYields;

  inflightLendingYields = (async () => {
    const startedAt = Date.now();

    try {
      const [defiLlamaResponse, kaminoPools, jupiterPools] = await Promise.all([
        getBestLendingYields(),
        getKaminoPools(),
        getJupiterPools(),
      ]);

      const solanaPools = defiLlamaResponse.data.filter((pool: any) => pool.chain === 'Solana');

      const lendingProtocols = ['kamino-lend', 'jupiter-lend', 'jup-lend'];

      const stableCoins = [
        'USDC',
        'USDT',
        'EURC',
        'FDUSD',
        'PYUSD',
        'USDS',
        'USDY',
        'USDS',
        'USDG',
      ];

      const defiLlamaPools = solanaPools.filter((pool: any) => {
        const isLendingProtocol = lendingProtocols.includes(pool.project);
        const isStableCoin = stableCoins.includes(pool.symbol);
        const isLPPair = pool.symbol.includes('-') || pool.symbol.includes('/');

        const hasAPY = pool.apy && pool.apy > 0;
        const hasUnderlyingToken = pool.underlyingTokens && pool.underlyingTokens.length > 0;

        return isLendingProtocol && !isLPPair && hasAPY && hasUnderlyingToken && isStableCoin;
      });

      const defiLlamaKaminoPools = defiLlamaPools.filter((p: any) => p.project === 'kamino-lend');
      const defiLlamaJupiterPools = defiLlamaPools.filter(
        (p: any) => p.project === 'jupiter-lend' || p.project === 'jup-lend',
      );

      const kaminoPoolsByMint = new Map<string, any>();
      const jupiterPoolsByMint = new Map<string, any>();

      const enrichPool = (basePool: any, defiLlamaPool: any) => ({
        ...basePool,
        predictions: defiLlamaPool?.predictions ?? basePool.predictions,
        rewardTokens: defiLlamaPool?.rewardTokens?.length
          ? defiLlamaPool.rewardTokens
          : basePool.rewardTokens,
        url: defiLlamaPool?.url ?? basePool.url,
      });

      kaminoPools
        .filter((pool) => {
          const isStableCoin = stableCoins.includes(pool.symbol);
          const isLPPair = pool.symbol.includes('-') || pool.symbol.includes('/');
          return pool.apy > 0 && !isLPPair && isStableCoin;
        })
        .forEach((pool) => {
          const mint = pool.mintAddress;
          if (!mint) return;

          const basePool = {
            project: 'kamino-lend',
            symbol: pool.symbol,
            tvlUsd: pool.tvlUsd,
            apyBase: pool.apyBase,
            apyReward: null,
            apy: pool.apy,
            rewardTokens: [],
            projectLogoURI: null,
            poolMeta: null,
            url: null,
            underlyingTokens: [pool.mintAddress],
            predictions: null,
          };

          const matchingDefiLlama = defiLlamaKaminoPools.find(
            (p: any) => p.underlyingTokens?.[0] === mint,
          );

          let enrichedKaminoPool = basePool;

          if (matchingDefiLlama) {
            enrichedKaminoPool = enrichPool(basePool, matchingDefiLlama);
          }

          kaminoPoolsByMint.set(mint, enrichedKaminoPool);
        });

      jupiterPools.forEach((pool) => {
        const mint = pool.mintAddress;
        if (!mint) return;

        const basePool = {
          project: 'jupiter-lend',
          symbol: pool.symbol,
          tvlUsd: pool.tvlUsd,
          apyBase: pool.apyBase,
          apyReward: null,
          apy: pool.apy,
          rewardTokens: [],
          projectLogoURI: null,
          poolMeta: pool.address ?? null,
          url: null,
          underlyingTokens: [pool.mintAddress],
          predictions: pool.predictions || null,
        };

        const matchingDefiLlama = defiLlamaJupiterPools.find(
          (p: any) => p.underlyingTokens?.[0] === mint,
        );

        let enrichedJupiterPool = basePool;

        if (matchingDefiLlama) {
          enrichedJupiterPool = enrichPool(basePool, matchingDefiLlama);
        }

        jupiterPoolsByMint.set(mint, enrichedJupiterPool);
      });

      const solLendingPools = [
        ...Array.from(kaminoPoolsByMint.values()),
        ...Array.from(jupiterPoolsByMint.values()),
      ];

      if (solLendingPools.length === 0) {
        throw new Error(
          'No Solana lending pools found for the target protocols (Kamino, Jupiter Lend, Marginfi, Maple, Save).',
        );
      }

      const mustIncludePools: any[] = [];
      const preferSymbol = 'USDC';

      const bestFromProjectForSymbol = (pools: any[], project: string, symbol: string) => {
        return pools
          .filter((p) => p.project === project && (p.symbol || '').toUpperCase() === symbol)
          .sort((a, b) => (b.apy || 0) - (a.apy || 0))[0];
      };

      const bestKaminoUSDC = bestFromProjectForSymbol(solLendingPools, 'kamino-lend', preferSymbol);
      const bestJupiterUSDC = bestFromProjectForSymbol(
        solLendingPools,
        'jupiter-lend',
        preferSymbol,
      );

      if (bestKaminoUSDC) mustIncludePools.push(bestKaminoUSDC);
      if (bestJupiterUSDC) mustIncludePools.push(bestJupiterUSDC);

      const topSolanaPools = solLendingPools.sort((a: any, b: any) => (b.apy || 0) - (a.apy || 0));
      const combined = [...mustIncludePools, ...topSolanaPools];
      const deduped = combined.filter((pool, index, arr) => {
        const key = `${pool.project}-${pool.tokenMintAddress || pool.underlyingTokens?.[0]}-${pool.symbol}`;
        return (
          index ===
          arr.findIndex(
            (p) =>
              `${p.project}-${p.tokenMintAddress || p.underlyingTokens?.[0]}-${p.symbol}` === key,
          )
        );
      });

      const dedupedSorted = deduped.sort((a: any, b: any) => (b.apy || 0) - (a.apy || 0));
      const selectedPools = dedupedSorted;

      const body = await Promise.all(
        selectedPools.map(async (pool: any) => {
          const tokenMintAddress = pool.underlyingTokens?.[0];

          if (!tokenMintAddress) {
            console.warn('⚠️ Pool missing underlyingTokens (should have been filtered):', pool);
          }

          const tokenData = await getTokenBySymbol(pool.symbol);

          return {
            name: pool.symbol,
            symbol: pool.symbol,
            yield: pool.apy || 0,
            apyBase: pool.apyBase || 0,
            apyReward: pool.apyReward || 0,
            tvlUsd: pool.tvlUsd || 0,
            project: pool.project,
            poolMeta: pool.poolMeta,
            url: pool.url,
            rewardTokens: pool.rewardTokens || [],
            underlyingTokens: pool.underlyingTokens || [],
            tokenMintAddress: tokenMintAddress,
            predictions: pool.predictions,
            tokenData: tokenData || null,
            projectLogoURI:
              pool.project === 'kamino-lend'
                ? '/logos/kamino.svg'
                : pool.project === 'jupiter-lend' || pool.project === 'jup-lend'
                  ? '/logos/jupiter.png'
                  : null,
          };
        }),
      );

      const cappedBody = capList(body, MAX_POOL_ENTRIES);
      cachedLendingYields = {
        timestamp: Date.now(),
        pools: cappedBody,
      };

      return cappedBody;
    } finally {
      const durationMs = Date.now() - startedAt;
      recordTiming('tool.lending-yields.upstream', durationMs);
      inflightLendingYields = null;
    }
  })();

  return inflightLendingYields;
};

export async function getLendingYields(
  args?: z.infer<typeof LendingYieldsInputSchema>,
): Promise<SolanaActionResult<LendingYieldsResultBodyType>> {
  try {
    if (
      cachedLendingYields &&
      Date.now() - cachedLendingYields.timestamp < LENDING_YIELDS_CACHE_TTL_MS
    ) {
      const filtered = applyFilters(cachedLendingYields.pools, args);
      return {
        message: `Fetched lending yields`,
        body: reorderTopThreeByApy(applyLimit(filtered, args)),
      };
    }

    const body = await fetchLendingPools();

    const filteredBody = applyFilters(body, args);
    const rankedBody = applyPreferenceSort(filteredBody, args);
    const limitedBody = applyLimit(rankedBody, args);
    const orderedBody = reorderTopThreeByApy(limitedBody);

    const scorer = buildPreferenceScorer(args);
    const bestPool = limitedBody.length
      ? limitedBody.reduce((best: any, current: any) => {
          if (!scorer) {
            return (current.yield || 0) > (best.yield || 0) ? current : best;
          }
          return scorer(current) > scorer(best) ? current : best;
        }, limitedBody[0])
      : null;

    const bestLabel = scorer ? 'Top match' : 'Best yield';
    const bestSummary = bestPool
      ? `${bestLabel}: ${bestPool.symbol} via ${capitalizeWords(
          bestPool.project || '',
        )} at ${(bestPool.yield || 0).toFixed(2)}% APY. `
      : 'No yields available yet. ';

    const result: SolanaActionResult<LendingYieldsResultBodyType> = {
      message: `${bestSummary}Found ${limitedBody.length} Solana lending pool${
        limitedBody.length === 1 ? '' : 's'
      }. Compare the cards (APY and TVL are shown in the UI) and pick the best fit to continue.\n\nText rules: keep to one short sentence, do NOT list pool names/symbols/APYs in text, do NOT mention other tokens unless the user asked for them, and if you suggest a different token for higher yield make it clear they must swap first. DO NOT CHECK BALANCES YET - wait for the user to select a specific pool first.`,
      body: orderedBody,
    };

    return result;
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('No Solana lending pools found')) {
      return {
        message: `${message} Please try again.`,
      };
    }
    return {
      message: `Error getting best lending yields: ${message}`,
    };
  }
}
