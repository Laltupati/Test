# Health monitoring patch notes

## Changes
- Azure App Service platform access-restriction HTTP 403 responses no longer automatically mark every application Unavailable when ARM discovery/read is unavailable and no fresh application/dependency failure telemetry exists.
- A positively identified access-restriction response is represented as Available with a monitoring note explaining that the monitor's request was blocked. Fresh application/dependency telemetry still takes precedence.
- Confirmed Azure stopped-app responses and ARM-confirmed stopped states remain Stopped.
- HTTP 5xx, network failures, and confirmed missing/empty required app settings remain Unavailable.
- Missing backend resource mappings and ARM permission failures during required-setting inspection are treated as an inconclusive monitoring check, not proof of application failure. The dashboard can surface the monitoring note.
- Recovery from an access-restriction false alarm clears the prior incident latch and owner-notification dedupe record so a future real outage can generate a new notification.
- Owner notification locking/deduplication implementation was not changed.

## Validation
- `node --check` passed for `server/adminHealth.js`, `server/azureLogs.js`, and `server/index.js`.
- Live Azure/Logic App delivery was not tested from this environment.
- For reliable ARM-based Stopped detection and Key Vault app-setting inspection, the managed identity still needs the relevant read/list permissions on the monitored App Services. The application no longer treats a permission failure by itself as an application outage.


## November 16, 2026 — cross-application isolation, transient-failure debounce and owner update

### Monitoring changes
- Health sweeps now use bounded concurrency (default 3) rather than starting every application probe at once. Override with `HEALTH_CHECK_CONCURRENCY` (1–5).
- The independent health and Log Analytics timers were replaced with one coordinated periodic cycle so routine full sweeps do not intentionally overlap.
- Identical Log Analytics reconciliation requests are coalesced while in flight and briefly cached for 15 seconds. Different scopes wait and then run their own reconciliation.
- HTTP 5xx responses are now included in the transient retry loop (up to the existing two retries). 4xx responses are not retried by this loop.
- For an application already confirmed Available, one transient 5xx, timeout, or network failure retains the last confirmed Available state. A second failed scheduled health cycle is required before the state changes to Unavailable. The default is configurable with `HEALTH_FAILURE_CONFIRMATION_CYCLES` (minimum 2).
- Generic primary-site HTTP 5xx Log Analytics rows now require confirmation across two distinct Log Analytics polling cycles. Explicit Critical/Fatal, recognised crash/startup, and critical dependency evidence remain immediate.
- A positively identified Azure-stopped App Service continues to transition directly to Stopped. A successful probe after restart and normal recovery reconciliation transitions it to Available.

### Owner update
- All 9 application records in the supplied `server/data.js` catalog now have both `owner` and `ownerEmail` set to `laltupati@kpmg.com` after per-app metadata is merged.
- Application detail-page ownership enrichment is aligned to `laltupati@kpmg.com` for every entry in the frontend enrichment map.
- Health records, incident payloads and Logic App notification routing use the catalog's `ownerEmail` field. `OWNER_NOTIFICATION_CC` remains an optional CC setting and is not changed by this owner update.

### Validation and limitations
- `node --check` passed for all server JavaScript files.
- Static catalog validation confirmed all 9 catalog applications have the requested owner and owner email.
- ZIP integrity validation passed.
- The frontend build could not be run because `client/node_modules` is not present and package installation is not available in this offline environment.
- No live Azure Dev subscription, App Service stop/start, Log Analytics query, or Logic App email delivery test was performed here. The changes therefore require the Dev validation matrix in the handoff before Production promotion.
