const { getAccessToken } = require('./azureCredential');
const WORKSPACE_ID = process.env.AZURE_LOG_ANALYTICS_WORKSPACE_ID;
const DEFAULT_MINUTES = 60;
const MAX_MINUTES = 31 * 24 * 60;
const KEYVAULT_REFERENCE_MONITORING = String(process.env.AZURE_KEYVAULT_REFERENCE_MONITORING || 'true').toLowerCase() !== 'false';
const KEYVAULT_REFERENCE_CACHE_MS = Math.max(30000, Number(process.env.AZURE_KEYVAULT_REFERENCE_CACHE_MS || 120000));
const keyVaultReferenceCache = new Map();

function awaitWithTimeout(promise, timeoutMs, operation) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function assertConfigured() {
  if (!WORKSPACE_ID) {
    const err = new Error('AZURE_LOG_ANALYTICS_WORKSPACE_ID is not configured');
    err.code = 'LOG_ANALYTICS_NOT_CONFIGURED';
    throw err;
  }
}

function normalizeResourceId(value) {
  return String(value || '').trim().replace(/\/+$/, '').toLowerCase();
}

function resourceNameFromId(resourceId) {
  const match = String(resourceId || '').match(/\/sites\/([^/]+)$/i);
  return match ? match[1] : String(resourceId || '').split('/').filter(Boolean).pop() || null;
}

function buildAppServiceResourceId(name, resourceGroup) {
  const subscription = process.env.AZURE_SUBSCRIPTION_ID;
  if (!subscription || !resourceGroup || !name) return null;
  return `/subscriptions/${subscription}/resourceGroups/${resourceGroup}/providers/Microsoft.Web/sites/${name}`;
}


function parseApplicationResourceMap() {
  const raw = process.env.AZURE_APP_RESOURCE_MAP_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    console.warn('[azureLogs] AZURE_APP_RESOURCE_MAP_JSON is invalid JSON:', err.message);
    return {};
  }
}

function sharedDependencyResourcesFor(applicationId) {
  const raw = process.env.AZURE_SHARED_DEPENDENCY_RESOURCE_MAP_JSON;
  if (!raw) return [];
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (err) {
    console.warn('[azureLogs] AZURE_SHARED_DEPENDENCY_RESOURCE_MAP_JSON is invalid JSON:', err.message);
    return [];
  }
  const resources = [];
  for (const [dependency, config] of Object.entries(parsed || {})) {
    const apps = Array.isArray(config?.applications) ? config.applications : [];
    if (!apps.map(v => String(v).toLowerCase()).includes(String(applicationId || '').toLowerCase())) continue;
    for (const item of (Array.isArray(config?.resources) ? config.resources : [])) {
      if (typeof item === 'string') resources.push({ role: `shared-${dependency}`, resourceId: item });
      else if (item && typeof item === 'object') resources.push({ ...item, role: item.role || `shared-${dependency}` });
    }
  }
  return resources;
}

