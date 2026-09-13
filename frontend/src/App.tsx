import { useEffect, useState } from 'react';
import { GroupDashboard } from './components/GroupDashboard';
import { GroupDetail } from './components/GroupDetail';
import './App.css';

function getGroupIdFromHash(): string | null {
  const hash = window.location.hash;
  if (hash.startsWith('#group-')) {
    const id = hash.replace('#group-', '').trim();
    return id || null;
  }
  return null;
}

export function App() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => getGroupIdFromHash());

  // Synchronize browser URL hash with selected group ID
  useEffect(() => {
    function handleHashChange() {
      setSelectedGroupId(getGroupIdFromHash());
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  function handleSelectGroup(id: string) {
    window.location.hash = `#group-${id}`;
    setSelectedGroupId(id);
  }

  function handleBackToDashboard() {
    window.location.hash = '';
    setSelectedGroupId(null);
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-bar">
          <div
            className="brand-logo-title"
            onClick={handleBackToDashboard}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleBackToDashboard();
              }
            }}
            title="Return to Your Groups"
            aria-label="Expense Splitter - Return to Your Groups"
          >
            <div className="brand-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="3" />
                <line x1="2" y1="10" x2="22" y2="10" />
                <path d="M6 15h2" />
                <path d="M14 15h4" />
              </svg>
            </div>
            <div className="brand-text">
              <h1 className="app-title">Expense Splitter</h1>
              <p className="app-subtitle">Split expenses. See who owes whom. Settle up.</p>
            </div>
          </div>
          {selectedGroupId && (
            <button
              type="button"
              className="btn-ghost nav-back-btn"
              onClick={handleBackToDashboard}
              aria-label="Back to all groups"
            >
              ← All groups
            </button>
          )}
        </div>
      </header>

      <main className="app-main" id="main-content">
        {selectedGroupId ? (
          <GroupDetail
            groupId={selectedGroupId}
            onBack={handleBackToDashboard}
          />
        ) : (
          <GroupDashboard onSelectGroup={handleSelectGroup} />
        )}
      </main>

      <footer className="app-footer">
        <p className="footer-text">
          Expense Splitter • Simple, transparent shared expense tracking for groups
        </p>
      </footer>
    </div>
  );
}

export default App;
