# Metrics and Latency (Phase 2)

## What We Collect
The pronunciation pipeline now records minimal telemetry for latency and reliability debugging.

Collected fields:
- `attemptId` (client-generated)
- `requestId` (server-generated)
- `createdAt`
- `timeToFeedbackMs`
- `clientTimingsMs`
  - `submitToResponseMs`
  - `responseToRenderMs`
- `serverTimingsMs`
  - `convertMs`
  - `azureMs`
  - `normalizeMs`
- `flags`
  - `fallbackUsed`
  - `canceled`
- `error`
  - `errorClass`
  - `httpStatus`

Explicitly not collected:
- Raw audio bytes/blobs/data URLs
- Reference text or transcript text
- Azure request/response payload dumps in telemetry storage

## Storage and Retention
- Storage key: `luso.metrics.attempts.v1`
- Storage location: browser `localStorage`
- Retention: last `200` records (newest first)

## Error Taxonomy
Stable `errorClass` values:
- `client_mic_denied`
- `client_quality_gate`
- `client_abort`
- `network_error`
- `azure_service_unavailable`
- `server_rate_limited`
- `server_payload_too_large`
- `server_convert_failed`
- `server_convert_timeout`
- `azure_4xx`
- `azure_5xx`
- `server_unknown`

## `/dev/metrics` Usage
Navigate to `/dev/metrics` (dev tools section) to inspect:
- Speech service online/offline status from latest login-time ping
- Total attempts
- Success rate
- p50 and p95 time-to-feedback
- Convert failure rate
- Fallback usage rate
- Last 50 attempt rows with stage timings and `errorClass`

Available actions:
- `Copy JSON`: copies current telemetry payload to clipboard
- `Clear Metrics`: clears `luso.metrics.attempts.v1`

Login behavior:
- After a successful login, the client sends `GET /api/pronunciation/speech-health`.
- This route performs a fast Azure speech token probe.
- Failures are recorded with `errorClass: azure_service_unavailable`.

Percentile behavior:
- p50 uses median
- p95 uses sorted index `ceil(0.95 * n) - 1`

## Environment Variables
- `AUDIO_CONVERT_TIMEOUT_MS`
  - Controls ffmpeg conversion timeout in milliseconds.
  - Defaults to `10000` if unset or invalid.
- `SPEECH_HEALTH_TIMEOUT_MS`
  - Controls login-time speech health probe timeout in milliseconds.
  - Defaults to `3000` if unset or invalid.
