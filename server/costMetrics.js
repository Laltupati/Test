/**
 * Azure Cost Intelligence for Admin > Usage & Cost.
 *
 * Supports multiple resource groups associated with GenAI Playground apps.
 * Data sources:
 *   - Azure Cost Management: billed month-to-date cost + daily trend.
 *   - Azure Resource Manager: resource inventory per resource group.
 *   - Azure Monitor Metrics: Azure OpenAI token/request/cache telemetry.
 *
 * Required:
 *   AZURE_SUBSCRIPTION_ID
 *
 * Resource-group discovery (first non-empty sources are merged):
 *   AZURE_COST_RESOURCE_GROUPS="rg-one,rg-two"
 *   AZURE_COST_RESOURCE_GROUP=<legacy single RG>
 *   useCase.azureResourceGroup / useCase.azureResources[].resourceGroup
 *   AZURE_APP_RESOURCE_MAP_JSON entries with resourceGroup/resourceGroups
 *
 * RBAC for the monitoring App Service managed identity:
 *   - Cost Management Reader on each monitored RG (or subscription)
 *   - Reader on each monitored RG
 *   - Monitoring Reader on Azure OpenAI resources (or containing RGs)
 */

const { getAccessToken } = require('./azureCredential');

const SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID;
const LEGACY_RESOURCE_GROUP = process.env.AZURE_COST_RESOURCE_GROUP;
const BUDGET_NAME = process.env.AZURE_BUDGET_NAME;
const BUDGET_OVERRIDE = Number(process.env.AZURE_COST_MONTHLY_BUDGET || 0) || null;
const CACHE_TTL_MS = Number(process.env.AZURE_COST_CACHE_TTL_MS || 5 * 60 * 1000);
const COST_RETRY_ATTEMPTS = Math.max(1, Number(process.env.AZURE_COST_RETRY_ATTEMPTS || 2));
const COST_RETRY_BASE_MS = Math.max(500, Number(process.env.AZURE_COST_RETRY_BASE_MS || 3000));
const COST_THROTTLE_COOLDOWN_MS = Math.max(5 * 60 * 1000, Number(process.env.AZURE_COST_THROTTLE_COOLDOWN_MS || 10 * 60 * 1000));
const COST_API_VERSION = process.env.AZURE_COST_API_VERSION || '2025-03-01';
const COST_CACHE_FILE = process.env.AZURE_COST_CACHE_FILE || '/home/data/genai-playground-cost-cache.json';
const COST_THROTTLE_FILE = process.env.AZURE_COST_THROTTLE_FILE || '/home/data/genai-playground-cost-throttle.json';
const COST_DETAILS_API_VERSION = process.env.AZURE_COST_DETAILS_API_VERSION || '2025-03-01';
const COST_DETAILS_STATE_FILE = process.env.AZURE_COST_DETAILS_STATE_FILE || '/home/data/genai-playground-cost-details-state.json';
const COST_DETAILS_POLL_MIN_MS = Math.max(5000, Number(process.env.AZURE_COST_DETAILS_POLL_MIN_MS || 15000));
// By default, Usage & Cost covers the entire Azure subscription so new resource
// groups automatically appear without another App Service configuration change.
// Set AZURE_COST_INCLUDE_ALL_RESOURCE_GROUPS=false to restore configured-RG-only scope.
const INCLUDE_ALL_RESOURCE_GROUPS = String(process.env.AZURE_COST_INCLUDE_ALL_RESOURCE_GROUPS || 'true').toLowerCase() !== 'false';

const cache = new Map();
const lastSuccessful = new Map();
let costThrottleUntil = 0;
const costDetailsJobs = new Map();

function hasUsableCostSnapshot(data) {
  if (!data || data.configured === false || data.costAvailable === false) return false;
  const hasTotal = data.totalCost != null && Number.isFinite(Number(data.totalCost));
  const hasDaily = Array.isArray(data.dailyCost) && data.dailyCost.length > 0;
  const hasService = Array.isArray(data.byService) && data.byService.length > 0;
  const hasRegion = Array.isArray(data.byRegion) && data.byRegion.length > 0;
  // Persistent cache is used as the stable dashboard fallback, so only accept
  // snapshots that can render the complete resource-cost dashboard.
  return hasTotal && hasDaily && hasService && hasRegion;
}

function loadPersistentCostCache() {
  try {
    const fs = require('fs');
    if (!fs.existsSync(COST_CACHE_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(COST_CACHE_FILE, 'utf8'));
    for (const [key, entry] of Object.entries(parsed || {})) {
      if (!entry?.data || !hasUsableCostSnapshot(entry.data)) continue;
      lastSuccessful.set(key, entry.data);
      cache.set(key, { at: Number(entry.at || 0), data: entry.data });
    }
  } catch (err) {
    console.warn('[cost] Unable to read persistent cost cache:', err.message);
  }
}

function persistSuccessfulCostCache(key, data) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(COST_CACHE_FILE);
    fs.mkdirSync(dir, { recursive: true });
    let existing = {};
    try { if (fs.existsSync(COST_CACHE_FILE)) existing = JSON.parse(fs.readFileSync(COST_CACHE_FILE, 'utf8')) || {}; } catch { existing = {}; }
    existing[key] = { at: Date.now(), data };
    const entries = Object.entries(existing).sort((a,b) => Number(b[1]?.at||0) - Number(a[1]?.at||0)).slice(0, 12);
    fs.writeFileSync(COST_CACHE_FILE, JSON.stringify(Object.fromEntries(entries)));
  } catch (err) {
    console.warn('[cost] Unable to persist cost cache:', err.message);
  }
}

