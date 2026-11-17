/**
 * Admin Health Engine
 * ────────────────────
 * Implements the three Admin-tab use cases against the *real* applications
 * listed in the Use Cases catalog (their live `launchUrl`s):
 *
 *  UC1 — Status check   : exactly three operational states:
 *                          Available (URL + required functionality/config healthy),
 *                          Unavailable (URL or required feature/dependency fails),
 *                          Stopped (Azure confirms App Service is stopped).
 *  UC2 — Auto-fix        : on a genuine failure (timeout / network error /
 *                          5xx), retry with backoff (handles the very
 *                          common "Azure App Service cold start / sleeping
 *                          instance" case, where a simple re-request wakes
 *                          the app back up). If a retry succeeds, the
 *                          incident is auto-resolved and logged as such.
 *  UC3 — Notify owner    : if auto-fix does NOT resolve it, or a downstream
 *                          dependency error is detected, create an Azure-native
 *                          owner alert. Azure Monitor Action Groups are the
 *                          recommended email path; no SMTP server is required.
 *
 * The latest health record for each application and unresolved incidents are
 * persisted under /home/data on App Service so scaled workers share one state.
 * Local runs keep the same files beside this module unless paths are overridden
 * through HEALTH_STATE_DIR and HEALTH_LATCH_FILE.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { getAccessToken } = require('./azureCredential');
const azureLogs = require('./azureLogs');

const REQUEST_TIMEOUT_MS = Math.max(2500, Number(process.env.HEALTH_CHECK_TIMEOUT_MS) || 5000);
const MAX_HEALTH_PROBE_REDIRECTS = 5;
const AUTO_FIX_RETRIES = 2;          // number of automatic retries before escalating
const AUTO_FIX_BACKOFF_MS = 4000;    // Azure free/basic tier cold-starts typically need a few seconds
const MAX_INCIDENT_LOG = 500;
const INCIDENT_LOG_FILE = process.env.INCIDENT_LOG_FILE || (process.env.WEBSITE_INSTANCE_ID ? '/home/data/genai-playground-incidents.json' : path.join(__dirname, '.genai-playground-incidents.json'));
const NOTIFICATION_LOCK_STALE_MS = 30 * 1000;
const AUTO_RESTART_COOLDOWN_MS = 60 * 60 * 1000;
const ENABLE_AUTO_RESTART = process.env.ENABLE_AUTO_RESTART === 'true';
const OWNER_NOTIFICATION_WEBHOOK_URL = process.env.OWNER_NOTIFICATION_WEBHOOK_URL || process.env.AZURE_NOTIFICATION_WEBHOOK_URL || '';
const OWNER_NOTIFICATION_CC = process.env.OWNER_NOTIFICATION_CC || 'laltupati@kpmg.com';
const LOG_MONITOR_INTERVAL_MS = Math.max(Number(process.env.LOG_MONITOR_INTERVAL_MS) || 60000, 60000);
const RECOVERY_SUCCESS_CYCLES = Math.max(2, Number(process.env.HEALTH_RECOVERY_SUCCESS_CYCLES) || 2);
// A transient probe failure must be observed in two separate health cycles
// before an otherwise healthy application is changed to Unavailable. Confirmed
// critical dependency/configuration failures remain immediate.
const HEALTH_FAILURE_CONFIRMATION_CYCLES = Math.max(2, Number(process.env.HEALTH_FAILURE_CONFIRMATION_CYCLES) || 2);
const HEALTH_CHECK_CONCURRENCY = Math.max(1, Math.min(5, Number(process.env.HEALTH_CHECK_CONCURRENCY) || 3));
const HEALTH_CHECK_INTERVAL_MS = Math.max(15000, Number(process.env.HEALTH_CHECK_INTERVAL_MS) || 30000);
const ACTIONABLE_ERROR_FRESHNESS_MS = Math.max(5 * 60 * 1000, Number(process.env.HEALTH_ERROR_FRESHNESS_MS) || 5 * 60 * 1000);
// Status reconciliation intentionally uses a longer lookback than the UI counter
// to rehydrate unresolved incidents after a worker recycle. Recovery is separate:
// fresh actionable telemetry keeps an incident active, while two clean log cycles
// plus successful availability checks clear it. This prevents an old 503 from
// keeping a recovered app degraded indefinitely.
const STATUS_LOG_WINDOW_MINUTES = Math.max(5, Math.min(1440, Number(process.env.LOG_MONITOR_WINDOW_MINUTES || 60)));
const INCIDENT_REHYDRATE_WINDOW_MINUTES = Math.max(STATUS_LOG_WINDOW_MINUTES, Math.min(1440, Number(process.env.INCIDENT_REHYDRATE_WINDOW_MINUTES || 1440)));
const restartHistory = new Map();
const processedLogKeys = new Map(); // deduplicate repeated Azure log rows for incident history
// Generic Error/High log rows are confirmed across separate polling cycles
// before they can flap an otherwise healthy application or notify its owner.
// Explicit Critical/Fatal, recognised crash/dependency signatures and primary
// application HTTP 5xx remain immediate.
const pendingHighSeverityLogCycles = new Map();
const notificationInFlightIds = new Set();

function awaitWithTimeout(promise, timeoutMs, operation) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

// Persist unresolved dependency incidents so a normal availability probe, an
// App Service recycle, or requests landing on another worker instance cannot
// incorrectly flip a Degraded application back to Healthy. On Azure App
// Service, /home is the persistent/shared content area when App Service
// storage is enabled. Override HEALTH_LATCH_FILE if your environment uses a
// different durable mount.
const HEALTH_LATCH_FILE = process.env.HEALTH_LATCH_FILE || (
  process.env.WEBSITE_INSTANCE_ID
    ? '/home/data/genai-playground-health-latches.json'
    : path.join(__dirname, '.genai-playground-health-latches.json')
);

function readPersistentLatches() {
  try {
    if (!fs.existsSync(HEALTH_LATCH_FILE)) return {};
    const raw = fs.readFileSync(HEALTH_LATCH_FILE, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn(`[adminHealth] Unable to read health latch file ${HEALTH_LATCH_FILE}: ${err.message}`);
    return {};
  }
}

function writePersistentLatches(next) {
  try {
    fs.mkdirSync(path.dirname(HEALTH_LATCH_FILE), { recursive: true });
    const tmp = `${HEALTH_LATCH_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fs.renameSync(tmp, HEALTH_LATCH_FILE);
  } catch (err) {
    console.warn(`[adminHealth] Unable to persist health latch file ${HEALTH_LATCH_FILE}: ${err.message}`);
  }
}

function getPersistentLatch(id) {
  const all = readPersistentLatches();
  const latch = all[id]?.active ? all[id] : null;
  if (!latch) return null;
  // App Service lifecycle events are not dependency incidents. Older builds
  // could persist an Azure-confirmed stop as an active latch, which then made
  // the stopped record look like a fresh unresolved application failure and
  // blocked recovery after ARM confirmed the restart.
  const latchErrorType = String(latch.lastError?.errorType || '').toLowerCase();
  const latchErrorMessage = String(latch.lastError?.errorMessage || '').toLowerCase();
  if (latchErrorType === 'app_stopped' || /azure app service (?:is )?stopped(?:\s*\(http\s*503\))?|app service state:\s*stopped/.test(latchErrorMessage)) {
    return null;
  }
  // Migration/policy: legacy degraded dependency latches represent an
  // unavailable application under the three-state health model.
  if (latch.status === 'degraded' && (latch.dependencyHealth?.status === 'unhealthy' || latch.dependencyIncidentLatched !== false)) {
    latch.status = 'inactive';
    latch.errorSeverity = 'critical';
    if (Array.isArray(latch.azureErrors)) {
      latch.azureErrors = latch.azureErrors.map(e => ({ ...e, Severity: e.Dependency ? 'critical' : e.Severity }));
    }
  }
  return latch;
}

function persistDependencyLatch(useCase, record) {
  const all = readPersistentLatches();
  all[useCase.id] = {
    active: true,
    id: useCase.id,
    title: useCase.title,
    status: 'inactive',
    detectedAt: all[useCase.id]?.detectedAt || record.lastError?.timeGenerated || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastError: record.lastError || all[useCase.id]?.lastError || null,
    errorSeverity: record.status === 'inactive' && record.dependencyHealth?.status === 'unhealthy' ? 'critical' : (record.errorSeverity || all[useCase.id]?.errorSeverity || 'high'),
    remediation: record.remediation || all[useCase.id]?.remediation || 'owner_alert',
    dependencyHealth: record.dependencyHealth || all[useCase.id]?.dependencyHealth || null,
    // Preserve the actual Azure evidence for an unresolved incident so the UI
    // can continue to show the error details even after the rolling Log
    // Analytics display window becomes empty or this worker restarts.
    azureErrors: Array.isArray(record.azureErrors) && record.azureErrors.length
      ? record.azureErrors.slice(0, 25)
      : (Array.isArray(all[useCase.id]?.azureErrors) ? all[useCase.id].azureErrors.slice(0, 25) : []),
    lastNotification: record.lastNotification || all[useCase.id]?.lastNotification || null,
    owner: useCase.owner || null,
    ownerEmail: useCase.ownerEmail || null,
    recoverySuccessCycles: Number(record.recoverySuccessCycles || 0),
    lastRecoveryCheckAt: record.lastRecoveryCheckAt || all[useCase.id]?.lastRecoveryCheckAt || null,
  };
  writePersistentLatches(all);
}

function clearPersistentLatch(id) {
  const all = readPersistentLatches();
  if (!all[id]) return;
  delete all[id];
  writePersistentLatches(all);
}

function acquireOwnerNotificationLock(id) {
  fs.mkdirSync(HEALTH_STATE_DIR, { recursive: true });
  const lockPath = path.join(HEALTH_STATE_DIR, `${encodeURIComponent(String(id))}.notification.lock`);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try {
        fs.writeSync(fd, `${process.pid}:${Date.now()}`);
      } catch (writeError) {
        fs.closeSync(fd);
        fs.unlinkSync(lockPath);
        throw writeError;
      }
      fs.closeSync(fd);
      return () => {
        try {
          fs.unlinkSync(lockPath);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            console.warn(`[adminHealth] Unable to release owner notification lock ${lockPath}: ${err.message}`);
          }
        }
      };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        const ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (ageMs > NOTIFICATION_LOCK_STALE_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch (statError) {
        if (statError.code !== 'ENOENT') throw statError;
        continue;
      }
      return null;
    }
  }
  return null;
}

function persistLastNotification(id, notification) {
  const all = readPersistentLatches();
  if (!all[id]?.active) return;
  all[id] = { ...all[id], lastNotification: notification };
  writePersistentLatches(all);
}

const HEALTH_STATE_DIR = process.env.HEALTH_STATE_DIR || (
  process.env.WEBSITE_INSTANCE_ID
    ? '/home/data/genai-playground-health-state'
    : path.join(__dirname, '.genai-playground-health-state')
);

function ownerNotificationPath(id) {
  return path.join(HEALTH_STATE_DIR, `${encodeURIComponent(String(id))}.owner-notification.json`);
}

function recoveryNotificationPath(id) {
  return path.join(HEALTH_STATE_DIR, `${encodeURIComponent(String(id))}.recovery-notification.json`);
}

function readRecoveryNotification(id) {
  try {
    const file = recoveryNotificationPath(id);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  } catch (err) {
    console.warn(`[adminHealth] Unable to read recovery notification state for ${id}: ${err.message}`);
    return null;
  }
}

function writeRecoveryNotification(id, value) {
  const file = recoveryNotificationPath(id);
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.mkdirSync(HEALTH_STATE_DIR, { recursive: true });
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(value), 'utf8');
    fs.renameSync(temporaryFile, file);
  } catch (err) {
    try { if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile); } catch (_) { /* best effort */ }
    throw err;
  }
}

function readOwnerNotification(id) {
  const file = ownerNotificationPath(id);
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn(`[adminHealth] Unable to read owner notification state ${file}: ${err.message}`);
    return null;
  }
}

function writeOwnerNotification(id, notification) {
  const file = ownerNotificationPath(id);
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.mkdirSync(HEALTH_STATE_DIR, { recursive: true });
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(notification), 'utf8');
    fs.renameSync(temporaryFile, file);
  } catch (err) {
    try {
      if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
    } catch (cleanupError) {
      console.warn(`[adminHealth] Unable to remove temporary owner notification state ${temporaryFile}: ${cleanupError.message}`);
    }
    throw err;
  }
}

function clearOwnerNotification(id) {
  const file = ownerNotificationPath(id);
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[adminHealth] Unable to clear owner notification state ${file}: ${err.message}`);
    }
  }
}

function healthRecordPath(id) {
  return path.join(HEALTH_STATE_DIR, `${encodeURIComponent(String(id))}.json`);
}

function readHealthRecord(id) {
  const file = healthRecordPath(id);
  try {
    if (!fs.existsSync(file)) return null;
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    return record?.id === id ? record : null;
  } catch (err) {
    console.warn(`[adminHealth] Unable to read health state ${file}: ${err.message}`);
    return null;
  }
}

function healthRecordTimestamp(record) {
  const lastChecked = new Date(record?.lastChecked || 0).getTime();
  if (record?.statusSource !== 'azure_monitor' && Number.isFinite(lastChecked)) {
    return lastChecked;
  }
  const timestamps = [
    lastChecked,
    record?.telemetryObservedAt,
    record?.lastRecoveryCheckAt,
    record?.lastError?.timeGenerated,
  ].map((value) => new Date(value || 0).getTime()).filter(Number.isFinite);
  return timestamps.length ? Math.max(...timestamps) : 0;
}

function isSuccessfulProbeStatus(statusCode) {
  const code = Number(statusCode);
  return code >= 200 && code < 400;
}

function isTransientProbeFailure(result) {
  const status = Number(result?.statusCode);
  return (status >= 500 && status <= 599) ||
    [408, 425, 429].includes(status) ||
    ['timeout', 'network_error'].includes(String(result?.errorType || '').toLowerCase());
}

function pendingTransientFailureRecord(useCase, result, previous, attempts = []) {
  const failures = Number(previous?.consecutiveFailures || 0) + 1;
  return {
    ...(previous || {}),
    id: useCase.id,
    title: useCase.title,
    launchUrl: useCase.launchUrl,
    // Retain the last confirmed state while the failure is being validated.
    status: previous?.status === 'inactive' ? 'inactive' : 'active',
    lastChecked: new Date().toISOString(),
    latencyMs: result?.latencyMs ?? previous?.latencyMs ?? null,
    probeStatusCode: result?.statusCode ?? null,
    probeErrorType: result?.errorType || null,
    consecutiveFailures: failures,
    pendingProbeFailure: true,
    pendingProbeFailureSince: previous?.pendingProbeFailureSince || new Date().toISOString(),
    monitoringNote: `Transient health-probe failure is being verified (${failures}/${HEALTH_FAILURE_CONFIRMATION_CYCLES}). The previous confirmed application state is retained; no owner notification is sent yet.`,
    autoFixAttempts: attempts,
    owner: useCase.owner || null,
    ownerEmail: useCase.ownerEmail || null,
    // A probe failure alone is not a confirmed application incident.
    actionRequired: previous?.actionRequired === true,
  };
}

// Each App Service worker reads and writes the same per-application state file.
// The timestamp guard prevents a slower, older probe from overwriting a newer
// result written by another worker.
class SharedHealthStore extends Map {
  get(id) {
    const persisted = readHealthRecord(id);
    const inMemory = super.get(id);
    if (persisted && (!inMemory ||
        healthRecordTimestamp(persisted) >= healthRecordTimestamp(inMemory))) {
      super.set(id, persisted);
    }
    return super.get(id);
  }

  set(id, record) {
    const persisted = readHealthRecord(id);
    const inMemory = super.get(id);
    const previous = persisted && (!inMemory || healthRecordTimestamp(persisted) >= healthRecordTimestamp(inMemory))
      ? persisted
      : inMemory;

    // Stamp a single durable recovery event when a previously confirmed
    // Unavailable/Stopped application becomes Available. Keep the event on
    // subsequent Available writes so a temporarily unavailable Logic App can
    // be retried without generating duplicate recovery emails.
    let nextRecord = record;
    const priorState = String(previous?.status || '').toLowerCase();
    const nextState = String(record?.status || '').toLowerCase();
    if (nextState === 'active' && ['inactive', 'stopped'].includes(priorState)) {
      const incidentAt = previous?.lastError?.timeGenerated || previous?.lastError?.timestamp || previous?.lastChecked || healthRecordTimestamp(previous);
      const eventKey = `${id}:${priorState}->active:${incidentAt}`;
      nextRecord = {
        ...record,
        recoveryTransition: {
          key: eventKey,
          previousStatus: priorState,
          occurredAt: record.lastChecked || new Date().toISOString(),
        },
      };
    } else if (nextState === 'active' && priorState === 'active' && previous?.recoveryTransition) {
      nextRecord = { ...record, recoveryTransition: previous.recoveryTransition };
    }

    const latest = persisted && healthRecordTimestamp(persisted) > healthRecordTimestamp(nextRecord)
      ? persisted
      : nextRecord;
    super.set(id, latest);
    if (latest !== nextRecord) return this;

    const file = healthRecordPath(id);
    const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.mkdirSync(HEALTH_STATE_DIR, { recursive: true });
      fs.writeFileSync(temporaryFile, JSON.stringify(nextRecord), 'utf8');
      fs.renameSync(temporaryFile, file);
    } catch (err) {
      console.warn(`[adminHealth] Unable to persist health state ${file}: ${err.message}`);
      try {
        if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
      } catch (cleanupError) {
        console.warn(`[adminHealth] Unable to remove temporary health state ${temporaryFile}: ${cleanupError.message}`);
      }
    }

    if (nextState === 'active' && nextRecord.recoveryTransition?.key) {
      queueMicrotask(() => {
        const useCase = {
          id,
          title: nextRecord.title,
          launchUrl: nextRecord.launchUrl,
          owner: nextRecord.owner,
          ownerEmail: nextRecord.ownerEmail,
        };
        notifyRecoveryOwner(useCase, nextRecord).catch((err) => {
          console.warn(`[adminHealth] Recovery notification failed for ${id}: ${err.message}`);
        });
      });
    }
    return this;
  }
}

// id -> latest shared record
const healthStore = new SharedHealthStore();

function persistOwnerNotification(id, notification, fallbackRecord) {
  const persisted = readHealthRecord(id);
  const current = persisted || healthStore.get(id) || fallbackRecord;
  const updated = { ...current, lastNotification: notification };
  healthStore.set(id, updated);
  return updated;
}

// rolling incident/error log, newest first. Persist it on /home so Azure App
// Service restarts/deployments do not erase Alerts & Incidents / Audit Logs.
function readIncidentLog() {
  try {
    if (!fs.existsSync(INCIDENT_LOG_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(INCIDENT_LOG_FILE, 'utf8') || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_INCIDENT_LOG) : [];
  } catch (err) {
    console.warn(`[adminHealth] Unable to read incident log ${INCIDENT_LOG_FILE}: ${err.message}`);
    return [];
  }
}
function writeIncidentLog(rows) {
  try {
    fs.mkdirSync(path.dirname(INCIDENT_LOG_FILE), { recursive: true });
    const tmp = `${INCIDENT_LOG_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows.slice(0, MAX_INCIDENT_LOG), null, 2), 'utf8');
    fs.renameSync(tmp, INCIDENT_LOG_FILE);
  } catch (err) {
    console.warn(`[adminHealth] Unable to persist incident log ${INCIDENT_LOG_FILE}: ${err.message}`);
  }
}
const incidentLog = readIncidentLog();

// Concurrency guards: prevent a manual "Recheck"/"Check All" from
// overlapping the background sweep (or another manual click) against the
// same use case(s), which would double outbound probes and could race on
// healthStore writes / fire duplicate notifications.
const inFlightIds = new Set();
let sweepInFlight = false;

function logIncident(entry) {
  incidentLog.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (incidentLog.length > MAX_INCIDENT_LOG) incidentLog.length = MAX_INCIDENT_LOG;
  writeIncidentLog(incidentLog);
}

