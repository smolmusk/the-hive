import { agentPrompts } from '@/ai/agents/prompt-registry';
import { promptAuditFixtures } from './prompt-audit-fixtures';

type PromptIssue = {
  agent: string;
  issue: string;
};

const MAX_PROMPT_LENGTH = 12000;
const MIN_DUPLICATE_LENGTH = 24;
const BANNED_PHRASES = ['regex', 'keyword matching', 'string matching', 'pattern matching', 'NEVER EVER'];

const normalizeLine = (line: string) => line.trim().replace(/\s+/g, ' ').toLowerCase();

const findDuplicateLines = (prompt: string): string[] => {
  const counts = new Map<string, number>();
  const original = new Map<string, string>();

  prompt
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= MIN_DUPLICATE_LENGTH)
    .forEach((line) => {
      const normalized = normalizeLine(line);
      if (!normalized) return;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      if (!original.has(normalized)) {
        original.set(normalized, line);
      }
    });

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([line]) => original.get(line) || line);
};

const findBannedPhrases = (prompt: string): string[] => {
  const lower = prompt.toLowerCase();
  return BANNED_PHRASES.filter((phrase) => lower.includes(phrase.toLowerCase()));
};

const issues: PromptIssue[] = [];
const promptsByAgent = new Map<string, string[]>();
agentPrompts.forEach((agent) => {
  const existing = promptsByAgent.get(agent.name) ?? [];
  existing.push(agent.prompt);
  promptsByAgent.set(agent.name, existing);
});

agentPrompts.forEach((agent) => {
  const prompt = agent.prompt || '';
  if (prompt.length > MAX_PROMPT_LENGTH) {
    issues.push({
      agent: agent.name,
      issue: `Prompt length ${prompt.length} exceeds max ${MAX_PROMPT_LENGTH}`,
    });
  }

  const bannedHits = findBannedPhrases(prompt);
  if (bannedHits.length) {
    issues.push({
      agent: agent.name,
      issue: `Contains banned phrases: ${bannedHits.join(', ')}`,
    });
  }

  const duplicates = findDuplicateLines(prompt);
  if (duplicates.length) {
    issues.push({
      agent: agent.name,
      issue: `Duplicate lines detected: ${duplicates.join(' | ')}`,
    });
  }
});

promptAuditFixtures.forEach((fixture) => {
  fixture.requiredLines.forEach((line) => {
    const normalizedLine = normalizeLine(line);
    const prompts = promptsByAgent.get(fixture.agentName);
    if (!prompts || !prompts.length) {
      issues.push({
        agent: fixture.agentName,
        issue: 'Prompt not found for audit fixture',
      });
      return;
    }

    const matches = prompts.filter((candidate) => {
      const normalizedPromptLines = candidate.split('\n').map(normalizeLine);
      return (
        normalizedPromptLines.includes(normalizedLine) ||
        normalizeLine(candidate).includes(normalizedLine)
      );
    }).length;
    const minMatches = fixture.minMatches ?? 1;
    if (matches < minMatches) {
      issues.push({
        agent: fixture.agentName,
        issue: `Missing required line: ${line} (${matches}/${minMatches} matches)`,
      });
    }
  });
});

if (issues.length) {
  console.error('validate-prompts failed:');
  issues.forEach((issue) => {
    console.error(`- [${issue.agent}] ${issue.issue}`);
  });
  process.exit(1);
}

console.log(`validate-prompts passed (${agentPrompts.length} agents)`);
