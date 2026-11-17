# Resume Creator false Stopped-state correction

## Root cause addressed
The health probe treated Azure's stopped-app HTTP 403 response body as sufficient proof that the App Service was stopped. That can be stale or misleading after a restart and is especially unsafe for Resume Creator because it consists of separate frontend and backend App Services.

## Change
- For applications with configured `recoveryRuntimeRoles`, a stopped-app HTTP 403 is now reconciled against every required mapped App Service through Azure Resource Manager before the dashboard can publish `Stopped / Down`.
- If all required roles are confirmed `Running`/`Started`, the HTTP 403 is treated as an Azure-generated/restricted probe and not as a stopped runtime.
- If runtime evidence is incomplete, the probe is treated as inconclusive rather than asserting `Stopped`.
- `Stopped / Down` remains valid when ARM confirms a mapped required App Service is `Stopped`/`Stopping` and all required role lookups return known states.
- A previously Stopped application can recover when the public probe is blocked by an Azure-generated 403 only if all mapped runtime roles are Running, Log Analytics query succeeds with no active incident, and the required-setting check is explicitly inconclusive (not confirmed missing). The monitoring note discloses that API-key validity could not be independently verified because settings inspection is blocked.

## Resume Creator mapping
Uses the existing mappings in `server/data.js`:
- frontend: `ue-kgs-resumecreationformatting01`
- backend: `ue-kgs-resumecreationformattingbackend01`

The existing dashboard categories remain unchanged: Available, Unavailable, Stopped / Down.

## Validation
`cd server && npm test`: 25 tests passed, 0 failed.
`node --check server/adminHealth.js`: passed.

Live Azure runtime, Log Analytics, API-key validity, and end-to-end resume-processing behaviour have not been tested from this local environment.