/** HTTP probe of a launchUrl, following redirects to the final application response. */
function probe(launchUrl, redirectCount = 0, startedAt = Date.now()) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(launchUrl);
    } catch {
      return resolve({ ok: false, errorType: 'invalid_url', errorMessage: 'launchUrl is not a valid URL' });
    }
    const lib = target.protocol === 'http:' ? http : https;

    const req = lib.request(
      target,
      {
        method: 'GET',
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          // Some App Service auth layers / WAFs / access restrictions treat
          // requests with no User-Agent (Node's default) as non-browser
          // traffic and reject them fast — even though the app itself is
          // perfectly healthy. Looking like a real browser avoids that
          // false "inactive" reading.
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 GenAI-Playground-HealthCheck',
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'Cache-Control': 'no-cache, no-store',
          Pragma: 'no-cache',
        },
      },
      (res) => {
        // Capture a small response-body sample. Azure App Service returns HTTP
        // 403 for both access restrictions *and* for a stopped web app, so the
        // status code alone is not enough to distinguish those states.
        const chunks = [];
        let capturedBytes = 0;
        const MAX_BODY_SAMPLE_BYTES = 16 * 1024;
        res.on('data', (chunk) => {
          if (capturedBytes >= MAX_BODY_SAMPLE_BYTES) return;
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          const remaining = MAX_BODY_SAMPLE_BYTES - capturedBytes;
          chunks.push(buf.subarray(0, remaining));
          capturedBytes += Math.min(buf.length, remaining);
        });
        res.on('end', () => {
          const latencyMs = Date.now() - startedAt;
          const bodySample = Buffer.concat(chunks).toString('utf8');
          const normalizedBody = bodySample.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
          const isRedirect = [301, 302, 303, 307, 308].includes(res.statusCode);
          const location = res.headers.location;
          if (isRedirect && location) {
            if (redirectCount >= MAX_HEALTH_PROBE_REDIRECTS) {
              resolve({
                ok: false,
                statusCode: res.statusCode,
                latencyMs,
                errorType: 'redirect_error',
                errorMessage: `Health probe exceeded ${MAX_HEALTH_PROBE_REDIRECTS} redirects`,
              });
              return;
            }
            let redirectedUrl;
            try {
              redirectedUrl = new URL(location, target).toString();
            } catch {
              resolve({
                ok: false,
                statusCode: res.statusCode,
                latencyMs,
                errorType: 'redirect_error',
                errorMessage: 'Health probe received an invalid redirect URL',
              });
              return;
            }
            if (!['http:', 'https:'].includes(new URL(redirectedUrl).protocol)) {
              resolve({
                ok: false,
                statusCode: res.statusCode,
                latencyMs,
                errorType: 'redirect_error',
                errorMessage: 'Health probe received an unsupported redirect protocol',
              });
              return;
            }
            probe(redirectedUrl, redirectCount + 1, startedAt).then(resolve);
            return;
          }

          const responseIndicatesUnavailable =
            /<title[^>]*>\s*503\b|<h1[^>]*>\s*503\b/i.test(bodySample) ||
            /^\s*503\s+service unavailable(?:\s|$)/i.test(normalizedBody);
          const statusCode = responseIndicatesUnavailable && res.statusCode >= 200 && res.statusCode < 400
            ? 503
            : res.statusCode;
          const ok = statusCode >= 200 && statusCode < 400;
          const appStopped = statusCode === 403 && (
            /this web app is stopped/.test(normalizedBody) ||
            /web app (?:has been|is) stopped/.test(normalizedBody) ||
            /the web app you have attempted to reach is currently stopped/.test(normalizedBody)
          );
          const authRestricted = !ok && !appStopped && (statusCode === 401 || statusCode === 403);
          // Azure App Service access-restriction responses are generated by
          // the platform before the request reaches the application. They
          // commonly say that the web app has blocked access. Do not interpret
          // this platform-generated 403 as an application outage for every
          // app; reconcile ARM runtime + app telemetry instead.
          const forbiddenIpHeader = Boolean(
            res.headers['x-ms-forbidden-ip'] ||
            res.headers['x-ms-forbidden-client-ip'] ||
            res.headers['x-azure-ref'] && /forbidden|blocked/i.test(String(res.headers['x-azure-ref']))
          );
          const azurePlatformBody = (
            /the web app you have attempted to reach has blocked your access/.test(normalizedBody) ||
            /your ip address.*(?:not allowed|blocked|denied)/.test(normalizedBody) ||
            /access restrictions? (?:for|on) this web app/.test(normalizedBody) ||
            /http 403.*ip address/.test(normalizedBody) ||
            /you do not have permission to view this directory or page/.test(normalizedBody) ||
            /403\s*[-:]\s*forbidden/.test(normalizedBody) ||
            /ip address that is accessing the site/.test(normalizedBody) ||
            /access to this web app is restricted/.test(normalizedBody) ||
            /client ip.*(?:not allowed|not authorized|blocked)/.test(normalizedBody) ||
            /request was blocked by.*(?:access restriction|ip restriction)/.test(normalizedBody) ||
            /your request has been blocked/.test(normalizedBody)
          );
          const accessRestrictedByAzure = statusCode === 403 && (forbiddenIpHeader || azurePlatformBody);

          let errorMessage = null;
          if (!ok) {
            if (appStopped) {
              errorMessage = `Azure App Service is stopped (HTTP ${statusCode})`;
            } else if (authRestricted) {
              errorMessage = `Application URL responded with HTTP ${statusCode}, but access is restricted for this health check.`;
            } else {
              errorMessage = responseIndicatesUnavailable
                ? 'Application response body contains a 503 Service Unavailable page'
                : `App responded with HTTP ${statusCode}`;
            }
          }
          resolve({
            ok,
            appStopped,
            authRestricted,
            accessRestrictedByAzure,
            probeDiagnostics: statusCode === 403 ? {
              contentType: String(res.headers['content-type'] || ''),
              server: String(res.headers.server || ''),
              forbiddenIpHeader,
              azurePlatformBody,
              bodyFingerprint: [
                /ip address/.test(normalizedBody) ? 'mentions_ip_address' : null,
                /access restriction/.test(normalizedBody) ? 'mentions_access_restriction' : null,
                /web app/.test(normalizedBody) ? 'mentions_web_app' : null,
                /forbidden/.test(normalizedBody) ? 'mentions_forbidden' : null,
              ].filter(Boolean),
            } : null,
            statusCode,
            latencyMs,
            errorType: ok ? null : (appStopped ? 'app_stopped' : 'http_error'),
            errorMessage,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ok: false,
        latencyMs: Date.now() - startedAt,
        errorType: 'timeout',
        errorMessage: `No response within ${REQUEST_TIMEOUT_MS / 1000}s (likely a cold-started/sleeping instance)`,
      });
    });

    req.on('error', (err) => {
      resolve({
        ok: false,
        latencyMs: Date.now() - startedAt,
        errorType: 'network_error',
        errorMessage: err.message,
      });
    });

    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function detectDependency(text) {
  const t = String(text || '').toLowerCase();
  if (/azure[ -]?openai|openai|aoai|cognitive services|azure ai inference|chat completions|model endpoint|model deployment|deployment.*(?:not found|unavailable)|gpt-4|gpt-35|content filter/.test(t)) return 'Azure OpenAI';
  if (/neo4j|neo4j[._ -]?(?:driver|exceptions?|error|database)|neo[.]clienterror|graphdatabase[.]driver|bolt(?:\+s)?:\/\/|(?:serviceunavailable|sessionexpired|transienterror).*?(?:neo4j|bolt|graph database)|(?:neo4j|bolt|graph database).*(?:service unavailable|connection refused|connection timeout|session expired|transaction failed|routing information|unavailable)/.test(t)) return 'Neo4j';
  if (/azure sql|sql server|database|jdbc|odbc|pyodbc|sequelize|entity framework/.test(t)) return 'Database / SQL';
  if (/blob|storage account|azure storage|queue storage|table storage|data lake/.test(t)) return 'Azure Storage';
  if (/key vault|keyvault|secret|certificate|@microsoft\.keyvault|secreturi/.test(t)) return 'Key Vault';
  if (/redis|cache/.test(t)) return 'Redis / Cache';
  if (/service bus|event hub|eventhub|event grid/.test(t)) return 'Messaging';
  if (/dns|name resolution|econnrefused|econnreset|socket|connection refused|connection reset/.test(t)) return 'Network / External dependency';
  return null;
}

function normalizeOperationalSeverity(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'urgent' || v === 'critical' || v === 'fatal') return 'critical';
  if (v === 'high' || v === 'error') return 'high';
  if (v === 'medium' || v === 'warning' || v === 'warn') return 'medium';
  return 'low';
}

function isActionableSeverity(value) {
  // Warnings (medium) are diagnostic signals, not application outages by
  // themselves. Critical/Fatal and Error/High remain eligible for incident
  // evaluation; generic High errors are confirmed across monitoring cycles
  // below before changing state or notifying an owner.
  return ['critical', 'high'].includes(normalizeOperationalSeverity(value));
}

function isPrimaryAppServiceError(error, useCase) {
  const role = String(error?.ResourceRole || error?.resourceRole || '').toLowerCase();
  if (role.startsWith('shared-') || ['backend', 'openai', 'database'].includes(role)) return false;
  if (role === 'primary' || role === 'frontend') return true;

  let expectedName = null;
  try {
    expectedName = new URL(useCase?.launchUrl).hostname.split('.')[0].toLowerCase();
  } catch {
    expectedName = null;
  }
  const resourceName = String(
    error?.ResourceName ||
    error?.resourceName ||
    String(error?._ResourceId || '').match(/\/sites\/([^/]+)/i)?.[1] ||
    ''
  ).toLowerCase();
  return Boolean(expectedName && resourceName === expectedName);
}

function httpServerErrorStatusCode(errors = [], useCase = null) {
  for (const error of errors) {
    const source = String(error.Source || '').toLowerCase();
    if (useCase && !isPrimaryAppServiceError(error, useCase)) continue;
    const message = String(error.Message || '');
    const statusCode = source === 'http'
      ? Number(message.match(/^\s*(5\d{2})\b/)?.[1])
      : source === 'application insights request'
        ? Number(message.match(/\bresult\s*=\s*(5\d{2})\b/i)?.[1])
        : 0;
    if (statusCode >= 500 && statusCode <= 599) return statusCode;
  }
  return null;
}

function isHttpAvailabilityLatch(latch, useCase) {
  const statusCode = Number(latch?.lastError?.statusCode);
  const category = latch?.lastError?.category || latch?.dependencyHealth?.category;
  const source = String(latch?.lastError?.source || '').toLowerCase();
  const primaryHttpStatus = httpServerErrorStatusCode(
    Array.isArray(latch?.azureErrors) ? latch.azureErrors : [],
    useCase
  );
  const hasPrimaryHttpEvidence =
    (primaryHttpStatus >= 500 && primaryHttpStatus <= 599) ||
    (statusCode >= 500 && statusCode <= 599 &&
      isPrimaryAppServiceError(latch?.lastError, useCase) &&
      (category === 'app_service' || source === 'http' || source === 'application insights request'));
  return Boolean(hasPrimaryHttpEvidence);
}

