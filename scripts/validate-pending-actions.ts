import { getPendingActionMessage } from '@/lib/chat/pending-action';
import { pendingActionFixtures } from './pending-action-fixtures';

const failures: string[] = [];

pendingActionFixtures.forEach((fixture) => {
  const actual = getPendingActionMessage(fixture.input);
  if (actual !== fixture.expected) {
    failures.push(
      `${fixture.name} expected ${JSON.stringify(fixture.expected)}, got ${JSON.stringify(actual)}`,
    );
  }
});

if (failures.length) {
  console.error('validate-pending-actions failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`validate-pending-actions passed (${pendingActionFixtures.length} fixtures)`);
