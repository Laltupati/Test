import React from 'react';

// Read-only. There's no settings-write backend yet — this just surfaces the
// real, fixed behavior this app already has, so admins know what to expect.
export default function Configuration({ appsCount, notificationConfig }) {
  const webhookConfigured = notificationConfig?.webhookConfigured === true;
  return (
    <>
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Configuration</h1>
          <p className="ad-page-subtitle">How the health-check and notification pipeline is currently configured</p>
        </div>
      </div>

      <div className="ad-panel">
        <div className="ad-panel-header"><h2 className="ad-panel-title">Monitoring</h2></div>
        <div className="ad-check-row"><span>Monitored applications</span><span style={{ color: 'var(--text-muted)' }}>{appsCount}</span></div>
        <div className="ad-check-row"><span>Availability sweep interval</span><span style={{ color: 'var(--text-muted)' }}>Every 30 seconds by default (configurable)</span></div>
        <div className="ad-check-row"><span>Azure error/dependency scan</span><span style={{ color: 'var(--text-muted)' }}>Every 1 minute (configurable)</span></div>
        <div className="ad-check-row"><span>Dashboard poll interval</span><span style={{ color: 'var(--text-muted)' }}>Every 20 seconds</span></div>
        <div className="ad-check-row"><span>Request timeout</span><span style={{ color: 'var(--text-muted)' }}>8 seconds</span></div>
        <div className="ad-check-row"><span>Auto-fix retries</span><span style={{ color: 'var(--text-muted)' }}>2, with 4s backoff</span></div>
      </div>

      <div className="ad-panel">
        <div className="ad-panel-header"><h2 className="ad-panel-title">Owner Notifications</h2></div>
        <div className="ad-check-row"><span>Notification cooldown</span><span style={{ color: 'var(--text-muted)' }}>1 hour per ongoing outage</span></div>
        <div className="ad-check-row"><span>Delivery method</span><span style={{ color: webhookConfigured ? 'var(--green-s)' : 'var(--red-s)' }}>{notificationConfig ? notificationConfig.provider : 'Checking configuration…'}</span></div>
        <div className="ad-check-row"><span>Logic App endpoint</span><span style={{ color: webhookConfigured ? 'var(--green-s)' : 'var(--red-s)' }}>{webhookConfigured ? 'URL configured — delivery needs testing' : notificationConfig ? 'Not configured — alerts stay in the dashboard' : 'Checking configuration…'}</span></div>
        <div className="ad-check-row"><span>Alert states</span><span style={{ color: 'var(--text-muted)' }}>Available, Unavailable, Stopped / Down</span></div>
        <div className="ad-check-row"><span>Recipients</span><span style={{ color: 'var(--text-muted)' }}>Application owner email; optional CC</span></div>
        <div className="ad-check-row"><span>Default CC</span><span style={{ color: 'var(--text-muted)' }}>{notificationConfig?.cc || 'laltupati@kpmg.com'}</span></div>
      </div>

      <div className="ad-mock-note">
        Set OWNER_NOTIFICATION_WEBHOOK_URL in the server App Service settings to the Logic App HTTP trigger URL.
        Keep the URL secret and do not commit it. Configure the Logic App to email the payload's “to” and “cc”
        recipients, and return HTTP 2xx only after the email action succeeds.
      </div>
    </>
  );
}
