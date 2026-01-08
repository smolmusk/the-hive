import { z } from 'zod';

export const LendingYieldsInputSchema = z.object({
  tokenSymbol: z.string().optional(),
  protocol: z.string().optional(),
  limit: z.number().int().positive().max(50).optional(),
  stablecoinOnly: z.boolean().optional(),
  timeHorizon: z.enum(['short', 'medium', 'long']).optional(),
  risk: z.enum(['low', 'medium', 'high']).optional(),
});
