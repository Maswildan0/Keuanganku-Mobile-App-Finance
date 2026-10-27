import type * as SQLite from 'expo-sqlite';
import { SEED_ACCOUNTS, SEED_FIXED, SEED_FLEXIBLE } from './database';
import { CATEGORY_DEFAULTS } from '../domain/finance';
import { Account, BudgetRole, Category, FinanceSnapshot, FixedBudget, FlexibleBudget, Transaction } from '../domain/models';

type Database = SQLite.SQLiteDatabase;
const asBool = (value: number) => value === 1;
function assertOpeningBalance(value: number) { if (!Number.isSafeInteger(value) || value < 0) throw new Error('Saldo awal harus berupa angka bulat nol atau lebih.'); }

export async function loadSnapshot(db: Database): Promise<FinanceSnapshot> {
  const [accounts, transactions, categories, fixedBudgets, flexibleBudgets, settings] = await Promise.all([
    db.getAllAsync<any>('SELECT id, name, type, institution, opening_balance as openingBalance, budget_role as budgetRole, is_archived as archived, sort_order as sortOrder FROM accounts ORDER BY sort_order, name'),
    db.getAllAsync<any>('SELECT id, type, amount, account_id as accountId, destination_account_id as destinationAccountId, category_id as categoryId, transaction_date as date, transaction_time as time, description, notes FROM transactions ORDER BY transaction_date DESC, transaction_time DESC'),
    db.getAllAsync<Category>('SELECT id, name, icon, type FROM categories WHERE is_active = 1 ORDER BY name'),
    db.getAllAsync<any>('SELECT id, name, amount, due_day as dueDay, recurrence, is_active as active FROM fixed_budgets ORDER BY due_day, name'),
    db.getAllAsync<any>('SELECT id, percentage, is_active as active FROM flexible_budgets ORDER BY rowid'),
    db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'user_name'),
  ]);
  return {
    accounts: accounts.map((item) => ({ ...item, budgetRole: item.budgetRole === 'PROTECTED' ? 'PROTECTED' : 'BUDGET', archived: asBool(item.archived), openingBalance: Number(item.openingBalance), sortOrder: Number(item.sortOrder) })) as Account[],
    transactions: transactions.map((item) => ({ ...item, amount: Number(item.amount) })) as Transaction[],
    categories,
    fixedBudgets: fixedBudgets.map((item) => ({ ...item, amount: Number(item.amount), dueDay: item.dueDay == null ? undefined : Number(item.dueDay), active: asBool(item.active) })) as FixedBudget[],
    flexibleBudgets: flexibleBudgets.map((item) => ({ ...item, percentage: Number(item.percentage), active: asBool(item.active) })) as FlexibleBudget[],
    userName: settings?.value ?? 'Ardi Rahman',
  };
}

async function ensureTransactionReferences(db: Database, transaction: Transaction) {
  const account = await db.getFirstAsync<{ id: string }>('SELECT id FROM accounts WHERE id = ?', transaction.accountId);
  if (!account) throw new Error('Rekening tidak tersedia. Pilih rekening kembali.');
  if (transaction.type === 'transfer') {
    if (!transaction.destinationAccountId || transaction.destinationAccountId === transaction.accountId) throw new Error('Pilih dua rekening transfer yang berbeda.');
    const destination = await db.getFirstAsync<{ id: string }>('SELECT id FROM accounts WHERE id = ?', transaction.destinationAccountId);
    if (!destination) throw new Error('Rekening tujuan tidak tersedia. Pilih rekening kembali.');
    return;
  }
  if (!transaction.categoryId) throw new Error('Kategori tidak tersedia. Pilih kategori kembali.');
  const category = await db.getFirstAsync<{ id: string }>('SELECT id FROM categories WHERE id = ? AND is_active = 1', transaction.categoryId);
  if (!category) throw new Error('Kategori tidak tersedia. Pilih kategori kembali.');
}

