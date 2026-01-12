'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import { Markdown, Icon, Logo, Avatar, AvatarFallback, AvatarImage } from '@/components/ui';
import Link from './link';
import { cn } from '@/lib/utils';
import { getAgentName } from '../../chat/_components/tools/tool-to-agent';
import { pfpURL } from '@/lib/pfp';
import { useChat } from '@/app/(app)/chat/_contexts/chat';
import { formatCompactNumber, formatPercent } from '@/lib/format';
import {
  getSummaryFromAnnotations,
  resolveMessageLayout,
  shouldRenderSummary,
} from '@/lib/chat/message-layout';
import {
  SOLANA_LENDING_YIELDS_ACTION,
  SOLANA_LIQUID_STAKING_YIELDS_ACTION,
} from '@/ai/action-names';
import { capitalizeWords } from '@/lib/string-utils';
import type { Message as MessageType, ToolInvocation as ToolInvocationType } from 'ai';

interface Props {
  message: MessageType;
  ToolComponent: React.ComponentType<{
    tool: ToolInvocationType;
    prevToolAgent?: string;
  }>;
  className?: string;
  previousMessage?: MessageType;
  nextMessage?: MessageType;
  compressed?: boolean;
  isLatestAssistant?: boolean;
}

const Message: React.FC<Props> = ({
  message,
  ToolComponent,
  className,
  previousMessage,
  nextMessage,
  compressed,
  isLatestAssistant,
}) => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const img = new window.Image();
      img.src = '/hive-thinking.gif';
    }
  }, []);

  const { user } = usePrivy();
  const { isResponseLoading, completedLendToolCallIds } = useChat();

  const isUser = message.role === 'user';

  const currentToolInvocations = getMessageToolInvocations(message);
  const previousToolInvocations = getMessageToolInvocations(previousMessage);
  const summaryContent = getYieldSummaryFallback(message) ?? getSummaryFromAnnotations(message);
  const layout = resolveMessageLayout(message, currentToolInvocations.length > 0);
  const hasYieldResults = messageHasYieldResults(message);
  const showSummary =
    shouldRenderSummary(layout, summaryContent) || (hasYieldResults && !!summaryContent);
  const hasCardBlock = layout.includes('card');
  const displayContent = getDisplayContent(message, previousMessage, completedLendToolCallIds, {
    showSummary,
    summaryContent,
  });

  const hasVisibleText =
    typeof displayContent === 'string' ? displayContent.trim().length > 0 : Boolean(displayContent);
  const hasVisibleSummary =
    showSummary && typeof summaryContent === 'string' && summaryContent.trim().length > 0;
  const hasVisibleTools = currentToolInvocations.length > 0;

  if (!isUser && !hasVisibleText && !hasVisibleSummary && !hasVisibleTools) {
    return null;
  }

  const nextMessageSameRole = nextMessage?.role === message.role;
  const previousMessageSameRole = previousMessage?.role === message.role;
  const showLoadingAvatar = !isUser && isLatestAssistant && isResponseLoading;

  return (
    <div
      className={cn(
        'flex w-full px-2 py-4 max-w-full last:border-b-0 h-fit',
        'flex-col gap-2',
        'md:flex-row md:gap-4 md:px-4',
        compressed && 'md:px-2 md:flex-col gap-0 md:gap-1',
        nextMessageSameRole && 'pb-0',
        previousMessageSameRole && 'pt-0',
        previousMessageSameRole &&
          compressed &&
          'border-b border-gray-200 dark:border-neutral-700 pt-2',
        !nextMessageSameRole && 'border-b border-gray-200 dark:border-neutral-700',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center md:items-start gap-2 md:gap-4',
          previousMessageSameRole && 'hidden md:block',
          compressed && 'md:gap-2 md:flex md:items-center',
          previousMessageSameRole && compressed && 'hidden md:hidden',
        )}
      >
        <div
          className={cn(
            'hidden md:flex items-center justify-center w-6 h-6 md:w-10 md:h-10 rounded-full',
            compressed && 'md:flex md:h-6 md:w-6',
            isUser &&
              'bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700',
            previousMessageSameRole && 'opacity-0',
          )}
        >
          {isUser ? (
            <Avatar className={cn('w-10 h-10', compressed && 'w-6 h-6')}>
              <AvatarFallback>
                <Icon
                  name="User"
                  className={cn('w-4 h-4 md:w-6 md:h-6', compressed && 'md:w-4 md:h-4')}
                />
              </AvatarFallback>
              {user && <AvatarImage src={pfpURL(user, false)} />}
            </Avatar>
          ) : showLoadingAvatar ? (
            <Image
              src="/hive-thinking.gif"
              alt="The Hive is thinking"
              width={compressed ? 24 : 40}
              height={compressed ? 24 : 40}
              className={cn('h-10 w-10', compressed && 'h-6 w-6')}
              priority
              unoptimized
            />
          ) : (
            <Logo className={cn('h-10 w-10', compressed && 'h-6 w-6')} />
          )}
        </div>
        <p
          className={cn(
            'text-sm font-semibold md:hidden',
            compressed && 'hidden md:block',
            previousMessageSameRole && 'hidden md:hidden',
            isUser
              ? 'text-neutral-900 dark:text-neutral-100'
              : 'text-brand-600 dark:text-brand-600',
          )}
        >
          {message.role === 'user' ? 'You' : 'The Hive'}
        </p>
      </div>
      <div
        className={cn(
          'pt-2 w-full max-w-full md:flex-1 md:w-0 overflow-hidden flex flex-col gap-2',
          compressed && 'gap-0 md:w-full pt-0',
        )}
      >
        {layout.map((block, blockIndex) => {
          if (block === 'tool') {
            if (hasCardBlock) return null;
            if (currentToolInvocations.length === 0) return null;
            return (
              <div className="flex flex-col gap-2" key={`tool-${blockIndex}`}>
                {currentToolInvocations.map((tool, index) => (
                  <ToolComponent
                    key={tool.toolCallId}
                    tool={tool}
                    prevToolAgent={
                      index === 0
                        ? previousToolInvocations[0]
                          ? getAgentName(previousToolInvocations[0])
                          : undefined
                        : currentToolInvocations[index - 1]
                          ? getAgentName(currentToolInvocations[index - 1])
                          : undefined
                    }
                  />
                ))}
              </div>
            );
          }

          if (block === 'card') {
            if (currentToolInvocations.length === 0) return null;
            return (
              <div className="flex flex-col gap-2" key={`card-${blockIndex}`}>
                {currentToolInvocations.map((tool, index) => (
                  <ToolComponent
                    key={tool.toolCallId}
                    tool={tool}
                    prevToolAgent={
                      index === 0
                        ? previousToolInvocations[0]
                          ? getAgentName(previousToolInvocations[0])
                          : undefined
                        : currentToolInvocations[index - 1]
                          ? getAgentName(currentToolInvocations[index - 1])
                          : undefined
                    }
                  />
                ))}
              </div>
            );
          }

          if (block === 'text') {
            if (!displayContent) return null;
            return (
              <MessageMarkdown
                key={`${block}-${blockIndex}`}
                content={displayContent as string}
                compressed={compressed}
              />
            );
          }

          if (block === 'summary') {
            if (!showSummary || !summaryContent) return null;
            return (
              <MessageMarkdown
                key={`${block}-${blockIndex}`}
                content={summaryContent as string}
                compressed
              />
            );
          }

          return null;
        })}
        {!layout.includes('summary') && showSummary && summaryContent ? (
          <MessageMarkdown content={summaryContent as string} compressed />
        ) : null}
      </div>
    </div>
  );
};

