import { CoreMessage, generateObject, LanguageModelV1, Message } from 'ai';
import { z } from 'zod';
import type { SolanaIntent } from '@/ai/routing/solana-intent';
import {
  SOLANA_LEND_ACTION,
  SOLANA_LENDING_YIELDS_ACTION,
  SOLANA_LIQUID_STAKING_YIELDS_ACTION,
  SOLANA_DEPOSIT_LIQUIDITY_NAME,
  SOLANA_GET_WALLET_ADDRESS_ACTION,
  SOLANA_STAKE_ACTION,
  SOLANA_TRADE_ACTION,
  SOLANA_TRANSFER_NAME,
  SOLANA_ALL_BALANCES_NAME,
  SOLANA_UNSTAKE_ACTION,
  SOLANA_WITHDRAW_ACTION,
  SOLANA_WITHDRAW_LIQUIDITY_NAME,
} from '@/ai/action-names';

export type RouterAgentKey =
  | 'lending'
  | 'staking'
  | 'wallet'
  | 'trading'
  | 'market'
  | 'token-analysis'
  | 'liquidity'
  | 'knowledge'
  | 'none';
export type RouterMode = 'explore' | 'decide' | 'execute';
export type RouterUi = 'cards' | 'cards_then_text' | 'text';
export type RouterStopCondition =
  | 'when_first_yields_result_received'
  | 'after_tool_plan_complete'
  | 'none';

export type RouterToolPlanItem = {
  tool: string;
  args?: Record<string, unknown>;
};

export type SolanaRouterDecision = {
  agent: RouterAgentKey;
  mode: RouterMode;
  ui: RouterUi;
  toolPlan: RouterToolPlanItem[];
  stopCondition: RouterStopCondition;
  layout?: Array<'text' | 'tool' | 'summary'>;
};

const RouterToolPlanItemSchema = z.object({
  tool: z.string(),
  args: z.record(z.any()).optional(),
});

export const SolanaRouterDecisionSchema = z.object({
  agent: z.enum([
    'lending',
    'staking',
    'wallet',
    'trading',
    'market',
    'token-analysis',
    'liquidity',
    'knowledge',
    'none',
  ]),
  mode: z.enum(['explore', 'decide', 'execute']),
  ui: z.enum(['cards', 'cards_then_text', 'text']),
  toolPlan: z.array(RouterToolPlanItemSchema).default([]),
  stopCondition: z
    .enum(['when_first_yields_result_received', 'after_tool_plan_complete', 'none'])
    .default('none'),
  layout: z.array(z.enum(['text', 'tool', 'summary'])).optional(),
});

type YieldPoolSample = {
  symbol: string;
  project?: string;
  apy?: number;
  tvlUsd?: number;
  tokenMintAddress?: string;
};

export type SolanaRouterContext = {
  lastYield: {
    tool: string;
    args?: Record<string, unknown>;
    pools?: YieldPoolSample[];
  } | null;
  lastAction: {
    tool: string;
    args?: Record<string, unknown>;
    status?: string;
  } | null;
  lastSelection?: {
    tokenSymbol?: string;
    protocol?: string;
    poolId?: string;
  } | null;
  userPrefs?: {
    risk?: 'low' | 'medium' | 'high';
    stablecoinOnly?: boolean;
    timeHorizon?: 'short' | 'medium' | 'long';
  } | null;
  profileContext?: {
    walletAddress?: string;
    hasBalances?: boolean;
  } | null;
  wallet: {
    hasWalletAddress: boolean;
  };
  intent?: SolanaIntent;
};

type ToolInvocation = {
  toolName?: string;
  state?: string;
  args?: unknown;
  result?: unknown;
};

const isInternalUserMessage = (message: Message | undefined): boolean => {
  if (!message || message.role !== 'user') return false;
  const annotations = (message as any)?.annotations;
  if (!Array.isArray(annotations)) return false;
  return annotations.some((a) => a && typeof a === 'object' && (a as any).internal === true);
};

