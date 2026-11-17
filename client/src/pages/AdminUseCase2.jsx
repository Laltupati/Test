import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from '../authConfig';
import { useAdminFetch, BYPASS_MSAL_AUTH } from './admin/adminAuth';
import { AdminLayout } from './admin/AdminLayout';
import Overview from './admin/tabs/Overview';
import HealthMonitoring from './admin/tabs/HealthMonitoring';
import UsageCost from './admin/tabs/UsageCost';
import AlertsIncidents from './admin/tabs/AlertsIncidents';
import Configuration from './admin/tabs/Configuration';
import '../assets/css/admin-dashboard.css';

const POLL_MS = 20000;

const hasUsableCostSnapshot = (data) => {
  if (!data || data.configured === false || data.costAvailable === false) return false;
  if (data.costAvailable === true && data.totalCost != null && Number.isFinite(Number(data.totalCost))) return true;
  const hasDaily = Array.isArray(data.dailyCost) && data.dailyCost.length > 0;
  const hasNonZeroResource = Array.isArray(data.resources) && data.resources.some((r) => r?.cost != null && Math.abs(Number(r.cost || 0)) > 0);
  if (data.partial && !hasDaily && !hasNonZeroResource && Number(data.totalCost || 0) === 0) return false;
  return hasDaily || hasNonZeroResource || (data.totalCost != null && !data.partial);
};

