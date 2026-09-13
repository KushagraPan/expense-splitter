/**
 * In-memory Mock Data Store for Expense Splitter Frontend Prototype
 * Reference: product-spec.md, _docs/plan.md (Phase C)
 */

import type { Group, Member } from '../types';

const STORAGE_KEY = 'expense_splitter_groups';

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
];

/**
 * Safely loads groups from localStorage, falling back to SEEDED_GROUPS.
 * Merges any missing seeded groups into existing storage.
 */
function loadInitialGroups(): Group[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [...SEEDED_GROUPS];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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

/**
 * Safely persists groups array to localStorage.
 */
function saveGroupsToStorage(groups: Group[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Graceful fallback if storage quota exceeded or restricted
  }
}

let mockGroups: Group[] = loadInitialGroups();

// Initial pre-seeded mock members for existing groups
const mockMembers: Member[] = [
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
];

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
};