function configuredResourcesFor(useCase) {
  const map = parseApplicationResourceMap();
  const candidates = [useCase?.id, useCase?.title]
    .filter(Boolean)
    .map(v => String(v).trim());

  for (const key of candidates) {
    const value = map[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object' && Array.isArray(value.resources)) return value.resources;
  }
  return [];
}

function inferPairedBackend(site) {
  if (process.env.AZURE_AUTO_DISCOVER_FRONTEND_BACKEND === 'false') return null;
  const value = String(site || '');
  if (!/frontend/i.test(value)) return null;
  const backend = value.replace(/frontend/ig, 'backend');
  return backend !== value ? backend : null;
}

/**
 * Resolve every Azure App Service that belongs to one Playground application.
 *
 * Supported catalog formats:
 *   azureResourceId:  "/subscriptions/.../sites/frontend"
 *   azureResourceIds: ["/subscriptions/.../sites/frontend", ".../backend"]
 *   azureResources:   [
 *     { role: "frontend", name: "my-front-end" },
 *     { role: "backend", resourceId: "/subscriptions/.../sites/my-api" }
 *   ]
 *
 * A deployment-wide mapping can also be supplied without code changes through:
 *   AZURE_APP_RESOURCE_MAP_JSON={"resume-creator":[{"role":"backend","name":"my-api"}]}
 *
 * If the public App Service name explicitly contains "frontend", a same-RG
 * backend candidate is inferred by replacing "frontend" with "backend".
 * Set AZURE_AUTO_DISCOVER_FRONTEND_BACKEND=false to disable this convention.
 *
 * The launchUrl-derived App Service is always retained as the primary target
 * unless the same resource is already explicitly configured.
 */
function resolveResourceTargets(useCase) {
  const targets = [];
  const defaultResourceGroup = useCase?.azureResourceGroup || process.env.AZURE_RESOURCE_GROUP;

  const add = (resourceId, role = 'application', name = null) => {
    if (!resourceId) return;
    const key = normalizeResourceId(resourceId);
    if (!key || targets.some((target) => normalizeResourceId(target.resourceId) === key)) return;
    targets.push({
      resourceId,
      role: role || 'application',
      name: name || resourceNameFromId(resourceId),
    });
  };

  if (useCase?.azureResourceId) add(useCase.azureResourceId, 'primary');

  for (const resourceId of Array.isArray(useCase?.azureResourceIds) ? useCase.azureResourceIds : []) {
    add(resourceId, 'application');
  }

  const addResourceConfig = (resource) => {
    if (typeof resource === 'string') {
      if (resource.startsWith('/subscriptions/')) add(resource, 'application');
      else add(buildAppServiceResourceId(resource, defaultResourceGroup), 'application', resource);
      return;
    }
    if (!resource || typeof resource !== 'object') return;
    const rg = resource.resourceGroup || defaultResourceGroup;
    const id = resource.resourceId || buildAppServiceResourceId(resource.name, rg);
    add(id, resource.role || 'application', resource.name || null);
  };

  for (const resource of Array.isArray(useCase?.azureResources) ? useCase.azureResources : []) {
    addResourceConfig(resource);
  }

  // Environment-based map lets every frontend/backend application be configured
  // centrally without editing data.js for each deployment/environment.
  for (const resource of configuredResourcesFor(useCase)) {
    addResourceConfig(resource);
  }

  // Backward-compatible fallback: infer the App Service from the public URL
  // ONLY when no explicit frontend resource has been configured. In several
  // Azure environments the public hostname includes a globally-unique suffix
  // while the ARM site resource name does not. Treating that hostname as a
  // second frontend creates a false ARM 404 and prevents recovery even when the
  // explicitly mapped frontend and backend are both Running.
  const hasExplicitFrontend = targets.some((target) =>
    String(target.role || '').toLowerCase() === 'frontend'
  );
  if (!hasExplicitFrontend) {
    try {
      const host = new URL(useCase?.launchUrl).hostname;
      const site = host.split('.')[0];
      add(buildAppServiceResourceId(site, defaultResourceGroup), 'frontend', site);

      // Safe convention-based pairing: only infer a backend when the Azure App
      // Service name explicitly contains the word "frontend".
      const inferredBackend = inferPairedBackend(site);
      if (inferredBackend) {
        add(buildAppServiceResourceId(inferredBackend, defaultResourceGroup), 'backend', inferredBackend);
      }
    } catch (_) { /* no launch URL */ }
  }

  return targets;
}

function resolveResourceIds(useCase) {
  return resolveResourceTargets(useCase).map((target) => target.resourceId);
}

// Legacy helper kept for App Service restart logic: restart only the primary /
// public App Service, never every backend dependency resource.
function resolveResourceId(useCase) {
  return resolveResourceTargets(useCase)[0]?.resourceId || null;
}

function keyVaultReferenceSettingName(item) {
  if (item?.name) return String(item.name);
  const parts = String(item?.id || '').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : 'App setting';
}

function keyVaultStatusSeverity(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'resolved') return null;
  if (s === 'initialized') return 'medium';
  // InvalidSyntax, VaultNotFound, SecretNotFound, SecretVersionNotFound,
  // AccessToKeyVaultDenied, UnauthorizedClient, etc. can make the application
  // workflow unusable even when the public frontend still returns HTTP 200.
  return 'critical';
}

async function getKeyVaultReferenceErrors(resourceIdOrIds) {
  const fetch = (url, options) => globalThis.fetch(url, {
    ...options,
    signal: AbortSignal.timeout(8000),
  });
  if (!KEYVAULT_REFERENCE_MONITORING) return [];
  const ids = [...new Set(toResourceIdArray(resourceIdOrIds).map(v => String(v || '').replace(/\/+$/, '')).filter(v => /\/providers\/microsoft\.web\/sites\/[^/]+$/i.test(v)))];
  if (!ids.length) return [];
  const token = await awaitWithTimeout(
    getAccessToken('https://management.azure.com/.default'),
    8000,
    'Azure management token acquisition',
  );
  if (!token?.token) return [];
  const now = Date.now();
  const out = [];
  for (const resourceId of ids) {
    const cacheKey = normalizeResourceId(resourceId);
    const cached = keyVaultReferenceCache.get(cacheKey);
    if (cached && now - cached.at < KEYVAULT_REFERENCE_CACHE_MS) {
      out.push(...cached.rows);
      continue;
    }
    try {
      // App Service exposes Key Vault reference resolution through the
      // configreferences/appsettings/list action (POST). Use the stable API
      // version supported by App Service rather than preview-version paths.
      const url = `https://management.azure.com${resourceId}/config/configreferences/appsettings/list?api-version=2022-03-01`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      const lastStatus = response.status;
      if (!response?.ok) {
        const diagnostic = `Key Vault reference status API unavailable (${lastStatus || 'unknown'}). Reader permission on the monitored App Service/resource group is required.`;
        console.warn(`[azureLogs] ${diagnostic} Resource=${resourceNameFromId(resourceId)}`);
        keyVaultReferenceCache.set(cacheKey, { at: now, rows: [] });
        continue;
      }
      const payload = await response.json();
      const rows = [];
      // The ARM action returns properties keyed by app-setting name. Retain
      // compatibility with array-shaped responses from older API variants.
      const entries = Array.isArray(payload.value)
        ? payload.value.map((item) => [keyVaultReferenceSettingName(item), item?.properties || {}])
        : Object.entries(payload.properties || {});
      for (const [setting, propsValue] of entries) {
        const props = propsValue?.properties || propsValue || {};
        const severity = keyVaultStatusSeverity(props.status);
        if (!severity) continue;
        const details = String(props.details || '').trim();
        const message = `Key Vault reference for app setting ${setting} is ${props.status || 'unresolved'}${details ? `: ${details}` : ''}`;
        rows.push({
          TimeGenerated: new Date().toISOString(),
          Source: 'KeyVaultReference',
          Level: severity === 'critical' ? 'Error' : 'Warning',
          Message: message,
          _ResourceId: resourceId,
          Dependency: 'Key Vault',
          ErrorCategory: 'key_vault_reference',
          Severity: severity,
          ResourceName: resourceNameFromId(resourceId),
          AppSettingName: setting,
          KeyVaultResolveStatus: props.status || null,
          VaultName: props.vaultName || null,
          SecretName: props.secretName || null,
        });
      }
      keyVaultReferenceCache.set(cacheKey, { at: now, rows });
      out.push(...rows);
    } catch (err) {
      console.warn(`[azureLogs] Key Vault reference status check failed for ${resourceNameFromId(resourceId)}: ${err.message}`);
    }
  }
  return out;
}