function getMessageToolInvocations(message?: MessageType): ToolInvocationType[] {
  if (!message) return [];

  if (message.parts && message.parts.length > 0) {
    return (message.parts as any[])
      .filter((part) => part && part.type === 'tool-invocation' && (part as any).toolInvocation)
      .map((part) => (part as any).toolInvocation as ToolInvocationType);
  }

  const legacyToolInvocations = (message as any).toolInvocations as
    | ToolInvocationType[]
    | undefined;

  return legacyToolInvocations ?? [];
}

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

const isYieldPool = (pool: any) => {
  if (!pool || typeof pool !== 'object') return false;
  return 'yield' in pool && 'tvlUsd' in pool && 'project' in pool;
};

const hasYieldResult = (tool: ToolInvocationType) => {
  if (tool.state !== 'result') return false;
  const body = (tool as any).result?.body;
  if (!Array.isArray(body) || body.length === 0) return false;
  return body.some(isYieldPool);
};

const messageHasYieldResults = (message?: MessageType) => {
  if (!message) return false;
  const invocations = getMessageToolInvocations(message);
  return invocations.some(hasYieldResult);
};

const resolvePoolSymbol = (pool: any): string | null => {
  const symbol = pool?.tokenData?.symbol || pool?.symbol;
  if (!symbol) return null;
  return String(symbol).toUpperCase();
};

