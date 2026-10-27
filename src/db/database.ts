import type * as SQLite from 'expo-sqlite';
import { CATEGORY_DEFAULTS } from '../domain/finance';
import { ensureActiveBudgetPeriod } from './budget';

type Database = SQLite.SQLiteDatabase;
type AccountSeed = readonly [string, string, string, string, number, number];
type FixedSeed = readonly [string, string, number, number];
type FlexibleSeed = readonly [string, number];
type TransactionSeed = readonly [string, 'income' | 'expense' | 'transfer', number, string, string | null, string | null, string, string, string];

export const CURRENT_SCHEMA_VERSION = 4;
export const REQUIRED_TABLES = ['schema_meta', 'settings', 'accounts', 'categories', 'transactions', 'fixed_budgets', 'flexible_budgets', 'budget_settings', 'budget_periods', 'budget_allocations', 'budget_allocation_events', 'savings_goals'] as const;
export const REQUIRED_INDEXES = ['transactions_date_idx', 'transactions_account_idx', 'budget_period_active_idx', 'budget_allocations_period_idx'] as const;

export const SEED_ACCOUNTS: readonly AccountSeed[] = [
  ['cash', 'Cash', 'Cash', '', 0, 0],
  ['bca', 'BCA', 'Bank Account', 'BCA', 0, 1],
  ['bni', 'BNI', 'Bank Account', 'BNI', 0, 2],
];
export const SEED_FIXED: readonly FixedSeed[] = [['rent', 'Kos', 1500000, 1], ['internet', 'Internet', 300000, 8], ['electricity', 'Listrik', 500000, 12], ['installment', 'Cicilan', 700000, 20]];
export const SEED_FLEXIBLE: readonly FlexibleSeed[] = [['food', 35], ['transport', 15], ['lifestyle', 15], ['savings', 25], ['free', 10]];

