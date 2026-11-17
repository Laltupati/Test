# Final DNS-monitoring and Resume Creator recovery correction

## Defect corrected
The prior DNS-failure branch treated an `ENOTFOUND` / `EAI_AGAIN` / hostname-resolution error from the monitoring worker as an application outage even when Azure Resource Manager reported the App Service Running. It then forcibly changed the record to `inactive`, set Critical severity, and called `maybeNotifyOwner()`. This directly caused the dashboard to show Unavailable and generated transient outage emails for a monitoring-side DNS failure.

## New behaviour
- A monitoring-worker DNS resolution failure is not, by itself, an application failure.
- The monitor now synchronously reconciles current Log Analytics evidence before making a recovery decision.
- Fresh confirmed application/dependency telemetry and fresh persistent incident latches continue to take precedence.
- For applications with an explicit runtime-recovery contract (including Resume Creator), recovery to Available requires:
  1. every configured recovery App Service role to be positively confirmed Running by ARM;
  2. required backend app settings to be positively inspected (not merely assumed present when ARM inspection is inconclusive); and
  3. a successful current Log Analytics query for the application with no fresh actionable failure.
- If any of those independent checks is inconclusive, the monitor retains the last confirmed state, writes a diagnostic monitoring note, and does not create an Unavailable transition or send an outage email.
- For other applications, DNS failure retains the last confirmed state and does not create a false outage notification. Azure runtime Running alone is not treated as proof of end-to-end health.
- Existing genuine application errors, required-setting failures, confirmed Azure Stopped state, and critical dependency incidents remain actionable.

## Resume Creator resource contract
The existing catalog mapping is preserved:
- frontend: `ue-kgs-resumecreationformatting01`
- backend: `ue-kgs-resumecreationformattingbackend01`
- required backend setting group: Azure OpenAI API key
- recovery runtime roles: frontend and backend

## Validation
- `node --check` passed for all 8 `server/*.js` files.
- Static regression checks confirmed the DNS branch no longer forces `inactive`, calls `maybeNotifyOwner`, or labels a monitor-side DNS failure Critical.
- ZIP integrity test passed.
- Catalog owner policy remains centralized to `laltupati@kpmg.com`.
- The repository declares no automated test suite (`npm test` is a placeholder).
- Live Azure ARM, Log Analytics, App Service recovery, frontend build, and Logic App delivery were not executable in this environment. Deploy to Dev and run the documented stop/start validation before Production.
