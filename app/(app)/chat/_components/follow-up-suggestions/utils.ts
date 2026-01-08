import { Message } from 'ai';

const basePrompt = `Generate 3 follow-up suggestions for what I can do next. They can be declarative or questions. The prompts should be specific to the previous messages. Reference specific tokens, projects, etc.

IMPORTANT:
- Only suggest lending for stablecoins (e.g., USDC, USDT, USDG). Do NOT suggest lending for non-stable assets (e.g., SPYX, SOL, ETH).
- Keep suggestions actionable and relevant to the discussed tokens.`;

export const determineSuggestionsPrompt = (messages: Message[]): string => {
  void messages;
  return basePrompt;
};
