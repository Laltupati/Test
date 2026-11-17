export function timeAgo(iso) {
  if (!iso) return 'Never checked';
  const diffMs = Date.now() - new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  if (seconds < 60) return `${seconds} ${seconds === 1 ? 'second' : 'seconds'} ago`;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function statusBadge(status) {
  if (status === 'active') return { cls: 'ad-badge-ok', label: 'Available', dot: '●' };
  if (status === 'degraded' || status === 'restricted' || status === 'monitoring_error') {
    return { cls: 'ad-badge-unavailable', label: 'Unavailable', sub: 'Application functionality could not be verified' };
  }
  if (status === 'stopped') return { cls: 'ad-badge-stopped', label: 'Stopped / Down', sub: 'Azure App Service is stopped' };
  if (status === 'inactive') return { cls: 'ad-badge-unavailable', label: 'Unavailable', sub: 'Application URL could not be accessed or returned a server error' };
  if (status === 'checking') return { cls: 'ad-badge-checking', label: 'Checking…' };
  return { cls: 'ad-badge-unknown', label: 'Unknown' };
}

export function incidentSeverity(level, severity) {
  const explicit = String(severity || '').toLowerCase();
  if (['critical', 'urgent', 'fatal'].includes(explicit)) return { label: 'Critical', cls: 'ad-sev-critical' };
  if (explicit === 'high') return { label: 'High', cls: 'ad-sev-high' };
  if (['medium', 'warning'].includes(explicit)) return { label: 'Warning', cls: 'ad-sev-warning' };
  if (explicit === 'low') return { label: 'Info', cls: 'ad-sev-info' };
  switch (level) {
    case 'error': case 'dependency_error': case 'azure_log_error': case 'notify_failed':
      return { label: 'Critical', cls: 'ad-sev-critical' };
    case 'stopped':
      return { label: 'Critical', cls: 'ad-sev-critical' };
    case 'auto_fix': case 'notify_pending': case 'notify_suppressed':
      return { label: 'Warning', cls: 'ad-sev-warning' };
    case 'notify_sent':
      return { label: 'High', cls: 'ad-sev-high' };
    case 'restricted':
      return { label: 'Info', cls: 'ad-sev-info' };
    default:
      return { label: 'Info', cls: 'ad-sev-info' };
  }
}
