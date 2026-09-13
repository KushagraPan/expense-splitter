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

  // Issue #3 member management state
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      setActionLoading(true);
      const created = await apiService.addMember(groupId, newMemberName);
      setMembers((prev) => [...prev, created]);
      setNewMemberName('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    setActionError(null);
    try {
      setActionLoading(true);
      await apiService.deleteMember(groupId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete member');
    } finally {
      setActionLoading(false);
    }
  };

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

  const isArchived = group.status === 'ARCHIVED';

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
            <span className={`badge ${isArchived ? 'badge-archived' : 'badge-active'}`}>
              {group.status}
            </span>
            <span className="meta-id">ID: {group.id}</span>
          </div>
        </div>
      </header>

      {isArchived && (
        <div className="alert-archived" role="note">
          This group is archived. Member management and modifications are disabled.
        </div>
      )}

      {/* Member Management Section (Issue #3) */}
      <section className="card">
        <div className="section-header">
          <h3 className="card-title">Members ({members.length})</h3>
        </div>

        {actionError && (
          <div className="error-banner" role="alert">
            <span className="error-banner-icon">⚠</span>
            <span className="error-banner-message">{actionError}</span>
            <button
              type="button"
              className="btn-dismiss-error"
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {members.length === 0 ? (
          <p className="empty-state-text">No members in this group yet.</p>
        ) : (
          <ul className="member-list">
            {members.map((member) => (
              <li key={member.id} className="member-item">
                <div className="member-info">
                  <span className="member-avatar">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="member-name">{member.name}</span>
                </div>
                <button
                  type="button"
                  className="btn-delete-member"
                  onClick={() => handleDeleteMember(member.id)}
                  disabled={isArchived || actionLoading}
                  title={
                    isArchived
                      ? 'Cannot delete member from an archived group'
                      : `Delete ${member.name}`
                  }
                  aria-label={`Delete ${member.name}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add Member Form */}
        <div className="add-member-section">
          <h4 className="subsection-title">Add Member</h4>
          <form onSubmit={handleAddMember} className="add-member-form">
            <div className="form-group-inline">
              <input
                type="text"
                placeholder={
                  isArchived ? 'Group is archived (adding disabled)' : 'Enter member name...'
                }
                value={newMemberName}
                onChange={(e) => {
                  setNewMemberName(e.target.value);
                  if (actionError) setActionError(null);
                }}
                disabled={isArchived || actionLoading}
                className="form-input"
                aria-label="New member name"
              />
              <button
                type="submit"
                disabled={isArchived || actionLoading}
                className="btn-primary"
              >
                {actionLoading ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
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