function classifyError(error, recentLogs = []) {
  const text = [error?.errorType, error?.errorMessage, ...recentLogs.map(x => x.Message)].filter(Boolean).join(' ').toLowerCase();
  const dependency = detectDependency(text);

  if (/outofmemory|heap out of memory|memory limit|cannot allocate memory/.test(text)) {
    return { severity: 'critical', action: 'owner_alert', category: 'runtime', dependency, reason: 'Memory exhaustion requires application-level investigation or scaling.' };
  }
  if (/authentication|unauthorized|forbidden|permissiondenied|\b401\b|\b403\b|invalid credential|invalid api key|invalid subscription key|api key.*(?:missing|invalid|not set|not configured)|key vault.*(?:not able to be resolved|unresolved|invalidsyntax|vaultnotfound|secretnotfound|access.*denied)|secret.*(?:not found|can(?:not|'t) be found|missing)|secreturi.*(?:invalid|missing)|@microsoft\.keyvault|expired token|token acquisition/.test(text)) {
    return { severity: 'critical', action: 'owner_alert', category: dependency ? 'dependency_auth' : 'authentication', dependency, reason: dependency === 'Key Vault' ? 'Key Vault/app-setting credential resolution failure can make the application workflow unusable and requires immediate owner action.' : 'Authentication or authorization failure is not safe to auto-remediate.' };
  }
  if (dependency === 'Azure OpenAI' && /\b429\b|too many requests|rate limit|quota|throttl/.test(text)) {
    return { severity: 'high', action: 'owner_alert', category: 'azure_openai_throttling', dependency, reason: 'Azure OpenAI is throttling or quota-limited; review model quota, TPM/RPM and retry policy.' };
  }
  if (dependency === 'Azure OpenAI' && /timeout|timed out|unavailable|connection|failed|error|\b5\d\d\b/.test(text)) {
    return { severity: 'high', action: 'owner_alert', category: 'azure_openai_dependency', dependency, reason: 'Application is reachable but its Azure OpenAI dependency is failing.' };
  }
  if (/configuration|environment variable|connection string|secret|certificate|dns|name resolution|database|sql|redis|dependency/.test(text)) {
    return { severity: 'high', action: 'owner_alert', category: 'dependency', dependency, reason: 'Configuration/dependency issue should be investigated before changing infrastructure.' };
  }
  if (/timeout|econnreset|econnrefused|socket|502|503|504|crash|worker|process|http_error/.test(text)) {
    return { severity: 'high', action: dependency ? 'owner_alert' : 'auto_restart_then_alert', category: dependency ? 'dependency' : 'app_service', dependency, reason: dependency ? `${dependency} connectivity failure requires dependency investigation.` : 'Likely transient App Service/process issue; a controlled restart is permitted when enabled.' };
  }
  return { severity: 'medium', action: 'owner_alert', category: dependency ? 'dependency' : 'application', dependency, reason: dependency ? `${dependency} error requires investigation.` : 'Unknown application error; manual investigation required.' };
}


const discoveredAppServiceIds = new Map();

async function armGetJson(url, token) {
  const response = await globalThis.fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = new Error(`ARM HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function discoverAppServiceResourceId(useCase, token) {
  // Discover by exact App Service hostname. Try the configured subscription
  // first, then all subscriptions visible to this managed identity. This
  // handles catalog entries spread across resource groups/subscriptions and
  // avoids falsely treating an ARM lookup in the wrong subscription as an
  // application outage.
  if (!useCase?.launchUrl) return { resourceId: null, reason: 'launch_url_missing' };

  let siteName;
  try { siteName = new URL(useCase.launchUrl).hostname.split('.')[0]; }
  catch { return { resourceId: null, reason: 'launch_url_invalid' }; }

  const cacheKey = siteName.toLowerCase();
  const cached = discoveredAppServiceIds.get(cacheKey);
  if (cached) return { ...cached, cached: true };

  const subscriptionIds = [];
  const configuredSubscription = String(process.env.AZURE_SUBSCRIPTION_ID || '').trim();
  if (configuredSubscription) subscriptionIds.push(configuredSubscription);

  let subscriptionDiscoveryReason = null;
  try {
    let next = 'https://management.azure.com/subscriptions?api-version=2022-12-01';
    let pages = 0;
    while (next && pages < 10) {
      const payload = await armGetJson(next, token);
      for (const item of payload?.value || []) {
        const id = String(item?.subscriptionId || '').trim();
        const state = String(item?.state || 'Enabled').toLowerCase();
        if (id && state === 'enabled' && !subscriptionIds.includes(id)) subscriptionIds.push(id);
      }
      next = payload?.nextLink || null;
      pages += 1;
    }
  } catch (err) {
    subscriptionDiscoveryReason = `subscription_enumeration_${err.status || 'failed'}`;
  }

  if (!subscriptionIds.length) {
    return {
      resourceId: null,
      reason: configuredSubscription
        ? (subscriptionDiscoveryReason || 'no_accessible_subscriptions')
        : 'AZURE_SUBSCRIPTION_ID_not_configured_and_subscription_enumeration_failed',
    };
  }

  const filter = `resourceType eq 'Microsoft.Web/sites' and name eq '${siteName.replace(/'/g, "''")}'`;
  const failures = [];
  for (const subscriptionId of subscriptionIds) {
    try {
      let next = `https://management.azure.com/subscriptions/${encodeURIComponent(subscriptionId)}/resources?api-version=2021-04-01&$filter=${encodeURIComponent(filter)}`;
      let pages = 0;
      while (next && pages < 20) {
        const payload = await armGetJson(next, token);
        const match = (payload?.value || []).find(item =>
          String(item?.name || '').toLowerCase() === siteName.toLowerCase() &&
          String(item?.type || '').toLowerCase() === 'microsoft.web/sites'
        );
        if (match?.id) {
          const found = {
            resourceId: match.id,
            resourceGroup: match.id.match(/\/resourceGroups\/([^/]+)/i)?.[1] || null,
            subscriptionId,
          };
          discoveredAppServiceIds.set(cacheKey, found);
          return found;
        }
        next = payload?.nextLink || null;
        pages += 1;
      }
    } catch (err) {
      failures.push(`${subscriptionId}:${err.status || 'error'}`);
    }
  }

  return {
    resourceId: null,
    reason: failures.length
      ? `app_service_not_found; searched ${subscriptionIds.length} accessible subscription(s); ARM lookup failures: ${failures.join(', ')}`
      : `app_service_not_found; searched ${subscriptionIds.length} accessible subscription(s) for ${siteName}`,
  };
}

async function getAzureAppServiceRuntimeState(useCase) {
  try {
    const token = await awaitWithTimeout(
      getAccessToken('https://management.azure.com/.default'),
      8000,
      'Azure management token acquisition',
    );
    if (!token?.token) return { available: false, state: null, reason: 'token_unavailable' };

    let resourceId = azureLogs.resolveResourceId(useCase);
    let discovered = null;

    // Validate a catalog/environment-derived resource ID first. If it points
    // to the wrong subscription or resource group (ARM 404), fall back to
    // hostname discovery across subscriptions visible to the identity.
    if (resourceId) {
      const endpoint = `https://management.azure.com${resourceId}?api-version=2024-11-01`;
      const response = await globalThis.fetch(endpoint, {
        headers: { Authorization: `Bearer ${token.token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const body = await response.json();
        return {
          available: true,
          state: String(body?.properties?.state || '').toLowerCase(),
          resourceId,
          resourceGroup: resourceId.match(/\/resourceGroups\/([^/]+)/i)?.[1] || null,
        };
      }
      if (![403, 404].includes(response.status)) {
        return { available: false, state: null, reason: `arm_site_get_http_${response.status}`, resourceId };
      }
      // A stale resource ID or resource-level scope may return 403/404.
      // Continue with subscription discovery; a different accessible
      // subscription/resource-group mapping may still identify the site.
    }

    discovered = await discoverAppServiceResourceId(useCase, token.token);
    resourceId = discovered.resourceId;
    if (!resourceId) {
      return {
        available: false,
        state: null,
        reason: discovered.reason || 'resource_id_missing',
        discovery: {
          hostname: (() => { try { return new URL(useCase.launchUrl).hostname; } catch { return null; } })(),
          configuredSubscriptionPresent: Boolean(process.env.AZURE_SUBSCRIPTION_ID),
        },
      };
    }

    const endpoint = `https://management.azure.com${resourceId}?api-version=2024-11-01`;
    const response = await globalThis.fetch(endpoint, {
      headers: { Authorization: `Bearer ${token.token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { available: false, state: null, reason: `arm_site_get_http_${response.status}`, resourceId };
    const body = await response.json();
    return {
      available: true,
      state: String(body?.properties?.state || '').toLowerCase(),
      resourceId,
      resourceGroup: discovered?.resourceGroup || resourceId.match(/\/resourceGroups\/([^/]+)/i)?.[1] || null,
      subscriptionId: discovered?.subscriptionId || null,
    };
  } catch (err) {
    return { available: false, state: null, reason: err.message };
  }
}

/**
 * Verify explicitly declared critical App Service settings without ever
 * returning or persisting their values. This catches a deleted Key Vault-backed
 * API-key setting even when the public React landing page still returns 200.
 *
 * requiredAppSettingGroups example:
 * [{ name: "Azure OpenAI API key", roles: ["backend"],
 *    patterns: ["AZURE_OPENAI_API_KEY", "OPENAI_API_KEY"] }]
 */
/**
 * Verify the runtime state of explicitly mapped App Services by role.
 * Unlike getAzureAppServiceRuntimeState(), this helper does not discover a
 * different site from the public URL when a mapped resource cannot be read.
 */
async function getMappedAppServiceRuntimeEvidence(useCase, requiredRoles = []) {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [];
  const targets = azureLogs.resolveResourceTargets(useCase)
    .filter((target) => /Microsoft\.Web\/sites/i.test(String(target.resourceId || '')) &&
      (!roles.length || roles.includes(String(target.role || '').toLowerCase())));
  const missingRoles = roles.filter((role) =>
    !targets.some((target) => String(target.role || '').toLowerCase() === role.toLowerCase())
  );
  if (missingRoles.length) {
    return { ok: false, reason: `Missing mapped App Service role(s): ${missingRoles.join(', ')}`, states: [] };
  }

  const token = await awaitWithTimeout(
    getAccessToken('https://management.azure.com/.default'),
    8000,
    'Azure App Service recovery runtime token',
  );
  if (!token?.token) return { ok: false, reason: 'Azure management token unavailable', states: [] };

  const states = [];
  for (const target of targets) {
    try {
      const response = await globalThis.fetch(
        `https://management.azure.com${target.resourceId}?api-version=2024-11-01`,
        {
          headers: { Authorization: `Bearer ${token.token}` },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) {
        states.push({
          role: target.role,
          name: target.name,
          available: false,
          state: null,
          reason: `ARM HTTP ${response.status}`,
        });
        continue;
      }
      const payload = await response.json();
      const state = String(payload?.properties?.state || '').toLowerCase();
      states.push({
        role: target.role,
        name: target.name,
        available: ['running', 'started'].includes(state),
        state,
        reason: ['running', 'started'].includes(state) ? null : `App Service state is ${state || 'unknown'}`,
      });
    } catch (err) {
      states.push({
        role: target.role,
        name: target.name,
        available: false,
        state: null,
        reason: err.message,
      });
    }
  }

  const required = roles.length
    ? states.filter((item) => roles.includes(String(item.role || '').toLowerCase()))
    : states;
  return {
    ok: required.length > 0 && required.every((item) => item.available),
    states,
    reason: required.filter((item) => !item.available)
      .map((item) => `${item.role || item.name}: ${item.reason || item.state || 'not running'}`)
      .join('; ') || null,
  };
}

async function checkRequiredAppSettings(useCase) {
  const groups = Array.isArray(useCase?.requiredAppSettingGroups)
    ? useCase.requiredAppSettingGroups
    : [];
  if (!groups.length) return { ok: true, unknown: false, errors: [], inspectionWarnings: [] };

  const normalizeRole = (value) => String(value || '').trim().toLowerCase();
  const configuredRoles = [...new Set(groups.flatMap((group) =>
    Array.isArray(group.roles) ? group.roles.map(normalizeRole).filter(Boolean) : []
  ))];
  const allTargets = azureLogs.resolveResourceTargets(useCase);
  const targets = allTargets.filter((target) =>
    configuredRoles.length
      ? configuredRoles.includes(normalizeRole(target.role))
      : /backend|function/i.test(String(target.role || ''))
  );
  const missingConfiguredRoles = configuredRoles.filter((role) =>
    !allTargets.some((target) => normalizeRole(target.role) === role)
  );
  const targetsWithoutResourceIds = targets.filter((target) => !target.resourceId);

  if (!targets.length || missingConfiguredRoles.length || targetsWithoutResourceIds.length) {
    const reasons = [];
    if (!targets.length) reasons.push('No mapped App Service target was resolved for required-setting validation.');
    if (missingConfiguredRoles.length) reasons.push(`Required resource role mapping is missing: ${missingConfiguredRoles.join(', ')}.`);
    if (targetsWithoutResourceIds.length) reasons.push(`Azure resource IDs could not be constructed for: ${targetsWithoutResourceIds.map((target) => `${target.role}:${target.name || 'unnamed'}`).join(', ')}. Check AZURE_SUBSCRIPTION_ID and resource-group mappings.`);
    return {
      ok: false,
      unknown: true,
      errors: [],
      inspectionWarnings: [{ dependency: 'Azure configuration monitoring', message: reasons.join(' '), unknown: true }],
      monitoringNote: reasons.join(' '),
      checkedTargets: targets.map((target) => ({ role: target.role, name: target.name || null, resourceIdResolved: Boolean(target.resourceId) })),
    };
  }

  let token;
  try {
    token = await awaitWithTimeout(
      getAccessToken('https://management.azure.com/.default'),
      8000,
      'Azure app settings token acquisition',
    );
  } catch (err) {
    token = null;
  }
  if (!token?.token) {
    const message = 'Unable to acquire an Azure management token to validate required App Service settings.';
    return {
      ok: false,
      unknown: true,
      errors: [],
      inspectionWarnings: [{ dependency: 'Azure configuration monitoring', message, unknown: true }],
      monitoringNote: message,
      checkedTargets: targets.map((target) => ({ role: target.role, name: target.name || null, resourceIdResolved: true })),
    };
  }

  const errors = [];
  const inspectionWarnings = [];
  const inspectedTargets = [];
  for (const target of targets) {
    const resourceId = target.resourceId;
    let response;
    try {
      response = await globalThis.fetch(
        `https://management.azure.com${resourceId}/config/appsettings/list?api-version=2022-03-01`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) {
        inspectionWarnings.push({
          dependency: 'Azure configuration monitoring',
          message: `Unable to inspect required settings for ${target.name || 'backend'} (ARM HTTP ${response.status}). Verify the monitoring identity has Microsoft.Web/sites/config/list/action on this App Service.`,
          unknown: true,
          resourceName: target.name || null,
          statusCode: response.status,
        });
        continue;
      }

      const payload = await response.json();
      const settings = payload?.properties || payload?.Properties || {};
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        inspectionWarnings.push({
          dependency: 'Azure configuration monitoring',
          message: `Azure returned an unexpected App Service settings response for ${target.name || 'backend'}.`,
          unknown: true,
          resourceName: target.name || null,
        });
        continue;
      }
      inspectedTargets.push({ role: target.role, name: target.name || null });
      const names = Object.keys(settings);
      for (const group of groups) {
        const groupRoles = Array.isArray(group.roles) ? group.roles.map(normalizeRole) : [];
        if (groupRoles.length && !groupRoles.includes(normalizeRole(target.role))) continue;
        const patterns = (group.patterns || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean);
        const exactOnly = String(group.matchMode || '').toLowerCase() === 'exact';
        const matching = names.filter((name) => patterns.some((pattern) =>
          exactOnly
            ? name.toLowerCase() === pattern
            : (name.toLowerCase() === pattern || name.toLowerCase().includes(pattern))
        ));
        if (!matching.length) {
          errors.push({
            dependency: group.name || 'Required application setting',
            message: `Required setting for ${group.name || 'application dependency'} is missing from ${target.name || 'backend'} App Service configuration.`,
            resourceName: target.name,
            settingNamesChecked: patterns,
          });
          continue;
        }
        const configured = matching.some((name) => {
          const value = settings[name];
          return value != null && String(value).trim().length > 0;
        });
        if (!configured) {
          errors.push({
            dependency: group.name || 'Required application setting',
            message: `Required setting for ${group.name || 'application dependency'} exists but is empty in ${target.name || 'backend'} App Service configuration.`,
            resourceName: target.name,
            settingNamesChecked: patterns,
          });
        }
      }
    } catch (err) {
      inspectionWarnings.push({
        dependency: 'Azure configuration monitoring',
        message: `Required settings validation failed for ${target.name || 'backend'}: ${String(err?.message || err).slice(0, 240)}`,
        unknown: true,
        resourceName: target.name || null,
      });
    }
  }

  try {
    const keyVaultRows = await azureLogs.getKeyVaultReferenceErrors(targets.map((target) => target.resourceId));
    for (const row of keyVaultRows) {
      errors.push({
        dependency: 'Key Vault',
        message: row.Message,
        resourceName: row.ResourceName,
      });
    }
  } catch (err) {
    inspectionWarnings.push({
      dependency: 'Key Vault configuration monitoring',
      message: `Key Vault reference status could not be inspected: ${String(err?.message || err).slice(0, 240)}`,
      unknown: true,
    });
  }

  const unknown = inspectionWarnings.length > 0;
  return {
    ok: errors.length === 0 && !unknown,
    unknown,
    errors,
    inspectionWarnings,
    checkedTargets: inspectedTargets,
    monitoringNote: unknown
      ? `Required-setting verification is inconclusive: ${inspectionWarnings.map((item) => item.message).join(' ')}`
      : null,
  };
}

async function restartApp(useCase) {
  if (!ENABLE_AUTO_RESTART) return { attempted: false, reason: 'auto_restart_disabled' };
  const resourceId = azureLogs.resolveResourceId(useCase);
  if (!resourceId) return { attempted: false, reason: 'azureResourceId_missing' };
  const previous = restartHistory.get(useCase.id);
  if (previous && Date.now() - previous < AUTO_RESTART_COOLDOWN_MS) {
    return { attempted: false, reason: 'restart_cooldown' };
  }
  const token = await getAccessToken('https://management.azure.com/.default');
  if (!token?.token) throw new Error('Unable to acquire Azure management token');
  const endpoint = `https://management.azure.com${resourceId}/restart?api-version=2026-03-15&softRestart=true&synchronous=true`;
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token.token}` } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Azure restart failed (${response.status}): ${body.slice(0, 500)}`);
  }
  restartHistory.set(useCase.id, Date.now());
  return { attempted: true, reason: 'restart_requested' };
}

async function collectApplicationErrors(useCase, minutes = 60) {
  try {
    return await azureLogs.getErrors(azureLogs.resolveResourceIds(useCase), minutes, 100);
  } catch (err) {
    logIncident({ useCaseId: useCase.id, solution: useCase.title, level: 'log_query_failed', message: `Could not retrieve Azure application errors: ${err.message}` });
    return { configured: true, errors: [], reason: err.message };
  }
}

/**
 * Owner notification without SMTP.
 *
 * Recommended production pattern: Azure Monitor Scheduled Query Alert + Action Group.
 * This function optionally calls an Azure Logic App / Power Automate / Function webhook
 * for immediate, app-aware notification. The webhook receives owner + CC addresses.
 * If no webhook is configured, the incident remains visible/queued while Azure Monitor
 * Action Groups can send mail directly from the Log Analytics alert rule.
 */
async function notifyOwner(useCase, record, options = {}) {
  const notificationKind = options.notificationKind || 'outage';
  const dependency = record.lastError?.dependency || record.dependencyHealth?.failingDependency || null;
  const ownerEmail = useCase.ownerEmail || null;
  // Accept comma/semicolon-delimited environment configuration and always
  // send a JSON array to the Logic App. Exclude the primary recipient.
  const cc = String(OWNER_NOTIFICATION_CC || '')
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter((email) => email && email.toLowerCase() !== String(ownerEmail || '').toLowerCase());
  const displayStatus = (value) => ({ active: 'Available', inactive: 'Unavailable', stopped: 'Stopped / Down' }[String(value || '').toLowerCase()] || String(value || 'Unknown'));
  const payload = {
    // Keep the existing eventType for Logic App backward compatibility; the
    // notificationKind distinguishes recovery, stopped, and unavailable
    // transitions while retaining the existing eventType for compatibility.
    eventType: 'genai-playground-health-alert',
    notificationKind,
    previousStatus: options.previousStatus ? displayStatus(options.previousStatus) : null,
    currentStatus: displayStatus(record.status),
    severity: notificationKind === 'recovery' ? 'info' : (record.errorSeverity || 'urgent'),
    applicationId: useCase.id,
    application: useCase.title,
    applicationUrl: useCase.launchUrl,
    owner: useCase.owner || null,
    to: ownerEmail,
    ownerEmail,
    // Logic Apps / Office 365 Send an email (V2) commonly expects a
    // semicolon-delimited recipient string. Keep ccRecipients for workflows
    // that explicitly consume an array.
    cc: cc.join(';'),
    ccRecipients: cc,
    status: record.status,
    dependency,
    lastError: record.lastError || null,
    consecutiveFailures: record.consecutiveFailures || 0,
    lastChecked: record.lastChecked || new Date().toISOString(),
    remediation: record.remediation || null,
    subject: notificationKind === 'recovery'
      ? `[GenAI Playground] RECOVERED: "${useCase.title}" is Available`
      : notificationKind === 'stopped'
        ? `[GenAI Playground] STOPPED: "${useCase.title}" has been stopped`
        : `[GenAI Playground] ${String(record.status || 'alert').toUpperCase()}: "${useCase.title}" requires attention`,
  };

  if (!OWNER_NOTIFICATION_WEBHOOK_URL) {
    logIncident({
      useCaseId: useCase.id,
      solution: useCase.title,
      level: notificationKind === 'recovery' ? 'recovery_notification_pending' : 'notify_pending',
      severity: notificationKind === 'recovery' ? 'info' : (record.errorSeverity || 'urgent'),
      actionRequired: notificationKind !== 'recovery',
      message: `${notificationKind === 'recovery' ? 'Recovery notification' : 'Owner alert'} queued for ${useCase.owner || 'application owner'} <${useCase.ownerEmail || 'no email'}>; CC ${OWNER_NOTIFICATION_CC}. Email delivery is not configured. Set OWNER_NOTIFICATION_WEBHOOK_URL to the Logic App callback URL.`,
    });
    return { sent: false, reason: 'azure_notification_not_configured', provider: 'azure-native', ...payload };
  }

  try {
    const response = await fetch(OWNER_NOTIFICATION_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Notification webhook failed (${response.status}): ${body.slice(0, 300)}`);
    }
    const responseText = await response.text();
    let acknowledgement = null;
    if (responseText.trim()) {
      try {
        acknowledgement = JSON.parse(responseText);
      } catch {
        // A successful 2xx with a plain-text body is still an accepted Logic
        // App trigger. It is not proof that the downstream email action ran.
        acknowledgement = null;
      }
    }
    if (acknowledgement?.sent === false) {
      throw new Error('Logic App explicitly reported that the email was not sent.');
    }
    const deliveryAcknowledged = acknowledgement?.sent === true;
    logIncident({
      useCaseId: useCase.id,
      solution: useCase.title,
      level: notificationKind === 'recovery' ? 'recovery_notification_accepted' : 'notify_sent',
      severity: notificationKind === 'recovery' ? 'info' : (record.errorSeverity || 'urgent'),
      actionRequired: notificationKind !== 'recovery',
      message: deliveryAcknowledged
        ? `Logic App confirmed ${notificationKind} email delivery for ${useCase.owner || 'owner'} <${useCase.ownerEmail}>.`
        : `Logic App accepted the ${notificationKind} notification request (HTTP ${response.status}); downstream email delivery was not explicitly acknowledged.`,
    });
    return { sent: true, accepted: true, deliveryAcknowledged, provider: 'azure-webhook', httpStatus: response.status, ...payload };
  } catch (err) {
    logIncident({
      useCaseId: useCase.id,
      solution: useCase.title,
      level: notificationKind === 'recovery' ? 'recovery_notification_failed' : 'notify_failed',
      severity: notificationKind === 'recovery' ? 'info' : 'urgent',
      actionRequired: notificationKind !== 'recovery',
      message: `Failed to invoke Azure-native ${notificationKind} notification: ${err.message}`,
    });
    return { sent: false, reason: err.message, provider: 'azure-webhook', ...payload };
  }
}


async function notifyRecoveryOwner(useCase, record) {
  const transition = record?.recoveryTransition;
  if (!useCase?.ownerEmail || !transition?.key) return record;
  const saved = readRecoveryNotification(useCase.id);
  if (saved?.eventKey === transition.key && saved?.sent === true) return record;
  if (saved?.eventKey === transition.key && Number(saved?.nextRetryAt || 0) > Date.now()) return record;
  const lockId = `${useCase.id}-recovery`;
  const releaseLock = acquireOwnerNotificationLock(lockId);
  if (!releaseLock) return record;
  try {
    const latest = readRecoveryNotification(useCase.id);
    if (latest?.eventKey === transition.key && latest?.sent === true) return record;
    if (latest?.eventKey === transition.key && Number(latest?.nextRetryAt || 0) > Date.now()) return record;

    const attemptAt = new Date().toISOString();
    const result = await notifyOwner(useCase, {
      ...record,
      status: 'active',
      errorSeverity: 'info',
      actionRequired: false,
      lastError: null,
      remediation: null,
    }, {
      notificationKind: 'recovery',
      previousStatus: transition.previousStatus,
    });
    const sent = result?.sent === true;
    writeRecoveryNotification(useCase.id, {
      eventKey: transition.key,
      sent,
      accepted: result?.accepted === true,
      deliveryAcknowledged: result?.deliveryAcknowledged === true,
      at: attemptAt,
      to: useCase.ownerEmail,
      reason: result?.reason || null,
      // Retry a failed/missing webhook later, but avoid an email storm every
      // health cycle. A successful webhook acceptance is deduplicated forever
      // for this specific recovery transition.
      nextRetryAt: sent ? null : Date.now() + 5 * 60 * 1000,
    });
    logIncident({
      useCaseId: useCase.id,
      solution: useCase.title,
      level: sent ? 'recovery_notification_accepted' : 'recovery_notification_pending',
      severity: 'info',
      actionRequired: false,
      message: sent
        ? `Recovery notification accepted for ${useCase.ownerEmail} (${transition.previousStatus} → Available).`
        : `Recovery notification could not be delivered for ${useCase.ownerEmail}: ${result?.reason || 'notification webhook is not configured'}.`,
    });
    return record;
  } finally {
    releaseLock();
  }
}

async function maybeNotifyOwner(useCase, record, previousRecord) {
  if (!useCase.ownerEmail) return record;

  // Never email an owner for a one-cycle transient probe failure. This guard
  // is deliberately at the notification boundary because several independent
  // paths (HTTP probes, access restrictions and telemetry reconciliation) can
  // call maybeNotifyOwner(). A confirmed dependency/configuration incident or
  // an Azure-confirmed Stopped state remains immediately actionable.
  const notificationProbe = {
    statusCode: record?.probeStatusCode ?? record?.statusCode,
    errorType: record?.probeErrorType || record?.lastError?.errorType,
  };
  const transientUnconfirmed = record?.status === 'inactive' &&
    isTransientProbeFailure(notificationProbe) &&
    Number(record?.consecutiveFailures || 0) < HEALTH_FAILURE_CONFIRMATION_CYCLES &&
    record?.dependencyIncidentLatched !== true &&
    !['azure_app_settings', 'azure_monitor'].includes(String(record?.statusSource || ''));
  if (transientUnconfirmed) {
    record.lastNotification = readOwnerNotification(useCase.id) || record.lastNotification || null;
    return record;
  }

  if (notificationInFlightIds.has(useCase.id)) {
    record.lastNotification = readOwnerNotification(useCase.id) || record.lastNotification || null;
    return record;
  }
  notificationInFlightIds.add(useCase.id);
  let releaseLock;
  try {
    releaseLock = acquireOwnerNotificationLock(useCase.id);
    if (!releaseLock) {
      record.lastNotification =
        readOwnerNotification(useCase.id) ||
        healthStore.get(useCase.id)?.lastNotification ||
        record.lastNotification ||
        null;
      return record;
    }

    const persistedRecord = healthStore.get(useCase.id);
    const savedNotification = readOwnerNotification(useCase.id);
    const last =
      savedNotification ||
      persistedRecord?.lastNotification ||
      previousRecord?.lastNotification ||
      record.lastNotification;
    const previousRecipient = String(last?.to || last?.ownerEmail || '').trim().toLowerCase();
    const currentRecipient = String(useCase.ownerEmail || '').trim().toLowerCase();
    const ownerChangedSinceLastNotification = Boolean(
      currentRecipient && previousRecipient !== currentRecipient
    );
    const isLegacyUnconfirmedWebhookSuccess = !savedNotification &&
      last?.sent === true &&
      last?.provider === 'azure-webhook' &&
      last?.deliveryAcknowledged !== true;
    // A prior alert to a different owner must not suppress delivery to the
    // newly configured owner. Continue deduplicating for the same recipient.
    // Deduplicate per state, not per application forever. A previously sent
    // Unavailable alert must not suppress a later Stopped transition (and vice
    // versa). Recovery uses its own transition key and notification store.
    const lastNotifiedStatus = String(last?.status || '').toLowerCase();
    const currentStatus = String(record?.status || '').toLowerCase();
    const sameStateAlreadyDelivered = last?.sent === true &&
      lastNotifiedStatus &&
      lastNotifiedStatus === currentStatus;
    const legacyStateUnknown = last?.at && !last?.status;
    if ((sameStateAlreadyDelivered || legacyStateUnknown) &&
        !isLegacyUnconfirmedWebhookSuccess && !ownerChangedSinceLastNotification) {
      if (!savedNotification) writeOwnerNotification(useCase.id, last);
      record.lastNotification = last;
      return record;
    }
    if (isLegacyUnconfirmedWebhookSuccess) {
      logIncident({
        useCaseId: useCase.id,
        solution: useCase.title,
        level: 'notify_pending',
        severity: record.errorSeverity || 'high',
        actionRequired: true,
        message: 'Retrying one legacy owner alert because the previous backend version recorded webhook acceptance without verifying email delivery.',
      });
    }

    const attemptAt = new Date().toISOString();
    record.lastNotification = { sent: false, reason: 'notification_attempt_in_progress', at: attemptAt, to: useCase.ownerEmail };
    writeOwnerNotification(useCase.id, record.lastNotification);
    persistOwnerNotification(useCase.id, record.lastNotification, record);
    persistLastNotification(useCase.id, record.lastNotification);

    const notification = await notifyOwner(useCase, record, {
      notificationKind: record.status === 'stopped' ? 'stopped' : 'outage',
      previousStatus: previousRecord?.status || null,
    });
    record.lastNotification = { ...notification, at: attemptAt };
    writeOwnerNotification(useCase.id, record.lastNotification);
    persistOwnerNotification(useCase.id, record.lastNotification, record);
    persistLastNotification(useCase.id, record.lastNotification);
    return record;
  } catch (err) {
    logIncident({
      useCaseId: useCase.id,
      solution: useCase.title,
      level: 'notify_failed',
      severity: 'urgent',
      actionRequired: true,
      message: `Unable to claim or persist the owner notification: ${err.message}`,
    });
    return record;
  } finally {
    if (releaseLock) releaseLock();
    notificationInFlightIds.delete(useCase.id);
  }
}

/**
 * Run the full pipeline for one use case:
 *   probe -> if auth-restricted, stop unless this app requires a verified probe ->
 *   otherwise if failing, auto-fix retries -> if still failing, notify owner
 *
 * Guarded against re-entrancy: if a check for this useCase.id is already
 * in flight (from the background sweep or another manual click), this
 * call waits for it and returns that result instead of starting a second,
 * overlapping probe/retry/notify cycle against the same app.
 */
async function runCheck(useCase) {
  if (inFlightIds.has(useCase.id)) {
    // Poll briefly for the in-flight check to finish rather than starting
    // a duplicate one. Simple and sufficient at this app's scale/traffic.
    while (inFlightIds.has(useCase.id)) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(200);
    }
    return healthStore.get(useCase.id);
  }
  inFlightIds.add(useCase.id);
  try {
    return await runCheckInternal(useCase);
  } finally {
    inFlightIds.delete(useCase.id);
  }
}

function unavailableProbeHealthRecord(useCase, result, current, autoFixAttempts = []) {
  const knownStatusCode = Number(current?.statusCode || current?.lastError?.statusCode);
  const reportedStatusCode = knownStatusCode >= 500 && knownStatusCode <= 599
    ? knownStatusCode
    : result.statusCode;
  const monitoringNote = knownStatusCode >= 500 && knownStatusCode <= 599 && result.statusCode !== knownStatusCode
    ? `Application is Unavailable based on observed HTTP ${knownStatusCode}; the health monitor's latest probe received HTTP ${result.statusCode}.`
    : `Application URL could not be accessed by the health monitor (HTTP ${reportedStatusCode || 'no response'}); it is classified as Unavailable.`;
  return {
    ...current,
    id: useCase.id,
    title: useCase.title,
    launchUrl: useCase.launchUrl,
    status: 'inactive',
    lastChecked: new Date().toISOString(),
    latencyMs: result.latencyMs ?? current?.latencyMs ?? null,
    statusCode: reportedStatusCode ?? null,
    probeStatusCode: result.statusCode ?? null,
    probeErrorType: result.errorType || null,
    probeAccessRestrictedByAzure: result.accessRestrictedByAzure === true,
    probeObservedAt: new Date().toISOString(),
    consecutiveFailures: (current?.status === 'degraded' || current?.status === 'inactive' ? current.consecutiveFailures || 0 : 0) + 1,
    lastError: {
      errorType: reportedStatusCode ? 'http_error' : (result.errorType || 'network_error'),
      errorMessage: monitoringNote,
      statusCode: reportedStatusCode ?? null,
      probeStatusCode: result.statusCode ?? null,
    },
    errorSeverity: 'critical',
    actionRequired: true,
    remediation: 'Restore application URL availability',
    monitoringNote,
    autoFixAttempts,
    owner: useCase.owner || null,
    ownerEmail: useCase.ownerEmail || null,
    dependencyIncidentLatched: Boolean(current?.dependencyIncidentLatched),
    statusSource: 'http_probe_unavailable',
    telemetryObservedAt: null,
    lastRecoveryCheckAt: null,
  };
}

// HTTP 403 is ambiguous: App Service access restrictions can block the
// monitoring worker before the request reaches the application. A 403 alone
// is therefore not proof that the application is unavailable and must not
// create an incident email. Prefer ARM runtime evidence; otherwise retain the
// last confirmed state until application telemetry or an approved health probe
// establishes a real failure. This prevents one-cycle INACTIVE/ACTIVE flapping.
function inconclusiveForbiddenProbeRecord(useCase, result, current, runtime = null) {
  const now = new Date().toISOString();
  const armState = String(runtime?.state || '').toLowerCase();
  let status = current?.status || 'active';
  if (runtime?.available && ['stopped', 'stopping'].includes(armState)) status = 'stopped';
  else if (runtime?.available && ['running', 'started'].includes(armState) &&
      !current?.dependencyIncidentLatched && current?.status !== 'inactive') status = 'active';

  const record = {
    ...(current || {}),
    id: useCase.id,
    title: useCase.title,
    launchUrl: useCase.launchUrl,
    status,
    lastChecked: now,
    probeStatusCode: 403,
    statusCode: 403,
    probeErrorType: 'access_restricted_or_forbidden',
    probeObservedAt: now,
    probeAccessRestrictedByAzure: result?.accessRestrictedByAzure === true,
    pendingProbeFailure: false,
    // Do not increment consecutive application failures for an ambiguous
    // monitoring-worker 403. Keep the previous incident counters unchanged.
    consecutiveFailures: Number(current?.consecutiveFailures || 0),
    monitoringNote: runtime?.available
      ? `Health probe received HTTP 403, but Azure Resource Manager reports the App Service is ${armState}. The 403 is treated as a monitoring/access-policy limitation, not an application outage. No owner alert was generated.`
      : 'Health probe received HTTP 403. This response alone cannot distinguish an application authorization response from an App Service access restriction. The last confirmed application state is retained; no Unavailable transition or owner alert is generated until independent application telemetry or runtime evidence confirms a failure.',
    statusSource: current?.statusSource || 'probe_inconclusive_403',
    owner: useCase.owner || current?.owner || null,
    ownerEmail: useCase.ownerEmail || current?.ownerEmail || null,
    actionRequired: current?.actionRequired === true,
  };
  healthStore.set(useCase.id, record);
  return record;
}

async function restrictedProbeHealthRecord(useCase, result, current, autoFixAttempts = []) {
  const record = unavailableProbeHealthRecord(useCase, result, current, autoFixAttempts);
  record.probeAccessRestrictedByAzure = result.accessRestrictedByAzure === true;
  record.probeErrorType = result.errorType || null;
  record.probeObservedAt = new Date().toISOString();
  record.monitoringNote = `The health probe received HTTP ${result.statusCode}; application availability cannot be confirmed.`;
  record.lastError = { ...record.lastError, errorMessage: record.monitoringNote };
  healthStore.set(useCase.id, record);
  if (current?.status !== 'inactive') {
    logIncident({
      useCaseId: useCase.id,
      solution: useCase.title,
      level: 'error',
      severity: 'critical',
      actionRequired: true,
      message: `Application is unavailable: health probe received HTTP ${result.statusCode}.`,
      httpStatus: result.statusCode,
    });
  }
  await maybeNotifyOwner(useCase, record, current);
  return healthStore.get(useCase.id) || record;
}

async function resolveAzureAccessRestrictedProbe(useCase, result, current, autoFixAttempts = [], requiredSettings = null) {
  // A platform-generated 403 means this monitoring worker is outside the
  // App Service allow-list; it does not establish that the user-facing app is
  // broken. First synchronously reconcile fresh application telemetry so a
  // real Neo4j/OpenAI/backend failure always wins over the restricted probe.
  let telemetryCheck = { configured: false, querySucceeded: false, apps: null, reason: 'Log Analytics workspace is not configured.' };
  try {
    telemetryCheck = await monitorApplicationLogs([useCase], STATUS_LOG_WINDOW_MINUTES);
  } catch (err) {
    telemetryCheck = { configured: true, querySucceeded: false, apps: null, reason: err.message };
    console.warn(`[adminHealth] Could not reconcile telemetry after access-restricted probe for ${useCase.id}: ${err.message}`);
  }
  const telemetryVerifiedForApp = telemetryCheck?.querySucceeded === true &&
    telemetryCheck?.configured === true &&
    telemetryCheck?.apps &&
    Object.prototype.hasOwnProperty.call(telemetryCheck.apps, useCase.id);

  const latest = healthStore.get(useCase.id) || current || {};
  if (latest.status === 'active' &&
      ['telemetry_and_configuration_recovery', 'telemetry_recovery'].includes(latest.statusSource) &&
      !getPersistentLatch(useCase.id)) {
    // The telemetry reconciler has already confirmed consecutive clean cycles.
    // Do not let this same blocked public probe overwrite that recovery result.
    return latest;
  }
  // Preserve a first clean telemetry cycle. The previous implementation
  // immediately replaced recovery_validation with restrictedProbeHealthRecord
  // when ARM runtime lookup failed, resetting the next cycle's eligibility.
  if (latest.status === 'inactive' &&
      latest.statusSource === 'recovery_validation' &&
      Number(latest.recoverySuccessCycles || 0) > 0) {
    return latest;
  }
  const persistentLatch = getPersistentLatch(useCase.id);
  const freshnessWindowMs = Math.max(5 * 60 * 1000, ACTIONABLE_ERROR_FRESHNESS_MS);
  const telemetryAt = new Date(latest.telemetryObservedAt || 0).getTime();
  const latestErrorAt = new Date(latest.lastError?.timeGenerated || latest.lastError?.timestamp || 0).getTime();
  const hasFreshAzureMonitorFailure = latest.statusSource === 'azure_monitor' &&
    latest.dependencyIncidentLatched === true &&
    !isLifecycleOnlyStoppedError(latest.lastError) &&
    ['inactive', 'degraded', 'stopped'].includes(latest.status) &&
    Number.isFinite(telemetryAt) && telemetryAt > 0 &&
    Date.now() - telemetryAt <= freshnessWindowMs;
  const persistedFailureAt = new Date(
    persistentLatch?.lastError?.timeGenerated ||
    persistentLatch?.lastError?.timestamp ||
    persistentLatch?.detectedAt ||
    0
  ).getTime();
  const hasFreshPersistedFailure = Boolean(persistentLatch?.active) &&
    !isLifecycleOnlyStoppedError(persistentLatch.lastError) &&
    ['inactive', 'degraded', 'stopped'].includes(persistentLatch.status || 'inactive') &&
    Number.isFinite(persistedFailureAt) && persistedFailureAt > 0 &&
    Date.now() - persistedFailureAt <= freshnessWindowMs;
  const hasFreshDependencyError = latest.status === 'inactive' &&
    latest.statusSource === 'azure_monitor' &&
    !isLifecycleOnlyStoppedError(latest.lastError) &&
    /neo4j|serviceunavailable|failed to dns resolve|name or service not known|bolt/i.test(
      `${latest.lastError?.errorMessage || ''} ${(latest.azureErrors || []).map(e => e.Message || '').join(' ')}`
    ) &&
    Number.isFinite(latestErrorAt) && latestErrorAt > 0 &&
    Date.now() - latestErrorAt <= freshnessWindowMs;
  // A blocked public probe must never clear a confirmed dependency incident.
  // Check both the in-memory health record and the persisted incident latch:
  // the latter survives worker restarts and protects against concurrent probes.
  if (hasFreshAzureMonitorFailure || hasFreshPersistedFailure || hasFreshDependencyError) {
    const failure = hasFreshAzureMonitorFailure || hasFreshDependencyError ? latest : {
      ...latest,
      status: 'inactive',
      statusSource: 'azure_monitor',
      dependencyIncidentLatched: true,
      errorSeverity: 'critical',
      lastError: persistentLatch.lastError || latest.lastError || {
        errorType: 'dependency_failure',
        errorMessage: 'A previously confirmed application/dependency failure remains active; the public health probe is blocked by App Service access restrictions.',
      },
      dependencyHealth: persistentLatch.dependencyHealth || latest.dependencyHealth || {
        status: 'unhealthy',
        failingDependency: 'Application dependency',
        category: 'dependency',
      },
      azureErrors: persistentLatch.azureErrors || latest.azureErrors || [],
      monitoringNote: 'Azure App Service access restrictions blocked the monitoring worker (HTTP 403). A fresh, unresolved Azure Monitor dependency incident remains active, so the application stays Unavailable.',
    };
    healthStore.set(useCase.id, failure);
    // If ownership changed while this incident was already active, deliver the
    // existing unresolved incident to the new owner (recipient-aware dedupe
    // prevents duplicate sends to the same owner).
    await maybeNotifyOwner(useCase, failure, current || latest);
    return failure;
  }

  // Resume Creator has an explicit, mapped frontend + backend runtime contract
  // and a required Azure OpenAI setting. When the public probe is blocked by an
  // App Service access restriction, use ARM runtime + setting-presence evidence
  // to complete Stopped -> Available recovery. A blocked probe alone must not
  // strand a successfully restarted app in Unavailable. This fallback is
  // intentionally limited to apps with required setting groups; apps such as
  // Advisor Intelligence still require fresh telemetry to protect Neo4j failure
  // detection.
  const hasExplicitRuntimeRecoveryContract =
    useCase.allowRuntimeRecoveryWhenProbeBlocked === true &&
    Array.isArray(useCase.recoveryRuntimeRoles) &&
    useCase.recoveryRuntimeRoles.length > 0 &&
    Array.isArray(useCase.requiredAppSettingGroups) &&
    useCase.requiredAppSettingGroups.length > 0;
  if (result.accessRestrictedByAzure === true &&
      hasExplicitRuntimeRecoveryContract &&
      requiredSettings?.ok === true &&
      requiredSettings?.unknown !== true &&
      !hasFreshPersistedFailure &&
      !hasFreshAzureMonitorFailure &&
      !hasFreshDependencyError) {
    const runtimeEvidence = await getMappedAppServiceRuntimeEvidence(
      useCase,
      useCase.recoveryRuntimeRoles,
    );
    if (runtimeEvidence.ok) {
      const recovered = {
        ...(healthStore.get(useCase.id) || latest || {}),
        id: useCase.id,
        title: useCase.title,
        launchUrl: useCase.launchUrl,
        status: 'active',
        statusCode: 403,
        probeStatusCode: 403,
        probeAccessRestrictedByAzure: true,
        lastChecked: new Date().toISOString(),
        consecutiveFailures: 0,
        lastError: null,
        errorSeverity: null,
        actionRequired: false,
        remediation: null,
        dependencyHealth: null,
        dependencyIncidentLatched: false,
        azureErrors: [],
        recoverySuccessCycles: 0,
        statusSource: 'runtime_and_configuration_recovery',
        monitoringNote: 'Recovery verified: Azure Resource Manager confirms the mapped frontend and backend App Services are running, required application settings are present, and no fresh confirmed application/dependency failure is latched. The monitoring worker is blocked by the App Service access restriction, so the public URL could not be directly probed.',
        owner: useCase.owner || null,
        ownerEmail: useCase.ownerEmail || null,
        lastNotification: null,
      };
      clearPersistentLatch(useCase.id);
      clearOwnerNotification(useCase.id);
      healthStore.set(useCase.id, recovered);
      logIncident({
        useCaseId: useCase.id,
        solution: useCase.title,
        level: 'resolved',
        severity: 'info',
        actionRequired: false,
        message: 'Recovery verified using ARM runtime state and required backend application-setting presence; the public health probe remains blocked by App Service access restrictions.',
      });
      return recovered;
    }
  }

  // Resume Creator may have been marked Stopped by an earlier platform
  // splash-page response. When the worker itself receives an access-restricted
  // 403, a Stopped lifecycle record may recover only after a fresh per-app
  // Log Analytics query is clean and ARM confirms every mapped role is Running.
  // An App Settings-list 403 remains explicitly unverified (not missing); keep
  // that limitation visible instead of allowing the old Stopped state to stick.
  if (latest.status === 'stopped' &&
      result.accessRestrictedByAzure === true &&
      useCase.allowRuntimeRecoveryWhenProbeBlocked === true &&
      requiredSettings?.unknown === true &&
      telemetryVerifiedForApp &&
      !hasFreshPersistedFailure &&
      !hasFreshAzureMonitorFailure &&
      !hasFreshDependencyError &&
      (!latest.dependencyIncidentLatched || isLifecycleOnlyStoppedError(latest.lastError))) {
    let runtimeEvidence = { ok: false, reason: 'Mapped App Service runtime verification not completed.' };
    try {
      runtimeEvidence = await getMappedAppServiceRuntimeEvidence(
        useCase,
        useCase.recoveryRuntimeRoles || [],
      );
    } catch (err) {
      runtimeEvidence = { ok: false, reason: err.message };
    }
    if (runtimeEvidence.ok) {
      const recovered = {
        ...latest,
        id: useCase.id,
        title: useCase.title,
        launchUrl: useCase.launchUrl,
        status: 'active',
        statusCode: 403,
        probeStatusCode: 403,
        probeAccessRestrictedByAzure: true,
        lastChecked: new Date().toISOString(),
        consecutiveFailures: 0,
        lastError: null,
        errorSeverity: null,
        actionRequired: false,
        remediation: null,
        dependencyIncidentLatched: false,
        dependencyHealth: null,
        azureErrors: [],
        recoverySuccessCycles: 0,
        statusSource: 'runtime_and_telemetry_recovery',
        configurationValidation: {
          status: 'inconclusive',
          checkedAt: new Date().toISOString(),
          requiredGroups: (useCase.requiredAppSettingGroups || []).map((group) => group.name || 'Required setting'),
          warnings: requiredSettings.inspectionWarnings || [],
        },
        monitoringNote: `Resume Creator recovered from Stopped: Azure Resource Manager confirms all mapped App Services are Running and the current Log Analytics query returned no actionable application/dependency failures. App Service settings inspection remains inconclusive (${requiredSettings.monitoringNote || 'Azure configuration access is restricted'}); this does not prove that the Azure OpenAI credential is valid.`,
        owner: useCase.owner || latest.owner || null,
        ownerEmail: useCase.ownerEmail || latest.ownerEmail || null,
        lastNotification: null,
      };
      clearPersistentLatch(useCase.id);
      clearOwnerNotification(useCase.id);
      healthStore.set(useCase.id, recovered);
      logIncident({
        useCaseId: useCase.id,
        solution: useCase.title,
        level: 'resolved',
        severity: 'info',
        actionRequired: false,
        message: 'Stopped lifecycle state cleared after ARM confirmed all mapped App Services Running and Log Analytics returned a clean current result. Required settings inspection remains inconclusive.',
      });
      return recovered;
    }
  }

  // If ARM or required-setting inspection is inconclusive, do not manufacture
  // an Unavailable transition from the monitor's own 403. Retain the last
  // confirmed state and surface the precise monitoring limitation.
  if (result.accessRestrictedByAzure === true &&
      hasExplicitRuntimeRecoveryContract &&
      (!requiredSettings || requiredSettings.unknown === true || requiredSettings.ok !== true) &&
      !hasFreshPersistedFailure &&
      !hasFreshAzureMonitorFailure &&
      !hasFreshDependencyError) {
    const retained = {
      ...(healthStore.get(useCase.id) || latest || {}),
      id: useCase.id,
      title: useCase.title,
      launchUrl: useCase.launchUrl,
      status: ['active', 'stopped'].includes((healthStore.get(useCase.id) || latest || {}).status)
        ? (healthStore.get(useCase.id) || latest || {}).status
        : 'checking',
      lastChecked: new Date().toISOString(),
      probeStatusCode: 403,
      probeAccessRestrictedByAzure: true,
      owner: useCase.owner || null,
      ownerEmail: useCase.ownerEmail || null,
      monitoringNote: requiredSettings?.monitoringNote ||
        requiredSettings?.inspectionWarnings?.map((item) => item.message).join(' ') ||
        'Azure runtime/configuration verification is inconclusive. The monitoring worker received HTTP 403, which is not sufficient evidence to mark the application Unavailable.',
    };
    healthStore.set(useCase.id, retained);
    return retained;
  }

  // Telemetry-first recovery for apps configured to tolerate a blocked public
  // probe. monitorApplicationLogs() above has just performed a fresh query and
  // reconciled the dependency incident. Do not fall through to the older
  // requireSuccessfulHealthProbe / ARM-runtime gates: those gates can overwrite
  // a valid telemetry recovery with Unavailable when the monitor's own IP is
  // blocked by App Service access restrictions.
  if (useCase.allowTelemetryRecoveryWhenProbeBlocked === true && telemetryVerifiedForApp) {
    const reconciled = healthStore.get(useCase.id) || latest;
    if (reconciled.status === 'active' &&
        ['telemetry_and_configuration_recovery', 'telemetry_recovery',
         'azure_runtime_access_restricted', 'azure_access_restriction_unverified'].includes(reconciled.statusSource) &&
        !getPersistentLatch(useCase.id)) {
      reconciled.monitoringNote =
        'Monitoring note: Azure App Service access restrictions returned HTTP 403 to the monitoring worker. The application is Available based on successful health/runtime or Log Analytics evidence with no active critical application/dependency incident. The public URL could not be directly verified by this worker.';
      return reconciled;
    }
    if (reconciled.status === 'inactive' &&
        reconciled.statusSource === 'recovery_validation' &&
        Number(reconciled.recoverySuccessCycles || 0) > 0) {
      // Keep the first clean cycle intact; the next successful Log Analytics
      // reconciliation will complete the configured recovery threshold.
      return reconciled;
    }
    const latch = getPersistentLatch(useCase.id);
    if (!latch && !reconciled.dependencyIncidentLatched) {
      const recovered = {
        ...reconciled,
        id: useCase.id,
        title: useCase.title,
        launchUrl: useCase.launchUrl,
        status: 'active',
        statusCode: 403,
        probeStatusCode: 403,
        probeAccessRestrictedByAzure: true,
        lastChecked: new Date().toISOString(),
        consecutiveFailures: 0,
        lastError: null,
        errorSeverity: null,
        actionRequired: false,
        remediation: null,
        dependencyHealth: null,
        statusSource: 'azure_access_restriction_unverified',
        monitoringNote: 'Monitoring note: Azure App Service access restrictions returned HTTP 403 to the monitoring worker. The application is Available based on a successful Log Analytics reconciliation with no active critical application/dependency incident. The public URL could not be directly verified by this worker.',
        lastNotification: null,
      };
      healthStore.set(useCase.id, recovered);
      return recovered;
    }
    // An active persisted incident remains Unavailable until the telemetry
    // reconciler completes its configured consecutive-clean-cycle threshold.
    return reconciled;
  }

  // A missing workspace, failed query, or missing per-app result is not a
  // clean telemetry cycle. Never infer Available from the absence of errors
  // when the monitoring query did not actually complete for this application.
  if (useCase.allowTelemetryRecoveryWhenProbeBlocked === true && !telemetryVerifiedForApp) {
    const armEvidence = await getAzureAppServiceRuntimeState(useCase);
    return inconclusiveForbiddenProbeRecord(useCase, result, latest, armEvidence);
  }

  // Some applications explicitly require a successful application-level
  // health probe before they may be reported Available. Advisor Intelligence
  // had this contract in the earlier working configuration. If Azure blocks
  // the monitor with a platform 403, an ARM "running" state is not sufficient:
  // it proves the worker process is started, not that Neo4j-backed workflows
  // are functioning. Confirmed telemetry failures above take precedence.
  if (useCase.requireSuccessfulHealthProbe === true) {
    const armEvidence = await getAzureAppServiceRuntimeState(useCase);
    return inconclusiveForbiddenProbeRecord(useCase, result, latest, armEvidence);
  }

  // Do not special-case individual applications here. A platform-generated
  // access-restriction 403 is reconciled uniformly: fresh actionable app or
  // dependency telemetry wins; otherwise an ARM-confirmed running App Service
  // is Available because the 403 was generated before the request reached it.
  const runtime = await getAzureAppServiceRuntimeState(useCase);
  const mappedRecoveryEvidence = useCase.allowRuntimeRecoveryWhenProbeBlocked === true
    ? await getMappedAppServiceRuntimeEvidence(useCase, useCase.recoveryRuntimeRoles || [])
    : null;
  const runtimeConfirmedHealthy = mappedRecoveryEvidence
    ? mappedRecoveryEvidence.ok
    : runtime.available && ['running', 'started'].includes(runtime.state);
  if (runtimeConfirmedHealthy) {
    const recovered = {
      ...latest,
      id: useCase.id,
      title: useCase.title,
      launchUrl: useCase.launchUrl,
      status: 'active',
      lastChecked: new Date().toISOString(),
      latencyMs: result.latencyMs ?? latest.latencyMs ?? null,
      statusCode: 403,
      probeStatusCode: 403,
      probeDiagnostics: result.probeDiagnostics || null,
      consecutiveFailures: 0,
      lastError: null,
      errorSeverity: null,
      actionRequired: false,
      remediation: null,
      dependencyIncidentLatched: false,
      dependencyHealth: null,
      autoFixAttempts,
      monitoringNote: `Monitoring note: Azure App Service access restrictions returned HTTP 403 to the monitoring worker. The application is Available based on ${mappedRecoveryEvidence ? `Azure runtime verification (${mappedRecoveryEvidence.states.map((item) => `${item.role}: ${item.state}`).join(', ')})` : 'Azure runtime verification'} and a successful Log Analytics check with no recent actionable or critical application/dependency errors. The public URL could not be directly verified by this worker.`,
      statusSource: 'azure_runtime_access_restricted',
      owner: useCase.owner || null,
      ownerEmail: useCase.ownerEmail || null,
      lastNotification: null,
    };
    clearPersistentLatch(useCase.id);
    clearOwnerNotification(useCase.id);
    healthStore.set(useCase.id, recovered);
    return recovered;
  }

  // If the response is positively identified as an Azure App Service
  // access-restriction page, the request was blocked before it reached the
  // application. Do not mark every application Unavailable merely because
  // the monitoring worker's IP is not on the allow-list or ARM read access is
  // unavailable. Fresh application/dependency telemetry above still wins.
  // Stopped applications are detected separately from the Azure stopped page
  // or ARM state when the required read permission is available.
  if (result.accessRestrictedByAzure) {
    if (!telemetryVerifiedForApp) {
      return inconclusiveForbiddenProbeRecord(useCase, result, latest, runtime);
    }
    if (useCase.allowRuntimeRecoveryWhenProbeBlocked === true) {
      const unavailable = await restrictedProbeHealthRecord(useCase, result, latest, autoFixAttempts);
      unavailable.monitoringNote = `Monitoring note: Azure App Service access restrictions returned HTTP 403 to the monitoring worker. The application remains Unavailable because required Azure runtime verification failed (${mappedRecoveryEvidence?.reason || runtime.reason || 'runtime state unavailable'}); no verified recovery evidence is available.`;
      if (unavailable.lastError) unavailable.lastError.errorMessage = unavailable.monitoringNote;
      healthStore.set(useCase.id, unavailable);
      return unavailable;
    }
    const accessRestrictedAvailable = {
      ...latest,
      id: useCase.id,
      title: useCase.title,
      launchUrl: useCase.launchUrl,
      status: 'active',
      lastChecked: new Date().toISOString(),
      latencyMs: result.latencyMs ?? latest.latencyMs ?? null,
      statusCode: 403,
      probeStatusCode: 403,
      probeDiagnostics: result.probeDiagnostics || null,
      consecutiveFailures: 0,
      lastError: null,
      errorSeverity: null,
      actionRequired: false,
      remediation: null,
      dependencyIncidentLatched: false,
      dependencyHealth: null,
      monitoringNote: `Monitoring note: Azure App Service access restrictions returned HTTP 403 to the monitoring worker. The application is Available based on a successful Log Analytics check with no recent actionable or critical application/dependency errors. Azure runtime verification was unavailable (${runtime.reason || 'unknown ARM error'}), and the public URL could not be directly verified by this worker.`,
      statusSource: 'azure_access_restriction_unverified',
      owner: useCase.owner || null,
      ownerEmail: useCase.ownerEmail || null,
      lastNotification: null,
    };
    clearPersistentLatch(useCase.id);
    clearOwnerNotification(useCase.id);
    healthStore.set(useCase.id, accessRestrictedAvailable);
    return accessRestrictedAvailable;
  }

  // A generic HTTP 401/403 (not positively identified as an Azure platform
  // access-restriction page) remains an application URL/authentication failure.
  // A generic 403 without positive Azure-platform fingerprints is still
  // ambiguous. Do not send a critical outage email from a single unauthenticated
  // probe. Keep the last confirmed state and rely on application telemetry or
  // an authenticated health endpoint to establish an actual authorization fault.
  return inconclusiveForbiddenProbeRecord(useCase, result, latest, runtime);
}

function scheduleApplicationLogMonitoring(useCase) {
  void monitorApplicationLogs([useCase], STATUS_LOG_WINDOW_MINUTES).catch(err => {
    console.error(`[adminHealth] Background log reconciliation failed for ${useCase.id}:`, err);
  });
}


function canRecoverStoppedWithInconclusiveSettings({ current, probeResult, requiredSettings, telemetryCheck, runtimeEvidence, hasActiveIncident }) {
  const probeIsUsable = probeResult?.ok === true ||
    (probeResult?.authRestricted === true && probeResult?.accessRestrictedByAzure === true);
  return current?.status === 'stopped' &&
    probeIsUsable &&
    requiredSettings?.unknown === true &&
    telemetryCheck?.configured === true &&
    telemetryCheck?.querySucceeded === true &&
    Boolean(telemetryCheck?.apps && Object.prototype.hasOwnProperty.call(telemetryCheck.apps, current.id)) &&
    runtimeEvidence?.ok === true &&
    hasActiveIncident !== true;
}

/**
 * A 403 page that contains Azure's stopped-app wording is only a probe hint.
 * For applications with explicit frontend/backend mappings, classify Stopped
 * only when ARM successfully reports at least one required role as stopped
 * and returns a known runtime state for every required role. If all required
 * roles are Running, the 403 is an access/probe restriction, not an outage.
 * Incomplete ARM evidence is deliberately inconclusive (never Stopped).
 */
function reconcileStoppedProbeAgainstMappedRuntime(runtimeEvidence, requiredRoles = []) {
  const roles = (Array.isArray(requiredRoles) ? requiredRoles : [])
    .map((role) => String(role || '').toLowerCase()).filter(Boolean);
  const states = Array.isArray(runtimeEvidence?.states) ? runtimeEvidence.states : [];
  if (!roles.length) return { classification: 'unverified', reason: 'No mapped runtime roles configured.' };
  const required = roles.map((role) => states.find((item) => String(item.role || '').toLowerCase() === role));
  if (required.some((item) => !item || !item.state || item.available === false && !['stopped', 'stopping'].includes(String(item.state).toLowerCase()))) {
    return { classification: 'unverified', reason: runtimeEvidence?.reason || 'One or more mapped App Service runtime states could not be verified.' };
  }
  const stopped = required.filter((item) => ['stopped', 'stopping'].includes(String(item.state).toLowerCase()));
  if (stopped.length) {
    return { classification: 'stopped', reason: stopped.map((item) => `${item.role}: ${item.state}`).join(', ') };
  }
  if (required.every((item) => item.available === true && ['running', 'started'].includes(String(item.state).toLowerCase()))) {
    return { classification: 'running', reason: null };
  }
  return { classification: 'unverified', reason: 'Mapped App Service runtime evidence is incomplete.' };
}

async function runCheckInternal(useCase) {
  if (!useCase.launchUrl) {
    const record = {
      id: useCase.id, title: useCase.title, launchUrl: null,
      status: 'unknown', lastChecked: new Date().toISOString(),
      latencyMs: null, statusCode: null, consecutiveFailures: 0,
      lastError: null, autoFixAttempts: [], lastNotification: null,
      owner: useCase.owner || null, ownerEmail: useCase.ownerEmail || null,
    };
    healthStore.set(useCase.id, record);
    return record;
  }

  const prev = healthStore.get(useCase.id);
  const probeStartedAt = Date.now();
  let result = await probe(useCase.launchUrl);

  // Rehydrate the in-memory health record from the persisted incident latch
  // after an App Service worker restart/deployment. Without this seed,
  // monitorApplicationLogs sees no lastChecked timestamp on the first check,
  // so availabilityCheckIsFresh is false forever and a clean telemetry cycle
  // can never count toward recovery. The current probe observation is written
  // even when this worker has no prior in-memory record.
  const persistedIncident = !prev ? getPersistentLatch(useCase.id) : null;
  const probeBase = prev || (persistedIncident ? {
    id: useCase.id,
    title: useCase.title,
    launchUrl: useCase.launchUrl,
    status: 'inactive',
    statusSource: 'azure_monitor',
    dependencyIncidentLatched: true,
    actionRequired: true,
    lastError: persistedIncident.lastError || null,
    errorSeverity: persistedIncident.errorSeverity || 'critical',
    remediation: persistedIncident.remediation || 'owner_alert',
    dependencyHealth: persistedIncident.dependencyHealth || null,
    azureErrors: persistedIncident.azureErrors || [],
    lastNotification: persistedIncident.lastNotification || null,
    recoverySuccessCycles: Number(persistedIncident.recoverySuccessCycles || 0),
    owner: useCase.owner || null,
    ownerEmail: useCase.ownerEmail || null,
  } : null);
  if (probeBase) {
    const observedAt = new Date().toISOString();
    healthStore.set(useCase.id, {
      ...probeBase,
      lastChecked: observedAt,
      statusCode: result.statusCode ?? null,
      probeStatusCode: result.statusCode ?? null,
      probeErrorType: result.errorType || null,
      // runCheckInternal routes every non-stopped HTTP 403 through
      // resolveAzureAccessRestrictedProbe(). Preserve that classification
      // for the telemetry reconciler as well: some App Service restriction
      // pages omit the headers/body fingerprints recognised by probe().
      // The resolver still requires clean, successful Log Analytics evidence
      // before it can recover an application.
      probeAccessRestrictedByAzure:
        result.accessRestrictedByAzure === true ||
        (result.authRestricted === true && Number(result.statusCode) === 403),
      probeObservedAt: observedAt,
    });
  }
  let azureRuntimeState = null;
  const autoFixAttempts = [];
  let latestAzureErrors = [];
  let diagnosis = { severity: null, action: null, reason: null };

  if (!result.ok && !result.appStopped &&
      (Number(result.statusCode) === 403 || result.statusCode == null)) {
    // ARM runtime lookup is needed to distinguish a stopped App Service from
    // an access-restricted/no-response probe. Do not fan out ARM reads for an
    // ordinary HTTP 5xx: those are retried and debounced below.
    azureRuntimeState = await getAzureAppServiceRuntimeState(useCase);
    if (azureRuntimeState.available && ['stopped', 'stopping'].includes(azureRuntimeState.state)) {
      result = {
        ...result,
        appStopped: true,
        errorType: 'app_stopped',
        errorMessage: `Azure Resource Manager reports App Service state: ${azureRuntimeState.state}`,
      };
    }
  }

  // Azure's standard stopped-app page also returns HTTP 403. Its body text
  // is not sufficient evidence on its own: stale platform pages, routing and
  // access restrictions can produce the same response after a site restarts.
  // For mapped multi-service applications (such as Resume Creator), reconcile
  // every required App Service role through ARM before publishing Stopped.
  if (result.appStopped && Array.isArray(useCase.recoveryRuntimeRoles) && useCase.recoveryRuntimeRoles.length) {
    let mappedRuntime = { states: [], reason: 'Mapped App Service runtime was not checked.' };
    try {
      mappedRuntime = await getMappedAppServiceRuntimeEvidence(useCase, useCase.recoveryRuntimeRoles);
    } catch (err) {
      mappedRuntime = { states: [], reason: err.message };
    }
    const stoppedProbeDecision = reconcileStoppedProbeAgainstMappedRuntime(mappedRuntime, useCase.recoveryRuntimeRoles);
    if (stoppedProbeDecision.classification === 'running' || stoppedProbeDecision.classification === 'unverified') {
      // Do not allow an HTTP 403/stopped splash page to overwrite a confirmed
      // running runtime as Stopped. Continue through the restricted-probe path
      // so clean telemetry/configuration can validate recovery.
      result = {
        ...result,
        appStopped: false,
        authRestricted: true,
        accessRestrictedByAzure: true,
        errorType: 'access_restricted_probe',
        errorMessage: stoppedProbeDecision.classification === 'running'
          ? 'The public probe returned an Azure stopped-app 403 page, but ARM confirms every mapped App Service role is Running.'
          : `The public probe returned a stopped-app 403 page, but mapped App Service runtime could not be conclusively verified: ${stoppedProbeDecision.reason}`,
        runtimeReconciliation: stoppedProbeDecision.classification,
      };
    } else {
      result = { ...result, errorMessage: `Azure Resource Manager confirms a mapped App Service is stopped: ${stoppedProbeDecision.reason}` };
    }
  }

  // A stopped status is now reserved for explicit stopped-page evidence that
  // is corroborated by ARM for the mapped runtime roles, or by the direct ARM
  // runtime check above for applications without a mapped-role configuration.
  if (result.appStopped) {
    pendingHighSeverityLogCycles.delete(useCase.id);
    if (prev?.status !== 'stopped') {
      logIncident({
        useCaseId: useCase.id,
        solution: useCase.title,
        level: 'stopped',
        severity: 'critical',
        actionRequired: true,
        message: `Azure App Service is stopped (HTTP ${result.statusCode}). Start the App Service to restore availability.`,
      });
    }
    const record = {
      id: useCase.id,
      title: useCase.title,
      launchUrl: useCase.launchUrl,
      status: 'stopped',
      lastChecked: new Date().toISOString(),
      latencyMs: result.latencyMs ?? null,
      statusCode: result.statusCode ?? null,
      consecutiveFailures: (prev?.status === 'stopped' ? (prev?.consecutiveFailures || 0) : 0) + 1,
      lastError: { errorType: result.errorType, errorMessage: result.errorMessage, statusCode: result.statusCode ?? null },
      errorSeverity: 'critical',
      actionRequired: true,
      remediation: 'Start Azure App Service',
      autoFixAttempts: [],
      lastNotification: prev?.lastNotification || null,
      owner: useCase.owner || null,
      ownerEmail: useCase.ownerEmail || null,
    };
    await maybeNotifyOwner(useCase, record, prev);
    healthStore.set(useCase.id, record);
    return record;
  }

  // Validate declared critical configuration on backend App Services. A
  // healthy frontend homepage must not mask a missing Key Vault-backed API key.
  // This check reads setting names/presence only; secret values are never stored.
  const requiredSettings = await checkRequiredAppSettings(useCase);
  const hasConfirmedRequiredSettingFailure =
    requiredSettings.ok === false &&
    Array.isArray(requiredSettings.errors) &&
    requiredSettings.errors.length > 0;
  if (hasConfirmedRequiredSettingFailure) {
    const issue = requiredSettings.errors[0];
    const current = healthStore.get(useCase.id) || prev || {};
    const record = {
      ...current,
      id: useCase.id,
      title: useCase.title,
      launchUrl: useCase.launchUrl,
      status: 'inactive',
      lastChecked: new Date().toISOString(),
      latencyMs: result.latencyMs ?? current.latencyMs ?? null,
      statusCode: result.statusCode ?? current.statusCode ?? null,
      probeStatusCode: result.statusCode ?? current.probeStatusCode ?? null,
      consecutiveFailures: (current.status === 'inactive' ? current.consecutiveFailures || 0 : 0) + 1,
      lastError: {
        errorType: 'required_configuration_missing',
        errorMessage: issue.message,
        dependency: issue.dependency,
        category: 'configuration',
        resourceName: issue.resourceName || null,
        timeGenerated: new Date().toISOString(),
      },
      errorSeverity: 'critical',
      actionRequired: true,
      remediation: 'Restore the required Key Vault-backed application setting',
      dependencyIncidentLatched: true,
      dependencyHealth: {
        status: 'unhealthy',
        failingDependency: issue.dependency,
        category: 'configuration',
        lastChanged: new Date().toISOString(),
      },
      owner: useCase.owner || null,
      ownerEmail: useCase.ownerEmail || null,
      statusSource: 'azure_app_settings',
      configurationValidation: {
        status: 'failed',
        checkedAt: new Date().toISOString(),
        requiredGroups: (useCase.requiredAppSettingGroups || []).map((group) => group.name || 'Required setting'),
        failure: issue.message,
        resourceName: issue.resourceName || null,
      },
    };
    persistDependencyLatch(useCase, record);
    await maybeNotifyOwner(useCase, record, prev);
    healthStore.set(useCase.id, record);
    return record;
  }

  // A required-setting check that could not be completed is not proof that the
  // setting is present. Do not let a successful public/frontend probe silently
  // overwrite an existing Unavailable/Stopped state or clear an incident latch.
  // Preserve the last confirmed three-state value and expose the exact Azure
  // inspection limitation. No owner outage email is sent for a monitoring gap.
  if (requiredSettings?.unknown === true) {
    const current = healthStore.get(useCase.id) || prev || {};

    // A settings-list ARM 403 must not strand an Azure-confirmed Stopped app
    // after it has been restarted. For this lifecycle-only transition, require
    // all mapped runtime roles to be Running, a successful public probe, a
    // successful current Log Analytics query, and no active telemetry latch.
    // This does NOT prove the secret value is valid; the monitoring note keeps
    // that limitation visible and fresh LA auth/dependency errors still win.
    if (current.status === 'stopped' &&
        (result.ok === true || (result.authRestricted === true && result.accessRestrictedByAzure === true)) &&
        useCase.allowRuntimeRecoveryWhenProbeBlocked === true) {
      let telemetryCheck = { configured: false, querySucceeded: false, apps: null, reason: 'Log Analytics verification not completed.' };
      let runtimeEvidence = { ok: false, reason: 'Mapped App Service runtime verification not completed.' };
      try {
        telemetryCheck = await monitorApplicationLogs([useCase], STATUS_LOG_WINDOW_MINUTES);
      } catch (err) {
        telemetryCheck = { configured: true, querySucceeded: false, apps: null, reason: err.message };
      }
      try {
        runtimeEvidence = await getMappedAppServiceRuntimeEvidence(useCase, useCase.recoveryRuntimeRoles || []);
      } catch (err) {
        runtimeEvidence = { ok: false, reason: err.message };
      }
      const latest = healthStore.get(useCase.id) || current;
      const recoveredStoppedState = canRecoverStoppedWithInconclusiveSettings({
        current,
        probeResult: result,
        requiredSettings,
        telemetryCheck,
        runtimeEvidence,
        hasActiveIncident: Boolean(getPersistentLatch(useCase.id)?.active) ||
          (latest.status === 'inactive' && latest.statusSource === 'azure_monitor' && latest.dependencyIncidentLatched === true),
      });
      if (recoveredStoppedState) {
        const recovered = {
          ...latest,
          id: useCase.id,
          title: useCase.title,
          launchUrl: useCase.launchUrl,
          status: 'active',
          lastChecked: new Date().toISOString(),
          probeStatusCode: result.statusCode ?? latest.probeStatusCode ?? null,
          statusCode: result.statusCode ?? latest.statusCode ?? null,
          consecutiveFailures: 0,
          lastError: null,
          errorSeverity: null,
          actionRequired: false,
          remediation: null,
          dependencyHealth: null,
          dependencyIncidentLatched: false,
          azureErrors: [],
          recoverySuccessCycles: 0,
          statusSource: 'runtime_and_telemetry_recovery',
          configurationValidation: {
            status: 'inconclusive',
            checkedAt: new Date().toISOString(),
            requiredGroups: (useCase.requiredAppSettingGroups || []).map((group) => group.name || 'Required setting'),
            warnings: requiredSettings.inspectionWarnings || [],
          },
          monitoringNote: `Application recovered from Stopped: mapped App Services are Running and Log Analytics returned a successful clean reconciliation. ${result.ok === true ? 'The public probe succeeded. ' : 'The public probe remains blocked by an Azure-generated HTTP 403; this is not treated as proof that the App Service is stopped. '}Required App Service settings could not be inspected (${requiredSettings.monitoringNote || 'Azure configuration access is restricted'}); credential validity remains unverified until the monitoring identity can list App Service settings.`,
          owner: useCase.owner || latest.owner || null,
          ownerEmail: useCase.ownerEmail || latest.ownerEmail || null,
        };
        clearPersistentLatch(useCase.id);
        clearOwnerNotification(useCase.id);
        healthStore.set(useCase.id, recovered);
        logIncident({
          useCaseId: useCase.id,
          solution: useCase.title,
          level: 'resolved',
          severity: 'info',
          actionRequired: false,
          message: result.ok === true
            ? 'Application recovered from Stopped after successful HTTP probe, mapped App Service runtime verification and clean Log Analytics reconciliation. Required settings inspection remains inconclusive due to Azure permissions.'
            : 'Application recovered from Stopped after mapped App Service runtime verification and clean Log Analytics reconciliation. The public HTTP 403 was not treated as a stopped runtime; required settings inspection remains inconclusive due to Azure permissions.',
        });
        return recovered;
      }
    }

    const retainedStatus = ['active', 'inactive', 'stopped'].includes(current.status)
      ? current.status
      : 'inactive';
    const warnings = Array.isArray(requiredSettings.inspectionWarnings)
      ? requiredSettings.inspectionWarnings.map((item) => ({
          dependency: item.dependency || 'Azure configuration monitoring',
          message: item.message || 'Required configuration could not be inspected.',
          statusCode: item.statusCode ?? null,
          resourceName: item.resourceName || null,
        }))
      : [];
    const retained = {
      ...current,
      id: useCase.id,
      title: useCase.title,
      launchUrl: useCase.launchUrl,
      status: retainedStatus,
      lastChecked: new Date().toISOString(),
      latencyMs: result.latencyMs ?? current.latencyMs ?? null,
      statusCode: result.statusCode ?? current.statusCode ?? null,
      probeStatusCode: result.statusCode ?? current.probeStatusCode ?? null,
      owner: useCase.owner || current.owner || null,
      ownerEmail: useCase.ownerEmail || current.ownerEmail || null,
      configurationValidation: {
        status: 'inconclusive',
        checkedAt: new Date().toISOString(),
        requiredGroups: (useCase.requiredAppSettingGroups || []).map((group) => group.name || 'Required setting'),
        checkedTargets: requiredSettings.checkedTargets || [],
        warnings,
      },
      monitoringNote: requiredSettings.monitoringNote ||
        warnings.map((item) => item.message).join(' ') ||
        'Required application configuration could not be verified. The last confirmed application state is retained.',
      statusSource: current.statusSource || 'configuration_verification_inconclusive',
    };
    healthStore.set(useCase.id, retained);
    return retained;
  }

  // Recovery for applications whose monitoring worker cannot receive an HTTP
  // response because of network/access restrictions. Only explicitly opted-in
  // apps can use this path, and only after critical settings are confirmed,
  // fresh failure telemetry is absent, and every required mapped App Service
  // role is confirmed running by ARM.
  if (useCase.allowRuntimeRecoveryWhenProbeBlocked === true &&
      !result.ok && !result.appStopped &&
      (result.statusCode == null || Number(result.statusCode) >= 500)) {
    await monitorApplicationLogs([useCase], STATUS_LOG_WINDOW_MINUTES);
    const latest = healthStore.get(useCase.id) || prev || {};
    if (latest.status === 'active' &&
        latest.statusSource === 'telemetry_and_configuration_recovery' &&
        !getPersistentLatch(useCase.id)) {
      return latest;
    }
    // A previous clean telemetry cycle may have left the incident in
    // recovery_validation. Do not return early: when ARM now positively
    // confirms every mapped App Service is Running, evaluate that independent
    // evidence below so a DNS/access-restricted public probe cannot strand the
    // application in Unavailable indefinitely.
    const telemetryAt = new Date(latest.telemetryObservedAt || 0).getTime();
    const freshTelemetryFailure = latest.statusSource === 'azure_monitor' &&
      latest.dependencyIncidentLatched === true &&
      Number.isFinite(telemetryAt) && telemetryAt > 0 &&
      Date.now() - telemetryAt <= Math.max(5 * 60 * 1000, ACTIONABLE_ERROR_FRESHNESS_MS);
    const recoveryEvidence = await getMappedAppServiceRuntimeEvidence(
      useCase,
      useCase.recoveryRuntimeRoles || [],
    );
    const requiredSettingsConfirmedMissing =
      Array.isArray(requiredSettings.errors) && requiredSettings.errors.length > 0;
    if (!freshTelemetryFailure && !requiredSettingsConfirmedMissing &&
        requiredSettings?.unknown !== true && requiredSettings?.ok === true && recoveryEvidence.ok) {
      const recovered = {
        ...latest,
        id: useCase.id,
        title: useCase.title,
        launchUrl: useCase.launchUrl,
        status: 'active',
        lastChecked: new Date().toISOString(),
        latencyMs: result.latencyMs ?? latest.latencyMs ?? null,
        statusCode: result.statusCode ?? null,
        probeStatusCode: result.statusCode ?? null,
        consecutiveFailures: 0,
        lastError: null,
        errorSeverity: null,
        actionRequired: false,
        remediation: null,
        dependencyHealth: null,
        dependencyIncidentLatched: false,
        azureErrors: [],
        recoverySuccessCycles: 0,
        statusSource: 'runtime_and_configuration_recovery',
        monitoringNote: `Recovery verified: mapped App Services are running and no fresh application/dependency failure was found in the successful Log Analytics reconciliation. ${requiredSettings.unknown ? 'Azure could not independently inspect the required backend setting because the monitoring identity lacks access or the settings API was unavailable; verify this configuration separately. ' : 'Required application settings were positively inspected. '}The external health probe did not receive a usable HTTP response (${result.errorMessage || result.statusCode || 'no response'}); end-to-end functionality should be confirmed through an approved application health endpoint.`,
        owner: useCase.owner || null,
        ownerEmail: useCase.ownerEmail || null,
        lastNotification: null,
      };
      clearPersistentLatch(useCase.id);
      clearOwnerNotification(useCase.id);
      healthStore.set(useCase.id, recovered);
      logIncident({
        useCaseId: useCase.id,
        solution: useCase.title,
        level: 'resolved',
        severity: 'info',
        actionRequired: false,
        message: 'Application recovery verified from required configuration, current Azure telemetry and mapped App Service runtime state. Public health probe remains restricted/unavailable.',
      });
      return recovered;
    }
  }

  // The dashboard contract treats an inaccessible URL (including HTTP 401/403)
  // as Unavailable. Only an Azure-confirmed stopped site is shown as Stopped.
  if (result.authRestricted) {
    const current = healthStore.get(useCase.id) || prev;
    // A 403 can be generated by App Service access restrictions before the
    // request reaches the app. Reconcile telemetry and verify the App Service
    // runtime via ARM for every 403, even when Azure changes the wording/body
    // of its platform error page. A 401 remains a genuine auth failure.
    if (Number(result.statusCode) === 403) {
      return resolveAzureAccessRestrictedProbe(useCase, result, current, autoFixAttempts, requiredSettings);
    }
    scheduleApplicationLogMonitoring(useCase);
    return restrictedProbeHealthRecord(useCase, result, current, autoFixAttempts);
  }

  // Do not let one short-lived 5xx/timeout/DNS event flicker an otherwise
  // healthy application to Unavailable. Retry above, then require a second
  // scheduled health cycle unless current telemetry proves a critical failure.
  if (!result.ok && isTransientProbeFailure(result) && prev?.status === 'active') {
    const hasConfirmedCriticalEvidence = diagnosis.severity === 'critical' ||
      latestAzureErrors.some((row) =>
        normalizeOperationalSeverity(row.Severity || row.Level) === 'critical' ||
        isCriticalApplicationLog(row)
      );
    const nextFailureCount = Number(prev.consecutiveFailures || 0) + 1;
    if (!hasConfirmedCriticalEvidence && nextFailureCount < HEALTH_FAILURE_CONFIRMATION_CYCLES) {
      const pending = pendingTransientFailureRecord(useCase, result, prev, autoFixAttempts);
      healthStore.set(useCase.id, pending);
      return pending;
    }
  }

  const isDnsMonitoringFailure = !result.ok && result.errorType === 'network_error' &&
    /ENOTFOUND|EAI_AGAIN|getaddrinfo|name resolution|dns/i.test(String(result.errorMessage || ''));
  if (isDnsMonitoringFailure) {
    // DNS failure in the monitoring worker is not, by itself, proof that the
    // application is down. Reconcile current telemetry synchronously so a
    // real application/dependency incident still takes precedence.
    let telemetryCheck = {
      configured: false,
      querySucceeded: false,
      apps: null,
      reason: 'Log Analytics is not configured.',
    };
    try {
      telemetryCheck = await monitorApplicationLogs([useCase], STATUS_LOG_WINDOW_MINUTES);
    } catch (err) {
      telemetryCheck = { configured: true, querySucceeded: false, apps: null, reason: err.message };
      console.warn(`[adminHealth] DNS-failure telemetry reconciliation failed for ${useCase.id}: ${err.message}`);
    }

    const telemetryCurrent = healthStore.get(useCase.id) || prev || {};
    const telemetryAt = new Date(telemetryCurrent.telemetryObservedAt || 0).getTime();
    const freshnessWindowMs = Math.max(5 * 60 * 1000, ACTIONABLE_ERROR_FRESHNESS_MS);
    const hasFreshTelemetryFailure = telemetryCurrent.statusSource === 'azure_monitor' &&
      telemetryCurrent.dependencyIncidentLatched === true &&
      Number.isFinite(telemetryAt) && telemetryAt > 0 &&
      Date.now() - telemetryAt <= freshnessWindowMs &&
      ['inactive', 'degraded', 'stopped'].includes(telemetryCurrent.status);
    const persistentLatch = getPersistentLatch(useCase.id);
    const latchAt = new Date(
      persistentLatch?.lastError?.timeGenerated ||
      persistentLatch?.lastError?.timestamp ||
      persistentLatch?.detectedAt ||
      0
    ).getTime();
    const hasFreshPersistentFailure = Boolean(persistentLatch?.active) &&
      Number.isFinite(latchAt) && latchAt > 0 &&
      Date.now() - latchAt <= freshnessWindowMs;

    if (hasFreshTelemetryFailure || hasFreshPersistentFailure) {
      return telemetryCurrent.status === 'stopped'
        ? telemetryCurrent
        : { ...telemetryCurrent, monitoringNote: 'A fresh application/dependency failure was confirmed independently of the monitoring-worker DNS failure.' };
    }

    // Resume Creator recovery uses both explicitly mapped App Services and a
    // successful Log Analytics query. A confirmed missing required setting or
    // fresh dependency incident blocks recovery. If the settings-list API is
    // unavailable (unknown), do not misclassify that permission gap as an
    // application outage; recover from positive runtime + clean telemetry and
    // surface the settings-inspection limitation in the monitoring note.
    if (useCase.allowRuntimeRecoveryWhenProbeBlocked === true) {
      const recoveryEvidence = await getMappedAppServiceRuntimeEvidence(
        useCase,
        useCase.recoveryRuntimeRoles || [],
      );
      const telemetryVerifiedForApp = telemetryCheck?.configured === true &&
        telemetryCheck?.querySucceeded === true &&
        telemetryCheck?.apps &&
        Object.prototype.hasOwnProperty.call(telemetryCheck.apps, useCase.id);
      const requiredSettingsConfirmedMissing =
        Array.isArray(requiredSettings?.errors) && requiredSettings.errors.length > 0;
      const requiredSettingsConfirmedHealthy = requiredSettings?.unknown !== true && requiredSettings?.ok === true;

      if (recoveryEvidence.ok && !requiredSettingsConfirmedMissing && requiredSettingsConfirmedHealthy && telemetryVerifiedForApp) {
        const recovered = {
          ...telemetryCurrent,
          id: useCase.id,
          title: useCase.title,
          launchUrl: useCase.launchUrl,
          status: 'active',
          statusCode: null,
          probeStatusCode: null,
          probeErrorType: 'network_error',
          probeObservedAt: new Date().toISOString(),
          consecutiveFailures: 0,
          lastError: null,
          errorSeverity: null,
          actionRequired: false,
          remediation: null,
          dependencyIncidentLatched: false,
          dependencyHealth: null,
          azureErrors: [],
          recoverySuccessCycles: 0,
          lastChecked: new Date().toISOString(),
          statusSource: 'runtime_configuration_and_telemetry_recovery',
          monitoringNote: `Recovery verified: all required mapped App Services are Running and the current Log Analytics query found no fresh actionable application/dependency failure. ${requiredSettings?.unknown ? 'Azure could not independently inspect the required backend setting; verify the monitoring identity has permission to list App Service settings. ' : 'Required backend settings were positively inspected. '}The monitoring worker alone could not resolve the public hostname (${result.errorMessage || 'DNS resolution failure'}).`,
          owner: useCase.owner || null,
          ownerEmail: useCase.ownerEmail || null,
        };
        clearPersistentLatch(useCase.id);
        clearOwnerNotification(useCase.id);
        healthStore.set(useCase.id, recovered);
        logIncident({
          useCaseId: useCase.id,
          solution: useCase.title,
          level: 'resolved',
          severity: 'info',
          actionRequired: false,
          message: 'Application recovery verified using mapped App Service runtime, required configuration and current Azure telemetry; public probe DNS resolution remains unavailable to the monitoring worker.',
        });
        return recovered;
      }

      // Do not manufacture an Unavailable transition or send an owner email
      // when DNS, ARM permissions, settings inspection, or Log Analytics is
      // inconclusive. Preserve the last confirmed state and expose exactly
      // which independent check still needs attention.
      const reasons = [
        recoveryEvidence.ok ? null : `runtime verification: ${recoveryEvidence.reason || 'not confirmed'}`,
        requiredSettingsConfirmedMissing ? `required-setting verification: ${requiredSettings?.errors?.map(x => x.message).join(' ') || 'a required setting is confirmed missing'}` : null,
        requiredSettings?.unknown === true ? `required-setting verification is inconclusive: ${requiredSettings?.monitoringNote || requiredSettings?.inspectionWarnings?.map(item => item.message).join(' ') || 'Azure App Service settings could not be inspected'}` : null,
        telemetryVerifiedForApp ? null : `Log Analytics verification: ${telemetryCheck?.reason || 'query not confirmed'}`,
      ].filter(Boolean);
      const retained = {
        ...telemetryCurrent,
        id: useCase.id,
        title: useCase.title,
        launchUrl: useCase.launchUrl,
        status: telemetryCurrent.status || prev?.status || 'inactive',
        lastChecked: new Date().toISOString(),
        probeStatusCode: null,
        probeErrorType: 'network_error',
        probeObservedAt: new Date().toISOString(),
        monitoringNote: `The monitoring worker could not resolve the public hostname. No new application outage has been declared. Last confirmed state is retained. Recovery evidence is incomplete: ${reasons.join('; ')}.`,
        statusSource: telemetryCurrent.statusSource || prev?.statusSource || 'dns_probe_inconclusive',
        owner: useCase.owner || telemetryCurrent.owner || null,
        ownerEmail: useCase.ownerEmail || telemetryCurrent.ownerEmail || null,
      };
      healthStore.set(useCase.id, retained);
      return retained;
    }

    // For other applications, retain the last confirmed state on a DNS failure.
    // Azure "Running" alone does not prove end-to-end functionality, and a
    // monitoring-side DNS error must never generate a critical incident email.
    const retained = {
      ...telemetryCurrent,
      id: useCase.id,
      title: useCase.title,
      launchUrl: useCase.launchUrl,
      status: telemetryCurrent.status || prev?.status || 'inactive',
      lastChecked: new Date().toISOString(),
      probeStatusCode: null,
      probeErrorType: 'network_error',
      probeObservedAt: new Date().toISOString(),
      monitoringNote: `The monitoring worker could not resolve the public hostname. No independent application/dependency failure was confirmed. The last confirmed state (${telemetryCurrent.status || prev?.status || 'unknown'}) is retained; no owner outage notification was generated.`,
      statusSource: telemetryCurrent.statusSource || prev?.statusSource || 'dns_probe_inconclusive',
      owner: useCase.owner || telemetryCurrent.owner || null,
      ownerEmail: useCase.ownerEmail || telemetryCurrent.ownerEmail || null,
    };
    healthStore.set(useCase.id, retained);
    return retained;
  }

  // A retry may have surfaced the Azure stopped page where the first attempt
  // saw a transient failure. Keep that distinct from access restriction.
  if (result.appStopped) {
    const record = {
      id: useCase.id,
      title: useCase.title,
      launchUrl: useCase.launchUrl,
      status: 'stopped',
      lastChecked: new Date().toISOString(),
      latencyMs: result.latencyMs ?? null,
      statusCode: result.statusCode ?? null,
      consecutiveFailures: (prev?.status === 'stopped' ? (prev?.consecutiveFailures || 0) : 0) + 1,
      lastError: { errorType: result.errorType, errorMessage: result.errorMessage, statusCode: result.statusCode ?? null },
      errorSeverity: 'critical',
      actionRequired: true,
      remediation: 'Start Azure App Service',
      autoFixAttempts,
      lastNotification: prev?.lastNotification || null,
      owner: useCase.owner || null,
      ownerEmail: useCase.ownerEmail || null,
    };
    await maybeNotifyOwner(useCase, record, prev);
    healthStore.set(useCase.id, record);
    return record;
  }

  // A retry may still receive App Service authentication; treat the host as
  // reachable while preserving any issue already confirmed by Azure Monitor.
  if (result.authRestricted) {
    const current = healthStore.get(useCase.id) || prev;
    // A 403 can be generated by App Service access restrictions before the
    // request reaches the app. Reconcile telemetry and verify the App Service
    // runtime via ARM for every 403, even when Azure changes the wording/body
    // of its platform error page. A 401 remains a genuine auth failure.
    if (Number(result.statusCode) === 403) {
      return resolveAzureAccessRestrictedProbe(useCase, result, current, autoFixAttempts);
    }
    scheduleApplicationLogMonitoring(useCase);
    return restrictedProbeHealthRecord(useCase, result, current, autoFixAttempts);
  }

  const consecutiveFailures = result.ok ? 0 : (prev?.consecutiveFailures || 0) + 1;
  // Re-read the durable latch immediately before the final write. A Log
  // Analytics sweep may have detected a dependency failure while this HTTP
  // probe was in flight; using the latch captured before the probe creates a
  // race where the later HTTP-200 write can overwrite Degraded with Healthy.
  const latestPersistentLatch = getPersistentLatch(useCase.id);
  let latched = latestPersistentLatch || (healthStore.get(useCase.id)?.dependencyIncidentLatched ? healthStore.get(useCase.id) : null) || (prev?.dependencyIncidentLatched ? prev : null);
  const latchTimestamp = latched?.updatedAt || latched?.lastError?.timeGenerated || latched?.detectedAt;
  const latchUpdatedAt = latchTimestamp ? new Date(latchTimestamp).getTime() : Number.NaN;
  if (result.ok && latestPersistentLatch && isHttpAvailabilityLatch(latestPersistentLatch, useCase) &&
      Number.isFinite(latchUpdatedAt) && latchUpdatedAt <= probeStartedAt) {
    clearPersistentLatch(useCase.id);
    clearOwnerNotification(useCase.id);
    latched = null;
  }
  const preserveUnavailable = Boolean(result.ok && latched);
  const isHttpServerError = Number(result.statusCode) >= 500;
  const diagnosedDependencyHealth = !result.ok && (diagnosis.dependency || isHttpServerError)
    ? {
      status: 'unhealthy',
      failingDependency: diagnosis.dependency || 'Application HTTP service',
      category: diagnosis.category || 'app_service',
      lastChanged: new Date().toISOString(),
    }
    : null;

  const record = {
    id: useCase.id,
    title: useCase.title,
    launchUrl: useCase.launchUrl,
    status: result.ok ? (preserveUnavailable ? 'inactive' : 'active') : 'inactive',
    lastChecked: new Date().toISOString(),
    latencyMs: result.latencyMs ?? null,
    statusCode: result.statusCode ?? null,
    probeStatusCode: result.statusCode ?? null,
    consecutiveFailures,
    lastError: preserveUnavailable ? (latched.lastError || prev?.lastError || null) : (result.ok ? null : { errorType: result.errorType, errorMessage: result.errorMessage }),
    errorSeverity: preserveUnavailable ? 'critical' : (result.ok ? null : (diagnosis.severity || 'critical')),
    actionRequired: preserveUnavailable ? true : !result.ok,
    remediation: preserveUnavailable ? (latched.remediation || prev?.remediation || 'owner_alert') : (result.ok ? null : (diagnosis.action || 'owner_alert')),
    dependencyHealth: preserveUnavailable ? (latched.dependencyHealth || prev?.dependencyHealth || { status: 'unhealthy', failingDependency: latched.lastError?.dependency || 'Application dependency', category: latched.lastError?.category || 'application', lastChanged: latched.detectedAt || new Date().toISOString() }) : diagnosedDependencyHealth,
    statusSource: result.ok
      ? (preserveUnavailable ? 'azure_monitor' : 'http_probe_reachable')
      : (isHttpServerError ? 'http_probe'       : (preserveUnavailable ? 'azure_monitor' : 'http_probe_unavailable')),
    azureErrors: preserveUnavailable
      ? ((Array.isArray(latched.azureErrors) && latched.azureErrors.length)
          ? latched.azureErrors.slice(0, 25)
          : (prev?.azureErrors || []))
      : latestAzureErrors.slice(0, 25),
    dependencyIncidentLatched: preserveUnavailable,
    autoFixAttempts,
    lastNotification: result.ok && !preserveUnavailable ? null : (prev?.lastNotification || null),
    owner: useCase.owner || null,
    ownerEmail: useCase.ownerEmail || null,
    monitoringNote: requiredSettings?.monitoringNote || null,
    configurationValidation: {
      status: requiredSettings?.unknown === true ? 'inconclusive' : 'verified',
      checkedAt: new Date().toISOString(),
      requiredGroups: (useCase.requiredAppSettingGroups || []).map((group) => group.name || 'Required setting'),
    },
  };

  // State transition audit: when availability returns, record recovery instead
  // of leaving only the historical outage/restriction incident in the feed.
  if (result.ok && !preserveUnavailable && prev && ['stopped', 'inactive', 'restricted', 'degraded'].includes(prev.status)) {
    logIncident({
      useCaseId: useCase.id,
      solution: useCase.title,
      level: 'resolved',
      severity: 'info',
      actionRequired: false,
      message: `Application recovered automatically: ${prev.status} → Healthy (HTTP ${result.statusCode || 200}).`,
    });
  }

  // UC3: send one owner alert attempt for the ongoing outage.
  if (!result.ok) {
    await maybeNotifyOwner(useCase, record, prev);
  } else if (!preserveUnavailable) {
    clearOwnerNotification(useCase.id);
  }

  healthStore.set(useCase.id, record);
  return record;
}

// Strong, explicit Neo4j outage signatures from Advisor Intelligence telemetry.
// Kept as a shared predicate so normal polling and manual Investigate use the
// same evidence rule even when App Service labels the traceback as Information.
const advisorNeo4jFailurePattern =
  /neo4j(?:[.\s_-]*(?:exceptions?|driver|database))?.{0,240}(?:serviceunavailable|failed to dns resolve|name or service not known|connection refused|connection timed out|sessionexpired|unable to connect)|(?:serviceunavailable|failed to dns resolve|name or service not known|connection refused|connection timed out|sessionexpired).{0,240}(?:neo4j|bolt|databases\.neo4j\.io)|bolt(?:\+s)?:\/\/.{0,240}(?:failed|unavailable|refused|timeout)/i;

function hasExplicitDependencyFailureSignal(error) {
  const message = String(error?.Message || '');
  const dependency = Boolean(error?.Dependency || error?.ErrorCategory ||
    /azure[ -]?openai|openai|neo4j|bolt|sql|database|storage|blob|redis|service bus|event hub|search|cosmos|postgres|mysql|key vault|managed identity/i.test(message));
  if (!dependency) return false;
  return /\b(?:401|403|404|408|429|5\d\d)\b|failed|failure|exception|unavailable|unauthorized|forbidden|invalid credential|authentication|connection refused|connection reset|connection timed out|timeout|timed out|not found|quota|throttl|permission denied|secret.*missing|deployment.*missing|dns/i.test(message);
}

function isCriticalApplicationLog(error) {
  const severity = String(error?.Severity || error?.Level || '').toLowerCase();
  const message = String(error?.Message || '');
  // Explicit critical/fatal labels always win, even when the source pipeline
  // incorrectly labels a traceback row as Information.
  if (/\b(critical|fatal|emergency|alert)\b/.test(severity)) return true;
  // Detect failure signatures across every application, not only the
  // Advisor Intelligence Neo4j special case.
  return /application startup failed|startup failure|failed to start|worker failed to boot|unhandled exception|uncaught exception|unhandledrejection|unhandled promise rejection|outofmemory|heap out of memory|cannot allocate memory|module not found|modulenotfounderror|importerror|package not found|failed to load (?:module|package|application)|(?:invalid|incorrect|missing|expired|not configured|not set|not found|must be set).{0,40}api[_\s-]?key|api[_\s-]?key.{0,50}(?:missing|invalid|expired|not configured|not set|not found|must be set)|(?:deployment|model|search index|database).{0,60}(?:not found|unavailable|does not exist|missing)|(?:missing|required).{0,40}(?:environment variable|configuration|setting|secret)|(?:environment variable|configuration|setting|secret).{0,40}(?:missing|not set|invalid|unresolved)|authentication failed|failed to authenticate|invalid credential|credential unavailable|key vault.{0,80}(?:secret not found|access denied|forbidden|unresolved|failed)|database.{0,50}authentication failed|(?:storage|blob|queue|search|redis|service bus|event hub|cosmos|sql|postgres|mysql).{0,80}(?:authentication failed|permission denied|not found)|neo4j.{0,80}(?:unavailable|failed|refused|timeout)/i.test(message);
}


function isLifecycleOnlyStoppedError(error) {
  // Accept both normalized health records and raw Log Analytics rows. The
  // latter carry Message/Level/Source fields and may be labelled Error by the
  // platform even though the text is only Azure's stopped-app splash page.
  const type = String(error?.errorType || error?.ErrorType || '').toLowerCase();
  const message = String(
    typeof error === 'string'
      ? error
      : (error?.errorMessage || error?.Message || error?.message || '')
  ).toLowerCase();
  return type === 'app_stopped' ||
    /azure app service (?:is )?stopped|app service state:\s*stopped|azure app service stopped \(http 503\)/i.test(message);
}

function isFreshActionableHealthLog(error, options = {}) {
  // Defense in depth: lifecycle-only stopped pages must never become fresh
  // dependency failures, even if a caller forgets to filter actionable rows.
  if (isLifecycleOnlyStoppedError(error)) return false;
  const timestamp = new Date(error?.TimeGenerated || 0).getTime();
  const appId = String(options.appId || '');
  const advisorNeo4jFailure = appId === 'advisor-intelligence' &&
    advisorNeo4jFailurePattern.test(String(error?.Message || ''));
  const explicitCriticalSignal =
    normalizeOperationalSeverity(error?.Severity || error?.Level) === 'critical' ||
    isCriticalApplicationLog(error) || advisorNeo4jFailure;
  const dependencyEvidence = hasExplicitDependencyFailureSignal(error);
  const cutoff = advisorNeo4jFailure
    ? Number(options.advisorNeo4jFreshCutoffMs)
    : Number(options.genericFreshCutoffMs);
  if (!Number.isFinite(timestamp) || !Number.isFinite(cutoff) || timestamp < cutoff) return false;
  const hasRecentSuccessfulProbe = options.hasRecentSuccessfulProbe === true;
  const lastProbeAt = Number(options.lastProbeAt || 0);
  // Critical application/dependency telemetry is authoritative even if the
  // homepage probe completed after the log timestamp. A successful frontend
  // GET cannot prove the AI/business workflow is healthy.
  return explicitCriticalSignal || dependencyEvidence || !hasRecentSuccessfulProbe || timestamp > lastProbeAt;
}

async function monitorApplicationLogsInternal(useCases, minutes = STATUS_LOG_WINDOW_MINUTES) {
  if (!process.env.AZURE_LOG_ANALYTICS_WORKSPACE_ID) {
    return { configured: false, querySucceeded: false, apps: null, reason: 'AZURE_LOG_ANALYTICS_WORKSPACE_ID is not configured.' };
  }

  const targets = useCases.filter(uc => uc.launchUrl);
  if (!targets.length) {
    return { configured: true, querySucceeded: false, apps: null, reason: 'No monitored application targets were supplied.' };
  }

  try {
    // IMPORTANT ARCHITECTURE CHANGE:
    // Query all mapped frontend/backend resources in one Log Analytics request.
    // The returned telemetry is the source of truth for dependency status.
    // Dedupe is used ONLY for notifications/incidents; it must never suppress
    // health-state reconciliation for an error we have already seen.
    const result = await azureLogs.getErrorsForApplications(targets, minutes, 100);
    const appErrors = result.apps || {};

    for (const useCase of targets) {
      const errors = Array.isArray(appErrors[useCase.id]) ? appErrors[useCase.id] : [];
      const existing = healthStore.get(useCase.id) || {};
      const persistentLatch = getPersistentLatch(useCase.id);
      const previousKeys = processedLogKeysFor(useCase.id);

      // Advisor Intelligence has a known critical Neo4j dependency failure mode.
      // App Service console streams can label Python exception/traceback rows as
      // Information even though the message is an actual ServiceUnavailable or
      // DNS-resolution failure. Do not let that source-level label suppress a
      // confirmed Neo4j outage. This exception is scoped to Advisor Intelligence
      // and to explicit connection/DNS failure signatures, not generic mentions
      // of Neo4j in informational application logs.
      const actionableErrors = errors.filter((e) =>
        // A platform-generated stopped-app page is lifecycle evidence, not an
        // application/dependency incident. Exclude it before severity handling
        // so an Azure Error/Critical label cannot recreate a stale HTTP-service
        // latch on every Log Analytics polling cycle. Runtime reconciliation in
        // runCheckInternal remains the authority for the Stopped state.
        !isLifecycleOnlyStoppedError(e) && (
          isActionableSeverity(e.Severity || e.Level) ||
          isCriticalApplicationLog(e) ||
          (useCase.id === 'advisor-intelligence' &&
            advisorNeo4jFailurePattern.test(String(e.Message || '')))
        )
      );
      // Health state is driven by fresh telemetry, not by every historical row
      // still inside the rolling query window. Complete Error Logs remains raw/history.
      const genericFreshCutoffMs = Date.now() - Math.max(60 * 1000, LOG_MONITOR_INTERVAL_MS * 2, ACTIONABLE_ERROR_FRESHNESS_MS);
      // Neo4j DNS/ServiceUnavailable can be logged once during startup while
      // the backend remains unusable. Retain this explicit Advisor-only signal
      // for the configured monitoring window; other apps keep normal freshness.
      // The query still looks back across STATUS_LOG_WINDOW_MINUTES for
      // diagnostics, but only a genuinely recent Neo4j failure keeps the live
      // health state unavailable. Older rows remain visible in Complete Logs
      // and must not prevent recovery after the dependency has been repaired.
      const advisorNeo4jFreshCutoffMs = Date.now() - Math.max(
        60 * 1000,
        LOG_MONITOR_INTERVAL_MS * 2,
        ACTIONABLE_ERROR_FRESHNESS_MS
      );
      const lastProbeStatusCode = Number(existing.probeStatusCode ?? existing.statusCode);
      const lastProbeAt = new Date(existing.lastChecked || 0).getTime();
      const hasRecentSuccessfulProbe = isSuccessfulProbeStatus(lastProbeStatusCode) &&
        Number.isFinite(lastProbeAt);
      const currentActionableErrors = actionableErrors.filter((error) =>
        isFreshActionableHealthLog(error, {
          appId: useCase.id,
          genericFreshCutoffMs,
          advisorNeo4jFreshCutoffMs,
          hasRecentSuccessfulProbe,
          lastProbeAt,
        })
      );

      // Do not turn a one-off generic Error/High log row into an outage. Require
      // the same error signature in two distinct Log Analytics polling cycles.
      // Critical/Fatal severity and recognised fatal/crash/dependency signatures
      // remain immediate. Generic primary-site HTTP 5xx rows are High signals
      // and must repeat across separate log polling cycles; one transient 503
      // must not create a momentary Unavailable state.
      const immediateFailureErrors = currentActionableErrors.filter((e) => {
        const severity = normalizeOperationalSeverity(e.Severity || e.Level);
        const explicitFatal = severity === 'critical' || isCriticalApplicationLog(e);
        return explicitFatal;
      });
      const highOnlyErrors = currentActionableErrors.filter((e) =>
        normalizeOperationalSeverity(e.Severity || e.Level) === 'high' &&
        !immediateFailureErrors.includes(e)
      );
      let confirmedHighErrors = [];
      if (highOnlyErrors.length > 0) {
        const signature = highOnlyErrors
          .map((e) => `${e.Source || ''}|${e._ResourceId || ''}|${String(e.Message || '').slice(0, 500)}`)
          .sort()
          .join('\\n');
        const previous = pendingHighSeverityLogCycles.get(useCase.id);
        const now = Date.now();
        const pollInterval = Math.max(30000, LOG_MONITOR_INTERVAL_MS - 5000);
        const nextCount = previous && previous.signature === signature &&
          now - previous.lastCountedAt >= pollInterval
            ? previous.count + 1
            : previous && previous.signature === signature
              ? previous.count
              : 1;
        pendingHighSeverityLogCycles.set(useCase.id, {
          signature,
          count: nextCount,
          lastCountedAt: previous && previous.signature === signature &&
            now - previous.lastCountedAt < pollInterval
              ? previous.lastCountedAt
              : now,
        });
        if (nextCount >= 2) confirmedHighErrors = highOnlyErrors;
      } else {
        pendingHighSeverityLogCycles.delete(useCase.id);
      }
      const confirmedActionableErrors = immediateFailureErrors.concat(confirmedHighErrors);

      if (confirmedActionableErrors.length > 0) {
        // Reconcile health from the highest-impact currently observed error, not
        // simply the newest row. This prevents an informational row from masking
        // a critical Azure OpenAI / dependency failure in the same query window.
        const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
        const ordered = confirmedActionableErrors.slice().sort((a, b) => {
          const ar = severityRank[normalizeOperationalSeverity(a.Severity || a.Level)] || 0;
          const br = severityRank[normalizeOperationalSeverity(b.Severity || b.Level)] || 0;
          if (br !== ar) return br - ar;
          return new Date(b.TimeGenerated || 0).getTime() - new Date(a.TimeGenerated || 0).getTime();
        });
        const newest = ordered[0];
        const observedHttpServerError = httpServerErrorStatusCode(confirmedActionableErrors, useCase);
        // Correlate the complete fresh error set for this application. An HTTP
        // 503 from the user-facing App Service often contains only the
        // route/status, while the adjacent exception/dependency row contains
        // its actual cause (for example Neo4j ServiceUnavailable). Backend and
        // shared-dependency 5xx rows are not proof that this app URL is down.
        const diagnosis = classifyError(
          { errorType: 'azure_log_error', errorMessage: newest.Message },
          confirmedActionableErrors
        );
        diagnosis.severity = normalizeOperationalSeverity(newest.Severity || diagnosis.severity);
        if (diagnosis.dependency) diagnosis.severity = 'critical';
        const current = healthStore.get(useCase.id) || existing;
        const currentProbeFailure = current.status === 'inactive' && current.statusSource !== 'azure_monitor';
        const startupFailure = confirmedActionableErrors.some(e =>
          /application startup failed|startup failure|failed to start|exiting\b|worker failed to boot/i.test(String(e.Message || '')));
        const confirmedNeo4jOutage = useCase.id === 'advisor-intelligence' &&
          confirmedActionableErrors.some(e =>
            advisorNeo4jFailurePattern.test(String(e.Message || ''))
          );
        // Any actionable backend/dependency failure means at least one
        // application function is broken, even when the landing page responds.
        const appIsDown = confirmedActionableErrors.length > 0 ||
          Boolean(observedHttpServerError) || startupFailure || confirmedNeo4jOutage ||
          current.status === 'stopped' || currentProbeFailure;
        const enrichedLastError = {
          errorType: 'azure_log_error',
          errorMessage: newest.Message,
          statusCode: observedHttpServerError,
          dependency: diagnosis.dependency || newest.Dependency || null,
          category: diagnosis.category || newest.ErrorCategory || null,
          timeGenerated: newest.TimeGenerated,
          source: newest.Source,
          resourceRole: newest.ResourceRole || null,
          resourceName: newest.ResourceName || null,
        };
        const record = {
          id: useCase.id,
          title: useCase.title,
          launchUrl: useCase.launchUrl,
          status: current.status === 'stopped'
            ? 'stopped'
            : 'inactive',
          lastChecked: current.lastChecked || new Date().toISOString(),
          latencyMs: current.latencyMs ?? null,
          statusCode: observedHttpServerError || current.statusCode || null,
          probeStatusCode: current.probeStatusCode ?? current.statusCode ?? null,
          consecutiveFailures: current.consecutiveFailures || 0,
          lastError: enrichedLastError,
          errorSeverity: diagnosis.dependency ? 'critical' : diagnosis.severity,
          actionRequired: true,
          dependencyIncidentLatched: true,
          remediation: diagnosis.action,
          dependencyHealth: {
            status: 'unhealthy',
            failingDependency: diagnosis.dependency || newest.Dependency || (observedHttpServerError ? 'Application HTTP service' : 'Application dependency'),
            category: diagnosis.category || newest.ErrorCategory || (observedHttpServerError ? 'app_service' : 'application'),
            lastChanged: newest.TimeGenerated || new Date().toISOString(),
          },
          owner: useCase.owner || null,
          ownerEmail: useCase.ownerEmail || null,
          lastNotification: current.lastNotification || persistentLatch?.lastNotification || null,
          autoFixAttempts: current.autoFixAttempts || [],
          azureErrors: confirmedActionableErrors.slice(0, 25),
          telemetryObservedAt: new Date().toISOString(),
          statusSource: 'azure_monitor',
          recoverySuccessCycles: 0,
          lastRecoveryCheckAt: new Date().toISOString(),
        };

        // Persist BEFORE publishing to healthStore so a simultaneous URL probe
        // cannot legitimately conclude "Healthy" from endpoint availability.
        persistDependencyLatch(useCase, record);
        healthStore.set(useCase.id, record);

        // Process only genuinely new rows for incident history / notification.
        // Seen rows still enforce the appropriate health state on every poll.
        for (const log of errors.slice().reverse()) {
          const key = `${log.TimeGenerated}|${log.Source}|${log._ResourceId || ''}|${log.Message}`;
          if (previousKeys.has(key)) continue;
          previousKeys.add(key);
          if (!isActionableSeverity(log.Severity || log.Level)) continue;
          const logDiagnosis = classifyError({ errorType: 'azure_log_error', errorMessage: log.Message }, [log]);
          logDiagnosis.severity = normalizeOperationalSeverity(log.Severity || logDiagnosis.severity);

          logIncident({
            useCaseId: useCase.id,
            solution: useCase.title,
            level: logDiagnosis.dependency ? 'dependency_error' : 'azure_log_error',
            severity: logDiagnosis.severity,
            actionRequired: true,
            dependency: logDiagnosis.dependency,
            category: logDiagnosis.category,
            message: `${logDiagnosis.dependency ? `${logDiagnosis.dependency} failure` : 'Azure application error'} detected while the app is ${appIsDown ? 'unavailable' : 'reachable'}: ${log.Message}`,
            azureError: log,
            remediation: logDiagnosis.action,
          });
        }

        // Notification dedupe is handled inside maybeNotifyOwner. Calling it
        // after reconciliation keeps state and alerting independent.
        await maybeNotifyOwner(useCase, record, current);
      } else if (persistentLatch || (['degraded', 'inactive', 'stopped'].includes(existing.status) && existing.dependencyIncidentLatched)) {
        // Automatic recovery: a historical incident must not keep an application
        // Unavailable forever. Include Stopped here because an app may have had
        // a dependency incident before it was stopped. Once Azure confirms the
        // app has restarted, a fresh successful HTTP probe plus clean Log
        // Analytics cycles can validate recovery. A stopped app itself can
        // never accumulate a successful recovery cycle.
        const latch = persistentLatch || existing;
        const lastAvailabilityCheck = new Date(existing.lastChecked || 0).getTime();
        const availabilityCheckIsFresh = Number.isFinite(lastAvailabilityCheck) &&
          Date.now() - lastAvailabilityCheck <= Math.max(90 * 1000, HEALTH_CHECK_INTERVAL_MS * 3);
        const hasExplicitProbeStatus = Object.prototype.hasOwnProperty.call(existing, 'probeStatusCode');
        const rawProbeStatusCode = hasExplicitProbeStatus
          ? existing.probeStatusCode
          : existing.statusCode;
        const probeStatusCode = rawProbeStatusCode == null ? null : Number(rawProbeStatusCode);
        const probeSucceeded = probeStatusCode != null && isSuccessfulProbeStatus(probeStatusCode);
        const platform403 = existing.probeAccessRestrictedByAzure === true ||
          (probeStatusCode === 403 &&
            /access restriction|blocked the (?:worker )?probe|monitoring worker/i.test(
              String(existing.monitoringNote || existing.lastError?.errorMessage || '')
            ));
        const noHttpResponse = rawProbeStatusCode == null ||
          existing.probeErrorType === 'network_error' ||
          existing.probeErrorType === 'timeout';
        const probeCannotReachApp = noHttpResponse ||
          (Number.isFinite(probeStatusCode) && probeStatusCode >= 500) ||
          platform403;
        // A confirmed Azure App Service access-restriction 403 is generated
        // before the request reaches the application. It must not prevent
        // recovery for any monitored app. In that case use two consecutive,
        // successful Log Analytics reconciliations with no fresh actionable
        // failures as the recovery signal. Do not require ARM site-read access:
        // that permission is independent of application health and was
        // preventing recovery when the monitoring identity could not read
        // Microsoft.Web/sites runtime state.
        //
        // For other no-response/5xx probe failures, retain the existing
        // opt-in policy because those responses may represent a real outage.
        const telemetryRecoveryEnabled = platform403 ||
          (probeCannotReachApp && useCase.allowTelemetryRecoveryWhenProbeBlocked === true);
        // Required settings must be positively inspected before recovery.
        // An unknown settings result is a monitoring limitation, not proof of
        // failure and not proof of health; retain the last confirmed state.
        const recoverySettings = telemetryRecoveryEnabled
          ? await checkRequiredAppSettings(useCase)
          : { ok: true, unknown: false };
        const telemetryQuerySucceeded = result?.configured === true &&
          result?.apps && Object.prototype.hasOwnProperty.call(result.apps, useCase.id);
        const requiredSettingsNotMissing =
          (!Array.isArray(recoverySettings.errors) || recoverySettings.errors.length === 0) &&
          recoverySettings.ok === true && recoverySettings.unknown !== true;
        const telemetryRecoveryHealthy = telemetryRecoveryEnabled &&
          telemetryQuerySucceeded &&
          requiredSettingsNotMissing;
        // A platform-generated App Service 403 is itself recorded by the
        // probe layer as http_probe_unavailable. That status source must not
        // block recovery once a successful Log Analytics query confirms there
        // are no fresh application/dependency failures and required settings
        // are not confirmed missing. Keep all evidence gates below intact.
        const inactiveStateCanRecover =
          existing.status !== 'inactive' ||
          ['azure_monitor', 'azure_app_settings', 'recovery_validation'].includes(existing.statusSource) ||
          platform403;
        // A stopped record cannot be cleared by clean logs alone: verify that
        // every explicitly mapped App Service role has restarted. This is
        // especially important for Resume Creator, whose frontend can be
        // Running while its backend remains stopped (or vice versa).
        let mappedRuntimeRecoveryVerified = false;
        if (existing.status === 'stopped' &&
            telemetryRecoveryHealthy &&
            Array.isArray(useCase.recoveryRuntimeRoles) &&
            useCase.recoveryRuntimeRoles.length) {
          try {
            const runtimeEvidence = await getMappedAppServiceRuntimeEvidence(
              useCase,
              useCase.recoveryRuntimeRoles,
            );
            const runtimeDecision = reconcileStoppedProbeAgainstMappedRuntime(
              runtimeEvidence,
              useCase.recoveryRuntimeRoles,
            );
            mappedRuntimeRecoveryVerified = runtimeDecision.classification === 'running';
            if (!mappedRuntimeRecoveryVerified) {
              console.info(
                `[adminHealth] Recovery for ${useCase.id} is waiting for mapped App Service runtime verification: ${runtimeDecision.reason || 'runtime not confirmed running'}`,
              );
            }
          } catch (runtimeError) {
            console.warn(
              `[adminHealth] Could not verify mapped App Service runtime for ${useCase.id}: ${runtimeError.message}`,
            );
          }
        }
        const stoppedAppHasRestarted = existing.status === 'stopped' &&
          (probeSucceeded || mappedRuntimeRecoveryVerified);
        const availabilityHealthy = availabilityCheckIsFresh &&
          (existing.status !== 'stopped' || stoppedAppHasRestarted) &&
          inactiveStateCanRecover &&
          (probeSucceeded || (telemetryRecoveryHealthy && (
            existing.status !== 'stopped' || mappedRuntimeRecoveryVerified
          )));
        const recoverySuccessCycles = availabilityHealthy ? Number(latch.recoverySuccessCycles || 0) + 1 : 0;

        if (availabilityHealthy && recoverySuccessCycles >= RECOVERY_SUCCESS_CYCLES) {
          clearPersistentLatch(useCase.id);
          clearOwnerNotification(useCase.id);
          const recovered = {
            ...existing,
            id: useCase.id,
            title: useCase.title,
            launchUrl: useCase.launchUrl,
            status: 'active',
            consecutiveFailures: 0,
            lastError: null,
            errorSeverity: null,
            actionRequired: false,
            remediation: null,
            dependencyHealth: null,
            dependencyIncidentLatched: false,
            azureErrors: [],
            recoverySuccessCycles: 0,
            statusSource: telemetryRecoveryHealthy
              ? 'telemetry_and_configuration_recovery'
              : 'automatic_recovery',
            monitoringNote: telemetryRecoveryHealthy
              ? `Monitoring note: Azure App Service access restrictions returned HTTP 403 to the monitoring worker. The application is Available based on ${RECOVERY_SUCCESS_CYCLES} consecutive successful Log Analytics checks with no recent actionable or critical application/dependency errors${useCase.requiredAppSettingGroups?.length && recoverySettings.unknown !== true ? ' and required backend settings present' : ''}.${recoverySettings.unknown === true ? ' Required settings could not be independently inspected because Azure configuration access was unavailable; no missing-setting failure was found in the queried telemetry.' : ''} The public URL could not be directly verified by this worker.`
              : null,
            probeAccessRestrictedByAzure: existing.probeAccessRestrictedByAzure === true,
            probeErrorType: existing.probeErrorType || null,
            probeObservedAt: existing.probeObservedAt || null,
            lastChecked: new Date().toISOString(),
            lastNotification: null,
          };
          healthStore.set(useCase.id, recovered);
          logIncident({
            useCaseId: useCase.id,
            solution: useCase.title,
            level: 'resolved',
            severity: 'info',
            actionRequired: false,
            message: `Application automatically recovered after ${RECOVERY_SUCCESS_CYCLES} consecutive healthy availability/log cycles. Previous degraded dependency incident cleared.`,
          });
        } else {
          const retained = {
            ...existing,
            id: useCase.id,
            title: useCase.title,
            launchUrl: useCase.launchUrl,
            status: existing.status === 'stopped' ? 'stopped' : 'inactive',
            actionRequired: true,
            dependencyIncidentLatched: true,
            lastError: latch.lastError || existing.lastError || null,
            errorSeverity: 'critical',
            remediation: latch.remediation || existing.remediation || 'owner_alert',
            dependencyHealth: latch.dependencyHealth || existing.dependencyHealth || {
              status: 'unhealthy',
              failingDependency: latch.lastError?.dependency || 'Application dependency',
              category: latch.lastError?.category || 'application',
              lastChanged: latch.detectedAt || latch.lastError?.timeGenerated || new Date().toISOString(),
            },
            azureErrors: (Array.isArray(latch.azureErrors) && latch.azureErrors.length)
              ? latch.azureErrors.slice(0, 25)
              : (existing.azureErrors || []),
            lastNotification: latch.lastNotification || existing.lastNotification || null,
            recoverySuccessCycles,
            lastRecoveryCheckAt: new Date().toISOString(),
            statusSource: 'recovery_validation',
            monitoringNote: platform403
              ? `Monitoring note: Azure App Service access restrictions returned HTTP 403 to the monitoring worker. The application remains Unavailable while recovery is being validated; ${recoverySuccessCycles} of ${RECOVERY_SUCCESS_CYCLES} required consecutive successful Log Analytics checks have completed with no recent actionable or critical application/dependency errors.`
              : (existing.status === 'stopped' && stoppedAppHasRestarted
                ? `Monitoring note: Azure confirms the application has restarted and its health probe is successful. The previous incident is being cleared after ${recoverySuccessCycles} of ${RECOVERY_SUCCESS_CYCLES} consecutive clean recovery checks.`
                : (existing.monitoringNote || null)),
          };
          persistDependencyLatch(useCase, retained);
          healthStore.set(useCase.id, retained);
        }
      }

      trimProcessedLogKeys(useCase.id, previousKeys);
    }
    return {
      configured: result?.configured === true,
      querySucceeded: result?.configured === true && result?.apps != null,
      apps: result?.apps || null,
      reason: result?.reason || null,
      source: result?.source || 'Azure Log Analytics',
      observedAt: new Date().toISOString(),
    };
  } catch (err) {
    logIncident({
      useCaseId: 'platform',
      solution: 'Azure Monitor',
      level: 'log_query_failed',
      severity: 'urgent',
      actionRequired: true,
      message: `Azure error monitor failed: ${err.message}`,
    });
    return { configured: true, querySucceeded: false, apps: null, reason: err.message };
  }
}

let logMonitorInFlight = null;
let logMonitorInFlightKey = '';
let lastLogMonitorAt = 0;
let lastLogMonitorKey = '';
let lastLogMonitorResult = null;

// Log reconciliation is shared by scheduled checks, manual investigations and
// restricted-probe recovery. Coalesce overlapping calls and briefly reuse a
// just-completed identical query so each 403/timeout probe cannot trigger a new
// platform-wide Log Analytics query for all applications.
async function monitorApplicationLogs(useCases, minutes = STATUS_LOG_WINDOW_MINUTES) {
  const key = `${minutes}:${useCases.map((item) => item.id).sort().join(',')}`;
  if (logMonitorInFlight) {
    if (logMonitorInFlightKey === key) return logMonitorInFlight;
    await logMonitorInFlight;
    return monitorApplicationLogs(useCases, minutes);
  }
  if (lastLogMonitorResult && lastLogMonitorKey === key && Date.now() - lastLogMonitorAt < 15000) {
    return lastLogMonitorResult;
  }
  const task = monitorApplicationLogsInternal(useCases, minutes);
  logMonitorInFlight = task;
  logMonitorInFlightKey = key;
  try {
    const result = await task;
    lastLogMonitorAt = Date.now();
    lastLogMonitorKey = key;
    lastLogMonitorResult = result;
    return result;
  } finally {
    if (logMonitorInFlight === task) {
      logMonitorInFlight = null;
      logMonitorInFlightKey = '';
    }
  }
}

function processedLogKeysFor(id) {
  if (!processedLogKeys.has(id)) processedLogKeys.set(id, new Set());
  return processedLogKeys.get(id);
}

function trimProcessedLogKeys(id, set) {
  if (set.size <= 500) return;
  const values = Array.from(set);
  processedLogKeys.set(id, new Set(values.slice(-250)));
}

async function investigateApplication(useCase) {
  // Manual Investigate is a reconciliation action, not only an HTTP probe.
  // Re-check availability AND the current Azure Monitor evidence. Historical
  // rows remain in Complete Error Logs, but they must not keep the live status
  // degraded when the application is reachable and no actionable event is
  // present in the current monitoring window.
  const investigationStartedAt = Date.now();
  const probe = await runCheck(useCase);

  if (!process.env.AZURE_LOG_ANALYTICS_WORKSPACE_ID) return probe;

  try {
    const result = await azureLogs.getErrorsForApplications([useCase], STATUS_LOG_WINDOW_MINUTES, 100);
    const errors = Array.isArray(result.apps?.[useCase.id]) ? result.apps[useCase.id] : [];
    const genericFreshCutoffMs = Date.now() - Math.max(60 * 1000, LOG_MONITOR_INTERVAL_MS * 2, ACTIONABLE_ERROR_FRESHNESS_MS);
    const advisorNeo4jFreshCutoffMs = Date.now() - Math.max(
      STATUS_LOG_WINDOW_MINUTES * 60 * 1000,
      ACTIONABLE_ERROR_FRESHNESS_MS
    );
    const currentActionable = errors.filter((e) => {
      const advisorNeo4jFailure =
        useCase.id === 'advisor-intelligence' &&
        advisorNeo4jFailurePattern.test(String(e.Message || ''));
      if (!isActionableSeverity(e.Severity || e.Level) && !advisorNeo4jFailure) return false;
      const ts = new Date(e.TimeGenerated || 0).getTime();
      const cutoffMs = advisorNeo4jFailure ? advisorNeo4jFreshCutoffMs : genericFreshCutoffMs;
      return Number.isFinite(ts) && ts >= cutoffMs;
    });

    // If fresh evidence still exists, use the normal monitor reconciliation so
    // the application remains Degraded with the actual current evidence.
    if (currentActionable.length) {
      await monitorApplicationLogs([useCase], STATUS_LOG_WINDOW_MINUTES);
      return healthStore.get(useCase.id) || probe;
    }

    const current = healthStore.get(useCase.id) || probe;
    const currentStatusCode = Number(current.statusCode);
    const currentProbeStatusCode = Number(current.probeStatusCode);
    const currentProbeAt = new Date(current.lastChecked || 0).getTime();
    const stoppedStateRecovered = current.status === 'stopped' &&
      isSuccessfulProbeStatus(currentProbeStatusCode) &&
      Number.isFinite(currentProbeAt) &&
      currentProbeAt >= investigationStartedAt;
    const reachable = (current.status !== 'stopped' || stoppedStateRecovered) &&
      current.status !== 'inactive' &&
      (stoppedStateRecovered ||
        current.statusCode == null ||
        (currentStatusCode >= 200 && currentStatusCode < 400));

    if (reachable) {
      const previous = getPersistentLatch(useCase.id) || current;
      clearPersistentLatch(useCase.id);
      clearOwnerNotification(useCase.id);
      const recovered = {
        ...current,
        status: 'active',
        consecutiveFailures: 0,
        lastError: null,
        errorSeverity: null,
        actionRequired: false,
        remediation: null,
        dependencyHealth: null,
        dependencyIncidentLatched: false,
        azureErrors: [],
        recoverySuccessCycles: 0,
        statusSource: 'manual_investigation_recovery',
        lastChecked: new Date().toISOString(),
        lastNotification: null,
      };
      healthStore.set(useCase.id, recovered);
      if (previous?.dependencyIncidentLatched || previous?.status === 'degraded') {
        logIncident({
          useCaseId: useCase.id,
          solution: useCase.title,
          level: 'resolved',
          severity: 'info',
          actionRequired: false,
          message: 'Investigation verified recovery: application is reachable and no current actionable Azure Monitor dependency/error evidence remains. Historical evidence is retained in Complete Error Logs.',
        });
      }
      return recovered;
    }

    return current;
  } catch (err) {
    // A Log Analytics query failure must not falsely clear an existing incident.
    return healthStore.get(useCase.id) || probe;
  }
}

async function runCheckAll(useCases) {
  // Guard against an overlapping sweep: if the background coordinator and a
  // manual "Check All" (or two manual clicks) land at the same time, the second
  // caller waits for the first sweep rather than duplicating outbound probes.
  if (sweepInFlight) {
    while (sweepInFlight) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(200);
    }
    return getHealthSnapshot(useCases);
  }

  sweepInFlight = true;
  try {
    const targets = useCases.filter((uc) => uc.launchUrl);
    // Manual Check All must reconcile Azure Log Analytics as well as public
    // URL probes. The background coordinator may already have run the same
    // query; monitorApplicationLogs coalesces/caches identical recent calls.
    // A query failure is diagnostic only and must never clear or fabricate a
    // health transition.
    try {
      await monitorApplicationLogs(targets, STATUS_LOG_WINDOW_MINUTES);
    } catch (logError) {
      logIncident({
        useCaseId: 'platform',
        solution: 'Azure Monitor',
        level: 'log_query_failed',
        severity: 'high',
        actionRequired: false,
        message: `Manual health sweep could not reconcile Azure Log Analytics: ${logError.message}`,
      });
    }
    // Bound concurrency. Launching every app simultaneously can create an
    // avoidable burst of outbound probes, ARM calls and Log Analytics queries.
    // A stopped app must not create a monitoring burst that destabilizes peers.
    const results = new Array(targets.length);
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(HEALTH_CHECK_CONCURRENCY, targets.length) }, async () => {
      while (nextIndex < targets.length) {
        const index = nextIndex++;
        results[index] = await runCheck(targets[index]);
      }
    });
    await Promise.all(workers);
    return results;
  } finally {
    sweepInFlight = false;
  }
}

function getHealthSnapshot(useCases) {
  const persistent = readPersistentLatches();
  return useCases
    .filter((uc) => uc.launchUrl)
    .map((uc) => {
      const storedCurrent = healthStore.get(uc.id);
      const current = storedCurrent ? { ...storedCurrent } : {
        id: uc.id, title: uc.title, launchUrl: uc.launchUrl,
        status: 'checking', lastChecked: null, latencyMs: null, statusCode: null,
        consecutiveFailures: 0, lastError: null, errorSeverity: null, actionRequired: false, remediation: null, dependencyHealth: null, azureErrors: [], autoFixAttempts: [], lastNotification: null,
        owner: uc.owner || null, ownerEmail: uc.ownerEmail || null,
      };
      if (['degraded', 'restricted', 'monitoring_error', 'partially_available', 'partial'].includes(current.status)) {
        current.status = 'inactive';
        current.statusSource = current.statusSource || 'health_state_migration';
        if (!current.lastError) {
          current.lastError = {
            errorType: 'health_check_unconfirmed',
            errorMessage: 'Application functionality could not be confirmed by the health monitor.',
          };
        }
        current.errorSeverity = current.errorSeverity || 'critical';
        current.actionRequired = true;
      }
      if (!['active', 'inactive', 'stopped', 'checking'].includes(current.status)) {
        current.status = 'inactive';
        current.statusSource = current.statusSource || 'three_state_normalization';
      }
      const currentProbeStatusValue = Object.prototype.hasOwnProperty.call(current, 'probeStatusCode')
        ? current.probeStatusCode
        : current.statusCode;
      const currentProbeStatus = currentProbeStatusValue == null ? NaN : Number(currentProbeStatusValue);
      // A platform-generated App Service access-restriction 403 is not an
      // application response: Azure blocks the monitoring worker before the
      // request reaches the site. resolveAzureAccessRestrictedProbe() has
      // already reconciled fresh Log Analytics evidence and recorded this
      // explicit source. Preserve that reconciled Available state here rather
      // than converting every healthy, IP-restricted app to Unavailable on
      // every dashboard refresh. A normal app-generated 401/403 (or an
      // unclassified 403) remains Unavailable.
      const isConfirmedAzureAccessRestriction =
        currentProbeStatus === 403 &&
        (
          ['azure_runtime_access_restricted', 'azure_access_restriction_unverified'].includes(current.statusSource) ||
          (['telemetry_and_configuration_recovery', 'telemetry_recovery', 'automatic_recovery'].includes(current.statusSource) &&
            current.probeAccessRestrictedByAzure === true)
        );
      if (current.status === 'active' && [401, 403].includes(currentProbeStatus) &&
          !isConfirmedAzureAccessRestriction) {
        current.status = 'inactive';
        current.statusSource = 'http_probe_unavailable';
        current.lastError = {
          errorType: 'http_error',
          errorMessage: `Health probe received HTTP ${currentProbeStatus || 'no response'}; application availability cannot be confirmed.`,
          statusCode: currentProbeStatus || null,
        };
        current.errorSeverity = 'critical';
        current.actionRequired = true;
        current.remediation = 'Restore application availability';
        current.monitoringNote = current.lastError.errorMessage;
      }
      const latch = persistent[uc.id]?.active ? persistent[uc.id] : null;
      const lastErrorStatus = isPrimaryAppServiceError(latch?.lastError, uc)
        ? Number(latch?.lastError?.statusCode)
        : 0;
      const currentProbeAt = new Date(current.lastChecked || 0).getTime();
      const outageEvidenceAt = new Date(latch?.lastError?.timeGenerated || latch?.detectedAt || 0).getTime();
      const currentProbeSucceeded = isSuccessfulProbeStatus(currentProbeStatus) &&
        Number.isFinite(currentProbeAt);
      const currentTime = Date.now();
      const recentSuccessfulProbe = currentProbeSucceeded &&
        currentProbeAt <= currentTime &&
        currentTime - currentProbeAt <= Math.max(90 * 1000, HEALTH_CHECK_INTERVAL_MS * 3);
      const currentProbeAfterLatch = !latch ||
        (Number.isFinite(currentProbeAt) && Number.isFinite(outageEvidenceAt) && currentProbeAt > outageEvidenceAt);
      const successfulProbeSupersedesLatch = latch && isHttpAvailabilityLatch(latch, uc) &&
        currentProbeSucceeded && currentProbeAfterLatch;
      const successfulProbeSupersedesStopped = current.status === 'stopped' &&
        recentSuccessfulProbe && currentProbeAfterLatch &&
        (!latch || isHttpAvailabilityLatch(latch, uc));
      if (successfulProbeSupersedesLatch || successfulProbeSupersedesStopped) {
        current.status = 'active';
        current.statusCode = currentProbeStatus;
        current.probeStatusCode = currentProbeStatus;
        current.statusSource = 'http_probe_reachable';
        current.lastError = null;
        current.errorSeverity = null;
        current.actionRequired = false;
        current.remediation = null;
        current.dependencyHealth = null;
        current.dependencyIncidentLatched = false;
        current.lastNotification = null;
      }
      if (successfulProbeSupersedesLatch || successfulProbeSupersedesStopped) {
        clearPersistentLatch(uc.id);
        clearOwnerNotification(uc.id);
        healthStore.set(uc.id, current);
      }
      const latchedHttpStatus = currentProbeSucceeded && currentProbeAfterLatch
        ? null
        : (lastErrorStatus >= 500 && lastErrorStatus <= 599
          ? lastErrorStatus
          : httpServerErrorStatusCode(Array.isArray(latch?.azureErrors) ? latch.azureErrors : [], uc));
      const telemetryRecoveryInProgress =
        current.statusSource === 'recovery_validation' &&
        Number(current.recoverySuccessCycles || 0) > 0;
      if (latch && !telemetryRecoveryInProgress &&
          latchedHttpStatus >= 500 && latchedHttpStatus <= 599 &&
          current.status !== 'stopped') {
        const unavailable = {
          ...current,
          status: 'inactive',
          statusCode: latchedHttpStatus,
          lastError: latch.lastError || current.lastError,
          errorSeverity: latch.errorSeverity || current.errorSeverity || 'critical',
          actionRequired: true,
          remediation: latch.remediation || current.remediation || 'owner_alert',
          dependencyHealth: latch.dependencyHealth || current.dependencyHealth,
          azureErrors: (Array.isArray(latch.azureErrors) && latch.azureErrors.length)
            ? latch.azureErrors.slice(0, 25)
            : (current.azureErrors || []),
        };
        healthStore.set(uc.id, unavailable);
        return healthStore.get(uc.id) || unavailable;
      }
      if (!latch || current.status === 'stopped' || current.status === 'inactive' ||
          telemetryRecoveryInProgress) return current;

      // Current recovered state is authoritative. Once recovery validation has
      // cleared dependencyIncidentLatched/actionRequired, a stale persisted
      // latch must never re-degrade the application on the next snapshot.
      if (current.status === 'active' && current.dependencyIncidentLatched === false &&
          current.actionRequired === false && currentProbeAfterLatch) {
        clearPersistentLatch(uc.id);
        clearOwnerNotification(uc.id);
        const recovered = {
          ...current,
          lastError: null,
          errorSeverity: null,
          remediation: null,
          dependencyHealth: null,
          azureErrors: [],
          lastNotification: null,
        };
        healthStore.set(uc.id, recovered);
        return healthStore.get(uc.id) || recovered;
      }
      return {
        ...current,
        status: 'inactive',
        actionRequired: true,
        dependencyIncidentLatched: true,
        lastError: latch.lastError || current.lastError,
        errorSeverity: (latch.dependencyHealth?.status === 'unhealthy' || current.dependencyHealth?.status === 'unhealthy' || latch.status === 'degraded') ? 'critical' : (latch.errorSeverity || current.errorSeverity || 'high'),
        remediation: latch.remediation || current.remediation || 'owner_alert',
        dependencyHealth: latch.dependencyHealth || current.dependencyHealth || {
          status: 'unhealthy',
          failingDependency: latch.lastError?.dependency || 'Application dependency',
          category: latch.lastError?.category || 'application',
          lastChanged: latch.detectedAt || new Date().toISOString(),
        },
        azureErrors: (Array.isArray(latch.azureErrors) && latch.azureErrors.length)
          ? latch.azureErrors.slice(0, 25)
          : (current.azureErrors || []),
        lastNotification: latch.lastNotification || current.lastNotification || null,
      };
    });
}

function getIncidents(limit = 50) {
  const persistent = readPersistentLatches();
  return incidentLog.slice(0, limit).map((incident) => {
    const latch = incident?.useCaseId ? persistent[incident.useCaseId] : null;
    const current = incident?.useCaseId ? healthStore.get(incident.useCaseId) : null;
    const criticalDependency = Boolean(
      (latch?.active && ['degraded', 'inactive'].includes(latch?.status) && (latch?.dependencyHealth?.status === 'unhealthy' || latch?.dependencyIncidentLatched !== false)) ||
      (['degraded', 'inactive'].includes(current?.status) && current?.dependencyHealth?.status === 'unhealthy')
    );
    return criticalDependency
      ? { ...incident, severity: 'critical', actionRequired: true }
      : incident;
  });
}

/** Kick off periodic background monitoring. Returns a stop() function. */
function startMonitoring(useCases, intervalMs = HEALTH_CHECK_INTERVAL_MS) {
  // One coordinator owns periodic health + telemetry work. The old independent
  // timers could overlap a full HTTP sweep with a full Log Analytics sweep.
  let stopped = false;
  let cycleInFlight = false;
  let lastLogMonitorAt = 0;

  const runCycle = async (rehydrate = false) => {
    if (stopped || cycleInFlight) return;
    cycleInFlight = true;
    try {
      if (rehydrate || Date.now() - lastLogMonitorAt >= LOG_MONITOR_INTERVAL_MS) {
        await monitorApplicationLogs(
          useCases,
          rehydrate ? INCIDENT_REHYDRATE_WINDOW_MINUTES : STATUS_LOG_WINDOW_MINUTES
        );
        lastLogMonitorAt = Date.now();
      }
      if (!stopped) await runCheckAll(useCases);
    } catch (err) {
      console.warn(`[adminHealth] Coordinated monitoring cycle failed: ${err.message}`);
    } finally {
      cycleInFlight = false;
    }
  };

  const kickoff = setTimeout(() => runCycle(true), 3000);
  const interval = setInterval(() => runCycle(false), intervalMs);
  return () => {
    stopped = true;
    clearTimeout(kickoff);
    clearInterval(interval);
  };
}

module.exports = {
  runCheck,
  investigateApplication,
  runCheckAll,
  getHealthSnapshot,
  getIncidents,
  startMonitoring,
  // Exported for deterministic integration tests/diagnostics.
  monitorApplicationLogs,
  notifyOwner,
  notifyRecoveryOwner,
  checkRequiredAppSettings,
  isFreshActionableHealthLog,
  canRecoverStoppedWithInconclusiveSettings,
  reconcileStoppedProbeAgainstMappedRuntime,
  // Exposed for local regression tests; not surfaced through any HTTP route.
  healthStore,
};
