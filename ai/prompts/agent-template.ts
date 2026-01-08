export type AgentPromptSection = {
  title: string;
  body: string;
};

export type AgentPromptConfig = {
  roleSummary: string;
  sections: AgentPromptSection[];
};

export const formatAgentPrompt = ({ roleSummary, sections }: AgentPromptConfig): string => {
  const blocks: string[] = [];
  const summary = roleSummary.trim();
  if (summary) {
    blocks.push(summary);
  }

  sections.forEach((section) => {
    const title = section.title.trim();
    const body = section.body.trim();
    if (!title || !body) return;
    blocks.push(`${title}:\n${body}`);
  });

  return blocks.join('\n\n').trim();
};
