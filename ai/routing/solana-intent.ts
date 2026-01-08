import { CoreMessage, generateObject, LanguageModelV1, Message } from 'ai';
import { z } from 'zod';
import { buildSolanaRouterContext, SolanaRouterContext } from '@/ai/routing/solana-router';

export type SolanaIntentGoal = 'explore' | 'decide' | 'execute' | 'learn';
export type SolanaIntentDomain =
  | 'lending'
  | 'staking'
  | 'wallet'
  | 'trading'
  | 'market'
  | 'token-analysis'
  | 'liquidity'
  | 'knowledge'
  | 'none';

export type SolanaIntentConstraints = {
  tokenSymbol?: string;
  protocol?: string;
  stablecoinOnly?: boolean;
  amount?: number;
  limit?: number;
  walletOnly?: boolean;
  risk?: 'low' | 'medium' | 'high';
  timeHorizon?: 'short' | 'medium' | 'long';
};

export type SolanaIntent = {
  goal: SolanaIntentGoal;
  domain: SolanaIntentDomain;
  queryType?: string;
  constraints?: SolanaIntentConstraints;
  assumptions?: string[];
  confidence: number;
  needsClarification?: boolean;
  clarifyingQuestion?: string;
  references?: {
    fromLastYield?: boolean;
    fromLastAction?: boolean;
    fromLastSelection?: boolean;
  };
};

export type SolanaIntentContext = SolanaRouterContext & {
  summary?: string | null;
};

const SolanaIntentConstraintsSchema = z.object({
  tokenSymbol: z.string().optional(),
  protocol: z.string().optional(),
  stablecoinOnly: z.boolean().optional(),
  amount: z.number().optional(),
  limit: z.number().optional(),
  walletOnly: z.boolean().optional(),
  risk: z.enum(['low', 'medium', 'high']).optional(),
  timeHorizon: z.enum(['short', 'medium', 'long']).optional(),
});

export const SolanaIntentSchema = z.object({
  goal: z.enum(['explore', 'decide', 'execute', 'learn']),
  domain: z.enum([
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
  queryType: z.string().optional(),
  constraints: SolanaIntentConstraintsSchema.optional(),
  assumptions: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean().optional(),
  clarifyingQuestion: z.string().optional(),
  references: z
    .object({
      fromLastYield: z.boolean().optional(),
      fromLastAction: z.boolean().optional(),
      fromLastSelection: z.boolean().optional(),
    })
    .optional(),
});

export const DEFAULT_SOLANA_INTENT_CLARIFYING_QUESTION =
  'Can you clarify what you want to do on Solana (lending, staking, trading, wallet, or something else)?';

const clampConfidence = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const mergeUserPrefsIntoIntent = (
  intent: SolanaIntent,
  userPrefs: SolanaIntentContext['userPrefs'],
): SolanaIntent => {
  if (!userPrefs) return intent;
  const constraints = { ...(intent.constraints ?? {}) };

  if (constraints.stablecoinOnly === undefined && userPrefs.stablecoinOnly !== undefined) {
    constraints.stablecoinOnly = userPrefs.stablecoinOnly;
  }

  if (!constraints.timeHorizon && userPrefs.timeHorizon) {
    constraints.timeHorizon = userPrefs.timeHorizon;
  }

  if (!constraints.risk && userPrefs.risk) {
    constraints.risk = userPrefs.risk;
  }

  return { ...intent, constraints };
};

const isInternalUserMessage = (message: Message | undefined): boolean => {
  if (!message || message.role !== 'user') return false;
  const annotations = (message as any)?.annotations;
  if (!Array.isArray(annotations)) return false;
  return annotations.some((a) => a && typeof a === 'object' && (a as any).internal === true);
};

const lastUserText = (messages: Message[]): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;
    if (isInternalUserMessage(msg)) continue;
    return typeof msg.content === 'string' ? msg.content : String(msg.content ?? '');
  }
  return '';
};