export async function insertAccount(db: Database, account: Account) {
  assertOpeningBalance(account.openingBalance);
  await db.runAsync('INSERT INTO accounts (id, name, type, institution, opening_balance, budget_role, is_archived, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', account.id, account.name, account.type, account.institution ?? '', account.openingBalance, account.budgetRole, account.archived ? 1 : 0, account.sortOrder);
}
export async function updateAccount(db: Database, account: Account) {
  assertOpeningBalance(account.openingBalance);
  await db.runAsync('UPDATE accounts SET name = ?, type = ?, institution = ?, opening_balance = ?, budget_role = ?, is_archived = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', account.name, account.type, account.institution ?? '', account.openingBalance, account.budgetRole, account.archived ? 1 : 0, account.sortOrder, account.id);
}
export async function reorderAccount(db: Database, accountId: string, nextOrder: number) { await db.runAsync('UPDATE accounts SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', nextOrder, accountId); }
export async function insertTransaction(db: Database, transaction: Transaction) {
  await ensureTransactionReferences(db, transaction);
  await db.runAsync('INSERT INTO transactions (id, type, amount, account_id, destination_account_id, category_id, transaction_date, transaction_time, description, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', transaction.id, transaction.type, transaction.amount, transaction.accountId, transaction.destinationAccountId ?? null, transaction.categoryId ?? null, transaction.date, transaction.time, transaction.description ?? '', transaction.notes ?? '');
}
export async function insertFixedBudget(db: Database, item: FixedBudget) { await db.runAsync('INSERT INTO fixed_budgets (id, name, amount, due_day, recurrence, is_active) VALUES (?, ?, ?, ?, ?, ?)', item.id, item.name, item.amount, item.dueDay ?? null, item.recurrence, item.active ? 1 : 0); }
export async function updateFixedBudget(db: Database, item: FixedBudget) { await db.runAsync('UPDATE fixed_budgets SET name = ?, amount = ?, due_day = ?, recurrence = ?, is_active = ? WHERE id = ?', item.name, item.amount, item.dueDay ?? null, item.recurrence, item.active ? 1 : 0, item.id); }
export async function deleteFixedBudget(db: Database, id: string) { await db.runAsync('DELETE FROM fixed_budgets WHERE id = ?', id); }
export async function updateFlexibleBudgets(db: Database, items: FlexibleBudget[]) { for (const item of items) await db.runAsync('UPDATE flexible_budgets SET percentage = ?, is_active = ? WHERE id = ?', item.percentage, item.active ? 1 : 0, item.id); }
export async function replaceTransaction(db: Database, transaction: Transaction) { await db.runAsync('DELETE FROM transactions WHERE id = ?', transaction.id); await insertTransaction(db, transaction); }
export async function deleteTransaction(db: Database, id: string) { await db.runAsync('DELETE FROM transactions WHERE id = ?', id); }
export async function saveSetting(db: Database, key: string, value: string) { await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value); }
export async function updateAccountBudgetRoles(db: Database, roles: Array<{ id: string; budgetRole: BudgetRole }>) { for (const role of roles) await db.runAsync('UPDATE accounts SET budget_role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', role.budgetRole, role.id); }

export async function resetFinancialData(db: Database) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM budget_allocation_events');
    await db.runAsync('DELETE FROM budget_allocations');
    await db.runAsync('DELETE FROM budget_periods');
    await db.runAsync('DELETE FROM fixed_budgets');
    await db.runAsync('DELETE FROM flexible_budgets');
    await db.runAsync('UPDATE accounts SET opening_balance = 0');
    for (const [id, name, type, institution, opening, order] of SEED_ACCOUNTS) await db.runAsync('INSERT OR IGNORE INTO accounts (id, name, type, institution, opening_balance, sort_order) VALUES (?, ?, ?, ?, ?, ?)', id, name, type, institution, opening, order);
    for (const category of CATEGORY_DEFAULTS) {
      await db.runAsync('INSERT OR IGNORE INTO categories (id, name, icon, type, is_active) VALUES (?, ?, ?, ?, 1)', category.id, category.name, category.icon, category.type);
      await db.runAsync('UPDATE categories SET name = ?, icon = ?, type = ?, is_active = 1 WHERE id = ?', category.name, category.icon, category.type, category.id);
    }
    for (const [id, name, amount, dueDay] of SEED_FIXED) await db.runAsync('INSERT INTO fixed_budgets (id, name, amount, due_day) VALUES (?, ?, ?, ?)', id, name, amount, dueDay);
    for (const [id, percentage] of SEED_FLEXIBLE) await db.runAsync('INSERT INTO flexible_budgets (id, percentage) VALUES (?, ?)', id, percentage);
    await db.runAsync('INSERT INTO schema_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'seeded', '1');
  });
}
