import { Message } from 'ai/react';
import {
  SOLANA_ALL_BALANCES_NAME,
  SOLANA_DEPOSIT_LIQUIDITY_NAME,
  SOLANA_LEND_ACTION,
  SOLANA_STAKE_ACTION,
  SOLANA_UNSTAKE_ACTION,
  SOLANA_WITHDRAW_ACTION,
  SOLANA_WITHDRAW_LIQUIDITY_NAME,
} from '@/ai/action-names';

export type ChatMemory = {
  lastSelection: {
    tokenSymbol?: string;
    protocol?: string;
    poolId?: string;
  } | null;
  userPrefs: {
    risk?: 'low' | 'medium' | 'high';
    stablecoinOnly?: boolean;
    timeHorizon?: 'short' | 'medium' | 'long';
  } | null;
  profileContext: {
    walletAddress?: string;
    hasBalances?: boolean | null;
  } | null;
};

type ToolInvocation = {
  toolName?: string;
  state?: string;
  args?: unknown;
  result?: unknown;
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

const selectionFromAction = (
  toolName: string,
  args: Record<string, unknown> | undefined,
): ChatMemory['lastSelection'] => {
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

const hasBalancesFromInvocation = (invocation: ToolInvocation): boolean | null => {
  if (!toolMatchesAction(invocation.toolName, SOLANA_ALL_BALANCES_NAME)) return null;
  const balances = (invocation as any)?.result?.body?.balances;
  if (!Array.isArray(balances)) return null;
  return balances.length > 0;
};

export const deriveChatMemory = (
  messages: Message[],
  prevMemory: ChatMemory | null,
  walletAddress?: string,
): ChatMemory => {
  let lastSelection = prevMemory?.lastSelection ?? null;
  let hasBalances: boolean | null =
    prevMemory?.profileContext?.hasBalances ?? null;

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

      if (!lastSelection) {
        lastSelection = selectionFromAction(toolName, (inv.args as Record<string, unknown>) ?? undefined);
      }

      if (lastSelection && hasBalances !== null) {
        break;
      }
    }
    if (lastSelection && hasBalances !== null) {
      break;
    }
  }

  const profileContext = {
    walletAddress: walletAddress ?? prevMemory?.profileContext?.walletAddress,
    hasBalances,
  };

  return {
    lastSelection,
    userPrefs: prevMemory?.userPrefs ?? null,
    profileContext,
  };
};

export const isChatMemoryEqual = (a: ChatMemory | null, b: ChatMemory | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;

  const aSelection = a.lastSelection;
  const bSelection = b.lastSelection;
  const sameSelection =
    aSelection?.tokenSymbol === bSelection?.tokenSymbol &&
    aSelection?.protocol === bSelection?.protocol &&
    aSelection?.poolId === bSelection?.poolId;

  const aPrefs = a.userPrefs;
  const bPrefs = b.userPrefs;
  const samePrefs =
    aPrefs?.risk === bPrefs?.risk &&
    aPrefs?.stablecoinOnly === bPrefs?.stablecoinOnly &&
    aPrefs?.timeHorizon === bPrefs?.timeHorizon;

  const aProfile = a.profileContext;
  const bProfile = b.profileContext;
  const sameProfile =
    aProfile?.walletAddress === bProfile?.walletAddress &&
    aProfile?.hasBalances === bProfile?.hasBalances;

  return sameSelection && samePrefs && sameProfile;
};

export const getChatMemoryStorageKey = (chatId: string, chain: string) =>
  `hive.chat.memory.${chain}.${chatId}`;

export const loadChatMemory = (chatId: string, chain: string): ChatMemory | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(getChatMemoryStorageKey(chatId, chain));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ChatMemory;
    return parsed || null;
  } catch {
    return null;
  }
};

export const saveChatMemory = (chatId: string, chain: string, memory: ChatMemory | null) => {
  if (typeof window === 'undefined') return;
  const key = getChatMemoryStorageKey(chatId, chain);
  if (!memory) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(memory));
};
