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
  buildSolanaRouterContext,
  buildSolanaRouterInput,
  getSolanaRouterDecision,
  normalizeSolanaRouterDecision,
  SolanaRouterDecision,
} from '@/ai/routing/solana-router';
import {
  buildSolanaIntentInput,
  getSolanaIntent,
  normalizeSolanaIntent,
  SolanaIntent,
} from '@/ai/routing/solana-intent';
import type { SolanaRouterContext } from '@/ai/routing/solana-router';
import { capCache } from '@/lib/cache-utils';
import {
  SOLANA_DEPOSIT_LIQUIDITY_NAME,
  SOLANA_GET_WALLET_ADDRESS_ACTION,
  SOLANA_LEND_ACTION,
  SOLANA_LENDING_YIELDS_ACTION,
  SOLANA_LIQUID_STAKING_YIELDS_ACTION,
  SOLANA_STAKE_ACTION,
  SOLANA_TRADE_ACTION,
  SOLANA_TRANSFER_NAME,
  SOLANA_UNSTAKE_ACTION,
  SOLANA_WITHDRAW_ACTION,
  SOLANA_WITHDRAW_LIQUIDITY_NAME,
} from '@/ai/action-names';

const ROUTER_CACHE_TTL_MS = 15 * 1000;
const MAX_ROUTER_CACHE_ENTRIES = 200;
const intentCache = new Map<string, { timestamp: number; value: SolanaIntent }>();
const decisionCache = new Map<string, { timestamp: number; value: SolanaRouterDecision }>();

const getModelCacheKey = (model: LanguageModelV1): string => {
  const anyModel = model as any;
  return String(anyModel?.modelId || anyModel?.id || anyModel?.model || 'unknown');
};

const readCache = <T>(
  cache: Map<string, { timestamp: number; value: T }>,
  key: string,
): T | null => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > ROUTER_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return cached.value;
};

const writeCache = <T>(
  cache: Map<string, { timestamp: number; value: T }>,
  key: string,
  value: T,
) => {
  cache.set(key, { timestamp: Date.now(), value });
};

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

type RouterOverride = {
  toolPlan?: Array<{ tool: string; args?: Record<string, unknown> }>;
  intent?: Partial<SolanaIntent>;
  agent?: SolanaRouterDecision['agent'];
  mode?: SolanaRouterDecision['mode'];
  ui?: SolanaRouterDecision['ui'];
  stopCondition?: SolanaRouterDecision['stopCondition'];
  layout?: SolanaRouterDecision['layout'];
};

const normalizeToolName = (toolName: unknown) =>
  String(toolName || '')
    .toLowerCase()
    .split('-')
    .join('_');

const toolMatchesAction = (toolName: unknown, action: string) => {
  const normalized = normalizeToolName(toolName);
  const normalizedAction = normalizeToolName(action);
  return normalized === normalizedAction || normalized.endsWith(`_${normalizedAction}`);
};

const isExecutionToolName = (toolName: string) =>
  toolMatchesAction(toolName, SOLANA_LEND_ACTION) ||
  toolMatchesAction(toolName, SOLANA_WITHDRAW_ACTION) ||
  toolMatchesAction(toolName, SOLANA_STAKE_ACTION) ||
  toolMatchesAction(toolName, SOLANA_UNSTAKE_ACTION) ||
  toolMatchesAction(toolName, SOLANA_TRADE_ACTION) ||
  toolMatchesAction(toolName, SOLANA_TRANSFER_NAME) ||
  toolMatchesAction(toolName, SOLANA_DEPOSIT_LIQUIDITY_NAME) ||
  toolMatchesAction(toolName, SOLANA_WITHDRAW_LIQUIDITY_NAME);

const isYieldToolName = (toolName: string) =>
  toolMatchesAction(toolName, SOLANA_LENDING_YIELDS_ACTION) ||
  toolMatchesAction(toolName, SOLANA_LIQUID_STAKING_YIELDS_ACTION);

