export const SOLANA_LIQUID_STAKING_YIELDS_PROMPT = `Fetch the best liquid staking yields on Solana.

Inputs:
- tokenSymbol (optional LST symbol)
- protocol (optional slug)
- limit (default 3; set to 50 only when showAll is true)
- showAll (boolean, only true when user explicitly asks for all pools)
- risk (low|medium|high)
- timeHorizon (short|medium|long)

Use when the user asks for the best place to stake SOL.`;
