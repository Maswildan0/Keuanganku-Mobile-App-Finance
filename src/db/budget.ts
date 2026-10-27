import type * as SQLite from 'expo-sqlite';
import { getBudgetInflows, getBudgetSpending, getCurrentBudgetInputs, getFlexibleSnapshotAllocations, getPeriodRange } from '../domain/budget';
import { Account, BudgetAllocationView, BudgetPeriod, BudgetSettings, FixedBudget, FlexibleBudget, Transaction } from '../domain/models';
import { getToday } from '../domain/finance';

type Database = SQLite.SQLiteDatabase;
type SettingsRow = { id: number; cycle_type: BudgetSettings['cycleType']; reset_day: number | null; default_rollover_mode: BudgetSettings['defaultRolloverMode'] };
type PeriodRow = { id: string; start_date: string; end_date: string; status: BudgetPeriod['status']; budgetable_money_snapshot: number; fixed_total_snapshot: number; flexible_pool_snapshot: number; inflows_allocated: number; created_at: string; closed_at: string | null };
type AllocationRow = { id: string; budget_period_id: string; category_id: string | null; allocation_type: BudgetAllocationView['type']; percentage_snapshot: number | null; allocated_amount: number; rollover_amount: number };
type InputState = { accounts: Account[]; transactions: Transaction[]; fixedBudgets: FixedBudget[]; flexibleBudgets: FlexibleBudget[] };

export type BudgetState = { settings: BudgetSettings; period: BudgetPeriod; allocations: BudgetAllocationView[]; unallocatedFunds: number; safeToSpend: number };

function mapSettings(row: SettingsRow | null): BudgetSettings { return row ? { id: Number(row.id), cycleType: row.cycle_type, resetDay: row.reset_day == null ? undefined : Number(row.reset_day), defaultRolloverMode: row.default_rollover_mode } : { id: 1, cycleType: 'MONTH_START', resetDay: 1, defaultRolloverMode: 'NONE' }; }
function mapPeriod(row: PeriodRow): BudgetPeriod { return { id: row.id, startDate: row.start_date, endDate: row.end_date, status: row.status, budgetableMoneySnapshot: Number(row.budgetable_money_snapshot), fixedTotalSnapshot: Number(row.fixed_total_snapshot), flexiblePoolSnapshot: Number(row.flexible_pool_snapshot), inflowsAllocated: Number(row.inflows_allocated), createdAt: row.created_at, closedAt: row.closed_at ?? undefined }; }

async function readInputs(db: Database): Promise<InputState> {
  const [accounts, transactions, fixedBudgets, flexibleBudgets] = await Promise.all([
    db.getAllAsync<{ id: string; name: string; type: Account['type']; institution: string; openingBalance: number; budgetRole: string; archived: number; sortOrder: number }>('SELECT id, name, type, institution, opening_balance as openingBalance, budget_role as budgetRole, is_archived as archived, sort_order as sortOrder FROM accounts'),
    db.getAllAsync<{ id: string; type: Transaction['type']; amount: number; accountId: string; destinationAccountId: string | null; categoryId: string | null; date: string; time: string; description: string; notes: string }>('SELECT id, type, amount, account_id as accountId, destination_account_id as destinationAccountId, category_id as categoryId, transaction_date as date, transaction_time as time, description, notes FROM transactions'),
    db.getAllAsync<{ id: string; name: string; amount: number; dueDay: number | null; recurrence: string; active: number }>('SELECT id, name, amount, due_day as dueDay, recurrence, is_active as active FROM fixed_budgets'),
    db.getAllAsync<{ id: string; percentage: number; active: number }>('SELECT id, percentage, is_active as active FROM flexible_budgets'),
  ]);
  return { accounts: accounts.map((item) => ({ ...item, budgetRole: item.budgetRole === 'PROTECTED' ? 'PROTECTED' : 'BUDGET', archived: item.archived === 1, openingBalance: Number(item.openingBalance), sortOrder: Number(item.sortOrder) })) as Account[], transactions: transactions.map((item) => ({ ...item, destinationAccountId: item.destinationAccountId ?? undefined, categoryId: item.categoryId ?? undefined, amount: Number(item.amount) })) as Transaction[], fixedBudgets: fixedBudgets.map((item) => ({ ...item, amount: Number(item.amount), dueDay: item.dueDay ?? undefined, active: item.active === 1 })) as FixedBudget[], flexibleBudgets: flexibleBudgets.map((item) => ({ ...item, percentage: Number(item.percentage), active: item.active === 1 })) as FlexibleBudget[] };
}

