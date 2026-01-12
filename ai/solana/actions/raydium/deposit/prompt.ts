import { SOLANA_GET_POOLS_NAME } from "../get-pools/name";

export const SOLANA_DEPOSIT_LIQUIDITY_PROMPT = `Deposit liquidity into a Raydium pool.

Inputs:
- poolId (required)
- amount (optional)

If the user needs pool choices, call ${SOLANA_GET_POOLS_NAME} first.`; 
