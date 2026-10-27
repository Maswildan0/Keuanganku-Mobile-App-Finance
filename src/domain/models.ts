export type AccountType = 'Cash' | 'Bank Account' | 'E-wallet' | 'Digital Bank' | 'Savings Account';
export type BudgetRole = 'BUDGET' | 'PROTECTED';
export type TransactionType = 'income' | 'expense' | 'transfer';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  institution?: string;
  openingBalance: number;
  budgetRole: BudgetRole;
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
export type BudgetCycleType = 'MONTH_START' | 'CUSTOM_DAY' | 'MANUAL';
export type RolloverMode = 'NONE' | 'NEXT_PERIOD' | 'SAVINGS';
export type BudgetPeriodStatus = 'ACTIVE' | 'CLOSED';
export type BudgetAllocationType = 'FIXED' | 'FLEXIBLE';
export type BudgetSettings = { id: number; cycleType: BudgetCycleType; resetDay?: number; defaultRolloverMode: RolloverMode };
export type BudgetPeriod = { id: string; startDate: string; endDate: string; status: BudgetPeriodStatus; budgetableMoneySnapshot: number; fixedTotalSnapshot: number; flexiblePoolSnapshot: number; inflowsAllocated: number; createdAt?: string; closedAt?: string };
export type BudgetAllocation = { id: string; budgetPeriodId: string; categoryId?: string; type: BudgetAllocationType; percentageSnapshot?: number; allocatedAmount: number; rolloverAmount: number; };
export type BudgetAllocationEvent = { id: string; budgetPeriodId: string; type: string; amount: number; fromCategoryId?: string; toCategoryId?: string; note?: string; createdAt?: string };
export type SavingsGoal = { id: string; name: string; targetAmount: number; linkedAccountId?: string; targetDate?: string; active: boolean };
export type BudgetAllocationView = BudgetAllocation & { spent: number; remaining: number; overbudget: number };
export type FixedBudget = { id: string; name: string; amount: number; dueDay?: number; recurrence: string; active: boolean };
export type FlexibleBudget = { id: string; percentage: number; active: boolean };
export type FlexibleAllocation = FlexibleBudget & { amount: number; spent?: number; remaining?: number; overbudget?: number };
export type Cashflow = { income: number; expense: number; net_cashflow: number };
export type FinanceSnapshot = { accounts: Account[]; transactions: Transaction[]; categories: Category[]; fixedBudgets: FixedBudget[]; flexibleBudgets: FlexibleBudget[]; userName: string };
