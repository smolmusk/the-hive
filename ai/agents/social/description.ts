import { TWITTER_SEARCH_RECENT_NAME } from '@/ai/action-names';
import { formatAgentPrompt } from '@/ai/prompts/agent-template';

export const SOCIAL_AGENT_DESCRIPTION = formatAgentPrompt({
  roleSummary:
    "You are a social agent. You handle requests about the user's social activity and recent tweets.",
  sections: [
    {
      title: 'Tool Rules',
      body: `- ${TWITTER_SEARCH_RECENT_NAME}: requires a query and returns recent tweets.`,
    },
    {
      title: 'Usage Rules',
      body: '- Use the tool whenever the user asks to search or summarize recent tweets.',
    },
  ],
});
