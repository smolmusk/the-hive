import { getToken } from '@/db/services/tokens';
import { getPrice } from '@/services/birdeye/get-price';
import type { LendingYieldsPoolData } from '@/ai/solana/actions/lending/lending-yields/schema';

const DEFAULT_LOOPSCALE_BASE_URL = 'https://tars.loopscale.com/v1';

type LoopscaleVaultInfoResponse = {
  lendVaults: Array<{
    vault?: {
      address?: string;
      principalMint?: string;
      lpMint?: string;
      depositsEnabled?: boolean;
      cumulativePrincipalDeposited?: number;
    };
    vaultMetadata?: {
      name?: string;
      description?: string;
    };
    vaultStrategy?: {
      externalYieldInfo?: {
        apy?: number; // cBPS
      };
    };
    terms?: {
      assetTerms?: Record<
        string,
        {
          durationAndApys?: Array<[{ duration: number; durationType: number }, number]>;
        }
      >;
    };
  }>;
  total?: number;
};
type ExternalYieldInfo = {
  yieldSourceVault: string;
  principalMint: string;
  yieldSource: number;
  totalAssetShares: number;
  valuePerShare: number;
  apy: number; // cBPS
  lastUpdateTime: number;
};

type MarketStat = {
  principalMint?: string;
  netLendApy?: number; // usually cBPS in stats payloads
  apy?: number;
  suppliedUsd?: number;
};

/**
 * Fetch Loopscale lending vaults from the public API. APY is not exposed by the provided
 * endpoints, so we set yield=0 for now and estimate TVL from deposits (token units only).
 */
