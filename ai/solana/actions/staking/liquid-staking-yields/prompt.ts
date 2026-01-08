export const SOLANA_LIQUID_STAKING_YIELDS_PROMPT = `Gets the best liquid staking yields on Solana in real time.

Optional parameters:
- tokenSymbol: filter by LST symbol (e.g., "JITOSOL", "MSOL")
- protocol: filter by protocol slug (e.g., "jito-liquid-staking", "marinade-liquid-staking")
- limit: max number of pools to return (default 3)
- risk: user risk preference ("low", "medium", "high") for ranking guidance
- timeHorizon: user time horizon ("short", "medium", "long") for ranking guidance

Call this tool when a user asks where the best place for them to stake their SOL is.`;
