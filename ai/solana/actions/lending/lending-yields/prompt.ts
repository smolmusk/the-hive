export const LENDING_YIELDS_PROMPT = `Fetch the best lending pools for stablecoins on Solana.

This action retrieves the top performing lending pools from major Solana lending protocols including:
- Kamino Finance
- Jupiter Lend
- Marginfi
- Maple Finance
- Save Finance

The action filters for:
- Solana chain only
- Stablecoin tokens (USDC, USDT, USDG, USDS, EURC, PYUSD, FDUSD, USDY)
- Lending protocols (not LP pairs)
- Pools with positive APY

Optional parameters:
- tokenSymbol: filter by token symbol (e.g., "USDC")
- protocol: filter by protocol slug (e.g., "kamino-lend", "jupiter-lend")
- limit: max number of pools to return (default 3)
- stablecoinOnly: if true, keep results to stablecoins only (default true)
- risk: user risk preference ("low", "medium", "high") for ranking guidance
- timeHorizon: user time horizon ("short", "medium", "long") for ranking guidance

Returns the top pools sorted by APY, with the highest yielding pool in the center position for optimal UI display.`;
