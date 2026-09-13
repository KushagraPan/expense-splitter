import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Group, Member } from '../types';

interface GroupDetailProps {
  groupId: string;
  onBack: () => void;
}

export function GroupDetail({ groupId, onBack }: GroupDetailProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([apiService.getGroup(groupId), apiService.getMembers(groupId)])
      .then(([groupData, membersData]) => {
        if (!ignore) {
          setGroup(groupData);
          setMembers(membersData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load group details');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [groupId]);

  if (loading) {
    return (
      <div className="card">
        <p className="loading-text">Loading group details...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="card">
        <button type="button" onClick={onBack} className="btn-link">
          ← Back to Groups
        </button>
        <p className="error-text">{error || 'Group not found.'}</p>
      </div>
    );
  }

  return (
    <div className="group-detail-view">
      <div className="detail-navigation">
        <button type="button" onClick={onBack} className="btn-link">
          ← Back to Groups
        </button>
      </div>

      <header className="card detail-header">
        <div className="header-main">
          <h2 className="group-detail-title">{group.name}</h2>
          <div className="detail-meta">
            <span className="badge badge-currency">Currency: {group.currency}</span>
            <span className="badge badge-active">{group.status}</span>
            <span className="meta-id">ID: {group.id}</span>
          </div>
        </div>
      </header>

      {/* Group Members (Read-only for Issue #2) */}
      <section className="card">
        <h3 className="card-title">Members ({members.length})</h3>
        {members.length === 0 ? (
          <p className="empty-state-text">No members in this group yet.</p>
        ) : (
          <ul className="member-tag-list">
            {members.map((member) => (
              <li key={member.id} className="member-tag">
                <span className="member-avatar">
                  {member.name.charAt(0).toUpperCase()}
                </span>
                <span className="member-name">{member.name}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="section-hint">
          Member management (adding & safe deletion) will be available in Issue #3.
        </p>
      </section>

      {/* Placeholder for future expense modules */}
      <section className="card placeholder-section">
        <h3 className="card-title">Expenses & Settlements</h3>
        <p className="empty-state-text">
          No expenses recorded yet. Expense creation and debt simplification will be available in Issues #4–#7.
        </p>
      </section>
    </div>
  );
}
