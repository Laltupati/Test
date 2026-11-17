import React from 'react';
import { mockRecentDeployments } from '../mockData';

export default function Deployments() {
  return (
    <>
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Deployments</h1>
          <p className="ad-page-subtitle">Recent application deployments across the platform</p>
        </div>
      </div>

      <div className="ad-panel">
        {mockRecentDeployments.map((d) => (
          <div className="ad-deploy-row" key={d.app}>
            <div className="ad-deploy-icon">⇪</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{d.app}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>{d.team} · {d.when}</div>
            </div>
            <span className="ad-status-pill ok">{d.status}</span>
          </div>
        ))}
        <div className="ad-mock-note">
          Illustrative placeholder — this app doesn't track deployment history yet. A real version would
          read from Azure DevOps Releases API or App Service's deployment history per app.
        </div>
      </div>
    </>
  );
}
