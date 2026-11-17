const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the pure classifier without loading Azure SDK dependencies. This tests
// the exact function source used by azureLogs.js while keeping tests offline.
const source = fs.readFileSync(path.join(__dirname, '..', 'azureLogs.js'), 'utf8');
const helperStart = source.indexOf('function resourceNameFromId(');
const helperEnd = source.indexOf('\nfunction buildAppServiceResourceId', helperStart);
const classifierStart = source.indexOf('function classifyLogRow(');
const classifierEnd = source.indexOf('\nfunction consoleErrorWhereClause', classifierStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
assert.ok(classifierStart >= 0 && classifierEnd > classifierStart);
const sandbox = { module: { exports: {} } };
vm.runInNewContext(
  `${source.slice(helperStart, helperEnd)}\n${source.slice(classifierStart, classifierEnd)}\nmodule.exports = { classifyLogRow };`,
  sandbox,
);
const { classifyLogRow } = sandbox.module.exports;

function severity(message, sourceName = 'Console', level = 'Error') {
  return classifyLogRow({ Message: message, Source: sourceName, Level: level }).Severity;
}

test('successful npm registry cache-miss fetch is informational even when Azure labels it Error', () => {
  assert.equal(severity('npm http fetch GET 200 https://registry.npmjs.org/ajv/-/ajv-8.18.0.tgz 676ms (cache miss)'), 'low');
});

test('Always On root-path 404 is informational, including structured INFO request logs', () => {
  assert.equal(severity('INFO: 169.254.132.3:50084 - "GET / HTTP/1.1" 404 Not Found ua=AlwaysOn'), 'low');
  assert.equal(severity('2026-11-17 | INFO | resume_generator.request | GET / status=404 ua=AlwaysOn'), 'low');
});

test('ordinary backend root 404 remains visible but does not alone declare outage', () => {
  assert.equal(severity('404 GET /', 'HTTP', 'Warning'), 'low');
});

test('primary application HTTP 5xx remains a high-severity signal', () => {
  assert.equal(severity('503 GET /api/generate', 'HTTP', 'Error'), 'high');
});

test('Azure OpenAI authentication failure is critical dependency evidence', () => {
  assert.equal(severity('Azure OpenAI request failed: HTTP 401 invalid API key', 'Application Insights Dependency', 'Error'), 'critical');
});

test('successful informational dependency trace is not treated as an outage', () => {
  assert.equal(severity('INFO | Azure OpenAI request completed successfully status=200', 'Console', 'Error'), 'low');
});

test('non-fatal application exception is high and can be confirmed across monitoring cycles', () => {
  assert.equal(severity('TypeError: cannot read property from undefined', 'Application Insights Exception', 'Error'), 'high');
});


test('Resume Creator requires its exact configured Azure OpenAI API-key setting', () => {
  const { useCases } = require('../data');
  const resume = useCases.find((item) => item.id === 'resume-creator');
  const group = resume.requiredAppSettingGroups.find((item) => item.name === 'Azure OpenAI API key');
  assert.equal(group.matchMode, 'exact');
  assert.deepEqual(Array.from(group.patterns), ['AZURE_OPENAI_API_KEY']);
  assert.deepEqual(Array.from(group.roles), ['backend']);
});

test('all monitored applications retain the requested owner email', () => {
  const { useCases } = require('../data');
  assert.ok(useCases.length > 0);
  for (const useCase of useCases) {
    assert.equal(useCase.ownerEmail, 'laltupati@kpmg.com', `${useCase.id} owner email`);
  }
});

test('transient Azure OpenAI 503 is high for multi-cycle confirmation, not immediate critical', () => {
  assert.equal(severity('Azure OpenAI request failed: HTTP 503 service unavailable', 'Application Insights Dependency', 'Error'), 'high');
});


// Exercise the actual required-setting validator with mocked ARM responses.
// No setting values are printed or persisted by the production implementation.
const adminSource = fs.readFileSync(path.join(__dirname, '..', 'adminHealth.js'), 'utf8');
const settingsStart = adminSource.indexOf('async function checkRequiredAppSettings(useCase) {');
const settingsEnd = adminSource.indexOf('\nasync function restartApp(useCase)', settingsStart);
assert.ok(settingsStart >= 0 && settingsEnd > settingsStart);

async function runRequiredSettingsCheck({ targets, payload, status = 200, token = true }) {
  const sandbox = {
    module: { exports: {} },
    azureLogs: {
      resolveResourceTargets: () => targets,
      getKeyVaultReferenceErrors: async () => [],
    },
    awaitWithTimeout: async (promise) => promise,
    getAccessToken: async () => token ? ({ token: 'mock-token' }) : null,
    AbortSignal,
    console,
    fetch: async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    }),
  };
  vm.runInNewContext(
    `${adminSource.slice(settingsStart, settingsEnd)}\nmodule.exports = checkRequiredAppSettings;`,
    sandbox,
  );
  return sandbox.module.exports({
    id: 'resume-creator',
    requiredAppSettingGroups: [{
      name: 'Azure OpenAI API key',
      roles: ['backend'],
      matchMode: 'exact',
      patterns: ['AZURE_OPENAI_API_KEY'],
    }],
  });
}

