import React from 'react';
import { timeAgo } from '../format';

// Reuses the same real incident log as Alerts & Incidents — it already IS a
// chronological record of every automated action (checks, auto-fix
// attempts, notifications). No separate audit store exists yet; if you
// later add real user-initiated admin actions (e.g. manual config changes),
// log those into the same incidentLog on the server and they'll show here.
export default function AuditLogs({ incidents }) {
  return (
    <>
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Audit Logs</h1>
          <p className="ad-page-subtitle">Chronological record of automated system actions</p>
        </div>
      </div>

      <div className="ad-panel">
        {incidents.length === 0 ? (
          <div className="ad-empty-note">No audit events logged yet.</div>
        ) : (
          <table className="ad-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Application</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id}>
                  <td>{new Date(inc.timestamp).toLocaleString()}</td>
                  <td>{inc.level}</td>
                  <td>{inc.solution || '—'}</td>
                  <td>{inc.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="ad-mock-note">
        This mirrors the same incident log as Alerts &amp; Incidents. A dedicated audit trail for manual
        admin actions (e.g. configuration changes) doesn't exist yet — see README-DASHBOARD.md.
      </div>
    </>
  );
}
