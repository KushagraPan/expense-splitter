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
  const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false);

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
    setIsCreatingGroup(false);
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
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8.5" cy="12" r="5.5" />
                <circle cx="15.5" cy="12" r="5.5" />
                <path d="M12 8v8" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-wordmark">Expense Splitter</span>
              <span className="brand-tagline">Shared expenses, settled easily</span>
            </div>
          </div>

          <div className="header-actions">
            {selectedGroupId ? (
              <button
                type="button"
                className="btn-secondary nav-back-btn"
                onClick={handleBackToDashboard}
                aria-label="Back to all groups"
              >
                ← All groups
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary header-new-group-btn"
                onClick={() => setIsCreatingGroup(true)}
                aria-label="Create a new group"
              >
                <span className="btn-icon" aria-hidden="true">+</span>
                <span className="btn-text">New group</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main" id="main-content">
        {selectedGroupId ? (
          <GroupDetail
            groupId={selectedGroupId}
            onBack={handleBackToDashboard}
          />
        ) : (
          <GroupDashboard
            isCreating={isCreatingGroup}
            onToggleCreating={setIsCreatingGroup}
            onSelectGroup={handleSelectGroup}
          />
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
