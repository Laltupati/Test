import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import UseCases from './pages/UseCases';
import Admin from './pages/Admin';
import AiAgents from './pages/AiAgents';
import UseCase3 from './pages/UseCase3';
import AllUseCases from './pages/AllUseCases';
import UseCaseDetail from './pages/UseCaseDetail';
import CategoryPage from './pages/CategoryPage';
import { getPageUrl } from './utils/navigation';
import './assets/css/main.css';

function parseUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    page: params.get('page') || 'usecase3',
    domain: params.get('domain') || null,
    id: params.get('id') || null,
    source: params.get('source') || null,
    area: params.get('area') || null
  };
}

function App() {
  const initial = parseUrlState();
  const [activePage, setActivePage] = useState(initial.page);
  const [selectedDomain, setSelectedDomain] = useState(initial.domain);
  const [selectedToolId, setSelectedToolId] = useState(initial.id);
  const [detailSource, setDetailSource] = useState(initial.source);
  const [selectedBusinessAreaId, setSelectedBusinessAreaId] = useState(initial.area);
  const [previousPage, setPreviousPage] = useState('usecase3');

  // Listen for browser Back/Forward arrow clicks (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const state = parseUrlState();
      setActivePage(state.page);
      setSelectedDomain(state.domain);
      setSelectedToolId(state.id);
      setDetailSource(state.source);
      setSelectedBusinessAreaId(state.area);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Shared use case data so we don't refetch everywhere
  const [allUseCases, setAllUseCases] = useState([]);
  useEffect(() => {
    fetch('/api/use-cases')
      .then(res => res.json())
      .then(data => setAllUseCases(data))
      .catch(err => console.error('Error fetching use cases:', err));
  }, []);

  const navigateTo = (page, { domain = null, id = null, fromPage = null, source = null, area = null } = {}) => {
    if (fromPage) setPreviousPage(fromPage);
    else if (activePage && activePage !== 'usecasedetail') setPreviousPage(activePage);
    setActivePage(page);
    setSelectedDomain(domain);
    setSelectedToolId(id);
    setDetailSource(source);
    setSelectedBusinessAreaId(area);
    const url = getPageUrl(page, { domain, id, source, area });
    window.history.pushState({ page, domain, id, source, area }, '', url);
  };

  // Navigate to detail page
  const handleNavigateToDetail = (toolId, fromPage, detailContext = {}) => {
    const resolvedFromPage = fromPage || activePage;
    const resolvedSource = detailContext.source || resolvedFromPage;
    navigateTo('usecasedetail', {
      id: toolId,
      fromPage: resolvedFromPage,
      source: resolvedSource,
      area: detailContext.businessAreaId || null
    });
  };

  // Categories → Agents (pre-filtered)
  const handleSelectDomain = (domain) => {
    navigateTo('usecases', { domain });
  };

  // Agents → Categories (back)
  const handleBackToCategories = () => {
    navigateTo('categories');
  };

  const handlePageTabChange = (page) => {
    navigateTo(page);
  };

  const noPaddingPages = ['aiagents', 'usecase3', 'allusecases', 'usecasedetail'];

  // Category hub page
  if (activePage === 'categories') {
    return (
      <>
        <div className="glow-br"></div>
        <Header activePage={activePage} setActivePage={handlePageTabChange} />
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
      <Header activePage={activePage} setActivePage={handlePageTabChange} />
      <main style={noPaddingPages.includes(activePage) ? { padding: 0 } : {}}>
        {activePage === 'usecases' ? (
          <UseCases
            initialDomain={selectedDomain}
            onBack={handleBackToCategories}
          />
        ) : activePage === 'aiagents' ? (
          <AiAgents
            initialBusinessAreaId={selectedBusinessAreaId}
            onNavigateToDetail={(toolId, fromPage, detailContext) => handleNavigateToDetail(toolId, fromPage || 'aiagents', detailContext)}
          />
        ) : activePage === 'usecase3' ? (
          <UseCase3
            onNavigateToAllUseCases={(domainId) => navigateTo('allusecases', { domain: domainId })}
            onNavigateToDetail={(toolId) => handleNavigateToDetail(toolId, 'usecase3')}
          />
        ) : activePage === 'allusecases' ? (
          <AllUseCases
            initialDomain={selectedDomain}
            onBack={() => navigateTo('usecase3')}
            onNavigateToDetail={(toolId) => handleNavigateToDetail(toolId, 'allusecases')}
          />
        ) : activePage === 'usecasedetail' ? (
          <UseCaseDetail
            toolId={selectedToolId}
            allUseCases={allUseCases}
            onBack={() => navigateTo(previousPage)}
            onNavigateToDetail={(toolId) => handleNavigateToDetail(toolId, 'usecasedetail')}
            onNavigateToAllUseCases={(domainId) => navigateTo('allusecases', { domain: domainId })}
            breadcrumbSource={detailSource}
            breadcrumbBusinessAreaId={selectedBusinessAreaId}
            onNavigateToBusinessJourneyArea={(businessAreaId) => navigateTo('aiagents', { area: businessAreaId })}
          />
        ) : (
          <Admin />
        )}
      </main>
    </>
  );
}

export default App;
