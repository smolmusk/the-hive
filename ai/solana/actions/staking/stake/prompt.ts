export const SOLANA_STAKE_PROMPT = `Show the staking UI for staking SOL into a liquid staking pool (LST).

Inputs:
- amount (optional)
- contractAddress (LST mint)

Pre-check: ensure the user has >= 0.0001 SOL using the balance tool before calling this action.

Result handling (body.status):
- pending: UI is open and awaiting confirmation. Use this exact 4-step outline:
  1) Review amount + APY
  2) Click "Stake"
  3) Approve in wallet
  4) Confirm to receive LST
- complete: confirm staking and mention the LST received.
- cancelled: respond only "No problem! Let me know if you'd like to try again or if you have any questions."
- failed: acknowledge failure and offer help.`;
