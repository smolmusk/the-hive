export const SOLANA_UNSTAKE_PROMPT = `Unstake from a liquid staking pool (or show the guidance card).

Inputs:
- amount (optional)
- contractAddress (optional; if missing, call anyway to render guidance)

If the user provides a symbol, resolve it; otherwise call with empty contractAddress and let the UI guide them.`;
