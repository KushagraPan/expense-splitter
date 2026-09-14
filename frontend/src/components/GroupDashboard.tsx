import { useEffect, useState, useMemo, useCallback } from 'react';
import { apiService } from '../services/api';
import type { Group, Member, NetBalance } from '../types';
import { getAvatarBackground } from '../utils/avatar';

interface GroupDashboardProps {
  onSelectGroup: (groupId: string) => void;
  isCreating?: boolean;
  onToggleCreating?: (creating: boolean) => void;
}

function getCurrencySymbol(curr: string): string {
  switch (curr?.toUpperCase()) {
    case 'INR':
      return '₹';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return curr || '₹';
  }
}

interface CurrencyPosition {
  currency: string;
  currencySymbol: string;
  amount: number;
  state: 'POSITIVE' | 'NEGATIVE' | 'ZERO';
  statusText: string;
  subtext: string;
  label: string;
}

interface PersonaSelectorProps {
  allMemberNames: string[];
  effectiveUserName: string;
  onSelectUser: (name: string) => void;
  selectId?: string;
}

function PersonaSelector({
  allMemberNames,
  effectiveUserName,
  onSelectUser,
  selectId = 'viewing-as-select',
}: PersonaSelectorProps) {
  if (allMemberNames.length === 0) return null;

  return (
    <div
      className="hero-persona-selector"
      title="Select member to view dashboard from their financial perspective"
    >
      <span
        className="persona-avatar member-avatar"
        style={{
          background: getAvatarBackground(effectiveUserName),
        }}
        aria-hidden="true"
      >
        {effectiveUserName ? effectiveUserName.charAt(0).toUpperCase() : '?'}
      </span>
      <label htmlFor={selectId} className="persona-label">
        Viewing as:
      </label>
      <select
        id={selectId}
        className="persona-select"
        value={effectiveUserName}
        onChange={(e) => onSelectUser(e.target.value)}
        aria-label="View dashboard as member"
      >
        {allMemberNames.map((mName) => (
          <option key={mName} value={mName}>
            {mName}
          </option>
        ))}
      </select>
    </div>
  );
}

