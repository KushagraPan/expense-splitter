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

import type { Group } from '../types';
import { mockStore } from './mockStore';

export interface ApiService {
  getGroups(): Promise<Group[]>;
  getGroup(id: string): Promise<Group | null>;
  createGroup(input: { name: string; currency: string }): Promise<Group>;
}

/**
 * Active API Service implementation.
 * Currently uses mockStore; can later be replaced by an HTTP client implementation.
 */
export const apiService: ApiService = {
  getGroups: () => mockStore.getGroups(),
  getGroup: (id: string) => mockStore.getGroup(id),
  createGroup: (input) => mockStore.createGroup(input),
};
