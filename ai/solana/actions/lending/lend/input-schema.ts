import { z } from 'zod';

export const LendInputSchema = z.object({
  tokenAddress: z.string().describe('The contract address of the token to lend'),
  tokenSymbol: z.string().describe('The symbol of the token to lend (e.g., "USDC", "USDT")'),
  protocolAddress: z
    .string()
    .optional()
    .describe('The contract address or slug of the lending protocol (optional if unknown)'),
  protocol: z.string().describe('The name of the lending protocol (e.g., "kamino")'),
  amount: z.number().positive().optional().describe('The amount to lend (optional)'),
  walletAddress: z.string().describe('The wallet address to lend from'),
});
