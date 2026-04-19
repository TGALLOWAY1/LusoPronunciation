# Audio Assessment Pipeline

## Pre-change audit note
Before implementation, the codebase had three contract drift points:
- Frontend submit paths in `useLivePronunciationPractice`, `SentenceCard`, and `wordPronunciation` used `/api/pronunciation-assessment`.
- Express mounted pronunciation routes under `/api/pronunciation/assessment`.
- `vite.config.ts` included a dev-only middleware shim that directly handled `/api/pronunciation-assessment` and bypassed normal server routing.

It also had unrestricted speech debug logging/dumps and broad CORS defaults without pronunciation-specific abuse controls.

## Canonical endpoint contract
Canonical endpoint:
- `POST /api/pronunciation/assessment`

Temporary legacy alias:
- `POST /api/pronunciation-assessment`
- Alias reuses the same upload middleware and request handler as the canonical route.

Response shape (unchanged):
- `{ rawAzure, attemptScore }`

## Dev/prod routing behavior
Development and production now follow the same routing contract:
- Vite proxies all `/api/*` traffic to Express at `http://localhost:4000`.
- No Vite speech-specific request parsing or handler shim.
- Express owns pronunciation routing in both environments.

## Speech debug logging policy
Default behavior (`SPEECH_DEBUG` unset):
- No Azure response dumps to disk.
- No logs with reference text, pronunciation headers, or raw Azure payloads.
- Speech route logs are request-scoped and emit operational metadata (`requestId`, timing, status class).

Debug behavior (`SPEECH_DEBUG=1`):
- Enables detailed speech debug logging.
- Enables controlled debug dumps under `data/debug/`.

## Abuse controls (pronunciation routes)
Applied to both canonical and alias endpoints:
- Strict origin guard middleware with allowlist:
  - Always allows local dev defaults (`localhost`/`127.0.0.1` on `3000`/`5173`).
  - Supports production origins from env via `SPEECH_CORS_ALLOWED_ORIGINS` (fallbacks: `CORS_ALLOWED_ORIGINS`, `APP_ORIGINS`).
- In-memory rate limiting:
  - Default `20 requests / 5 minutes`.
  - Tunable via `SPEECH_RATE_LIMIT_MAX_REQUESTS` and `SPEECH_RATE_LIMIT_WINDOW_MS`.
  - Returns `429` with `Retry-After`.
- Upload size limits:
  - Tunable via `SPEECH_MAX_UPLOAD_BYTES` (default `10MB`).
  - Oversized requests return `413` before conversion work starts.

## Audio quality gate (client-side)
Pre-submit gate runs before any network call:
- Minimum duration threshold: `MIN_DURATION_MS` (default `900`).
- Minimum loudness threshold: `MIN_RMS` (default `0.012`).

Location:
- `src/lib/audioQuality.ts`

Tuning:
- Increase `MIN_DURATION_MS` to reduce incomplete submissions.
- Decrease `MIN_RMS` if soft speakers are rejected too often.
- Increase `MIN_RMS` to more aggressively block near-silent recordings.

User-facing failures:
- Too short: asks user to speak the whole sentence.
- Too quiet: asks user to move closer to the microphone.

## Attempt lifecycle state machine
States:
- `idle`
- `recording`
- `recorded`
- `submitting`
- `scored`
- `error`
- `canceled`

Transition sketch:
- `idle -> recording -> recorded -> submitting -> scored`
- `submitting -> canceled` (user cancel)
- `submitting -> error` (request/server failure)
- `recorded -> error` (quality gate failure)
- `* -> idle` (reset/new sentence)

Stale-response protection:
- Each submit gets a client request id.
- Only the latest request id is allowed to write result state.
- Cancel/unmount invalidates the active request id and aborts in-flight fetch.
