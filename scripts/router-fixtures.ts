import type { SolanaRouterContext, SolanaRouterDecision } from '@/ai/routing/solana-router';
import {
  SOLANA_GET_WALLET_ADDRESS_ACTION,
  SOLANA_LEND_ACTION,
  SOLANA_LENDING_YIELDS_ACTION,
  SOLANA_LIQUID_STAKING_YIELDS_ACTION,
  SOLANA_TRADE_ACTION,
  SOLANA_TRANSFER_NAME,
} from '@/ai/action-names';

export type RouterFixture = {
  name: string;
  input: SolanaRouterDecision;
  expected: SolanaRouterDecision;
  context?: SolanaRouterContext;
};

export const routerFixtures: RouterFixture[] = [
  {
    name: 'Yield tool forces cards + stop condition',
    input: {
      agent: 'lending',
      mode: 'explore',
      ui: 'text',
      toolPlan: [{ tool: SOLANA_LENDING_YIELDS_ACTION, args: { limit: 50 } }],
      stopCondition: 'none',
    },
    expected: {
      agent: 'lending',
      mode: 'explore',
      ui: 'cards',
      toolPlan: [{ tool: SOLANA_LENDING_YIELDS_ACTION, args: { limit: 3 } }],
      stopCondition: 'when_first_yields_result_received',
      layout: ['card', 'summary'],
    },
  },
  {
    name: 'Yield summary uses after_tool_plan_complete',
    input: {
      agent: 'staking',
      mode: 'explore',
      ui: 'cards_then_text',
      toolPlan: [{ tool: SOLANA_LIQUID_STAKING_YIELDS_ACTION }],
      stopCondition: 'none',
    },
    expected: {
      agent: 'staking',
      mode: 'explore',
      ui: 'cards_then_text',
      toolPlan: [{ tool: SOLANA_LIQUID_STAKING_YIELDS_ACTION, args: { limit: 3 } }],
      stopCondition: 'after_tool_plan_complete',
      layout: ['card', 'text'],
    },
  },
  {
    name: 'Execution tool forces execute mode',
    input: {
      agent: 'lending',
      mode: 'explore',
      ui: 'text',
      toolPlan: [{ tool: SOLANA_LEND_ACTION, args: { tokenSymbol: 'USDC' } }],
      stopCondition: 'none',
    },
    expected: {
      agent: 'lending',
      mode: 'execute',
      ui: 'text',
      toolPlan: [{ tool: SOLANA_LEND_ACTION, args: { tokenSymbol: 'USDC' } }],
      stopCondition: 'none',
      layout: ['tool', 'text'],
    },
  },
  {
    name: 'Agent none clears tool plan',
    input: {
      agent: 'none',
      mode: 'execute',
      ui: 'cards',
      toolPlan: [{ tool: SOLANA_LENDING_YIELDS_ACTION }],
      stopCondition: 'after_tool_plan_complete',
    },
    expected: {
      agent: 'none',
      mode: 'explore',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
      layout: ['text'],
    },
  },
  {
    name: 'Execute prepends wallet tool when no wallet address',
    input: {
      agent: 'lending',
      mode: 'execute',
      ui: 'text',
      toolPlan: [{ tool: SOLANA_LEND_ACTION, args: { tokenSymbol: 'USDC' } }],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: null,
      wallet: { hasWalletAddress: false },
    },
    expected: {
      agent: 'lending',
      mode: 'execute',
      ui: 'text',
      toolPlan: [
        { tool: SOLANA_GET_WALLET_ADDRESS_ACTION },
        { tool: SOLANA_LEND_ACTION, args: { tokenSymbol: 'USDC' } },
      ],
      stopCondition: 'none',
      layout: ['tool', 'text'],
    },
  },
  {
    name: 'Clarification bypasses tools',
    input: {
      agent: 'lending',
      mode: 'execute',
      ui: 'cards',
      toolPlan: [{ tool: SOLANA_LEND_ACTION, args: { tokenSymbol: 'USDC' } }],
      stopCondition: 'after_tool_plan_complete',
    },
    context: {
      lastYield: null,
      lastAction: null,
      wallet: { hasWalletAddress: false },
      intent: {
        goal: 'explore',
        domain: 'lending',
        queryType: 'best_yields',
        confidence: 0.2,
        needsClarification: true,
        clarifyingQuestion: 'Which lending option do you want to explore?',
      },
    },
    expected: {
      agent: 'none',
      mode: 'explore',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
      layout: ['text'],
    },
  },
  {
    name: 'Intent references last action',
    input: {
      agent: 'none',
      mode: 'explore',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: {
        tool: SOLANA_LEND_ACTION,
        args: { tokenSymbol: 'USDC' },
        status: 'cancelled',
      },
      wallet: { hasWalletAddress: true },
      intent: {
        goal: 'execute',
        domain: 'lending',
        queryType: 'retry',
        confidence: 0.82,
        references: { fromLastAction: true },
      },
    },
    expected: {
      agent: 'lending',
      mode: 'execute',
      ui: 'text',
      toolPlan: [{ tool: SOLANA_LEND_ACTION, args: { tokenSymbol: 'USDC' } }],
      stopCondition: 'none',
      layout: ['tool', 'text'],
    },
  },
  {
    name: 'Intent references last trade action',
    input: {
      agent: 'none',
      mode: 'explore',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: {
        tool: SOLANA_TRADE_ACTION,
        args: {
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'USDC',
          amount: 1,
        },
        status: 'cancelled',
      },
      wallet: { hasWalletAddress: true },
      intent: {
        goal: 'execute',
        domain: 'trading',
        queryType: 'retry',
        confidence: 0.81,
        references: { fromLastAction: true },
      },
    },
    expected: {
      agent: 'trading',
      mode: 'execute',
      ui: 'text',
      toolPlan: [
        {
          tool: SOLANA_TRADE_ACTION,
          args: {
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: 'USDC',
            amount: 1,
          },
        },
      ],
      stopCondition: 'none',
      layout: ['tool', 'text'],
    },
  },
  {
    name: 'Intent references failed swap action',
    input: {
      agent: 'none',
      mode: 'explore',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: {
        tool: SOLANA_TRADE_ACTION,
        args: {
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'USDC',
          amount: 2,
        },
        status: 'failed',
      },
      wallet: { hasWalletAddress: true },
      intent: {
        goal: 'execute',
        domain: 'trading',
        queryType: 'retry',
        confidence: 0.78,
        references: { fromLastAction: true },
      },
    },
    expected: {
      agent: 'trading',
      mode: 'execute',
      ui: 'text',
      toolPlan: [
        {
          tool: SOLANA_TRADE_ACTION,
          args: {
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: 'USDC',
            amount: 2,
          },
        },
      ],
      stopCondition: 'none',
      layout: ['tool', 'text'],
    },
  },
  {
    name: 'Intent references last transfer action',
    input: {
      agent: 'none',
      mode: 'explore',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: {
        tool: SOLANA_TRANSFER_NAME,
        args: { to: '8x2dR8Mpzuz2YqyZyZjUbYWKSWesBo5jMx2Q9Y86udVk', amount: 0.1 },
        status: 'cancelled',
      },
      wallet: { hasWalletAddress: true },
      intent: {
        goal: 'execute',
        domain: 'wallet',
        queryType: 'retry',
        confidence: 0.8,
        references: { fromLastAction: true },
      },
    },
    expected: {
      agent: 'wallet',
      mode: 'execute',
      ui: 'text',
      toolPlan: [
        {
          tool: SOLANA_TRANSFER_NAME,
          args: { to: '8x2dR8Mpzuz2YqyZyZjUbYWKSWesBo5jMx2Q9Y86udVk', amount: 0.1 },
        },
      ],
      stopCondition: 'none',
      layout: ['tool', 'text'],
    },
  },
  {
    name: 'Intent references failed transfer action',
    input: {
      agent: 'none',
      mode: 'explore',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: {
        tool: SOLANA_TRANSFER_NAME,
        args: { to: '8x2dR8Mpzuz2YqyZyZjUbYWKSWesBo5jMx2Q9Y86udVk', amount: 0.25 },
        status: 'failed',
      },
      wallet: { hasWalletAddress: true },
      intent: {
        goal: 'execute',
        domain: 'wallet',
        queryType: 'retry',
        confidence: 0.77,
        references: { fromLastAction: true },
      },
    },
    expected: {
      agent: 'wallet',
      mode: 'execute',
      ui: 'text',
      toolPlan: [
        {
          tool: SOLANA_TRANSFER_NAME,
          args: { to: '8x2dR8Mpzuz2YqyZyZjUbYWKSWesBo5jMx2Q9Y86udVk', amount: 0.25 },
        },
      ],
      stopCondition: 'none',
      layout: ['tool', 'text'],
    },
  },
  {
    name: 'Intent references last yield',
    input: {
      agent: 'none',
      mode: 'explore',
      ui: 'cards',
      toolPlan: [{ tool: SOLANA_LENDING_YIELDS_ACTION, args: { limit: 3 } }],
      stopCondition: 'after_tool_plan_complete',
    },
    context: {
      lastYield: {
        tool: SOLANA_LENDING_YIELDS_ACTION,
        args: { limit: 3 },
      },
      lastAction: null,
      wallet: { hasWalletAddress: true },
      intent: {
        goal: 'decide',
        domain: 'lending',
        queryType: 'choose_from_previous',
        confidence: 0.71,
        references: { fromLastYield: true },
      },
    },
    expected: {
      agent: 'lending',
      mode: 'decide',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
      layout: ['text'],
    },
  },
  {
    name: 'Intent references last selection without tools',
    input: {
      agent: 'none',
      mode: 'explore',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: null,
      lastSelection: { tokenSymbol: 'USDC', protocol: 'kamino', poolId: 'pool-123' },
      wallet: { hasWalletAddress: true },
      intent: {
        goal: 'decide',
        domain: 'lending',
        queryType: 'choose_from_previous',
        confidence: 0.78,
        references: { fromLastSelection: true },
      },
    },
    expected: {
      agent: 'lending',
      mode: 'decide',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
      layout: ['text'],
    },
  },
  {
    name: 'Intent constraints apply to yields tool args',
    input: {
      agent: 'lending',
      mode: 'explore',
      ui: 'cards',
      toolPlan: [{ tool: SOLANA_LENDING_YIELDS_ACTION }],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: null,
      wallet: { hasWalletAddress: true },
      intent: {
        goal: 'explore',
        domain: 'lending',
        queryType: 'best_yields',
        confidence: 0.91,
        constraints: { tokenSymbol: 'USDC', protocol: 'kamino-lend' },
      },
    },
    expected: {
      agent: 'lending',
      mode: 'explore',
      ui: 'cards',
      toolPlan: [
        {
          tool: SOLANA_LENDING_YIELDS_ACTION,
          args: { tokenSymbol: 'USDC', protocol: 'kamino-lend', limit: 3 },
        },
      ],
      stopCondition: 'when_first_yields_result_received',
      layout: ['card', 'summary'],
    },
  },
  {
    name: 'User prefs fill yield tool args when missing',
    input: {
      agent: 'lending',
      mode: 'explore',
      ui: 'cards',
      toolPlan: [{ tool: SOLANA_LENDING_YIELDS_ACTION }],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: null,
      wallet: { hasWalletAddress: true },
      userPrefs: {
        stablecoinOnly: true,
        timeHorizon: 'short',
        risk: 'low',
      },
    },
    expected: {
      agent: 'lending',
      mode: 'explore',
      ui: 'cards',
      toolPlan: [
        {
          tool: SOLANA_LENDING_YIELDS_ACTION,
          args: { stablecoinOnly: true, timeHorizon: 'short', risk: 'low', limit: 3 },
        },
      ],
      stopCondition: 'when_first_yields_result_received',
      layout: ['card', 'summary'],
    },
  },
  {
    name: 'User prefs fill staking yield tool args when missing',
    input: {
      agent: 'staking',
      mode: 'explore',
      ui: 'cards',
      toolPlan: [{ tool: SOLANA_LIQUID_STAKING_YIELDS_ACTION }],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: null,
      wallet: { hasWalletAddress: true },
      userPrefs: {
        timeHorizon: 'medium',
        risk: 'high',
      },
    },
    expected: {
      agent: 'staking',
      mode: 'explore',
      ui: 'cards',
      toolPlan: [
        {
          tool: SOLANA_LIQUID_STAKING_YIELDS_ACTION,
          args: { timeHorizon: 'medium', risk: 'high', limit: 3 },
        },
      ],
      stopCondition: 'when_first_yields_result_received',
      layout: ['card', 'summary'],
    },
  },
  {
    name: 'Multi-tool plan preserves ordering',
    input: {
      agent: 'wallet',
      mode: 'execute',
      ui: 'text',
      toolPlan: [
        { tool: SOLANA_GET_WALLET_ADDRESS_ACTION },
        { tool: SOLANA_TRANSFER_NAME, args: { amount: 1, recipient: 'DemoRecipient' } },
      ],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: null,
      wallet: { hasWalletAddress: true },
    },
    expected: {
      agent: 'wallet',
      mode: 'execute',
      ui: 'text',
      toolPlan: [
        { tool: SOLANA_GET_WALLET_ADDRESS_ACTION },
        { tool: SOLANA_TRANSFER_NAME, args: { amount: 1, recipient: 'DemoRecipient' } },
      ],
      stopCondition: 'none',
      layout: ['tool', 'text'],
    },
  },
  {
    name: 'Multi-tool plan preserves trade ordering',
    input: {
      agent: 'trading',
      mode: 'execute',
      ui: 'text',
      toolPlan: [
        { tool: SOLANA_GET_WALLET_ADDRESS_ACTION },
        {
          tool: SOLANA_TRADE_ACTION,
          args: {
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: 'USDC',
            amount: 1,
          },
        },
      ],
      stopCondition: 'none',
    },
    context: {
      lastYield: null,
      lastAction: null,
      wallet: { hasWalletAddress: true },
    },
    expected: {
      agent: 'trading',
      mode: 'execute',
      ui: 'text',
      toolPlan: [
        { tool: SOLANA_GET_WALLET_ADDRESS_ACTION },
        {
          tool: SOLANA_TRADE_ACTION,
          args: {
            inputMint: 'So11111111111111111111111111111111111111112',
            outputMint: 'USDC',
            amount: 1,
          },
        },
      ],
      stopCondition: 'none',
      layout: ['tool', 'text'],
    },
  },
];
