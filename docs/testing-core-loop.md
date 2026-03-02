# Core Loop Testing Strategy

This document defines the Phase 4 testing strategy for the mission-critical learner loop:

`record -> submit -> feedback -> retry`

It also covers the critical failure paths:

`cancel`, `mic denied`, `silence/short gate`, and major server-side error classes.

## 1. Contract Tests (Server)

Contract tests live in:

- `src/server/routes/pronunciationAssessment.contract.test.ts`

Server audio fixtures live in:

- `src/server/__fixtures__/audio/speech-short.wav`
- `src/server/__fixtures__/audio/speech-valid.wav`
- `src/server/__fixtures__/audio/speech-invalid.bin`

### Covered server contract matrix

- Success path returns `200` with `attemptScore` + `telemetry.serverTimingsMs`.
- Oversize upload maps to `413` + `errorClass=server_payload_too_large`.
- Rate limit maps to `429` + `errorClass=server_rate_limited`.
- Conversion failure/timeout fallback paths keep request alive and return `fallbackUsed=true`.
- Azure 4xx maps to `errorClass=azure_4xx`.
- Azure 5xx maps to `errorClass=azure_5xx`.
- Client abort kills active conversion work and runs temp cleanup.
- Temp workspace cleanup is asserted across success/failure/abort paths.
- Error payloads are validated as safe (no sensitive internals).

### Run contract + phase tests

- `npm run test:phase04`

## 2. Browser E2E (Playwright)

Playwright config:

- `playwright.config.ts`

Core loop e2e spec:

- `e2e/phase04/core-loop.spec.ts`

### Dev-only deterministic media mocks

Media API mocks are defined in:

- `src/dev/e2eMediaMocks.ts`

Bootstrap wiring:

- `src/app/main.tsx`

Activation rules:

- Mocks are loaded only when `import.meta.env.DEV` is true.
- Mocks also require `window.__E2E__.enabled === true`.
- This prevents mock activation in production builds.

Supported deterministic scenarios via `window.__E2E__.mediaScenario`:

- `success`
- `short`
- `silent`
- `micDenied`

### Run e2e

- `npm run e2e:phase04`

## 3. Why Only 4 E2E Tests Initially

The suite intentionally stays small and high-signal to keep runtime low and reduce flakiness while protecting the core loop:

1. Happy path (`record -> submit -> feedback`)
2. Cancel analysis and retry success
3. Quality gate blocks short/silent attempts and prevents network submit
4. Mic denied guidance path

These 4 tests guard the most user-visible regressions while server contract tests enforce backend taxonomy and response shape.

## 4. Anti-Flake Guidelines

When adding tests, keep determinism first:

- Use fixed fixtures and mocked network responses.
- Avoid real microphone hardware and real speech services in tests.
- Assert state transitions with stable selectors (ARIA labels / explicit text).
- Keep one assertion intent per test; avoid long multi-branch scripts.
- Mock slow/cancel scenarios with explicit route control (deferred fulfill), not sleeps.
- Prefer checking outcome state over animation timing.

## 5. End-to-End Verification Script

Run both targeted unit/contract and e2e suites:

- `npm run verify:phase04`
