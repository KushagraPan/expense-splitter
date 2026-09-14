import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Group, Member, SplitMethod, Expense, NetBalance, SettlementSuggestion, Payment } from '../types';

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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Issue #3 member management state
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Expense management state (Multiple Payers & Splits)
  const [showExpenseForm, setShowExpenseForm] = useState<boolean>(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expandedExpenseIds, setExpandedExpenseIds] = useState<Set<string>>(new Set());
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expensePayers, setExpensePayers] = useState<{ member_id: string; amount: string }[]>([]);
  const [expenseDate, setExpenseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('EQUAL');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [exactShares, setExactShares] = useState<Record<string, string>>({});
  const [expenseCategory, setExpenseCategory] = useState<string>('');
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  const [expenseSuccess, setExpenseSuccess] = useState<string | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Issue #8 lifecycle state
  const [lifecycleSuccess, setLifecycleSuccess] = useState<string | null>(null);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);

  // Payment Recording & Settlement state (Iteration 3)
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'PARTIAL' | 'STANDALONE'>('FULL');
  const [showHowItWorks, setShowHowItWorks] = useState<boolean>(false);
  const [paymentPayerId, setPaymentPayerId] = useState<string>('');
  const [paymentRecipientId, setPaymentRecipientId] = useState<string>('');
  const [paymentPayerName, setPaymentPayerName] = useState<string>('');
  const [paymentRecipientName, setPaymentRecipientName] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMaxAmount, setPaymentMaxAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentLoading, setPaymentLoading] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      apiService.getGroup(groupId),
      apiService.getMembers(groupId),
      apiService.getExpenses(groupId),
      apiService.getNetBalances(groupId),
      apiService.getSettlementSuggestions(groupId),
      apiService.getPayments(groupId),
    ])
      .then(([groupData, membersData, expensesData, balancesData, settlementsData, paymentsData]) => {
        if (!ignore) {
          setGroup(groupData);
          setMembers(membersData);
          setExpenses(expensesData);
          setBalances(balancesData);
          setSettlements(settlementsData);
          setPayments(paymentsData);
          if (membersData.length > 0) {
            setExpensePayers((prev) => (prev.length > 0 ? prev : [{ member_id: membersData[0].id, amount: '' }]));
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
        setExpensePayers((currentPayers) => {
          const filtered = currentPayers.filter((p) => p.member_id !== memberId);
          if (filtered.length === 0 && remaining.length > 0) {
            return [{ member_id: remaining[0].id, amount: '' }];
          }
          return filtered;
        });
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

  const handleAddPayerRow = () => {
    const usedIds = new Set(expensePayers.map((p) => p.member_id));
    const available = members.find((m) => !usedIds.has(m.id)) || members[0];
    if (available) {
      setExpensePayers((prev) => [...prev, { member_id: available.id, amount: '' }]);
    }
  };

  const handleRemovePayerRow = (index: number) => {
    setExpensePayers((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePayerMemberChange = (index: number, memberId: string) => {
    setExpensePayers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], member_id: memberId };
      return copy;
    });
  };

  const handlePayerAmountChange = (index: number, val: string) => {
    setExpensePayers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], amount: val };
      return copy;
    });
  };

  const handleExpenseAmountChange = (val: string) => {
    setExpenseAmount(val);
    setExpensePayers((prev) => {
      if (prev.length <= 1) {
        const memberId = prev[0]?.member_id || (members[0]?.id ?? '');
        return [{ member_id: memberId, amount: val }];
      }
      return prev;
    });
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
    if (expense.payers && expense.payers.length > 0) {
      setExpensePayers(
        expense.payers.map((p) => ({
          member_id: p.member_id,
          amount: p.amount.toString(),
        }))
      );
    } else {
      setExpensePayers(
        members.length > 0 ? [{ member_id: members[0].id, amount: expense.amount.toString() }] : []
      );
    }
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
    setExpensePayers(members.length > 0 ? [{ member_id: members[0].id, amount: '' }] : []);
    setSelectedParticipants(members.map((m) => m.id));
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setSplitMethod('EQUAL');
    setExpenseCategory('');
    setExpenseNotes('');
    setExactShares({});
    setExpenseError(null);
  };

  const handleArchiveGroup = async () => {
    setLifecycleError(null);
    setLifecycleSuccess(null);
    try {
      setActionLoading(true);
      const updated = await apiService.archiveGroup(groupId);
      setGroup(updated);
      setLifecycleSuccess('Group has been archived successfully and is now read-only.');
      handleCancelExpenseForm();
    } catch (err) {
      setLifecycleError(err instanceof Error ? err.message : 'Failed to archive group');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenGroup = async () => {
    setLifecycleError(null);
    setLifecycleSuccess(null);
    try {
      setActionLoading(true);
      const updated = await apiService.reopenGroup(groupId);
      setGroup(updated);
      setLifecycleSuccess('Group has been reopened successfully and editing is unlocked.');
    } catch (err) {
      setLifecycleError(err instanceof Error ? err.message : 'Failed to reopen group');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenFullPaymentModal = (suggestion: SettlementSuggestion) => {
    setPaymentMode('FULL');
    setPaymentError(null);
    setPaymentPayerId(suggestion.payer_id);
    setPaymentRecipientId(suggestion.recipient_id);
    setPaymentPayerName(suggestion.payer_name);
    setPaymentRecipientName(suggestion.recipient_name);
    setPaymentAmount(suggestion.amount.toFixed(2));
    setPaymentMaxAmount(suggestion.amount);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleOpenPartialPaymentModal = (suggestion: SettlementSuggestion) => {
    setPaymentMode('PARTIAL');
    setPaymentError(null);
    setPaymentPayerId(suggestion.payer_id);
    setPaymentRecipientId(suggestion.recipient_id);
    setPaymentPayerName(suggestion.payer_name);
    setPaymentRecipientName(suggestion.recipient_name);
    setPaymentAmount('');
    setPaymentMaxAmount(suggestion.amount);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleOpenStandalonePaymentModal = () => {
    setPaymentMode('STANDALONE');
    setPaymentError(null);
    const debtorIds = Array.from(new Set(settlements.map((s) => s.payer_id)));
    const initialPayer = debtorIds.length > 0 ? debtorIds[0] : (members[0]?.id || '');
    const matching = settlements.filter((s) => s.payer_id === initialPayer);
    const initialRecipient = matching.length > 0 ? matching[0].recipient_id : (members.find((m) => m.id !== initialPayer)?.id || '');
    const initialMax = matching.length > 0 ? matching[0].amount : 0;

    const pName = members.find((m) => m.id === initialPayer)?.name || initialPayer;
    const rName = members.find((m) => m.id === initialRecipient)?.name || initialRecipient;

    setPaymentPayerId(initialPayer);
    setPaymentRecipientId(initialRecipient);
    setPaymentPayerName(pName);
    setPaymentRecipientName(rName);
    setPaymentAmount('');
    setPaymentMaxAmount(initialMax);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleStandalonePayerChange = (newPayerId: string) => {
    setPaymentPayerId(newPayerId);
    const pName = members.find((m) => m.id === newPayerId)?.name || newPayerId;
    setPaymentPayerName(pName);

    const matching = settlements.filter((s) => s.payer_id === newPayerId);
    if (matching.length > 0) {
      const firstMatch = matching[0];
      setPaymentRecipientId(firstMatch.recipient_id);
      setPaymentRecipientName(firstMatch.recipient_name);
      setPaymentMaxAmount(firstMatch.amount);
    } else {
      const other = members.find((m) => m.id !== newPayerId);
      const otherId = other?.id || '';
      setPaymentRecipientId(otherId);
      setPaymentRecipientName(other?.name || otherId);
      setPaymentMaxAmount(0);
    }
    setPaymentError(null);
  };

  const handleStandaloneRecipientChange = (newRecipientId: string) => {
    setPaymentRecipientId(newRecipientId);
    const rName = members.find((m) => m.id === newRecipientId)?.name || newRecipientId;
    setPaymentRecipientName(rName);

    const match = settlements.find(
      (s) => s.payer_id === paymentPayerId && s.recipient_id === newRecipientId
    );
    setPaymentMaxAmount(match ? match.amount : 0);
    setPaymentError(null);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentError(null);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setPaymentError('Payment amount must be greater than zero');
      return;
    }

    if (paymentMaxAmount <= 0) {
      setPaymentError('No outstanding settlement is currently suggested in this direction');
      return;
    }

    if (parsedAmount > paymentMaxAmount + 0.0001) {
      setPaymentError(
        `Payment amount exceeds currently suggested settlement amount of ${group?.currency} ${paymentMaxAmount.toFixed(2)}`
      );
      return;
    }

    try {
      setPaymentLoading(true);
      const recorded = await apiService.recordPayment(groupId, {
        payer_id: paymentPayerId,
        recipient_id: paymentRecipientId,
        amount: parsedAmount,
        payment_date: paymentDate,
        notes: paymentNotes.trim() || undefined,
      });

      const [updatedBalances, updatedSettlements, updatedPayments] = await Promise.all([
        apiService.getNetBalances(groupId),
        apiService.getSettlementSuggestions(groupId),
        apiService.getPayments(groupId),
      ]);

      setBalances(updatedBalances);
      setSettlements(updatedSettlements);
      setPayments(updatedPayments);
      setShowPaymentModal(false);

      const pName = members.find((m) => m.id === paymentPayerId)?.name || paymentPayerId;
      const rName = members.find((m) => m.id === paymentRecipientId)?.name || paymentRecipientId;
      setPaymentSuccess(`${pName} paid ${rName} ${group?.currency} ${recorded.amount.toFixed(2)}.`);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleOpenAddExpense = () => {
    setEditingExpenseId(null);
    setExpenseTitle('');
    setExpenseAmount('');
    if (members.length > 0) {
      setExpensePayers([{ member_id: members[0].id, amount: '' }]);
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
      const [updatedBalances, updatedSettlements, updatedPayments] = await Promise.all([
        apiService.getNetBalances(groupId),
        apiService.getSettlementSuggestions(groupId),
        apiService.getPayments(groupId),
      ]);
      setBalances(updatedBalances);
      setSettlements(updatedSettlements);
      setPayments(updatedPayments);
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

    const trimmedTitle = expenseTitle.trim();
    if (!trimmedTitle) {
      setExpenseError('Expense title cannot be empty');
      return;
    }

    const parsedAmount = parseFloat(expenseAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setExpenseError('Expense amount must be greater than zero');
      return;
    }

    if (expensePayers.length === 0) {
      setExpenseError('At least one payer is required');
      return;
    }

    const totalCents = Math.round(parsedAmount * 100);
    let payerSumCents = 0;
    const payersPayload: { member_id: string; amount: number }[] = [];

    for (const p of expensePayers) {
      const pAmt = parseFloat(p.amount);
      if (isNaN(pAmt) || pAmt <= 0) {
        setExpenseError('Each payer amount must be greater than zero');
        return;
      }
      const pCents = Math.round(pAmt * 100);
      payerSumCents += pCents;
      payersPayload.push({
        member_id: p.member_id,
        amount: Number((pCents / 100).toFixed(2)),
      });
    }

    if (payerSumCents !== totalCents) {
      const diff = (totalCents - payerSumCents) / 100;
      if (diff > 0) {
        setExpenseError(
          `${group?.currency} ${diff.toFixed(2)} remaining — payer amounts must add up to ${group?.currency} ${parsedAmount.toFixed(2)}.`
        );
      } else {
        setExpenseError(
          `${group?.currency} ${Math.abs(diff).toFixed(2)} too much — payer amounts must add up to ${group?.currency} ${parsedAmount.toFixed(2)}.`
        );
      }
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
          title: trimmedTitle,
          amount: parsedAmount,
          payers: payersPayload,
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
        let sumExactCents = 0;
        const shares = selectedParticipants.map((id) => {
          const sAmt = parseFloat(exactShares[id] || '0') || 0;
          sumExactCents += Math.round(sAmt * 100);
          return {
            member_id: id,
            owed_amount: Number((Math.round(sAmt * 100) / 100).toFixed(2)),
          };
        });

        if (sumExactCents !== totalCents) {
          const diff = (totalCents - sumExactCents) / 100;
          if (diff > 0) {
            setExpenseError(
              `${group?.currency} ${diff.toFixed(2)} remaining — amounts must add up to ${group?.currency} ${parsedAmount.toFixed(2)}.`
            );
          } else {
            setExpenseError(
              `${group?.currency} ${Math.abs(diff).toFixed(2)} too much — amounts must add up to ${group?.currency} ${parsedAmount.toFixed(2)}.`
            );
          }
          setActionLoading(false);
          return;
        }

        const payload = {
          title: trimmedTitle,
          amount: parsedAmount,
          payers: payersPayload,
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

      const [updatedBalances, updatedSettlements, updatedPayments] = await Promise.all([
        apiService.getNetBalances(groupId),
        apiService.getSettlementSuggestions(groupId),
        apiService.getPayments(groupId),
      ]);
      setBalances(updatedBalances);
      setSettlements(updatedSettlements);
      setPayments(updatedPayments);
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

  // Calculate live preview for payers
  const numericExpenseAmount = parseFloat(expenseAmount) || 0;
  const totalPayerAllocated = expensePayers.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0
  );
  const payerDifference = Number((numericExpenseAmount - totalPayerAllocated).toFixed(2));
  const isPayerBalanced =
    Math.abs(payerDifference) <= 0.005 &&
    numericExpenseAmount > 0 &&
    expensePayers.length > 0 &&
    expensePayers.every((p) => (parseFloat(p.amount) || 0) > 0);

  // Calculate live preview for exact shares
  const totalExactAllocated = selectedParticipants.reduce(
    (sum, id) => sum + (parseFloat(exactShares[id] || '0') || 0),
    0
  );
  const exactDifference = Number((numericExpenseAmount - totalExactAllocated).toFixed(2));
  const isExactBalanced =
    Math.abs(exactDifference) <= 0.005 &&
    numericExpenseAmount > 0 &&
    selectedParticipants.every((id) => (parseFloat(exactShares[id] || '0') || 0) >= 0);

  const isExpenseFormValid =
    expenseTitle.trim().length > 0 &&
    numericExpenseAmount > 0 &&
    isPayerBalanced &&
    selectedParticipants.length > 0 &&
    (splitMethod === 'EQUAL' || isExactBalanced);

  return (
    <div className="group-detail-view">
      <div className="detail-navigation">
        <button type="button" onClick={onBack} className="btn-link">
          ← Back to Groups
        </button>
      </div>

      <header className="card detail-header">
        <div className="header-main">
          <div className="title-status-row">
            <h2 className="group-detail-title">{group.name}</h2>
            <div className="lifecycle-actions">
              {isArchived ? (
                <button
                  type="button"
                  className="btn-reopen-group"
                  onClick={handleReopenGroup}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Reopening...' : 'Reopen Group'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-archive-group"
                  onClick={handleArchiveGroup}
                  disabled={actionLoading}
                  title="Archive group (requires all member balances to be 0.00)"
                >
                  {actionLoading ? 'Archiving...' : 'Archive Group'}
                </button>
              )}
            </div>
          </div>
          <div className="detail-meta">
            <span className="badge badge-currency">Currency: {group.currency}</span>
            <span className={`badge ${isArchived ? 'badge-archived' : 'badge-active'}`}>
              {group.status}
            </span>
            <span className="meta-id">ID: {group.id}</span>
          </div>
        </div>
      </header>

      {lifecycleError && (
        <div className="error-banner" role="alert">
          <span className="error-banner-icon">⚠</span>
          <span className="error-banner-message">{lifecycleError}</span>
          <button
            type="button"
            className="btn-dismiss-error"
            onClick={() => setLifecycleError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {lifecycleSuccess && (
        <div className="success-banner" role="status">
          <span className="success-banner-icon">✓</span>
          <span className="success-banner-message">{lifecycleSuccess}</span>
          <button
            type="button"
            className="btn-dismiss-success"
            onClick={() => setLifecycleSuccess(null)}
            aria-label="Dismiss success message"
          >
            ✕
          </button>
        </div>
      )}

      {paymentSuccess && (
        <div className="success-banner" role="status">
          <span className="success-banner-icon">✓</span>
          <span className="success-banner-message">{paymentSuccess}</span>
          <button
            type="button"
            className="btn-dismiss-success"
            onClick={() => setPaymentSuccess(null)}
            aria-label="Dismiss payment message"
          >
            ✕
          </button>
        </div>
      )}

      {isArchived && (
        <div className="alert-archived" role="note">
          <div className="alert-archived-content">
            <span className="alert-archived-icon">🔒</span>
            <div className="alert-archived-text">
              <strong>This group is archived (Read-Only)</strong>
              <p>Member management, expense creation, and modifications are disabled. All historical records, expenses, and balances remain preserved. Click "Reopen Group" to resume editing.</p>
            </div>
          </div>
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
                {!isArchived && (
                  <button
                    type="button"
                    className="btn-delete-member"
                    onClick={() => handleDeleteMember(member.id)}
                    disabled={actionLoading}
                    title={`Delete ${member.name}`}
                    aria-label={`Delete ${member.name}`}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Add Member Form */}
        {!isArchived && (
          <div className="add-member-section">
            <h4 className="subsection-title">Add Member</h4>
            <form onSubmit={handleAddMember} className="add-member-form">
              <div className="form-group-inline">
                <input
                  type="text"
                  placeholder="Enter member name..."
                  value={newMemberName}
                  onChange={(e) => {
                    setNewMemberName(e.target.value);
                    if (actionError) setActionError(null);
                  }}
                  disabled={actionLoading}
                  className="form-input"
                  aria-label="New member name"
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary"
                >
                  {actionLoading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        )}
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
          <form onSubmit={handleSaveExpense} className="expense-form" noValidate>
            <div className="form-header-row">
              <h4 className="subsection-title">
                {editingExpenseId ? 'Edit expense' : 'Add expense'}
              </h4>
              <button
                type="button"
                onClick={handleCancelExpenseForm}
                className="btn-link"
              >
                Cancel
              </button>
            </div>

            {/* 1. What did you spend on? & How much was it? */}
            <div className="expense-form-section">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="expense-title" className="form-label">
                    What did you spend on? <span className="required-star">*</span>
                  </label>
                  <input
                    id="expense-title"
                    type="text"
                    placeholder="e.g. Dinner, Fuel, Resort Booking"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="expense-amount" className="form-label">
                    How much was it? ({group.currency}) <span className="required-star">*</span>
                  </label>
                  <div className="input-with-addon">
                    <input
                      id="expense-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={(e) => handleExpenseAmountChange(e.target.value)}
                      className="form-input"
                      required
                    />
                    <span className="input-addon">{group.currency}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="expense-date" className="form-label">
                    When? (Date) <span className="required-star">*</span>
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
            </div>

            {/* 2. WHO PAID? */}
            <div className="expense-form-section payers-config-section">
              <div className="section-heading-block">
                <h5 className="form-section-title">WHO PAID?</h5>
                <p className="form-section-subtitle">Add everyone who paid and how much they paid.</p>
              </div>

              <div className="payers-list-inputs">
                {expensePayers.map((payer, idx) => (
                  <div key={idx} className="payer-input-row">
                    <div className="payer-select-col">
                      <select
                        value={payer.member_id}
                        onChange={(e) => handlePayerMemberChange(idx, e.target.value)}
                        className="form-select"
                        aria-label={`Payer ${idx + 1}`}
                      >
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="payer-amount-col">
                      <div className="input-with-addon">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={payer.amount}
                          onChange={(e) => handlePayerAmountChange(idx, e.target.value)}
                          className="form-input"
                          aria-label={`Amount paid by payer ${idx + 1}`}
                        />
                        <span className="input-addon">{group.currency}</span>
                      </div>
                    </div>
                    {expensePayers.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-row"
                        onClick={() => handleRemovePayerRow(idx)}
                        aria-label={`Remove payer ${idx + 1}`}
                        title="Remove payer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="payer-actions-bar">
                {expensePayers.length < members.length && (
                  <button
                    type="button"
                    className="btn-ghost btn-add-payer"
                    onClick={handleAddPayerRow}
                  >
                    + Add another payer
                  </button>
                )}
              </div>

              {/* Payer Total Live Feedback */}
              {numericExpenseAmount > 0 && (
                <div
                  className={`live-feedback-box ${
                    isPayerBalanced
                      ? 'feedback-matched'
                      : payerDifference > 0
                      ? 'feedback-under'
                      : 'feedback-over'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {isPayerBalanced ? (
                    <span>
                      ✓ Payer total: <strong>{group.currency} {totalPayerAllocated.toFixed(2)}</strong> / {group.currency} {numericExpenseAmount.toFixed(2)}
                    </span>
                  ) : payerDifference > 0 ? (
                    <span>
                      ⚠ {group.currency} {payerDifference.toFixed(2)} remaining — payer amounts must add up to {group.currency} {numericExpenseAmount.toFixed(2)}.
                    </span>
                  ) : (
                    <span>
                      ⚠ {group.currency} {Math.abs(payerDifference).toFixed(2)} too much — payer amounts must add up to {group.currency} {numericExpenseAmount.toFixed(2)}.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 3. WHO SHARES THIS EXPENSE? */}
            <div className="expense-form-section participants-config-section">
              <div className="section-heading-block">
                <div className="participants-heading-row">
                  <div>
                    <h5 className="form-section-title">WHO SHARES THIS EXPENSE?</h5>
                    <p className="form-section-subtitle">Select everyone whose share should count.</p>
                  </div>
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
              </div>

              <div className="participant-checkbox-grid">
                {members.map((m) => {
                  const isChecked = selectedParticipants.includes(m.id);
                  const isPayer = expensePayers.some((p) => p.member_id === m.id);
                  return (
                    <label
                      key={m.id}
                      className={`participant-checkbox-label ${isChecked ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleParticipant(m.id)}
                      />
                      <span className="participant-name">{m.name}</span>
                      {isPayer && <span className="payer-tag">(Paid)</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 4. HOW SHOULD IT BE SPLIT? */}
            <div className="expense-form-section split-method-section">
              <div className="section-heading-block">
                <h5 className="form-section-title">HOW SHOULD IT BE SPLIT?</h5>
              </div>

              <div className="split-method-toggle">
                <button
                  type="button"
                  className={`btn-split-toggle ${splitMethod === 'EQUAL' ? 'active' : ''}`}
                  onClick={() => setSplitMethod('EQUAL')}
                >
                  Equal
                </button>
                <button
                  type="button"
                  className={`btn-split-toggle ${splitMethod === 'EXACT' ? 'active' : ''}`}
                  onClick={() => setSplitMethod('EXACT')}
                >
                  Exact
                </button>
              </div>

              {splitMethod === 'EQUAL' ? (
                <div className="split-equal-content">
                  <p className="split-method-primary-text">
                    <strong>Everyone pays an equal share.</strong>
                  </p>
                  <p className="split-method-secondary-text">
                    The total is divided evenly among the selected people. Small rounding differences are handled automatically.
                  </p>

                  {selectedParticipants.length > 0 && numericExpenseAmount > 0 && (
                    <div className="equal-preview-badge">
                      <span>Per person share: </span>
                      <strong className="equal-share-amount">
                        {group.currency} {(numericExpenseAmount / selectedParticipants.length).toFixed(2)} each
                      </strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="split-exact-content">
                  <p className="split-method-primary-text">
                    <strong>Enter the exact amount each person owes.</strong>
                  </p>
                  <p className="split-method-secondary-text">
                    The amounts must add up to the total expense.
                  </p>

                  <div className="exact-shares-list">
                    {selectedParticipants.map((pid) => {
                      const m = members.find((mem) => mem.id === pid);
                      if (!m) return null;
                      return (
                        <div key={m.id} className="exact-share-item">
                          <label className="exact-share-label">
                            <span>{m.name}</span>
                          </label>
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
                        </div>
                      );
                    })}
                  </div>

                  {/* Exact Live Feedback */}
                  {numericExpenseAmount > 0 && (
                    <div
                      className={`live-feedback-box ${
                        isExactBalanced
                          ? 'feedback-matched'
                          : exactDifference > 0
                          ? 'feedback-under'
                          : 'feedback-over'
                      }`}
                      role="status"
                      aria-live="polite"
                    >
                      {isExactBalanced ? (
                        <span>✓ Shares total {group.currency} {numericExpenseAmount.toFixed(2)}</span>
                      ) : exactDifference > 0 ? (
                        <span>⚠ {group.currency} {exactDifference.toFixed(2)} remaining — amounts must add up to {group.currency} {numericExpenseAmount.toFixed(2)}.</span>
                      ) : (
                        <span>⚠ {group.currency} {Math.abs(exactDifference).toFixed(2)} too much — amounts must add up to {group.currency} {numericExpenseAmount.toFixed(2)}.</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Optional category & notes */}
            <div className="expense-form-section optional-meta-section">
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
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={handleCancelExpenseForm}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || isArchived || !isExpenseFormValid}
                className="btn-primary"
              >
                {actionLoading ? 'Saving...' : editingExpenseId ? 'Save changes' : 'Add expense'}
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
                const isExpanded = expandedExpenseIds.has(exp.id);
                const payerNames = exp.payers && exp.payers.length > 0
                  ? exp.payers
                      .map((p) => {
                        const m = members.find((mem) => mem.id === p.member_id);
                        return `${m ? m.name : p.member_id} (${group.currency} ${p.amount.toFixed(2)})`;
                      })
                      .join(', ')
                  : '—';

                // Find all members who either paid or participated in this expense
                const involvedMemberIds = new Set<string>();
                exp.payers?.forEach((p) => involvedMemberIds.add(p.member_id));
                exp.shares?.forEach((s) => involvedMemberIds.add(s.member_id));
                const involvedMembers = members.filter((m) => involvedMemberIds.has(m.id));

                return (
                  <div key={exp.id} className="expense-card">
                    <div className="expense-card-header">
                      <div className="expense-primary-info">
                        <h4 className="expense-title">{exp.title}</h4>
                        <div className="expense-meta-row">
                          <span className="expense-date">{exp.expense_date}</span>
                          <span className="meta-separator">•</span>
                          <span className="expense-payer">
                            Paid by <strong>{payerNames}</strong>
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
                          {!isArchived && (
                            <>
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() => handleStartEditExpense(exp)}
                                disabled={actionLoading}
                                title={`Edit ${exp.title}`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-delete-expense btn-sm"
                                onClick={() => handleDeleteExpense(exp)}
                                disabled={actionLoading}
                                title={`Delete ${exp.title}`}
                              >
                                Delete
                              </button>
                            </>
                          )}
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

                        <div className="expense-details-grid">
                          {/* Paid by section */}
                          <div className="expense-payers-section">
                            <h5 className="payers-breakdown-title">
                              Paid by ({exp.payers?.length || 0})
                            </h5>
                            <ul className="payers-detail-list">
                              {exp.payers?.map((payer) => {
                                const m = members.find((mem) => mem.id === payer.member_id);
                                return (
                                  <li key={payer.member_id} className="payer-detail-item">
                                    <span className="payer-member-name">
                                      {m ? m.name : payer.member_id}
                                    </span>
                                    <span className="payer-paid-amount">
                                      paid {group.currency} {payer.amount.toFixed(2)}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                            <div className="payers-total-summary">
                              Total paid: <strong>{group.currency} {exp.amount.toFixed(2)}</strong>
                            </div>
                          </div>

                          {/* Shared by section */}
                          <div className="expense-shares-section">
                            <h5 className="shares-breakdown-title">
                              Shared by ({exp.shares?.length || 0})
                            </h5>
                            <ul className="shares-detail-list">
                              {exp.shares?.map((share) => {
                                const participant = members.find((m) => m.id === share.member_id);
                                return (
                                  <li key={share.member_id} className="share-detail-item">
                                    <span className="share-member-name">
                                      {participant ? participant.name : share.member_id}
                                    </span>
                                    <span className="share-owed-amount">
                                      owes {group.currency} {share.owed_amount.toFixed(2)}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                            <div className="shares-total-summary">
                              Total shared: <strong>{group.currency} {exp.amount.toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Net balance interpretation for this expense */}
                        <div className="expense-impact-section">
                          <h5 className="impact-breakdown-title">Resulting Contribution for this Expense</h5>
                          <div className="impact-grid">
                            {involvedMembers.map((m) => {
                              const paid = exp.payers?.find((p) => p.member_id === m.id)?.amount || 0;
                              const owed = exp.shares?.find((s) => s.member_id === m.id)?.owed_amount || 0;
                              const net = Math.round((paid - owed) * 100) / 100;
                              return (
                                <div key={m.id} className="impact-card">
                                  <span className="impact-name">{m.name}</span>
                                  <span className="impact-details">
                                    paid {group.currency} {paid.toFixed(2)}, owes {group.currency} {owed.toFixed(2)}
                                  </span>
                                  <span className={`impact-badge ${net > 0 ? 'impact-credit' : net < 0 ? 'impact-debt' : 'impact-zero'}`}>
                                    {net > 0 ? `+${group.currency} ${net.toFixed(2)}` : net < 0 ? `-${group.currency} ${Math.abs(net).toFixed(2)}` : `${group.currency} 0.00`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
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

      {/* Settle up Section (Iteration 3) */}
      <section className="card settle-up-section">
        <div className="section-header">
          <div className="section-title-group">
            <h3 className="card-title">Settle up</h3>
            <p className="section-subtitle">
              Suggested payments to efficiently clear the current balances.
            </p>
          </div>
          <div className="section-actions-group">
            <button
              type="button"
              className="btn-info-toggle"
              onClick={() => setShowHowItWorks((prev) => !prev)}
              aria-expanded={showHowItWorks}
            >
              {showHowItWorks ? 'Hide explanation ▴' : 'How this works ▾'}
            </button>
            {!isArchived && settlements.length > 0 && (
              <button
                type="button"
                className="btn-secondary btn-record-standalone"
                onClick={handleOpenStandalonePaymentModal}
              >
                Record a payment
              </button>
            )}
          </div>
        </div>

        {showHowItWorks && (
          <div className="how-it-works-box">
            <div className="how-it-works-header">
              <span className="how-it-works-icon">💡</span>
              <strong>How settlements work</strong>
            </div>
            <p>
              Settlement suggestions are calculated recommendations for clearing the current balances efficiently. You can pay the suggested amount or make a partial payment. Every payment updates balances and recalculates the remaining suggestions.
            </p>
          </div>
        )}

        {members.length === 0 ? (
          <p className="empty-state-text">No members in this group yet.</p>
        ) : settlements.length === 0 ? (
          <div className="all-settled-card">
            <span className="all-settled-icon">🎉</span>
            <div className="all-settled-content">
              <h4 className="all-settled-title">All settled</h4>
              <p className="all-settled-description">
                No outstanding balances in this group. Everyone is squared away!
              </p>
            </div>
          </div>
        ) : (
          <div className="settlement-grid">
            {settlements.map((s, idx) => (
              <div key={`${s.payer_id}-${s.recipient_id}-${idx}`} className="settlement-card">
                <div className="settlement-card-flow">
                  <div className="participant-chip payer-chip">
                    <span className="member-avatar">
                      {s.payer_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="participant-name">{s.payer_name}</span>
                  </div>
                  <div className="flow-indicator">
                    <span className="flow-text">pays</span>
                    <span className="flow-arrow">➔</span>
                  </div>
                  <div className="participant-chip recipient-chip">
                    <span className="member-avatar">
                      {s.recipient_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="participant-name">{s.recipient_name}</span>
                  </div>
                </div>

                <div className="settlement-card-amount">
                  <span className="amount-label">Suggested payment</span>
                  <span className="amount-value">
                    {group.currency} {s.amount.toFixed(2)}
                  </span>
                </div>

                {!isArchived && (
                  <div className="settlement-card-actions">
                    <button
                      type="button"
                      className="btn-primary btn-pay-full"
                      onClick={() => handleOpenFullPaymentModal(s)}
                    >
                      Pay {group.currency} {s.amount.toFixed(2)}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-pay-partial"
                      onClick={() => handleOpenPartialPaymentModal(s)}
                    >
                      Pay another amount
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payment History Section */}
      <section className="card">
        <div className="section-header">
          <div className="section-title-group">
            <h3 className="card-title">Payment History ({payments.length})</h3>
            <p className="section-subtitle">
              Recorded payments are historical records and cannot be edited or deleted.
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <p className="empty-state-text">No payments recorded for this group yet.</p>
        ) : (
          <div className="payment-history-container">
            <div className="payment-history-list">
              {payments.map((p) => {
                const payer = members.find((m) => m.id === p.payer_id);
                const recipient = members.find((m) => m.id === p.recipient_id);
                const payerName = payer ? payer.name : p.payer_id;
                const recipientName = recipient ? recipient.name : p.recipient_id;

                return (
                  <div key={p.id} className="payment-history-item">
                    <div className="payment-history-info">
                      <div className="payment-flow">
                        <span className="payment-participant payment-payer">{payerName}</span>
                        <span className="payment-arrow">paid</span>
                        <span className="payment-participant payment-recipient">{recipientName}</span>
                      </div>
                      <div className="payment-meta-row">
                        <span className="payment-date">{p.payment_date}</span>
                        {p.notes && (
                          <>
                            <span className="meta-separator">•</span>
                            <span className="payment-notes-text">{p.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="payment-amount-container">
                      <span className="payment-amount-value">
                        {group.currency} {p.amount.toFixed(2)}
                      </span>
                      <span className="badge badge-settled">Recorded</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="modal-backdrop" onClick={handleClosePaymentModal}>
          <div className="modal-content payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {paymentMode === 'FULL'
                  ? 'Record Full Payment'
                  : paymentMode === 'PARTIAL'
                  ? 'Record Partial Payment'
                  : 'Record a Payment'}
              </h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={handleClosePaymentModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {paymentError && (
              <div className="error-banner" role="alert">
                <span className="error-banner-icon">⚠</span>
                <span className="error-banner-message">{paymentError}</span>
              </div>
            )}

            <form onSubmit={handleRecordPaymentSubmit} className="payment-form">
              {paymentMode === 'STANDALONE' ? (
                <div className="payment-standalone-selectors">
                  <div className="form-group">
                    <label htmlFor="standalone-payer-select" className="form-label">
                      Who is paying? (Debtor) *
                    </label>
                    <select
                      id="standalone-payer-select"
                      className="form-select"
                      value={paymentPayerId}
                      onChange={(e) => handleStandalonePayerChange(e.target.value)}
                    >
                      {members.map((m) => {
                        const isDebtor = settlements.some((s) => s.payer_id === m.id);
                        return (
                          <option key={m.id} value={m.id}>
                            {m.name} {isDebtor ? '(Has unsettled debt)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="standalone-recipient-select" className="form-label">
                      Paying to whom? (Creditor) *
                    </label>
                    <select
                      id="standalone-recipient-select"
                      className="form-select"
                      value={paymentRecipientId}
                      onChange={(e) => handleStandaloneRecipientChange(e.target.value)}
                    >
                      {members
                        .filter((m) => m.id !== paymentPayerId)
                        .map((m) => {
                          const matchingSettlement = settlements.find(
                            (s) => s.payer_id === paymentPayerId && s.recipient_id === m.id
                          );
                          return (
                            <option key={m.id} value={m.id}>
                              {m.name}{' '}
                              {matchingSettlement
                                ? `(Suggested: ${group.currency} ${matchingSettlement.amount.toFixed(2)})`
                                : ''}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="payment-parties-card">
                  <div className="party-column payer-col">
                    <span className="party-label">Payer (Debtor)</span>
                    <strong className="party-name">{paymentPayerName}</strong>
                  </div>
                  <div className="party-arrow-indicator">➔</div>
                  <div className="party-column recipient-col">
                    <span className="party-label">Recipient (Creditor)</span>
                    <strong className="party-name">{paymentRecipientName}</strong>
                  </div>
                </div>
              )}

              {paymentMode === 'FULL' ? (
                <div className="form-group">
                  <div className="form-label-row">
                    <label htmlFor="payment-amount-input" className="form-label">
                      Payment Amount ({group.currency})
                    </label>
                    <span className="badge badge-full-settlement">Full settlement</span>
                  </div>
                  <input
                    id="payment-amount-input"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    readOnly
                    className="form-input form-input-readonly"
                  />
                  <small className="form-hint">
                    This will completely settle the suggested balance of {group.currency} {paymentMaxAmount.toFixed(2)}.
                  </small>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="payment-amount-input" className="form-label">
                    Payment Amount ({group.currency}) *
                  </label>
                  <input
                    id="payment-amount-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={paymentMaxAmount > 0 ? paymentMaxAmount : undefined}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="form-input"
                    placeholder={`Up to ${group.currency} ${paymentMaxAmount.toFixed(2)}`}
                    required
                    autoFocus
                  />
                  {(() => {
                    const parsed = parseFloat(paymentAmount) || 0;
                    const remaining = Math.round((paymentMaxAmount - parsed) * 100) / 100;

                    if (paymentMaxAmount <= 0) {
                      return (
                        <div className="payment-live-calc-box calc-error">
                          <span>⚠ No outstanding settlement is currently suggested between {paymentPayerName} and {paymentRecipientName}.</span>
                        </div>
                      );
                    }
                    if (parsed <= 0) {
                      return (
                        <div className="payment-live-calc-box calc-neutral">
                          <span>Suggested maximum: <strong>{group.currency} {paymentMaxAmount.toFixed(2)}</strong>. Enter an amount.</span>
                        </div>
                      );
                    }
                    if (remaining < -0.005) {
                      return (
                        <div className="payment-live-calc-box calc-error">
                          <span>⚠ <strong>{group.currency} {Math.abs(remaining).toFixed(2)}</strong> too much — maximum payment is <strong>{group.currency} {paymentMaxAmount.toFixed(2)}</strong></span>
                        </div>
                      );
                    }
                    if (Math.abs(remaining) < 0.005) {
                      return (
                        <div className="payment-live-calc-box calc-full">
                          <span>✓ <strong>Full settlement</strong> — will completely clear the debt between {paymentPayerName} and {paymentRecipientName}.</span>
                        </div>
                      );
                    }
                    return (
                      <div className="payment-live-calc-box calc-partial">
                        <span>ℹ <strong>{group.currency} {remaining.toFixed(2)}</strong> remaining after this payment.</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="payment-date-input" className="form-label">
                  Payment Date *
                </label>
                <input
                  id="payment-date-input"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="payment-notes-input" className="form-label">
                  Notes / Reference (Optional, max 255 chars)
                </label>
                <input
                  id="payment-notes-input"
                  type="text"
                  maxLength={255}
                  placeholder="e.g. Bank transfer ref, UPI, cash"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    paymentLoading ||
                    (parseFloat(paymentAmount) || 0) <= 0 ||
                    paymentMaxAmount <= 0 ||
                    paymentMaxAmount - (parseFloat(paymentAmount) || 0) < -0.005
                  }
                >
                  {paymentLoading ? 'Recording...' : 'Confirm Payment'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClosePaymentModal}
                  disabled={paymentLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
