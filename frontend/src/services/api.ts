/**
 * Centralized API Service Layer
 * 
 * Architecture (Phase F / Issue #12):
 * UI Components -> apiService -> HTTP Client -> FastAPI REST Backend
 * 
 * UI components interact exclusively with this service layer,
 * never directly accessing fetch or backend internals.
 */

import type { Group, Member, Expense, CreateExpenseInput, NetBalance, SettlementSuggestion, Payment, CreatePaymentInput } from '../types/index.ts';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorDetail = data && (data.detail || data.message);
    const errorMessage = typeof errorDetail === 'string' ? errorDetail : `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

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
 * Active API Service implementation connecting React to the FastAPI backend.
 */
export const apiService: ApiService = {
  getGroups: () => request<Group[]>('/groups'),

  getGroup: async (id: string) => {
    try {
      return await request<Group>(`/groups/${id}`);
    } catch (err) {
      if (err instanceof Error && (err.message.includes('404') || err.message.toLowerCase().includes('not found'))) {
        return null;
      }
      throw err;
    }
  },

  createGroup: (input) =>
    request<Group>('/groups', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getMembers: (groupId: string) => request<Member[]>(`/groups/${groupId}/members`),

  addMember: (groupId: string, name: string) =>
    request<Member>(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteMember: (groupId: string, memberId: string) =>
    request<void>(`/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE',
    }),

  getExpenses: (groupId: string) => request<Expense[]>(`/groups/${groupId}/expenses`),

  getExpense: async (groupId: string, expenseId: string) => {
    try {
      return await request<Expense>(`/groups/${groupId}/expenses/${expenseId}`);
    } catch (err) {
      if (err instanceof Error && (err.message.includes('404') || err.message.toLowerCase().includes('not found'))) {
        return null;
      }
      throw err;
    }
  },

  createExpense: (groupId: string, input: CreateExpenseInput) =>
    request<Expense>(`/groups/${groupId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateExpense: (groupId: string, expenseId: string, input: CreateExpenseInput) =>
    request<Expense>(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteExpense: (groupId: string, expenseId: string) =>
    request<void>(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE',
    }),

  getNetBalances: (groupId: string) => request<NetBalance[]>(`/groups/${groupId}/balances`),

  getSettlementSuggestions: (groupId: string) =>
    request<SettlementSuggestion[]>(`/groups/${groupId}/settlements`),

  getPayments: (groupId: string) => request<Payment[]>(`/groups/${groupId}/payments`),

  recordPayment: (groupId: string, input: CreatePaymentInput) =>
    request<Payment>(`/groups/${groupId}/payments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  archiveGroup: (groupId: string) =>
    request<Group>(`/groups/${groupId}/archive`, {
      method: 'POST',
    }),

  reopenGroup: (groupId: string) =>
    request<Group>(`/groups/${groupId}/reopen`, {
      method: 'POST',
    }),
};
