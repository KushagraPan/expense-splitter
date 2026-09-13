/**
 * Domain types for Expense Splitter
 * Source of truth: product-spec.md
 */

export type GroupStatus = 'ACTIVE' | 'ARCHIVED';

export type SplitMethod = 'EQUAL' | 'EXACT';

export interface Group {
  id: string;
  name: string;
  currency: string;
  status: GroupStatus;
  created_at: string;
}

export interface Member {
  id: string;
  group_id: string;
  name: string;
  created_at: string;
}

export interface ExpenseShare {
  expense_id: string;
  member_id: string;
  owed_amount: number;
}

export interface Expense {
  id: string;
  group_id: string;
  title: string;
  amount: number;
  payer_id: string;
  split_method: SplitMethod;
  expense_date: string;
  category?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  shares?: ExpenseShare[];
}

export interface CreateExpenseInput {
  title: string;
  amount: number;
  payer_id: string;
  split_method: SplitMethod;
  expense_date?: string;
  category?: string;
  notes?: string;
  participants?: string[];
  shares?: { member_id: string; owed_amount: number }[];
}

export interface Payment {
  id: string;
  group_id: string;
  payer_id: string;
  recipient_id: string;
  amount: number;
  payment_date: string;
  notes?: string;
  created_at: string;
}

export interface NetBalance {
  member_id: string;
  member_name: string;
  net_balance: number;
}

export interface SettlementSuggestion {
  payer_id: string;
  payer_name: string;
  recipient_id: string;
  recipient_name: string;
  amount: number;
}
