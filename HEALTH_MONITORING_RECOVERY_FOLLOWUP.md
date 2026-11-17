# Resume Creator recovery follow-up

## Change in this build
- Removed the early return that kept an application in `recovery_validation` even after an independent ARM runtime check could verify the mapped App Services were running.
- For opted-in apps with explicit recovery roles, a successful Log Analytics reconciliation plus positive ARM runtime evidence can now complete recovery when the public probe fails at DNS/network level.
- A positively detected missing required setting or a fresh confirmed application/dependency incident still blocks recovery.
- If Azure cannot inspect App Service settings (permission/API issue), this is surfaced as a monitoring limitation in `monitoringNote`; it is not silently treated as a confirmed missing setting.
- Resume Creator's explicit frontend/backend mappings are preserved.

## Operational caveat
If the settings inspection is reported as inconclusive, grant the monitoring managed identity permission to list App Service configuration settings (the relevant `Microsoft.Web/sites/config/list/action` operation) at the required scope. The recovery state can be determined from positive runtime and clean telemetry evidence, but the dashboard will explicitly disclose that the required setting could not be independently inspected.

## Validation
- `node --check` passed for all 8 server JavaScript files.
- ZIP integrity check passed.
- Live Azure ARM, Log Analytics, application functionality, and Logic App delivery tests were not available in this environment.