export async function getLoopscaleVaults(): Promise<LendingYieldsPoolData[]> {
  const baseUrl = process.env.LOOPSCALE_BASE_URL || DEFAULT_LOOPSCALE_BASE_URL;
  const priceCache = new Map<string, number>();

  // 1) Fetch vault list
  const infoRes = await fetch(`${baseUrl}/markets/lending_vaults/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      depositsEnabled: true,
      sortType: 0,
      sortDirection: 1,
      page: 0,
      pageSize: 50,
      principalMints: [],
    }),
  });

  if (!infoRes.ok) {
    throw new Error(`Loopscale lending_vaults/info failed: ${infoRes.status}`);
  }

  const infoJson = (await infoRes.json()) as LoopscaleVaultInfoResponse;
  // Debug: inspect the raw response structure (first vault) to confirm fields like APY/TVL are present
  try {
    const sample = infoJson?.lendVaults?.[0];
    if (sample) {
      console.debug(
        'Loopscale lending_vaults/info sample:',
        JSON.stringify(sample, null, 2).slice(0, 2000),
      );
    } else {
      console.debug('Loopscale lending_vaults/info returned no lendVaults');
    }
  } catch (err) {
    console.warn('⚠️ Failed to log Loopscale lending_vaults/info sample:', err);
  }
  const vaultInfo = infoJson?.lendVaults || [];
  if (!Array.isArray(vaultInfo) || vaultInfo.length === 0) {
    throw new Error('Loopscale lending_vaults/info returned no vaults');
  }

  // Fetch external yield info (APY + TVL)
  const externalRes = await fetch(`${baseUrl}/markets/external_yield/info`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!externalRes.ok) {
    throw new Error(`Loopscale external_yield/info failed: ${externalRes.status}`);
  }
  const externalJsonRaw = await externalRes.json();
  const externalJson: ExternalYieldInfo[] = Array.isArray(externalJsonRaw)
    ? externalJsonRaw
    : (externalJsonRaw as any)?.data || [];
  if (!Array.isArray(externalJson)) {
    throw new Error('Loopscale external_yield/info returned unexpected shape');
  }
  const externalByVault = new Map<string, ExternalYieldInfo>();
  for (const ey of externalJson) {
    if (ey?.yieldSourceVault) {
      externalByVault.set(ey.yieldSourceVault, ey);
    }
  }

  // Fetch market stats (may include net lend APY)
  let statsByMint = new Map<string, MarketStat>();
  try {
    const statsRes = await fetch(`${baseUrl}/markets/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        includeBorrowCaps: true,
        includePrincipal: true,
        includeStrategy: true,
        principalMints: [],
      }),
    });
    if (!statsRes.ok) {
      throw new Error(`Loopscale markets/stats failed: ${statsRes.status}`);
    }
    const statsJsonRaw = await statsRes.json();
    const map = new Map<string, MarketStat>();

    // Shape 1: array
    if (Array.isArray(statsJsonRaw)) {
      for (const s of statsJsonRaw) {
        if (s?.principalMint) {
          const apy = typeof s.netLendApy === 'number' ? s.netLendApy : s.apy;
          map.set(s.principalMint, { ...s, netLendApy: apy });
        }
      }
      const sample = statsJsonRaw?.[0];
      if (sample) {
        console.debug('Loopscale markets/stats sample (array):', JSON.stringify(sample, null, 2));
      }
    } else {
      // Shape 2: { strategy: { [mint]: { durationToWeightedAvgApy, durationToMinApy } }, principal: {...} }
      const strategy = (statsJsonRaw as any)?.strategy || (statsJsonRaw as any)?.data?.strategy;
      if (!strategy || typeof strategy !== 'object') {
        throw new Error('Loopscale markets/stats unexpected shape');
      }
      for (const [mint, stat] of Object.entries<any>(strategy)) {
        const weighted = stat?.durationToWeightedAvgApy || {};
        const min = stat?.durationToMinApy || {};
        const apyCandidates = [...Object.values(weighted), ...Object.values(min)].filter(
          (v) => typeof v === 'number' && isFinite(v),
        ) as number[];
        const best = apyCandidates.length ? Math.max(...apyCandidates) : undefined;
        map.set(mint, { principalMint: mint, netLendApy: best });
      }
      const firstKey = Object.keys(strategy)[0];
      if (firstKey) {
        console.debug(
          'Loopscale markets/stats sample (strategy obj):',
          JSON.stringify({ mint: firstKey, stat: strategy[firstKey] }, null, 2),
        );
      }
    }

    statsByMint = map;
  } catch (err) {
    console.warn('⚠️ Failed to fetch Loopscale markets/stats:', err);
    throw err;
  }

  const normalizeApyPercent = (raw?: number): number | undefined => {
    if (typeof raw !== 'number' || !isFinite(raw)) return undefined;
    if (raw <= 0) return 0;
    if (raw < 1) return raw * 100; // fractional (0.0244 => 2.44%)
    if (raw <= 100) return raw; // already percent
    if (raw <= 10000) return raw / 100; // bps
    return raw / 10000; // cbps or larger
  };

  const results: LendingYieldsPoolData[] = [];

  for (const entry of vaultInfo) {
    const vaultAddress = entry.vault?.address;
    const principalMint = entry.vault?.principalMint;
    if (!vaultAddress || !principalMint) continue;

    try {
      const tokenData = await getToken(principalMint);
      if (!tokenData || typeof tokenData.decimals !== 'number' || tokenData.decimals <= 0) {
        throw new Error(`Missing token metadata for ${principalMint}`);
      }

      // Use external yield info for TVL/APY
      const external = externalByVault.get(vaultAddress);
      if (!external) {
        throw new Error(`Missing external yield info for ${vaultAddress}`);
      }

      const stat = statsByMint.get(principalMint);
      if (!stat || typeof stat.netLendApy !== 'number') {
        throw new Error(`Missing APY (stats) for ${vaultAddress}`);
      }

      const decimals = tokenData.decimals;
      const tvlTokenUnits =
        (external.totalAssetShares * external.valuePerShare) / Math.pow(10, decimals);
      if (!isFinite(tvlTokenUnits) || tvlTokenUnits <= 0) {
        throw new Error(`No TVL found for vault ${vaultAddress}`);
      }

      // Fetch USD price if available
      let priceUsd = 0;
      if (priceCache.has(principalMint)) {
        priceUsd = priceCache.get(principalMint) || 0;
      } else {
        const price = await getPrice(principalMint);
        priceUsd = price?.value || 0;
        priceCache.set(principalMint, priceUsd);
      }
      if (!priceUsd) {
        throw new Error(`Missing price for ${principalMint}`);
      }

      const tvlUsd = tvlTokenUnits * priceUsd;
      const symbol = tokenData.symbol;

      // Derive APY strictly from stats
      const apyPercent = (() => {
        const v = normalizeApyPercent(stat.netLendApy);
        if (v === undefined || !isFinite(v) || v < 0) {
          throw new Error(`Missing APY for vault ${vaultAddress}`);
        }
        return v;
      })();

      if (!isFinite(apyPercent) || apyPercent < 0) {
        throw new Error(`Missing APY for vault ${vaultAddress}`);
      }

      console.debug(
        `Loopscale vault ${vaultAddress}: symbol=${symbol}, apy=${apyPercent.toFixed(
          4,
        )}% tvl=${tvlUsd.toFixed(2)} usd (tokenUnits=${tvlTokenUnits})`,
      );

      results.push({
        name: entry.vaultMetadata?.name || symbol,
        symbol,
        yield: apyPercent,
        apyBase: apyPercent,
        apyReward: 0,
        tvlUsd,
        project: 'loopscale',
        poolMeta: vaultAddress,
        url: undefined,
        rewardTokens: [],
        underlyingTokens: [principalMint],
        tokenMintAddress: principalMint,
        predictions: undefined,
        tokenData: tokenData
          ? {
              id: tokenData.id,
              symbol: tokenData.symbol,
              name: tokenData.name,
              decimals: tokenData.decimals,
              logoURI: tokenData.logoURI || undefined,
            }
          : null,
      });
    } catch (err) {
      console.warn(`⚠️ Skipping Loopscale vault ${vaultAddress}:`, err);
    }
  }

  return results;
}
