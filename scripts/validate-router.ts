import {
  SolanaRouterDecisionSchema,
  normalizeSolanaRouterDecision,
} from '@/ai/routing/solana-router';
import { routerFixtures } from '@/scripts/router-fixtures';

const stableStringify = (value: unknown): string => {
  const normalize = (input: any): any => {
    if (!input || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map(normalize);
    const entries = Object.entries(input)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => [key, normalize(val)]);
    return Object.fromEntries(entries);
  };

  return JSON.stringify(normalize(value));
};

const fail = (message: string) => {
  throw new Error(message);
};

const run = () => {
  const failures: string[] = [];

  for (const fixture of routerFixtures) {
    try {
      const normalized = normalizeSolanaRouterDecision(fixture.input, fixture.context);
      SolanaRouterDecisionSchema.parse(normalized);

      const expected = stableStringify(fixture.expected);
      const actual = stableStringify(normalized);

      if (expected !== actual) {
        fail(`[${fixture.name}] expected ${expected}, got ${actual}`);
      }
    } catch (error) {
      failures.push((error as Error).message);
    }
  }

  if (failures.length) {
    // eslint-disable-next-line no-console
    console.error(`validate-router failed:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`validate-router passed (${routerFixtures.length} fixtures)`);
};

run();
