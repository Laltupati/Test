import React from 'react';

const Header = ({ activePage, setActivePage }) => {
  return (
    <header>
      <div className="h-left">
        <a
          className="logo"
          href="#"
          onClick={(e) => { e.preventDefault(); setActivePage('categories'); }}
          title="Back to Home"
          style={{ cursor: 'pointer' }}
        >
          <img
            src="/kpmg-logo.png"
            alt="KPMG"
            style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
          />
          <div className="logo-rule"></div>
          <div className="logo-sub">AI Centre of Excellence</div>
        </a>
        <div className="h-sep"></div>
        <nav className="page-tabs">
          <button 
            className={`page-tab ${activePage === 'usecases' ? 'active' : ''}`} 
            onClick={() => setActivePage('usecases')}
          >
          Use Cases
          </button>
          <button 
            className={`page-tab ${activePage === 'aiagents' ? 'active' : ''}`} 
            onClick={() => setActivePage('aiagents')}
          >
          Use Case 2
          </button>
          <button 
            className="page-tab page-tab-coming-soon"
            disabled
            title="Coming Soon"
          >
            AI Agents
            <span className="coming-soon-badge">Coming Soon</span>
          </button>
          <button 
            className={`page-tab ${activePage === 'admin' ? 'active' : ''}`} 
            onClick={() => setActivePage('admin')}
          >
          Admin Panel
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
