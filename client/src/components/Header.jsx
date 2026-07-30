import React from 'react';
import { getPageUrl, isPlainLeftClick } from '../utils/navigation';

const Header = ({ activePage, setActivePage }) => {
  return (
    <header>
      <div className="h-left">
        <a
          className="logo"
          href={getPageUrl('categories')}
          onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); setActivePage('categories'); } }}
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
          <a
            href={getPageUrl('usecases')}
            className={`page-tab ${activePage === 'usecases' ? 'active' : ''}`}
            onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); setActivePage('usecases'); } }}
          >
          Use Cases
          </a>
          <a
            href={getPageUrl('aiagents')}
            className={`page-tab ${activePage === 'aiagents' ? 'active' : ''}`}
            onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); setActivePage('aiagents'); } }}
          >
          Use Case 2
          </a>
          <span 
            className="page-tab page-tab-coming-soon"
            title="Coming Soon"
          >
            AI Agents
            <span className="coming-soon-badge">Coming Soon</span>
          </span>
          <a
            href={getPageUrl('usecase3')}
            className={`page-tab ${activePage === 'usecase3' ? 'active' : ''}`}
            onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); setActivePage('usecase3'); } }}
          >
          Use Case 3
          </a>
          <span 
            className="page-tab page-tab-coming-soon"
            title="Coming Soon"
          >
            Admin Panel
            <span className="coming-soon-badge">Coming Soon</span>
          </span>
        </nav>
      </div>
    </header>
  );
};

export default Header;