const extractToolInvocations = (message: Message | undefined): ToolInvocation[] => {
  if (!message) return [];
  const anyMessage = message as any;

  if (Array.isArray(anyMessage.parts)) {
    return (anyMessage.parts as any[])
      .filter((part) => part && part.type === 'tool-invocation' && part.toolInvocation)
      .map((part) => part.toolInvocation as ToolInvocation);
  }

  const legacy = anyMessage.toolInvocations as ToolInvocation[] | undefined;
  return legacy ?? [];
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

const defaultLayoutForUI = (
  ui: SolanaRouterDecision['ui'],
): NonNullable<SolanaRouterDecision['layout']> => {
  if (ui === 'cards') return ['tool'];
  if (ui === 'cards_then_text') return ['tool', 'text'];
  return ['text'];
};

const applyLayoutDefaults = (decision: SolanaRouterDecision): SolanaRouterDecision => ({
  ...decision,
  layout: decision.layout ?? defaultLayoutForUI(decision.ui),
});

const lastUserText = (messages: Message[]): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;
    if (isInternalUserMessage(msg)) continue;
    return typeof msg.content === 'string' ? msg.content : String(msg.content ?? '');
  }
  return '';
};

const summarizeYieldPools = (body: unknown): YieldPoolSample[] => {
  if (!Array.isArray(body)) return [];
  return body
    .slice(0, 6)
    .map((pool: any) => ({
      symbol: String(pool?.tokenData?.symbol || pool?.symbol || '').toUpperCase(),
      project: pool?.project ? String(pool.project) : undefined,
      apy: Number.isFinite(pool?.yield) ? Number(pool.yield) : undefined,
      tvlUsd: Number.isFinite(pool?.tvlUsd) ? Number(pool.tvlUsd) : undefined,
      tokenMintAddress: String(pool?.tokenMintAddress || pool?.tokenData?.id || ''),
    }))
    .filter((pool) => pool.symbol);
};

const selectionFromAction = (
  toolName: string,
  args: Record<string, unknown> | undefined,
): SolanaRouterContext['lastSelection'] => {
  if (!args || typeof args !== 'object') return null;
  const anyArgs = args as Record<string, any>;

  if (toolMatchesAction(toolName, SOLANA_LEND_ACTION) || toolMatchesAction(toolName, SOLANA_WITHDRAW_ACTION)) {
    const tokenSymbol =
      typeof anyArgs.tokenSymbol === 'string' ? anyArgs.tokenSymbol.toUpperCase() : undefined;
    const protocol =
      typeof anyArgs.protocol === 'string' ? anyArgs.protocol.toLowerCase() : undefined;
    const poolId =
      typeof anyArgs.protocolAddress === 'string'
        ? anyArgs.protocolAddress
        : typeof anyArgs.tokenAddress === 'string'
          ? anyArgs.tokenAddress
          : undefined;
    return tokenSymbol || protocol || poolId ? { tokenSymbol, protocol, poolId } : null;
  }

  if (toolMatchesAction(toolName, SOLANA_STAKE_ACTION)) {
    const poolData = anyArgs.poolData || {};
    const tokenSymbol =
      typeof poolData.symbol === 'string' ? String(poolData.symbol).toUpperCase() : undefined;
    const protocol =
      typeof poolData.project === 'string' ? String(poolData.project).toLowerCase() : undefined;
    const poolId = typeof anyArgs.contractAddress === 'string' ? anyArgs.contractAddress : undefined;
    return tokenSymbol || protocol || poolId ? { tokenSymbol, protocol, poolId } : null;
  }

  if (toolMatchesAction(toolName, SOLANA_UNSTAKE_ACTION)) {
    const poolId = typeof anyArgs.contractAddress === 'string' ? anyArgs.contractAddress : undefined;
    return poolId ? { poolId } : null;
  }

  if (toolMatchesAction(toolName, SOLANA_DEPOSIT_LIQUIDITY_NAME)) {
    const poolId = typeof anyArgs.poolId === 'string' ? anyArgs.poolId : undefined;
    return poolId ? { poolId } : null;
  }

  if (toolMatchesAction(toolName, SOLANA_WITHDRAW_LIQUIDITY_NAME)) {
    const poolId = typeof anyArgs.mint === 'string' ? anyArgs.mint : undefined;
    return poolId ? { poolId } : null;
  }

  return null;
};

const prefsFromIntent = (
  intent?: SolanaIntent,
): SolanaRouterContext['userPrefs'] => {
  const constraints = intent?.constraints;
  if (!constraints) return null;
  const prefs: NonNullable<SolanaRouterContext['userPrefs']> = {};
  if (constraints.risk) {
    prefs.risk = constraints.risk;
  }
  if (typeof constraints.stablecoinOnly === 'boolean') {
    prefs.stablecoinOnly = constraints.stablecoinOnly;
  }
  if (constraints.timeHorizon) {
    prefs.timeHorizon = constraints.timeHorizon;
  }
  return Object.keys(prefs).length ? prefs : null;
};

