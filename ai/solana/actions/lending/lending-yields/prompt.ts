export const LENDING_YIELDS_PROMPT = `Fetch the best Solana stablecoin lending pools.

Inputs:
- tokenSymbol (optional)
- protocol (optional, e.g., "kamino-lend")
- limit (default 3; set to 50 only when showAll is true)
- showAll (boolean, only true when user explicitly asks for all pools)
- stablecoinOnly (default true)
- risk (low|medium|high)
- timeHorizon (short|medium|long)

Filters: Solana, stablecoins, lending protocols only, positive APY.
Return ranked pools for card display (do not list pools in text).`;