async function query(kql, minutes, range = null) {
  const fetch = (url, options) => globalThis.fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  assertConfigured();
  const safeMinutes = Math.min(Math.max(Number(minutes) || DEFAULT_MINUTES, 1), MAX_MINUTES);
  let timespan = `PT${safeMinutes}M`;
  if (range?.start && range?.end) {
    const start = new Date(range.start);
    const end = new Date(range.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
      throw new Error('Invalid Log Analytics custom time range');
    }
    if ((end.getTime() - start.getTime()) > MAX_MINUTES * 60 * 1000) {
      throw new Error('Custom Log Analytics range cannot exceed 31 days');
    }
    timespan = `${start.toISOString()}/${end.toISOString()}`;
  }
  const token = await awaitWithTimeout(
    getAccessToken('https://api.loganalytics.io/.default'),
    8000,
    'Log Analytics token acquisition',
  );
  if (!token?.token) throw new Error('Unable to acquire Log Analytics token');
  const endpoint = `https://api.loganalytics.azure.com/v1/workspaces/${encodeURIComponent(WORKSPACE_ID)}/query`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: kql, timespan }),
  });
  if (!response.ok) throw new Error(`Log Analytics query failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json();
  const table = payload.tables?.[0];
  if (!table) return [];
  const names = (table.columns || []).map(c => c.name);
  return (table.rows || []).map(row => Object.fromEntries(names.map((name, i) => [name, row[i]])));
}

function toResourceIdArray(resourceIdOrIds) {
  return (Array.isArray(resourceIdOrIds) ? resourceIdOrIds : [resourceIdOrIds])
    .filter(Boolean);
}

function resourceFilter(resourceIdOrIds) {
  const ids = [...new Set(toResourceIdArray(resourceIdOrIds).map(normalizeResourceId).filter(Boolean))];
  if (!ids.length) return null;
  const quoted = ids.map(id => `"${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',');
  // Azure resource IDs are case-insensitive.  tolower() also protects us from
  // the common resourceGroups/resourcegroups casing difference in Log Analytics.
  return `tolower(_ResourceId) in (${quoted})`;
}

// Build stable application aliases for related resources whose Azure resource ID is
// not explicitly mapped (for example a Function App backend).  Exact resource IDs
// remain the primary match; aliases are a scoped fallback for the selected app only.
function applicationAliases(useCase) {
  const values = [useCase?.id, useCase?.title];
  try {
    const host = new URL(useCase?.launchUrl).hostname;
    values.push(host.split('.')[0]);
  } catch (_) {}
  const aliases = new Set();
  for (const value of values.filter(Boolean)) {
    const raw = String(value).trim().toLowerCase();
    if (!raw) continue;
    aliases.add(raw);
    aliases.add(raw.replace(/[^a-z0-9]/g, ''));

    // Generic related-resource discovery: include distinctive words from the
    // catalog name/id so frontend, backend App Services and Function Apps can
    // be correlated without a per-application environment-variable map.
    // Keep tokens reasonably long and ignore generic platform words to reduce
    // cross-application matches (for example "creator" alone is not enough).
    const ignored = new Set(['azure','application','service','frontend','backend','function','webapp','website','creator','manager','tool','admin','panel']);
    for (const token of raw.split(/[^a-z0-9]+/).filter(Boolean)) {
      if (token.length >= 6 && !ignored.has(token)) aliases.add(token);
    }
  }
  return [...aliases].filter(v => v.length >= 5);
}

function resourceFilterForUseCase(useCase, resourceIdOrIds) {
  const exact = resourceFilter(resourceIdOrIds);
  const aliases = applicationAliases(useCase);
  const aliasClauses = aliases.map(alias => {
    const safe = alias.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `tolower(_ResourceId) contains "${safe}"`;
  });
  if (exact && aliasClauses.length) return `(${exact} or ${aliasClauses.join(' or ')})`;
  return exact || (aliasClauses.length ? `(${aliasClauses.join(' or ')})` : null);
}

