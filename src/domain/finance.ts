import { Account, Cashflow, Category, FlexibleAllocation, FlexibleBudget, Transaction } from './models';

export const CATEGORY_DEFAULTS: Category[] = [
  { id: 'food', name: 'Makan', icon: 'food', type: 'expense' },
  { id: 'transport', name: 'Transportasi', icon: 'route', type: 'expense' },
  { id: 'lifestyle', name: 'Lifestyle', icon: 'spark', type: 'expense' },
  { id: 'savings', name: 'Tabungan', icon: 'safe', type: 'expense' },
  { id: 'free', name: 'Dana Bebas', icon: 'wallet', type: 'expense' },
  { id: 'bills', name: 'Tagihan', icon: 'bolt', type: 'expense' },
  { id: 'salary', name: 'Gaji', icon: 'arrow-down', type: 'income' },
  { id: 'other', name: 'Lainnya', icon: 'dots', type: 'expense' },
];

export const categoryById = (id?: string) => CATEGORY_DEFAULTS.find((item) => item.id === id) ?? CATEGORY_DEFAULTS.find((item) => item.id === 'other')!;
export const parseDate = (value: string) => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); };
export const toDateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
export const shiftDate = (value: string, days: number) => { const date = parseDate(value); date.setDate(date.getDate() + days); return toDateKey(date); };
export const getToday = (now = new Date()) => toDateKey(now);
export const getCurrentMonth = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
export const getCurrentYear = (now = new Date()) => now.getFullYear();
export const getCurrentTime = (now = new Date()) => `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
export const getMonthStart = (now = new Date()) => `${getCurrentMonth(now)}-01`;
export const getMonthEnd = (now = new Date()) => toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
export const getWeekRange = (value: string) => ({ start: toDateKey(getWeekStart(value)), end: toDateKey(getWeekEnd(value)) });
export const formatDateID = (value: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(value)).replace('.', '');
export const parseMoneyInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('-') || !/^[0-9.]+$/.test(trimmed)) return null;
  const normalized = trimmed.replace(/\./g, '');
  if (!normalized || !/^\d+$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) ? amount : null;
};
export const formatExactIDR = (value: number) => `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
function trimCompactDecimal(value: number) { return value.toFixed(1).replace(/\.0$/, '').replace('.', ','); }
export function formatCompactIDR(value: number) {
  const absolute = Math.abs(value); const sign = value < 0 ? '-' : '';
  if (absolute >= 1_000_000_000) return `${sign}${trimCompactDecimal(absolute / 1_000_000_000)} M`;
  if (absolute >= 1_000_000) return `${sign}${trimCompactDecimal(absolute / 1_000_000)} jt`;
  if (absolute >= 1_000) return `${sign}${trimCompactDecimal(absolute / 1_000)} rb`;
  return `${sign}${Math.round(absolute)}`;
}
export function getNiceChartScale(values: number[], tickCount = 5) {
  const maximum = Math.max(...values, 0);
  if (maximum <= 0) return { max: 0, step: 0, ticks: [0] };
  const roughStep = maximum / Math.max(tickCount - 1, 1); const magnitude = 10 ** Math.floor(Math.log10(roughStep)); const normalized = roughStep / magnitude; const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10; const step = niceNormalized * magnitude; const max = Math.ceil(maximum / step) * step;
  return { max, step, ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step) };
}
export const formatMonthYearID = (value = getToday()) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(parseDate(`${value.slice(0, 7)}-01`)).replace('.', '');

export function getAccountBalances(accounts: Account[], transactions: Transaction[]) {
  const balances: Record<string, number> = Object.fromEntries(accounts.map((account) => [account.id, account.openingBalance || 0]));
  for (const tx of transactions) {
    if (tx.type === 'income') balances[tx.accountId] = (balances[tx.accountId] ?? 0) + tx.amount;
    if (tx.type === 'expense') balances[tx.accountId] = (balances[tx.accountId] ?? 0) - tx.amount;
    if (tx.type === 'transfer') {
      balances[tx.accountId] = (balances[tx.accountId] ?? 0) - tx.amount;
      if (tx.destinationAccountId) balances[tx.destinationAccountId] = (balances[tx.destinationAccountId] ?? 0) + tx.amount;
    }
  }
  return balances;
}

