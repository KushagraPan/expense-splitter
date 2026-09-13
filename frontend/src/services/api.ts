/**
 * Centralized API Service Layer
 * 
 * Architecture:
 * UI Components -> apiService -> mockStore (Phase C)
 * UI Components -> apiService -> FastAPI HTTP Client (Phase F)
 * 
 * UI components must interact exclusively with this service layer,
 * never directly accessing mockStore or HTTP fetch logic.
 */

import type { Group, Member, Expense, CreateExpenseInput, NetBalance, SettlementSuggestion, Payment, CreatePaymentInput } from '../types/index.ts';
import { mockStore } from './mockStore.ts';

export interface ApiService {
  getGroups(): Promise<Group[]>;
  getGroup(id: string): Promise<Group | null>;
  createGroup(input: { name: string; currency: string }): Promise<Group>;
  getMembers(groupId: string): Promise<Member[]>;
  addMember(groupId: string, name: string): Promise<Member>;
  deleteMember(groupId: string, memberId: string): Promise<void>;
  getExpenses(groupId: string): Promise<Expense[]>;
  getExpense(groupId: string, expenseId: string): Promise<Expense | null>;
  createExpense(groupId: string, input: CreateExpenseInput): Promise<Expense>;
  updateExpense(groupId: string, expenseId: string, input: CreateExpenseInput): Promise<Expense>;
  deleteExpense(groupId: string, expenseId: string): Promise<void>;
  getNetBalances(groupId: string): Promise<NetBalance[]>;
  getSettlementSuggestions(groupId: string): Promise<SettlementSuggestion[]>;
  getPayments(groupId: string): Promise<Payment[]>;
  recordPayment(groupId: string, input: CreatePaymentInput): Promise<Payment>;
  archiveGroup(groupId: string): Promise<Group>;
  reopenGroup(groupId: string): Promise<Group>;
}

/**
 * Active API Service implementation.
 * Currently uses mockStore; can later be replaced by an HTTP client implementation.
 */
export const apiService: ApiService = {
  getGroups: () => mockStore.getGroups(),
  getGroup: (id: string) => mockStore.getGroup(id),
  createGroup: (input) => mockStore.createGroup(input),
  getMembers: (groupId: string) => mockStore.getMembers(groupId),
  addMember: (groupId: string, name: string) => mockStore.addMember(groupId, name),
  deleteMember: (groupId: string, memberId: string) => mockStore.deleteMember(groupId, memberId),
  getExpenses: (groupId: string) => mockStore.getExpenses(groupId),
  getExpense: (groupId: string, expenseId: string) => mockStore.getExpense(groupId, expenseId),
  createExpense: (groupId: string, input: CreateExpenseInput) => mockStore.createExpense(groupId, input),
  updateExpense: (groupId: string, expenseId: string, input: CreateExpenseInput) =>
    mockStore.updateExpense(groupId, expenseId, input),
  deleteExpense: (groupId: string, expenseId: string) => mockStore.deleteExpense(groupId, expenseId),
  getNetBalances: (groupId: string) => mockStore.getNetBalances(groupId),
  getSettlementSuggestions: (groupId: string) => mockStore.getSettlementSuggestions(groupId),
  getPayments: (groupId: string) => mockStore.getPayments(groupId),
  recordPayment: (groupId: string, input: CreatePaymentInput) => mockStore.recordPayment(groupId, input),
  archiveGroup: (groupId: string) => mockStore.archiveGroup(groupId),
  reopenGroup: (groupId: string) => mockStore.reopenGroup(groupId),
};
