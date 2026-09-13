import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Group, Member, SplitMethod, Expense, NetBalance, SettlementSuggestion } from '../types';

interface GroupDetailProps {
  groupId: string;
  onBack: () => void;
}

export function GroupDetail({ groupId, onBack }: GroupDetailProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<NetBalance[]>([]);
  const [settlements, setSettlements] = useState<SettlementSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Issue #3 member management state
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Issue #4 & #5 expense management state
  const [showExpenseForm, setShowExpenseForm] = useState<boolean>(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expandedExpenseIds, setExpandedExpenseIds] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    let ignore = false;
    Promise.all([
      apiService.getGroup(groupId),
      apiService.getMembers(groupId),
      apiService.getExpenses(groupId),
      apiService.getNetBalances(groupId),
      apiService.getSettlementSuggestions(groupId),
    ])
      .then(([groupData, membersData, expensesData, balancesData, settlementsData]) => {
        if (!ignore) {
          setGroup(groupData);
          setMembers(membersData);
          setExpenses(expensesData);
          setBalances(balancesData);
          setSettlements(settlementsData);
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
      const [updatedBalances, updatedSettlements] = await Promise.all([
        apiService.getNetBalances(groupId),
        apiService.getSettlementSuggestions(groupId),
      ]);
      setBalances(updatedBalances);
      setSettlements(updatedSettlements);
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
      const [updatedBalances, updatedSettlements] = await Promise.all([
        apiService.getNetBalances(groupId),
        apiService.getSettlementSuggestions(groupId),
      ]);
      setBalances(updatedBalances);
      setSettlements(updatedSettlements);
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

  const handleStartEditExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setExpenseTitle(expense.title);
    setExpenseAmount(expense.amount.toString());
    setExpensePayerId(expense.payer_id);
    setExpenseDate(expense.expense_date);
    setSplitMethod(expense.split_method);
    setExpenseCategory(expense.category || '');
    setExpenseNotes(expense.notes || '');

    const participantIds = expense.shares ? expense.shares.map((s) => s.member_id) : [];
    setSelectedParticipants(participantIds);

    const sharesMap: Record<string, string> = {};
    if (expense.shares) {
      expense.shares.forEach((s) => {
        sharesMap[s.member_id] = s.owed_amount.toString();
      });
    }
    setExactShares(sharesMap);

    setShowExpenseForm(true);
    setExpenseError(null);
    setExpenseSuccess(null);
  };

  const handleCancelExpenseForm = () => {
    setShowExpenseForm(false);
    setEditingExpenseId(null);
    setExpenseTitle('');
    setExpenseAmount('');
    if (members.length > 0) {
      setExpensePayerId(members[0].id);
      setSelectedParticipants(members.map((m) => m.id));
    } else {
      setExpensePayerId('');
      setSelectedParticipants([]);
    }
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setSplitMethod('EQUAL');
    setExpenseCategory('');
    setExpenseNotes('');
    setExactShares({});
    setExpenseError(null);
  };

  const handleOpenAddExpense = () => {
    setEditingExpenseId(null);
    setExpenseTitle('');
    setExpenseAmount('');
    if (members.length > 0) {
      setExpensePayerId(members[0].id);
      setSelectedParticipants(members.map((m) => m.id));
    }
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setSplitMethod('EQUAL');
    setExpenseCategory('');
    setExpenseNotes('');
    setExactShares({});
    setExpenseError(null);
    setExpenseSuccess(null);
    setShowExpenseForm(true);
  };

  const toggleExpenseExpanded = (expenseId: string) => {
    setExpandedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(expenseId)) {
        next.delete(expenseId);
      } else {
        next.add(expenseId);
      }
      return next;
    });
  };

  const handleDeleteExpense = async (expense: Expense) => {
    setExpenseError(null);
    setExpenseSuccess(null);

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete the expense "${expense.title}"?`
    );
    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(true);
      await apiService.deleteExpense(groupId, expense.id);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
      if (editingExpenseId === expense.id) {
        handleCancelExpenseForm();
      }
      setExpenseSuccess(`Expense "${expense.title}" deleted successfully!`);
      const [updatedBalances, updatedSettlements] = await Promise.all([
        apiService.getNetBalances(groupId),
        apiService.getSettlementSuggestions(groupId),
      ]);
      setBalances(updatedBalances);
      setSettlements(updatedSettlements);
    } catch (err) {
      setExpenseError(err instanceof Error ? err.message : 'Failed to delete expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
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
        const payload = {
          title: expenseTitle,
          amount: parsedAmount,
          payer_id: expensePayerId,
          split_method: 'EQUAL' as const,
          expense_date: expenseDate,
          category: expenseCategory.trim() || undefined,
          notes: expenseNotes.trim() || undefined,
          participants: selectedParticipants,
        };

        if (editingExpenseId) {
          const updated = await apiService.updateExpense(groupId, editingExpenseId, payload);
          setExpenses((prev) =>
            prev.map((item) => (item.id === editingExpenseId ? updated : item))
          );
          setExpenseSuccess(
            `Expense "${updated.title}" (${group?.currency} ${updated.amount.toFixed(2)}) updated successfully!`
          );
        } else {
          const created = await apiService.createExpense(groupId, payload);
          setExpenses((prev) => [created, ...prev]);
          setExpenseSuccess(
            `Expense "${created.title}" (${group?.currency} ${created.amount.toFixed(2)}) created successfully!`
          );
        }
      } else {
        const shares = selectedParticipants.map((id) => ({
          member_id: id,
          owed_amount: parseFloat(exactShares[id] || '0') || 0,
        }));
        const payload = {
          title: expenseTitle,
          amount: parsedAmount,
          payer_id: expensePayerId,
          split_method: 'EXACT' as const,
          expense_date: expenseDate,
          category: expenseCategory.trim() || undefined,
          notes: expenseNotes.trim() || undefined,
          shares,
        };

        if (editingExpenseId) {
          const updated = await apiService.updateExpense(groupId, editingExpenseId, payload);
          setExpenses((prev) =>
            prev.map((item) => (item.id === editingExpenseId ? updated : item))
          );
          setExpenseSuccess(
            `Expense "${updated.title}" (${group?.currency} ${updated.amount.toFixed(2)}) updated successfully!`
          );
        } else {
          const created = await apiService.createExpense(groupId, payload);
          setExpenses((prev) => [created, ...prev]);
          setExpenseSuccess(
            `Expense "${created.title}" (${group?.currency} ${created.amount.toFixed(2)}) created successfully!`
          );
        }
      }

      const [updatedBalances, updatedSettlements] = await Promise.all([
        apiService.getNetBalances(groupId),
        apiService.getSettlementSuggestions(groupId),
      ]);
      setBalances(updatedBalances);
      setSettlements(updatedSettlements);
      handleCancelExpenseForm();
    } catch (err) {
      setExpenseError(err instanceof Error ? err.message : 'Failed to save expense');
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

      {/* Expense Management Section (Issues #4 & #5) */}
      <section className="card">
        <div className="section-header-between">
          <h3 className="card-title">Expenses ({expenses.length})</h3>
          {!isArchived && members.length > 0 && !showExpenseForm && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleOpenAddExpense}
            >
              + Add Expense
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
          <p className="empty-state-text">Expense creation, editing, and deletion are disabled because this group is archived.</p>
        )}

        {!isArchived && members.length === 0 && (
          <p className="empty-state-text">Please add at least one member above before creating an expense.</p>
        )}

        {/* Expense Form (Create or Edit) */}
        {showExpenseForm && !isArchived && (
          <form onSubmit={handleSaveExpense} className="expense-form">
            <div className="form-header-row">
              <h4 className="subsection-title">
                {editingExpenseId ? 'Edit Expense' : 'New Expense'}
              </h4>
              <button
                type="button"
                onClick={handleCancelExpenseForm}
                className="btn-link"
              >
                Cancel
              </button>
            </div>

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
                {actionLoading ? 'Saving...' : (editingExpenseId ? 'Update Expense' : 'Save Expense')}
              </button>
              <button
                type="button"
                onClick={handleCancelExpenseForm}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Expense List View */}
        <div className="expense-list-container">
          {expenses.length === 0 ? (
            <p className="empty-state-text">No expenses recorded for this group yet.</p>
          ) : (
            <div className="expense-list">
              {expenses.map((exp) => {
                const payerMember = members.find((m) => m.id === exp.payer_id);
                const isExpanded = expandedExpenseIds.has(exp.id);
                const isPayerParticipant = exp.shares?.some((s) => s.member_id === exp.payer_id);

                return (
                  <div key={exp.id} className="expense-card">
                    <div className="expense-card-header">
                      <div className="expense-primary-info">
                        <h4 className="expense-title">{exp.title}</h4>
                        <div className="expense-meta-row">
                          <span className="expense-date">{exp.expense_date}</span>
                          <span className="meta-separator">•</span>
                          <span className="expense-payer">
                            Paid by <strong>{payerMember ? payerMember.name : exp.payer_id}</strong>
                          </span>
                          {exp.category && (
                            <>
                              <span className="meta-separator">•</span>
                              <span className="badge badge-category">{exp.category}</span>
                            </>
                          )}
                          <span className="meta-separator">•</span>
                          <span className="badge badge-split">
                            {exp.split_method === 'EQUAL' ? 'Equal Split' : 'Exact Split'}
                          </span>
                        </div>
                      </div>

                      <div className="expense-header-right">
                        <span className="expense-total-amount">
                          {group.currency} {exp.amount.toFixed(2)}
                        </span>
                        <div className="expense-actions">
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => toggleExpenseExpanded(exp.id)}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? 'Hide Details' : 'Details'}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => handleStartEditExpense(exp)}
                            disabled={isArchived || actionLoading}
                            title={isArchived ? 'Cannot edit expense in an archived group' : `Edit ${exp.title}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-delete-expense btn-sm"
                            onClick={() => handleDeleteExpense(exp)}
                            disabled={isArchived || actionLoading}
                            title={isArchived ? 'Cannot delete expense from an archived group' : `Delete ${exp.title}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Detailed breakdown when expanded */}
                    {isExpanded && (
                      <div className="expense-details-expanded">
                        {exp.notes && (
                          <div className="expense-notes-display">
                            <strong>Notes:</strong> {exp.notes}
                          </div>
                        )}

                        <div className="expense-shares-section">
                          <h5 className="shares-breakdown-title">
                            Participant Shares ({exp.shares?.length || 0})
                          </h5>
                          <ul className="shares-detail-list">
                            {exp.shares?.map((share) => {
                              const participant = members.find((m) => m.id === share.member_id);
                              const isPayer = share.member_id === exp.payer_id;
                              return (
                                <li key={share.member_id} className="share-detail-item">
                                  <span className="share-member-name">
                                    {participant ? participant.name : share.member_id}
                                    {isPayer && <span className="payer-tag"> (Payer)</span>}
                                  </span>
                                  <span className="share-owed-amount">
                                    {group.currency} {share.owed_amount.toFixed(2)}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>

                          {!isPayerParticipant && (
                            <p className="payer-excluded-note">
                              ℹ Payer ({payerMember ? payerMember.name : exp.payer_id}) is excluded from participants and owes {group.currency} 0.00.
                            </p>
                          )}
                        </div>

                        <div className="expense-timestamp-meta">
                          <span>Created: {new Date(exp.created_at).toLocaleString()}</span>
                          {exp.updated_at && (
                            <span> • Updated: {new Date(exp.updated_at).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Net Balances Section (Issue #6) */}
      <section className="card">
        <div className="section-header">
          <h3 className="card-title">Net Balances</h3>
        </div>

        {members.length === 0 ? (
          <p className="empty-state-text">No members in this group yet.</p>
        ) : (
          <div className="balances-container">
            <div className="balances-list">
              {balances.map((b) => {
                let statusClass = 'badge-settled';
                let statusLabel = 'Settled';
                let amountClass = 'balance-zero';
                let formattedAmount = `${group.currency} 0.00`;

                if (b.net_balance > 0) {
                  statusClass = 'badge-creditor';
                  statusLabel = 'Owed';
                  amountClass = 'balance-positive';
                  formattedAmount = `+${group.currency} ${b.net_balance.toFixed(2)}`;
                } else if (b.net_balance < 0) {
                  statusClass = 'badge-debtor';
                  statusLabel = 'Owes';
                  amountClass = 'balance-negative';
                  formattedAmount = `-${group.currency} ${Math.abs(b.net_balance).toFixed(2)}`;
                }

                return (
                  <div key={b.member_id} className="balance-item">
                    <div className="balance-member-info">
                      <span className="member-avatar">
                        {b.member_name.charAt(0).toUpperCase()}
                      </span>
                      <div className="balance-name-group">
                        <span className="balance-member-name">{b.member_name}</span>
                        {b.paid_amount !== undefined && b.owed_amount !== undefined && (
                          <span className="balance-subtext">
                            Paid: {group.currency} {b.paid_amount.toFixed(2)} • Owed: {group.currency} {b.owed_amount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="balance-status-group">
                      <span className={`balance-amount ${amountClass}`}>
                        {formattedAmount}
                      </span>
                      <span className={`badge ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Settlement Suggestions Section (Issue #7) */}
      <section className="card">
        <div className="section-header">
          <h3 className="card-title">Settlement Suggestions</h3>
        </div>

        {members.length === 0 ? (
          <p className="empty-state-text">No members in this group yet.</p>
        ) : settlements.length === 0 ? (
          <div className="settled-state-box">
            <span className="settled-icon">✓</span>
            <div className="settled-text-group">
              <span className="settled-title">All settled</span>
              <span className="settled-subtitle">No outstanding debts in this group.</span>
            </div>
          </div>
        ) : (
          <div className="settlement-container">
            <div className="settlement-list">
              {settlements.map((s, idx) => (
                <div key={`${s.payer_id}-${s.recipient_id}-${idx}`} className="settlement-item">
                  <div className="settlement-flow">
                    <span className="settlement-participant settlement-payer">{s.payer_name}</span>
                    <span className="settlement-arrow">pays</span>
                    <span className="settlement-participant settlement-recipient">{s.recipient_name}</span>
                  </div>
                  <div className="settlement-amount-badge">
                    <span className="settlement-amount">
                      {group.currency} {s.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
