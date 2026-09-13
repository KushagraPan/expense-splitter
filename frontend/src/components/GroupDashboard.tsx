import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Group } from '../types';

interface GroupDashboardProps {
  onSelectGroup: (groupId: string) => void;
}

const CURRENCY_LABELS: Record<string, string> = {
  INR: 'INR (₹)',
  USD: 'USD ($)',
  EUR: 'EUR (€)',
  GBP: 'GBP (£)',
};

export function GroupDashboard({ onSelectGroup }: GroupDashboardProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter tab state: 'ALL' | 'ACTIVE' | 'ARCHIVED'
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');

  // Create group form state
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [currency, setCurrency] = useState<string>('INR');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
          setLoadError(
            err instanceof Error ? err.message : 'Unable to load groups. Please ensure the backend server is reachable.'
          );
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

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

  const activeGroups = groups.filter((g) => g.status === 'ACTIVE');
  const archivedGroups = groups.filter((g) => g.status === 'ARCHIVED');

  const displayedGroups =
    activeTab === 'ACTIVE'
      ? activeGroups
      : activeTab === 'ARCHIVED'
        ? archivedGroups
        : groups;

  return (
    <div className="dashboard-container">
      {/* Dashboard Header Bar */}
      <header className="dashboard-header">
        <div className="dashboard-header-text">
          <h2 className="dashboard-title">Your groups</h2>
          <p className="dashboard-subtitle">
            Track shared expenses and settle up with your group.
          </p>
        </div>
        {!isCreating && (
          <button
            type="button"
            className="btn-primary btn-primary-lg"
            onClick={() => {
              setIsCreating(true);
              setFormError(null);
            }}
            aria-label="Create a new group"
          >
            <span className="btn-icon" aria-hidden="true">+</span> New group
          </button>
        )}
      </header>

      {/* Global Success Banner */}
      {successMessage && (
        <div className="alert-banner alert-banner-success" role="status" aria-live="polite">
          <span className="alert-icon" aria-hidden="true">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Global Load Error Banner */}
      {loadError && (
        <div className="alert-banner alert-banner-error" role="alert">
          <span className="alert-icon" aria-hidden="true">⚠</span>
          <div>
            <strong>Connection notice:</strong> {loadError}
          </div>
        </div>
      )}

      {/* Create Group Card / Form */}
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
                Set up a shared space for your expenses and settlements.
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
                placeholder="e.g. Goa Trip or Roommates"
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
                Give your group a name, such as &apos;Goa Trip&apos; or &apos;Roommates&apos;.
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
                All expenses in this group use this currency.
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

      {/* Main Content Area */}
      {loading ? (
        <div className="dashboard-loading" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true" />
          <p className="loading-text">Loading your groups...</p>
        </div>
      ) : groups.length === 0 ? (
        /* Empty State */
        <section className="dashboard-empty-state" aria-label="No groups found">
          <div className="empty-state-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="empty-state-title">No groups yet</h3>
          <p className="empty-state-description">
            Create a group for your next trip, dinner, event, or household expenses.
          </p>
          {!isCreating && (
            <button
              type="button"
              className="btn-primary btn-primary-lg empty-state-btn"
              onClick={() => setIsCreating(true)}
            >
              Create your first group
            </button>
          )}
        </section>
      ) : (
        /* Groups View */
        <section className="dashboard-groups-section" aria-label="Groups listing">
          {/* Segmented Filter Tabs */}
          <div className="dashboard-tabs" role="tablist" aria-label="Filter groups by status">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ALL'}
              className={`dashboard-tab ${activeTab === 'ALL' ? 'dashboard-tab-active' : ''}`}
              onClick={() => setActiveTab('ALL')}
            >
              All groups <span className="tab-count">{groups.length}</span>
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

          {displayedGroups.length === 0 ? (
            <div className="tab-empty-notice">
              <p>No {activeTab.toLowerCase()} groups found.</p>
            </div>
          ) : (
            <div className="groups-grid">
              {displayedGroups.map((group) => {
                const isArchived = group.status === 'ARCHIVED';
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
                    <div className="group-card-top">
                      <div className="group-card-title-wrap">
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

                    <div className="group-card-meta">
                      <div className="meta-tag currency-tag">
                        <span className="meta-tag-label">Currency:</span>
                        <span className="meta-tag-val">
                          {CURRENCY_LABELS[group.currency] || group.currency}
                        </span>
                      </div>
                      <div className="meta-summary-text">
                        {isArchived
                          ? 'All balances settled (0.00) • Read-only'
                          : 'Active ledger • Ready for expenses'}
                      </div>
                    </div>

                    <div className="group-card-footer">
                      <span className={`card-action-link ${isArchived ? 'card-action-archived' : ''}`}>
                        {isArchived ? 'View archive →' : 'Open group →'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
