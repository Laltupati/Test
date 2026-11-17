# Health monitoring HTTP 403 reconciliation patch

## Root cause addressed
The previous build only recognised a narrow set of Azure App Service access-restriction response-body phrases. Azure may instead identify the blocked client through response headers or use different platform-generated page wording. In that case the code fell through to the generic 403 path and marked the application Unavailable.

## Changes
- Detects Azure platform access restrictions using `x-ms-forbidden-ip` / `x-ms-forbidden-client-ip` headers and a broader set of platform-page fingerprints.
- Retains the three operational states; does not add a fourth status.
- Keeps genuine app-originated 401/403 failures as Unavailable unless there is positive evidence that Azure blocked the monitoring probe before the request reached the app.
- Adds safe HTTP 403 diagnostics (content type, server header, boolean header signals, and body fingerprints) to the health record, without storing the response body.
- When a 403 cannot be positively identified as an Azure platform restriction and ARM cannot verify runtime, the app remains Unavailable with an explicit diagnostic explanation rather than being incorrectly marked Available.

## Validation
- `node --check` passed for all server JavaScript files.
- The project has no configured automated test suite (`npm test` is a placeholder).
- Live Azure responses and Logic App notifications cannot be validated from this local package build.
