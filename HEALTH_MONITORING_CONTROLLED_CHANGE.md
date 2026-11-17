# Health Monitoring Controlled Change

## Scope
This change uses the uploaded `GENAIPLAYG-resumecreator-recovery-followup-fix(2).zip` as its baseline. It is intentionally limited to health classification, required-setting verification/recovery gates, and a pre-existing JavaScript syntax closure required for the browser configuration file to parse.

## Changes
- Resume Creator's required Azure OpenAI setting is now checked by exact name: `AZURE_OPENAI_API_KEY`, on the explicitly mapped backend App Service `ue-kgs-resumecreationformattingbackend01`.
- A required-setting check that cannot be completed (missing Azure permissions, ARM failure, missing resource-role mapping) is treated as **unknown**, not as proof that the setting exists. Unknown configuration evidence cannot independently promote an application to Available; the last confirmed state is retained and the monitoring limitation is surfaced.
- Required setting groups now validate that every explicitly configured resource role is mapped before the setting check is considered complete.
- Generic application errors and Application Insights exception records are classified as high signals and use the existing multi-cycle confirmation path. Explicit fatal/crash and confirmed authentication/configuration failures remain critical.
- Transient dependency failures such as 5xx, connection reset/refused, and timeout are high signals, not automatically immediate critical incidents. They are confirmed across monitoring cycles; the existing Advisor Intelligence Neo4j-specific failure recognition remains in place.
- Dependency names alone are not treated as proof of an outage. Dependency telemetry must also contain a failure/status signal before it can bypass ordinary freshness filtering.
- Successful npm registry fetches (including cache misses), Always On root-path 404s, and ordinary root-path 404s remain visible in Complete Error Logs but are classified as informational for health state.
- The existing three-state model, application resource mappings, monitoring intervals, notification workflow, and owner mappings are preserved. The current catalog still maps all nine monitored applications to `laltupati@kpmg.com`.
- Closed the unterminated `window.TOOL_DETAILS` object in `js/config/constants.js`; the uploaded baseline ended with the closing brace commented out, which caused a JavaScript parse error when that browser script was loaded.

## Validation
Run from `server/`:

```bash
node --test test/*.test.js
```

The test suite covers benign npm/Always On logs, expected 404s, primary 5xx, Azure OpenAI authentication failure, transient Azure OpenAI 503 classification, Resume Creator's exact required setting, and owner mapping.

## Operational limitation
A generic monitor cannot prove every business workflow end-to-end without an application-specific, authenticated functional health endpoint or safe synthetic transaction. The health engine therefore combines Azure runtime state, explicitly declared required settings, HTTP probes, and fresh Log Analytics evidence. An inconclusive monitoring check is not represented as a confirmed application failure or a confirmed recovery.

Live Azure/Logic App delivery testing is still required after deployment to Dev.
