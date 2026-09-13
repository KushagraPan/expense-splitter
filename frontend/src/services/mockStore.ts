/**
 * In-memory Mock Data Store for Expense Splitter Frontend Prototype
 * Reference: product-spec.md, _docs/plan.md (Phase C)
 */

import type { Group } from '../types';

// Initial pre-seeded mock groups
let mockGroups: Group[] = [
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
 * Mock Store API implementation simulating asynchronous backend calls.
 */
export const mockStore = {
  async getGroups(): Promise<Group[]> {
    // Return a cloned copy to prevent external mutation
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
    return { ...newGroup };
  },
};