function loadPersistentThrottleState() {
  try {
    const fs = require('fs');
    if (!fs.existsSync(COST_THROTTLE_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(COST_THROTTLE_FILE, 'utf8'));
    const until = Number(parsed?.until || 0);
    if (until > Date.now()) {
      // Do not let a throttle window written by an older build hold the new
      // deployment for 30+ minutes. Keep protection, but cap the restored
      // window to the current configured cooldown.
      costThrottleUntil = Math.min(until, Date.now() + COST_THROTTLE_COOLDOWN_MS);
    }
  } catch (err) {
    console.warn('[cost] Unable to read throttle state:', err.message);
  }
}

function persistThrottleState() {
  try {
    const fs = require('fs');
    const path = require('path');
    fs.mkdirSync(path.dirname(COST_THROTTLE_FILE), { recursive: true });
    fs.writeFileSync(COST_THROTTLE_FILE, JSON.stringify({ until: costThrottleUntil, updatedAt: new Date().toISOString() }));
  } catch (err) {
    console.warn('[cost] Unable to persist throttle state:', err.message);
  }
}


function loadPersistentCostDetailsState() {
  try {
    const fs = require('fs');
    if (!fs.existsSync(COST_DETAILS_STATE_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(COST_DETAILS_STATE_FILE, 'utf8')) || {};
    for (const [key, job] of Object.entries(parsed)) {
      if (!job || !job.location) continue;
      costDetailsJobs.set(key, job);
    }
  } catch (err) {
    console.warn('[cost] Unable to read Cost Details state:', err.message);
  }
}

function persistCostDetailsState() {
  try {
    const fs = require('fs');
    const path = require('path');
    fs.mkdirSync(path.dirname(COST_DETAILS_STATE_FILE), { recursive: true });
    fs.writeFileSync(COST_DETAILS_STATE_FILE, JSON.stringify(Object.fromEntries(costDetailsJobs)));
  } catch (err) {
    console.warn('[cost] Unable to persist Cost Details state:', err.message);
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); if (row.some(v => v !== '')) rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  row.push(field.replace(/\r$/, ''));
  if (row.some(v => v !== '')) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(h => String(h || '').trim());
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
}

function firstField(obj, names) {
  for (const name of names) {
    const key = Object.keys(obj).find(k => k.toLowerCase() === name.toLowerCase());
    if (key && obj[key] !== '' && obj[key] != null) return obj[key];
  }
  return null;
}

function parseCostNumber(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function normalizeCostDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const ymdCompact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymdCompact) return `${ymdCompact[1]}-${ymdCompact[2]}-${ymdCompact[3]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) return `${mdy[3]}-${String(mdy[1]).padStart(2,'0')}-${String(mdy[2]).padStart(2,'0')}`;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw.slice(0, 10) : d.toISOString().slice(0, 10);
}

function normalizeCostDetailsRows(csvRows, resourceGroups, allSubscriptionResourceGroups) {
  const wanted = new Set((resourceGroups || []).map(rgKey));
  return (csvRows || []).map(r => {
    const resourceId = firstField(r, ['ResourceId', 'InstanceId', 'InstanceName']);
    const resourceGroup = firstField(r, ['ResourceGroup', 'ResourceGroupName', 'resourceGroupName']) || rgNameFromResourceId(resourceId);
    const billingCost = parseCostNumber(firstField(r, ['CostInBillingCurrency', 'PreTaxCost', 'Cost', 'costInBillingCurrency']));
    const costUsdRaw = firstField(r, ['CostInUSD', 'costInUsd', 'CostUSD']);
    const currency = firstField(r, ['BillingCurrency', 'BillingCurrencyCode', 'Currency', 'billingCurrency']) || (costUsdRaw != null ? 'USD' : 'USD');
    const amount = Number.isFinite(billingCost) ? billingCost : 0;
    return {
      date: normalizeCostDate(firstField(r, ['Date', 'UsageDateTime', 'UsageDate'])),
      resourceGroup,
      resourceId: resourceId || null,
      resourceName: firstField(r, ['ResourceName', 'InstanceName']) || (resourceId ? String(resourceId).split('/').pop() : null),
      resourceType: firstField(r, ['ResourceType']) || 'Unknown',
      resourceLocation: firstField(r, ['ResourceLocation', 'Location', 'resourceLocation']) || null,
      serviceName: firstField(r, ['ServiceName', 'ConsumedService', 'MeterCategory', 'ServiceFamily']) || 'Unknown',
      serviceTier: firstField(r, ['ServiceTier']) || null,
      meter: firstField(r, ['MeterName', 'Meter']) || null,
      amount,
      costUSD: costUsdRaw != null ? parseCostNumber(costUsdRaw) : (String(currency).toUpperCase() === 'USD' ? amount : null),
      currency,
      chargeType: firstField(r, ['ChargeType']) || null,
    };
  }).filter(r => !r.resourceGroup || allSubscriptionResourceGroups || wanted.has(rgKey(r.resourceGroup)));
}

function aggregateCostDetailsRows(detailRows = []) {
  const resourceMap = new Map();
  const groupMap = new Map();
  const dailyMap = new Map();
  let totalCost = 0;
  let currency = detailRows.find(r => r.currency)?.currency || 'USD';
  for (const row of detailRows) {
    const amount = Number(row.amount || 0);
    totalCost += amount;
    currency = row.currency || currency;
    const rg = row.resourceGroup || 'Unassigned';
    const gk = rgKey(rg) || 'unassigned';
    const g = groupMap.get(gk) || { name: rg, amount: 0, currency };
    g.amount += amount; groupMap.set(gk, g);
    if (row.date) {
      const dk = `${row.date}|${gk}`;
      const d = dailyMap.get(dk) || { date: row.date, resourceGroup: rg, amount: 0, currency };
      d.amount += amount; dailyMap.set(dk, d);
    }
    if (row.resourceId) {
      const rk = `${gk}|${normalizeResourceId(row.resourceId)}|${String(row.serviceName || '')}`;
      const item = resourceMap.get(rk) || {
        resourceGroup: rg, resourceId: row.resourceId, serviceName: row.serviceName,
        resourceType: row.resourceType || 'Unknown', meter: row.meter || null, amount: 0, currency,
      };
      item.amount += amount; resourceMap.set(rk, item);
    }
  }
  return {
    costRows: [...resourceMap.values()].map(x => ({ ...x, amount: round2(x.amount) })),
    dailyRows: [...dailyMap.values()].map(x => ({ ...x, amount: round2(x.amount) })),
    groupTotals: [...groupMap.values()].map(x => ({ ...x, amount: round2(x.amount) })),
    totalCost: round2(totalCost), currency, detailRows,
    source: 'cost-details-report', warnings: [], throttled: false, costAvailable: true,
  };
}

async function downloadCostDetailsManifest(manifest, resourceGroups, allSubscriptionResourceGroups) {
  const rows = [];
  for (const blob of manifest?.blobs || []) {
    if (!blob?.blobLink) continue;
    const res = await fetch(blob.blobLink);
    if (!res.ok) throw new Error(`Cost Details blob download failed: HTTP ${res.status}`);
    const text = await res.text();
    rows.push(...parseCsv(text));
  }
  return aggregateCostDetailsRows(normalizeCostDetailsRows(rows, resourceGroups, allSubscriptionResourceGroups));
}

function costDetailsJobKey(period) { return `${period.startDate}|${period.endDate}`; }

async function tryCostDetailsReportFallback(resourceGroups, period, allSubscriptionResourceGroups = false) {
  // Generate Cost Details is Microsoft's supported detailed-cost API and is
  // used as a fallback when the interactive Query endpoint is throttled.
  // It supports up to one month per request; the dashboard's current-month and
  // custom intra-month ranges therefore work without issuing per-RG fan-out.
  const start = new Date(`${period.startDate}T00:00:00Z`);
  const end = new Date(`${period.endDate}T00:00:00Z`);
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  if (!sameMonth) return { pending: false, unavailable: true, warning: 'Azure Cost Details fallback supports one calendar month per request; use a range within one month while Cost Query is throttled.' };

  const key = costDetailsJobKey(period);
  let job = costDetailsJobs.get(key);
  const token = await getArmToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const handleResult = async (json) => {
    if (json?.status === 'NoDataFound') return aggregateCostDetailsRows([]);
    if (json?.status === 'Failed') throw new Error('Azure Cost Details report generation failed.');
    if (json?.manifest) {
      const data = await downloadCostDetailsManifest(json.manifest, resourceGroups, allSubscriptionResourceGroups);
      costDetailsJobs.delete(key); persistCostDetailsState();
      return data;
    }
    return null;
  };

  if (job?.location) {
    if (Number(job.nextPollAt || 0) > Date.now()) {
      return { pending: true, retryAfterSeconds: Math.max(5, Math.ceil((job.nextPollAt - Date.now()) / 1000)) };
    }
    const res = await fetch(job.location, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 202) {
      const retry = Math.max(COST_DETAILS_POLL_MIN_MS, Number(res.headers.get('retry-after') || 15) * 1000);
      job = { ...job, nextPollAt: Date.now() + retry, updatedAt: new Date().toISOString() };
      costDetailsJobs.set(key, job); persistCostDetailsState();
      return { pending: true, retryAfterSeconds: Math.ceil(retry / 1000) };
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Azure Cost Details polling failed: HTTP ${res.status} ${txt.slice(0, 240)}`);
    }
    const json = await res.json();
    const completed = await handleResult(json);
    if (completed) return completed;
  }

  const url = `https://management.azure.com${subscriptionScope()}/providers/Microsoft.CostManagement/generateCostDetailsReport?api-version=${COST_DETAILS_API_VERSION}`;
  const res = await fetch(url, {
    method: 'POST', headers,
    body: JSON.stringify({ metric: 'ActualCost', timePeriod: { start: period.startDate, end: period.endDate } }),
  });
  if (res.status === 202) {
    const location = res.headers.get('location');
    const retry = Math.max(COST_DETAILS_POLL_MIN_MS, Number(res.headers.get('retry-after') || 15) * 1000);
    if (!location) throw new Error('Azure Cost Details accepted the report request but returned no polling location.');
    costDetailsJobs.set(key, { location, nextPollAt: Date.now() + retry, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    persistCostDetailsState();
    return { pending: true, retryAfterSeconds: Math.ceil(retry / 1000) };
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Azure Cost Details request failed: HTTP ${res.status} ${txt.slice(0, 240)}`);
  }
  const json = await res.json();
  const completed = await handleResult(json);
  return completed || { pending: true, retryAfterSeconds: 15 };
}

loadPersistentCostCache();
loadPersistentThrottleState();
loadPersistentCostDetailsState();


function isoDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function startOfCurrentMonthUtc() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function normalizePeriod(options = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = String(options.startDate || options.start || startOfCurrentMonthUtc()).slice(0, 10);
  const endDate = String(options.endDate || options.end || today).slice(0, 10);
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const endInclusive = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endInclusive.getTime())) throw new Error('Invalid cost date range. Use YYYY-MM-DD.');
  if (endInclusive < start) throw new Error('Cost date range end date must be on or after the start date.');
  const days = Math.floor((endInclusive - start) / 86400000) + 1;
  if (days > 366) throw new Error('Cost date range cannot exceed 366 days.');
  const endExclusive = new Date(endInclusive.getTime() + 86400000);
  return {
    startDate,
    endDate,
    from: start.toISOString(),
    to: endExclusive.toISOString(),
    days,
    label: `${startDate} to ${endDate}`,
  };
}

function customTimeframe(period) {
  return { timeframe: 'Custom', timePeriod: { from: period.from, to: period.to } };
}

function cacheKey(period, resourceGroups) {
  return `${period.startDate}|${period.endDate}|${(resourceGroups || []).map(rgKey).sort().join(',')}`;
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function fmtMoney(amount, currency) { return `${currency || 'USD'} ${round2(amount).toFixed(2)}`; }
function roundPct(n) { return Math.round((Number(n) || 0) * 10) / 10; }
function norm(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function unique(values) { return [...new Set(values.filter(Boolean).map(v => String(v).trim()).filter(Boolean))]; }

// Azure resource-group names are case-insensitive. Keep the first/canonical
// spelling we discover, but never treat casing variants as different groups.
// Cost Management and ARM occasionally differ on a trailing slash even
// though they refer to the same resource; normalize both sides before
// keying off resourceId so cost rows don't silently fail to attach to a
// resource (which otherwise renders as a real, believable-looking $0.00).
function normalizeResourceId(id) { return String(id || '').trim().replace(/\/+$/, '').toLowerCase(); }

function isSameOrDescendantResourceId(parentId, candidateId) {
  const parent = normalizeResourceId(parentId);
  const candidate = normalizeResourceId(candidateId);
  return !!parent && !!candidate && (candidate === parent || candidate.startsWith(`${parent}/`));
}

function owningOpenAiResourceId(resourceId, openAiResources = []) {
  const match = (openAiResources || []).find(r => isSameOrDescendantResourceId(r.id, resourceId));
  return match ? normalizeResourceId(match.id) : null;
}

function rgKey(value) { return String(value || '').trim().toLowerCase(); }
function uniqueResourceGroups(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const name = String(value || '').trim();
    const key = rgKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
function sameResourceGroup(a, b) { return rgKey(a) === rgKey(b); }

function parseAppMap() {
  try { return JSON.parse(process.env.AZURE_APP_RESOURCE_MAP_JSON || '{}'); }
  catch { return {}; }
}

function parseGroupList(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try { return unique(JSON.parse(raw)); } catch { /* fall through */ }
  }
  return unique(raw.split(','));
}

function parseConfiguredGroups() {
  // Cost-specific list is authoritative. The plural monitor setting is also
  // accepted as a backwards-compatible fallback because older deployments used
  // AZURE_MONITOR_RESOURCE_GROUPS for their central Azure configuration.
  return uniqueResourceGroups([
    ...parseGroupList(process.env.AZURE_COST_RESOURCE_GROUPS),
    ...parseGroupList(process.env.AZURE_MONITOR_RESOURCE_GROUPS),
  ]);
}

function discoverResourceGroups(useCases = [], appMap = {}) {
  const groups = [...parseConfiguredGroups()];
  if (LEGACY_RESOURCE_GROUP) groups.push(LEGACY_RESOURCE_GROUP);
  if (process.env.AZURE_RESOURCE_GROUP) groups.push(process.env.AZURE_RESOURCE_GROUP);
  if (process.env.AZURE_MONITOR_RESOURCE_GROUP) groups.push(process.env.AZURE_MONITOR_RESOURCE_GROUP);
  for (const app of useCases) {
    if (app.azureResourceGroup) groups.push(app.azureResourceGroup);
    for (const r of app.azureResources || []) if (r.resourceGroup) groups.push(r.resourceGroup);
  }
  for (const cfg of Object.values(appMap || {})) {
    if (!cfg || typeof cfg !== 'object') continue;
    if (cfg.resourceGroup) groups.push(cfg.resourceGroup);
    if (Array.isArray(cfg.resourceGroups)) groups.push(...cfg.resourceGroups);
    for (const r of cfg.resources || []) if (r?.resourceGroup) groups.push(r.resourceGroup);
  }
  return uniqueResourceGroups(groups);
}

function rgScope(resourceGroup) {
  return `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${resourceGroup}`;
}

async function getArmToken() {
  if (!SUBSCRIPTION_ID) throw new Error('AZURE_SUBSCRIPTION_ID is not configured.');
  const token = await getAccessToken('https://management.azure.com/.default');
  if (!token?.token) throw new Error('Azure Managed Identity returned no ARM access token.');
  return token.token;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function retryDelayMs(res, attempt) {
  const retryAfter = Number(res?.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 30000);
  const consumptionRetry = Number(res?.headers?.get?.('x-ms-ratelimit-microsoft.consumption-retry-after'));
  if (Number.isFinite(consumptionRetry) && consumptionRetry > 0) return Math.min(consumptionRetry * 1000, 60 * 60 * 1000);
  const retryAfterMs = Number(res?.headers?.get?.('x-ms-retry-after-ms'));
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) return Math.min(retryAfterMs, 60 * 60 * 1000);
  return Math.min(COST_RETRY_BASE_MS * (2 ** attempt) + Math.floor(Math.random() * 350), 15000);
}

function isCostThrottleError(err) { return Number(err?.status) === 429 || err?.code === 'COST_THROTTLED'; }
function throttleRemainingMs() { return Math.max(0, costThrottleUntil - Date.now()); }
function markCostThrottled(delayMs = COST_THROTTLE_COOLDOWN_MS) {
  // Azure Cost Management throttling is subscription/tenant-side and can last
  // much longer than one browser request. Persist the breaker across App Service
  // restarts/deployments so a restart cannot immediately hammer the API again.
  costThrottleUntil = Math.max(costThrottleUntil, Date.now() + Math.max(5 * 60 * 1000, delayMs));
  persistThrottleState();
}
function cleanAzureError(err) {
  if (!err) return 'Azure request failed.';
  if (isCostThrottleError(err)) {
    const mins = Math.max(1, Math.ceil(throttleRemainingMs() / 60000));
    return `Azure Cost refresh deferred by Azure throttling. Latest available snapshot will be used; next server retry in about ${mins} minute${mins===1?'':'s'}.`;
  }
  try {
    const body = JSON.parse(err.azureBody || '{}');
    const msg = body?.error?.message || body?.message;
    if (msg) return `${err.status || ''} ${msg}`.trim();
  } catch { /* noop */ }
  return String(err.message || err).replace(/\s+/g, ' ').slice(0, 300);
}

async function fetchAzure(url, options = {}, label = 'Azure API') {
  const token = await getArmToken();
  let lastText = '';
  let lastStatus = 0;
  for (let attempt = 0; attempt < COST_RETRY_ATTEMPTS; attempt += 1) {
    const res = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    if (res.ok) return res;
    lastStatus = res.status;
    lastText = await res.text().catch(() => '');
    const retryable = res.status === 429 || res.status === 408 || res.status >= 500;
    if (res.status === 429) {
      const waitMs = retryDelayMs(res, attempt);
      const err = new Error(`${label} failed: 429 ${lastText.slice(0, 500)}`);
      err.status = 429; err.azureBody = lastText; err.retryAfterMs = waitMs;
      throw err;
    }
    if (!retryable || attempt === COST_RETRY_ATTEMPTS - 1) break;
    await sleep(retryDelayMs(res, attempt));
  }
  const err = new Error(`${label} failed: ${lastStatus} ${lastText.slice(0, 500)}`);
  err.status = lastStatus;
  err.azureBody = lastText;
  throw err;
}

async function armJson(url, options = {}) {
  const res = await fetchAzure(url, options, 'Azure API');
  return res.status === 204 ? null : res.json();
}

function isOpenAIResource(r) {
  const type = String(r.type || '').toLowerCase();
  const kind = String(r.kind || '').toLowerCase();
  return type === 'microsoft.cognitiveservices/accounts' && (kind.includes('openai') || kind === 'openai');
}

function tagsFor(r) {
  const tags = r.tags || {};
  return Object.fromEntries(Object.entries(tags).map(([k, v]) => [String(k).toLowerCase(), v]));
}

// Words that show up constantly in KPMG's internal Azure naming convention
// (go-rg-m-dev-inc-kgs-oai01, ue-kgs-*, oai-*-dev, etc.) and carry no
// signal about *which* application a resource belongs to. Stripped before
// doing fuzzy token matching so they don't produce false-positive overlaps.
const NAMING_NOISE_TOKENS = new Set([
  'go', 'rg', 'm', 'dev', 'prod', 'test', 'uat', 'stage', 'staging', 'inc',
  'kgs', 'ue', 'ue2', 'oai', 'app', 'apps', 'svc', 'service', 'openai',
  'web', 'api', 'backend', 'frontend', 'webapp', 'gpt', 'gpt4o', 'gpt4',
]);

function significantTokens(str) {
  return String(str || '')
    .split(/[^a-zA-Z0-9]+/)
    .map(t => t.toLowerCase())
    .filter(t => t.length >= 6 && !/^\d+$/.test(t) && !NAMING_NOISE_TOKENS.has(t));
}

// Purely advisory — surfaced as a hint on otherwise-Unassigned resources so an
// admin can confirm and tag them, but NEVER auto-applied to applicationId.
// A wrong auto-assignment silently mis-attributes billed cost, which is worse
// than an honest "Unassigned"; a single short substring hit (e.g. a resource
// literally named "Dataqualityfinetue" sharing the fragment "data" with
// "natural-language-data-querying") is not enough signal to act on, only to
// suggest. Requires at least two distinct token hits before suggesting.
function suggestApplicationMatch(rn, useCases) {
  const resourceTokens = significantTokens(rn);
  if (!resourceTokens.length) return null;
  let best = null;
  let bestScore = 0;
  for (const u of useCases) {
    const candidateTokens = [...new Set([...significantTokens(u.id), ...significantTokens(u.title)])];
    const score = candidateTokens.filter(t => resourceTokens.some(rt => rt === t)).length;
    if (score > bestScore) { bestScore = score; best = u; }
  }
  return bestScore >= 2 ? best.id : null;
}

function appKeyFromResource(resource, useCases) {
  const tags = tagsFor(resource);
  const tagged = tags.application || tags.app || tags.appid || tags.usecaseid || tags['application-id'] || tags['use-case-id'];
  if (tagged) {
    const match = useCases.find(u => norm(u.id) === norm(tagged) || norm(u.title) === norm(tagged));
    if (match) return match.id;
  }

  const rn = norm(resource.name);
  const explicit = useCases.find(u => (u.azureResources || []).some(x => norm(x.name) === rn));
  if (explicit) return explicit.id;

  const match = useCases.find(u => {
    const title = norm(u.title);
    const id = norm(u.id);
    let host = '';
    try { host = norm(new URL(u.launchUrl || '').hostname.split('.')[0]); } catch { /* noop */ }
    // Azure App Service hostnames commonly append a generated DNS suffix to
    // the ARM site name (for example site-abc123.eastus-01.azurewebsites.net).
    // Treat a clear name/hostname prefix relationship as the same application.
    // Require a reasonably long name to avoid short-prefix false positives.
    const hostMatchesResource = host && rn && (rn === host || (rn.length >= 8 && host.startsWith(rn)) || (host.length >= 8 && rn.startsWith(host)));
    return hostMatchesResource || (id && rn.includes(id)) || (title && title.length >= 7 && rn.includes(title));
  });
  if (match) return match.id;

  // No confident match. Do NOT auto-assign from fuzzy overlap here — see
  // suggestApplicationMatch, used separately as a non-binding hint only.
  return null;
}

function configuredResourceNames(appId, appMap) {
  const item = appMap[appId] || {};
  const names = [...(item.resourceNames || [])];
  for (const r of item.resources || []) if (r?.name) names.push(r.name);
  return new Set(names.map(norm));
}

async function listResourcesForGroup(resourceGroup) {
  let url = `https://management.azure.com${rgScope(resourceGroup)}/resources?api-version=2021-04-01`;
  const out = [];
  while (url) {
    const json = await armJson(url);
    out.push(...(json.value || []).map(r => ({ ...r, resourceGroup })));
    url = json.nextLink || null;
  }
  return out;
}

async function listSubscriptionResourceGroups() {
  let url = `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourcegroups?api-version=2021-04-01`;
  const groups = [];
  while (url) {
    const json = await armJson(url);
    for (const rg of json.value || []) if (rg?.name) groups.push(rg.name);
    url = json.nextLink || null;
  }
  return uniqueResourceGroups(groups);
}

async function listSubscriptionResources() {
  let url = `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resources?api-version=2021-04-01`;
  const out = [];
  while (url) {
    const json = await armJson(url);
    for (const r of json.value || []) {
      const resourceGroup = rgNameFromResourceId(r.id);
      out.push({ ...r, resourceGroup });
    }
    url = json.nextLink || null;
  }
  return out;
}

async function resolveResourceGroupScope(useCases = [], appMap = {}) {
  const configured = discoverResourceGroups(useCases, appMap);
  if (!INCLUDE_ALL_RESOURCE_GROUPS) {
    return { resourceGroups: configured, allSubscriptionResourceGroups: false, discoverySource: 'configured' };
  }
  try {
    const all = await listSubscriptionResourceGroups();
    if (all.length) return { resourceGroups: all, allSubscriptionResourceGroups: true, discoverySource: 'azure-subscription' };
  } catch (err) {
    console.warn('[cost] Unable to enumerate all subscription resource groups; falling back to configured groups:', err.message);
  }
  return { resourceGroups: configured, allSubscriptionResourceGroups: false, discoverySource: 'configured-fallback' };
}

async function costQuery(scope, body) {
  if (throttleRemainingMs() > 0) {
    const err = new Error('Azure Cost Management request skipped during throttle cooldown.');
    err.status = 429; err.code = 'COST_THROTTLED';
    throw err;
  }
  const url = `https://management.azure.com${scope}/providers/Microsoft.CostManagement/query?api-version=${COST_API_VERSION}`;
  let page = await (async () => {
    try {
      const res = await fetchAzure(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, `Cost Management query for ${scope}`);
      return res.json();
    } catch (err) {
      if (Number(err?.status) === 429) markCostThrottled(err.retryAfterMs || COST_THROTTLE_COOLDOWN_MS);
      throw err;
    }
  })();
  // Cost Management paginates via properties.nextLink once a query returns
  // enough rows (common for Daily granularity across many resources/days).
  // Without following it, rows for resource groups that happen to land on
  // page 2+ silently vanish from totals and the trend chart even though the
  // query "succeeded". Merge every page's rows before returning.
  const firstPage = page;
  const rows = [...(page.properties?.rows || [])];
  let guard = 0;
  while (page.properties?.nextLink && guard < 50) {
    guard += 1;
    // Cost Management Query is a POST operation. Azure's nextLink contains the
    // skip token but still expects POST; using the fetch default (GET) returns
    // HTTP 405 and used to truncate meter/detail exports after page 1.
    const res = await fetchAzure(page.properties.nextLink, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, `Cost Management query (page ${guard + 1}) for ${scope}`);
    page = await res.json();
    rows.push(...(page.properties?.rows || []));
  }
  return { ...firstPage, properties: { ...firstPage.properties, nextLink: page.properties?.nextLink || null, rows } };
}

// Scopes a Cost Management query to just the resource groups we care about
// instead of pulling the whole subscription and filtering client-side. This
// keeps result sets small (fewer pages, far less 429 risk) and guarantees
// our resource groups can't be cut off by a row/page limit.
function resourceGroupFilter(resourceGroups) {
  if (!resourceGroups?.length) return undefined;
  return { dimensions: { name: 'ResourceGroupName', operator: 'In', values: resourceGroups } };
}

function subscriptionScope() { return `/subscriptions/${SUBSCRIPTION_ID}`; }

function rgNameFromResourceId(resourceId) {
  const match = String(resourceId || '').match(/\/resourceGroups\/([^/]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

async function querySubscriptionCostSnapshot(resourceGroups, period, allSubscriptionResourceGroups = false) {
  // Keep the primary Cost Management query deliberately compact: one row per
  // resource/service for the selected period, rather than one row per
  // resource/service/day. The previous Daily + ResourceId query produced a
  // high-cardinality result and consumed Cost Management query quota quickly.
  // A separate lightweight daily aggregate is attempted only after this core
  // cost snapshot succeeds, so trend throttling can never blank the totals.
  const rgFilter = allSubscriptionResourceGroups ? undefined : resourceGroupFilter(resourceGroups);
  const body = {
    type: 'ActualCost',
    ...customTimeframe(period),
    dataset: {
      granularity: 'None',
      aggregation: { totalCost: { name: 'PreTaxCost', function: 'Sum' } },
      grouping: [
        { type: 'Dimension', name: 'ResourceGroupName' },
        { type: 'Dimension', name: 'ResourceId' },
        { type: 'Dimension', name: 'ServiceName' },
      ],
      ...(rgFilter ? { filter: rgFilter } : {}),
    },
  };
  const json = await costQuery(subscriptionScope(), body);
  const { idx, rows, costIdx, currencyIdx } = parseCostRows(json);
  const wanted = new Set((resourceGroups || []).map(x => rgKey(x)));
  const resourceMap = new Map();
  const groupTotals = new Map();
  let totalCost = 0;
  let currency = 'USD';

  for (const r of rows) {
    const resourceId = r[idx('ResourceId')] || null;
    const rg = r[idx('ResourceGroupName')] || rgNameFromResourceId(resourceId);
    const amount = Number(r[costIdx] || 0);
    currency = currencyIdx >= 0 ? (r[currencyIdx] || currency) : currency;
    if (!rg || (!allSubscriptionResourceGroups && !wanted.has(rgKey(rg)))) continue;

    // Include every billed row in subscription/RG totals, even when Azure has
    // no ResourceId (credits, taxes, marketplace and similar adjustments).
    totalCost += amount;
    const gkey = rgKey(rg);
    const currentGroup = groupTotals.get(gkey) || { name: rg, amount: 0, currency };
    currentGroup.amount += amount;
    groupTotals.set(gkey, currentGroup);

    if (!resourceId) continue;
    const rkey = `${gkey}|${normalizeResourceId(resourceId)}`;
    const item = resourceMap.get(rkey) || {
      resourceGroup: rg,
      resourceId,
      serviceName: r[idx('ServiceName')] || 'Unknown',
      resourceType: 'Unknown',
      meter: null,
      amount: 0,
      currency,
    };
    item.amount += amount;
    resourceMap.set(rkey, item);
  }

  return {
    costRows: [...resourceMap.values()].map(x => ({ ...x, amount: round2(x.amount) })),
    totalCost: round2(totalCost),
    groupTotals: [...groupTotals.values()].map(x => ({ ...x, amount: round2(x.amount) })),
    currency,
  };
}

async function querySubscriptionDailySnapshot(resourceGroups, period, allSubscriptionResourceGroups = false) {
  const rgFilter = allSubscriptionResourceGroups ? undefined : resourceGroupFilter(resourceGroups);
  const body = {
    type: 'ActualCost',
    ...customTimeframe(period),
    dataset: {
      granularity: 'Daily',
      aggregation: { totalCost: { name: 'PreTaxCost', function: 'Sum' } },
      grouping: [{ type: 'Dimension', name: 'ResourceGroupName' }],
      ...(rgFilter ? { filter: rgFilter } : {}),
    },
  };
  const json = await costQuery(subscriptionScope(), body);
  const { columns, idx, rows, costIdx, currencyIdx } = parseCostRows(json);
  const dateColumn = ['UsageDate', 'Date', 'BillingPeriodStartDate'].find(c => columns.includes(c));
  const wanted = new Set((resourceGroups || []).map(x => rgKey(x)));
  return rows.map(r => ({
    date: dateColumn ? normalizeCostDate(r[idx(dateColumn)]) : '',
    resourceGroup: r[idx('ResourceGroupName')] || 'Unassigned',
    amount: round2(r[costIdx]),
    currency: currencyIdx >= 0 ? (r[currencyIdx] || 'USD') : 'USD',
  })).filter(x => x.date && (allSubscriptionResourceGroups || wanted.has(rgKey(x.resourceGroup))));
}

async function loadCostRows(resourceGroups, period, allSubscriptionResourceGroups = false) {
  const warnings = [];
  try {
    const snapshot = await querySubscriptionCostSnapshot(resourceGroups, period, allSubscriptionResourceGroups);
    let dailyRows = [];
    let throttled = false;
    // Daily trend is useful but non-critical. Keep it as a second, lightweight
    // query so a 429 here never discards the already-successful core cost data.
    try {
      await sleep(1000);
      dailyRows = await querySubscriptionDailySnapshot(resourceGroups, period, allSubscriptionResourceGroups);
    } catch (err) {
      if (isCostThrottleError(err)) {
        throttled = true;
        warnings.push('Daily cost trend refresh was deferred by Azure throttling; core ActualCost totals remain available.');
      } else {
        warnings.push(`Daily cost trend unavailable: ${cleanAzureError(err)}`);
      }
    }
    return {
      ...snapshot,
      dailyRows,
      source: 'subscription-compact-query',
      warnings,
      throttled,
      costAvailable: true,
    };
  } catch (err) {
    if (isCostThrottleError(err)) {
      warnings.push(cleanAzureError(err));
      try {
        const fallback = await tryCostDetailsReportFallback(resourceGroups, period, allSubscriptionResourceGroups);
        if (fallback?.costAvailable) {
          fallback.warnings = [...warnings, 'Interactive Cost Management Query was throttled, so data was loaded from Azure Generate Cost Details Report.'];
          return fallback;
        }
        if (fallback?.pending) {
          return { costRows: [], dailyRows: [], totalCost: null, groupTotals: [], source: 'cost-details-pending', warnings, throttled: true, costAvailable: false, costDetailsPending: true, retryAfterSeconds: fallback.retryAfterSeconds || 15 };
        }
        if (fallback?.warning) warnings.push(fallback.warning);
      } catch (fallbackErr) {
        warnings.push(`Azure Cost Details fallback unavailable: ${cleanAzureError(fallbackErr)}`);
      }
      return { costRows: [], dailyRows: [], totalCost: null, groupTotals: [], source: 'throttled', warnings, throttled: true, costAvailable: false };
    }
    if (allSubscriptionResourceGroups) {
      warnings.push(`Subscription-wide Azure Cost query unavailable. Per-resource-group fan-out is intentionally disabled to avoid Cost Management throttling. ${cleanAzureError(err)}`);
      return { costRows: [], dailyRows: [], totalCost: null, groupTotals: [], source: 'subscription-query-unavailable', warnings, throttled: false, costAvailable: false };
    }
    warnings.push(`Subscription-scope cost query unavailable; using resource-group fallback. ${cleanAzureError(err)}`);
  }

  const costRows = [];
  const dailyRows = [];
  const groupTotals = [];
  let anySuccess = false;
  for (const rg of resourceGroups) {
    try {
      const c = await queryCostByResource(rg, period);
      anySuccess = true;
      costRows.push(...c.byResource);
      groupTotals.push({ name: rg, amount: c.totalCost, currency: c.currency });
      try {
        const d = await queryDailyCost(rg, period);
        dailyRows.push(...d);
      } catch (trendErr) {
        if (isCostThrottleError(trendErr)) {
          warnings.push('Daily cost trend refresh was deferred by Azure throttling; available resource cost totals are retained.');
          break;
        }
        warnings.push(`Daily cost trend unavailable for ${rg}: ${cleanAzureError(trendErr)}`);
      }
    } catch (err) {
      if (isCostThrottleError(err)) {
        warnings.push(cleanAzureError(err));
        break;
      }
      warnings.push(`Cost data unavailable for ${rg}: ${cleanAzureError(err)}`);
    }
    await sleep(1000);
  }
  return {
    costRows,
    dailyRows,
    totalCost: round2(groupTotals.reduce((s, x) => s + Number(x.amount || 0), 0)),
    groupTotals,
    source: 'resource-group-fallback',
    warnings,
    throttled: throttleRemainingMs() > 0,
    costAvailable: anySuccess,
  };
}

function parseCostRows(json) {
  const columns = (json.properties?.columns || []).map(c => c.name);
  const idx = name => columns.indexOf(name);
  const rows = json.properties?.rows || [];
  const costIdx = idx('PreTaxCost') >= 0 ? idx('PreTaxCost') : idx('Cost');
  const currencyIdx = idx('Currency');
  return { columns, idx, rows, costIdx, currencyIdx };
}

async function queryCostByResource(resourceGroup, period) {
  const body = {
    type: 'ActualCost',
    ...customTimeframe(period),
    dataset: {
      granularity: 'None',
      aggregation: { totalCost: { name: 'PreTaxCost', function: 'Sum' } },
      grouping: [
        { type: 'Dimension', name: 'ResourceId' },
        { type: 'Dimension', name: 'ServiceName' },
      ],
    },
  };
  const json = await costQuery(rgScope(resourceGroup), body);
  const { idx, rows, costIdx, currencyIdx } = parseCostRows(json);
  const byResource = rows.map(r => ({
    resourceGroup,
    resourceId: r[idx('ResourceId')] || null,
    serviceName: r[idx('ServiceName')] || 'Unknown',
    resourceType: 'Unknown',
    meter: null,
    amount: round2(r[costIdx]),
    currency: r[currencyIdx] || 'USD',
  }));
  return {
    resourceGroup,
    totalCost: round2(byResource.reduce((s, x) => s + x.amount, 0)),
    currency: byResource[0]?.currency || 'USD',
    byResource,
  };
}

async function queryDailyCost(resourceGroup, period) {
  const body = {
    type: 'ActualCost',
    ...customTimeframe(period),
    dataset: {
      granularity: 'Daily',
      aggregation: { totalCost: { name: 'PreTaxCost', function: 'Sum' } },
    },
  };
  const json = await costQuery(rgScope(resourceGroup), body);
  const { columns, idx, rows, costIdx } = parseCostRows(json);
  const dateColumn = ['UsageDate', 'Date', 'BillingPeriodStartDate'].find(c => columns.includes(c));
  const currencyIdx = idx('Currency');
  return rows.map(r => ({
    date: dateColumn ? normalizeCostDate(r[idx(dateColumn)]) : '',
    resourceGroup,
    amount: round2(r[costIdx]),
    currency: currencyIdx >= 0 ? r[currencyIdx] : 'USD',
  })).filter(x => x.date);
}

async function queryBudgetForGroup(resourceGroup) {
  if (BUDGET_OVERRIDE) return null;
  if (!BUDGET_NAME) return null;
  const token = await getArmToken();
  const url = `https://management.azure.com${rgScope(resourceGroup)}/providers/Microsoft.Consumption/budgets/${encodeURIComponent(BUDGET_NAME)}?api-version=2023-05-01`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const json = await res.json();
  return Number(json.properties?.amount || 0) || null;
}

async function querySubscriptionLlmMeterCost(resourceGroups, period, allSubscriptionResourceGroups = false) {
  const body = {
    type: 'ActualCost',
    ...customTimeframe(period),
    dataset: {
      granularity: 'Daily',
      aggregation: { totalCost: { name: 'PreTaxCost', function: 'Sum' } },
      grouping: [
        { type: 'Dimension', name: 'ResourceId' },
        { type: 'Dimension', name: 'Meter' },
        { type: 'Dimension', name: 'ServiceName' },
        { type: 'Dimension', name: 'ResourceGroupName' },
      ],
      ...((!allSubscriptionResourceGroups && resourceGroupFilter(resourceGroups)) ? { filter: resourceGroupFilter(resourceGroups) } : {}),
    },
  };
  const json = await costQuery(subscriptionScope(), body);
  const { columns, idx, rows, costIdx, currencyIdx } = parseCostRows(json);
  const dateColumn = ['UsageDate', 'Date', 'BillingPeriodStartDate'].find(c => columns.includes(c));
  return rows.map(r => {
    const resourceId = r[idx('ResourceId')] || null;
    return {
      date: dateColumn ? normalizeCostDate(r[idx(dateColumn)]) : '',
      resourceId,
      resourceGroup: (idx('ResourceGroupName') >= 0 ? r[idx('ResourceGroupName')] : null) || rgNameFromResourceId(resourceId),
      meter: r[idx('Meter')] || 'Unknown',
      serviceName: r[idx('ServiceName')] || 'Unknown',
      // Keep Azure's full precision here. Rounding every meter row before
      // aggregation creates cumulative drift versus Cost Analysis. Round only
      // when presenting the final aggregate.
      amount: Number(r[costIdx] || 0),
      currency: currencyIdx >= 0 ? r[currencyIdx] : 'USD',
    };
  }).filter(x => x.date);
}

function mergeMetricResponses(...responses) {
  const values = [];
  let unavailable = true;
  const errors = [];
  for (const response of responses) {
    if (!response) continue;
    if (Array.isArray(response.value)) {
      values.push(...response.value);
      unavailable = false;
    }
    if (response.unavailable && response.error) errors.push(response.error);
  }
  return { value: values, unavailable: unavailable && !values.length, error: errors.join(' | ') || null };
}

async function queryMetricSingle(resourceId, period, metricName, aggregation = 'Total', includeDeploymentDimension = true) {
  const buildUrl = (withDimension) => {
    const params = new URLSearchParams({
      // 2023-10-01 is the current Azure Monitor Metrics REST API version.
      'api-version': '2023-10-01',
      metricnames: metricName,
      timespan: `${period.from}/${period.to}`,
      interval: period.days > 62 ? 'P1D' : 'PT1H',
      aggregation,
      AutoAdjustTimegrain: 'true',
      ValidateDimensions: 'false',
    });
    if (withDimension) params.set('$filter', "ModelDeploymentName eq '*'");
    return `https://management.azure.com${resourceId}/providers/Microsoft.Insights/metrics?${params.toString()}`;
  };

  // First ask Azure for deployment-split data. Some older/variant resources
  // reject a dimension filter even though the aggregate metric is available;
  // in that case retry without the dimension instead of losing the metric.
  try {
    return await armJson(buildUrl(includeDeploymentDimension));
  } catch (err) {
    if (includeDeploymentDimension && [400, 404].includes(Number(err?.status))) {
      try { return await armJson(buildUrl(false)); }
      catch (fallbackErr) { return { unavailable: true, error: fallbackErr.message, value: [] }; }
    }
    return { unavailable: true, error: err.message, value: [] };
  }
}

async function queryMetrics(resourceId, period) {
  // Query each metric independently. Azure Monitor can reject a multi-metric
  // request when one metric is not supported by a resource/model. Independent
  // queries keep valid input/output/request metrics even when cache or a newer
  // metric name is unavailable.
  const classicNames = [
    ['ProcessedPromptTokens', 'Total'],
    ['GeneratedTokens', 'Total'],
    ['TokenTransaction', 'Total'],
    ['AzureOpenAIRequests', 'Total'],
  ];
  const classic = await Promise.all(classicNames.map(([name, agg]) => queryMetricSingle(resourceId, period, name, agg, true)));
  let merged = mergeMetricResponses(...classic);
  const names = new Set((merged.value || []).map(x => x.name?.value));

  // Foundry variants may expose newer names. Only request the missing token
  // families so we do not double count classic + modern aliases.
  const modernRequests = [];
  if (!names.has('ProcessedPromptTokens')) modernRequests.push(queryMetricSingle(resourceId, period, 'InputTokens', 'Total', true));
  if (!names.has('GeneratedTokens')) modernRequests.push(queryMetricSingle(resourceId, period, 'OutputTokens', 'Total', true));
  if (!names.has('TokenTransaction')) modernRequests.push(queryMetricSingle(resourceId, period, 'TotalTokens', 'Total', true));
  if (modernRequests.length) merged = mergeMetricResponses(merged, ...(await Promise.all(modernRequests)));

  // Cache-match is a percentage, so Average is the correct aggregation. It is
  // optional (not all PAYG deployments expose it), and failure must not make
  // the token/request metrics unavailable.
  const cache = await queryMetricSingle(resourceId, period, 'AzureOpenAIContextTokensCacheMatchRate', 'Average', true);
  const withCache = mergeMetricResponses(merged, cache);
  // Treat the resource as unavailable only when none of the core metrics were
  // returned. An unsupported cache metric is informational, not fatal.
  const coreValues = (merged.value || []);
  return {
    value: [...coreValues, ...((cache.value || []))],
    unavailable: coreValues.length === 0,
    error: coreValues.length === 0 ? (merged.error || cache.error || null) : null,
    optionalWarnings: cache.unavailable && cache.error ? [cache.error] : [],
  };
}

function metricNameValue(metric) {
  return metric?.name?.value || metric?.name?.localizedValue || '';
}

function metricPointValue(point, preferAverage = false) {
  if (preferAverage && typeof point?.average === 'number') return point.average;
  if (typeof point?.total === 'number') return point.total;
  if (typeof point?.average === 'number') return point.average;
  if (typeof point?.count === 'number') return point.count;
  return 0;
}

function deploymentKey(dims = {}) {
  return [dims.ModelDeploymentName || dims.modeldeploymentname || 'All deployments', dims.ModelName || dims.modelname || '—', dims.ModelVersion || dims.modelversion || '—'].join('|');
}

function aggregateDeploymentMetrics(json) {
  const deployments = new Map();
  const daily = new Map();
  const cacheSamples = [];
  const getDeployment = dims => {
    const key = deploymentKey(dims);
    if (!deployments.has(key)) deployments.set(key, {
      deploymentName: dims.ModelDeploymentName || dims.modeldeploymentname || 'All deployments',
      modelName: dims.ModelName || dims.modelname || '—',
      modelVersion: dims.ModelVersion || dims.modelversion || '—',
      region: dims.Region || dims.region || null,
      inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0,
      cacheMatchWeighted: 0, cacheMatchSamples: 0,
    });
    return deployments.get(key);
  };

  for (const metric of json?.value || []) {
    const name = metricNameValue(metric);
    const isCache = name === 'AzureOpenAIContextTokensCacheMatchRate';
    const isInput = name === 'ProcessedPromptTokens' || name === 'InputTokens';
    const isOutput = name === 'GeneratedTokens' || name === 'OutputTokens';
    const isTotal = name === 'TokenTransaction' || name === 'TotalTokens';
    const isRequests = name === 'AzureOpenAIRequests';
    if (!isCache && !isInput && !isOutput && !isTotal && !isRequests) continue;

    for (const ts of metric.timeseries || []) {
      const dims = Object.fromEntries((ts.metadatavalues || []).map(d => [d.name?.value, d.value]));
      const deployment = getDeployment(dims);
      for (const point of ts.data || []) {
        const stamp = point.timeStamp || point.timestamp;
        const day = stamp ? String(stamp).slice(0, 10) : null;
        const value = metricPointValue(point, isCache);
        if (isInput) deployment.inputTokens += value;
        if (isOutput) deployment.outputTokens += value;
        if (isTotal) deployment.totalTokens += value;
        if (isRequests) deployment.requests += value;
        if (isCache && typeof value === 'number') {
          deployment.cacheMatchWeighted += value;
          deployment.cacheMatchSamples += 1;
          cacheSamples.push(value);
        }
        if (day) {
          const row = daily.get(day) || { date: day, inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, cacheMatchWeighted: 0, cacheMatchSamples: 0 };
          if (isInput) row.inputTokens += value;
          if (isOutput) row.outputTokens += value;
          if (isTotal) row.totalTokens += value;
          if (isRequests) row.requests += value;
          if (isCache) { row.cacheMatchWeighted += value; row.cacheMatchSamples += 1; }
          daily.set(day, row);
        }
      }
    }
  }

  const deploymentRows = [...deployments.values()].map(row => ({
    ...row,
    inputTokens: Math.round(row.inputTokens),
    outputTokens: Math.round(row.outputTokens),
    totalTokens: Math.round(row.totalTokens || row.inputTokens + row.outputTokens),
    requests: Math.round(row.requests),
    cacheMatchRatePct: row.cacheMatchSamples ? roundPct(row.cacheMatchWeighted / row.cacheMatchSamples) : null,
  }));
  const dailyRows = [...daily.values()].map(row => ({
    date: row.date,
    inputTokens: Math.round(row.inputTokens),
    outputTokens: Math.round(row.outputTokens),
    totalTokens: Math.round(row.totalTokens || row.inputTokens + row.outputTokens),
    requests: Math.round(row.requests),
    cacheMatchRatePct: row.cacheMatchSamples ? roundPct(row.cacheMatchWeighted / row.cacheMatchSamples) : null,
  })).sort((a, b) => a.date.localeCompare(b.date));
  return {
    deployments: deploymentRows,
    daily: dailyRows,
    cacheMatchRatePct: cacheSamples.length ? roundPct(cacheSamples.reduce((s, x) => s + x, 0) / cacheSamples.length) : null,
  };
}

function metricTotal(json, metricName) {
  const metric = (json?.value || []).find(m => m.name?.value === metricName || m.name?.localizedValue === metricName);
  if (!metric) return { total: 0, series: [] };
  let total = 0;
  const series = [];
  for (const ts of metric.timeseries || []) {
    const dims = Object.fromEntries((ts.metadatavalues || []).map(d => [d.name?.value, d.value]));
    let seriesTotal = 0;
    let weighted = 0;
    let weight = 0;
    for (const p of ts.data || []) {
      if (typeof p.total === 'number') seriesTotal += p.total;
      if (typeof p.average === 'number') { weighted += p.average; weight += 1; }
    }
    const avg = weight ? weighted / weight : 0;
    total += seriesTotal;
    series.push({ ...dims, total: seriesTotal, average: avg });
  }
  return { total, series };
}

function llmMeterCategory(meter) {
  const m = String(meter || '').toLowerCase();
  if (/cached|cache/.test(m)) return 'cache';
  if (/outp|output|completion/.test(m)) return 'output';
  if (/inp|input|prompt/.test(m)) return 'input';
  return 'other';
}

function modelFromMeter(meter) {
  let text = String(meter || '').trim();
  if (!text) return 'Other';
  text = text
    .replace(/\b(cached\s+)?(inp|input|prompt|outp|output|completion)\b.*$/i, '')
    .replace(/\b(tokens?|global|glbl|regional|std|standard)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || 'Other';
}

function isLlmBillingRow(row) {
  const service = String(row?.serviceName || '').toLowerCase();
  const meter = String(row?.meter || '').toLowerCase();
  const type = String(row?.resourceType || '').toLowerCase();
  // Azure has used both Azure OpenAI and Foundry Models naming in Cost
  // Management. Meter names are the most stable billing signal, so accept
  // token/model meters even when ResourceId is blank or does not exactly
  // match the ARM Cognitive Services resource.
  const openAiService = /openai|foundry models|cognitive services|ai services/.test(service) || /cognitiveservices|openai/.test(type);
  const tokenMeter = /(gpt|o1|o3|o4|model|tokens?|inp|outp|input|output|cached|prompt|completion)/.test(meter);
  return (openAiService && tokenMeter) || (/\b(gpt|o1|o3|o4)[- _0-9a-z.]*\b/.test(meter) && /token|inp|outp|input|output|cached/.test(meter));
}

function mergeTokenDaily(resourceSeries) {
  const map = new Map();
  for (const rows of resourceSeries || []) {
    for (const row of rows || []) {
      const cur = map.get(row.date) || { date: row.date, inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, cacheWeighted: 0, cacheSamples: 0 };
      cur.inputTokens += Number(row.inputTokens || 0);
      cur.outputTokens += Number(row.outputTokens || 0);
      cur.totalTokens += Number(row.totalTokens || 0);
      cur.requests += Number(row.requests || 0);
      if (row.cacheMatchRatePct != null) { cur.cacheWeighted += Number(row.cacheMatchRatePct); cur.cacheSamples += 1; }
      map.set(row.date, cur);
    }
  }
  return [...map.values()].map(x => ({
    date: x.date,
    inputTokens: Math.round(x.inputTokens),
    outputTokens: Math.round(x.outputTokens),
    totalTokens: Math.round(x.totalTokens || x.inputTokens + x.outputTokens),
    requests: Math.round(x.requests),
    cacheMatchRatePct: x.cacheSamples ? roundPct(x.cacheWeighted / x.cacheSamples) : null,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

function costSourceAvailable(costLoad) {
  return !!costLoad && costLoad.costAvailable === true;
}

function unavailableCostView(base = {}, period, resourceGroups, scope, warning) {
  const resources = Array.isArray(base.resources)
    ? base.resources.map(r => ({ ...r, cost: null }))
    : [];
  const serviceCount = new Set(resources.map(r => r.serviceName || r.type).filter(Boolean)).size;
  return {
    ...base,
    configured: true,
    costAvailable: false,
    period: base.period || { startDate: period.startDate, endDate: period.endDate, days: period.days, label: period.label },
    resourceGroups: base.resourceGroups || resourceGroups,
    resourceGroupCount: base.resourceGroupCount ?? resourceGroups.length,
    allSubscriptionResourceGroups: base.allSubscriptionResourceGroups ?? scope.allSubscriptionResourceGroups,
    resourceGroupDiscoverySource: base.resourceGroupDiscoverySource || scope.discoverySource,
    totalCost: null,
    resourceAttributedCost: null,
    budget: null,
    consumedPct: null,
    status: 'neutral',
    dailyCost: [],
    byService: [],
    byRegion: [],
    byResourceGroup: (base.byResourceGroup?.length ? base.byResourceGroup : resourceGroups.map(name => ({ name, resourceCount: resources.filter(r => sameResourceGroup(r.resourceGroup, name)).length })))
      .map(x => ({ ...x, amount: null, pct: null, aiCost: null })),
    resources,
    serviceCount,
    resourceCostDetails: [],
    applications: Array.isArray(base.applications) ? base.applications.map(a => ({ ...a, totalCost: null, aiCost: null })) : [],
    openAiUsage: Array.isArray(base.openAiUsage) ? base.openAiUsage.map(u => ({ ...u, cost: null, inputCost: null, outputCost: null, cacheCost: null, otherCost: null })) : [],
    llm: {
      ...(base.llm || {}),
      totalCost: null,
      costBreakdown: { input: null, output: null, cache: null, other: null },
      costByModel: [],
      dailyCost: [],
    },
    partial: true,
    stale: false,
    throttled: true,
    retryAfterSeconds: throttleRemainingMs() ? Math.ceil(throttleRemainingMs() / 1000) : 0,
    lastAttemptAt: new Date().toISOString(),
    warnings: [...new Set([warning, ...(base.warnings || []).filter(w => !/throttl|429|deferred/i.test(String(w)))].filter(Boolean))],
  };
}

function mergeDailyTrend(rows) {
  const map = new Map();
  for (const row of rows.flat()) {
    const key = String(row.date);
    const current = map.get(key) || { date: key, amount: 0, groups: {} };
    current.amount += Number(row.amount || 0);
    current.groups[row.resourceGroup] = round2((current.groups[row.resourceGroup] || 0) + Number(row.amount || 0));
    map.set(key, current);
  }
  return [...map.values()].map(x => ({ ...x, amount: round2(x.amount) })).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

async function getCostIntelligence(useCases = [], options = {}) {
  if (!SUBSCRIPTION_ID) return { configured: false, reason: 'AZURE_SUBSCRIPTION_ID is not configured.' };

  const period = normalizePeriod(options);
  const appMap = parseAppMap();
  const scope = await resolveResourceGroupScope(useCases, appMap);
  const resourceGroups = scope.resourceGroups;
  const allSubscriptionResourceGroups = scope.allSubscriptionResourceGroups;
  if (!resourceGroups.length) {
    return {
      configured: false,
      reason: 'No Azure resource groups are configured. Set AZURE_COST_RESOURCE_GROUPS or map azureResourceGroup on the registered applications.',
    };
  }

  const key = cacheKey(period, resourceGroups);
  const cached = cache.get(key);
  const effectiveCacheTtl = cached?.data?.partial || cached?.data?.stale ? Math.min(CACHE_TTL_MS, 2 * 60 * 1000) : CACHE_TTL_MS;
  if (!options.force && cached?.data && Date.now() - cached.at < effectiveCacheTtl) return cached.data;

  // A manual Refresh must not hammer an already-throttled Cost Management API.
  // Prefer the last good snapshot until the cooldown expires, even when force=1.
  if (throttleRemainingMs() > 0) {
    const prior = lastSuccessful.get(key) || (hasUsableCostSnapshot(cached?.data) ? cached.data : null);
    if (prior) return {
      ...prior,
      costAvailable: true,
      stale: true,
      partial: true,
      throttled: true,
      retryAfterSeconds: Math.ceil(throttleRemainingMs() / 1000),
      lastAttemptAt: new Date().toISOString(),
      warnings: [...new Set([cleanAzureError({ status: 429, code: 'COST_THROTTLED' }), ...(prior.warnings || []).filter(w => !/429|throttl|deferred/i.test(String(w)))])],
    };
    // No successful Query snapshot exists. Continue into the normal loader so
    // it can use the asynchronous Generate Cost Details Report fallback even
    // while the interactive Query endpoint remains in its 429 cooldown.
  }

  try {
    const warnings = [];
    // ARM inventory can load in parallel because it uses a different API/quota.
    // In all-subscription mode use ONE ARM resource-list request instead of one
    // request per RG. This scales to dozens/hundreds of RGs and avoids ARM bursts.
    const resourceInventoryPromise = allSubscriptionResourceGroups
      ? listSubscriptionResources()
      : Promise.allSettled(resourceGroups.map(rg => listResourcesForGroup(rg)));
    const [costLoad, resourceInventoryResult] = await Promise.all([
      loadCostRows(resourceGroups, period, allSubscriptionResourceGroups),
      resourceInventoryPromise,
    ]);
    warnings.push(...costLoad.warnings);
    const costAvailable = costSourceAvailable(costLoad);

    // Meter-level cost is a second Cost Management query. Never issue it while
    // Cost Management is throttled; doing so only extends the 429 window.
    let llmMeterRows = Array.isArray(costLoad.detailRows) ? costLoad.detailRows.map(r => ({
      date: r.date, resourceId: r.resourceId, resourceGroup: r.resourceGroup, meter: r.meter,
      amount: r.amount, currency: r.currency, serviceName: r.serviceName, resourceType: r.resourceType,
    })) : [];
    if (!llmMeterRows.length && !costLoad.throttled && throttleRemainingMs() === 0) {
      try {
        await sleep(750); // small spacing between Cost Management requests
        llmMeterRows = await querySubscriptionLlmMeterCost(resourceGroups, period, allSubscriptionResourceGroups);
      } catch (err) {
        if (isCostThrottleError(err)) warnings.push(cleanAzureError(err));
        else warnings.push(`LLM billed-cost detail unavailable: ${cleanAzureError(err)}`);
      }
    }

    const resourcesByGroup = new Map(resourceGroups.map(rg => [rg, []]));
    if (allSubscriptionResourceGroups) {
      for (const resource of resourceInventoryResult || []) {
        const rg = resource.resourceGroup;
        if (!rg) continue;
        const canonical = resourceGroups.find(x => sameResourceGroup(x, rg)) || rg;
        if (!resourcesByGroup.has(canonical)) resourcesByGroup.set(canonical, []);
        resourcesByGroup.get(canonical).push(resource);
      }
    } else {
      resourceInventoryResult.forEach((result, i) => {
        const rg = resourceGroups[i];
        if (result.status === 'fulfilled') resourcesByGroup.set(rg, result.value);
        else { resourcesByGroup.set(rg, []); warnings.push(`Resource inventory unavailable for ${rg}: ${result.reason?.message || result.reason}`); }
      });
    }

    const isCurrentMonth = period.startDate === startOfCurrentMonthUtc() && period.endDate === new Date().toISOString().slice(0, 10);
    const budgets = new Map();
    if (isCurrentMonth && BUDGET_NAME && !BUDGET_OVERRIDE && !allSubscriptionResourceGroups) {
      for (const rg of resourceGroups) {
        try { budgets.set(rg, await queryBudgetForGroup(rg)); }
        catch (err) { warnings.push(`Budget unavailable for ${rg}: ${err.message}`); }
      }
    }

    const allCostRows = costLoad.costRows;
    const currency = costLoad.currency || allCostRows[0]?.currency || costLoad.dailyRows[0]?.currency || llmMeterRows[0]?.currency || 'USD';
    const dailyCostRaw = mergeDailyTrend([costLoad.dailyRows]);
    // Render one point for every selected calendar day. Azure can omit a day
    // when there is no returned charge; keeping the date axis complete avoids
    // a misleading jump from Sep 1 straight to a later returned date.
    const dailyByDate = new Map(dailyCostRaw.map(x => [normalizeCostDate(x.date), x]));
    const dailyCost = [];
    if (dailyCostRaw.length) {
      for (let cursor = new Date(`${period.startDate}T00:00:00Z`), end = new Date(`${period.endDate}T00:00:00Z`); cursor <= end; cursor = new Date(cursor.getTime() + 86400000)) {
        const date = cursor.toISOString().slice(0, 10);
        dailyCost.push(dailyByDate.get(date) || { date, amount: 0, currency: costLoad.currency || 'USD' });
      }
    }
    // Primary total comes from the compact Cost Management query, which
    // includes billed rows without ResourceId. Daily trend is supplementary.
    const totalCost = costAvailable
      ? round2(costLoad.totalCost ?? allCostRows.reduce((s, x) => s + Number(x.amount || 0), 0))
      : 0;
    const groupTotalsByKey = new Map((costLoad.groupTotals || []).map(x => [rgKey(x.name), Number(x.amount || 0)]));

    const groupPayloads = resourceGroups.map(resourceGroup => {
      const byResource = allCostRows.filter(x => sameResourceGroup(x.resourceGroup, resourceGroup));
      const daily = costLoad.dailyRows.filter(x => sameResourceGroup(x.resourceGroup, resourceGroup));
      return {
        resourceGroup,
        resources: resourcesByGroup.get(resourceGroup) || [],
        costs: {
          resourceGroup,
          totalCost: costAvailable ? round2(groupTotalsByKey.get(rgKey(resourceGroup)) ?? byResource.reduce((s, x) => s + Number(x.amount || 0), 0)) : 0,
          currency: byResource[0]?.currency || currency,
          byResource,
        },
        daily,
        budget: budgets.get(resourceGroup) || null,
      };
    });

    const budget = isCurrentMonth ? (BUDGET_OVERRIDE || (() => {
      const vals = groupPayloads.map(x => x.budget).filter(v => Number(v) > 0);
      return vals.length ? round2(vals.reduce((s, v) => s + Number(v), 0)) : null;
    })()) : null;

    const costById = new Map();
    for (const c of allCostRows) {
      if (!c.resourceId) continue;
      const idKey = normalizeResourceId(c.resourceId);
      const existing = costById.get(idKey) || {
        resourceId: c.resourceId, resourceGroup: c.resourceGroup, amount: 0,
        currency: c.currency, serviceName: c.serviceName, resourceType: c.resourceType, meters: [],
      };
      existing.amount += Number(c.amount || 0);
      existing.meters.push({ meter: c.meter, amount: c.amount });
      costById.set(idKey, existing);
    }

    const resourcesRaw = groupPayloads.flatMap(x => x.resources);
    const inventory = resourcesRaw.map(r => {
      const c = costById.get(normalizeResourceId(r.id));
      const applicationId = appKeyFromResource(r, useCases);
      return {
        id: r.id, name: r.name, type: r.type, kind: r.kind || null,
        resourceGroup: r.resourceGroup, location: r.location || null, tags: r.tags || {},
        sku: r.sku?.name || r.sku?.tier || null,
        cost: round2(c?.amount || 0), currency: c?.currency || currency,
        serviceName: c?.serviceName || r.type?.split('/').pop() || 'Unknown',
        meters: c?.meters || [], applicationId,
        suggestedApplicationId: applicationId ? null : suggestApplicationMatch(r.name, useCases),
      };
    });

    for (const c of allCostRows) {
      if (!c.resourceId || inventory.some(r => normalizeResourceId(r.id) === normalizeResourceId(c.resourceId))) continue;
      inventory.push({
        id: c.resourceId, name: c.resourceId.split('/').pop(), type: c.resourceType, kind: null,
        resourceGroup: c.resourceGroup, location: null, tags: {}, sku: null,
        cost: c.amount, currency: c.currency, serviceName: c.serviceName,
        meters: [{ meter: c.meter, amount: c.amount }], applicationId: null,
      });
    }

    const inventoryById = new Map(inventory.map(r => [normalizeResourceId(r.id), r]));
    // Keep billed detail rows when available; the compact cost query is the
    // reliable resource-level fallback when Azure throttles the detail query.
    const resourceDetailRows = llmMeterRows.length ? llmMeterRows : allCostRows;
    const resourceCostDetails = resourceDetailRows.map(row => {
      const resource = inventoryById.get(normalizeResourceId(row.resourceId));
      return {
        usageDate: row.date,
        resourceId: row.resourceId,
        resourceName: resource?.name || String(row.resourceId || '').split('/').pop(),
        resourceType: resource?.type || 'Unknown',
        resourceLocation: resource?.location || null,
        resourceGroupName: row.resourceGroup || resource?.resourceGroup || null,
        serviceName: resource?.serviceName || 'Unknown',
        serviceTier: resource?.sku || null,
        meter: row.meter,
        costUSD: row.currency === 'USD' ? Number(row.amount || 0) : null,
        cost: Number(row.amount || 0),
        currency: row.currency || currency,
      };
    });

    // Keep the full meter dataset for resource reconciliation/export, but use
    // only Azure OpenAI / Foundry token billing rows for the LLM dashboard.
    // Do not require ResourceId to match ARM: Cost Management frequently emits
    // Foundry billing rows with a parent/alternate/blank resource identifier.
    const llmBilledRows = llmMeterRows.filter(isLlmBillingRow);

    const openAiResources = inventory.filter(isOpenAIResource);
    const openAiIds = new Set(openAiResources.map(r => normalizeResourceId(r.id)));
    const openAiUsage = [];
    const deploymentRows = [];
    const tokenSeries = [];

    for (const r of openAiResources) {
      const metrics = await queryMetrics(r.id, period);
      if (metrics.unavailable && metrics.error) {
        const statusHint = /403|authorization|forbidden/i.test(metrics.error)
          ? ' Verify Monitoring Reader is assigned to the genaiplaygtest2 managed identity at the Azure OpenAI resource/RG scope.'
          : '';
        warnings.push(`Azure OpenAI metrics unavailable for ${r.name}: ${metrics.error}.${statusHint}`);
      }
      const aggregate = aggregateDeploymentMetrics(metrics);
      tokenSeries.push(aggregate.daily);
      let appId = r.applicationId;
      const directMap = Object.entries(appMap).find(([, cfg]) => (cfg.resourceNames || []).some(n => norm(n) === norm(r.name)) || (cfg.resources || []).some(x => norm(x?.name) === norm(r.name)));
      if (directMap) appId = directMap[0];

      const meterRows = llmBilledRows.filter(m => isSameOrDescendantResourceId(r.id, m.resourceId));
      const split = { input: 0, output: 0, cache: 0, other: 0 };
      for (const row of meterRows) split[llmMeterCategory(row.meter)] += Number(row.amount || 0);
      Object.keys(split).forEach(k => { split[k] = round2(split[k]); });
      const actualCost = costAvailable ? round2(meterRows.reduce((s, row) => s + Number(row.amount || 0), 0) || r.cost) : null;

      const inputTokens = aggregate.deployments.reduce((s, d) => s + Number(d.inputTokens || 0), 0);
      const outputTokens = aggregate.deployments.reduce((s, d) => s + Number(d.outputTokens || 0), 0);
      const totalTokens = aggregate.deployments.reduce((s, d) => s + Number(d.totalTokens || 0), 0) || inputTokens + outputTokens;
      const requests = aggregate.deployments.reduce((s, d) => s + Number(d.requests || 0), 0);

      openAiUsage.push({
        resourceId: r.id, resourceName: r.name, resourceGroup: r.resourceGroup,
        applicationId: appId || null,
        applicationName: useCases.find(u => u.id === appId)?.title || 'Unassigned',
        cost: actualCost,
        inputCost: split.input, outputCost: split.output, cacheCost: split.cache, otherCost: split.other,
        requests: Math.round(requests), inputTokens: Math.round(inputTokens), outputTokens: Math.round(outputTokens),
        totalTokens: Math.round(totalTokens), cacheMatchRatePct: aggregate.cacheMatchRatePct,
        metricsUnavailable: !!metrics.unavailable, metricsError: metrics.unavailable ? metrics.error : null,
        costPending: (inputTokens > 0 || outputTokens > 0 || requests > 0) && !meterRows.length && !r.cost,
      });

      for (const dep of aggregate.deployments) {
        deploymentRows.push({
          resourceId: r.id, resourceName: r.name, resourceGroup: r.resourceGroup,
          applicationId: appId || null,
          applicationName: useCases.find(u => u.id === appId)?.title || 'Unassigned',
          ...dep,
        });
      }
    }

    const tokenDaily = mergeTokenDaily(tokenSeries);
    const llmDailyMap = new Map();
    const llmCostByModelMap = new Map();
    const llmCostBreakdown = { input: 0, output: 0, cache: 0, other: 0 };
    for (const row of llmBilledRows) {
      const category = llmMeterCategory(row.meter);
      llmCostBreakdown[category] += Number(row.amount || 0);
      const daily = llmDailyMap.get(row.date) || { date: row.date, inputCost: 0, outputCost: 0, cacheCost: 0, otherCost: 0, totalCost: 0 };
      daily[`${category}Cost`] += Number(row.amount || 0);
      daily.totalCost += Number(row.amount || 0);
      llmDailyMap.set(row.date, daily);
      const model = modelFromMeter(row.meter);
      llmCostByModelMap.set(model, (llmCostByModelMap.get(model) || 0) + Number(row.amount || 0));
    }
    Object.keys(llmCostBreakdown).forEach(k => { llmCostBreakdown[k] = round2(llmCostBreakdown[k]); });
    const llmDailyCost = [...llmDailyMap.values()].map(x => ({
      ...x,
      inputCost: round2(x.inputCost), outputCost: round2(x.outputCost), cacheCost: round2(x.cacheCost),
      otherCost: round2(x.otherCost), totalCost: round2(x.totalCost),
    })).sort((a, b) => a.date.localeCompare(b.date));
    const llmCostByModel = [...llmCostByModelMap.entries()].map(([name, amount]) => ({ name, amount: round2(amount) })).sort((a, b) => b.amount - a.amount);

    // Normalized billed LLM detail. This is intentionally sourced from Azure
    // ActualCost rather than a hard-coded token price. Application ownership is
    // inherited from the owning Azure OpenAI resource where a safe mapping is
    // available; otherwise the row remains Unassigned instead of guessing.
    // Build a conservative application-attribution index. Billing rows do not
    // always carry the same ResourceId as ARM/Monitor. We therefore use, in
    // order: exact/parent OpenAI resource, explicit resource mapping/tags, a
    // unique OpenAI resource in the billing RG, then a unique monitored
    // Playground application in that RG. We never pick arbitrarily when an RG
    // contains multiple candidate applications.
    const appIdsByRg = new Map();
    for (const inv of inventory) {
      const appId = inv.applicationId || appKeyFromResource(inv, useCases);
      if (!appId || !inv.resourceGroup) continue;
      const key = norm(inv.resourceGroup);
      if (!appIdsByRg.has(key)) appIdsByRg.set(key, new Set());
      appIdsByRg.get(key).add(appId);
    }
    function attributedApplication(row, resource) {
      let appId = resource?.applicationId || (resource ? appKeyFromResource(resource, useCases) : null);
      if (appId) return { appId, method: 'azure-resource' };
      const synthetic = { id: row.resourceId, name: String(row.resourceId||'').split('/').pop(), resourceGroup: row.resourceGroup, tags: {} };
      appId = appKeyFromResource(synthetic, useCases);
      if (appId) return { appId, method: 'billing-resource' };
      if (row.resourceGroup) {
        const candidates = [...(appIdsByRg.get(norm(row.resourceGroup)) || [])];
        if (candidates.length === 1) return { appId: candidates[0], method: 'unique-resource-group' };
      }
      return { appId: null, method: 'unassigned' };
    }

    const llmCostDetails = llmBilledRows.map(row => {
      const ownerId = owningOpenAiResourceId(row.resourceId, openAiResources);
      let resource = openAiResources.find(r => normalizeResourceId(r.id) === normalizeResourceId(ownerId || row.resourceId));
      if (!resource && row.resourceGroup) {
        const sameRg = openAiResources.filter(r => sameResourceGroup(r.resourceGroup, row.resourceGroup));
        if (sameRg.length === 1) resource = sameRg[0];
      }
      const attribution = attributedApplication(row, resource);
      const applicationId = attribution.appId;
      return {
        usageDate: row.date,
        resourceId: row.resourceId || null,
        resourceName: resource?.name || (row.resourceId ? String(row.resourceId).split('/').pop() : 'Azure OpenAI / Foundry'),
        resourceGroupName: row.resourceGroup || resource?.resourceGroup || null,
        serviceName: row.serviceName || 'Foundry Models',
        applicationId,
        applicationName: useCases.find(u => u.id === applicationId)?.title || 'Unassigned',
        attributionMethod: attribution.method,
        model: modelFromMeter(row.meter),
        tokenType: llmMeterCategory(row.meter),
        meter: row.meter,
        cost: Number(row.amount || 0),
        currency: row.currency || currency,
      };
    }).sort((a,b)=>String(a.usageDate).localeCompare(String(b.usageDate)) || String(a.applicationName).localeCompare(String(b.applicationName)) || String(a.model).localeCompare(String(b.model)));
    const totalLlmCost = round2(Object.values(llmCostBreakdown).reduce((s, v) => s + Number(v || 0), 0) || openAiUsage.reduce((s, u) => s + Number(u.cost || 0), 0));

    const applicationRows = useCases.map(app => {
      const resourceNames = configuredResourceNames(app.id, appMap);
      const appResources = inventory.filter(r => {
        if (r.applicationId === app.id) return true;
        if (resourceNames.size && resourceNames.has(norm(r.name))) return true;
        if ((app.azureResources || []).some(x => norm(x.name) === norm(r.name))) return true;
        try { const host = new URL(app.launchUrl || '').hostname.split('.')[0]; return host && norm(r.name) === norm(host); }
        catch { return false; }
      });
      const usage = openAiUsage.filter(x => x.applicationId === app.id || resourceNames.has(norm(x.resourceName)));
      return {
        id: app.id, name: app.title, owner: app.owner, ownerEmail: app.ownerEmail,
        resourceGroups: uniqueResourceGroups(appResources.map(r => r.resourceGroup)), resourceCount: appResources.length,
        totalCost: costAvailable ? round2(appResources.reduce((s, r) => s + Number(r.cost || 0), 0)) : null,
        aiCost: costAvailable ? round2(usage.reduce((s, u) => s + Number(u.cost || 0), 0)) : null,
        inputTokens: usage.reduce((s, u) => s + u.inputTokens, 0), outputTokens: usage.reduce((s, u) => s + u.outputTokens, 0),
        totalTokens: usage.reduce((s, u) => s + u.totalTokens, 0), requests: usage.reduce((s, u) => s + u.requests, 0),
      };
    });

    const serviceMap = new Map();
    // Build service distribution from the same detailed ActualCost rows used by
    // the KPI/export so the donut always reconciles to Actual Azure Cost.
    for (const row of resourceCostDetails) {
      const name = row.serviceName || 'Unknown / unattributed';
      serviceMap.set(name, (serviceMap.get(name) || 0) + Number(row.cost || 0));
    }
    const byService = [...serviceMap.entries()].map(([name, amount]) => ({ name, amount: round2(amount), pct: totalCost ? roundPct(amount / totalCost * 100) : 0 })).sort((a, b) => b.amount - a.amount);

    const byResourceGroup = groupPayloads.map(x => {
      const rgResources = inventory.filter(r => sameResourceGroup(r.resourceGroup, x.resourceGroup));
      const rgAi = openAiUsage.filter(u => sameResourceGroup(u.resourceGroup, x.resourceGroup));
      return {
        name: x.resourceGroup, amount: round2(x.costs.totalCost), pct: totalCost ? roundPct(x.costs.totalCost / totalCost * 100) : 0,
        resourceCount: rgResources.length, aiCost: round2(rgAi.reduce((s, u) => s + u.cost, 0)),
        totalTokens: rgAi.reduce((s, u) => s + u.totalTokens, 0), budget: x.budget,
      };
    }).sort((a, b) => b.amount - a.amount);

    const regionMap = new Map();
    for (const row of resourceCostDetails) {
      const name = row.resourceLocation || 'Unknown / unattributed';
      regionMap.set(name, (regionMap.get(name) || 0) + Number(row.cost || 0));
    }
    const byRegion = [...regionMap.entries()].map(([name, amount]) => ({ name, amount: round2(amount), pct: totalCost ? roundPct(amount / totalCost * 100) : 0 })).sort((a, b) => b.amount - a.amount);

    const consumedPct = budget ? roundPct(totalCost / budget * 100) : null;
    const status = consumedPct == null ? 'neutral' : consumedPct > 100 ? 'critical' : consumedPct >= 80 ? 'attention' : consumedPct >= 60 ? 'monitor' : 'normal';
    const resourceAttributedCost = resourceCostDetails.length
      ? round2(resourceCostDetails.reduce((s, r) => s + Number(r.cost || 0), 0))
      : round2(inventory.reduce((s, r) => s + Number(r.cost || 0), 0));
    if (costAvailable && Math.abs(resourceAttributedCost - totalCost) > Math.max(1, Math.abs(totalCost) * 0.02)) {
      warnings.push(`Azure actual cost (${fmtMoney(totalCost, currency)}) differs from resource-attributed cost (${fmtMoney(resourceAttributedCost, currency)}). The difference can be credits, refunds, taxes, marketplace or other charges without a ResourceId.`);
    }

    const result = {
      configured: true,
      period: { startDate: period.startDate, endDate: period.endDate, days: period.days, label: period.label },
      resourceGroup: resourceGroups.length === 1 ? resourceGroups[0] : null,
      resourceGroups, resourceGroupCount: resourceGroups.length,
      allSubscriptionResourceGroups, resourceGroupDiscoverySource: scope.discoverySource,
      costAvailable,
      totalCost: costAvailable ? totalCost : null, resourceAttributedCost: costAvailable ? resourceAttributedCost : null, currency,
      budget: costAvailable ? budget : null, consumedPct: costAvailable ? consumedPct : null, status,
      resourceCount: inventory.length, openAiResourceCount: openAiResources.length,
      byResourceGroup: costAvailable ? byResourceGroup : byResourceGroup.map(x => ({ ...x, amount: null, pct: null, aiCost: null })),
      byService: costAvailable ? byService : [], byRegion: costAvailable ? byRegion : [], dailyCost: costAvailable ? dailyCost : [],
      serviceCount: new Set(inventory.map(r => r.serviceName || r.type).filter(Boolean)).size,
      resources: inventory.map(r => ({ ...r, cost: costAvailable ? r.cost : null })).sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0)),
      resourceCostDetails: costAvailable ? resourceCostDetails : [],
      applications: applicationRows.sort((a, b) => b.totalCost - a.totalCost),
      openAiUsage,
      llm: {
        totalCost: costAvailable ? totalLlmCost : null,
        costBreakdown: costAvailable ? llmCostBreakdown : { input: null, output: null, cache: null, other: null },
        costByModel: costAvailable ? llmCostByModel : [],
        dailyCost: costAvailable ? llmDailyCost : [],
        costDetails: costAvailable ? llmCostDetails : [],
        tokenDaily,
        deployments: deploymentRows.sort((a, b) => b.totalTokens - a.totalTokens),
        totalInputTokens: openAiUsage.reduce((s, u) => s + Number(u.inputTokens || 0), 0),
        totalOutputTokens: openAiUsage.reduce((s, u) => s + Number(u.outputTokens || 0), 0),
        totalTokens: openAiUsage.reduce((s, u) => s + Number(u.totalTokens || 0), 0),
        totalRequests: openAiUsage.reduce((s, u) => s + Number(u.requests || 0), 0),
        cacheMatchRatePct: (() => { const vals = openAiUsage.map(u => u.cacheMatchRatePct).filter(v => v != null); return vals.length ? roundPct(vals.reduce((s, v) => s + Number(v), 0) / vals.length) : null; })(),
      },
      asOf: new Date().toISOString(), partial: !costAvailable, stale: false,
      sourceStatus: {
        cost: costAvailable ? 'live' : 'unavailable',
        daily: dailyCost.length ? 'live' : (costAvailable ? 'deferred' : 'unavailable'),
        distributions: (byService.length || byRegion.length || byResourceGroup.length) ? 'live' : (costAvailable ? 'deferred' : 'unavailable'),
        llmBilling: llmBilledRows.length ? 'live' : (costAvailable ? 'unavailable' : 'deferred'),
        llmTelemetry: tokenDaily.length || deploymentRows.length ? 'live' : 'unavailable',
      },
      costQuerySource: costLoad.source, warnings: [...new Set(warnings)],
      throttled: !costAvailable && (!!costLoad.throttled || throttleRemainingMs() > 0),
      retryAfterSeconds: costLoad.retryAfterSeconds || (throttleRemainingMs() ? Math.ceil(throttleRemainingMs() / 1000) : 0),
      costDetailsPending: !!costLoad.costDetailsPending,
      cacheTtlMinutes: Math.round(CACHE_TTL_MS / 60000),
      notes: [
        'Azure ActualCost is the billed-cost source of truth. Interactive Query is preferred; Generate Cost Details Report is the automatic fallback when Query is throttled.',
        allSubscriptionResourceGroups ? 'Resource groups and resources are auto-discovered subscription-wide; AZURE_COST_RESOURCE_GROUPS is not required for coverage.' : 'Resource-group coverage is limited to configured/discovered application RGs.',
        'Azure OpenAI input/output/request metrics are read from Azure Monitor and split by ModelDeploymentName when the metric exposes that dimension.',
        'LLM input/output/cache cost is classified from the Cost Management Meter field; token telemetry is not used to estimate billed cost.',
        'No end-user identity or user-level token data is collected or displayed.',
      ],
    };
    // Do not replace a complete resource-cost snapshot with a half-refreshed one.
    // Azure Cost Management can throttle the supplementary daily/detail query
    // after the total query succeeds; that previously made charts disappear and
    // caused LIVE/PARTIAL/CACHED to oscillate on each refresh. Keep the last
    // complete resource snapshot until a new complete one is available, while
    // still carrying forward fresh Azure Monitor LLM telemetry.
    const priorComplete = lastSuccessful.get(key);
    const currentCoreComplete = result.costAvailable && result.totalCost != null && result.dailyCost?.length && result.byService?.length && result.byRegion?.length;
    if (!currentCoreComplete && priorComplete) {
      const stable = {
        ...priorComplete,
        llm: { ...priorComplete.llm, tokenDaily: result.llm?.tokenDaily || priorComplete.llm?.tokenDaily || [], deployments: result.llm?.deployments || priorComplete.llm?.deployments || [], totalInputTokens: result.llm?.totalInputTokens ?? priorComplete.llm?.totalInputTokens, totalOutputTokens: result.llm?.totalOutputTokens ?? priorComplete.llm?.totalOutputTokens, totalTokens: result.llm?.totalTokens ?? priorComplete.llm?.totalTokens, totalRequests: result.llm?.totalRequests ?? priorComplete.llm?.totalRequests, cacheMatchRatePct: result.llm?.cacheMatchRatePct ?? priorComplete.llm?.cacheMatchRatePct },
        stale: true,
        partial: false,
        throttled: !!costLoad.throttled || throttleRemainingMs() > 0,
        retryAfterSeconds: costLoad.retryAfterSeconds || (throttleRemainingMs() ? Math.ceil(throttleRemainingMs()/1000) : 0),
        lastAttemptAt: new Date().toISOString(),
        sourceStatus: { ...(priorComplete.sourceStatus || {}), cost: 'cached', daily: 'cached', distributions: 'cached', llmTelemetry: (result.llm?.tokenDaily?.length || result.llm?.deployments?.length) ? 'live' : (priorComplete.sourceStatus?.llmTelemetry || 'unavailable') },
        warnings: [...new Set(warnings)],
      };
      cache.set(key, { at: Date.now(), data: stable });
      return stable;
    }

    cache.set(key, { at: Date.now(), data: result });
    const completeCoreSnapshot = currentCoreComplete;
    if (completeCoreSnapshot) {
      lastSuccessful.set(key, result);
      persistSuccessfulCostCache(key, result);
    }
    return result;
  } catch (err) {
    const prior = lastSuccessful.get(key);
    if (prior) {
      const staleResult = {
        ...prior, stale: true, partial: true, lastAttemptAt: new Date().toISOString(),
        warnings: [...new Set([...(prior.warnings || []), `Latest Azure refresh failed: ${cleanAzureError(err)}`])],
      };
      cache.set(key, { at: Date.now(), data: staleResult });
      return staleResult;
    }
    const partial = {
      configured: true, costAvailable: false, partial: true, stale: false,
      period: { startDate: period.startDate, endDate: period.endDate, days: period.days, label: period.label },
      resourceGroups, resourceGroupCount: resourceGroups.length,
      allSubscriptionResourceGroups, resourceGroupDiscoverySource: scope.discoverySource,
      totalCost: null, resourceAttributedCost: null, currency: 'USD', budget: null, consumedPct: null, status: 'neutral',
      resourceCount: 0, openAiResourceCount: 0, byResourceGroup: [], byService: [], byRegion: [], dailyCost: [],
      resources: [], resourceCostDetails: [], applications: [], openAiUsage: [],
      llm: { totalCost: null, costBreakdown: { input: null, output: null, cache: null, other: null }, costByModel: [], dailyCost: [], tokenDaily: [], deployments: [], totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalRequests: 0, cacheMatchRatePct: null },
      asOf: new Date().toISOString(), lastAttemptAt: new Date().toISOString(),
      warnings: [`Azure data is temporarily unavailable: ${cleanAzureError(err)}`],
      notes: ['The dashboard remains visible and will populate on the next successful Azure refresh.'],
    };
    cache.set(key, { at: Date.now(), data: partial });
    return partial;
  }
}

async function getCostSummary(options = {}) { return getCostIntelligence([], options); }
function clearCache() { cache.clear(); }

module.exports = { getCostSummary, getCostIntelligence, clearCache };
