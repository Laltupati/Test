import React from 'react';
import { getPageUrl, isPlainLeftClick } from '../utils/navigation';

const Header = ({ activePage, setActivePage }) => {
  return (
    <header>
      <div className="h-left">
        <div className="logo">
          <a
            className="logo-link"
            href={getPageUrl('usecase3')}
            onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); setActivePage('usecase3'); } }}
            title="Go to Use-Cases"
            style={{ cursor: 'pointer' }}
          >
            <img
              src="/kpmg-logo.png"
              alt="KPMG"
              style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
            />
            <div className="logo-rule"></div>
          </a>
          <a
            className="logo-sub-link"
            href={getPageUrl('usecase3')}
            onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); setActivePage('usecase3'); } }}
            title="Go to Use-Cases"
            style={{ cursor: 'pointer' }}
          >
            <div className="logo-sub">AI Centre of Excellence</div>
          </a>
        </div>
        <div className="h-sep"></div>
        <nav className="page-tabs">
          {/* <a
            href={getPageUrl('usecases')}
            className={`page-tab ${activePage === 'usecases' ? 'active' : ''}`}
            onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); setActivePage('usecases'); } }}
          >
          Use Cases
          </a> */}
          <a
            href={getPageUrl('aiagents')}
            className={`page-tab ${activePage === 'aiagents' ? 'active' : ''}`}
            onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); setActivePage('aiagents'); } }}
          >
          Business Journey
          </a>
          {/* <span 
            className="page-tab page-tab-coming-soon"
            title="Coming Soon"
          >
            AI Agents
            <span className="coming-soon-badge">Coming Soon</span>
          </span> */}
          <a
            href={getPageUrl('usecase3')}
            className={`page-tab ${activePage === 'usecase3' ? 'active' : ''}`}
            onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); setActivePage('usecase3'); } }}
          >
          Use-Cases
          </a>
          <a
            href={getPageUrl('admin')}
            className={`page-tab ${activePage === 'admin' ? 'active' : ''}`}
            onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); setActivePage('admin'); } }}
          >
            Admin Panel
          </a>
          <a
            href="https://qualiverse-m3nwxpgwpa-uc.a.run.app/"
            className="page-tab"
            target="_blank"
            rel="noopener noreferrer"
            title="Open QualiVerse AI"
          >
            QualiVerse AI
          </a>
          <a
            href="https://best-of-labs.aid-labs.com/"
            className="page-tab"
            target="_blank"
            rel="noopener noreferrer"
          >
            US Data AI Labs
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;