const AdminUseCase2 = () => {
  const { instance, accounts, inProgress } = useMsal();
  const msalIsAuthenticated = useIsAuthenticated();
  // ── BEGIN AUTH-BYPASS: force isAuthenticated to true instead of using the real MSAL session ──
  const isAuthenticated = BYPASS_MSAL_AUTH ? true : msalIsAuthenticated;
  // ── END AUTH-BYPASS ──
  const adminFetch = useAdminFetch();
  const account = accounts[0];

  const [activeTab, setActiveTab] = useState('overview');
  const [apps, setApps] = useState([]);
  const [summary, setSummary] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [allowedEmailsCount, setAllowedEmailsCount] = useState(null);
  const [notificationConfig, setNotificationConfig] = useState(null);
  const [cost, setCost] = useState(() => {
    try {
      const cached = window.sessionStorage.getItem('genai-admin-cost-snapshot');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (hasUsableCostSnapshot(parsed)) return parsed;
      window.sessionStorage.removeItem('genai-admin-cost-snapshot');
      return null;
    } catch { return null; }
  });
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState(null);
  const pollRef = useRef(null);
  const costInFlightRef = useRef(null);
  const costRangeRef = useRef(null);
  const costRequestIdRef = useRef(0);

  const signIn = useCallback(() => {
    setAuthError(null);
    instance.loginPopup(loginRequest).catch((err) => {
      console.error('Entra sign-in failed:', err);
      setAuthError(err.message || 'Sign-in failed');
    });
  }, [instance]);

  const signOut = useCallback(() => {
    instance.logoutPopup({ account });
  }, [instance, account]);

  const loadHealth = useCallback(() => {
    return adminFetch('/api/admin/health')
      .then(res => {
        if (res.status === 401) { setAuthError('Session expired — please sign in again.'); return null; }
        if (res.status === 403) { setForbidden(true); return null; }
        return res.json();
      })
      .then(data => {
        if (data) {
          const currentApps = (Array.isArray(data.apps) ? data.apps : [])
            .filter(app => !/qualiverse\s*ai/i.test(String(app.title || app.name || '')));
          const countStatus = status => currentApps.filter(app => app.status === status).length;
          const checkedApps = currentApps.filter(app => app.lastChecked);
          setApps(currentApps);
          setSummary({
            ...(data.summary || {}),
            total: currentApps.length,
            active: currentApps.filter(app => ['active', 'restricted', 'monitoring_error'].includes(app.status)).length,
            degraded: countStatus('degraded'),
            stopped: countStatus('stopped'),
            inactive: countStatus('inactive'),
            checking: countStatus('checking'),
            avgLatencyMs: checkedApps.length
              ? Math.round(checkedApps.reduce((sum, app) => sum + (app.latencyMs || 0), 0) / checkedApps.length)
              : null,
          });
        }
      })
      .catch(err => console.error('Error fetching admin health:', err));
  }, [adminFetch]);

  const loadIncidents = useCallback(() => {
    return adminFetch('/api/admin/incidents?limit=50')
      .then(res => {
        if (res.status === 401 || res.status === 403) return null;
        return res.json();
      })
      .then(data => { if (data) setIncidents(Array.isArray(data) ? data : []); })
      .catch(err => console.error('Error fetching admin incidents:', err));
  }, [adminFetch]);

  const loadConfig = useCallback(() => {
    return adminFetch('/api/admin/config')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) {
          setAllowedEmailsCount(data.allowedEmailsCount);
          setNotificationConfig(data.notifications || null);
        }
      })
      .catch(err => console.error('Error fetching admin config:', err));
  }, [adminFetch]);

  const loadCost = useCallback((options = {}) => {
    const hasRange = options?.startDate || options?.endDate;
    if (hasRange) costRangeRef.current = { startDate: options.startDate, endDate: options.endDate };
    const activeRange = hasRange ? costRangeRef.current : costRangeRef.current;
    const params = new URLSearchParams();
    if (activeRange?.startDate) params.set('start', activeRange.startDate);
    if (activeRange?.endDate) params.set('end', activeRange.endDate);
    if (options?.force) params.set('force', '1');
    const requestKey = params.toString() || 'default';

    // De-duplicate only the same date-range request. A newly applied custom
    // range is allowed to supersede the background/default cost request.
    if (costInFlightRef.current?.key === requestKey) return costInFlightRef.current.promise;
    const requestId = costRequestIdRef.current + 1;
    costRequestIdRef.current = requestId;
    setCostLoading(true);
    setCostError(null);
    const request = adminFetch(`/api/admin/cost${params.toString() ? `?${params.toString()}` : ''}`)
      .then(async res => {
        let data = null;
        try { data = await res.json(); } catch { /* keep null */ }
        if (!res.ok) {
          const message = data?.error || `Cost API returned HTTP ${res.status}`;
          if (costRequestIdRef.current === requestId) {
            setCostError(message);
            if (data && data.configured !== undefined) setCost(prev => prev || data);
          }
          return data;
        }
        if (data && costRequestIdRef.current === requestId) {
          setCost(data);
          try {
            if (hasUsableCostSnapshot(data)) window.sessionStorage.setItem('genai-admin-cost-snapshot', JSON.stringify(data));
            else window.sessionStorage.removeItem('genai-admin-cost-snapshot');
          } catch { /* storage optional */ }
        }
        return data;
      })
      .catch(err => {
        console.error('Error fetching admin cost:', err);
        if (costRequestIdRef.current === requestId) setCostError(err?.message || 'Unable to load Azure cost data');
        return null;
      })
      .finally(() => {
        if (costRequestIdRef.current === requestId) setCostLoading(false);
        if (costInFlightRef.current?.key === requestKey && costInFlightRef.current?.requestId === requestId) costInFlightRef.current = null;
      });
    costInFlightRef.current = { key: requestKey, promise: request, requestId };
    return request;
  }, [adminFetch]);

  const loadAppErrors = useCallback(() => {
    return adminFetch('/api/admin/logs/errors?minutes=60')
      .then(res => (res.ok ? res.json() : null))
      .catch(err => { console.error('Error fetching Azure application errors:', err); return null; });
  }, [adminFetch]);

  const loadCompleteAppErrors = useCallback((id, minutes = 1440, limit = 500, range = null) => {
    const params = new URLSearchParams({ minutes: String(minutes), limit: String(limit) });
    if (range?.start && range?.end) {
      params.set('start', range.start);
      params.set('end', range.end);
    }
    return adminFetch(`/api/admin/logs/errors/${encodeURIComponent(id)}?${params.toString()}`)
      .then(res => (res.ok ? res.json() : null))
      .catch(err => { console.error('Error fetching complete Azure application errors:', err); return null; });
  }, [adminFetch]);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return undefined; }

    setForbidden(false);

    // Fast first paint: only the lightweight health snapshot is required before
    // rendering the Admin Use-Case 2 shell. Cost Management can be slow (and may
    // intentionally retry on Azure 429 throttling), so never block the whole
    // dashboard on cost/config/incidents.
    let cancelled = false;
    loadHealth().finally(() => {
      if (!cancelled) setLoading(false);
    });

    // Load the secondary panels independently after the shell is visible.
    // Staggering the calls also avoids an initial burst against Azure APIs.
    const secondaryTimer = setTimeout(() => {
      loadIncidents();
      loadConfig();
    }, 150);

    // Cost data is intentionally NOT prefetched here. Azure Cost Management is
    // heavily rate limited and the data is not real-time. Query it only when an
    // operator opens Usage & Cost or explicitly applies a date range / refreshes.
    // This prevents every Admin page visit and every connected browser session
    // from consuming Cost Management quota in the background.
    pollRef.current = setInterval(() => {
      loadHealth();
      loadIncidents();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearTimeout(secondaryTimer);
      clearInterval(pollRef.current);
    };
  }, [loadHealth, loadIncidents, loadConfig, loadCost, isAuthenticated]);

  // If the operator opens Usage & Cost before the background prefetch finishes,
  // request it immediately. The in-flight guard above prevents duplicate Azure calls.
  useEffect(() => {
    if (isAuthenticated && activeTab === 'usage-cost' && !cost && !costLoading) loadCost();
  }, [activeTab, cost, costLoading, isAuthenticated, loadCost]);

  const checkOne = async (id) => {
    setCheckingId(id);
    try {
      await adminFetch(`/api/admin/health/${id}/check`, { method: 'POST' });
      await Promise.all([loadHealth(), loadIncidents()]);
    } finally {
      setCheckingId(null);
    }
  };

  const checkAll = async () => {
    setCheckingAll(true);
    try {
      await adminFetch('/api/admin/health/check-all', { method: 'POST' });
      await Promise.all([loadHealth(), loadIncidents()]);
    } finally {
      setCheckingAll(false);
    }
  };

  const onOpenApp = (app) => {
    if (app.launchUrl) window.open(app.launchUrl, '_blank', 'noopener,noreferrer');
  };

  // Sign-in / forbidden / error states — nothing from the dashboard shell renders until past this point.
  if (!isAuthenticated) {
    return (
      <div className="ad-signin-screen">
        <h2>GenAI Playground Admin Panel</h2>
        <p>Sign in with your Entra ID (Microsoft) work account to view application health and incidents.</p>
        <button type="button" className="ad-btn ad-btn-primary" onClick={signIn} disabled={inProgress !== InteractionStatus.None}>
          {inProgress !== InteractionStatus.None ? 'Signing in…' : 'Sign in with Microsoft'}
        </button>
        {authError && <div style={{ marginTop: 10, color: 'var(--red-s)', fontSize: 12 }}>{authError}</div>}
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="ad-signin-screen">
        <h2>Not authorized</h2>
        <p>Signed in as {account?.username}, but this account isn't authorized for the Admin panel. Ask an existing admin to add you to the allowed admins list.</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="ad-signin-screen">
        <p style={{ color: 'var(--red-s)' }}>{authError}</p>
        <button type="button" className="ad-btn ad-btn-primary" onClick={signIn}>Sign in again</button>
      </div>
    );
  }

  if (loading) {
    return <div className="ad-signin-screen"><p>Loading application health…</p></div>;
  }

  const criticalCount = incidents.filter((i) => ['error', 'dependency_error', 'azure_log_error', 'notify_failed'].includes(i.level)).length;
  const highCount = incidents.filter((i) => i.level === 'stopped' || i.level === 'notify_sent').length;
  const warningCount = incidents.filter((i) => ['auto_fix', 'notify_pending', 'notify_suppressed'].includes(i.level)).length;

  const tabProps = { apps, summary, incidents, checkOne, checkAll, checkingId, checkingAll, onOpenApp, onNavigate: setActiveTab, cost, costLoading, costError, reloadCost: loadCost, loadAppErrors, loadCompleteAppErrors, notificationConfig };

  // Overview, Health & Monitoring, and Usage & Cost are live operational
  // pages. Only sections that are still demonstration pages retain the preview banner.
  const previewNotice = ['alerts', 'configuration'].includes(activeTab) ? (
    <div className="ad-preview-notice" role="note" aria-label="Dashboard preview notice">
      <div className="ad-preview-notice-copy">
        <strong>Dashboard Preview</strong>
        <span>This is a sample page for demonstration. The full operational dashboard is coming soon.</span>
      </div>
      <span className="ad-preview-notice-badge">PREVIEW</span>
    </div>
  ) : null;

  return (
    <AdminLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      alertsBadgeCount={criticalCount + highCount + warningCount}
      account={account}
      onSignOut={signOut}
    >
      {previewNotice}
      {activeTab === 'overview' && <Overview {...tabProps} />}
      {activeTab === 'health' && <HealthMonitoring {...tabProps} />}
      {activeTab === 'usage-cost' && <UsageCost {...tabProps} />}
      {activeTab === 'alerts' && <AlertsIncidents {...tabProps} />}
      {activeTab === 'configuration' && <Configuration {...tabProps} appsCount={apps.length} />}
    </AdminLayout>
  );
};

export default AdminUseCase2;
