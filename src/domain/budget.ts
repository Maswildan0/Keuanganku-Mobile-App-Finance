import { Account, BudgetSettings, FlexibleBudget, Transaction } from './models';
import { getAccountBalances, getBudgetableMoney, getMonthEnd, getMonthStart, getToday, parseDate, toDateKey } from './finance';

export function getPeriodRange(referenceDate: string, settings: BudgetSettings) {
  const date = parseDate(referenceDate);
  if (settings.cycleType === 'MONTH_START' || !settings.resetDay) return { start: getMonthStart(date), end: getMonthEnd(date) };
  const resetDay = Math.max(1, Math.min(settings.resetDay, 31));
  const candidate = new Date(date.getFullYear(), date.getMonth(), Math.min(resetDay, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  if (date < candidate) candidate.setMonth(candidate.getMonth() - 1);
  const start = toDateKey(candidate);
  const next = new Date(candidate.getFullYear(), candidate.getMonth() + 1, Math.min(resetDay, new Date(candidate.getFullYear(), candidate.getMonth() + 2, 0).getDate()));
  const end = toDateKey(new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1));
  return { start, end };
}

export function getBudgetInflows(periodStart: string, transactions: Transaction[], accounts: Account[]) {
  const roleByAccount = new Map(accounts.map((account) => [account.id, account.budgetRole]));
  return transactions.reduce((sum, transaction) => {
    if (transaction.date < periodStart) return sum;
    if (transaction.type === 'income' && roleByAccount.get(transaction.accountId) === 'BUDGET') return sum + transaction.amount;
    if (transaction.type === 'transfer' && transaction.destinationAccountId && roleByAccount.get(transaction.destinationAccountId) === 'BUDGET' && roleByAccount.get(transaction.accountId) === 'PROTECTED') return sum + transaction.amount;
    return sum;
  }, 0);
}

export function getBudgetSpending(periodStart: string, periodEnd: string, transactions: Transaction[], accounts: Account[]) {
  const budgetAccountIds = new Set(accounts.filter((account) => !account.archived && account.budgetRole === 'BUDGET').map((account) => account.id));
  return transactions.filter((transaction) => transaction.type === 'expense' && transaction.date >= periodStart && transaction.date <= periodEnd && budgetAccountIds.has(transaction.accountId));
}

export function getFlexibleSnapshotAllocations(budgets: FlexibleBudget[], flexiblePool: number) {
  return budgets.filter((item) => item.active).map((item) => ({ categoryId: item.id, percentage: item.percentage, amount: Math.round(flexiblePool * item.percentage / 100) }));
}

export function getCurrentBudgetInputs(accounts: Account[], transactions: Transaction[], fixedBudgets: Array<{ amount: number; active: boolean }>) {
  const budgetableMoney = getBudgetableMoney(accounts, transactions);
  const fixedTotal = fixedBudgets.filter((item) => item.active).reduce((sum, item) => sum + item.amount, 0);
  return { budgetableMoney, fixedTotal, flexiblePool: Math.max(budgetableMoney - fixedTotal, 0), balances: getAccountBalances(accounts, transactions) };
}

export const getDefaultBudgetSettings = (): BudgetSettings => ({ id: 1, cycleType: 'MONTH_START', resetDay: 1, defaultRolloverMode: 'NONE' });
export const getTodayPeriod = (settings: BudgetSettings) => getPeriodRange(getToday(), settings);
