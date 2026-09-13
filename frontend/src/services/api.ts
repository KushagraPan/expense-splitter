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

import type { Group, Member, Expense, CreateExpenseInput } from '../types/index.ts';
import { mockStore } from './mockStore.ts';

export interface ApiService {
  getGroups(): Promise<Group[]>;
  getGroup(id: string): Promise<Group | null>;
  createGroup(input: { name: string; currency: string }): Promise<Group>;
  getMembers(groupId: string): Promise<Member[]>;
  addMember(groupId: string, name: string): Promise<Member>;
  deleteMember(groupId: string, memberId: string): Promise<void>;
  getExpenses(groupId: string): Promise<Expense[]>;
  createExpense(groupId: string, input: CreateExpenseInput): Promise<Expense>;
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
  createExpense: (groupId: string, input: CreateExpenseInput) => mockStore.createExpense(groupId, input),
};
