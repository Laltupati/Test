import React from 'react';
import { timeAgo, incidentSeverity } from '../format';

export default function AlertsIncidents({ incidents }) {
  const severities = incidents.map((i) => incidentSeverity(i.level, i.severity));
  const critical = severities.filter((s) => s.label === 'Critical').length;
  const high = severities.filter((s) => s.label === 'High').length;
  const warning = severities.filter((s) => s.label === 'Warning').length;

  return (
    <>
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Alerts & Incidents</h1>
          <p className="ad-page-subtitle">Live incident feed from health checks, auto-fix attempts, and owner notifications</p>
        </div>
      </div>

      <div className="ad-severity-row" style={{ maxWidth: 420, marginBottom: 18 }}>
        <div className="ad-severity-cell"><div className="ad-severity-num ad-sev-critical">{critical}</div><div className="ad-severity-label">Critical</div></div>
        <div className="ad-severity-cell"><div className="ad-severity-num ad-sev-high">{high}</div><div className="ad-severity-label">High</div></div>
        <div className="ad-severity-cell"><div className="ad-severity-num ad-sev-warning">{warning}</div><div className="ad-severity-label">Warning</div></div>
        <div className="ad-severity-cell"><div className="ad-severity-num ad-sev-info">{incidents.length}</div><div className="ad-severity-label">Total</div></div>
      </div>

      <div className="ad-panel">
        {incidents.length === 0 ? (
          <div className="ad-empty-note">No incidents logged yet.</div>
        ) : (
          <table className="ad-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Application</th>
                <th>Message</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => {
                const sev = incidentSeverity(inc.level, inc.severity);
                return (
                  <tr key={inc.id}>
                    <td><span className={sev.cls}>{sev.label}</span></td>
                    <td>{inc.solution || '—'}</td>
                    <td>{inc.message}</td>
                    <td>{timeAgo(inc.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
