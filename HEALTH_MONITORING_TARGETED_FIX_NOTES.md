# Health Monitoring Targeted Fix

## Scope
This patch is based on the supplied latest Test-main package. It intentionally changes only `server/adminHealth.js` and leaves the Test UI, colours, labels, content, application catalog, deployment pipeline YAML, and Logic App owner-notification implementation untouched.

## Change
The health snapshot previously converted every `active` record with HTTP 403 into `inactive`, even when the probe had already positively identified an Azure App Service platform access-restriction response and reconciled Log Analytics evidence. This caused healthy applications whose App Service access restrictions block the monitoring worker to appear Unavailable on every dashboard refresh.

The snapshot now preserves `active` only for the two explicit platform-access-restriction sources already emitted by the existing reconciliation path:
- `azure_runtime_access_restricted`
- `azure_access_restriction_unverified`

Normal application-generated 401/403 responses and unclassified 403 responses continue to become Unavailable. Fresh actionable telemetry continues to take precedence, so confirmed application/dependency failures (including Advisor Intelligence / Neo4j) remain Unavailable.

The existing Resume Creator required-setting check and its backend App Service mapping are unchanged; it continues to classify a confirmed missing Azure OpenAI API-key setting as Unavailable.

## Validation
- `node --check` passed for every `server/*.js` file.
- Static assertions confirmed the existing Neo4j detection, required-setting validation, and owner-notification call paths remain present.
- Full frontend build was not run because npm dependencies were not available in the offline environment.
- No live Azure/Log Analytics/Logic App test was performed from this environment.


## Follow-up lifecycle and error-classification correction
- Lifecycle-only `app_stopped` / `Azure App Service stopped (HTTP 503)` records are excluded from fresh dependency-failure gating. A stale lifecycle latch can no longer veto a Stopped-to-Available recovery after current runtime and telemetry checks pass.
- A genuine application/API HTTP 503 remains actionable; the exclusion is limited to the explicit Azure App Service stopped lifecycle marker.
- Dependency authentication failures (for example Azure OpenAI 401/403 with dependency/authentication evidence) remain critical. Ordinary client 4xx responses remain informational unless other application/dependency evidence establishes a service failure.
- Existing rules continue to treat Always On `GET /` 404 and successful 2xx traces as informational; critical application/dependency logs, server-side 5xx, and Advisor Intelligence Neo4j failures remain actionable.
- Validation: 30 Node.js health-classification and recovery tests passed; `node --check` passed for all server JavaScript files. No live Azure/Log Analytics deployment test was possible here.