test('required backend setting check marks an exactly missing API key as a confirmed failure', async () => {
  const result = await runRequiredSettingsCheck({
    targets: [{ role: 'backend', name: 'resume-backend', resourceId: '/subscriptions/s/resourceGroups/rg/providers/Microsoft.Web/sites/resume-backend' }],
    payload: { properties: { OTHER_SETTING: 'configured' } },
  });
  assert.equal(result.ok, false);
  assert.equal(result.unknown, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /is missing/i);
});

test('required backend setting check accepts a present non-empty exact API key setting', async () => {
  const result = await runRequiredSettingsCheck({
    targets: [{ role: 'backend', name: 'resume-backend', resourceId: '/subscriptions/s/resourceGroups/rg/providers/Microsoft.Web/sites/resume-backend' }],
    payload: { properties: { AZURE_OPENAI_API_KEY: 'do-not-log-this-secret' } },
  });
  assert.equal(result.ok, true);
  assert.equal(result.unknown, false);
  assert.equal(result.errors.length, 0);
});

test('required backend setting check treats ARM permission failure as inconclusive, not as a missing key', async () => {
  const result = await runRequiredSettingsCheck({
    targets: [{ role: 'backend', name: 'resume-backend', resourceId: '/subscriptions/s/resourceGroups/rg/providers/Microsoft.Web/sites/resume-backend' }],
    status: 403,
  });
  assert.equal(result.ok, false);
  assert.equal(result.unknown, true);
  assert.equal(result.errors.length, 0);
  assert.match(result.monitoringNote, /Microsoft\.Web\/sites\/config\/list\/action/);
});

test('required backend setting check reports unresolved resource mapping explicitly', async () => {
  const result = await runRequiredSettingsCheck({
    targets: [{ role: 'backend', name: 'resume-backend', resourceId: null }],
    payload: { properties: {} },
  });
  assert.equal(result.ok, false);
  assert.equal(result.unknown, true);
  assert.match(result.monitoringNote, /AZURE_SUBSCRIPTION_ID/);
});


