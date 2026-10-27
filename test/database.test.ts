import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CURRENT_SCHEMA_VERSION, migrateDbIfNeeded, verifyDatabaseSchema } from '../src/db/database';
import { deleteFixedBudget, deleteTransaction, insertFixedBudget, insertTransaction, replaceTransaction, resetFinancialData, updateFixedBudget, updateFlexibleBudgets } from '../src/db/repository';
import { loadBudgetState, reallocateActiveBudget } from '../src/db/budget';
import { getToday } from '../src/domain/finance';

type SqlValue = string | number | null;

class TestDatabase {
  private readonly database: DatabaseSync;

  constructor(filename = ':memory:') {
    this.database = new DatabaseSync(filename);
  }

  async execAsync(sql: string) {
    this.database.exec(sql);
  }

  async runAsync(sql: string, ...params: SqlValue[]) {
    this.database.prepare(sql).run(...params);
  }

  async getFirstAsync<T>(sql: string, ...params: SqlValue[]) {
    return this.database.prepare(sql).get(...params) as T | null;
  }

  async getAllAsync<T>(sql: string, ...params: SqlValue[]) {
    return this.database.prepare(sql).all(...params) as T[];
  }

  async withTransactionAsync(task: () => Promise<void>) {
    this.database.exec('BEGIN');
    try {
      await task();
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}

test('fresh database migrates, seeds, verifies, and remains idempotent', async () => {
  const database = new TestDatabase();
  await migrateDbIfNeeded(database as never);
  await verifyDatabaseSchema(database as never);

  const tables = await database.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
  for (const table of ['schema_meta', 'settings', 'accounts', 'categories', 'transactions', 'fixed_budgets', 'flexible_budgets']) {
    assert.ok(tables.some((item) => item.name === table), `missing ${table}`);
  }
  assert.equal((await database.getFirstAsync<{ value: string }>('SELECT value FROM schema_meta WHERE key = ?', 'schema_version'))?.value, String(CURRENT_SCHEMA_VERSION));
  const firstCounts = await database.getAllAsync<{ tableName: string; count: number }>("SELECT 'accounts' AS tableName, COUNT(*) AS count FROM accounts UNION ALL SELECT 'transactions', COUNT(*) FROM transactions UNION ALL SELECT 'fixed_budgets', COUNT(*) FROM fixed_budgets UNION ALL SELECT 'flexible_budgets', COUNT(*) FROM flexible_budgets");
  assert.equal(firstCounts.find((item) => item.tableName === 'transactions')?.count, 0);
  assert.ok(firstCounts.filter((item) => item.tableName !== 'transactions').every((item) => Number(item.count) > 0));

  await migrateDbIfNeeded(database as never);
  const secondCounts = await database.getAllAsync<{ tableName: string; count: number }>("SELECT 'accounts' AS tableName, COUNT(*) AS count FROM accounts UNION ALL SELECT 'transactions', COUNT(*) FROM transactions UNION ALL SELECT 'fixed_budgets', COUNT(*) FROM fixed_budgets UNION ALL SELECT 'flexible_budgets', COUNT(*) FROM flexible_budgets");
  assert.deepEqual(secondCounts, firstCounts);
  database.close();
});

test('legacy database gains accounts without losing existing settings', async () => {
  const database = new TestDatabase();
  await database.execAsync(`
    CREATE TABLE schema_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    INSERT INTO settings (key, value) VALUES ('user_name', 'Pengguna Lama');
    INSERT INTO schema_meta (key, value) VALUES ('seeded', '1');
  `);
  await migrateDbIfNeeded(database as never);
  assert.equal((await database.getFirstAsync<{ value: string }>('SELECT value FROM schema_meta WHERE key = ?', 'seeded'))?.value, '1');
  assert.equal((await database.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'user_name'))?.value, 'Pengguna Lama');
  assert.ok(await database.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'accounts'"));
  database.close();
});

test('database data survives close and reopen without reseeding over user data', async () => {
  const filename = join(tmpdir(), `keuanganku-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  try {
    const first = new TestDatabase(filename);
    await migrateDbIfNeeded(first as never);
    await first.runAsync('INSERT INTO accounts (id, name, type, institution, opening_balance, sort_order) VALUES (?, ?, ?, ?, ?, ?)', 'persisted', 'Dompet Baru', 'E-wallet', 'Test', 125000, 99);
    first.close();

    const reopened = new TestDatabase(filename);
    await migrateDbIfNeeded(reopened as never);
    const account = await reopened.getFirstAsync<{ name: string; opening_balance: number }>('SELECT name, opening_balance FROM accounts WHERE id = ?', 'persisted');
    assert.equal(account?.name, 'Dompet Baru');
    assert.equal(account?.opening_balance, 125000);
    reopened.close();
  } finally {
    try { unlinkSync(filename); } catch { /* The test database may already be cleaned up by the runtime. */ }
  }
});

test('explicit financial reset clears user records and restores zero master accounts', async () => {
  const database = new TestDatabase();
  await migrateDbIfNeeded(database as never);
  await database.runAsync('INSERT INTO accounts (id, name, type, institution, opening_balance, sort_order) VALUES (?, ?, ?, ?, ?, ?)', 'custom', 'Dompet Pribadi', 'E-wallet', 'Test', 500000, 99);
  await database.runAsync('UPDATE accounts SET budget_role = ? WHERE id = ?', 'PROTECTED', 'custom');
  await database.runAsync('INSERT INTO transactions (id, type, amount, account_id, category_id, transaction_date, transaction_time, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 'custom-tx', 'expense', 100000, 'custom', 'food', '2026-01-01', '10:00', 'Test');
  await resetFinancialData(database as never);
  assert.equal((await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM transactions'))?.count, 0);
  const accounts = await database.getAllAsync<{ id: string; opening_balance: number; budget_role: string }>('SELECT id, opening_balance, budget_role FROM accounts ORDER BY sort_order');
  assert.deepEqual(accounts.map((account) => [account.id, account.opening_balance, account.budget_role]), [['cash', 0, 'BUDGET'], ['bca', 0, 'BUDGET'], ['bni', 0, 'BUDGET'], ['custom', 0, 'PROTECTED']]);
  database.close();
});

test('reset then income expense transfer edit and delete preserve foreign-key integrity', async () => {
  const database = new TestDatabase();
  await migrateDbIfNeeded(database as never);
  await resetFinancialData(database as never);
  await insertTransaction(database as never, { id: 'income-1', type: 'income', amount: 300000, accountId: 'cash', categoryId: 'salary', date: '2026-01-01', time: '09:00', description: 'Gaji' });
  assert.equal((await database.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys, 1);
  const foreignKeyList = await database.getAllAsync<{ from: string }>('PRAGMA foreign_key_list(transactions)');
  assert.deepEqual(foreignKeyList.map((item) => item.from).sort(), ['account_id', 'category_id', 'destination_account_id']);
  await insertTransaction(database as never, { id: 'expense-1', type: 'expense', amount: 50000, accountId: 'cash', categoryId: 'food', date: '2026-01-01', time: '10:00', description: 'Makan' });
  await insertTransaction(database as never, { id: 'transfer-1', type: 'transfer', amount: 100000, accountId: 'cash', destinationAccountId: 'bca', date: '2026-01-01', time: '11:00', description: 'Pindah' });
  await replaceTransaction(database as never, { id: 'expense-1', type: 'expense', amount: 75000, accountId: 'cash', categoryId: 'food', date: '2026-01-01', time: '10:00', description: 'Makan besar' });
  await deleteTransaction(database as never, 'income-1');
  await assert.rejects(() => insertTransaction(database as never, { id: 'invalid', type: 'expense', amount: 1, accountId: 'missing', categoryId: 'food', date: '2026-01-01', time: '12:00', description: 'Invalid' }), /Rekening tidak tersedia/);
  const violations = await database.getAllAsync('PRAGMA foreign_key_check');

  assert.equal(violations.length, 0);
  database.close();
});
test('fixed and flexible budget mutations persist and cleanly recalculate inputs', async () => {
  const database = new TestDatabase();
  await migrateDbIfNeeded(database as never);
  await insertFixedBudget(database as never, { id: 'custom-fixed', name: 'Asuransi', amount: 900000, dueDay: 15, recurrence: 'monthly', active: true });
  await updateFixedBudget(database as never, { id: 'custom-fixed', name: 'Asuransi', amount: 750000, dueDay: 20, recurrence: 'monthly', active: true });
  assert.equal((await database.getFirstAsync<{ amount: number }>('SELECT amount FROM fixed_budgets WHERE id = ?', 'custom-fixed'))?.amount, 750000);
  await deleteFixedBudget(database as never, 'custom-fixed');
  assert.equal((await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM fixed_budgets WHERE id = ?', 'custom-fixed'))?.count, 0);
  await updateFlexibleBudgets(database as never, [{ id: 'food', percentage: 40, active: true }, { id: 'transport', percentage: 10, active: true }, { id: 'lifestyle', percentage: 10, active: true }, { id: 'savings', percentage: 30, active: true }, { id: 'free', percentage: 10, active: true }]);
  assert.equal((await database.getFirstAsync<{ percentage: number }>('SELECT percentage FROM flexible_budgets WHERE id = ?', 'food'))?.percentage, 40);
  database.close();
});

test('active period freezes allocations until explicit reallocation', async () => {
  const database = new TestDatabase();
  await migrateDbIfNeeded(database as never);
  const today = getToday();
  const before = await loadBudgetState(database as never);
  assert.equal(before?.period.flexiblePoolSnapshot, 0);
  await insertTransaction(database as never, { id: 'period-income', type: 'income', amount: 5000000, accountId: 'bca', categoryId: 'salary', date: today, time: '09:00', description: 'Gaji periode' });
  await insertTransaction(database as never, { id: 'period-expense', type: 'expense', amount: 100000, accountId: 'bca', categoryId: 'food', date: today, time: '10:00', description: 'Makan periode' });
  const unchanged = await loadBudgetState(database as never);
  assert.equal(unchanged?.period.flexiblePoolSnapshot, 0);
  assert.equal(unchanged?.unallocatedFunds, 5000000);
  await reallocateActiveBudget(database as never);
  const reallocated = await loadBudgetState(database as never);
  assert.equal(reallocated?.period.flexiblePoolSnapshot, 1900000);
  assert.equal(reallocated?.allocations.find((item) => item.categoryId === 'food')?.spent, 100000);
  database.close();
});
