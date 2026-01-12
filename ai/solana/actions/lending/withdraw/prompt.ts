export const WITHDRAW_PROMPT = `Show the withdrawal flow for a Solana lending position.

Inputs:
- amount (token units)
- tokenAddress
- protocolAddress
- walletAddress

Use when the user asks to withdraw from a lending pool. After the tool returns, confirm the result and offer next steps; do not list pool details in text.`;
