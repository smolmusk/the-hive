import type { Message as MessageType } from 'ai';

export type MessageLayoutBlock = 'text' | 'tool' | 'summary' | 'card';

const isLayoutBlock = (value: unknown): value is MessageLayoutBlock =>
  value === 'text' || value === 'tool' || value === 'summary' || value === 'card';

export const getLayoutFromAnnotations = (message?: MessageType): MessageLayoutBlock[] | null => {
  if (!message) return null;
  const annotations = (message as any)?.annotations as any[] | undefined;
  if (!Array.isArray(annotations)) return null;

  const layoutAnnotation = annotations.find(
    (entry) => entry && typeof entry === 'object' && Array.isArray((entry as any).layout),
  ) as { layout?: unknown[] } | undefined;

  const layout = layoutAnnotation?.layout;
  if (!layout || !Array.isArray(layout)) return null;
  if (!layout.length) return null;
  if (!layout.every(isLayoutBlock)) return null;

  return layout as MessageLayoutBlock[];
};

export const getSummaryFromAnnotations = (message?: MessageType): string | null => {
  if (!message) return null;
  const annotations = (message as any)?.annotations as any[] | undefined;
  if (!Array.isArray(annotations)) return null;

  const summaryAnnotation = annotations.find(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      typeof (entry as any).summary === 'string' &&
      (entry as any).summary.trim().length > 0,
  ) as { summary?: string } | undefined;

  if (!summaryAnnotation?.summary) return null;
  return summaryAnnotation.summary;
};

export const shouldRenderSummary = (
  layout: MessageLayoutBlock[],
  summary: string | null,
): boolean => {
  if (!summary || !summary.trim()) return false;
  return layout.includes('summary');
};

const normalizeLayoutOrder = (
  layout: MessageLayoutBlock[],
  hasTools: boolean,
): MessageLayoutBlock[] => {
  const seen = new Set<MessageLayoutBlock>();
  let next = layout.filter((block) => {
    if (seen.has(block)) return false;
    seen.add(block);
    return true;
  });

  if (!hasTools) {
    next = next.filter((block) => block !== 'tool' && block !== 'card');
  }

  if (next.includes('card')) {
    next = next.filter((block) => block !== 'tool');
  }

  const order: Record<MessageLayoutBlock, number> = {
    card: 0,
    tool: 0,
    text: 1,
    summary: 2,
  };

  return [...next].sort((a, b) => order[a] - order[b]);
};

export const resolveMessageLayout = (
  message: MessageType | undefined,
  hasTools: boolean,
): MessageLayoutBlock[] => {
  const annotated = getLayoutFromAnnotations(message);
  const base = annotated ?? (hasTools ? ['tool', 'text'] : ['text']);
  return normalizeLayoutOrder(base, hasTools);
};
