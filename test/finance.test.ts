import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCompactIDR, formatDateRange, formatExactIDR, getAccountBalances, getBudgetCategorySpend, getBudgetableMoney, getCategorySpend, getDailyCashflow, getFixedTotal, getFlexibleAllocations, getFlexiblePool, getNiceChartScale, getProtectedMoney, getToday, getWeekRange, getMonthlyCashflow, getTotalBalance, getYearlyCashflow, parseMoneyInput } from '../src/domain/finance';
import { Account, Transaction } from '../src/domain/models';

const accounts: Account[] = [{ id: 'a', name: 'Cash', type: 'Cash', openingBalance: 1000, budgetRole: 'BUDGET', archived: false, sortOrder: 0 }, { id: 'b', name: 'BCA', type: 'Bank Account', openingBalance: 500, budgetRole: 'BUDGET', archived: false, sortOrder: 1 }];
const transactions: Transaction[] = [{ id: 'income', type: 'income', amount: 300, accountId: 'a', date: '2026-10-19', time: '09:00', description: 'Gaji' }, { id: 'expense', type: 'expense', amount: 100, accountId: 'a', categoryId: 'food', date: '2026-10-19', time: '12:00', description: 'Makan' }, { id: 'transfer', type: 'transfer', amount: 200, accountId: 'a', destinationAccountId: 'b', date: '2026-10-20', time: '13:00', description: 'Pindah' }];

test('derives balances and preserves total through transfers', () => { assert.deepEqual(getAccountBalances(accounts, transactions), { a: 1000, b: 700 }); assert.equal(getTotalBalance(accounts, transactions), 1700); });
test('fixed and flexible pools', () => { assert.equal(getFixedTotal([{ amount: 900, active: true }, { amount: 100, active: false }]), 900); assert.equal(getFlexiblePool(800, 900), 0); assert.equal(getFlexiblePool(1200, 900), 300); assert.deepEqual(getFlexibleAllocations([{ id: 'food', percentage: 35, active: true }, { id: 'saving', percentage: 65, active: true }], 1000).map((item) => item.amount), [350, 650]); });
test('category spending and edited data remain derived', () => { assert.deepEqual(getCategorySpend(transactions, '2026-10-01', '2026-10-31'), { food: 100 }); const edited = transactions.map((item) => item.id === 'expense' ? { ...item, amount: 250 } : item); assert.equal(getCategorySpend(edited, '2026-10-01', '2026-10-31').food, 250); assert.equal(getCategorySpend(transactions.filter((item) => item.type !== 'expense'), '2026-10-01', '2026-10-31').food ?? 0, 0); });
test('weekly monthly yearly cashflow excludes transfers', () => { const daily = getDailyCashflow(transactions, '2026-10-19', '2026-10-25'); assert.equal(daily[0].income, 300); assert.equal(daily[0].expense, 100); assert.equal(daily[1].income, 0); assert.equal(daily[1].expense, 0); assert.equal(getMonthlyCashflow(transactions, 2026)[9].income, 300); assert.equal(getYearlyCashflow(transactions, 2026, 2026)[0].expense, 100); });

test('local date helpers keep Monday-to-Sunday ranges dynamic', () => {
  const reference = new Date(2026, 9, 23, 12, 0);
  assert.equal(getToday(reference), '2026-10-23');
  assert.deepEqual(getWeekRange('2026-10-23'), { start: '2026-10-19', end: '2026-10-25' });
  assert.equal(formatDateRange('2026-10-19', '2026-10-25'), '19–25 Okt 2026');
  assert.deepEqual(getWeekRange('2020-01-01'), { start: '2019-12-30', end: '2020-01-05' });
});

test('opening balance input preserves valid zero and Indonesian grouping', () => {
  assert.equal(parseMoneyInput('0'), 0);
  assert.equal(parseMoneyInput('1000000'), 1000000);
  assert.equal(parseMoneyInput('1.000.000'), 1000000);
  assert.equal(parseMoneyInput(''), null);
  assert.equal(parseMoneyInput('-1'), null);
  assert.equal(parseMoneyInput('Rp1.000'), null);
});

test('budgetable and protected money stay separate from total wealth', () => {
  const mixedAccounts: Account[] = [{ ...accounts[0], budgetRole: 'BUDGET' }, { ...accounts[1], budgetRole: 'PROTECTED' }];
  const mixedTransactions: Transaction[] = [...transactions, { id: 'protected-expense', type: 'expense', amount: 50, accountId: 'b', categoryId: 'food', date: '2026-10-21', time: '09:00', description: 'Protected expense' }];
  assert.equal(getTotalBalance(mixedAccounts, mixedTransactions), 1650);
  assert.equal(getBudgetableMoney(mixedAccounts, mixedTransactions), 1000);
  assert.equal(getProtectedMoney(mixedAccounts, mixedTransactions), 650);
  assert.deepEqual(getBudgetCategorySpend(mixedTransactions, mixedAccounts, '2026-10-01', '2026-10-31'), { food: 100 });
  assert.deepEqual(getCategorySpend(mixedTransactions, '2026-10-01', '2026-10-31'), { food: 150 });
});

test('chart formatters and shared scale use readable Indonesian values', () => {
  assert.equal(formatExactIDR(3182959), 'Rp3.182.959');
  assert.equal(formatCompactIDR(0), '0');
  assert.equal(formatCompactIDR(5000), '5 rb');
  assert.equal(formatCompactIDR(1500000), '1,5 jt');
  assert.equal(formatCompactIDR(3182959), '3,2 jt');
  assert.deepEqual(getNiceChartScale([3182959, 500000]).ticks, [0, 1000000, 2000000, 3000000, 4000000]);
  assert.deepEqual(getNiceChartScale([0, 0]).ticks, [0]);
});