const hasBalancesFromInvocation = (invocation: ToolInvocation): boolean | null => {
  if (!toolMatchesAction(invocation.toolName, SOLANA_ALL_BALANCES_NAME)) return null;
  const balances = (invocation as any)?.result?.body?.balances;
  if (!Array.isArray(balances)) return null;
  return balances.length > 0;
};

export const buildSolanaRouterContext = (
  messages: Message[],
  options?: {
    walletAddress?: string;
    intent?: SolanaIntent;
    lastSelection?: SolanaRouterContext['lastSelection'];
    userPrefs?: SolanaRouterContext['userPrefs'];
    profileContext?: SolanaRouterContext['profileContext'];
  },
): SolanaRouterContext => {
  let lastYield: SolanaRouterContext['lastYield'] = null;
  let lastAction: SolanaRouterContext['lastAction'] = null;
  let lastSelection: SolanaRouterContext['lastSelection'] = null;
  let hasBalances: boolean | null = null;
  let foundAll = false;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const invocations = extractToolInvocations(messages[i]);
    for (let j = invocations.length - 1; j >= 0; j -= 1) {
      const inv = invocations[j];
      const toolName = String(inv.toolName || '');

      if (hasBalances === null) {
        const detected = hasBalancesFromInvocation(inv);
        if (detected !== null) {
          hasBalances = detected;
        }
      }

      if (!lastYield) {
        if (
          toolMatchesAction(toolName, SOLANA_LENDING_YIELDS_ACTION) ||
          toolMatchesAction(toolName, SOLANA_LIQUID_STAKING_YIELDS_ACTION)
        ) {
          lastYield = {
            tool: toolName,
            args: (inv.args as Record<string, unknown>) ?? undefined,
            pools: summarizeYieldPools((inv as any)?.result?.body),
          };
        }
      }

      if (!lastAction) {
        if (
          toolMatchesAction(toolName, SOLANA_LEND_ACTION) ||
          toolMatchesAction(toolName, SOLANA_WITHDRAW_ACTION) ||
          toolMatchesAction(toolName, SOLANA_STAKE_ACTION) ||
          toolMatchesAction(toolName, SOLANA_UNSTAKE_ACTION) ||
          toolMatchesAction(toolName, SOLANA_TRADE_ACTION) ||
          toolMatchesAction(toolName, SOLANA_TRANSFER_NAME)
        ) {
          const status = (inv as any)?.result?.body?.status;
          const args = (inv.args as Record<string, unknown>) ?? undefined;
          lastAction = {
            tool: toolName,
            args,
            status: status ? String(status) : undefined,
          };
          if (!lastSelection) {
            lastSelection = selectionFromAction(toolName, args);
          }
        }
      }

      if (lastYield && lastAction && hasBalances !== null) {
        foundAll = true;
        break;
      }
    }
    if (foundAll) break;
  }

  const userPrefs = options?.userPrefs ?? prefsFromIntent(options?.intent) ?? null;
  const profileContext = options?.profileContext ?? {
    walletAddress: options?.walletAddress,
    hasBalances: hasBalances === null ? undefined : hasBalances,
  };

  return {
    lastYield,
    lastAction,
    lastSelection: options?.lastSelection ?? lastSelection,
    userPrefs,
    profileContext,
    wallet: {
      hasWalletAddress: Boolean(options?.walletAddress),
    },
    ...(options?.intent ? { intent: options.intent } : {}),
  };
};

export const buildSolanaRouterInput = (
  messages: Message[],
  options?: { walletAddress?: string; intent?: SolanaIntent },
) => {
  return {
    lastUserText: lastUserText(messages),
    context: buildSolanaRouterContext(messages, options),
  };
};

const isYieldTool = (toolName: string) => {
  return (
    toolMatchesAction(toolName, SOLANA_LENDING_YIELDS_ACTION) ||
    toolMatchesAction(toolName, SOLANA_LIQUID_STAKING_YIELDS_ACTION)
  );
};

const isExecutionTool = (toolName: string) => {
  return (
    toolMatchesAction(toolName, SOLANA_LEND_ACTION) ||
    toolMatchesAction(toolName, SOLANA_WITHDRAW_ACTION) ||
    toolMatchesAction(toolName, SOLANA_STAKE_ACTION) ||
    toolMatchesAction(toolName, SOLANA_UNSTAKE_ACTION) ||
    toolMatchesAction(toolName, SOLANA_TRADE_ACTION) ||
    toolMatchesAction(toolName, SOLANA_TRANSFER_NAME) ||
    toolMatchesAction(toolName, SOLANA_DEPOSIT_LIQUIDITY_NAME) ||
    toolMatchesAction(toolName, SOLANA_WITHDRAW_LIQUIDITY_NAME)
  );
};

