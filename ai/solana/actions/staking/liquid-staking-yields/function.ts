import { getBestLiquidStaking } from '@/services/staking-rewards';

import { getTokenBySymbol } from '@/db/services';

import type { LiquidStakingYieldsResultBodyType } from './types';
import type { SolanaActionResult } from '../../solana-action';
import { LiquidStakingYieldsInputSchema } from './input-schema';
import { z } from 'zod';

const DEFAULT_LIMIT = 3;

const normalizeProtocol = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/\s+/g, '-');
  if (normalized.includes('jito')) return 'jito-liquid-staking';
  if (normalized.includes('marinade')) return 'marinade-liquid-staking';
  if (normalized.includes('drift')) return 'drift-staked-sol';
  if (normalized.includes('binance')) return 'binance-staked-sol';
  if (normalized.includes('bybit')) return 'bybit-staked-sol';
  if (normalized.includes('helius')) return 'helius-staked-sol';
  if (normalized.includes('jupiter')) return 'jupiter-staked-sol';
  if (normalized.includes('sanctum')) return 'sanctum';
  if (normalized.includes('lido')) return 'lido';
  if (normalized.includes('blaze')) return 'blazestake';
  return normalized;
};

const applyFilters = (
  pools: LiquidStakingYieldsResultBodyType,
  args: z.infer<typeof LiquidStakingYieldsInputSchema> | undefined,
) => {
  if (!args || !pools) return pools;

  const symbol = args.tokenSymbol ? args.tokenSymbol.toUpperCase() : null;
  const protocol = normalizeProtocol(args.protocol);
  let filtered = pools;

  const matchesProtocol = (project?: string | null) => {
    if (!protocol) return true;
    const normalizedProject = (project || '').toLowerCase();
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
  pools: LiquidStakingYieldsResultBodyType,
  args: z.infer<typeof LiquidStakingYieldsInputSchema> | undefined,
) => {
  if (!pools) return pools;
  const requestedLimit = args?.limit;
  const limit =
    requestedLimit && Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 50))
      : DEFAULT_LIMIT;
  return pools.slice(0, limit);
};

const buildPreferenceScorer = (
  args: z.infer<typeof LiquidStakingYieldsInputSchema> | undefined,
) => {
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
  pools: LiquidStakingYieldsResultBodyType,
  args: z.infer<typeof LiquidStakingYieldsInputSchema> | undefined,
) => {
  const scorer = buildPreferenceScorer(args);
  if (!scorer) return pools;
  return [...pools].sort((a, b) => scorer(b) - scorer(a));
};

/**
 * Gets the best liquid staking yields from Staking Rewards API.
 *
 * @returns A message containing the best liquid staking yields information
 */
export async function getLiquidStakingYields(
  args?: z.infer<typeof LiquidStakingYieldsInputSchema>,
): Promise<SolanaActionResult<LiquidStakingYieldsResultBodyType>> {
  try {
    const response = await getBestLiquidStaking();

    // Filter for Solana chains first
    const solanaPools = response.data.filter((pool) => pool.chain === 'Solana');

    // Filter for the specific Solana liquid staking protocols based on actual data
    const directLiquidStakingProtocols = [
      'jito-liquid-staking', // Jito (JITOSOL)
      'marinade-liquid-staking', // Marinade (MSOL)
      'drift-staked-sol', // Drift (DSOL)
      'binance-staked-sol', // Binance (BNSOL)
      'bybit-staked-sol', // Bybit (BBSOL)
      'helius-staked-sol', // Helius (HSOL)
      'jupiter-staked-sol', // Jupiter (JUPSOL)
      'sanctum', // Sanctum (INF, LSTs)
      'lido', // Lido (STSOL)
      'blazestake', // BlazeStake (BSOL)
    ];

    // Liquid staking tokens that appear in other protocols
    const liquidStakingTokens = [
      'MSOL', // Marinade
      'JITOSOL', // Jito
      'BSOL', // BlazeStake
      'DSOL', // Drift
      'BNSOL', // Binance
      'BBSOL', // Bybit
      'HSOL', // Helius
      'JUPSOL', // Jupiter
      'INF', // Sanctum
      'STSOL', // Lido
      'JSOL', // Jupiter
    ];

    const solLiquidStakingPools = solanaPools.filter((pool) => {
      // Check if it's a direct liquid staking protocol
      const isDirectProtocol = directLiquidStakingProtocols.includes(pool.project);
      // Check if it's a liquid staking token (but exclude LP pairs)
      const isLiquidStakingToken = liquidStakingTokens.includes(pool.symbol);

      const isLPPair = pool.symbol.includes('-') || pool.symbol.includes('/');
      const hasAPY = pool.apy && pool.apy > 0;

      // Include direct protocols OR liquid staking tokens that aren't LP pairs
      return (isDirectProtocol || isLiquidStakingToken) && !isLPPair && hasAPY;
    });

    if (solLiquidStakingPools.length === 0) {
      return {
        message: `No Solana liquid staking pools found for the target protocols (Jito, Marinade, Drift, Binance, Bybit, Helius, Jupiter, BlazeStake, Sanctum, Lido). Please try again.`,
        body: null,
      };
    }

    const sortedPools = solLiquidStakingPools.sort((a, b) => (b.apy || 0) - (a.apy || 0));

    // Transform to the expected format
    const body = await Promise.all(
      sortedPools.map(async (pool) => {
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
          predictions: pool.predictions,
          tokenData: tokenData || null,
        };
      }),
    );

    const filteredBody = applyFilters(body, args);
    const rankedBody = applyPreferenceSort(filteredBody, args);
    const limitedBody = applyLimit(rankedBody, args);

    if (limitedBody && limitedBody.length === 3) {
      const scorer = buildPreferenceScorer(args);
      const sortedByScore = limitedBody
        .slice()
        .sort((a, b) =>
          scorer ? scorer(b) - scorer(a) : (b.yield || 0) - (a.yield || 0),
        );
      const [highest, second, third] = sortedByScore;
      if (highest && second && third) {
        limitedBody[0] = second;
        limitedBody[1] = highest;
        limitedBody[2] = third;
      }
    }

    return {
      message: `Top pools are displayed as cards above. Do NOT list or repeat them in text—ask the user to pick a provider card to continue staking.`,
      body: limitedBody,
    };
  } catch (error) {
    console.error(error);
    return {
      message: `Error getting best liquid staking yields: ${error}`,
    };
  }
}
