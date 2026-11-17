# Health Monitoring V5 – Log Analytics lifecycle-event reconciliation fix

## Why V4 still failed

V4 updated `getPersistentLatch()` to ignore a persisted Azure stopped-page marker. However, `monitorApplicationLogsInternal()` independently rebuilt its `actionableErrors` collection from Log Analytics rows using severity and critical-message checks. It did not exclude the same lifecycle-only stopped-page marker. An Azure-generated `Azure App Service stopped (HTTP 503)` row labelled Error/Critical could therefore be ingested again and passed to `persistDependencyLatch()`, recreating the `Application HTTP service` incident after the old latch was ignored.

## Changes

- Exclude lifecycle-only Azure stopped-page markers from the Log Analytics actionable-error collection before severity handling.
- Add a defensive exclusion in `isFreshActionableHealthLog()` so callers cannot treat the lifecycle marker as a fresh application/dependency failure.
- Make `isLifecycleOnlyStoppedError()` accept both normalized health-record objects and raw string messages, in addition to raw Log Analytics rows.
- Keep genuine application endpoint 503s actionable. For example, `POST /api/resume/generate returned HTTP 503` remains a real application failure.
- Keep runtime reconciliation as the authority for the Stopped state; lifecycle rows are not discarded from the complete-log history view.

## Regression coverage

Added tests proving:
- An Azure stopped-page event labelled `Error` is not fresh actionable health evidence.
- A genuine Resume Creator API 503 remains actionable.
- The Log Analytics ingestion filter excludes lifecycle events before severity classification.

## Validation

- `npm test`: 35 passed, 0 failed.
- JavaScript syntax validation: see release validation; no live Azure deployment was performed.
