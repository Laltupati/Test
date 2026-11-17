# Health Monitoring State Engine Patch

## Scope

This is a targeted backend-only correction. The Test dashboard's existing three state categories remain unchanged:

- Available (`active`)
- Unavailable (`inactive`)
- Stopped / Down (`stopped`)

No Admin Panel layout, application catalog, deployment pipeline, cost/security tabs, or owner mapping was redesigned.

## Changes

### 1. Azure Log Analytics is reconciled during manual Check All

`runCheckAll()` now runs the same application-scoped Log Analytics reconciliation used by the background monitor before running URL probes. The existing coalescing/cache avoids a duplicate query when the background coordinator has just queried the same application set. A failed Log Analytics query is recorded as a monitoring diagnostic and does not fabricate a state transition or clear an incident.

### 2. Fresh critical telemetry takes precedence over a successful homepage probe

A fresh Critical/Fatal row, a recognized critical application/configuration failure, or an explicit dependency failure is no longer discarded solely because its timestamp is slightly earlier than the most recent successful homepage probe. A frontend HTTP 200 cannot mask a logged backend/model/database failure.

Generic High errors still require confirmation across separate polling cycles to avoid transient flapping. Critical/fatal and recognized hard-failure signatures remain immediate. Historical rows outside the freshness window remain visible in Complete Error Logs but do not keep the live state unavailable.

### 3. API-key and credential error signatures

The operational classifier now recognizes common `api_key` / `api-key` / `api key` forms, including missing, invalid, expired, not-configured, not-found and “must be set” messages. Secret values are never logged or persisted.

### 4. Stopped -> Available recovery when App Settings inspection is inconclusive

If the App Service settings-list operation returns ARM 403, that is not evidence that the application is broken or healthy. For a previously Stopped application with an explicitly configured runtime-recovery contract, the engine can now recover it to Available only when all of the following independently pass:

- The public application probe succeeds.
- Every configured recovery App Service role is confirmed Running through ARM runtime inspection.
- Log Analytics query succeeds for that application.
- No active/persisted critical telemetry incident remains.

The recovered record retains a monitoring note that required settings could not be inspected. This path restores the lifecycle transition without pretending that an inaccessible API key was validated. To detect a removed key before it is exercised, grant the monitoring identity `Microsoft.Web/sites/config/list/action` on the target App Service.

### 5. Recovery notifications

A durable, separate recovery-notification record is created for confirmed `Unavailable -> Available` and `Stopped -> Available` transitions. The existing Logic App event type is retained for compatibility; the payload adds `notificationKind: recovery`, `previousStatus`, `currentStatus`, and a recovery-specific subject. Recovery notifications are deduplicated per transition. Failed or unconfigured webhook attempts are recorded and retried no more than once every five minutes while the application remains Available.

Outage notification deduplication remains separate and unchanged. Recovery emails are sent only if `OWNER_NOTIFICATION_WEBHOOK_URL` (or `AZURE_NOTIFICATION_WEBHOOK_URL`) is configured and the webhook accepts the request. A 2xx response means the Logic App accepted the request; downstream email delivery is confirmed only when the Logic App responds with `{ "sent": true }`.

## Operational limitations

- An ARM 403 on `config/appsettings/list` cannot be corrected by application code. The monitoring identity needs `Microsoft.Web/sites/config/list/action` at the relevant App Service scope.
- If settings cannot be inspected and the application has not yet emitted an authentication/configuration failure to Log Analytics, the engine cannot prove that a removed secret is missing. It retains the last confirmed state and surfaces the monitoring limitation rather than guessing.
- A generic homepage probe cannot prove every business workflow. Application-specific functional health endpoints are required for end-to-end verification of all GENAI workflows.
- Live Azure and Logic App delivery tests require deployment to the user's Dev subscription; they are not simulated by the local regression suite.

## Regression tests

`cd server && npm test`

The suite includes checks for:

- Always On root 404 and successful npm cache-miss log noise.
- Azure OpenAI authentication and transient 503 classification.
- Resume Creator exact API-key setting validation.
- ARM 403 as an inconclusive settings-inspection result.
- Critical API-key / Neo4j evidence taking precedence over a later successful homepage probe.
- Recovery notification delivery and per-transition deduplication.
- Stopped-state recovery requiring successful HTTP, runtime and Log Analytics evidence.
