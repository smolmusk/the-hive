import { z } from 'zod';

export const LiquidStakingYieldsInputSchema = z.object({
  tokenSymbol: z.string().optional(),
  protocol: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
  showAll: z.boolean().optional(),
  timeHorizon: z.enum(['short', 'medium', 'long']).optional(),
  risk: z.enum(['low', 'medium', 'high']).optional(),
});