function classifyLogRow(row) {
  // Classify from the complete telemetry context, not only Message. App Insights
  // dependency rows often identify the service in Type/Name/Target or resource ID.
  const message = String(row?.Message || '');
  const context = [message, row?.Type, row?.Name, row?.Target, row?.ResourceName, row?._ResourceId].filter(Boolean).join(' ');
  const t = context.toLowerCase();
  // App Service Always On probes commonly request GET /; a backend API may
  // legitimately return 404 because it has no root route. npm's successful
  // registry fetches are also frequently emitted on stderr with a cache-miss
  // suffix and can arrive from Azure with Level=Error. Preserve these rows in
  // Complete Error Logs, but classify them as informational for health state.
  const alwaysOnRoot404 = /(?:ua[=:\s]+alwayson|always on)/i.test(context) &&
    /(?:\b404\s+get\s+\/|get\s+\/\s+http\/1\.[01].{0,40}404|get\s+\/\s+status=404|404\s+not found)/i.test(context);
  const successfulNpmFetch = /npm http fetch get 2\d\d\b/i.test(message) &&
    /registry\.npmjs\.org/i.test(message);
  const infoTagged = /(?:^|\|)\s*info\s*(?:\||:)/i.test(message);
  const successfulInfoLine = infoTagged &&
    !/\b(?:failed|failure|exception|fatal|error|401|403|404|408|429|5\d\d|unauthorized|forbidden|invalid|missing|not found|denied|connection refused|connection reset|timed out|timeout|service unavailable|unavailable|quota|throttl)\b/i.test(message);
  let dependency = null;
  let category = 'application';
  if (/azure[ -]?openai|openai|aoai|cognitive services|azure ai inference|chat completions|model endpoint|model deployment|deployment.*(?:not found|unavailable)|gpt-4|gpt-35/.test(t)) {
    dependency = 'Azure OpenAI'; category = 'azure_openai';
  } else if (/azure sql|sql server|database|jdbc|odbc|pyodbc|sequelize|entity framework/.test(t)) {
    dependency = 'Database / SQL'; category = 'database';
  } else if (/blob|storage account|azure storage|queue storage|table storage|data lake/.test(t)) {
    dependency = 'Azure Storage'; category = 'storage';
  } else if (/key vault|keyvault|secret|certificate|@microsoft\.keyvault|secreturi/.test(t)) {
    dependency = 'Key Vault'; category = 'key_vault';
  } else if (/redis|cache/.test(t)) {
    dependency = 'Redis / Cache'; category = 'cache';
  } else if (/service bus|event hub|eventhub|event grid|rabbitmq|kafka/.test(t)) {
    dependency = 'Messaging'; category = 'messaging';
  } else if (/azure ai search|cognitive search|search service|search index|search endpoint/.test(t)) {
    dependency = 'Azure AI Search'; category = 'search';
  } else if (/neo4j|neo4j[._ -]?(?:driver|exceptions?|error|database)|neo[.]clienterror|graphdatabase[.]driver|bolt(?:\+s)?:\/\/|(?:serviceunavailable|sessionexpired|transienterror).*?(?:neo4j|bolt|graph database)|(?:neo4j|bolt|graph database).*(?:service unavailable|connection refused|connection timeout|session expired|transaction failed|routing information|unavailable)/.test(t)) {
    dependency = 'Neo4j'; category = 'graph_database';
  } else if (/cosmos db|cosmosdb|mongodb|postgres(?:ql)?|mysql|mariadb/.test(t)) {
    dependency = 'Database'; category = 'database';
  } else if (/managed identity|managedidentity|identity endpoint|token acquisition|credential unavailable/.test(t)) {
    dependency = 'Azure Identity'; category = 'identity';
  } else if (/dns|name resolution|econnrefused|econnreset|socket|connection refused|connection reset|tls handshake|certificate verify|ssl error/.test(t)) {
    dependency = 'Network / External dependency'; category = 'network';
  }

  if (alwaysOnRoot404 || successfulNpmFetch || successfulInfoLine) {
    return {
      ...row,
      Dependency: dependency,
      ErrorCategory: category,
      Severity: 'low',
      ResourceName: resourceNameFromId(row?._ResourceId),
    };
  }

  // Client request failures (for example an unauthenticated 401, an expected
  // 404, or invalid user input) are not evidence that the application itself
  // is unhealthy. Keep them in the log view, but don't let them degrade the
  // service-level health state. Dependency failures remain separately classified.
  const source = String(row?.Source || '');
  const requestStatus = source === 'HTTP'
    ? Number(message.match(/^\s*(\d{3})\b/)?.[1])
    : source === 'Application Insights Request'
      ? Number(message.match(/\bresult=(\d{3})\b/i)?.[1])
      : NaN;
  const explicitDependencyAuthFailure = Boolean(dependency) &&
    /(?:\b401\b|\b403\b|unauthorized|forbidden|invalid api key|incorrect api key|authentication failed|credential rejected|permission denied)/i.test(context);
  if (requestStatus >= 400 && requestStatus < 500 && requestStatus !== 408 && requestStatus !== 429 &&
      !explicitDependencyAuthFailure) {
    return {
      ...row,
      Dependency: dependency,
      ErrorCategory: category,
      Severity: 'low',
      ResourceName: resourceNameFromId(row?._ResourceId),
    };
  }

  // Canonical operational severity used by the admin dashboard.
  // We intentionally classify impact, not volume: one broken credential can be
  // more important than hundreds of harmless request/diagnostic lines.
  const level = String(row?.Level || '').toLowerCase();
  const sourceName = String(row?.Source || '').toLowerCase();
  let severity = level === 'critical' ? 'critical' :
    (level === 'error' && !infoTagged ? 'high' : 'low');
  // Application Insights exception records are meaningful failure evidence,
  // but they still pass through the health engine's consecutive-cycle gate
  // unless they match an explicit fatal/crash signature below.
  if (sourceName === 'application insights exception' && level === 'error') severity = 'high';

  // Critical = primary workflow/security/dependency is unusable and owner action is required now.
  if (/fatal|critical|unhandled|out of memory|heap out of memory|process crash|application crash|worker failed to boot|failed to start|startup failure|container.*(?:exit|crash)|host.*shutdown/.test(t)) severity = 'critical';
  else if (/\b401\b|\b403\b|unauthorized|forbidden|permissiondenied|authentication|invalid credential|invalid api key|incorrect api key|invalid subscription key|api[_\s-]?key.*(?:missing|invalid|not set|not configured|unavailable|not found|must be set)|(?:missing|invalid|expired|not configured|not set|not found|must be set).*api[_\s-]?key|key vault.*(?:denied|failed|unavailable|not able to be resolved|unresolved|invalidsyntax|vaultnotfound|secretnotfound|access.*denied)|secret.*(?:missing|failed|unavailable|not found|can(?:not|'t) be found)|secreturi.*(?:invalid|missing)|@microsoft\.keyvault/.test(t)) severity = 'critical';

  // High = significant service degradation, quota exhaustion or server-side failures.
  else if (/\b429\b|too many requests|quota|throttl|rate limit|resource exhausted/.test(t)) severity = 'high';
  else if (/\b500\b|\b502\b|\b503\b|\b504\b|service unavailable|bad gateway|gateway timeout|request failed with status code 5\d\d/.test(t)) severity = 'high';
  else if (dependency && /serviceunavailable|connection refused|connection reset|connection timed out|\btimeout\b|name or service not known|failed to dns resolve|temporar(?:y|ily) unavailable|request failed|operation failed/.test(t)) severity = 'high';
  // A confirmed graph-database outage is a high-impact dependency failure even
  // when its own driver message does not carry an HTTP status code.
  if (dependency === 'Neo4j' && /serviceunavailable|sessionexpired|connection refused|connection timeout|routing information|transaction failed|\b503\b|unavailable/.test(t)) severity = 'critical';

  // Medium = transient/retriable dependency or connectivity problem.
  else if (/timeout|timed out|econnrefused|econnreset|connection refused|connection reset|dns|name resolution|temporar(?:y|ily) unavailable/.test(t)) severity = 'medium';

  // A web-server access line such as GET / HTTP/1.1 404 is request noise, not
  // evidence that a backend dependency is unhealthy. Keep it visible only as low.
  else if (/\"(?:get|head|options)\s+[^\"]*http\/1\.[01]\"\s+404\s+not found|\b(?:get|head|options)\b.*\b404\s+not found|\b404\s+get\s+\//.test(t)) severity = 'low';

  // Low / informational = diagnostic noise or non-impacting warnings that should
  // remain visible in complete logs but should not by themselves degrade the app.
  else if (/\binfo\b|informational|health check|alwayson|startup|started|retry succeeded|recovered|successful/.test(t)) severity = 'low';

  return {
    ...row,
    Dependency: dependency,
    ErrorCategory: category,
    Severity: severity,
    ResourceName: resourceNameFromId(row?._ResourceId),
  };
}

function consoleErrorWhereClause() {
  // Some App Service streams have been observed to label ordinary INFO request
  // lines as Level=Error.  Exclude obvious successful INFO traffic while still
  // accepting true Error-level stack traces and explicit failure keywords.
  return `(
    LogMessage has_any (
      "error", "exception", "fatal", "unhandled", "crash", "failed", "failure",
      "permissiondenied", "unauthorized", "forbidden", "invalid subscription key",
      "invalid api key", "timeout", "timed out", "too many requests", "quota", "throttl",
      "task not found", "secret not found", "neo4j", "bolt", "serviceunavailable", "transaction failed", "vault not found", "deployment not found",
      "missing", "unavailable", "cannot", "unable", "denied"
    )
    or (
      Level =~ "Error"
      and LogMessage !contains "| INFO |"
      and not(LogMessage matches regex @"status=2[0-9][0-9]")
    )
  )`;
}

function completeConsoleHistoryWhereClause() {
  // Complete Error Logs is an evidence/history view, not the health classifier.
  // Keep request-level 4xx/404 lines visible here (as LOW) so operators can see
  // exactly what Azure ingested, while the health polling path continues to
  // ignore those lines as actionable incidents.
  return `(
    Level in~ ("Error", "Warning", "Critical")
    or LogMessage has_any (
      "error", "exception", "fatal", "warning", "failed", "failure",
      "not found", "unauthorized", "forbidden", "invalid", "missing",
      "unavailable", "cannot", "unable", "denied", "timeout", "throttl",
      "neo4j", "bolt", "serviceunavailable", "transaction failed"
    )
    or LogMessage matches regex @"\\b[45][0-9][0-9]\\b"
  )`;
}

async function getErrors(resourceIdOrIds, minutes = DEFAULT_MINUTES, limit = 100, range = null) {
  const ids = toResourceIdArray(resourceIdOrIds);
  if (!ids.length) return { configured: false, errors: [], reason: 'Azure App Service resource ID is not configured' };
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const filter = resourceFilter(ids);
  const kql = `
union isfuzzy=true
(
  AppServiceConsoleLogs
  | where ${filter}
  | extend LogMessage=iff(isempty(tostring(column_ifexists("Message", ""))), tostring(column_ifexists("ResultDescription", "")), tostring(column_ifexists("Message", "")))
  | where ${completeConsoleHistoryWhereClause()}
  | project TimeGenerated, Source="Console", Level, Message=LogMessage, _ResourceId
),
(
  FunctionAppLogs
  | where ${filter}
  | where Level in~ ("Error", "Warning", "Critical", "Information", "Informational")
      or Message has_any ("error", "exception", "failed", "failure", "not found", "unauthorized", "forbidden", "invalid", "missing", "unavailable", "timeout", "neo4j", "bolt", "serviceunavailable", "transaction failed")
      or Message matches regex @"\b[45][0-9][0-9]\b"
  | project TimeGenerated, Source="Function App", Level, Message=strcat(iff(isempty(FunctionName), "", strcat("[", FunctionName, "] ")), Message), _ResourceId
),
(
  AppServicePlatformLogs
  | where ${filter}
  | where Level in~ ("Error", "Warning", "Critical") or Message has_any ("Key Vault", "KeyVault", "secret", "credential", "authentication", "failed", "exception")
  | project TimeGenerated, Source="Platform", Level, Message=strcat(Message, iff(isempty(Exception), "", strcat(" | ", Exception))), _ResourceId
),
(
  AppExceptions
  | where ${filter}
  | project TimeGenerated, Source="Application Insights Exception", Level="Error", Message=strcat(tostring(ExceptionType), ": ", tostring(OuterMessage), iff(isempty(tostring(InnermostMessage)), "", strcat(" | Inner: ", tostring(InnermostMessage)))), _ResourceId
),
(
  AppTraces
  | where ${filter}
  | where toint(SeverityLevel) >= 2 or Message has_any ("error", "exception", "fatal", "failed", "failure", "timeout", "throttl", "unauthorized", "forbidden")
  | project TimeGenerated, Source="Application Insights Trace", Level=case(toint(SeverityLevel) >= 4, "Critical", toint(SeverityLevel) >= 3, "Error", toint(SeverityLevel) == 2, "Warning", "Information"), Message, _ResourceId
),
(
  AppRequests
  | where ${filter}
  | where Success == false or toint(ResultCode) >= 400
  | project TimeGenerated, Source="Application Insights Request", Level=iff(toint(ResultCode) >= 500, "Error", "Informational"), Message=strcat(tostring(Name), " result=", tostring(ResultCode), " durationMs=", tostring(DurationMs), iff(isempty(tostring(Url)), "", strcat(" url=", tostring(Url)))), _ResourceId
),
(
  AppDependencies
  | where ${filter}
  | where Success == false or toint(ResultCode) >= 400
  | project TimeGenerated, Source="Application Insights Dependency", Level=iff(toint(ResultCode) >= 500, "Error", "Warning"), Message=strcat(tostring(Type), " ", tostring(Name), " target=", tostring(Target), " result=", tostring(ResultCode), " durationMs=", tostring(DurationMs)), _ResourceId
),
(
  AppServiceHTTPLogs
  | where ${filter}
  | where ScStatus between (200 .. 599)
  | project TimeGenerated, Source="HTTP", Level=iff(ScStatus >= 500, "Error", iff(ScStatus >= 400, "Warning", "Information")), Message=strcat(tostring(ScStatus), " ", CsMethod, " ", CsUriStem), _ResourceId
)
| order by TimeGenerated desc
| take ${safeLimit}`;
  try {
    // Complete Error Logs is a direct Log Analytics evidence view. Preserve the
    // workspace Level exactly as returned (Informational/Error/Warning/Critical).
    // Do not inject ARM/Key Vault synthetic rows and do not replace Level with the
    // dashboard's contextual operational severity. Health classification is separate.
    const errors = (await query(kql, minutes, range))
      .map((row) => ({
        ...row,
        ResourceName: resourceNameFromId(row?._ResourceId),
      }))
      .sort((a, b) => new Date(b.TimeGenerated || 0) - new Date(a.TimeGenerated || 0))
      .slice(0, safeLimit);
    return { configured: true, errors, range: range || { minutes }, source: 'Azure Log Analytics' };
  } catch (err) {
    if (err.code === 'LOG_ANALYTICS_NOT_CONFIGURED') return { configured: false, errors: [], reason: err.message };
    throw err;
  }
}

async function getErrorsForUseCase(useCase, minutes = DEFAULT_MINUTES, limit = 100, range = null) {
  const ids = resolveResourceIds(useCase);
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const filter = resourceFilterForUseCase(useCase, ids);
  if (!filter) return { configured: false, errors: [], reason: 'Azure resource mapping is not configured' };
  const kql = `
union isfuzzy=true
(
  AppServiceConsoleLogs
  | where ${filter}
  | extend LogMessage=iff(isempty(tostring(column_ifexists("Message", ""))), tostring(column_ifexists("ResultDescription", "")), tostring(column_ifexists("Message", "")))
  | where ${completeConsoleHistoryWhereClause()}
  | project TimeGenerated, Source="Console", Level, Message=LogMessage, _ResourceId
),
(
  FunctionAppLogs
  | where ${filter}
  | where Level in~ ("Error", "Warning", "Critical", "Information", "Informational")
      or Message has_any ("error", "exception", "failed", "failure", "not found", "unauthorized", "forbidden", "invalid", "missing", "unavailable", "timeout", "neo4j", "bolt", "serviceunavailable", "transaction failed")
      or Message matches regex @"\\b[45][0-9][0-9]\\b"
  | project TimeGenerated, Source="Function App", Level, Message=strcat(iff(isempty(FunctionName), "", strcat("[", FunctionName, "] ")), Message), _ResourceId
),
(
  AppServicePlatformLogs
  | where ${filter}
  | where Level in~ ("Error", "Warning", "Critical") or Message has_any ("Key Vault", "KeyVault", "secret", "credential", "authentication", "failed", "exception")
  | project TimeGenerated, Source="Platform", Level, Message=strcat(Message, iff(isempty(Exception), "", strcat(" | ", Exception))), _ResourceId
),
(
  AppExceptions
  | where ${filter}
  | project TimeGenerated, Source="Application Insights Exception", Level="Error", Message=strcat(tostring(ExceptionType), ": ", tostring(OuterMessage), iff(isempty(tostring(InnermostMessage)), "", strcat(" | Inner: ", tostring(InnermostMessage)))), _ResourceId
),
(
  AppTraces
  | where ${filter}
  | where toint(SeverityLevel) >= 2 or Message has_any ("error", "exception", "fatal", "failed", "failure", "timeout", "throttl", "unauthorized", "forbidden")
  | project TimeGenerated, Source="Application Insights Trace", Level=case(toint(SeverityLevel) >= 4, "Critical", toint(SeverityLevel) >= 3, "Error", toint(SeverityLevel) == 2, "Warning", "Information"), Message, _ResourceId
),
(
  AppRequests
  | where ${filter}
  | where Success == false or toint(ResultCode) >= 400
  | project TimeGenerated, Source="Application Insights Request", Level=iff(toint(ResultCode) >= 500, "Error", "Informational"), Message=strcat(tostring(Name), " result=", tostring(ResultCode), " durationMs=", tostring(DurationMs), iff(isempty(tostring(Url)), "", strcat(" url=", tostring(Url)))), _ResourceId
),
(
  AppDependencies
  | where ${filter}
  | where Success == false or toint(ResultCode) >= 400
  | project TimeGenerated, Source="Application Insights Dependency", Level=iff(toint(ResultCode) >= 500, "Error", "Warning"), Message=strcat(tostring(Type), " ", tostring(Name), " target=", tostring(Target), " result=", tostring(ResultCode), " durationMs=", tostring(DurationMs)), _ResourceId
),
(
  AppServiceHTTPLogs
  | where ${filter}
  | where ScStatus >= 400
  | project TimeGenerated, Source="HTTP", Level=iff(ScStatus >= 500, "Error", "Informational"), Message=strcat(tostring(ScStatus), " ", CsMethod, " ", CsUriStem), _ResourceId
)
| order by TimeGenerated desc
| take ${safeLimit}`;
  try {
    const errors = (await query(kql, minutes, range))
      .map(row => ({ ...row, ResourceName: resourceNameFromId(row?._ResourceId) }))
      .sort((a,b) => new Date(b.TimeGenerated || 0) - new Date(a.TimeGenerated || 0))
      .slice(0, safeLimit);
    return {
      configured: true, errors, range: range || { minutes }, source: 'Azure Log Analytics',
      monitoredResources: resolveResourceTargets(useCase),
      aliasFallback: applicationAliases(useCase),
    };
  } catch (err) {
    if (err.code === 'LOG_ANALYTICS_NOT_CONFIGURED') return { configured: false, errors: [], reason: err.message };
    throw err;
  }
}

async function getErrorsForApplications(applications, minutes = DEFAULT_MINUTES, limitPerApp = 50) {
  assertConfigured();

  const appTargets = applications
    .map(app => {
      const targets = resolveResourceTargets(app);
      // Console telemetry can arrive with an empty _ResourceId (the supplied
      // Advisor Intelligence logs show resourceId="" but include containerName).
      // Retain a name-only target so ContainerName matching can still associate
      // those records with the correct application without inventing an ARM ID.
      try {
        const siteName = new URL(app?.launchUrl).hostname.split('.')[0];
        // Azure App Service hostnames may append a generated stamp/hash while
        // console ContainerName contains only the stable site name. Keep both.
        const stableSiteName = siteName.replace(/-[a-z0-9]{8,}$/i, '');
        for (const name of new Set([siteName, stableSiteName])) {
          if (name && !targets.some(t => String(t.name || '').toLowerCase() === name.toLowerCase())) {
            targets.push({ resourceId: null, role: 'frontend', name });
          }
        }
      } catch (_) { /* no launch URL */ }
      // Shared dependencies (for example one Neo4j cluster used by Advisor
      // Intelligence and Agenda Creator) are mapped to every declared consumer.
      for (const resource of sharedDependencyResourcesFor(app.id)) {
        const resourceId = resource.resourceId || buildAppServiceResourceId(resource.name, resource.resourceGroup || app.azureResourceGroup || process.env.AZURE_RESOURCE_GROUP);
        if (resourceId && !targets.some(t => normalizeResourceId(t.resourceId) === normalizeResourceId(resourceId))) {
          targets.push({ resourceId, role: resource.role || 'shared-dependency', name: resource.name || resourceNameFromId(resourceId) });
        }
      }
      return { id: app.id, title: app.title, targets };
    })
    .filter(app => app.targets.length);

  if (!appTargets.length) return { configured: true, apps: {} };

  const resourceToApp = new Map();
  const allResourceIds = [];
  for (const app of appTargets) {
    for (const target of app.targets) {
      const key = normalizeResourceId(target.resourceId);
      // Do not index name-only fallback targets under the empty resource ID:
      // otherwise every empty-_ResourceId console row would be attributed to
      // every application. Those rows are matched below by ContainerName.
      if (key) {
        if (!resourceToApp.has(key)) resourceToApp.set(key, []);
        const owners = resourceToApp.get(key);
        if (!owners.some(owner => owner.appId === app.id)) owners.push({ appId: app.id, target });
        allResourceIds.push(target.resourceId);
      }
    }
  }

  const safeLimit = Math.min(Math.max(Number(limitPerApp) || 50, 1), 100);
  const filter = resourceFilter(allResourceIds) || 'false';
  // AppServiceConsoleLogs can contain valid container telemetry with an empty
  // _ResourceId. Match the exact App Service/container names as a scoped fallback.
  const aliasesByApp = new Map(applications.map(app => [app.id, applicationAliases(app)]));
  const containerAliases = [...new Set(appTargets.flatMap(app => [
    ...app.targets.map(t => t.name).filter(Boolean).map(String),
    ...(aliasesByApp.get(app.id) || []),
  ]))].filter(v => v.length >= 5);
  const containerMatchKql = containerAliases.length
    ? containerAliases.map(v => `tolower(tostring(ContainerName)) contains "${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(' or ')
    : 'false';
  const kql = `
union isfuzzy=true
(
  AppServiceConsoleLogs
  | where (${filter} or (${containerMatchKql}))
  | extend LogMessage=iff(isempty(tostring(column_ifexists("Message", ""))), tostring(column_ifexists("ResultDescription", "")), tostring(column_ifexists("Message", "")))
  | where ${consoleErrorWhereClause()}
  | project TimeGenerated, Source="Console", Level, Message=LogMessage, _ResourceId, ContainerName
),
(
  FunctionAppLogs
  | where ${filter}
  | where Level in~ ("Error", "Warning", "Critical") or Message has_any ("error", "exception", "failed", "failure", "unavailable", "timeout", "neo4j", "bolt", "serviceunavailable", "transaction failed")
  | project TimeGenerated, Source="Function App", Level, Message=strcat(iff(isempty(FunctionName), "", strcat("[", FunctionName, "] ")), Message), _ResourceId
),
(
  AppServicePlatformLogs
  | where ${filter}
  | where Level in~ ("Error", "Warning", "Critical") or Message has_any ("Key Vault", "KeyVault", "secret", "credential", "authentication", "failed", "exception")
  | project TimeGenerated, Source="Platform", Level, Message=strcat(Message, iff(isempty(Exception), "", strcat(" | ", Exception))), _ResourceId
),
(
  AppExceptions
  | where ${filter}
  | project TimeGenerated, Source="Application Insights Exception", Level="Error", Message=strcat(tostring(ExceptionType), ": ", tostring(OuterMessage), iff(isempty(tostring(InnermostMessage)), "", strcat(" | Inner: ", tostring(InnermostMessage)))), _ResourceId
),
(
  AppTraces
  | where ${filter}
  | where toint(SeverityLevel) >= 2 or Message has_any ("error", "exception", "fatal", "failed", "failure", "timeout", "throttl", "unauthorized", "forbidden")
  | project TimeGenerated, Source="Application Insights Trace", Level=case(toint(SeverityLevel) >= 4, "Critical", toint(SeverityLevel) >= 3, "Error", toint(SeverityLevel) == 2, "Warning", "Information"), Message, _ResourceId
),
(
  AppRequests
  | where ${filter}
  | where Success == false or toint(ResultCode) >= 400
  | project TimeGenerated, Source="Application Insights Request", Level=iff(toint(ResultCode) >= 500, "Error", "Informational"), Message=strcat(tostring(Name), " result=", tostring(ResultCode), " durationMs=", tostring(DurationMs), iff(isempty(tostring(Url)), "", strcat(" url=", tostring(Url)))), _ResourceId
),
(
  AppDependencies
  | where ${filter}
  | where Success == false or toint(ResultCode) >= 400
  | project TimeGenerated, Source="Application Insights Dependency", Level=iff(toint(ResultCode) >= 500, "Error", "Warning"), Message=strcat(tostring(Type), " ", tostring(Name), " target=", tostring(Target), " result=", tostring(ResultCode), " durationMs=", tostring(DurationMs)), _ResourceId
),
(
  AppServiceHTTPLogs
  | where ${filter}
  | where ScStatus between (200 .. 599)
  | project TimeGenerated, Source="HTTP", Level=iff(ScStatus >= 500, "Error", iff(ScStatus >= 400, "Warning", "Information")), Message=strcat(tostring(ScStatus), " ", CsMethod, " ", CsUriStem), _ResourceId
)
| order by TimeGenerated desc`;

  const logRows = (await query(kql, minutes)).map(classifyLogRow);
  const kvRows = await getKeyVaultReferenceErrors(allResourceIds);
  const rows = [...kvRows, ...logRows].sort((a, b) => new Date(b.TimeGenerated || 0) - new Date(a.TimeGenerated || 0));
  const grouped = Object.fromEntries(appTargets.map(app => [app.id, []]));

  for (const row of rows) {
    let mappings = resourceToApp.get(normalizeResourceId(row._ResourceId)) || [];
    if (!mappings.length && row.ContainerName) {
      const container = String(row.ContainerName).toLowerCase();
      mappings = appTargets.flatMap(app => {
        const aliases = aliasesByApp.get(app.id) || [];
        const target = app.targets.find(t => t.name && container.includes(String(t.name).toLowerCase()))
          || app.targets.find(t => t.role === 'frontend')
          || { role: 'frontend', name: container };
        const matches = aliases.some(alias => container.includes(String(alias).toLowerCase()));
        return matches ? [{ appId: app.id, target }] : [];
      });
    }
    // A shared dependency resource may serve multiple Playground applications.
    // Fan its telemetry out to every explicitly mapped consumer, not just the
    // first application encountered in the catalog.
    for (const mapping of mappings) {
      if (grouped[mapping.appId].length >= safeLimit) continue;
      grouped[mapping.appId].push({
        ...row,
        ResourceRole: mapping.target.role,
        ResourceName: mapping.target.name || row.ResourceName,
      });
    }
  }

  return {
    configured: true,
    apps: grouped,
    monitoredResources: Object.fromEntries(appTargets.map(app => [
      app.id,
      app.targets.map(target => ({ role: target.role, name: target.name, resourceId: target.resourceId })),
    ])),
  };
}

module.exports = {
  getErrors,
  getErrorsForUseCase,
  getErrorsForApplications,
  resolveResourceId,
  resolveResourceIds,
  resolveResourceTargets,
  getKeyVaultReferenceErrors,
  classifyLogRow,
};
