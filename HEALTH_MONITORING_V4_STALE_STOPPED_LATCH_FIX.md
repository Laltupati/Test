# Health Monitoring V4 – stale Azure stopped-page latch fix

## Evidence addressed

The Resume Creator diagnostic panel showed:
- `Last error: Azure App Service stopped (HTTP 503)`
- `Required-setting verification is inconclusive ... (ARM HTTP 403)`
- `Latest / retained issue: Application HTTP service dependency`
- Dependency health: `Application HTTP service – Unhealthy`

## Root cause

`getPersistentLatch()` previously ignored a lifecycle latch only when its error type was `app_stopped`, or when the message contained `Azure App Service is stopped` / `App Service state: stopped`.

The actual persisted message `Azure App Service stopped (HTTP 503)` can be stored as `http_error`. That exact message was not matched by `getPersistentLatch()`, even though `isLifecycleOnlyStoppedError()` already recognized it. The stale latch therefore remained active and was passed to `canRecoverStoppedWithInconclusiveSettings()` as `hasActiveIncident: true`, preventing Stopped-to-Available recovery after both mapped App Services restarted.

## Change

`getPersistentLatch()` now recognizes the exact Azure stopped-page message, including HTTP 503, as an App Service lifecycle event and excludes that stale latch from active dependency incidents. Genuine application endpoint 503 errors remain active incidents.

## Regression tests

- Azure stopped-page `http_error` with `Azure App Service stopped (HTTP 503)` is ignored as a lifecycle-only latch.
- A genuine `POST /api/resume/generate returned HTTP 503` remains an active persistent incident.

The existing recovery gates remain in place: mapped runtime evidence, successful per-app Log Analytics reconciliation, and no fresh actionable application/dependency failure. An ARM 403 while listing App Settings remains an inspection limitation, not proof that a required setting is missing or valid.