const resolvePoolProject = (pool: any): string | null => {
  const project = pool?.project;
  if (!project) return null;
  return capitalizeWords(String(project).replace('-', ' '));
};

const resolvePoolApy = (pool: any): number | null => {
  const raw = pool?.yield ?? pool?.apy ?? pool?.apyBase;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const resolvePoolTvl = (pool: any): number | null => {
  const value = Number(pool?.tvlUsd);
  return Number.isFinite(value) ? value : null;
};

const resolveYieldLimit = (tool: ToolInvocationType): number | null => {
  const args = (tool as any)?.args ?? {};
  if (args.showAll) return null;
  return 3;
};

const getYieldSummaryFallback = (message?: MessageType): string | null => {
  if (!message) return null;
  const invocations = getMessageToolInvocations(message);
  const yieldTools = invocations.filter(hasYieldResult);
  if (!yieldTools.length) return null;

  let hasLending = false;
  let hasStaking = false;
  const pools: any[] = [];

  yieldTools.forEach((tool) => {
    const toolName = (tool as any).toolName;
    if (toolMatchesAction(toolName, SOLANA_LENDING_YIELDS_ACTION)) {
      hasLending = true;
    }
    if (toolMatchesAction(toolName, SOLANA_LIQUID_STAKING_YIELDS_ACTION)) {
      hasStaking = true;
    }
    const body = (tool as any).result?.body;
    if (Array.isArray(body)) {
      const limit = resolveYieldLimit(tool);
      const filtered = body.filter(isYieldPool);
      const limited = limit ? filtered.slice(0, limit) : filtered;
      limited.forEach((pool) => pools.push(pool));
    }
  });

  const bestPool =
    pools.length > 0
      ? pools.reduce((best, current) => {
          const bestApy = resolvePoolApy(best) ?? Number.NEGATIVE_INFINITY;
          const currentApy = resolvePoolApy(current) ?? Number.NEGATIVE_INFINITY;
          return currentApy > bestApy ? current : best;
        }, pools[0])
      : null;

  const symbol = bestPool ? resolvePoolSymbol(bestPool) : null;
  const project = bestPool ? resolvePoolProject(bestPool) : null;
  const apy = bestPool ? resolvePoolApy(bestPool) : null;
  const tvl = bestPool ? resolvePoolTvl(bestPool) : null;

  const apyText = apy !== null ? `${formatPercent(apy)} APY` : 'APY not available';
  const tvlText = tvl !== null ? `${formatCompactNumber(tvl)} TVL` : 'TVL not available';

  const lead = hasStaking && !hasLending ? 'Top liquid staking yield' : 'Top lending yield';
  if (symbol && project) {
    return `${lead}: ${symbol} on ${project} at ${apyText} with ${tvlText}. Pick a pool to continue.`;
  }
  if (symbol) {
    return `${lead}: ${symbol} at ${apyText} with ${tvlText}. Pick a pool to continue.`;
  }

  return `${lead} shown above. Pick a pool to continue.`;
};

function getDisplayContent(
  message: MessageType,
  previousMessage?: MessageType,
  completedLendToolCallIds?: string[],
  options?: { showSummary?: boolean; summaryContent?: string | null },
): string | null {
  if (message.role !== 'assistant') return message.content || null;

  const toolInvocations = getMessageToolInvocations(message);

  const hasUnstakeGuide = toolInvocations.some(
    (tool) => tool.state === 'result' && (tool as any).result?.body?.status === 'guide',
  );

  if (hasUnstakeGuide) return null;

  const hasAllBalancesResult = toolInvocations.some((tool) => {
    if (tool.state !== 'result') return false;
    const balances = (tool as any).result?.body?.balances;
    return Array.isArray(balances) && balances.length > 0;
  });

  if (hasAllBalancesResult) {
    return 'Balances shown above. Pick a token to swap, lend, stake, or explore next.';
  }

  const completedIds = completedLendToolCallIds ?? [];

  const hasCompletedLend = toolInvocations.some((tool) => {
    if (tool.state !== 'result') return false;
    if (!completedIds.includes(tool.toolCallId)) return false;
    return (tool as any).result?.body?.status === 'complete';
  });

  if (hasCompletedLend) {
    return "You're all set — your lending deposit is complete and now earning yield automatically. You can view or manage it using the card above.";
  }

  const YIELDS_CTA = 'Yields shown above. Pick a pool card to continue.';
  const yieldSummary = getYieldSummaryFallback(message) ?? YIELDS_CTA;
  const prevYieldSummary = getYieldSummaryFallback(previousMessage) ?? YIELDS_CTA;
  const yieldsState = messageHasYieldResults(message);
  const prevYieldsState = messageHasYieldResults(previousMessage);

  if (yieldsState) {
    if (options?.showSummary && options?.summaryContent) {
      return null;
    }
    return yieldSummary;
  }

  if (prevYieldsState) {
    const content =
      typeof message.content === 'string' ? message.content : String(message.content ?? '');
    const trimmed = content.trim();
    if (!trimmed) return null;
    if (trimmed === prevYieldSummary) return null;
    return content;
  }

  return message.content || null;
}

const MessageMarkdown = React.memo(
  ({ content, compressed }: { content: string; compressed?: boolean }) => {
    return (
      <Markdown
        components={{
          a: ({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
            if (!href) return children;
            return <Link url={href}>{children}</Link>;
          },
          ...(compressed
            ? {
                h1({ children }) {
                  return <h1 className={cn('text-lg md:text-xl font-bold')}>{children}</h1>;
                },
                h2({ children }) {
                  return <h2 className={cn('text-md md:text-lg font-bold')}>{children}</h2>;
                },
                h3({ children }) {
                  return <h3 className={cn('text-sm md:text-md font-bold')}>{children}</h3>;
                },
                h4({ children }) {
                  return <h4 className={cn('text-sm md:text-sm font-bold')}>{children}</h4>;
                },
                h5({ children }) {
                  return <h5 className={cn('text-xs md:text-xs font-bold')}>{children}</h5>;
                },
                h6({ children }) {
                  return <h6 className={cn('text-xs font-bold')}>{children}</h6>;
                },
                li({ children }) {
                  return <li className="text-xs md:text-sm">{children}</li>;
                },
                p({ children, node }) {
                  const hasBlockElements = node?.children?.some((child: any) => {
                    const tag = (child as any)?.tagName as string | undefined;
                    return (
                      (child as any)?.type === 'element' &&
                      typeof tag === 'string' &&
                      ['div', 'p', 'blockquote', 'form'].includes(tag)
                    );
                  });

                  if (hasBlockElements) {
                    return <div className="text-xs md:text-sm">{children}</div>;
                  }

                  return <p className="text-xs md:text-sm">{children}</p>;
                },
              }
            : {}),
        }}
      >
        {content}
      </Markdown>
    );
  },
);

MessageMarkdown.displayName = 'MessageMarkdown';

export default Message;
