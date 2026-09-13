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

  // Synchronize hash with selected group ID
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
        <h1
          className="app-title"
          onClick={handleBackToDashboard}
          style={{ cursor: 'pointer' }}
          title="Return to Group Dashboard"
        >
          Expense Splitter
        </h1>
        <p className="app-subtitle">
          Shared expense management for groups and trips
        </p>
      </header>

      <main>
        {selectedGroupId ? (
          <GroupDetail
            groupId={selectedGroupId}
            onBack={handleBackToDashboard}
          />
        ) : (
          <GroupDashboard onSelectGroup={handleSelectGroup} />
        )}

        <aside className="architecture-note">
          <strong>Architecture Invariant (Issue #12 Active):</strong>
          <br />
          <code>UI (GroupDashboard / GroupDetail)</code> ➔ <code>apiService (src/services/api.ts)</code> ➔ <code>FastAPI REST Backend (/api)</code>
          <br />
          Navigation is lightweight and state-driven with browser hash sync (no heavy routing library overhead).
        </aside>
      </main>
    </div>
  );
}

export default App;
