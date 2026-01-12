import { SOLANA_GET_LP_TOKENS_NAME } from "../names";

export const SOLANA_WITHDRAW_LIQUIDITY_PROMPT = `Withdraw liquidity from a Raydium pool.

Inputs:
- lpMintAddress (required)
- amount (optional)

If the user needs LP token choices, call ${SOLANA_GET_LP_TOKENS_NAME} first.`; 
