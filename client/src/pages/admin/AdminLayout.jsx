import React from 'react';

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'health', label: 'Health & Monitoring', icon: '♥' },
  { id: 'usage-cost', label: 'Usage & Cost', icon: '$' },
  { id: 'alerts', label: 'Alerts & Incidents', icon: '⚠' },
  { id: 'configuration', label: 'Configuration', icon: '⚙' },
];

export function AdminLayout({ activeTab, onTabChange, alertsBadgeCount, account, onSignOut, children }) {
  const initials = (account?.name || account?.username || 'A')
    .split(/[ .@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('') || 'AU';

  return (
    <div className="ad-shell">
      <div className="ad-topbar">
        <div className="ad-topbar-left">
          <img src="/kpmg-logo.png" alt="KPMG" className="ad-topbar-logo" />
          <div className="ad-topbar-title">
            GenAI Playground<span className="ad-sep">|</span>Admin Panel
          </div>
        </div>
        <div className="ad-topbar-right">
          <span style={{ fontSize: 11, opacity: 0.7 }}>Environment</span>
          <select className="ad-select" defaultValue="PROD">
            <option value="PROD">PROD</option>
            <option value="TEST">TEST</option>
            <option value="DEV">DEV</option>
          </select>
          <select className="ad-select" defaultValue="all">
            <option value="all">All Regions</option>
            <option value="eastus">East US</option>
            <option value="westeurope">West Europe</option>
          </select>
          <button type="button" className="ad-icon-btn" title="Notifications">
            🔔
            {alertsBadgeCount > 0 && <span className="ad-icon-badge">{alertsBadgeCount}</span>}
          </button>
          <button type="button" className="ad-icon-btn" title="Help">?</button>
          <div className="ad-user">
            <div className="ad-user-avatar">{initials}</div>
            <div className="ad-user-meta">
              <div className="ad-user-name">{account?.name || account?.username || 'Admin User'}</div>
              <div className="ad-user-role">
                Platform Admin
                {onSignOut && (
                  <>
                    {' · '}
                    <button type="button" className="ad-user-signout" onClick={onSignOut}>Sign out</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ad-body">
        <div className="ad-sidebar">
          <div className="ad-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ad-nav-item${activeTab === item.id ? ' active' : ''}`}
                onClick={() => onTabChange(item.id)}
              >
                <span>{item.icon} &nbsp;{item.label}</span>
                {item.id === 'alerts' && alertsBadgeCount > 0 && (
                  <span className="ad-nav-badge">{alertsBadgeCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="ad-content">
          {children}
        </div>
      </div>
    </div>
  );
}