export function GroupDashboard({
  onSelectGroup,
  isCreating: externalIsCreating,
  onToggleCreating,
}: GroupDashboardProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Group detailed metadata: members and net balances per group
  const [membersMap, setMembersMap] = useState<Record<string, Member[]>>({});
  const [balancesMap, setBalancesMap] = useState<Record<string, NetBalance[]>>({});

  // Filter tab state: 'ALL' | 'ACTIVE' | 'ARCHIVED'
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');

  // Internal create group form state
  const [internalIsCreating, setInternalIsCreating] = useState<boolean>(false);
  const isCreating = externalIsCreating !== undefined ? externalIsCreating : internalIsCreating;
  const setIsCreating = onToggleCreating || setInternalIsCreating;

  const [name, setName] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Persona identifier for no-auth prototype perspective switching
  const [currentUserName, setCurrentUserName] = useState<string>(() => {
    try {
      return localStorage.getItem('expense_splitter_user_name') || '';
    } catch {
      return '';
    }
  });

  const handleSelectUser = (userName: string) => {
    setCurrentUserName(userName);
    try {
      localStorage.setItem('expense_splitter_user_name', userName);
    } catch {
      // ignore storage error
    }
  };

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const groupsData = await apiService.getGroups();
      setGroups(groupsData);

      const memberEntries: Record<string, Member[]> = {};
      const balanceEntries: Record<string, NetBalance[]> = {};

      await Promise.all(
        groupsData.map(async (grp) => {
          try {
            const [mems, bals] = await Promise.all([
              apiService.getMembers(grp.id).catch(() => []),
              grp.status === 'ACTIVE'
                ? apiService.getNetBalances(grp.id).catch(() => [])
                : Promise.resolve([]),
            ]);
            memberEntries[grp.id] = mems;
            balanceEntries[grp.id] = bals;
          } catch {
            memberEntries[grp.id] = [];
            balanceEntries[grp.id] = [];
          }
        })
      );

      setMembersMap(memberEntries);
      setBalancesMap(balanceEntries);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Unable to load groups. Please ensure the backend server is reachable.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function initLoad() {
      try {
        const groupsData = await apiService.getGroups();
        if (ignore) return;
        setGroups(groupsData);

        const memberEntries: Record<string, Member[]> = {};
        const balanceEntries: Record<string, NetBalance[]> = {};

        await Promise.all(
          groupsData.map(async (grp) => {
            try {
              const [mems, bals] = await Promise.all([
                apiService.getMembers(grp.id).catch(() => []),
                grp.status === 'ACTIVE'
                  ? apiService.getNetBalances(grp.id).catch(() => [])
                  : Promise.resolve([]),
              ]);
              if (!ignore) {
                memberEntries[grp.id] = mems;
                balanceEntries[grp.id] = bals;
              }
            } catch {
              if (!ignore) {
                memberEntries[grp.id] = [];
                balanceEntries[grp.id] = [];
              }
            }
          })
        );

        if (!ignore) {
          setMembersMap(memberEntries);
          setBalancesMap(balanceEntries);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Unable to load groups. Please ensure the backend server is reachable.'
          );
          setLoading(false);
        }
      }
    }

    initLoad();
    return () => {
      ignore = true;
    };
  }, []);

  // Unique member names across all groups
  const allMemberNames = useMemo(() => {
    const names = new Set<string>();
    Object.values(membersMap).forEach((mList) => {
      mList.forEach((m) => {
        if (m.name?.trim()) names.add(m.name.trim());
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [membersMap]);

  // Derive effective user identity cleanly
  const effectiveUserName = useMemo(() => {
    if (currentUserName) {
      const match = allMemberNames.find(
        (n) => n.toLowerCase() === currentUserName.toLowerCase()
      );
      if (match) return match;
    }
    return allMemberNames[0] || '';
  }, [currentUserName, allMemberNames]);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Please give your group a name.');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    try {
      const created = await apiService.createGroup({ name: trimmed, currency });
      const creatorName = (effectiveUserName || currentUserName).trim();
      let newMembers: Member[] = [];
      if (creatorName) {
        try {
          const addedMember = await apiService.addMember(created.id, creatorName);
          newMembers = [addedMember];
          if (!currentUserName) {
            handleSelectUser(creatorName);
          }
        } catch {
          // If adding member fails or already exists, fallback gracefully
        }
      }

      setMembersMap((prev) => ({
        ...prev,
        [created.id]: newMembers,
      }));
      setBalancesMap((prev) => ({
        ...prev,
        [created.id]: [],
      }));
      setGroups((prev) => [created, ...prev]);
      setName('');
      setCurrency('INR');
      setIsCreating(false);
      setSuccessMessage(`Group "${created.name}" created successfully! Opening group...`);

      // Naturally navigate into the newly created group
      setTimeout(() => {
        onSelectGroup(created.id);
      }, 400);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create group. Please try again.';
      setFormError(msg.replace(/^4\d\d:\s*/i, ''));
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatDate(isoString: string): string {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Recently';
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  }

  // Member-scoped groups: only groups where effectiveUserName is enrolled
  const memberScopedGroups = useMemo(() => {
    if (!effectiveUserName) return groups;
    return groups.filter((g) => {
      const mems = membersMap[g.id] || [];
      return mems.some((m) => m.name.toLowerCase() === effectiveUserName.toLowerCase());
    });
  }, [groups, membersMap, effectiveUserName]);

  const activeGroups = useMemo(
    () => memberScopedGroups.filter((g) => g.status === 'ACTIVE'),
    [memberScopedGroups]
  );
  const archivedGroups = useMemo(
    () => memberScopedGroups.filter((g) => g.status === 'ARCHIVED'),
    [memberScopedGroups]
  );

  const displayedGroups =
    activeTab === 'ACTIVE'
      ? activeGroups
      : activeTab === 'ARCHIVED'
        ? archivedGroups
        : memberScopedGroups;

  // Calculate Net Financial Position Hero:
  // Strictly separates currencies (never sums across INR, USD, EUR, etc.)
  // Evaluated ONLY from the perspective and active groups of the selected member
  const heroData = useMemo(() => {
    if (!effectiveUserName) {
      const defaultPos: CurrencyPosition = {
        currency: 'INR',
        currencySymbol: '₹',
        amount: 0,
        state: 'ZERO',
        label: 'ALL SQUARED AWAY',
        statusText: 'All balanced',
        subtext: 'No active groups with outstanding balances',
      };
      return {
        isMultiCurrency: false,
        positions: [defaultPos],
      };
    }

    // Partition member's active groups by their respective currency
    const groupsByCurrency: Record<string, Group[]> = {};
    for (const grp of activeGroups) {
      const curr = grp.currency || 'INR';
      if (!groupsByCurrency[curr]) {
        groupsByCurrency[curr] = [];
      }
      groupsByCurrency[curr].push(grp);
    }

    let currencies = Object.keys(groupsByCurrency);

    // If member has no active groups (e.g. all their groups are archived or none)
    if (currencies.length === 0) {
      const memberCurrencies = Array.from(
        new Set(memberScopedGroups.map((g) => g.currency || 'INR'))
      );
      currencies = memberCurrencies.length > 0 ? memberCurrencies : ['INR'];

      const isMulti = currencies.length > 1;
      const positions: CurrencyPosition[] = currencies.map((curr) => ({
        currency: curr,
        currencySymbol: getCurrencySymbol(curr),
        amount: 0,
        state: 'ZERO' as const,
        label: isMulti ? `ALL SQUARED AWAY (${curr})` : 'ALL SQUARED AWAY',
        statusText: isMulti ? `Settled in ${curr}` : 'All balanced',
        subtext:
          memberScopedGroups.length > 0
            ? 'All your groups are archived or settled'
            : 'No active groups with outstanding balances',
      }));

      return {
        isMultiCurrency: isMulti,
        positions,
      };
    }

    const isMulti = currencies.length > 1;

    // Compute independent net position for each active currency
    const positions: CurrencyPosition[] = currencies.map((curr) => {
      const currGroups = groupsByCurrency[curr];
      const currSymbol = getCurrencySymbol(curr);

      let currNet = 0;
      let contributingCount = 0;

      for (const group of currGroups) {
        const balances = balancesMap[group.id] || [];
        const userBalance = balances.find(
          (b) => b.member_name.toLowerCase() === effectiveUserName.toLowerCase()
        );
        if (userBalance) {
          currNet += userBalance.net_balance;
          if (Math.abs(userBalance.net_balance) > 0.001) {
            contributingCount++;
          }
        }
      }

      if (currNet > 0.001) {
        return {
          currency: curr,
          currencySymbol: currSymbol,
          amount: currNet,
          state: 'POSITIVE' as const,
          label: isMulti ? `NET POSITION (${curr})` : 'YOUR NET POSITION',
          statusText: isMulti ? `You are owed in ${curr}` : 'You are owed',
          subtext: `You are owed across ${contributingCount} active ${
            contributingCount === 1 ? 'group' : 'groups'
          }`,
        };
      } else if (currNet < -0.001) {
        return {
          currency: curr,
          currencySymbol: currSymbol,
          amount: Math.abs(currNet),
          state: 'NEGATIVE' as const,
          label: isMulti ? `NET POSITION (${curr})` : 'YOUR NET POSITION',
          statusText: isMulti ? `You owe in ${curr}` : 'You owe',
          subtext: `You owe across ${contributingCount} active ${
            contributingCount === 1 ? 'group' : 'groups'
          }`,
        };
      } else {
        return {
          currency: curr,
          currencySymbol: currSymbol,
          amount: 0,
          state: 'ZERO' as const,
          label: isMulti ? `ALL SQUARED AWAY (${curr})` : 'ALL SQUARED AWAY',
          statusText: isMulti ? `Settled in ${curr}` : 'All balanced',
          subtext: `No outstanding balance across active ${curr} groups`,
        };
      }
    });

    return {
      isMultiCurrency: isMulti,
      positions,
    };
  }, [activeGroups, memberScopedGroups, balancesMap, effectiveUserName]);

  return (
    <div className="dashboard-container">
      {/* Global Success Banner */}
      {successMessage && (
        <div className="alert-banner alert-banner-success" role="status" aria-live="polite">
          <span className="alert-icon" aria-hidden="true">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Global Load Error Banner with Retry */}
      {loadError && (
        <div className="alert-banner alert-banner-error" role="alert">
          <span className="alert-icon" aria-hidden="true">⚠</span>
          <div className="alert-content">
            <strong>Connection notice:</strong> {loadError}
          </div>
          <button
            type="button"
            className="btn-secondary btn-retry"
            onClick={loadDashboardData}
          >
            Retry
          </button>
        </div>
      )}

      {/* Create Group Form Card */}
      {isCreating && (
        <section
          className="create-group-card"
          aria-labelledby="create-group-heading"
        >
          <div className="create-group-header">
            <div>
              <h3 id="create-group-heading" className="create-group-title">
                Create a new group
              </h3>
              <p className="create-group-description">
                Set up a shared space for trips, dinners, or shared living expenses.
              </p>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={() => {
                setIsCreating(false);
                setFormError(null);
              }}
              aria-label="Close create group form"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleCreateGroup} className="create-group-form" noValidate>
            <div className="form-group">
              <label htmlFor="group-name" className="form-label">
                Group name <span className="required-star" aria-hidden="true">*</span>
              </label>
              <input
                id="group-name"
                type="text"
                className={`form-input ${formError ? 'form-input-error' : ''}`}
                placeholder="e.g. Goa Roadtrip or Apartment 4B"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError(null);
                }}
                disabled={isSubmitting}
                autoFocus
                required
              />
              <span className="form-hint">
                Choose a memorable name for your friends or flatmates.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="group-currency" className="form-label">
                Currency <span className="required-star" aria-hidden="true">*</span>
              </label>
              <select
                id="group-currency"
                className="form-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="INR">INR (₹) — Indian Rupee</option>
                <option value="USD">USD ($) — US Dollar</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="GBP">GBP (£) — British Pound</option>
              </select>
              <span className="form-hint">
                All expenses in this group will be tracked in this currency.
              </span>
            </div>

            {formError && (
              <div className="form-error-box" role="alert">
                <span className="error-icon" aria-hidden="true">⚠</span>
                <span>{formError}</span>
              </div>
            )}

            <div className="create-group-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsCreating(false);
                  setFormError(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating group...' : 'Create group'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Main Dashboard Layout */}
      {loading ? (
        /* Skeleton Loading State */
        <div className="dashboard-skeleton-wrap" aria-live="polite" aria-busy="true">
          <div className="skeleton-hero" />
          <div className="skeleton-tabs" />
          <div className="skeleton-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        </div>
      ) : groups.length === 0 ? (
        /* Empty State */
        <section className="dashboard-empty-state" aria-label="No groups found">
          <div className="empty-state-icon-wrap" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8.5" cy="12" r="5.5" />
              <circle cx="15.5" cy="12" r="5.5" />
              <path d="M12 8v8" />
            </svg>
          </div>
          <span className="empty-state-eyebrow">YOUR FIRST SHARED EXPENSE</span>
          <h3 className="empty-state-title">Start splitting without the friction</h3>
          <p className="empty-state-description">
            Create a group for a trip, dinner, household, or event. Add friends, track who paid, and settle up cleanly with zero confusion.
          </p>
          {!isCreating && (
            <button
              type="button"
              className="btn-primary btn-primary-lg empty-state-cta"
              onClick={() => setIsCreating(true)}
            >
              <span className="btn-icon" aria-hidden="true">+</span> Create your first group
            </button>
          )}
        </section>
      ) : (
        /* Groups View with Hero, Tabs, and Grid */
        <>
          {/* PERSONAL FINANCIAL POSITION HERO */}
          {!heroData.isMultiCurrency ? (
            /* CASE A — Single Currency Hero */
            (() => {
              const pos = heroData.positions[0];
              return (
                <section
                  className={`dashboard-hero hero-${pos.state.toLowerCase()}`}
                  aria-labelledby="hero-title"
                >
                  <div className="hero-inner">
                    <div className="hero-top-row">
                      <span id="hero-title" className="hero-eyebrow">
                        {pos.label}
                      </span>
                      <PersonaSelector
                        allMemberNames={allMemberNames}
                        effectiveUserName={effectiveUserName}
                        onSelectUser={handleSelectUser}
                        selectId="viewing-as-select-single"
                      />
                    </div>

                    <div className="hero-amount-wrap">
                      <div className="hero-amount-main">
                        <span className={`hero-amount hero-amount-${pos.state.toLowerCase()}`}>
                          {pos.state === 'POSITIVE' && '+'}
                          {pos.state === 'NEGATIVE' && '-'}
                          {pos.currencySymbol}
                          {pos.amount.toFixed(2)}
                        </span>
                        <span className={`hero-status-pill pill-${pos.state.toLowerCase()}`}>
                          <span className="pill-directional-icon" aria-hidden="true">
                            {pos.state === 'POSITIVE' ? '↗' : pos.state === 'NEGATIVE' ? '↘' : '✓'}
                          </span>
                          <span className="pill-text">{pos.statusText}</span>
                        </span>
                      </div>
                    </div>

                    <p className="hero-subtext">{pos.subtext}</p>
                  </div>

                  {/* Subtle Aegean geometric sharing motif */}
                  <div className="hero-bg-motif" aria-hidden="true">
                    <svg width="140" height="140" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <circle cx="8.5" cy="12" r="5.5" />
                      <circle cx="15.5" cy="12" r="5.5" />
                      <path d="M12 8v8" />
                    </svg>
                  </div>
                </section>
              );
            })()
          ) : (
            /* CASE B — Multi-Currency Hero (Separated without mathematical conversion) */
            <section className="dashboard-hero hero-multi-currency" aria-labelledby="hero-title">
              <div className="hero-inner">
                <div className="hero-top-row">
                  <div className="hero-eyebrow-group">
                    <span id="hero-title" className="hero-eyebrow">
                      YOUR ACTIVE BALANCES
                    </span>
                    <span className="hero-currency-badge">
                      {heroData.positions.length} currencies
                    </span>
                  </div>
                  <PersonaSelector
                    allMemberNames={allMemberNames}
                    effectiveUserName={effectiveUserName}
                    onSelectUser={handleSelectUser}
                    selectId="viewing-as-select-multi"
                  />
                </div>

                <div className="hero-multi-grid">
                  {heroData.positions.map((pos) => (
                    <div
                      key={pos.currency}
                      className={`hero-multi-item item-${pos.state.toLowerCase()}`}
                    >
                      <div className="hero-multi-item-top">
                        <span className="hero-multi-currency-name">{pos.currency}</span>
                        <span className={`hero-status-pill pill-${pos.state.toLowerCase()}`}>
                          <span className="pill-directional-icon" aria-hidden="true">
                            {pos.state === 'POSITIVE' ? '↗' : pos.state === 'NEGATIVE' ? '↘' : '✓'}
                          </span>
                          <span className="pill-text">{pos.statusText}</span>
                        </span>
                      </div>

                      <div className="hero-multi-amount-row">
                        <span className={`hero-multi-amount hero-amount-${pos.state.toLowerCase()}`}>
                          {pos.state === 'POSITIVE' && '+'}
                          {pos.state === 'NEGATIVE' && '-'}
                          {pos.currencySymbol}
                          {pos.amount.toFixed(2)}
                        </span>
                      </div>

                      <p className="hero-multi-subtext">{pos.subtext}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subtle Aegean geometric sharing motif */}
              <div className="hero-bg-motif" aria-hidden="true">
                <svg width="140" height="140" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <circle cx="8.5" cy="12" r="5.5" />
                  <circle cx="15.5" cy="12" r="5.5" />
                  <path d="M12 8v8" />
                </svg>
              </div>
            </section>
          )}

          {/* GROUP ORGANIZATION TABS */}
          <section className="dashboard-groups-section" aria-label="Groups listing">
            <div className="dashboard-tabs-bar">
              <div className="dashboard-tabs" role="tablist" aria-label="Filter groups by status">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'ALL'}
                  className={`dashboard-tab ${activeTab === 'ALL' ? 'dashboard-tab-active' : ''}`}
                  onClick={() => setActiveTab('ALL')}
                >
                  All groups <span className="tab-count">{memberScopedGroups.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'ACTIVE'}
                  className={`dashboard-tab ${activeTab === 'ACTIVE' ? 'dashboard-tab-active' : ''}`}
                  onClick={() => setActiveTab('ACTIVE')}
                >
                  Active <span className="tab-count">{activeGroups.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'ARCHIVED'}
                  className={`dashboard-tab ${activeTab === 'ARCHIVED' ? 'dashboard-tab-active' : ''}`}
                  onClick={() => setActiveTab('ARCHIVED')}
                >
                  Archived <span className="tab-count">{archivedGroups.length}</span>
                </button>
              </div>

              <span className="groups-summary-count">
                Showing {displayedGroups.length} of {memberScopedGroups.length}{' '}
                {memberScopedGroups.length === 1 ? 'group' : 'groups'}
              </span>
            </div>

            {/* Groups Grid with Lightly Refined Integrated Cards */}
            {displayedGroups.length === 0 ? (
              <div className="tab-empty-notice">
                <p>
                  {activeTab === 'ALL'
                    ? 'No groups found for this member.'
                    : `No ${activeTab.toLowerCase()} groups found.`}
                </p>
              </div>
            ) : (
              <div className="groups-grid">
                {displayedGroups.map((group) => {
                  const isArchived = group.status === 'ARCHIVED';
                  const members = membersMap[group.id] || [];
                  const balances = balancesMap[group.id] || [];

                  const userBal = effectiveUserName
                    ? balances.find(
                        (b) => b.member_name.toLowerCase() === effectiveUserName.toLowerCase()
                      )
                    : null;

                  // Determine user's balance state in this specific group
                  let balanceState: 'POSITIVE' | 'NEGATIVE' | 'ZERO' = 'ZERO';
                  let balanceTag = 'Settled';
                  let formattedBalance = `${group.currency} 0.00`;

                  if (isArchived) {
                    balanceState = 'ZERO';
                    balanceTag = 'All settled';
                    formattedBalance = `${group.currency} 0.00`;
                  } else if (userBal) {
                    if (userBal.net_balance > 0.001) {
                      balanceState = 'POSITIVE';
                      balanceTag = 'You are owed';
                      formattedBalance = `+${group.currency} ${userBal.net_balance.toFixed(2)}`;
                    } else if (userBal.net_balance < -0.001) {
                      balanceState = 'NEGATIVE';
                      balanceTag = 'You owe';
                      formattedBalance = `-${group.currency} ${Math.abs(userBal.net_balance).toFixed(2)}`;
                    } else {
                      balanceState = 'ZERO';
                      balanceTag = 'Settled';
                      formattedBalance = `${group.currency} 0.00`;
                    }
                  } else {
                    balanceState = 'ZERO';
                    balanceTag = 'Ready for expenses';
                    formattedBalance = `${group.currency} 0.00`;
                  }

                  return (
                    <article
                      key={group.id}
                      className={`group-card ${isArchived ? 'group-card-archived' : 'group-card-active'}`}
                      onClick={() => onSelectGroup(group.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectGroup(group.id);
                        }
                      }}
                      aria-label={`Open group ${group.name}, ${isArchived ? 'Archived' : 'Active'}`}
                    >
                      <div className="group-card-header">
                        <div className="group-card-title-group">
                          <h3 className="group-card-name">{group.name}</h3>
                          <span className="group-card-date">
                            Created {formatDate(group.created_at)}
                          </span>
                        </div>
                        <span
                          className={`status-pill ${
                            isArchived ? 'status-pill-archived' : 'status-pill-active'
                          }`}
                        >
                          <span className="status-pill-dot" aria-hidden="true" />
                          {isArchived ? 'Archived' : 'Active'}
                        </span>
                      </div>

                      {/* Member Avatar Stack */}
                      <div className="group-card-members">
                        <div className="avatar-stack" aria-hidden="true">
                          {members.slice(0, 4).map((m, idx) => (
                            <span
                              key={m.id}
                              className="avatar-stack-item member-avatar"
                              style={{
                                background: getAvatarBackground(m.name),
                                zIndex: 4 - idx,
                              }}
                              title={m.name}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </span>
                          ))}
                          {members.length > 4 && (
                            <span
                              className="avatar-stack-overflow"
                              title={`${members.length - 4} more members`}
                            >
                              +{members.length - 4}
                            </span>
                          )}
                        </div>
                        <span className="member-count-text">
                          {members.length === 0
                            ? 'No members yet'
                            : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
                        </span>
                      </div>

                      {/* Lightly Refined Integrated Financial Summary (No nested card container) */}
                      <div className="group-card-balance">
                        <div className="card-balance-meta">
                          <span className="card-balance-label">
                            {isArchived ? 'LEDGER STATUS' : 'YOUR BALANCE'}
                          </span>
                          <span className={`card-balance-tag tag-${balanceState.toLowerCase()}`}>
                            <span className="tag-arrow" aria-hidden="true">
                              {balanceState === 'POSITIVE'
                                ? '↗ '
                                : balanceState === 'NEGATIVE'
                                  ? '↘ '
                                  : '✓ '}
                            </span>
                            {balanceTag}
                          </span>
                        </div>
                        <div className="card-balance-amount-wrap">
                          <span className={`card-balance-amount amount-${balanceState.toLowerCase()}`}>
                            {formattedBalance}
                          </span>
                        </div>
                      </div>

                      <div className="group-card-footer">
                        <span
                          className={`card-action-link ${
                            isArchived ? 'card-action-archived' : ''
                          }`}
                        >
                          {isArchived ? 'View archive →' : 'Open group →'}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
