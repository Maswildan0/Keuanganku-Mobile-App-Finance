import { CATEGORY_DEFAULTS, getToday } from '../domain/finance';
import { FinanceSnapshot } from '../domain/models';

export function createWebPreviewSnapshot(): FinanceSnapshot {
  const today = getToday();
  return {
    accounts: [
      { id: 'bni', name: 'BNI', type: 'Bank Account', institution: 'BNI', openingBalance: 1620527, budgetRole: 'BUDGET', archived: false, sortOrder: 0 },
      { id: 'bca', name: 'BCA', type: 'Bank Account', institution: 'BCA', openingBalance: 992932, budgetRole: 'PROTECTED', archived: false, sortOrder: 1 },
      { id: 'cash', name: 'Cash', type: 'Cash', institution: '', openingBalance: 500000, budgetRole: 'PROTECTED', archived: false, sortOrder: 2 },
    ],
    transactions: [
      { id: 'preview-income', type: 'income', amount: 3182959, accountId: 'bni', categoryId: 'salary', date: today, time: '09:00', description: 'Pemasukan preview' },
      { id: 'preview-food', type: 'expense', amount: 47000, accountId: 'bni', categoryId: 'food', date: today, time: '12:00', description: 'Makan siang' },
      { id: 'preview-lifestyle', type: 'expense', amount: 22500, accountId: 'bni', categoryId: 'lifestyle', date: today, time: '18:00', description: 'Lifestyle' },
    ],
    categories: CATEGORY_DEFAULTS,
    fixedBudgets: [
      { id: 'rent', name: 'Kos', amount: 1500000, dueDay: 1, recurrence: 'monthly', active: true },
      { id: 'internet', name: 'Internet', amount: 300000, dueDay: 8, recurrence: 'monthly', active: true },
      { id: 'electricity', name: 'Listrik', amount: 500000, dueDay: 12, recurrence: 'monthly', active: true },
      { id: 'installment', name: 'Cicilan', amount: 700000, dueDay: 20, recurrence: 'monthly', active: true },
    ],
    flexibleBudgets: [
      { id: 'food', percentage: 35, active: true }, { id: 'transport', percentage: 15, active: true }, { id: 'lifestyle', percentage: 15, active: true }, { id: 'savings', percentage: 25, active: true }, { id: 'free', percentage: 10, active: true },
    ],
    userName: 'Wildan',
  };
}
