import React from 'react';
import { mockSecurityPosture } from '../mockData';

export default function SecurityAccess({ allowedEmailsCount }) {
  return (
    <>
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Security & Access</h1>
          <p className="ad-page-subtitle">Entra ID sign-in configuration and platform security posture</p>
        </div>
      </div>

      <div className="ad-grid-2">
        <div className="ad-panel">
          <div className="ad-panel-header"><h2 className="ad-panel-title">Security Posture</h2></div>
          <div className="ad-score-ring-wrap">
            <div className="ad-score-ring" style={{ '--pct': mockSecurityPosture.score }}>
              <div className="ad-score-ring-inner">{mockSecurityPosture.score}%</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Security Score</div>
          </div>
          {mockSecurityPosture.checks.map((c) => (
            <div className="ad-check-row" key={c.label}>
              <span>{c.ok ? '✓' : '✕'} {c.label}</span>
              <span style={{ color: 'var(--text-muted)' }}>{c.value}</span>
            </div>
          ))}
          <div className="ad-mock-note">
            Illustrative placeholder — wiring this up means calling Microsoft Graph's Secure Score API
            and Entra ID's Conditional Access / MFA status endpoints.
          </div>
        </div>

        <div className="ad-panel">
          <div className="ad-panel-header"><h2 className="ad-panel-title">Admin Panel Access (real)</h2></div>
          <div className="ad-check-row"><span>Sign-in method</span><span style={{ color: 'var(--text-muted)' }}>Entra ID (MSAL, OIDC)</span></div>
          <div className="ad-check-row"><span>Token verification</span><span style={{ color: 'var(--text-muted)' }}>RS256 / JWKS, server-side</span></div>
          <div className="ad-check-row">
            <span>Allowlisted admin accounts</span>
            <span style={{ color: 'var(--text-muted)' }}>
              {allowedEmailsCount != null ? `${allowedEmailsCount} configured` : 'Unknown from client'}
            </span>
          </div>
          <div className="ad-mock-note">
            This card reflects the actual Entra ID setup this app uses. See README.md for the app
            registration setup and ENTRA_ALLOWED_EMAILS.
          </div>
        </div>
      </div>
    </>
  );
}
