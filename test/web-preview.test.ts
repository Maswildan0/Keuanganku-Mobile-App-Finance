import test from 'node:test';
import assert from 'node:assert/strict';
import { getFinanceRuntime } from '../src/state/platform';
import { createWebPreviewSnapshot } from '../src/state/webPreviewData';

test('platform selects web preview versus native runtime', () => {
  assert.equal(getFinanceRuntime('web'), 'web-preview');
  assert.equal(getFinanceRuntime('android'), 'native');
  assert.equal(getFinanceRuntime('ios'), 'native');
});

test('web preview snapshot initializes without native persistence', () => {
  const snapshot = createWebPreviewSnapshot();
  assert.equal(snapshot.accounts.length, 3);
  assert.ok(snapshot.transactions.length > 0);
  assert.equal(snapshot.fixedBudgets.length, 4);
  assert.equal(snapshot.flexibleBudgets.reduce((sum, item) => sum + item.percentage, 0), 100);
  assert.equal(snapshot.userName, 'Wildan');
});
