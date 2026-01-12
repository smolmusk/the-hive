export const SOLANA_ALL_BALANCES_PROMPT = `Get all SOL/SPL balances for a wallet.

Only call when the user explicitly asks to view their balances.
After a successful non-empty result, reply with exactly:
"Balances shown above. Pick a token to swap, lend, stake, or explore next."
Do not list balances in text.`;