export const getTotalBalance = (accounts: Account[], transactions: Transaction[]) => {
  const balances = getAccountBalances(accounts, transactions);
  return accounts.filter((account) => !account.archived).reduce((sum, account) => sum + (balances[account.id] ?? 0), 0);
};
export const getBudgetableMoney = (accounts: Account[], transactions: Transaction[]) => {
  const balances = getAccountBalances(accounts, transactions);
  return accounts.filter((account) => !account.archived && account.budgetRole === 'BUDGET').reduce((sum, account) => sum + (balances[account.id] ?? 0), 0);
};
export const getProtectedMoney = (accounts: Account[], transactions: Transaction[]) => Math.max(getTotalBalance(accounts, transactions) - getBudgetableMoney(accounts, transactions), 0);
export const getFixedTotal = (fixed: { amount: number; active: boolean }[]) => fixed.filter((item) => item.active).reduce((sum, item) => sum + item.amount, 0);
export const getFlexiblePool = (totalMoney: number, fixedTotal: number) => Math.max(totalMoney - fixedTotal, 0);
export const getFlexibleAllocations = (budgets: FlexibleBudget[], pool: number): FlexibleAllocation[] => budgets.filter((item) => item.active).map((item) => ({ ...item, amount: Math.round(pool * item.percentage / 100) }));

export function getCategorySpend(transactions: Transaction[], start?: string, end?: string) {
  return transactions.reduce<Record<string, number>>((totals, tx) => {
    if (tx.type !== 'expense' || (start && tx.date < start) || (end && tx.date > end)) return totals;
    const key = tx.categoryId ?? 'other'; totals[key] = (totals[key] ?? 0) + tx.amount; return totals;
  }, {});
}
export function getBudgetCategorySpend(transactions: Transaction[], accounts: Account[], start?: string, end?: string) {
  const budgetAccountIds = new Set(accounts.filter((account) => !account.archived && account.budgetRole === 'BUDGET').map((account) => account.id));
  return getCategorySpend(transactions.filter((transaction) => budgetAccountIds.has(transaction.accountId)), start, end);
}
export function getCashflow(transactions: Transaction[], start: string, end: string): Cashflow {
  const result = transactions.reduce((flow, tx) => {
    if (tx.date < start || tx.date > end || tx.type === 'transfer') return flow;
    if (tx.type === 'income') flow.income += tx.amount; else if (tx.type === 'expense') flow.expense += tx.amount;
    return flow;
  }, { income: 0, expense: 0, net_cashflow: 0 });
  result.net_cashflow = result.income - result.expense; return result;
}
export function getDailyCashflow(transactions: Transaction[], startDate: string, endDate: string) {
  const output: Array<{ date: string; label: string; day: number; income: number; expense: number; net_cashflow: number }> = [];
  for (let date = parseDate(startDate), end = parseDate(endDate); date <= end; date.setDate(date.getDate() + 1)) {
    const key = toDateKey(date); const flow = getCashflow(transactions, key, key);
    output.push({ date: key, label: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date).replace('.', ''), day: date.getDate(), ...flow });
  }
  return output;
}
export function getMonthlyCashflow(transactions: Transaction[], year: number) {
  return Array.from({ length: 12 }, (_, index) => { const month = String(index + 1).padStart(2, '0'); return { month: index + 1, label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(year, index, 1)).replace('.', ''), ...getCashflow(transactions, `${year}-${month}-01`, `${year}-${month}-${new Date(year, index + 1, 0).getDate()}`) }; });
}
export function getYearlyCashflow(transactions: Transaction[], startYear: number, endYear: number) { return Array.from({ length: endYear - startYear + 1 }, (_, index) => { const year = startYear + index; return { year, ...getCashflow(transactions, `${year}-01-01`, `${year}-12-31`) }; }); }
export const getWeekStart = (value: string) => { const date = parseDate(value); const day = date.getDay() || 7; date.setDate(date.getDate() - day + 1); return date; };
export const getWeekEnd = (value: string) => { const date = getWeekStart(value); date.setDate(date.getDate() + 6); return date; };
export const formatDateRange = (start: string, end: string) => {
  const from = parseDate(start); const to = parseDate(end); const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
  const left = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: sameMonth ? undefined : 'short', year: sameMonth ? undefined : from.getFullYear() !== to.getFullYear() ? 'numeric' : undefined }).format(from).replace('.', '');
  const right = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(to).replace('.', '');
  return `${left}–${right}`;
};
export const formatLongDate = (value: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(value)).replace('.', '');
