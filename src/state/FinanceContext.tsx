import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getCategorySpend, getFlexibleAllocations, getFlexiblePool, getFixedTotal, getTotalBalance } from '../domain/finance';
import { Account, FinanceSnapshot, FixedBudget, FlexibleAllocation, FlexibleBudget, Transaction } from '../domain/models';
import { deleteTransaction, insertAccount, insertFixedBudget, insertTransaction, loadSnapshot, reorderAccount, replaceTransaction, saveSetting, updateAccount, updateFixedBudget, updateFlexibleBudgets } from '../db/repository';

export type FinanceState = FinanceSnapshot & { loading: boolean; totalMoney: number; fixedTotal: number; flexiblePool: number; allocations: FlexibleAllocation[]; spend: Record<string, number>; saveAccount: (account: Account) => Promise<void>; archiveAccount: (id: string) => Promise<void>; moveAccount: (id: string, nextOrder: number) => Promise<void>; saveUserName: (name: string) => Promise<void>; saveTransaction: (transaction: Transaction) => Promise<void>; removeTransaction: (id: string) => Promise<void>; saveFixedBudget: (item: FixedBudget) => Promise<void>; saveFlexibleBudgets: (items: FlexibleBudget[]) => Promise<void>; refresh: () => Promise<void> };
const FinanceContext = createContext<FinanceState | null>(null);
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function FinanceProvider({ children }: React.PropsWithChildren) {
  const db = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<FinanceSnapshot>({ accounts: [], transactions: [], categories: [], fixedBudgets: [], flexibleBudgets: [], userName: 'Ardi Rahman' });
  const [loading, setLoading] = useState(true);
  const refresh = async () => { setSnapshot(await loadSnapshot(db)); setLoading(false); };
  useEffect(() => { refresh(); }, [db]);
  const saveAccount = async (account: Account) => { if (account.id) await updateAccount(db, account); else await insertAccount(db, { ...account, id: newId('account') }); await refresh(); };
  const archiveAccount = async (id: string) => { const account = snapshot.accounts.find((item) => item.id === id); if (!account) return; await updateAccount(db, { ...account, archived: true }); await refresh(); };
  const moveAccount = async (id: string, nextOrder: number) => { await reorderAccount(db, id, nextOrder); await refresh(); };
  const saveUserName = async (name: string) => { const trimmed = name.trim(); if (!trimmed) return; await saveSetting(db, 'user_name', trimmed); await refresh(); };
  const saveTransaction = async (transaction: Transaction) => { if (transaction.type === 'transfer' && (!transaction.destinationAccountId || transaction.destinationAccountId === transaction.accountId)) throw new Error('Pilih dua rekening yang berbeda.'); await db.withTransactionAsync(async () => { if (snapshot.transactions.some((item) => item.id === transaction.id)) await replaceTransaction(db, transaction); else await insertTransaction(db, { ...transaction, id: transaction.id || newId('transaction') }); }); await refresh(); };
  const removeTransaction = async (id: string) => { await db.withTransactionAsync(async () => { await deleteTransaction(db, id); }); await refresh(); };
  const saveFixedBudget = async (item: FixedBudget) => { if (snapshot.fixedBudgets.some((current) => current.id === item.id)) await updateFixedBudget(db, item); else await insertFixedBudget(db, { ...item, id: item.id || newId('fixed') }); await refresh(); };
  const saveFlexibleBudgets = async (items: FlexibleBudget[]) => { if (items.reduce((sum, item) => sum + item.percentage, 0) !== 100) throw new Error('Total alokasi harus 100%.'); await db.withTransactionAsync(async () => updateFlexibleBudgets(db, items)); await refresh(); };
  const totalMoney = useMemo(() => getTotalBalance(snapshot.accounts, snapshot.transactions), [snapshot]);
  const fixedTotal = useMemo(() => getFixedTotal(snapshot.fixedBudgets), [snapshot.fixedBudgets]);
  const flexiblePool = useMemo(() => getFlexiblePool(totalMoney, fixedTotal), [totalMoney, fixedTotal]);
  const allocations = useMemo(() => getFlexibleAllocations(snapshot.flexibleBudgets, flexiblePool), [snapshot.flexibleBudgets, flexiblePool]);
  const spend = useMemo(() => getCategorySpend(snapshot.transactions, '2026-10-01', '2026-10-31'), [snapshot.transactions]);
  return <FinanceContext.Provider value={{ ...snapshot, loading, totalMoney, fixedTotal, flexiblePool, allocations, spend, saveAccount, archiveAccount, moveAccount, saveUserName, saveTransaction, removeTransaction, saveFixedBudget, saveFlexibleBudgets, refresh }}>{children}</FinanceContext.Provider>;
}

export function useFinance() { const value = useContext(FinanceContext); if (!value) throw new Error('useFinance must be used inside FinanceProvider'); return value; }
