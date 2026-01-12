import { Message } from 'ai';
import type { ChatMemory } from '@/lib/chat/memory';

const basePrompt = `Generate 3 follow-up suggestions for what I can do next. They can be declarative or questions. The prompts should be specific to the previous messages. Reference specific tokens, projects, etc.

IMPORTANT:
- Only suggest lending for stablecoins (e.g., USDC, USDT, USDG). Do NOT suggest lending for non-stable assets (e.g., SOL, ETH).
- Keep suggestions actionable and relevant to the discussed tokens.`;

const formatPrefs = (prefs?: ChatMemory['userPrefs'] | null) => {
  if (!prefs) return '';
  const parts: string[] = [];
  if (prefs.stablecoinOnly !== undefined) {
    parts.push(`stablecoinOnly: ${prefs.stablecoinOnly ? 'true' : 'false'}`);
  }
  if (prefs.risk) {
    parts.push(`risk: ${prefs.risk}`);
  }
  if (prefs.timeHorizon) {
    parts.push(`timeHorizon: ${prefs.timeHorizon}`);
  }
  if (!parts.length) return '';
  return (
    `\nUser preferences (apply if relevant): ${parts.join(', ')}.\n` +
    `- If stablecoinOnly is true, avoid suggestions that require non-stable assets unless the user already asked for them.\n` +
    `- Align tone with risk and time horizon (low risk = safer options, short horizon = quicker liquidity).`
  );
};

const formatLastSelection = (selection?: ChatMemory['lastSelection'] | null) => {
  if (!selection) return '';
  const parts: string[] = [];
  if (selection.tokenSymbol) parts.push(`token: ${selection.tokenSymbol}`);
  if (selection.protocol) parts.push(`protocol: ${selection.protocol}`);
  if (selection.poolId) parts.push(`poolId: ${selection.poolId}`);
  if (!parts.length) return '';
  return (
    `\nLast selection context: ${parts.join(', ')}.\n` +
    `- If suggesting follow-ups, reference this selection when relevant (e.g., "continue with ${selection.protocol}" or "use ${selection.tokenSymbol}").`
  );
};

export const determineSuggestionsPrompt = (
  messages: Message[],
  prefs?: ChatMemory['userPrefs'] | null,
  lastSelection?: ChatMemory['lastSelection'] | null,
): string => {
  void messages;
  return `${basePrompt}${formatPrefs(prefs)}${formatLastSelection(lastSelection)}`;
};