const agentForTool = (toolName: string): RouterAgentKey | null => {
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
  if (toolMatchesAction(toolName, SOLANA_TRANSFER_NAME)) {
    return 'wallet';
  }
  if (
    toolMatchesAction(toolName, SOLANA_DEPOSIT_LIQUIDITY_NAME) ||
    toolMatchesAction(toolName, SOLANA_WITHDRAW_LIQUIDITY_NAME)
  ) {
    return 'liquidity';
  }
  if (toolMatchesAction(toolName, SOLANA_GET_WALLET_ADDRESS_ACTION)) {
    return 'wallet';
  }
  return null;
};

const toolPlanFromContext = (
  tool: string,
  args?: Record<string, unknown>,
): RouterToolPlanItem[] => {
  return args ? [{ tool, args }] : [{ tool }];
};

const applyIntentToYieldToolPlan = (
  toolPlan: RouterToolPlanItem[],
  intent: SolanaIntent | undefined,
): RouterToolPlanItem[] => {
  const constraints = intent?.constraints;
  if (!constraints) return toolPlan;

  return toolPlan.map((item) => {
    if (!isYieldTool(item.tool)) return item;

    const nextArgs: Record<string, unknown> = { ...(item.args ?? {}) };

    if (constraints.tokenSymbol && !nextArgs.tokenSymbol) {
      nextArgs.tokenSymbol = constraints.tokenSymbol;
    }

    if (constraints.protocol && !nextArgs.protocol) {
      nextArgs.protocol = constraints.protocol;
    }

    if (typeof constraints.limit === 'number' && nextArgs.limit === undefined) {
      nextArgs.limit = constraints.limit;
    }

    return Object.keys(nextArgs).length ? { ...item, args: nextArgs } : item;
  });
};

const applyUserPrefsToYieldToolPlan = (
  toolPlan: RouterToolPlanItem[],
  userPrefs: SolanaRouterContext['userPrefs'] | undefined,
): RouterToolPlanItem[] => {
  if (!userPrefs) return toolPlan;

  return toolPlan.map((item) => {
    if (!isYieldTool(item.tool)) return item;

    const nextArgs: Record<string, unknown> = { ...(item.args ?? {}) };

    if (userPrefs.stablecoinOnly !== undefined && nextArgs.stablecoinOnly === undefined) {
      nextArgs.stablecoinOnly = userPrefs.stablecoinOnly;
    }

    if (userPrefs.timeHorizon && nextArgs.timeHorizon === undefined) {
      nextArgs.timeHorizon = userPrefs.timeHorizon;
    }

    if (userPrefs.risk && nextArgs.risk === undefined) {
      nextArgs.risk = userPrefs.risk;
    }

    return Object.keys(nextArgs).length ? { ...item, args: nextArgs } : item;
  });
};

