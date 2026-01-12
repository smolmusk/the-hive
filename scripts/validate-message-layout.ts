import type { Message as MessageType } from 'ai';
import {
  getSummaryFromAnnotations,
  resolveMessageLayout,
  shouldRenderSummary,
} from '@/lib/chat/message-layout';

type LayoutFixture = {
  name: string;
  message?: MessageType;
  hasTools: boolean;
  expected: string[];
};

const fixtures: LayoutFixture[] = [
  {
    name: 'Normalizes annotated layout order',
    message: {
      id: '1',
      role: 'assistant',
      content: 'Here are your options.',
      annotations: [{ layout: ['text', 'tool'] }],
    },
    hasTools: true,
    expected: ['tool', 'text'],
  },
  {
    name: 'Allows summary block ordering',
    message: {
      id: '2',
      role: 'assistant',
      content: 'Summary text.',
      annotations: [{ layout: ['tool', 'summary'], summary: 'Short summary.' }],
    },
    hasTools: true,
    expected: ['tool', 'summary'],
  },
  {
    name: 'Allows card block ordering',
    message: {
      id: '2b',
      role: 'assistant',
      content: 'Card layout.',
      annotations: [{ layout: ['card', 'summary'], summary: 'Cards summary.' }],
    },
    hasTools: true,
    expected: ['card', 'summary'],
  },
  {
    name: 'Cards then text maps to tool then text',
    message: {
      id: '3',
      role: 'assistant',
      content: 'Cards then text.',
      annotations: [{ layout: ['tool', 'text'] }],
    },
    hasTools: true,
    expected: ['tool', 'text'],
  },
  {
    name: 'Defaults to tool then text when tools exist',
    message: {
      id: '4',
      role: 'assistant',
      content: 'Tool response.',
    },
    hasTools: true,
    expected: ['tool', 'text'],
  },
  {
    name: 'Defaults to text only when no tools',
    message: {
      id: '5',
      role: 'assistant',
      content: 'Plain text response.',
    },
    hasTools: false,
    expected: ['text'],
  },
  {
    name: 'Ignores invalid layout annotations',
    message: {
      id: '6',
      role: 'assistant',
      content: 'Fallback layout.',
      annotations: [{ layout: ['text', 'unknown'] }],
    },
    hasTools: true,
    expected: ['tool', 'text'],
  },
];

const run = () => {
  const failures: string[] = [];

  fixtures.forEach((fixture) => {
    const actual = resolveMessageLayout(fixture.message, fixture.hasTools);
    const actualString = JSON.stringify(actual);
    const expectedString = JSON.stringify(fixture.expected);
    if (actualString !== expectedString) {
      failures.push(`[${fixture.name}] expected ${expectedString}, got ${actualString}`);
    }
  });

  const summaryMessage: MessageType = {
    id: 'summary-1',
    role: 'assistant',
    content: 'Base text.',
    annotations: [{ summary: 'Summary text.' }],
  };
  const summary = getSummaryFromAnnotations(summaryMessage);
  if (summary !== 'Summary text.') {
    failures.push(`[Summary extraction] expected "Summary text.", got "${summary}"`);
  }

  const summaryLayout: MessageType = {
    id: 'summary-2',
    role: 'assistant',
    content: 'Summary only when layout allows.',
    annotations: [{ layout: ['tool', 'summary'], summary: 'Summary allowed.' }],
  };
  if (!shouldRenderSummary(['tool', 'summary'], getSummaryFromAnnotations(summaryLayout))) {
    failures.push('[Summary render] expected summary to render when layout includes summary');
  }

  const summaryBlockedLayout: MessageType = {
    id: 'summary-3',
    role: 'assistant',
    content: 'Summary not allowed.',
    annotations: [{ summary: 'Summary ignored.' }],
  };
  if (shouldRenderSummary(['tool', 'text'], getSummaryFromAnnotations(summaryBlockedLayout))) {
    failures.push('[Summary render] expected summary to be skipped without summary layout block');
  }

  if (failures.length) {
    // eslint-disable-next-line no-console
    console.error(`validate-message-layout failed:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`validate-message-layout passed (${fixtures.length} fixtures)`);
};

run();