// Fresh critical telemetry must override a successful homepage probe when the
// business workflow/dependency failure was logged moments before that probe.
const adminSourceForFreshness = fs.readFileSync(path.join(__dirname, '..', 'adminHealth.js'), 'utf8');
const freshStart = adminSourceForFreshness.indexOf('function isFreshActionableHealthLog(error, options = {}) {');
const freshEnd = adminSourceForFreshness.indexOf('\nasync function monitorApplicationLogsInternal', freshStart);
assert.ok(freshStart >= 0 && freshEnd > freshStart);
const freshnessSandbox = {
  module: { exports: {} },
  advisorNeo4jFailurePattern: /neo4j.{0,100}(serviceunavailable|connection refused|failed to dns resolve)/i,
  normalizeOperationalSeverity: (value) => {
    const v = String(value || '').toLowerCase();
    return ['critical', 'fatal', 'urgent'].includes(v) ? 'critical' : (['high', 'error'].includes(v) ? 'high' : 'low');
  },
  isCriticalApplicationLog: (row) => /invalid api key|missing api key|unhandled exception/i.test(String(row?.Message || '')),
  hasExplicitDependencyFailureSignal: (row) => /openai|neo4j|database/i.test(String(row?.Message || '')) && /failed|unavailable|401|503|timeout/i.test(String(row?.Message || '')),
  isLifecycleOnlyStoppedError: (error) => {
    const type = String(error?.errorType || error?.ErrorType || '').toLowerCase();
    const message = String(typeof error === 'string' ? error : (error?.errorMessage || error?.Message || error?.message || '')).toLowerCase();
    return type === 'app_stopped' || /azure app service (?:is )?stopped|app service state:\s*stopped|azure app service stopped \(http 503\)/i.test(message);
  },
};
vm.runInNewContext(
  `${adminSourceForFreshness.slice(freshStart, freshEnd)}\nmodule.exports = isFreshActionableHealthLog;`,
  freshnessSandbox,
);
const isFreshActionableHealthLog = freshnessSandbox.module.exports;
const nowIso = new Date().toISOString();
const recentProbeAt = Date.now();

test('fresh critical API-key failure is not masked by a later successful homepage probe', () => {
  assert.equal(isFreshActionableHealthLog({
    TimeGenerated: new Date(recentProbeAt - 5000).toISOString(),
    Severity: 'high',
    Message: 'Azure OpenAI invalid API key authentication failed',
  }, {
    appId: 'resume-creator',
    genericFreshCutoffMs: Date.now() - 300000,
    advisorNeo4jFreshCutoffMs: Date.now() - 300000,
    hasRecentSuccessfulProbe: true,
    lastProbeAt: recentProbeAt,
  }), true);
});

test('old non-critical error before a successful probe does not keep an application unavailable', () => {
  assert.equal(isFreshActionableHealthLog({
    TimeGenerated: new Date(recentProbeAt - 60000).toISOString(),
    Severity: 'high',
    Message: 'Generic application warning occurred',
  }, {
    appId: 'resume-creator',
    genericFreshCutoffMs: Date.now() - 300000,
    advisorNeo4jFreshCutoffMs: Date.now() - 300000,
    hasRecentSuccessfulProbe: true,
    lastProbeAt: recentProbeAt,
  }), false);
});


test('Azure stopped-page Log Analytics row is never fresh actionable health evidence even when labelled Error', () => {
  assert.equal(isFreshActionableHealthLog({
    TimeGenerated: nowIso,
    Source: 'Console',
    Level: 'Error',
    Message: 'Azure App Service stopped (HTTP 503)',
  }, {
    appId: 'resume-creator',
    genericFreshCutoffMs: Date.now() - 300000,
    advisorNeo4jFreshCutoffMs: Date.now() - 300000,
    hasRecentSuccessfulProbe: false,
    lastProbeAt: 0,
  }), false);
});

test('genuine Resume Creator API 503 remains fresh actionable health evidence', () => {
  assert.equal(isFreshActionableHealthLog({
    TimeGenerated: nowIso,
    Source: 'HTTP',
    Level: 'Error',
    Message: '503 POST /api/resume/generate',
  }, {
    appId: 'resume-creator',
    genericFreshCutoffMs: Date.now() - 300000,
    advisorNeo4jFreshCutoffMs: Date.now() - 300000,
    hasRecentSuccessfulProbe: false,
    lastProbeAt: 0,
  }), true);
});

test('Advisor Intelligence Neo4j failure is actionable even when logged before a successful homepage probe', () => {
  assert.equal(isFreshActionableHealthLog({
    TimeGenerated: new Date(recentProbeAt - 5000).toISOString(),
    Severity: 'Information',
    Message: 'neo4j.exceptions.ServiceUnavailable: Failed to DNS resolve address databases.neo4j.io',
  }, {
    appId: 'advisor-intelligence',
    genericFreshCutoffMs: Date.now() - 300000,
    advisorNeo4jFreshCutoffMs: Date.now() - 300000,
    hasRecentSuccessfulProbe: true,
    lastProbeAt: recentProbeAt,
  }), true);
});