export const normalizeSolanaRouterDecision = (
  decision: SolanaRouterDecision,
  context?: SolanaRouterContext,
): SolanaRouterDecision => {
  if (context?.intent?.needsClarification) {
    return applyLayoutDefaults({
      agent: 'none',
      mode: 'explore',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
      layout: decision.layout,
    });
  }

  const normalized: SolanaRouterDecision = {
    ...decision,
    toolPlan: decision.toolPlan ?? [],
    stopCondition: decision.stopCondition ?? 'none',
  };

  const intentReferences = context?.intent?.references;
  if (intentReferences?.fromLastYield && context?.lastYield) {
    const inferredAgent = agentForTool(context.lastYield.tool);
    const intentGoal = context.intent?.goal;
    return applyLayoutDefaults({
      agent: inferredAgent ?? (normalized.agent === 'none' ? 'lending' : normalized.agent),
      mode: intentGoal === 'decide' ? 'decide' : normalized.mode,
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
      layout: normalized.layout,
    });
  }

  if (intentReferences?.fromLastAction && context?.lastAction && !normalized.toolPlan.length) {
    normalized.toolPlan = toolPlanFromContext(context.lastAction.tool, context.lastAction.args);
    const inferredAgent = agentForTool(context.lastAction.tool);
    if (normalized.agent === 'none' && inferredAgent) {
      normalized.agent = inferredAgent;
    }
  }

  if (intentReferences?.fromLastSelection && context?.lastSelection && !normalized.toolPlan.length) {
    const intentDomain = context.intent?.domain;
    if (normalized.agent === 'none' && intentDomain && intentDomain !== 'none') {
      normalized.agent = intentDomain as RouterAgentKey;
    }
    if (context.intent?.goal === 'decide') {
      normalized.mode = 'decide';
    }
  }

  normalized.toolPlan = applyIntentToYieldToolPlan(normalized.toolPlan, context?.intent);
  normalized.toolPlan = applyUserPrefsToYieldToolPlan(normalized.toolPlan, context?.userPrefs);

  if (normalized.agent === 'none') {
    return applyLayoutDefaults({
      agent: 'none',
      mode: 'explore',
      ui: 'text',
      toolPlan: [],
      stopCondition: 'none',
      layout: normalized.layout,
    });
  }

  if (normalized.toolPlan.length === 0) {
    return applyLayoutDefaults({
      ...normalized,
      stopCondition: 'none',
    });
  }

  const hasYieldTool = normalized.toolPlan.some((item) => isYieldTool(item.tool));
  const hasExecutionTool = normalized.toolPlan.some((item) => isExecutionTool(item.tool));

  if (hasExecutionTool) {
    normalized.mode = 'execute';
  }

  if (hasYieldTool && normalized.ui === 'text') {
    normalized.ui = 'cards';
  }

  if (hasYieldTool) {
    normalized.stopCondition =
      normalized.ui === 'cards' ? 'when_first_yields_result_received' : 'after_tool_plan_complete';
  }

  if (normalized.mode === 'execute' && context && !context.wallet.hasWalletAddress) {
    const walletTool = SOLANA_GET_WALLET_ADDRESS_ACTION;
    const toolPlan = normalized.toolPlan ?? [];
    if (!toolPlan.length || !toolMatchesAction(toolPlan[0].tool, walletTool)) {
      normalized.toolPlan = [{ tool: walletTool }, ...toolPlan];
    }
  }

  return applyLayoutDefaults(normalized);
};

export async function getSolanaRouterDecision(args: {
  model: LanguageModelV1;
  lastUserText: string;
  context: SolanaRouterContext;
}): Promise<SolanaRouterDecision> {
  const { model, lastUserText: userText, context } = args;
  const trimmed = String(userText || '').trim();

  const fallback: SolanaRouterDecision = {
    agent: 'none',
    mode: 'explore',
    ui: 'text',
    toolPlan: [],
    stopCondition: 'none',
  };

  if (!trimmed) return fallback;

  const routerSystem: CoreMessage = {
    role: 'system',
    content: `Return one JSON object matching the schema exactly.

Schema:
{
  "agent": "lending|staking|wallet|trading|market|token-analysis|liquidity|knowledge|none",
  "mode": "explore|decide|execute",
  "ui": "cards|cards_then_text|text",
  "toolPlan": [{ "tool": string, "args": object }],
  "stopCondition": "when_first_yields_result_received|after_tool_plan_complete|none",
  "layout": ["text", "tool", "summary"]
}

Rules:
- Use the conversation context to understand user intent; do not rely on keyword matching.
- If context.intent is present, use it as the primary signal for agent/mode/toolPlan.
- If the user asks to take an action (lend, stake, swap, transfer, withdraw), use mode="execute".
- If mode="execute" and context.wallet.hasWalletAddress is false, prepend solana_get_wallet_address to toolPlan.
- If the user asks for yields/pools/rates, use mode="explore" and include the appropriate yields tool in toolPlan.
- If context.intent.constraints has tokenSymbol or protocol, include them in the yields tool args.
- If the user asks to retry/"try again" and context.lastAction has status cancelled/failed, reuse that tool + args in toolPlan.
- Use agent="none" for open-ended discovery queries that should show the feature overview.
- If toolPlan is provided, keep it minimal (1 tool unless retry requires more).
- stopCondition: use "when_first_yields_result_received" for cards-only yield lists, "after_tool_plan_complete" when a text summary is expected.
`,
  };

  const routerUser: CoreMessage = {
    role: 'user',
    content: `User: ${trimmed}

Context: ${JSON.stringify(context)}`,
  };

  try {
    const { object } = await generateObject({
      model,
      schema: SolanaRouterDecisionSchema,
      messages: [routerSystem, routerUser],
    });

    const normalized = normalizeSolanaRouterDecision(object as SolanaRouterDecision, context);
    return SolanaRouterDecisionSchema.parse(normalized);
  } catch {
    return fallback;
  }
}
