import * as SQLite from 'expo-sqlite';
import { CATEGORY_DEFAULTS } from '../domain/finance';

export const SEED_ACCOUNTS = [
  ['cash', 'Cash', 'Cash', '', 500000, 0],
  ['bca', 'BCA', 'Bank Account', 'BCA', 4500000, 1],
  ['bni', 'BNI', 'Bank Account', 'BNI', 2000000, 2],
  ['gopay', 'GoPay', 'E-wallet', 'GoPay', 0, 3],
];
export const SEED_FIXED = [['rent', 'Kos', 1500000, 1], ['internet', 'Internet', 300000, 8], ['electricity', 'Listrik', 500000, 12], ['installment', 'Cicilan', 700000, 20]];
export const SEED_FLEXIBLE = [['food', 35], ['transport', 15], ['lifestyle', 15], ['savings', 25], ['free', 10]];
export const SEED_TRANSACTIONS = [
  ['tx-1', 'expense', 85000, 'bca', null, 'food', '2026-10-23', '12:30', 'Makan siang'],
  ['tx-2', 'expense', 40000, 'cash', null, 'transport', '2026-10-23', '08:10', 'Ojek ke kantor'],
  ['tx-3', 'expense', 180000, 'bca', null, 'food', '2026-10-22', '19:20', 'Belanja mingguan'],
  ['tx-4', 'expense', 65000, 'cash', null, 'transport', '2026-10-21', '07:45', 'Transportasi'],
  ['tx-5', 'expense', 240000, 'bca', null, 'lifestyle', '2026-10-20', '18:00', 'Makan malam'],
  ['tx-6', 'income', 8500000, 'bca', null, 'salary', '2026-10-01', '09:00', 'Gaji'],
  ['tx-7', 'expense', 1500000, 'bca', null, 'bills', '2026-10-02', '10:00', 'Kos'],
  ['tx-8', 'expense', 450000, 'bca', null, 'bills', '2026-10-05', '10:00', 'Tagihan bulanan'],
  ['tx-9', 'transfer', 500000, 'bca', 'cash', null, '2026-09-28', '13:15', 'Ambil tunai'],
  ['tx-10', 'expense', 300000, 'bni', null, 'bills', '2026-09-15', '10:10', 'Internet'],
  ['tx-11', 'income', 8200000, 'bca', null, 'salary', '2026-09-01', '09:00', 'Gaji'],
  ['tx-12', 'expense', 1250000, 'bca', null, 'bills', '2026-09-03', '10:00', 'Kos'],
];

export async function migrateDbIfNeeded(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, institution TEXT, opening_balance INTEGER NOT NULL DEFAULT 0, is_archived INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, icon TEXT NOT NULL, type TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')), amount INTEGER NOT NULL CHECK(amount > 0), account_id TEXT NOT NULL REFERENCES accounts(id), destination_account_id TEXT REFERENCES accounts(id), category_id TEXT REFERENCES categories(id), transaction_date TEXT NOT NULL, transaction_time TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS fixed_budgets (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount >= 0), due_day INTEGER, recurrence TEXT NOT NULL DEFAULT 'monthly', is_active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS flexible_budgets (id TEXT PRIMARY KEY NOT NULL, percentage REAL NOT NULL CHECK(percentage >= 0), is_active INTEGER NOT NULL DEFAULT 1);
    CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS transactions_account_idx ON transactions(account_id);
  `);
  const seeded = await db.getFirstAsync<{ value: string }>('SELECT value FROM schema_meta WHERE key = ?', 'seeded');
  if (seeded?.value === '1') return;
  await db.withTransactionAsync(async () => {
    for (const item of CATEGORY_DEFAULTS) await db.runAsync('INSERT OR IGNORE INTO categories (id, name, icon, type) VALUES (?, ?, ?, ?)', item.id, item.name, item.icon, item.type);
    for (const [id, name, type, institution, opening, order] of SEED_ACCOUNTS) await db.runAsync('INSERT OR IGNORE INTO accounts (id, name, type, institution, opening_balance, sort_order) VALUES (?, ?, ?, ?, ?, ?)', id, name, type, institution, opening, order);
    for (const [id, name, amount, dueDay] of SEED_FIXED) await db.runAsync('INSERT OR IGNORE INTO fixed_budgets (id, name, amount, due_day) VALUES (?, ?, ?, ?)', id, name, amount, dueDay);
    for (const [id, percentage] of SEED_FLEXIBLE) await db.runAsync('INSERT OR IGNORE INTO flexible_budgets (id, percentage) VALUES (?, ?)', id, percentage);
    for (const [id, type, amount, account, destination, category, date, time, description] of SEED_TRANSACTIONS) await db.runAsync('INSERT OR IGNORE INTO transactions (id, type, amount, account_id, destination_account_id, category_id, transaction_date, transaction_time, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id, type, amount, account, destination, category, date, time, description);
    await db.runAsync('INSERT INTO schema_meta (key, value) VALUES (?, ?)', 'seeded', '1');
  });
}
