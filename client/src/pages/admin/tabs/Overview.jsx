import React from 'react';
import { timeAgo } from '../format';

const money = (value, currency = 'USD') => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

function Metric({ label, value, detail, tone = '' }) {
  return (
    <div className="ad-kpi-card">
      <div className="ad-kpi-icon-row">
        <span className="ad-kpi-label">{label}</span>
      </div>
      <div className={`ad-kpi-value ${tone}`}>{value}</div>
      {detail && <div className="ad-kpi-sub">{detail}</div>}
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="ad-panel">
      <div className="ad-panel-header">
        <h2 className="ad-panel-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Trend({ rows = [], currency = 'USD' }) {
  const points = rows
    .filter((row) => row && row.date && Number.isFinite(Number(row.amount)))
    .slice(-14);
  if (points.length < 2) {
    return <div className="ad-empty-note">Daily cost trend will appear when Azure Cost Management returns daily data.</div>;
  }
  const values = points.map((row) => Number(row.amount));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 640;
  const height = 150;
  const path = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - 12 - ((value - min) / range) * (height - 24);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const latest = values[values.length - 1];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--text-muted)', fontSize: 11 }}>
        <span>{points[0].date}</span>
        <strong style={{ color: 'var(--text-primary)' }}>Latest day: {money(latest, currency)}</strong>
        <span>{points[points.length - 1].date}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Daily Azure cost trend">
        <path d={path} fill="none" stroke="var(--kpmg-blue-light)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export default function Overview({
  apps = [],
  summary,
  incidents = [],
  checkAll,
  checkingAll,
  onNavigate,
  onOpenApp,
  cost,
  costLoading,
  costError,
  reloadCost,
}) {
  const total = apps.length;
  const available = apps.filter((app) => app.status === 'active').length;
  const unavailable = apps.filter((app) => app.status === 'inactive').length;
  const stopped = apps.filter((app) => app.status === 'stopped').length;
  const checked = apps.filter((app) => app.lastChecked).length;
  const coverage = total ? Math.round((checked / total) * 100) : 0;
  const avgLatency = summary?.avgLatencyMs;
  const attentionApps = apps.filter((app) => ['inactive', 'stopped'].includes(app.status));
  const critical = incidents.filter((item) => ['error', 'dependency_error', 'azure_log_error', 'notify_failed'].includes(item.level)).length;
  const high = incidents.filter((item) => item.level === 'stopped').length;
  const warning = incidents.filter((item) => ['auto_fix', 'notify_pending', 'notify_suppressed'].includes(item.level)).length;

  const costConfigured = cost?.configured === true;
  const costAvailable = costConfigured && cost?.costAvailable !== false && !cost?.error;
  const currency = cost?.currency || 'USD';
  const totalCost = costAvailable && cost?.totalCost != null ? Number(cost.totalCost) : null;
  const resourceGroups = Array.isArray(cost?.byResourceGroup) ? cost.byResourceGroup : [];
  const services = Array.isArray(cost?.byService) ? cost.byService : [];
  const dailyCost = Array.isArray(cost?.dailyCost) ? cost.dailyCost : [];
  const costHasData = costAvailable && (totalCost != null || resourceGroups.length > 0 || dailyCost.length > 0);
  const topGroups = [...resourceGroups]
    .filter((row) => row && row.name && row.amount != null)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);
  const topServices = [...services]
    .filter((row) => row && row.name && row.amount != null)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5);
  const latestChecked = apps.map((app) => app.lastChecked).filter(Boolean).sort().slice(-1)[0];
  const lastHealthRefresh = latestChecked ? timeAgo(latestChecked) : 'Not checked yet';

  return (
    <>
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Platform Overview</h1>
          <p className="ad-page-subtitle">Executive view of GenAI application health, incidents and Azure spend.</p>
        </div>
        <div className="ad-page-header-right">
          <span>Health updated: {lastHealthRefresh}</span>
          <button type="button" className="ad-btn" onClick={checkAll} disabled={checkingAll}>
            {checkingAll ? 'Checking…' : '↻ Refresh health'}
          </button>
        </div>
      </div>

      <div className="ad-kpi-row">
        <Metric label="Applications monitored" value={total} detail={`${checked} reporting status`} />
        <Metric label="Available" value={available} detail="Application checks successful" tone="g" />
        <Metric label="Unavailable" value={unavailable} detail="Application or dependency failure" tone={unavailable ? 'r' : ''} />
        <Metric label="Stopped / Down" value={stopped} detail="App Service stopped in Azure" tone={stopped ? 'r' : ''} />
        <Metric label="Monitoring coverage" value={`${coverage}%`} detail={`${checked} of ${total} applications checked`} />
        <Metric label="Average response" value={avgLatency != null ? `${avgLatency} ms` : '—'} detail="Across latest application checks" />
      </div>

      <div className="ad-grid-2">
        <div>
          <Panel
            title="Application Health"
            action={<button type="button" className="ad-panel-link" onClick={() => onNavigate('health')}>Open Health & Monitoring →</button>}
          >
            {total === 0 ? (
              <div className="ad-empty-note">No applications are currently configured for monitoring.</div>
            ) : (
              <>
                <div className="ad-overview-status-track">
                  <div className="ad-overview-status-track-bar">
                    {available > 0 && <span className="healthy" style={{ width: `${(available / total) * 100}%` }} />}
                    {unavailable > 0 && <span className="unavailable" style={{ width: `${(unavailable / total) * 100}%` }} />}
                    {stopped > 0 && <span className="stopped" style={{ width: `${(stopped / total) * 100}%` }} />}
                  </div>
                  <div className="ad-overview-status-track-legend">
                    <span><i className="healthy" />{available} available</span>
                    <span><i className="unavailable" />{unavailable} unavailable</span>
                    <span><i className="stopped" />{stopped} stopped</span>
                  </div>
                </div>
                {attentionApps.length === 0 ? (
                  <div className="ad-overview-all-clear">
                    <span className="ad-overview-all-clear-icon">✓</span>
                    <div><strong>All monitored applications are available</strong><small>No unavailable or stopped applications detected.</small></div>
                  </div>
                ) : (
                  <div>
                    {attentionApps.slice(0, 5).map((app) => (
                      <button
                        type="button"
                        className="ad-attn-item"
                        key={app.id}
                        onClick={() => onOpenApp?.(app)}
                        style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer' }}
                      >
                        <span className={`ad-attn-icon ${app.status === 'stopped' ? 'crit' : 'warn'}`}>{app.status === 'stopped' ? '■' : '!'}</span>
                        <span style={{ flex: 1 }}>
                          <span className="ad-attn-title">{app.title}</span>
                          <span className="ad-attn-sub">{app.dependencyHealth?.failingDependency || app.lastError?.errorMessage || (app.status === 'stopped' ? 'App Service stopped' : 'Application unavailable')}</span>
                        </span>
                        <span className="ad-attn-time">{app.status === 'stopped' ? 'Stopped' : 'Unavailable'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Panel>

          <Panel
            title="Azure Cost Summary"
            action={
              <button type="button" className="ad-panel-link" onClick={() => onNavigate('usage-cost')}>Detailed Usage & Cost →</button>
            }
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Month-to-date Azure cost</div>
                <div style={{ fontSize: 25, fontWeight: 750 }}>{costHasData ? money(totalCost, currency) : '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Cost data status</div>
                <strong>{costLoading ? 'Refreshing' : costHasData ? 'Live Cost Management data' : costConfigured ? 'No cost data returned' : 'Not configured'}</strong>
              </div>
            </div>
            {!costHasData && (
              <div className="ad-empty-note">
                {costError || cost?.error || (costConfigured ? 'Azure Cost Management has not returned usable data for this period.' : 'Configure the existing Cost Management integration to display actual Azure spend.')}
              </div>
            )}
            {costHasData && (
              <>
                {topGroups.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Top resource groups</div>
                    {topGroups.map((group) => (
                      <div key={group.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid var(--border-subtle, rgba(128,128,128,.16))', fontSize: 12 }}>
                        <span>{group.name}</span><strong>{money(group.amount, currency)}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {topServices.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Top services</div>
                    {topServices.map((service) => (
                      <div key={service.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid var(--border-subtle, rgba(128,128,128,.16))', fontSize: 12 }}>
                        <span>{service.name}</span><strong>{money(service.amount, currency)}</strong>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Daily cost trend</div>
                  <Trend rows={dailyCost} currency={currency} />
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" className="ad-panel-link" onClick={() => reloadCost?.({ force: true })} disabled={costLoading}>
                {costLoading ? 'Refreshing cost…' : '↻ Refresh cost data'}
              </button>
            </div>
          </Panel>
        </div>

        <div>
          <Panel
            title="Requires Attention"
            action={<button type="button" className="ad-panel-link" onClick={() => onNavigate('alerts')}>View incidents →</button>}
          >
            <div className="ad-severity-row">
              <div className="ad-severity-cell"><div className="ad-severity-num ad-sev-critical">{critical}</div><div className="ad-severity-label">Critical</div></div>
              <div className="ad-severity-cell"><div className="ad-severity-num ad-sev-high">{high}</div><div className="ad-severity-label">High</div></div>
              <div className="ad-severity-cell"><div className="ad-severity-num ad-sev-warning">{warning}</div><div className="ad-severity-label">Warning</div></div>
              <div className="ad-severity-cell"><div className="ad-severity-num ad-sev-info">{incidents.length}</div><div className="ad-severity-label">Events</div></div>
            </div>
            {incidents.length === 0 ? (
              <div className="ad-empty-note">No recent incidents or alerts.</div>
            ) : incidents.slice(0, 5).map((incident) => (
              <div className="ad-check-row" key={incident.id}>
                <span>{incident.message || incident.title || 'Incident'}</span>
                <span className="ad-attn-time">{timeAgo(incident.timestamp)}</span>
              </div>
            ))}
          </Panel>

          <Panel title="Operational Snapshot">
            <div className="ad-overview-insight-strip">
              <div><span>Application availability</span><strong>{total ? `${Math.round((available / total) * 100)}%` : '—'}</strong></div>
              <div><span>Monitoring coverage</span><strong>{coverage}%</strong></div>
              <div><span>Open attention items</span><strong>{attentionApps.length}</strong></div>
              <div><span>Latest health refresh</span><strong>{lastHealthRefresh}</strong></div>
            </div>
            <div className="ad-empty-note" style={{ marginTop: 12 }}>
              Access the detailed monitoring page for individual response times, Azure severity, dependencies, complete logs and investigation actions.
            </div>
            <button type="button" className="ad-panel-link" onClick={() => onNavigate('health')}>Open detailed health monitoring →</button>
          </Panel>
        </div>
      </div>
    </>
  );
}