// Exercise the recovery notification sender with a mocked Logic App webhook.
test('recovery notification payload is sent once per Stopped/Unavailable -> Available transition', async () => {
  const Module = require('node:module');
  const originalLoad = Module._load;
  const originalFetch = global.fetch;
  const originalWebhook = process.env.OWNER_NOTIFICATION_WEBHOOK_URL;
  const originalStateDir = process.env.HEALTH_STATE_DIR;
  const originalIncidentFile = process.env.INCIDENT_LOG_FILE;
  const tempDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'health-recovery-test-'));
  const sentPayloads = [];
  process.env.OWNER_NOTIFICATION_WEBHOOK_URL = 'https://logic-app.example.test/trigger';
  process.env.HEALTH_STATE_DIR = tempDir;
  process.env.INCIDENT_LOG_FILE = path.join(tempDir, 'incidents.json');
  global.fetch = async (_url, options) => {
    sentPayloads.push(JSON.parse(options.body));
    return { ok: true, status: 202, text: async () => '{"sent":true}' };
  };
  Module._load = function(request, parent, isMain) {
    if (parent?.filename?.endsWith(path.join('server', 'adminHealth.js')) && request === './azureCredential') {
      return { getAccessToken: async () => ({ token: 'test-token' }) };
    }
    if (parent?.filename?.endsWith(path.join('server', 'adminHealth.js')) && request === './azureLogs') {
      return {
        resolveResourceTargets: () => [], resolveResourceId: () => null,
        resolveResourceIds: () => [], getKeyVaultReferenceErrors: async () => [],
        getErrors: async () => ({ configured: true, errors: [] }),
        getErrorsForApplications: async () => ({ configured: true, apps: {} }),
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const modulePath = require.resolve('../adminHealth');
    delete require.cache[modulePath];
    const health = require('../adminHealth');
    const useCase = { id: 'advisor-intelligence', title: 'Advisor Intelligence', launchUrl: 'https://advisor.example.test', owner: 'Owner', ownerEmail: 'owner@example.com' };
    health.healthStore.set(useCase.id, {
      id: useCase.id, title: useCase.title, launchUrl: useCase.launchUrl,
      status: 'stopped', owner: useCase.owner, ownerEmail: useCase.ownerEmail,
      lastChecked: new Date(Date.now() - 60000).toISOString(),
      lastError: { errorType: 'app_stopped', timeGenerated: new Date(Date.now() - 60000).toISOString() },
    });
    health.healthStore.set(useCase.id, {
      id: useCase.id, title: useCase.title, launchUrl: useCase.launchUrl,
      status: 'active', owner: useCase.owner, ownerEmail: useCase.ownerEmail,
      lastChecked: nowIso,
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    // A later healthy monitoring cycle must not send the same recovery email again.
    health.healthStore.set(useCase.id, {
      ...health.healthStore.get(useCase.id),
      status: 'active',
      lastChecked: new Date(Date.now() + 1000).toISOString(),
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(sentPayloads.length, 1);
    assert.equal(sentPayloads[0].notificationKind, 'recovery');
    assert.equal(sentPayloads[0].previousStatus, 'Stopped / Down');
    assert.equal(sentPayloads[0].currentStatus, 'Available');
    assert.equal(sentPayloads[0].to, 'owner@example.com');
    delete require.cache[modulePath];
  } finally {
    Module._load = originalLoad;
    global.fetch = originalFetch;
    if (originalWebhook === undefined) delete process.env.OWNER_NOTIFICATION_WEBHOOK_URL; else process.env.OWNER_NOTIFICATION_WEBHOOK_URL = originalWebhook;
    if (originalStateDir === undefined) delete process.env.HEALTH_STATE_DIR; else process.env.HEALTH_STATE_DIR = originalStateDir;
    if (originalIncidentFile === undefined) delete process.env.INCIDENT_LOG_FILE; else process.env.INCIDENT_LOG_FILE = originalIncidentFile;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// A stopped application can recover despite a temporary App Settings-list ARM
// 403 only when runtime + HTTP + Log Analytics independently confirm recovery.
const recoveryGateStart = adminSourceForFreshness.indexOf('function canRecoverStoppedWithInconclusiveSettings(');
const recoveryGateEnd = adminSourceForFreshness.indexOf('\nasync function runCheckInternal', recoveryGateStart);
assert.ok(recoveryGateStart >= 0 && recoveryGateEnd > recoveryGateStart);
const recoveryGateSandbox = { module: { exports: {} } };
vm.runInNewContext(
  `${adminSourceForFreshness.slice(recoveryGateStart, recoveryGateEnd)}\nmodule.exports = canRecoverStoppedWithInconclusiveSettings;`,
  recoveryGateSandbox,
);
const canRecoverStoppedWithInconclusiveSettings = recoveryGateSandbox.module.exports;

test('stopped app recovers with inconclusive settings only when HTTP, runtime and Log Analytics all pass', () => {
  const base = {
    current: { id: 'resume-creator', status: 'stopped' },
    probeResult: { ok: true, statusCode: 200 },
    requiredSettings: { unknown: true },
    telemetryCheck: { configured: true, querySucceeded: true, apps: { 'resume-creator': [] } },
    runtimeEvidence: { ok: true },
    hasActiveIncident: false,
  };
  assert.equal(canRecoverStoppedWithInconclusiveSettings(base), true);
  assert.equal(canRecoverStoppedWithInconclusiveSettings({ ...base, runtimeEvidence: { ok: false } }), false);
  assert.equal(canRecoverStoppedWithInconclusiveSettings({ ...base, telemetryCheck: { configured: true, querySucceeded: false, apps: {} } }), false);
  assert.equal(canRecoverStoppedWithInconclusiveSettings({ ...base, hasActiveIncident: true }), false);
});


// Stopped transitions must be distinguishable from ordinary outages in the
// Logic App payload so the workflow can send the stopped email explicitly.
test('stopped notification payload identifies Stopped / Down and carries transition context', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'adminHealth.js'), 'utf8');
  const start = source.indexOf('async function notifyOwner(useCase, record, options = {}) {');
  const end = source.indexOf('\n\nasync function notifyRecoveryOwner', start);
  assert.ok(start >= 0 && end > start);
  const payloads = [];
  const sandbox = {
    module: { exports: {} },
    OWNER_NOTIFICATION_CC: 'cc@example.com',
    OWNER_NOTIFICATION_WEBHOOK_URL: 'https://logic-app.example.test/trigger',
    AbortSignal,
    fetch: async (_url, options) => {
      payloads.push(JSON.parse(options.body));
      return { ok: true, status: 202, text: async () => '{"sent":true}' };
    },
    logIncident: () => {},
  };
  vm.runInNewContext(
    `${source.slice(start, end)}\nmodule.exports = notifyOwner;`,
    sandbox,
  );
  await sandbox.module.exports(
    { id: 'advisor-intelligence', title: 'Advisor Intelligence', launchUrl: 'https://advisor.example.test', ownerEmail: 'owner@example.com' },
    { status: 'stopped', errorSeverity: 'urgent', lastChecked: new Date().toISOString() },
    { notificationKind: 'stopped', previousStatus: 'active' },
  );
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].notificationKind, 'stopped');
  assert.equal(payloads[0].previousStatus, 'Available');
  assert.equal(payloads[0].currentStatus, 'Stopped / Down');
  assert.match(payloads[0].subject, /STOPPED/);
  assert.equal(payloads[0].to, 'owner@example.com');
});

// The outage notification dedupe must be state-aware so a previously sent
// alert for one state cannot suppress a later distinct state transition.
test('owner notification dedupe compares the last delivered status with the current status', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'adminHealth.js'), 'utf8');
  assert.match(source, /sameStateAlreadyDelivered/);
  assert.match(source, /lastNotifiedStatus === currentStatus/);
  assert.match(source, /notificationKind: record\.status === 'stopped' \? 'stopped' : 'outage'/);
});

