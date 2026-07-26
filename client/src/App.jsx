import React, { useState } from 'react';
import Header from './components/Header';
import UseCases from './pages/UseCases';
import Admin from './pages/Admin';
import AiAgents from './pages/AiAgents';

import CategoryPage from './pages/CategoryPage';

import './assets/css/main.css';

function App() {
  // Pages: 'categories' | 'usecases' | 'aiagents' | 'admin'
  const [activePage, setActivePage] = useState('categories');
  const [selectedDomain, setSelectedDomain] = useState(null);

  // Categories → Agents (pre-filtered)
  const handleSelectDomain = (domain) => {
    setSelectedDomain(domain);
    setActivePage('usecases');
  };

  // Agents → Categories (back)
  const handleBackToCategories = () => {
    setSelectedDomain(null);
    setActivePage('categories');
  };


  // Category hub page (no Header — it has its own nav via logo in Header)
  if (activePage === 'categories') {
    return (
      <>
        <div className="glow-br"></div>
        <Header activePage={activePage} setActivePage={setActivePage} />
        <main>
          <CategoryPage
            onSelectDomain={handleSelectDomain}
          />
        </main>
      </>
    );
  }

  // Use cases / agents page
  return (
    <>
      <div className="glow-br"></div>
      <Header activePage={activePage} setActivePage={setActivePage} />
      <main style={activePage === 'aiagents' ? { padding: 0 } : {}}>
        {activePage === 'usecases' ? (
          <UseCases
            initialDomain={selectedDomain}
            onBack={handleBackToCategories}
          />
        ) : activePage === 'aiagents' ? (
          <AiAgents />
        ) : (
          <Admin />
        )}
      </main>
    </>
  );
}

export default App;
