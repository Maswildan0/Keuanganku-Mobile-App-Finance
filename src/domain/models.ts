export type AccountType = 'Cash' | 'Bank Account' | 'E-wallet' | 'Digital Bank' | 'Savings Account';
export type TransactionType = 'income' | 'expense' | 'transfer';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  institution?: string;
  openingBalance: number;
  archived: boolean;
  sortOrder: number;
};

export type Category = { id: string; name: string; icon: string; type: 'income' | 'expense' };
export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  accountId: string;
  destinationAccountId?: string;
  categoryId?: string;
  date: string;
  time: string;
  description: string;
  notes?: string;
};
export type FixedBudget = { id: string; name: string; amount: number; dueDay?: number; recurrence: string; active: boolean };
export type FlexibleBudget = { id: string; percentage: number; active: boolean };
export type FlexibleAllocation = FlexibleBudget & { amount: number };
export type Cashflow = { income: number; expense: number; net_cashflow: number };
export type FinanceSnapshot = { accounts: Account[]; transactions: Transaction[]; categories: Category[]; fixedBudgets: FixedBudget[]; flexibleBudgets: FlexibleBudget[]; userName: string };
