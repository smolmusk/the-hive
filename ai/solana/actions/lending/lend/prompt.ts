export const LEND_PROMPT = `Show the lending UI for a selected stablecoin pool on Solana.

Inputs:
- amount (optional)
- tokenAddress
- protocolAddress (optional if unknown)
- walletAddress

Pre-check: ensure the user has >= 0.0001 SOL using the balance tool before calling this action.

Result handling (body.status):
- pending: UI is open and awaiting confirmation. Do NOT say "pending" or "initiated". Use this exact 4-step outline:
  1) Review amount + APY
  2) Click "Lend"
  3) Approve in wallet
  4) Confirm to start earning
- complete: confirm deposit, mention APY earnings, and that they can withdraw later.
- cancelled: respond only "No problem! Let me know if you'd like to try again or if you have any questions."
- failed: acknowledge failure and offer help.

Do not mention connecting wallets or selecting pools; the UI already shows the chosen pool.`;
