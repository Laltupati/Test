# Final targeted health-monitoring and owner-notification fix

## Scope
This patch uses the exact uploaded `GENAIPLAYG-health-monitoring-stability-and-owner-update(1).zip` as its baseline. It preserves the existing UI, dashboard labels, application catalog, deployment pipeline and monitoring features except for the targeted corrections below.

## Resume Creator: Stopped -> Available when monitor receives App Service 403
- The existing flow handled a platform access-restriction 403 primarily through Log Analytics reconciliation.
- That left a recovery gap when the public probe remained blocked after the App Services had been restarted.
- For applications with an explicit runtime-recovery contract and required app-setting groups (Resume Creator in this catalog), the recovery path now accepts positive Azure Resource Manager evidence that every configured recovery role (frontend and backend) is Running, plus a successful required-setting inspection.
- This fallback only applies when the probe is positively identified as an Azure platform access-restriction 403. A normal application-generated 403 is not converted to Available.
- Fresh confirmed dependency/application incidents and fresh persistent incident latches continue to block recovery.
- If ARM or required-setting inspection is inconclusive, the monitor retains the last confirmed state and records a monitoring note instead of manufacturing an Unavailable transition from its own blocked probe.
- Stale persisted failure latches no longer block this explicit Resume Creator runtime/configuration recovery forever; fresh latches still block it.

## Owner notifications
- All 9 applications in the supplied backend catalog are assigned to `laltupati@kpmg.com` for both `owner` and `ownerEmail`.
- Owner-notification deduplication is now recipient-aware. A previous alert sent to a different owner no longer suppresses an alert to the newly configured owner.
- If an unresolved incident remains active after the owner changes, the active incident is eligible for notification to the new owner.
- The Logic App payload now includes both `to` and `ownerEmail`, and sends `cc` as a semicolon-delimited string (the format documented in this project's README), with `ccRecipients` also included as an array for workflows that use array inputs.
- Duplicate alerts to the same recipient for the same continuous incident remain deduplicated.

## Validation performed
- `node --check` passed for all 8 `server/*.js` files.
- Requiring `server/data.js` confirmed all 9 catalog applications have `ownerEmail === 'laltupati@kpmg.com'`.
- ZIP integrity check passed.
- Frontend build was not run because `client/node_modules` is absent.
- No live Azure ARM, App Service, Log Analytics, or Logic App email-delivery test was possible here.

## Required Dev configuration checks
1. Ensure the backend App Service has `OWNER_NOTIFICATION_WEBHOOK_URL` set to the active Logic App HTTP callback URL.
2. Ensure the Logic App maps `to` (or `ownerEmail`) to the email action's To field and `cc` to its CC field.
3. Ensure the Logic App's HTTP response is successful only after the email action succeeds.
4. Ensure the backend managed identity has permission to read the mapped frontend and backend App Services and list backend app settings.
5. For Resume Creator, verify the `AZURE_APP_RESOURCE_MAP_JSON` / `AZURE_SHARED_DEPENDENCY_RESOURCE_MAP_JSON` settings resolve the frontend and backend names in `server/data.js` to the correct App Services in the Dev subscription.

This package has passed static validation only. It must pass the stop/start and email-delivery tests in Dev before Production deployment.


## Additional update — Resume Creator recovery and stopped-state notifications

- Resume Creator required-setting validation remains scoped to the backend App Service and the exact `AZURE_OPENAI_API_KEY` setting name. Secret values are never logged or persisted.
- An ARM 403 while listing App Service settings is treated as inconclusive monitoring evidence, not as proof that the API key is missing. Resume Creator recovery from a previously Stopped state with inconclusive settings still requires the configured independent HTTP, runtime, and clean Log Analytics checks.
- Owner outage notification deduplication is now state-aware. A delivered alert for one state no longer suppresses a distinct later state transition.
- Azure-confirmed Stopped transitions now send `notificationKind: "stopped"` with `previousStatus`, `currentStatus: "Stopped / Down"`, and a STOPPED subject. The existing `eventType` is retained for Logic App compatibility.
- The Logic App must route `notificationKind == "stopped"` to its stopped-email action. Backend code can send the event, but it cannot change conditions inside an externally hosted Logic App workflow.
- Validation: `npm test` — 21 tests passed.
