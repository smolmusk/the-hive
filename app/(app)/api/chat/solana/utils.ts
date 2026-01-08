import { LanguageModelV1, Message } from 'ai';
import { agents } from '@/ai/agents';
import { Agent } from '@/ai/agent';
import { LENDING_AGENT_NAME } from '@/ai/agents/lending/name';
import { STAKING_AGENT_NAME } from '@/ai/agents/staking/name';
import { WALLET_AGENT_NAME } from '@/ai/agents/wallet/name';
import { TRADING_AGENT_NAME } from '@/ai/agents/trading/name';
import { MARKET_AGENT_NAME } from '@/ai/agents/market/name';
import { TOKEN_ANALYSIS_AGENT_NAME } from '@/ai/agents/token-analysis/name';
import { LIQUIDITY_AGENT_NAME } from '@/ai/agents/liquidity/name';
import { KNOWLEDGE_AGENT_NAME } from '@/ai/agents/knowledge/name';
import {
  buildSolanaRouterInput,
  getSolanaRouterDecision,
  SolanaRouterDecision,
} from '@/ai/routing/solana-router';
import { buildSolanaIntentInput, getSolanaIntent, SolanaIntent } from '@/ai/routing/solana-intent';
import type { SolanaRouterContext } from '@/ai/routing/solana-router';

const ROUTER_AGENT_MAP: Record<string, string> = {
  lending: LENDING_AGENT_NAME,
  staking: STAKING_AGENT_NAME,
  wallet: WALLET_AGENT_NAME,
  trading: TRADING_AGENT_NAME,
  market: MARKET_AGENT_NAME,
  'token-analysis': TOKEN_ANALYSIS_AGENT_NAME,
  liquidity: LIQUIDITY_AGENT_NAME,
  knowledge: KNOWLEDGE_AGENT_NAME,
};

export type SolanaRouteResult = {
  agent: Agent | null;
  decision: SolanaRouterDecision;
  intent: SolanaIntent;
};

export type SolanaMemorySnapshot = Pick<
  SolanaRouterContext,
  'lastSelection' | 'userPrefs' | 'profileContext'
>;

export const routeSolanaRequest = async (
  model: LanguageModelV1,
  messages: Message[],
  options?: { walletAddress?: string; memory?: SolanaMemorySnapshot },
): Promise<SolanaRouteResult> => {
  const memory = options?.memory;
  const mergedProfileContext = memory?.profileContext
    ? {
        ...memory.profileContext,
        walletAddress: options?.walletAddress ?? memory.profileContext.walletAddress,
      }
    : options?.walletAddress
      ? { walletAddress: options.walletAddress }
      : undefined;
  const intentInput = buildSolanaIntentInput(messages, {
    walletAddress: options?.walletAddress,
    lastSelection: memory?.lastSelection,
    userPrefs: memory?.userPrefs,
    profileContext: mergedProfileContext,
  });
  const intent = await getSolanaIntent({
    model,
    lastUserText: intentInput.lastUserText,
    context: intentInput.context,
  });

  const fallbackDecision: SolanaRouterDecision = {
    agent: 'none',
    mode: 'explore',
    ui: 'text',
    toolPlan: [],
    stopCondition: 'none',
  };

  if (intent.needsClarification) {
    return { agent: null, decision: fallbackDecision, intent };
  }

  const routerInput = buildSolanaRouterInput(messages, {
    walletAddress: options?.walletAddress,
    intent,
    lastSelection: memory?.lastSelection,
    userPrefs: memory?.userPrefs,
    profileContext: mergedProfileContext,
  });
  const decision = await getSolanaRouterDecision({
    model,
    lastUserText: routerInput.lastUserText,
    context: routerInput.context,
  });

  const agentName = ROUTER_AGENT_MAP[decision.agent];
  const agent = agentName ? (agents.find((a) => a.name === agentName) ?? null) : null;

  return { agent, decision, intent };
};

export const chooseAgent = async (
  model: LanguageModelV1,
  messages: Message[],
  options?: { walletAddress?: string },
): Promise<Agent | null> => {
  const { agent } = await routeSolanaRequest(model, messages, options);
  return agent;
};
