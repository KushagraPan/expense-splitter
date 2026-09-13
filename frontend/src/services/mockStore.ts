/**
 * In-memory Mock Data Store with LocalStorage Persistence for Expense Splitter
 * Reference: product-spec.md, _docs/plan.md (Phase C)
 */

import type { Group, Member, Expense, Payment } from '../types';

const STORAGE_KEY_GROUPS = 'expense_splitter_groups';
const STORAGE_KEY_MEMBERS = 'expense_splitter_members';

// Initial pre-seeded mock groups
const SEEDED_GROUPS: Group[] = [
  {
    id: 'grp-himalaya-2026',
    name: 'Himalaya Trek',
    currency: 'INR',
    status: 'ACTIVE',
    created_at: new Date('2026-09-12T09:00:00Z').toISOString(),
  },
  {
    id: 'grp-goa-2026',
    name: 'Goa Weekend Trip',
    currency: 'INR',
    status: 'ACTIVE',
    created_at: new Date('2026-09-10T10:00:00Z').toISOString(),
  },
  {
    id: 'grp-apt-4b',
    name: 'Apartment 4B Utilities',
    currency: 'USD',
    status: 'ACTIVE',
    created_at: new Date('2026-09-01T08:30:00Z').toISOString(),
  },
  {
    id: 'grp-ski-2025',
    name: 'Ski Trip 2025',
    currency: 'EUR',
    status: 'ARCHIVED',
    created_at: new Date('2025-01-10T10:00:00Z').toISOString(),
  },
];

// Initial pre-seeded mock members
const SEEDED_MEMBERS: Member[] = [
  {
    id: 'mem-1',
    group_id: 'grp-goa-2026',
    name: 'Alice',
    created_at: '2026-09-10T10:05:00Z',
  },
  {
    id: 'mem-2',
    group_id: 'grp-goa-2026',
    name: 'Bob',
    created_at: '2026-09-10T10:05:00Z',
  },
  {
    id: 'mem-3',
    group_id: 'grp-goa-2026',
    name: 'Charlie',
    created_at: '2026-09-10T10:05:00Z',
  },
  {
    id: 'mem-4',
    group_id: 'grp-apt-4b',
    name: 'David',
    created_at: '2026-09-01T08:35:00Z',
  },
  {
    id: 'mem-5',
    group_id: 'grp-apt-4b',
    name: 'Emma',
    created_at: '2026-09-01T08:35:00Z',
  },
  {
    id: 'mem-6',
    group_id: 'grp-himalaya-2026',
    name: 'Aarav',
    created_at: '2026-09-12T09:15:00Z',
  },
  {
    id: 'mem-7',
    group_id: 'grp-himalaya-2026',
    name: 'Priya',
    created_at: '2026-09-12T09:15:00Z',
  },
  {
    id: 'mem-8',
    group_id: 'grp-himalaya-2026',
    name: 'Rohan',
    created_at: '2026-09-12T09:15:00Z',
  },
  {
    id: 'mem-9',
    group_id: 'grp-ski-2025',
    name: 'Frank',
    created_at: '2025-01-10T10:15:00Z',
  },
];

/**
 * Internal mock financial records for referential integrity checks.
 * In Goa Weekend Trip:
 * - Alice is payer of exp-1 (has financial history -> deletion blocked)
 * - Bob is participant in exp-1 (has financial history -> deletion blocked)
 * - Charlie has zero financial history -> deletion succeeds
 */
const mockExpenses: Expense[] = [
  {
    id: 'exp-1',
    group_id: 'grp-goa-2026',
    title: 'Beach Shack Dinner',
    amount: 1200,
    payer_id: 'mem-1', // Alice paid
    split_method: 'EQUAL',
    expense_date: '2026-09-10',
    created_at: '2026-09-10T11:00:00Z',
    shares: [
      { expense_id: 'exp-1', member_id: 'mem-1', owed_amount: 600 },
      { expense_id: 'exp-1', member_id: 'mem-2', owed_amount: 600 }, // Bob participated
    ],
  },
];

const mockPayments: Payment[] = [];

/**
 * Safely loads groups from localStorage, falling back to SEEDED_GROUPS.
 */