// A stopped-page HTTP 403 is only a hint. The mapped frontend/backend ARM
// states must corroborate it before the dashboard is allowed to show Stopped.
const stoppedRuntimeStart = adminSourceForFreshness.indexOf('function reconcileStoppedProbeAgainstMappedRuntime(');
const stoppedRuntimeEnd = adminSourceForFreshness.indexOf('\nasync function runCheckInternal', stoppedRuntimeStart);
assert.ok(stoppedRuntimeStart >= 0 && stoppedRuntimeEnd > stoppedRuntimeStart);
const stoppedRuntimeSandbox = { module: { exports: {} } };
vm.runInNewContext(
  `${adminSourceForFreshness.slice(stoppedRuntimeStart, stoppedRuntimeEnd)}\nmodule.exports = reconcileStoppedProbeAgainstMappedRuntime;`,
  stoppedRuntimeSandbox,
);
const reconcileStoppedProbeAgainstMappedRuntime = stoppedRuntimeSandbox.module.exports;

test('Resume Creator is not classified Stopped when frontend and backend are Running', () => {
  const decision = reconcileStoppedProbeAgainstMappedRuntime({
    states: [
      { role: 'frontend', state: 'Running', available: true },
      { role: 'backend', state: 'Running', available: true },
    ],
  }, ['frontend', 'backend']);
  assert.equal(decision.classification, 'running');
});