export const buildSolanaIntentContext = (
  messages: Message[],
  options?: {
    walletAddress?: string;
    summary?: string | null;
    lastSelection?: SolanaRouterContext['lastSelection'];
    userPrefs?: SolanaRouterContext['userPrefs'];
    profileContext?: SolanaRouterContext['profileContext'];
  },
): SolanaIntentContext => {
  const base = buildSolanaRouterContext(messages, {
    walletAddress: options?.walletAddress,
    lastSelection: options?.lastSelection,
    userPrefs: options?.userPrefs,
    profileContext: options?.profileContext,
  });
  return {
    ...base,
    summary: options?.summary ?? null,
  };
};

export const buildSolanaIntentInput = (
  messages: Message[],
  options?: Parameters<typeof buildSolanaIntentContext>[1],
) => {
  return {
    lastUserText: lastUserText(messages),
    context: buildSolanaIntentContext(messages, options),
  };
};

export const normalizeSolanaIntent = (intent: SolanaIntent): SolanaIntent => {
  const confidence = clampConfidence(intent.confidence);
  const constraints = intent.constraints ? { ...intent.constraints } : undefined;
  const assumptions = intent.assumptions ? [...intent.assumptions].filter(Boolean) : [];

  if (constraints?.tokenSymbol) {
    constraints.tokenSymbol = constraints.tokenSymbol.toUpperCase();
  }

  if (constraints?.protocol) {
    constraints.protocol = constraints.protocol.toLowerCase();
  }

  if (typeof constraints?.limit === 'number') {
    const rounded = Math.round(constraints.limit);
    const clamped = Math.max(1, Math.min(rounded, 50));
    constraints.limit = clamped;
  }

  const needsClarification = confidence < 0.45 || Boolean(intent.needsClarification);
  const clarifyingQuestion = needsClarification
    ? intent.clarifyingQuestion || DEFAULT_SOLANA_INTENT_CLARIFYING_QUESTION
    : undefined;

  return {
    ...intent,
    confidence,
    constraints,
    assumptions,
    needsClarification,
    clarifyingQuestion,
  };
};

export async function getSolanaIntent(args: {
  model: LanguageModelV1;
  lastUserText: string;
  context: SolanaIntentContext;
}): Promise<SolanaIntent> {
  const { model, lastUserText: userText, context } = args;
  const trimmed = String(userText || '').trim();

  const fallback: SolanaIntent = {
    goal: 'explore',
    domain: 'none',
    queryType: 'unknown',
    confidence: 0.2,
    assumptions: [],
    needsClarification: true,
    clarifyingQuestion: DEFAULT_SOLANA_INTENT_CLARIFYING_QUESTION,
  };

  if (!trimmed) return fallback;

  const system: CoreMessage = {
    role: 'system',
    content: `Return one JSON object matching the schema exactly.

Schema:
{
  "goal": "explore|decide|execute|learn",
  "domain": "lending|staking|wallet|trading|market|token-analysis|liquidity|knowledge|none",
  "queryType": string,
  "constraints": {
    "tokenSymbol": string,
    "protocol": string,
    "stablecoinOnly": boolean,
    "amount": number,
    "limit": number,
    "walletOnly": boolean,
    "risk": "low|medium|high",
    "timeHorizon": "short|medium|long"
  },
  "assumptions": string[],
  "confidence": number (0-1),
  "needsClarification": boolean,
  "clarifyingQuestion": string,
  "references": {
    "fromLastYield": boolean,
    "fromLastAction": boolean,
    "fromLastSelection": boolean
  }
}

Rules:
- Interpret intent using context, not keyword matching.
- Use "needsClarification" when user intent is ambiguous or missing key constraints.
- If user says "try again" or "out of these", set references accordingly.
- If user asks for the full list or "all pools", set constraints.limit to a large number (e.g., 50).
- Keep assumptions short and explicit.
`,
  };

  const user: CoreMessage = {
    role: 'user',
    content: `User: ${trimmed}

Context: ${JSON.stringify(context)}`,
  };

  try {
    const { object } = await generateObject({
      model,
      schema: SolanaIntentSchema,
      messages: [system, user],
    });

    const merged = mergeUserPrefsIntoIntent(object as SolanaIntent, context.userPrefs);
    const normalized = normalizeSolanaIntent(merged);
    return SolanaIntentSchema.parse(normalized);
  } catch {
    return fallback;
  }
}
