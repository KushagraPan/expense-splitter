import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Group } from '../types';

interface GroupDashboardProps {
  onSelectGroup: (groupId: string) => void;
}

export function GroupDashboard({ onSelectGroup }: GroupDashboardProps) {
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
    <div>
      <section className="card">
        <h2 className="card-title">Create New Group</h2>
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
            Create Group
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="card">
        <h2 className="card-title">Your Groups</h2>
        {loading ? (
          <p className="loading-text">Loading groups...</p>
        ) : groups.length === 0 ? (
          <p>No groups available. Create your first group above!</p>
        ) : (
          <ul className="group-list">
            {groups.map((group) => (
              <li key={group.id} className="group-item">
                <div className="group-info">
                  <h4>{group.name}</h4>
                  <p>
                    Currency: <span className="currency-tag">{group.currency}</span> • Status:{' '}
                    <span className="status-text">{group.status}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectGroup(group.id)}
                  className="btn-secondary"
                >
                  Open Group →
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