function loadInitialGroups(): Group[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [...SEEDED_GROUPS];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_GROUPS);
    if (!raw) {
      saveGroupsToStorage(SEEDED_GROUPS);
      return [...SEEDED_GROUPS];
    }
    const parsed: Group[] = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const existingIds = new Set(parsed.map((g) => g.id));
      const missingSeeded = SEEDED_GROUPS.filter((g) => !existingIds.has(g.id));
      const combined = [...missingSeeded, ...parsed];
      if (missingSeeded.length > 0) {
        saveGroupsToStorage(combined);
      }
      return combined;
    }
    saveGroupsToStorage(SEEDED_GROUPS);
    return [...SEEDED_GROUPS];
  } catch {
    return [...SEEDED_GROUPS];
  }
}

function saveGroupsToStorage(groups: Group[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groups));
  } catch {
    // Graceful fallback
  }
}

/**
 * Safely loads members from localStorage, falling back to SEEDED_MEMBERS.
 */
function loadInitialMembers(): Member[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [...SEEDED_MEMBERS];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_MEMBERS);
    if (!raw) {
      saveMembersToStorage(SEEDED_MEMBERS);
      return [...SEEDED_MEMBERS];
    }
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as Member[];
    }
    saveMembersToStorage(SEEDED_MEMBERS);
    return [...SEEDED_MEMBERS];
  } catch {
    return [...SEEDED_MEMBERS];
  }
}

function saveMembersToStorage(members: Member[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
  } catch {
    // Graceful fallback
  }
}

let mockGroups: Group[] = loadInitialGroups();
let mockMembers: Member[] = loadInitialMembers();

/**
 * Mock Store API implementation simulating asynchronous backend calls.
 */
export const mockStore = {
  async getGroups(): Promise<Group[]> {
    return [...mockGroups];
  },

  async getGroup(id: string): Promise<Group | null> {
    const found = mockGroups.find((g) => g.id === id);
    return found ? { ...found } : null;
  },

  async createGroup(input: { name: string; currency: string }): Promise<Group> {
    if (!input.name.trim()) {
      throw new Error('Group name cannot be empty');
    }
    const newGroup: Group = {
      id: `grp-${Date.now()}`,
      name: input.name.trim(),
      currency: input.currency.trim().toUpperCase() || 'USD',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };
    mockGroups = [newGroup, ...mockGroups];
    saveGroupsToStorage(mockGroups);
    return { ...newGroup };
  },

  async getMembers(groupId: string): Promise<Member[]> {
    return mockMembers
      .filter((m) => m.group_id === groupId)
      .map((m) => ({ ...m }));
  },

  async addMember(groupId: string, name: string): Promise<Member> {
    const group = mockGroups.find((g) => g.id === groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    if (group.status === 'ARCHIVED') {
      throw new Error('Cannot add member to an archived group');
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Member name cannot be empty');
    }

    const duplicate = mockMembers.some(
      (m) =>
        m.group_id === groupId &&
        m.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      throw new Error('Member name must be unique within the group');
    }

    const newMember: Member = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      group_id: groupId,
      name: trimmedName,
      created_at: new Date().toISOString(),
    };

    mockMembers = [...mockMembers, newMember];
    saveMembersToStorage(mockMembers);
    return { ...newMember };
  },

  async deleteMember(groupId: string, memberId: string): Promise<void> {
    const group = mockGroups.find((g) => g.id === groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    if (group.status === 'ARCHIVED') {
      throw new Error('Cannot delete member from an archived group');
    }

    const member = mockMembers.find(
      (m) => m.id === memberId && m.group_id === groupId
    );
    if (!member) {
      throw new Error('Member not found');
    }

    // Zero-history check across expenses and payments
    const hasExpenseHistory = mockExpenses.some(
      (e) =>
        e.group_id === groupId &&
        (e.payer_id === memberId ||
          (e.shares && e.shares.some((s) => s.member_id === memberId)))
    );

    const hasPaymentHistory = mockPayments.some(
      (p) =>
        p.group_id === groupId &&
        (p.payer_id === memberId || p.recipient_id === memberId)
    );

    if (hasExpenseHistory || hasPaymentHistory) {
      throw new Error('Cannot delete member with existing financial history');
    }

    mockMembers = mockMembers.filter((m) => m.id !== memberId);
    saveMembersToStorage(mockMembers);
  },
};
