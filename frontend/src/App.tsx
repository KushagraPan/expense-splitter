import { useEffect, useState } from 'react';
import { apiService } from './services/api';
import type { Group } from './types';
import './App.css';

export function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [name, setName] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    apiService
      .getGroups()
      .then((data) => {
        if (!ignore) {
          setGroups(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load groups');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a group name');
      return;
    }
    setError(null);
    try {
      const created = await apiService.createGroup({ name, currency });
      setGroups((prev) => [created, ...prev]);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">Expense Splitter</h1>
        <p className="app-subtitle">
          Shared expense management for groups and trips
        </p>
        <div className="status-badge-container">
          <span className="badge badge-info">
            Frontend Foundation (Mock Service Active)
          </span>
        </div>
      </header>

      <main>
        {/* Quick demonstration of centralized service layer */}
        <section className="card">
          <h2 className="card-title">Create Group</h2>
          <form onSubmit={handleCreateGroup} className="create-form">
            <input
              type="text"
              placeholder="e.g. Goa Trip 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="form-select"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
            <button type="submit" className="btn-primary">
              Add Group
            </button>
          </form>
          {error && <p className="error-text">{error}</p>}
        </section>

        <section className="card">
          <h2 className="card-title">Available Groups (via Service Layer)</h2>
          {loading ? (
            <p className="loading-text">Loading groups from mock service...</p>
          ) : groups.length === 0 ? (
            <p>No groups found. Create one above!</p>
          ) : (
            <ul className="group-list">
              {groups.map((group) => (
                <li key={group.id} className="group-item">
                  <div className="group-info">
                    <h4>{group.name}</h4>
                    <p>
                      Currency: <span className="currency-tag">{group.currency}</span> • ID: {group.id}
                    </p>
                  </div>
                  <span className="badge badge-active">{group.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="architecture-note">
          <strong>Architecture Invariant (Issue #1 Verified):</strong>
          <br />
          <code>UI (App.tsx)</code> ➔ <code>apiService (src/services/api.ts)</code> ➔ <code>mockStore (src/services/mockStore.ts)</code>
          <br />
          Components do not access mock storage directly. In Phase F, <code>api.ts</code> will swap to the FastAPI HTTP client without modifying UI components.
        </aside>
      </main>
    </div>
  );
}

export default App;