export function getSeedTransactions(): readonly TransactionSeed[] {
  return [];
}

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, icon TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense')), is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, institution TEXT NOT NULL DEFAULT '', opening_balance INTEGER NOT NULL DEFAULT 0 CHECK(opening_balance >= 0), is_archived INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')), amount INTEGER NOT NULL CHECK(amount > 0), account_id TEXT NOT NULL REFERENCES accounts(id), destination_account_id TEXT REFERENCES accounts(id), category_id TEXT REFERENCES categories(id), transaction_date TEXT NOT NULL, transaction_time TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS fixed_budgets (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount >= 0), due_day INTEGER, recurrence TEXT NOT NULL DEFAULT 'monthly', is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS flexible_budgets (id TEXT PRIMARY KEY NOT NULL, percentage REAL NOT NULL CHECK(percentage >= 0), is_active INTEGER NOT NULL DEFAULT 1);
    CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS transactions_account_idx ON transactions(account_id);
  `,
  2: `
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'Cash', institution TEXT NOT NULL DEFAULT '', opening_balance INTEGER NOT NULL DEFAULT 0, is_archived INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS transactions_account_idx ON transactions(account_id);
  `,
  3: ``,
  4: `
    CREATE TABLE IF NOT EXISTS budget_settings (id INTEGER PRIMARY KEY CHECK(id = 1), cycle_type TEXT NOT NULL CHECK(cycle_type IN ('MONTH_START','CUSTOM_DAY','MANUAL')), reset_day INTEGER, default_rollover_mode TEXT NOT NULL DEFAULT 'NONE' CHECK(default_rollover_mode IN ('NONE','NEXT_PERIOD','SAVINGS')), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS budget_periods (id TEXT PRIMARY KEY NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('ACTIVE','CLOSED')), budgetable_money_snapshot INTEGER NOT NULL DEFAULT 0, fixed_total_snapshot INTEGER NOT NULL DEFAULT 0, flexible_pool_snapshot INTEGER NOT NULL DEFAULT 0, inflows_allocated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS budget_period_active_idx ON budget_periods(status) WHERE status = 'ACTIVE';
    CREATE TABLE IF NOT EXISTS budget_allocations (id TEXT PRIMARY KEY NOT NULL, budget_period_id TEXT NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE, category_id TEXT REFERENCES categories(id), allocation_type TEXT NOT NULL CHECK(allocation_type IN ('FIXED','FLEXIBLE')), percentage_snapshot REAL, allocated_amount INTEGER NOT NULL CHECK(allocated_amount >= 0), rollover_amount INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS budget_allocations_period_idx ON budget_allocations(budget_period_id);
    CREATE TABLE IF NOT EXISTS budget_allocation_events (id TEXT PRIMARY KEY NOT NULL, budget_period_id TEXT NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE, event_type TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0, from_category_id TEXT, to_category_id TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS savings_goals (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, target_amount INTEGER NOT NULL CHECK(target_amount >= 0), linked_account_id TEXT REFERENCES accounts(id), target_date TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `,
};

async function getSchemaVersion(db: Database) {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM schema_meta WHERE key = ?', 'schema_version');
  return row ? Number(row.value) : 0;
}

async function ensureAccountColumns(db: Database) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(accounts)');
  const existing = new Set(columns.map((column) => column.name));
  const additions: Record<string, string> = {
    name: "TEXT NOT NULL DEFAULT ''",
    type: "TEXT NOT NULL DEFAULT 'Cash'",
    institution: "TEXT NOT NULL DEFAULT ''",
    opening_balance: 'INTEGER NOT NULL DEFAULT 0',
    is_archived: 'INTEGER NOT NULL DEFAULT 0',
    sort_order: 'INTEGER NOT NULL DEFAULT 0',
    created_at: "TEXT NOT NULL DEFAULT ''",
    updated_at: "TEXT NOT NULL DEFAULT ''",
  };
  for (const [name, definition] of Object.entries(additions)) {
    if (!existing.has(name)) await db.execAsync(`ALTER TABLE accounts ADD COLUMN ${name} ${definition}`);
  }
}
async function ensureBudgetRoleColumn(db: Database) {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(accounts)');
  if (!columns.some((column) => column.name === 'budget_role')) await db.execAsync("ALTER TABLE accounts ADD COLUMN budget_role TEXT NOT NULL DEFAULT 'BUDGET'");
}

export async function verifyDatabaseSchema(db: Database) {
  const tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
  const tableNames = new Set(tables.map((item) => item.name));
  const missingTables = REQUIRED_TABLES.filter((name) => !tableNames.has(name));
  if (missingTables.length) throw new Error(`Database schema incomplete. Missing tables: ${missingTables.join(', ')}`);
  const indexes = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'");
  const indexNames = new Set(indexes.map((item) => item.name));
  const missingIndexes = REQUIRED_INDEXES.filter((name) => !indexNames.has(name));
  if (missingIndexes.length) throw new Error(`Database schema incomplete. Missing indexes: ${missingIndexes.join(', ')}`);
  const foreignKeys = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
  if (Number(foreignKeys?.foreign_keys ?? 0) !== 1) throw new Error('Database integrity check failed: foreign keys are disabled.');
  const violations = await db.getAllAsync<{ table: string; rowid: number; parent: string; fkid: number }>('PRAGMA foreign_key_check');
  if (violations.length) throw new Error(`Database integrity check failed: ${violations.length} foreign-key violation(s).`);
  const transactionForeignKeys = await db.getAllAsync<{ from: string }>('PRAGMA foreign_key_list(transactions)');
  const accountColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(accounts)');
  if (!accountColumns.some((column) => column.name === 'budget_role')) throw new Error('Database schema incomplete: accounts.budget_role is missing.');
  for (const field of ['account_id', 'destination_account_id', 'category_id']) {
    if (!transactionForeignKeys.some((item) => item.from === field)) throw new Error(`Database schema incomplete: transactions.${field} foreign key is missing.`);
  }
}
async function ensureDefaultCategories(db: Database) {
  for (const category of CATEGORY_DEFAULTS) await db.runAsync('INSERT OR IGNORE INTO categories (id, name, icon, type, is_active) VALUES (?, ?, ?, ?, 1)', category.id, category.name, category.icon, category.type);
}

async function seedDatabase(db: Database) {
  const seeded = await db.getFirstAsync<{ value: string }>('SELECT value FROM schema_meta WHERE key = ?', 'seeded');
  if (seeded?.value === '1') return;
  const counts = await Promise.all([
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM accounts'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM transactions'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM fixed_budgets'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM flexible_budgets'),
  ]);
  const isEmpty = counts.every((row) => Number(row?.count ?? 0) === 0);
  if (isEmpty) {
    await db.withTransactionAsync(async () => {
      for (const item of CATEGORY_DEFAULTS) await db.runAsync('INSERT OR IGNORE INTO categories (id, name, icon, type) VALUES (?, ?, ?, ?)', item.id, item.name, item.icon, item.type);
      for (const [id, name, type, institution, opening, order] of SEED_ACCOUNTS) await db.runAsync('INSERT OR IGNORE INTO accounts (id, name, type, institution, opening_balance, sort_order) VALUES (?, ?, ?, ?, ?, ?)', id, name, type, institution, opening, order);
      for (const [id, name, amount, dueDay] of SEED_FIXED) await db.runAsync('INSERT OR IGNORE INTO fixed_budgets (id, name, amount, due_day) VALUES (?, ?, ?, ?)', id, name, amount, dueDay);
      for (const [id, percentage] of SEED_FLEXIBLE) await db.runAsync('INSERT OR IGNORE INTO flexible_budgets (id, percentage) VALUES (?, ?)', id, percentage);
      for (const [id, type, amount, account, destination, category, date, time, description] of getSeedTransactions()) await db.runAsync('INSERT OR IGNORE INTO transactions (id, type, amount, account_id, destination_account_id, category_id, transaction_date, transaction_time, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id, type, amount, account, destination, category, date, time, description);
    });
  }
  await db.runAsync('INSERT INTO schema_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'seeded', '1');
}

export async function migrateDbIfNeeded(db: Database) {
  try {
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
    const currentVersion = await getSchemaVersion(db);
    if (currentVersion > CURRENT_SCHEMA_VERSION) throw new Error(`Database schema version ${currentVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}.`);
    for (let version = currentVersion + 1; version <= CURRENT_SCHEMA_VERSION; version += 1) {
      await db.withTransactionAsync(async () => {
        await db.execAsync(MIGRATIONS[version]);
        if (version === 2) await ensureAccountColumns(db);
        if (version === 3) await ensureBudgetRoleColumn(db);
        await db.runAsync('INSERT INTO schema_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'schema_version', String(version));
      });
    }
    await verifyDatabaseSchema(db);
    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING', 'user_name', 'Ardi Rahman');
    await ensureDefaultCategories(db);
    await seedDatabase(db);
    await ensureActiveBudgetPeriod(db);
    await verifyDatabaseSchema(db);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Database initialization failed: ${detail}`);
  }
}
