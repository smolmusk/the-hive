import { z } from 'zod';

import { generateObject, LanguageModelV1, Message } from 'ai';

import { agents } from '@/ai/agents';
import { Agent } from '@/ai/agent';

export const system = `You are the orchestrator of a swarm of blockchain agents that each have specialized tasks.

Given this list of agents and their capabilities, choose the one that is most appropriate for the user's request.

CRITICAL ROUTING RULES:

1. **Knowledge Agent** - Use for truly exploratory/comparison queries:
   - "What are the best DeFi opportunities?" (comparing multiple strategies)
   - "How can I earn on Solana?" (open-ended exploration)
   - "What should I do with my crypto?" (needs guidance)
   - "Compare lending vs staking" (explicit comparison)
   - "Passive income opportunities" (general exploration)
   - "Best APY on Solana" (comparing across all options)
   - Users exploring what they can do without a specific strategy in mind
   - These should trigger the conversational fallback to help users discover features

2. **Lending Agent** - Use for specific lending requests:
   🚨 CRITICAL: If the message contains the word "lend" or "lending", ALWAYS use Lending Agent, even for SOL
   - "Show me the best lending pools on Solana" ← LENDING AGENT
   - "Best lending yields" ← LENDING AGENT
   - "Lending rates for USDC/USDT/SOL" ← LENDING AGENT
   - "Lend SOL to Kamino" ← LENDING AGENT (not Staking Agent!)
   - "I want to lend SOL" ← LENDING AGENT (not Staking Agent!)
   - Stablecoin lending (USDC/USDT) operations
   - Lending pools or protocols (Francium, Kamino Lend, etc.)
   - "How much can I lend?" (checks token balance)
   - "Lend my USDT/USDC/SOL"
   - Any query with "lend" keyword → Lending Agent (takes priority over token type)

3. **Staking Agent** - Use for specific staking requests:
   🚨 CRITICAL: Only use Staking Agent when the message contains "stake"/"staking", NOT when it says "lend"
   - "Show me the best staking pools" ← STAKING AGENT
   - "Best staking yields" ← STAKING AGENT
   - "Liquid staking rates" ← STAKING AGENT
   - "Stake my SOL" ← STAKING AGENT
   - "I want to stake SOL" ← STAKING AGENT
   - SOL staking/unstaking operations (ONLY when message says "stake", not "lend")
   - Liquid staking pools or tokens (LSTs)
   - "How much can I stake?" (checks SOL balance)
   - Any query with "stake" keyword → Staking Agent

4. **Wallet Agent** - Use for:
   - Token transfers
   - Checking wallet balances
   - Wallet operations

5. **Trading Agent** - Use for:
   - Trading or swapping tokens
   - Buying tokens
   - Token exchanges

6. **Market Agent** - Use for:
   - Trending tokens
   - Top traders for a timeframe
   - Trading history for a wallet

7. **Token Analysis Agent** - Use for:
   - Data about a specific token (price, volume, holders)
   - Top holders of a token
   - Price charts
   - Bubble maps (token distribution)
   - Top traders of a specific token

8. **Liquidity Agent** - Use for:
   - Liquidity pool information
   - Depositing liquidity into pools
   - User's LP tokens
   - Raydium pools

AVAILABLE AGENTS:
${agents.map((agent) => `${agent.name}: ${agent.capabilities}`).join('\n')}

When in doubt between NO AGENT and a specific agent: Return null for exploratory/comparison queries (let the conversational fallback handle it), choose specific agent only for direct actions or specific requests.

IMPORTANT: If the query is exploratory or asks about general opportunities, you MUST return null to trigger the conversational discovery flow. Do NOT force a specific agent selection for these queries.`;

export const chooseAgent = async (
  model: LanguageModelV1,
  messages: Message[],
): Promise<Agent | null> => {
  // Hard-route obvious action intent to the right agent to avoid knowledge-only replies
  const lastUserMessage = [...messages].reverse().find((msg) => msg.role === 'user');

  const normalizeContent = (content: Message['content']) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const parts = content as Array<string | { text?: string } | { type?: string; text?: string }>;
      return parts
        .map((part): string => {
          if (typeof part === 'string') return part;
          if (typeof part === 'object' && part && 'text' in part && typeof part.text === 'string') {
            return part.text;
          }
          return '';
        })
        .join(' ');
    }
    return '';
  };

  const userText = (lastUserMessage ? normalizeContent(lastUserMessage.content) : '').toLowerCase();

  const stakingIntent = /\b(restake|stake|staking|liquid[\s-]?stake)\b/i.test(userText);
  const lendingIntent =
    /\b(lend|lending|deposit|deposits|borrow|borrowing)\b/i.test(userText) ||
    /\b(compare|find)\b.*\b(yield|apy|apr)\b/i.test(userText) ||
    /\bearn(ing)?\b.*\b(yield|apy|interest)\b/i.test(userText) ||
    /\b(lending pool|lending yield|lend to)\b/i.test(userText);

  if (stakingIntent) {
    return agents.find((agent) => agent.slug === 'staking') ?? null;
  }

  if (lendingIntent) {
    return agents.find((agent) => agent.slug === 'lending') ?? null;
  }

  // Use last 5 messages for context (or all if fewer than 5)
  const contextMessages = messages.slice(-5);

  const { object } = await generateObject({
    model,
    schema: z.object({
      agent: z.enum(['none', ...agents.map((agent) => agent.name)] as [string, ...string[]]),
    }),
    messages: contextMessages,
    system,
  });

  // Return null if 'none' is selected (triggers conversational fallback)
  if (object.agent === 'none') {
    return null;
  }

  return agents.find((agent) => agent.name === object.agent) ?? null;
};
