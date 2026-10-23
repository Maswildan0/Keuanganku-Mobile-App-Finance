import * as SQLite from 'expo-sqlite';
import { Account, Category, FinanceSnapshot, FixedBudget, FlexibleBudget, Transaction } from '../domain/models';

const asBool = (value: number) => value === 1;
export async function loadSnapshot(db: SQLite.SQLiteDatabase): Promise<FinanceSnapshot> {
  const [accounts, transactions, categories, fixedBudgets, flexibleBudgets] = await Promise.all([
    db.getAllAsync<any>('SELECT id, name, type, institution, opening_balance as openingBalance, is_archived as archived, sort_order as sortOrder FROM accounts ORDER BY sort_order, name'),
    db.getAllAsync<any>('SELECT id, type, amount, account_id as accountId, destination_account_id as destinationAccountId, category_id as categoryId, transaction_date as date, transaction_time as time, description, notes FROM transactions ORDER BY transaction_date DESC, transaction_time DESC'),
    db.getAllAsync<Category>('SELECT id, name, icon, type FROM categories WHERE is_active = 1 ORDER BY name'),
    db.getAllAsync<any>('SELECT id, name, amount, due_day as dueDay, recurrence, is_active as active FROM fixed_budgets ORDER BY due_day, name'),
    db.getAllAsync<any>('SELECT id, percentage, is_active as active FROM flexible_budgets ORDER BY rowid'),
  ]);
  return {
    accounts: accounts.map((item) => ({ ...item, archived: asBool(item.archived), openingBalance: Number(item.openingBalance), sortOrder: Number(item.sortOrder) })) as Account[],
    transactions: transactions.map((item) => ({ ...item, amount: Number(item.amount) })) as Transaction[],
    categories,
    fixedBudgets: fixedBudgets.map((item) => ({ ...item, amount: Number(item.amount), dueDay: item.dueDay == null ? undefined : Number(item.dueDay), active: asBool(item.active) })) as FixedBudget[],
    flexibleBudgets: flexibleBudgets.map((item) => ({ ...item, percentage: Number(item.percentage), active: asBool(item.active) })) as FlexibleBudget[],
  };
}

export async function insertAccount(db: SQLite.SQLiteDatabase, account: Account) {
  await db.runAsync('INSERT INTO accounts (id, name, type, institution, opening_balance, is_archived, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', account.id, account.name, account.type, account.institution ?? '', account.openingBalance, account.archived ? 1 : 0, account.sortOrder);
}
export async function updateAccount(db: SQLite.SQLiteDatabase, account: Account) {
  await db.runAsync('UPDATE accounts SET name = ?, type = ?, institution = ?, opening_balance = ?, is_archived = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', account.name, account.type, account.institution ?? '', account.openingBalance, account.archived ? 1 : 0, account.sortOrder, account.id);
}
export async function reorderAccount(db: SQLite.SQLiteDatabase, accountId: string, nextOrder: number) { await db.runAsync('UPDATE accounts SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', nextOrder, accountId); }
export async function insertTransaction(db: SQLite.SQLiteDatabase, transaction: Transaction) {
  await db.runAsync('INSERT INTO transactions (id, type, amount, account_id, destination_account_id, category_id, transaction_date, transaction_time, description, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', transaction.id, transaction.type, transaction.amount, transaction.accountId, transaction.destinationAccountId ?? null, transaction.categoryId ?? null, transaction.date, transaction.time, transaction.description ?? '', transaction.notes ?? '');
}
export async function insertFixedBudget(db: SQLite.SQLiteDatabase, item: FixedBudget) { await db.runAsync('INSERT INTO fixed_budgets (id, name, amount, due_day, recurrence, is_active) VALUES (?, ?, ?, ?, ?, ?)', item.id, item.name, item.amount, item.dueDay ?? null, item.recurrence, item.active ? 1 : 0); }
export async function updateFixedBudget(db: SQLite.SQLiteDatabase, item: FixedBudget) { await db.runAsync('UPDATE fixed_budgets SET name = ?, amount = ?, due_day = ?, recurrence = ?, is_active = ? WHERE id = ?', item.name, item.amount, item.dueDay ?? null, item.recurrence, item.active ? 1 : 0, item.id); }
export async function updateFlexibleBudgets(db: SQLite.SQLiteDatabase, items: FlexibleBudget[]) { for (const item of items) await db.runAsync('UPDATE flexible_budgets SET percentage = ?, is_active = ? WHERE id = ?', item.percentage, item.active ? 1 : 0, item.id); }
export async function replaceTransaction(db: SQLite.SQLiteDatabase, transaction: Transaction) { await db.runAsync('DELETE FROM transactions WHERE id = ?', transaction.id); await insertTransaction(db, transaction); }
export async function deleteTransaction(db: SQLite.SQLiteDatabase, id: string) { await db.runAsync('DELETE FROM transactions WHERE id = ?', id); }
