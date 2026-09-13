import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Group, Member, SplitMethod } from '../types';

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

  // Issue #4 expense creation state
  const [showExpenseForm, setShowExpenseForm] = useState<boolean>(false);
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expensePayerId, setExpensePayerId] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('EQUAL');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [exactShares, setExactShares] = useState<Record<string, string>>({});
  const [expenseCategory, setExpenseCategory] = useState<string>('');
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  const [expenseSuccess, setExpenseSuccess] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState<number>(0);

  useEffect(() => {
    let ignore = false;
    Promise.all([apiService.getGroup(groupId), apiService.getMembers(groupId)])
      .then(([groupData, membersData]) => {
        if (!ignore) {
          setGroup(groupData);
          setMembers(membersData);
          if (membersData.length > 0) {
            setExpensePayerId((prev) => prev || membersData[0].id);
            setSelectedParticipants(membersData.map((m) => m.id));
          }
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
      setSelectedParticipants((prev) => [...prev, created.id]);
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
      setMembers((prev) => {
        const remaining = prev.filter((m) => m.id !== memberId);
        if (expensePayerId === memberId && remaining.length > 0) {
          setExpensePayerId(remaining[0].id);
        }
        return remaining;
      });
      setSelectedParticipants((prev) => prev.filter((id) => id !== memberId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete member');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleParticipant = (memberId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleExactShareChange = (memberId: string, val: string) => {
    setExactShares((prev) => ({
      ...prev,
      [memberId]: val,
    }));
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError(null);
    setExpenseSuccess(null);

    const parsedAmount = parseFloat(expenseAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setExpenseError('Expense amount must be greater than zero');
      return;
    }

    if (selectedParticipants.length === 0) {
      setExpenseError('At least one participant is required');
      return;
    }

    try {
      setActionLoading(true);
      if (splitMethod === 'EQUAL') {
        const created = await apiService.createExpense(groupId, {
          title: expenseTitle,
          amount: parsedAmount,
          payer_id: expensePayerId,
          split_method: 'EQUAL',
          expense_date: expenseDate,
          category: expenseCategory,
          notes: expenseNotes,
          participants: selectedParticipants,
        });
        setExpenseSuccess(`Expense "${created.title}" (${group?.currency} ${created.amount.toFixed(2)}) created successfully!`);
      } else {
        const shares = selectedParticipants.map((id) => ({
          member_id: id,
          owed_amount: parseFloat(exactShares[id] || '0') || 0,
        }));
        const created = await apiService.createExpense(groupId, {
          title: expenseTitle,
          amount: parsedAmount,
          payer_id: expensePayerId,
          split_method: 'EXACT',
          expense_date: expenseDate,
          category: expenseCategory,
          notes: expenseNotes,
          shares,
        });
        setExpenseSuccess(`Expense "${created.title}" (${group?.currency} ${created.amount.toFixed(2)}) created successfully!`);
      }

      setCreatedCount((prev) => prev + 1);
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseCategory('');
      setExpenseNotes('');
      setExactShares({});
      setShowExpenseForm(false);
    } catch (err) {
      setExpenseError(err instanceof Error ? err.message : 'Failed to create expense');
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

  // Calculate live preview for exact shares
  const numericExpenseAmount = parseFloat(expenseAmount) || 0;
  const totalExactAllocated = selectedParticipants.reduce(
    (sum, id) => sum + (parseFloat(exactShares[id] || '0') || 0),
    0
  );
  const exactDifference = Number((numericExpenseAmount - totalExactAllocated).toFixed(2));

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
          This group is archived. Member management, expense creation, and modifications are disabled.
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

      {/* Expense Creation Section (Issue #4) */}
      <section className="card">
        <div className="section-header-between">
          <h3 className="card-title">Expenses</h3>
          {!isArchived && members.length > 0 && (
            <button
              type="button"
              className={showExpenseForm ? 'btn-secondary' : 'btn-primary'}
              onClick={() => {
                setShowExpenseForm((prev) => !prev);
                setExpenseError(null);
              }}
            >
              {showExpenseForm ? 'Cancel' : '+ Add Expense'}
            </button>
          )}
        </div>

        {expenseSuccess && (
          <div className="success-banner" role="status">
            <span className="success-banner-icon">✓</span>
            <span className="success-banner-message">{expenseSuccess}</span>
            <button
              type="button"
              className="btn-dismiss-success"
              onClick={() => setExpenseSuccess(null)}
              aria-label="Dismiss success message"
            >
              ✕
            </button>
          </div>
        )}

        {expenseError && (
          <div className="error-banner" role="alert">
            <span className="error-banner-icon">⚠</span>
            <span className="error-banner-message">{expenseError}</span>
            <button
              type="button"
              className="btn-dismiss-error"
              onClick={() => setExpenseError(null)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {isArchived && (
          <p className="empty-state-text">Expense creation is disabled because this group is archived.</p>
        )}

        {!isArchived && members.length === 0 && (
          <p className="empty-state-text">Please add at least one member above before creating an expense.</p>
        )}

        {!showExpenseForm && !isArchived && members.length > 0 && (
          <div className="expense-placeholder-state">
            <p className="empty-state-text">
              {createdCount > 0
                ? `${createdCount} expense(s) logged in this session.`
                : 'No new expenses logged in this session yet.'}
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setShowExpenseForm(true);
                setExpenseError(null);
              }}
            >
              + Add Expense
            </button>
          </div>
        )}

        {showExpenseForm && !isArchived && (
          <form onSubmit={handleCreateExpense} className="expense-form">
            <h4 className="subsection-title">New Expense</h4>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="expense-title" className="form-label">
                  Title / Description *
                </label>
                <input
                  id="expense-title"
                  type="text"
                  placeholder="e.g. Beach Shack Dinner, Fuel, Groceries"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="expense-amount" className="form-label">
                  Amount ({group.currency}) *
                </label>
                <div className="input-with-addon">
                  <input
                    id="expense-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="form-input"
                    required
                  />
                  <span className="input-addon">{group.currency}</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="expense-payer" className="form-label">
                  Payer *
                </label>
                <select
                  id="expense-payer"
                  value={expensePayerId}
                  onChange={(e) => setExpensePayerId(e.target.value)}
                  className="form-select"
                  required
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="expense-date" className="form-label">
                  Date *
                </label>
                <input
                  id="expense-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Split Method Selector */}
            <div className="split-method-section">
              <label className="form-label">Split Method *</label>
              <div className="radio-button-group">
                <label className={`radio-label ${splitMethod === 'EQUAL' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="splitMethod"
                    value="EQUAL"
                    checked={splitMethod === 'EQUAL'}
                    onChange={() => setSplitMethod('EQUAL')}
                  />
                  <span>Equal Split</span>
                </label>
                <label className={`radio-label ${splitMethod === 'EXACT' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="splitMethod"
                    value="EXACT"
                    checked={splitMethod === 'EXACT'}
                    onChange={() => setSplitMethod('EXACT')}
                  />
                  <span>Exact Amounts</span>
                </label>
              </div>
            </div>

            {/* Participants selection */}
            <div className="participants-section">
              <div className="participants-header">
                <label className="form-label">
                  Participants ({selectedParticipants.length} selected) *
                </label>
                <button
                  type="button"
                  className="btn-select-all"
                  onClick={() =>
                    setSelectedParticipants(
                      selectedParticipants.length === members.length ? [] : members.map((m) => m.id)
                    )
                  }
                >
                  {selectedParticipants.length === members.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {splitMethod === 'EQUAL' ? (
                <div className="participant-checkbox-grid">
                  {members.map((m) => {
                    const isChecked = selectedParticipants.includes(m.id);
                    return (
                      <label key={m.id} className={`participant-checkbox-label ${isChecked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleParticipant(m.id)}
                        />
                        <span className="participant-name">{m.name}</span>
                        {m.id === expensePayerId && <span className="payer-tag">(Payer)</span>}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="exact-shares-list">
                  {members.map((m) => {
                    const isChecked = selectedParticipants.includes(m.id);
                    return (
                      <div key={m.id} className="exact-share-item">
                        <label className="exact-share-label">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleParticipant(m.id)}
                          />
                          <span>{m.name}</span>
                          {m.id === expensePayerId && <span className="payer-tag">(Payer)</span>}
                        </label>
                        {isChecked && (
                          <div className="exact-amount-wrapper">
                            <span className="currency-prefix">{group.currency}</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={exactShares[m.id] || ''}
                              onChange={(e) => handleExactShareChange(m.id, e.target.value)}
                              className="form-input exact-amount-input"
                              aria-label={`Exact share for ${m.name}`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="exact-balance-indicator">
                    <span className="balance-info">
                      Total Allocated: <strong>{group.currency} {totalExactAllocated.toFixed(2)}</strong> / {group.currency} {numericExpenseAmount.toFixed(2)}
                    </span>
                    {Math.abs(exactDifference) <= 0.005 && numericExpenseAmount > 0 ? (
                      <span className="balance-badge badge-matched">✓ Balanced</span>
                    ) : (
                      <span className="balance-badge badge-mismatched">
                        Difference: {exactDifference > 0 ? `+${exactDifference.toFixed(2)}` : exactDifference.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Optional category & notes */}
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="expense-category" className="form-label">
                  Category (Optional)
                </label>
                <input
                  id="expense-category"
                  type="text"
                  placeholder="e.g. Food, Transport, Accommodation"
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="expense-notes" className="form-label">
                  Notes (Optional, max 255 chars)
                </label>
                <input
                  id="expense-notes"
                  type="text"
                  placeholder="Additional context"
                  maxLength={255}
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={actionLoading || isArchived}
                className="btn-primary"
              >
                {actionLoading ? 'Saving...' : 'Save Expense'}
              </button>
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Placeholder for future settlement modules */}
      <section className="card placeholder-section">
        <h3 className="card-title">Settlements & Balances</h3>
        <p className="empty-state-text">
          Net balance calculation and debt simplification will be available in Issues #5–#7.
        </p>
      </section>
    </div>
  );
}