export async function ensureBudgetSettings(db: Database) { await db.runAsync("INSERT INTO budget_settings (id, cycle_type, reset_day, default_rollover_mode) VALUES (1, 'MONTH_START', 1, 'NONE') ON CONFLICT(id) DO NOTHING"); }

async function createPeriod(db: Database, startDate: string, endDate: string, input: InputState) {
  const values = getCurrentBudgetInputs(input.accounts, input.transactions, input.fixedBudgets); const id = `budget-${startDate}`;
  await db.runAsync('INSERT OR IGNORE INTO budget_periods (id, start_date, end_date, status, budgetable_money_snapshot, fixed_total_snapshot, flexible_pool_snapshot, inflows_allocated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, startDate, endDate, 'ACTIVE', values.budgetableMoney, values.fixedTotal, values.flexiblePool, getBudgetInflows(startDate, input.transactions, input.accounts));
  await db.runAsync('UPDATE budget_periods SET status = ?, start_date = ?, end_date = ?, budgetable_money_snapshot = ?, fixed_total_snapshot = ?, flexible_pool_snapshot = ?, inflows_allocated = ?, closed_at = NULL WHERE id = ?', 'ACTIVE', startDate, endDate, values.budgetableMoney, values.fixedTotal, values.flexiblePool, getBudgetInflows(startDate, input.transactions, input.accounts), id);
  await db.runAsync('DELETE FROM budget_allocations WHERE budget_period_id = ?', id);
  await db.runAsync('INSERT OR REPLACE INTO budget_allocations (id, budget_period_id, allocation_type, allocated_amount) VALUES (?, ?, ?, ?)', `${id}-fixed`, id, 'FIXED', values.fixedTotal);
  for (const allocation of getFlexibleSnapshotAllocations(input.flexibleBudgets, values.flexiblePool)) await db.runAsync('INSERT OR REPLACE INTO budget_allocations (id, budget_period_id, category_id, allocation_type, percentage_snapshot, allocated_amount) VALUES (?, ?, ?, ?, ?, ?)', `${id}-${allocation.categoryId}`, id, allocation.categoryId, 'FLEXIBLE', allocation.percentage, allocation.amount);
  return id;
}

export async function ensureActiveBudgetPeriod(db: Database) {
  await ensureBudgetSettings(db); const settings = mapSettings(await db.getFirstAsync<SettingsRow>('SELECT * FROM budget_settings WHERE id = 1')); const today = getToday(); const activeRow = await db.getFirstAsync<PeriodRow>("SELECT * FROM budget_periods WHERE status = 'ACTIVE' ORDER BY start_date DESC LIMIT 1");
  if (activeRow && (settings.cycleType === 'MANUAL' || today <= activeRow.end_date)) return;
  if (activeRow) await db.runAsync("UPDATE budget_periods SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ?", activeRow.id);
  const range = getPeriodRange(today, settings); await createPeriod(db, range.start, range.end, await readInputs(db));
}

export async function loadBudgetState(db: Database): Promise<BudgetState | null> {
  await ensureActiveBudgetPeriod(db); const settings = mapSettings(await db.getFirstAsync<SettingsRow>('SELECT * FROM budget_settings WHERE id = 1')); const periodRow = await db.getFirstAsync<PeriodRow>("SELECT * FROM budget_periods WHERE status = 'ACTIVE' ORDER BY start_date DESC LIMIT 1"); if (!periodRow) return null;
  const period = mapPeriod(periodRow); const input = await readInputs(db); const transactions = getBudgetSpending(period.startDate, period.endDate, input.transactions, input.accounts); const spentByCategory = transactions.reduce<Record<string, number>>((result, transaction) => { const key = transaction.categoryId ?? 'other'; result[key] = (result[key] ?? 0) + transaction.amount; return result; }, {});
  const allocationRows = await db.getAllAsync<AllocationRow>('SELECT * FROM budget_allocations WHERE budget_period_id = ? ORDER BY allocation_type, category_id', period.id); const allocations = allocationRows.map((row) => { const amount = Number(row.allocated_amount); const spent = row.category_id ? (spentByCategory[row.category_id] ?? 0) : 0; const rollover = Number(row.rollover_amount ?? 0); return { id: row.id, budgetPeriodId: row.budget_period_id, categoryId: row.category_id ?? undefined, type: row.allocation_type, percentageSnapshot: row.percentage_snapshot == null ? undefined : Number(row.percentage_snapshot), allocatedAmount: amount, rolloverAmount: rollover, spent, remaining: amount + rollover - spent, overbudget: Math.max(spent - amount - rollover, 0) }; });
  const inflows = getBudgetInflows(period.startDate, input.transactions, input.accounts); const unallocatedFunds = Math.max(inflows - period.inflowsAllocated, 0); const safeToSpend = Math.max(allocations.filter((item) => item.type === 'FLEXIBLE').reduce((sum, item) => sum + item.remaining, 0), 0); return { settings, period, allocations, unallocatedFunds, safeToSpend };
}

export async function reallocateActiveBudget(db: Database) {
  const state = await loadBudgetState(db); if (!state) throw new Error('Belum ada periode budget aktif.'); const input = await readInputs(db); const values = getCurrentBudgetInputs(input.accounts, input.transactions, input.fixedBudgets); const inflows = getBudgetInflows(state.period.startDate, input.transactions, input.accounts);
  await db.withTransactionAsync(async () => { await db.runAsync('UPDATE budget_periods SET budgetable_money_snapshot = ?, fixed_total_snapshot = ?, flexible_pool_snapshot = ?, inflows_allocated = ? WHERE id = ?', values.budgetableMoney, values.fixedTotal, values.flexiblePool, inflows, state.period.id); await db.runAsync('DELETE FROM budget_allocations WHERE budget_period_id = ?', state.period.id); await db.runAsync('INSERT INTO budget_allocations (id, budget_period_id, allocation_type, allocated_amount) VALUES (?, ?, ?, ?)', `${state.period.id}-fixed`, state.period.id, 'FIXED', values.fixedTotal); for (const allocation of getFlexibleSnapshotAllocations(input.flexibleBudgets, values.flexiblePool)) await db.runAsync('INSERT INTO budget_allocations (id, budget_period_id, category_id, allocation_type, percentage_snapshot, allocated_amount) VALUES (?, ?, ?, ?, ?, ?)', `${state.period.id}-${allocation.categoryId}`, state.period.id, allocation.categoryId, 'FLEXIBLE', allocation.percentage, allocation.amount); await db.runAsync('INSERT INTO budget_allocation_events (id, budget_period_id, event_type, amount, note) VALUES (?, ?, ?, ?, ?)', `event-${Date.now()}`, state.period.id, 'REALLOCATED', values.budgetableMoney, 'Alokasi ulang manual'); });
}
export async function saveBudgetSettings(db: Database, settings: BudgetSettings) { await db.runAsync('UPDATE budget_settings SET cycle_type = ?, reset_day = ?, default_rollover_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', settings.cycleType, settings.resetDay ?? null, settings.defaultRolloverMode); }
export async function startManualBudgetPeriod(db: Database) { await ensureBudgetSettings(db); await db.runAsync("UPDATE budget_periods SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE status = 'ACTIVE'"); const settings = mapSettings(await db.getFirstAsync<SettingsRow>('SELECT * FROM budget_settings WHERE id = 1')); const range = getPeriodRange(getToday(), settings); await createPeriod(db, range.start, range.end, await readInputs(db)); }
export async function loadBudgetHistory(db: Database) { return db.getAllAsync<PeriodRow>("SELECT * FROM budget_periods WHERE status = 'CLOSED' ORDER BY start_date DESC"); }
