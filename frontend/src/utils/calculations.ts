/**
 * Pure domain calculation engine for Expense Splitter.
 * Reference: product-spec.md Section 14, _docs/plan.md
 */

import type { Member, Expense, Payment, NetBalance, SettlementSuggestion } from '../types/index.ts';

/**
 * Calculates net balances for all members of a group from source records.
 *
 * Formula per product-spec.md Section 14:
 * Net Balance(M) = (Expenses Paid + Payments Sent) - (Expenses Owed + Payments Received)
 *
 * Safe Money Arithmetic:
 * Uses integer cents throughout calculation to prevent floating-point drift
 * and enforce the strict domain invariant:
 * sum(all member net balances) === 0.00
 */
export function calculateNetBalances(
  members: Member[],
  expenses: Expense[],
  payments: Payment[] = []
): NetBalance[] {
  return members.map((member) => {
    let paidCents = 0;
    let owedCents = 0;
    let sentCents = 0;
    let receivedCents = 0;

    // Aggregate expenses
    for (const exp of expenses) {
      if (exp.payer_id === member.id) {
        paidCents += Math.round(exp.amount * 100);
      }
      if (exp.shares) {
        for (const share of exp.shares) {
          if (share.member_id === member.id) {
            owedCents += Math.round(share.owed_amount * 100);
          }
        }
      }
    }

    // Aggregate payments (empty in Phase C Issue #6, preserved for Issue #7)
    for (const payment of payments) {
      if (payment.payer_id === member.id) {
        sentCents += Math.round(payment.amount * 100);
      }
      if (payment.recipient_id === member.id) {
        receivedCents += Math.round(payment.amount * 100);
      }
    }

    const netCents = (paidCents + sentCents) - (owedCents + receivedCents);

    // Normalize -0 to 0 and convert cents back to 2-decimal float
    let netBalance = Number((netCents / 100).toFixed(2));
    if (netCents === 0 || Object.is(netBalance, -0)) {
      netBalance = 0;
    }

    return {
      member_id: member.id,
      member_name: member.name,
      net_balance: netBalance,
      paid_amount: Number((paidCents / 100).toFixed(2)),
      owed_amount: Number((owedCents / 100).toFixed(2)),
    };
  });
}

/**
 * Calculates a simplified settlement plan from member net balances
 * using greedy debtor-creditor matching.
 * Reference: product-spec.md Section 15
 *
 * Requirements:
 * - Eliminates unnecessary intermediate transactions
 * - Settles all non-zero net balances completely
 * - Uses no more than N - 1 transactions for N members with non-zero balances
 * - Uses exact integer cents arithmetic to prevent floating-point drift
 * - Never produces zero-value transactions
 */
export function calculateSettlementSuggestions(
  netBalances: NetBalance[]
): SettlementSuggestion[] {
  const debtors: { member_id: string; member_name: string; debtCents: number }[] = [];
  const creditors: { member_id: string; member_name: string; creditCents: number }[] = [];

  for (const b of netBalances) {
    const balanceCents = Math.round(b.net_balance * 100);
    if (balanceCents < 0) {
      debtors.push({
        member_id: b.member_id,
        member_name: b.member_name,
        debtCents: Math.abs(balanceCents),
      });
    } else if (balanceCents > 0) {
      creditors.push({
        member_id: b.member_id,
        member_name: b.member_name,
        creditCents: balanceCents,
      });
    }
  }

  // Sort debtors by debt magnitude descending; creditors by credit magnitude descending
  // Tie-breaker on member_name for stable, deterministic ordering
  debtors.sort((a, b) => b.debtCents - a.debtCents || a.member_name.localeCompare(b.member_name));
  creditors.sort((a, b) => b.creditCents - a.creditCents || a.member_name.localeCompare(b.member_name));

  const suggestions: SettlementSuggestion[] = [];

  let debtorIdx = 0;
  let creditorIdx = 0;

  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];

    const transferCents = Math.min(debtor.debtCents, creditor.creditCents);

    if (transferCents > 0) {
      suggestions.push({
        payer_id: debtor.member_id,
        payer_name: debtor.member_name,
        recipient_id: creditor.member_id,
        recipient_name: creditor.member_name,
        amount: Number((transferCents / 100).toFixed(2)),
      });
    }

    debtor.debtCents -= transferCents;
    creditor.creditCents -= transferCents;

    if (debtor.debtCents === 0) {
      debtorIdx++;
    }
    if (creditor.creditCents === 0) {
      creditorIdx++;
    }
  }

  return suggestions;
}