const inferAgentFromTool = (
  toolName: string,
): SolanaRouterDecision['agent'] | null => {
  if (
    toolMatchesAction(toolName, SOLANA_LENDING_YIELDS_ACTION) ||
    toolMatchesAction(toolName, SOLANA_LEND_ACTION) ||
    toolMatchesAction(toolName, SOLANA_WITHDRAW_ACTION)
  ) {
    return 'lending';
  }
  if (
    toolMatchesAction(toolName, SOLANA_LIQUID_STAKING_YIELDS_ACTION) ||
    toolMatchesAction(toolName, SOLANA_STAKE_ACTION) ||
    toolMatchesAction(toolName, SOLANA_UNSTAKE_ACTION)
  ) {
    return 'staking';
  }
  if (toolMatchesAction(toolName, SOLANA_TRADE_ACTION)) {
    return 'trading';
  }
  if (
    toolMatchesAction(toolName, SOLANA_TRANSFER_NAME) ||
    toolMatchesAction(toolName, SOLANA_GET_WALLET_ADDRESS_ACTION)
  ) {
    return 'wallet';
  }
  if (
    toolMatchesAction(toolName, SOLANA_DEPOSIT_LIQUIDITY_NAME) ||
    toolMatchesAction(toolName, SOLANA_WITHDRAW_LIQUIDITY_NAME)
  ) {
    return 'liquidity';
  }
  return null;
};

const readRouterOverride = (messages: Message[]): RouterOverride | null => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'user') continue;
    const annotations = (message as any)?.annotations as any[] | undefined;
    if (!Array.isArray(annotations)) continue;
    const match = annotations.find(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        (entry as any).internal === true &&
        (entry as any).route === true &&
        ((entry as any).toolPlan || (entry as any).intent),
    ) as RouterOverride | undefined;
    if (match) return match;
  }
  return null;
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
  const override = readRouterOverride(messages);

  if (override) {
    const inferredAgent =
      override.agent ??
      (override.intent?.domain as SolanaRouterDecision['agent']) ??
      (override.toolPlan && override.toolPlan[0]
        ? inferAgentFromTool(override.toolPlan[0].tool)
        : null) ??
      'none';

    const inferredGoal =
      override.intent?.goal ??
      (override.toolPlan?.some((item) => isExecutionToolName(item.tool))
        ? 'execute'
        : 'explore');

    const inferredIntent = normalizeSolanaIntent({
      goal: inferredGoal,
      domain: (override.intent?.domain as SolanaIntent['domain']) ?? inferredAgent ?? 'none',
      queryType: override.intent?.queryType ?? 'explicit_action',
      constraints: override.intent?.constraints,
      assumptions: override.intent?.assumptions ?? [],
      confidence: 1,
      needsClarification: false,
      clarifyingQuestion: undefined,
      references: override.intent?.references,
    });

    const context = buildSolanaRouterContext(messages, {
      walletAddress: options?.walletAddress,
      intent: inferredIntent,
      lastSelection: memory?.lastSelection,
      userPrefs: memory?.userPrefs,
      profileContext: mergedProfileContext,
    });

    const baseDecision: SolanaRouterDecision = {
      agent: inferredAgent ?? 'none',
      mode: override.mode ?? (inferredGoal === 'execute' ? 'execute' : 'explore'),
      ui:
        override.ui ??
        (override.toolPlan?.some((item) => isYieldToolName(item.tool)) ? 'cards' : 'text'),
      toolPlan: override.toolPlan ?? [],
      stopCondition: override.stopCondition ?? 'none',
      ...(override.layout ? { layout: override.layout } : {}),
    };

    const decision = normalizeSolanaRouterDecision(baseDecision, context);
    const agentName = ROUTER_AGENT_MAP[decision.agent];
    const agent = agentName ? agents.find((a) => a.name === agentName) ?? null : null;

    return { agent, decision, intent: inferredIntent };
  }

  const intentInput = buildSolanaIntentInput(messages, {
    walletAddress: options?.walletAddress,
    lastSelection: memory?.lastSelection,
    userPrefs: memory?.userPrefs,
    profileContext: mergedProfileContext,
  });
  const intentCacheKey = JSON.stringify({
    model: getModelCacheKey(model),
    lastUserText: intentInput.lastUserText,
    context: intentInput.context,
  });
  const cachedIntent = readCache(intentCache, intentCacheKey);
  const intent =
    cachedIntent ??
    (await getSolanaIntent({
      model,
      lastUserText: intentInput.lastUserText,
      context: intentInput.context,
    }));
  if (!cachedIntent) {
    writeCache(intentCache, intentCacheKey, intent);
    capCache(intentCache, MAX_ROUTER_CACHE_ENTRIES);
  }

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
  const decisionCacheKey = JSON.stringify({
    model: getModelCacheKey(model),
    lastUserText: routerInput.lastUserText,
    context: routerInput.context,
  });
  const cachedDecision = readCache(decisionCache, decisionCacheKey);
  const decision =
    cachedDecision ??
    (await getSolanaRouterDecision({
      model,
      lastUserText: routerInput.lastUserText,
      context: routerInput.context,
    }));
  if (!cachedDecision) {
    writeCache(decisionCache, decisionCacheKey, decision);
    capCache(decisionCache, MAX_ROUTER_CACHE_ENTRIES);
  }

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
