For frontend:
cd client
npm.cmd install
npm.cmd run dev

For backend:
cd server
npm.cmd install
node index.js

## Admin health status

The admin health check has three operational states: Available, Unavailable,
and Stopped / Down. Available requires a successful probe and no active
application/dependency failures. An inaccessible or restricted HTTP probe
(including 401/403), a confirmed persistent application/server error, or
actionable Azure application/dependency telemetry is Unavailable. Transient
5xx/timeouts on an already-Available app are retried and require a second
failed health cycle by default before changing the state. Stopped / Down is reserved
for an App Service that Azure confirms is stopped. Azure logs are correlated
using each app's Azure resource name and resource group; explicit mappings are
needed when the public hostname does not match the App Service resource name.
`Last checked` is updated as soon as the HTTP probe completes. Azure runtime
and log lookups have bounded timeouts, and restricted/DNS-failure log
reconciliation runs independently so a slow Azure query cannot freeze the
displayed probe time.

An HTTP success from an application's landing page confirms reachability only;
it cannot verify credentials or downstream dependencies used only during a
business operation. For those failures to change status automatically, each
application must expose a readiness endpoint that checks required
dependencies without returning secret values, or emit actionable errors to
its mapped Azure Monitor logs. Any actionable functionality/dependency error
is reported as Unavailable; there is no Partially Available state.

## Owner health-alert emails

The health monitor sends an HTTP POST to a Logic App when an application is
`inactive` (unavailable) or `stopped`. The request includes the
application state and owner-routing fields: `to` (the application's
`ownerEmail`), `cc` (a semicolon-delimited string), and `subject`, plus application URL, latest error,
severity, and remediation. The backend makes one alert attempt per continuous
incident, persists the deduplication state across worker restarts, and allows a
new alert after the application has recovered and fails again.

To enable email delivery:

1. Create a Logic App workflow with a **When a HTTP request is received**
   trigger and an email action, such as **Office 365 Outlook — Send an email
   (V2)**. Map `to`, `cc`, and `subject` from the request; include the status,
   application, error, and remediation in the message body.
2. Add a **Response** action after the email action. Set it to return HTTP 200
   with JSON body `{"sent":true}` only when the email action succeeds. The
   health monitor requires this explicit acknowledgement; a trigger's default
   HTTP 202 response is not proof that an email was sent. Ensure a failed email
   action does not execute this success response.
3. In the backend App Service's **Configuration → Application settings**, set
   `OWNER_NOTIFICATION_WEBHOOK_URL` to the Logic App's HTTPS callback URL.
   Treat that URL as a secret; do not commit it to source control. App Service
   restarts the backend when application settings change.
4. Open the Admin Panel's **Configuration** tab. It reports whether the
   webhook URL is configured; use a safe test alert or the Logic App's test
   facility to verify actual email delivery.

The recipient is controlled by each use case's `ownerEmail` in
`server/data.js`. `OWNER_NOTIFICATION_CC` is an optional additional recipient;
it is omitted when it duplicates the owner address.

## Health monitoring: three-state model and owner notifications

The Admin Panel health monitor exposes three operational states:

- **Available** — the public URL responds successfully and configured critical application settings / Key Vault references are valid.
- **Unavailable** — the URL cannot be reached (including HTTP 401/403/5xx), or a configured critical dependency/required setting is failing.
- **Stopped** — Azure Resource Manager confirms the App Service state is `Stopped` / `Stopping`.

Legacy persisted values (`degraded`, `restricted`, `monitoring_error`, and partial-state aliases) are normalized to **Unavailable** when read. They are not separate dashboard states.

### Required-setting validation

Resume Creator declares an Azure OpenAI API-key setting group in `server/data.js`. The monitor checks the mapped backend App Service for one of these setting names: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_KEY`, `OPENAI_API_KEY`, or `OPENAI_KEY`. It checks only whether the setting exists and is non-empty; it never writes setting values to logs, health records, incidents, or API responses. It also checks unresolved Key Vault references.

The GenAI Playground monitoring managed identity must have, scoped as narrowly as possible to the monitored App Service resources:

- `Microsoft.Web/sites/read`
- `Microsoft.Web/sites/config/list/action`

The second action is sensitive because Azure returns App Service setting values to the monitoring process. Use a custom role scoped to the Resume Creator backend App Service (or its dedicated resource group), not a subscription-wide broad role. The values are inspected in memory only and are never returned to the browser or persisted.

If your backend uses a different API-key app-setting name, update the `patterns` array for `resume-creator` in `server/data.js` to the exact setting name used by that backend.

### Logic App owner notifications

Set `OWNER_NOTIFICATION_WEBHOOK_URL` (or the supported legacy `AZURE_NOTIFICATION_WEBHOOK_URL`) on the GenAI Playground backend App Service. The webhook payload includes application id/name/URL, owner email, status, dependency and error context. The backend sends one notification attempt per unresolved incident and persists the deduplication marker under `/home/data`; the marker is cleared only after the application returns to Available.

The webhook accepts HTTP 2xx responses, including Logic Apps' common 202/204 responses. To confirm actual email completion, configure a Logic App Response action after the email action to return `{"sent":true}`. A plain 2xx response means the workflow accepted the trigger, not necessarily that the email action completed.


## Health-monitoring stability update (November 16, 2026)

The health monitor now limits concurrent application probes (`HEALTH_CHECK_CONCURRENCY`, default `3`), coordinates scheduled health and telemetry sweeps, and coalesces duplicate Log Analytics reconciliation calls. A single transient HTTP 5xx, timeout, or network failure on an application already marked Available does not immediately flip it to Unavailable: the monitor retries and requires a second failed scheduled health cycle by default (`HEALTH_FAILURE_CONFIRMATION_CYCLES=2`). Explicit critical dependency, crash/startup, and fatal evidence remains actionable immediately. Azure-confirmed stopped apps remain Stopped.

All application owner fields are centrally set to `laltupati@kpmg.com`; the same address is used for owner-email routing. The optional `OWNER_NOTIFICATION_CC` setting remains separate.

Validate the stop/start and transient-failure scenarios in Dev before Production. This source package has not been exercised against the live Azure subscription or Logic App.


### Required-setting verification diagnostics (controlled update)

For applications with `requiredAppSettingGroups`, the health engine now records one of
three internal verification outcomes: `verified`, `failed`, or `inconclusive`.
These are diagnostic details only; the dashboard's existing three state categories
(Available, Unavailable, Stopped / Down) are unchanged.

- A positively inspected missing/empty required setting is a confirmed configuration
  failure and is classified Unavailable.
- An Azure ARM permission, token, resource-mapping, or response failure is
  `inconclusive`; it does not masquerade as a missing secret and does not clear or
  recover an existing incident. The last confirmed application state is retained,
  and the monitoring note identifies the permission/mapping issue.
- The monitoring identity needs `Microsoft.Web/sites/config/list/action` on the
  mapped backend App Service to inspect App Service settings. The setting value is
  never included in logs, health records, incidents, or API responses.

The exact Resume Creator required setting in this deployment is
`AZURE_OPENAI_API_KEY` on the mapped backend App Service.
