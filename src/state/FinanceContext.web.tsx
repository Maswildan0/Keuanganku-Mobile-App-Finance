import React, { createContext, useContext, useMemo, useState } from 'react';
import { CATEGORY_DEFAULTS, getAccountBalances, getBudgetCategorySpend, getBudgetableMoney, getCategorySpend, getFlexibleAllocations, getFlexiblePool, getFixedTotal, getMonthEnd, getMonthStart, getProtectedMoney, getToday, getTotalBalance } from '../domain/finance';
import { getPeriodRange } from '../domain/budget';
import { Account, BudgetAllocationView, BudgetRole, BudgetSettings, FinanceSnapshot, FixedBudget, FlexibleAllocation, FlexibleBudget, Transaction } from '../domain/models';
import { FinanceState } from './financeState';
import { createWebPreviewSnapshot } from './webPreviewData';

const periodSettings: BudgetSettings = { id: 1, cycleType: 'MONTH_START', resetDay: 1, defaultRolloverMode: 'NONE' };
const periodRange = getPeriodRange(getToday(), periodSettings);
const initialSnapshot = createWebPreviewSnapshot();
const PreviewContext = createContext<FinanceState | null>(null);
const newId = (prefix: string) => `web-${prefix}-${Date.now()}`;

export function FinanceProvider({ children }: React.PropsWithChildren) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const balances = useMemo(() => getAccountBalances(snapshot.accounts, snapshot.transactions), [snapshot]);
  const totalMoney = useMemo(() => getTotalBalance(snapshot.accounts, snapshot.transactions), [snapshot]);
  const budgetableMoney = useMemo(() => getBudgetableMoney(snapshot.accounts, snapshot.transactions), [snapshot]);
  const protectedMoney = useMemo(() => getProtectedMoney(snapshot.accounts, snapshot.transactions), [snapshot]);
  const fixedTotal = useMemo(() => getFixedTotal(snapshot.fixedBudgets), [snapshot.fixedBudgets]);
  const flexiblePool = useMemo(() => getFlexiblePool(budgetableMoney, fixedTotal), [budgetableMoney, fixedTotal]);
  const allocations = useMemo(() => getFlexibleAllocations(snapshot.flexibleBudgets, flexiblePool).map((item) => { const spent = getBudgetCategorySpend(snapshot.transactions, snapshot.accounts, getMonthStart(), getMonthEnd())[item.id] ?? 0; return { ...item, spent, remaining: item.amount - spent, overbudget: Math.max(spent - item.amount, 0) }; }), [snapshot, flexiblePool]);
  const spend = useMemo(() => Object.fromEntries(allocations.map((item) => [item.id, item.spent ?? 0])), [allocations]);
  const actualSpend = useMemo(() => getCategorySpend(snapshot.transactions, getMonthStart(), getMonthEnd()), [snapshot.transactions]);
  const budgetAllocations: BudgetAllocationView[] = allocations.map((item) => ({ id: item.id, budgetPeriodId: `web-${periodRange.start}`, categoryId: item.id, type: 'FLEXIBLE', percentageSnapshot: item.percentage, allocatedAmount: item.amount, rolloverAmount: 0, spent: item.spent ?? 0, remaining: item.remaining ?? item.amount, overbudget: item.overbudget ?? 0 }));
  const activePeriod = { id: `web-${periodRange.start}`, startDate: periodRange.start, endDate: periodRange.end, status: 'ACTIVE' as const, budgetableMoneySnapshot: budgetableMoney, fixedTotalSnapshot: fixedTotal, flexiblePoolSnapshot: flexiblePool, inflowsAllocated: 0 };
  const updateSnapshot = (next: FinanceSnapshot) => setSnapshot(next);
  const saveAccount = async (account: Account) => updateSnapshot({ ...snapshot, accounts: account.id ? snapshot.accounts.map((item) => item.id === account.id ? account : item) : [...snapshot.accounts, { ...account, id: newId('account') }] });
  const saveTransaction = async (transaction: Transaction) => updateSnapshot({ ...snapshot, transactions: transaction.id && snapshot.transactions.some((item) => item.id === transaction.id) ? snapshot.transactions.map((item) => item.id === transaction.id ? transaction : item) : [...snapshot.transactions, { ...transaction, id: transaction.id || newId('transaction') }] });
  const removeTransaction = async (id: string) => updateSnapshot({ ...snapshot, transactions: snapshot.transactions.filter((item) => item.id !== id) });
  const saveFixedBudget = async (item: FixedBudget) => updateSnapshot({ ...snapshot, fixedBudgets: snapshot.fixedBudgets.some((current) => current.id === item.id) ? snapshot.fixedBudgets.map((current) => current.id === item.id ? item : current) : [...snapshot.fixedBudgets, { ...item, id: item.id || newId('fixed') }] });
  const removeFixedBudget = async (id: string) => updateSnapshot({ ...snapshot, fixedBudgets: snapshot.fixedBudgets.filter((item) => item.id !== id) });
  const saveFlexibleBudgets = async (items: FlexibleBudget[]) => updateSnapshot({ ...snapshot, flexibleBudgets: items });
  const saveBudgetRoles = async (roles: Array<{ id: string; budgetRole: BudgetRole }>) => updateSnapshot({ ...snapshot, accounts: snapshot.accounts.map((account) => ({ ...account, budgetRole: roles.find((role) => role.id === account.id)?.budgetRole ?? account.budgetRole })) });
  const saveUserName = async (name: string) => updateSnapshot({ ...snapshot, userName: name.trim() });
  const resetFinancialData = async () => updateSnapshot({ ...snapshot, accounts: snapshot.accounts.map((account) => ({ ...account, openingBalance: 0 })), transactions: [] });
  const state: FinanceState = { ...snapshot, loading: false, totalMoney, budgetableMoney, protectedMoney, fixedTotal, flexiblePool, shortfall: Math.max(fixedTotal - budgetableMoney, 0), activePeriod, budgetSettings: periodSettings, budgetHistory: [], budgetAllocations, unallocatedFunds: 0, safeToSpend: Math.max(allocations.reduce((sum, item) => sum + (item.remaining ?? 0), 0), 0), allocations, spend, actualSpend, saveAccount, archiveAccount: async (id) => saveAccount({ ...snapshot.accounts.find((item) => item.id === id)!, archived: true }), moveAccount: async () => undefined, saveUserName, saveTransaction, removeTransaction, saveFixedBudget, removeFixedBudget, saveFlexibleBudgets, saveBudgetRoles, saveBudgetSettings: async () => undefined, startManualBudgetPeriod: async () => undefined, reallocateBudget: async () => undefined, resetFinancialData, refresh: async () => undefined };
  return <PreviewContext.Provider value={state}>{children}</PreviewContext.Provider>;
}

export function useFinance() { const value = useContext(PreviewContext); if (!value) throw new Error('useFinance must be used inside FinanceProvider'); return value; }
