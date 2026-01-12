import { determineSuggestionsPrompt } from '@/app/(app)/chat/_components/follow-up-suggestions/utils';
import type { ChatMemory } from '@/lib/chat/memory';
import type { Message } from 'ai';

type Fixture = {
  name: string;
  memory: ChatMemory;
  expectedSnippets: string[];
};

const fixtures: Fixture[] = [
  {
    name: 'Prefs + last selection are embedded',
    memory: {
      lastSelection: {
        tokenSymbol: 'USDC',
        protocol: 'kamino',
        poolId: 'pool-123',
      },
      userPrefs: {
        stablecoinOnly: true,
        risk: 'low',
        timeHorizon: 'short',
      },
      profileContext: {
        walletAddress: 'So1anaWallet',
        hasBalances: true,
      },
    },
    expectedSnippets: [
      'User preferences (apply if relevant): stablecoinOnly: true, risk: low, timeHorizon: short.',
      'Last selection context: token: USDC, protocol: kamino, poolId: pool-123.',
      'continue with kamino',
      'use USDC',
    ],
  },
  {
    name: 'Stablecoin only without risk or horizon',
    memory: {
      lastSelection: {
        tokenSymbol: 'USDG',
        protocol: 'jupiter-lend',
      },
      userPrefs: {
        stablecoinOnly: true,
      },
      profileContext: {
        walletAddress: 'WalletTwo',
        hasBalances: false,
      },
    },
    expectedSnippets: [
      'User preferences (apply if relevant): stablecoinOnly: true.',
      'Last selection context: token: USDG, protocol: jupiter-lend.',
      'stablecoinOnly is true',
    ],
  },
  {
    name: 'Risk + horizon without stablecoin only',
    memory: {
      lastSelection: {
        protocol: 'marinade-liquid-staking',
        poolId: 'pool-987',
      },
      userPrefs: {
        risk: 'high',
        timeHorizon: 'long',
      },
      profileContext: {
        walletAddress: 'WalletThree',
        hasBalances: true,
      },
    },
    expectedSnippets: [
      'User preferences (apply if relevant): risk: high, timeHorizon: long.',
      'Last selection context: protocol: marinade-liquid-staking, poolId: pool-987.',
      'Align tone with risk and time horizon',
    ],
  },
];

const run = () => {
  const failures: string[] = [];
  const messages: Message[] = [
    { id: '1', role: 'user', content: 'Show me the best lending pools.' },
  ];

  fixtures.forEach((fixture) => {
    const prompt = determineSuggestionsPrompt(
      messages,
      fixture.memory.userPrefs,
      fixture.memory.lastSelection,
    );

    fixture.expectedSnippets.forEach((snippet) => {
      if (!prompt.includes(snippet)) {
        failures.push(`[${fixture.name}] missing snippet: ${snippet}`);
      }
    });
  });

  if (failures.length) {
    // eslint-disable-next-line no-console
    console.error(`validate-suggestions-prompt failed:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`validate-suggestions-prompt passed (${fixtures.length} fixtures)`);
};

run();