test('Resume Creator remains Stopped when ARM confirms a mapped App Service is stopped', () => {
  const decision = reconcileStoppedProbeAgainstMappedRuntime({
    states: [
      { role: 'frontend', state: 'Running', available: true },
      { role: 'backend', state: 'Stopped', available: false },
    ],
  }, ['frontend', 'backend']);
  assert.equal(decision.classification, 'stopped');
});

test('incomplete ARM runtime evidence never creates a false Stopped state', () => {
  const decision = reconcileStoppedProbeAgainstMappedRuntime({
    states: [
      { role: 'frontend', state: 'Running', available: true },
      { role: 'backend', state: null, available: false, reason: 'ARM HTTP 403' },
    ],
  }, ['frontend', 'backend']);
  assert.equal(decision.classification, 'unverified');
});

test('stopped Resume Creator can recover when both mapped runtimes and clean telemetry pass despite Azure-generated probe 403', () => {
  const base = {
    current: { id: 'resume-creator', status: 'stopped' },
    probeResult: { ok: false, authRestricted: true, accessRestrictedByAzure: true, statusCode: 403 },
    requiredSettings: { unknown: true },
    telemetryCheck: { configured: true, querySucceeded: true, apps: { 'resume-creator': [] } },
    runtimeEvidence: { ok: true },
    hasActiveIncident: false,
  };
  assert.equal(canRecoverStoppedWithInconclusiveSettings(base), true);
  assert.equal(canRecoverStoppedWithInconclusiveSettings({ ...base, hasActiveIncident: true }), false);
  assert.equal(canRecoverStoppedWithInconclusiveSettings({ ...base, runtimeEvidence: { ok: false } }), false);
});

// A legacy Azure stop event must not be mistaken for an active dependency
// incident after ARM confirms the App Service has restarted.
test('legacy app_stopped persistent latch is ignored during recovery', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'adminHealth.js'), 'utf8');
  const start = source.indexOf('function getPersistentLatch(id) {');
  const end = source.indexOf('\nfunction persistDependencyLatch', start);
  assert.ok(start >= 0 && end > start);
  const sandbox = {
    readPersistentLatches: () => ({ 'resume-creator': {
      active: true,
      status: 'inactive',
      lastError: { errorType: 'app_stopped', errorMessage: 'Azure App Service is stopped (HTTP 403)' },
    } }),
    module: { exports: {} },
  };
  vm.runInNewContext(`${source.slice(start, end)}\nmodule.exports = getPersistentLatch;`, sandbox);
  assert.equal(sandbox.module.exports('resume-creator'), null);
});

