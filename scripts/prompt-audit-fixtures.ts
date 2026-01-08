import { LENDING_AGENT_NAME } from '@/ai/agents/lending/name';
import { WALLET_AGENT_NAME } from '@/ai/agents/wallet/name';
export type PromptAuditFixture = {
  agentName: string;
  requiredLines: string[];
  minMatches?: number;
};

export const promptAuditFixtures: PromptAuditFixture[] = [
  {
    agentName: WALLET_AGENT_NAME,
    requiredLines: [
      'Balances shown above. Pick a token to swap, lend, stake, or explore next.',
    ],
  },
  {
    agentName: WALLET_AGENT_NAME,
    requiredLines: ['Balances shown above. Pick a token to trade or explore next.'],
    minMatches: 2,
  },
  {
    agentName: LENDING_AGENT_NAME,
    requiredLines: [
      "You don't have any [TOKEN SYMBOL] in your wallet yet. I'm showing you funding options:",
    ],
  },
];
