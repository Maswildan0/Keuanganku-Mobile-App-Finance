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
export const getFixedTotal = (fixed: { amount: number; active: boolean }[]) => fixed.filter((item) => item.active).reduce((sum, item) => sum + item.amount, 0);
export const getFlexiblePool = (totalMoney: number, fixedTotal: number) => Math.max(totalMoney - fixedTotal, 0);
export const getFlexibleAllocations = (budgets: FlexibleBudget[], pool: number): FlexibleAllocation[] => budgets.filter((item) => item.active).map((item) => ({ ...item, amount: Math.round(pool * item.percentage / 100) }));

export function getCategorySpend(transactions: Transaction[], start?: string, end?: string) {
  return transactions.reduce<Record<string, number>>((totals, tx) => {
    if (tx.type !== 'expense' || (start && tx.date < start) || (end && tx.date > end)) return totals;
    const key = tx.categoryId ?? 'other'; totals[key] = (totals[key] ?? 0) + tx.amount; return totals;
  }, {});
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
export const formatDateRange = (start: string, end: string) => { const from = parseDate(start); const to = parseDate(end); const sameMonth = from.getMonth() === to.getMonth(); const left = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: sameMonth ? undefined : 'short' }).format(from).replace('.', ''); const right = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(to).replace('.', ''); return `${left}–${right}`; };
export const formatLongDate = (value: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(value));
