import type { SolanaIntent } from '@/ai/routing/solana-intent';
import { DEFAULT_SOLANA_INTENT_CLARIFYING_QUESTION } from '@/ai/routing/solana-intent';

export type IntentFixture = {
  name: string;
  input: SolanaIntent;
  expected: SolanaIntent;
};

export const intentFixtures: IntentFixture[] = [
  {
    name: 'Low confidence triggers clarification',
    input: {
      goal: 'explore',
      domain: 'lending',
      queryType: 'best_yields',
      confidence: 0.3,
      constraints: { stablecoinOnly: true },
    },
    expected: {
      goal: 'explore',
      domain: 'lending',
      queryType: 'best_yields',
      confidence: 0.3,
      constraints: { stablecoinOnly: true },
      assumptions: [],
      needsClarification: true,
      clarifyingQuestion: DEFAULT_SOLANA_INTENT_CLARIFYING_QUESTION,
    },
  },
  {
    name: 'Clamp confidence and normalize constraints',
    input: {
      goal: 'execute',
      domain: 'trading',
      queryType: 'swap',
      confidence: 1.2,
      assumptions: ['', 'User prefers stablecoins'],
      constraints: {
        tokenSymbol: 'usdc',
        protocol: 'Jupiter-Lend',
        amount: 25,
      },
    },
    expected: {
      goal: 'execute',
      domain: 'trading',
      queryType: 'swap',
      confidence: 1,
      assumptions: ['User prefers stablecoins'],
      constraints: {
        tokenSymbol: 'USDC',
        protocol: 'jupiter-lend',
        amount: 25,
      },
      needsClarification: false,
    },
  },
  {
    name: 'Try again references last action',
    input: {
      goal: 'execute',
      domain: 'trading',
      queryType: 'retry',
      confidence: 0.86,
      references: { fromLastAction: true },
    },
    expected: {
      goal: 'execute',
      domain: 'trading',
      queryType: 'retry',
      confidence: 0.86,
      assumptions: [],
      references: { fromLastAction: true },
      needsClarification: false,
    },
  },
  {
    name: 'Trade retry preserves references',
    input: {
      goal: 'execute',
      domain: 'trading',
      queryType: 'retry',
      confidence: 0.62,
      references: { fromLastAction: true },
    },
    expected: {
      goal: 'execute',
      domain: 'trading',
      queryType: 'retry',
      confidence: 0.62,
      assumptions: [],
      references: { fromLastAction: true },
      needsClarification: false,
    },
  },
  {
    name: 'Transfer retry preserves references',
    input: {
      goal: 'execute',
      domain: 'wallet',
      queryType: 'retry',
      confidence: 0.7,
      references: { fromLastAction: true },
    },
    expected: {
      goal: 'execute',
      domain: 'wallet',
      queryType: 'retry',
      confidence: 0.7,
      assumptions: [],
      references: { fromLastAction: true },
      needsClarification: false,
    },
  },
  {
    name: 'Out of these references last yield and selection',
    input: {
      goal: 'decide',
      domain: 'lending',
      queryType: 'choose_from_previous',
      confidence: 0.74,
      references: { fromLastYield: true, fromLastSelection: true },
    },
    expected: {
      goal: 'decide',
      domain: 'lending',
      queryType: 'choose_from_previous',
      confidence: 0.74,
      assumptions: [],
      references: { fromLastYield: true, fromLastSelection: true },
      needsClarification: false,
    },
  },
  {
    name: 'Preference constraints persist in intent output',
    input: {
      goal: 'explore',
      domain: 'lending',
      queryType: 'best_yields',
      confidence: 0.88,
      constraints: {
        risk: 'medium',
        stablecoinOnly: true,
        timeHorizon: 'long',
        limit: 12,
      },
    },
    expected: {
      goal: 'explore',
      domain: 'lending',
      queryType: 'best_yields',
      confidence: 0.88,
      assumptions: [],
      constraints: {
        risk: 'medium',
        stablecoinOnly: true,
        timeHorizon: 'long',
        limit: 12,
      },
      needsClarification: false,
    },
  },
];