// Regression from the production screenshot: the persisted event used the
// exact message 'Azure App Service stopped (HTTP 503)' but was stored as an
// http_error, not app_stopped. getPersistentLatch previously failed to clear
// it, so canRecoverStoppedWithInconclusiveSettings saw an active incident and
// refused the Stopped -> Available transition even after runtime recovery.
test('HTTP 503 Azure stopped-page latch is lifecycle-only and cannot block recovery', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'adminHealth.js'), 'utf8');
  const start = source.indexOf('function getPersistentLatch(id) {');
  const end = source.indexOf('\nfunction persistDependencyLatch', start);
  assert.ok(start >= 0 && end > start);
  const sandbox = {
    readPersistentLatches: () => ({ 'resume-creator': {
      active: true,
      status: 'inactive',
      dependencyIncidentLatched: true,
      dependencyHealth: { status: 'unhealthy', failingDependency: 'Application HTTP service' },
      lastError: { errorType: 'http_error', errorMessage: 'Azure App Service stopped (HTTP 503)' },
    } }),
    module: { exports: {} },
  };
  vm.runInNewContext(`${source.slice(start, end)}\nmodule.exports = getPersistentLatch;`, sandbox);
  assert.equal(sandbox.module.exports('resume-creator'), null);
});

test('real application endpoint HTTP 503 remains an active persistent incident', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'adminHealth.js'), 'utf8');
  const start = source.indexOf('function getPersistentLatch(id) {');
  const end = source.indexOf('\nfunction persistDependencyLatch', start);
  const sandbox = {
    readPersistentLatches: () => ({ 'resume-creator': {
      active: true,
      status: 'inactive',
      lastError: { errorType: 'http_503', errorMessage: 'POST /api/resume/generate returned HTTP 503' },
    } }),
    module: { exports: {} },
  };
  vm.runInNewContext(`${source.slice(start, end)}\nmodule.exports = getPersistentLatch;`, sandbox);
  assert.ok(sandbox.module.exports('resume-creator'));
});

test('blocked-probe stopped recovery requires clean per-app telemetry and mapped runtime verification', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'adminHealth.js'), 'utf8');
  assert.match(source, /latest\.status === 'stopped'[\s\S]{0,500}requiredSettings\?\.unknown === true[\s\S]{0,500}telemetryVerifiedForApp/);
  assert.match(source, /runtimeEvidence\.ok[\s\S]{0,1200}status: 'active'[\s\S]{0,1500}configurationValidation:[\s\S]{0,500}status: 'inconclusive'/);
});


// Lifecycle 503 pages are not application dependency failures once the
// monitoring worker has a separate ARM runtime check. A genuine app/API 503
// remains actionable and is still handled by the normal health classifier.
const lifecycleStart = adminSource.indexOf('function isLifecycleOnlyStoppedError(error) {');
const lifecycleEnd = adminSource.indexOf('\nfunction isFreshActionableHealthLog', lifecycleStart);
assert.ok(lifecycleStart >= 0 && lifecycleEnd > lifecycleStart);
const lifecycleSandbox = { module: { exports: {} } };
vm.runInNewContext(
  `${adminSource.slice(lifecycleStart, lifecycleEnd)}\nmodule.exports = isLifecycleOnlyStoppedError;`,
  lifecycleSandbox,
);
const isLifecycleOnlyStoppedError = lifecycleSandbox.module.exports;

test('Azure App Service stopped lifecycle marker is not retained as a dependency incident', () => {
  assert.equal(isLifecycleOnlyStoppedError({
    errorType: 'app_stopped',
    errorMessage: 'Azure App Service stopped (HTTP 503)',
  }), true);
});

test('real application HTTP 503 is not mistaken for a lifecycle-only stop marker', () => {
  assert.equal(isLifecycleOnlyStoppedError({
    errorType: 'http_503',
    errorMessage: 'POST /api/resume/generate returned HTTP 503',
  }), false);
});

test('dependency authentication 401 is critical while ordinary client 4xx remains informational', () => {
  assert.equal(severity('401 Azure OpenAI invalid API key', 'HTTP', 'Error'), 'critical');
  assert.equal(severity('404 GET /unknown-user-route', 'HTTP', 'Warning'), 'low');
});


test('Log Analytics ingestion excludes lifecycle-only stopped pages before severity classification', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'adminHealth.js'), 'utf8');
  assert.match(source, /const actionableErrors = errors\.filter\(\(e\) =>[\s\S]{0,1000}!isLifecycleOnlyStoppedError\(e\)/);
});
