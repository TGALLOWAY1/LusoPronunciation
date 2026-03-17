# Deployment Fix Tasks

Branch progress on `codex/launch-blockers`:

- `DEP-001` completed
- `DEP-003` partially completed through startup env validation, invite-code readiness warnings, and a first-class invite seeding script
- `DEP-002` and `DEP-004` remain deployment-time tasks

## P0 Launch Blockers

- ID: `DEP-001`
- Priority: `P0`
- Title: Fix the Express 5 SPA fallback route
- Why it matters: `npm run start` crashes immediately, so no Node host can boot the app in its current state.
- Exact files involved: `src/server/app.ts`
- Concrete implementation guidance: replace the current `app.get('*', ...)` fallback with an Express 5-safe catch-all that excludes `/api/*`; keep `dist/index.html` as the SPA fallback target.
- How to verify it worked: run `npm run start`; confirm the process boots, then hit `/api/health` and `/practice/sentence`.

- ID: `DEP-002`
- Priority: `P0`
- Title: Lock the launch target to Railway
- Why it matters: the current runtime depends on Express, Mongo startup, ffmpeg, temp files, and larger uploads. Forcing Vercel/Netlify/Cloudflare first would add refactor work before launch.
- Exact files involved: `railway.json`, `package.json`
- Concrete implementation guidance: keep the deployment as one Node service using the existing Railway build/start commands; do not split frontend/backend for v1.
- How to verify it worked: deploy a staging Railway service that uses `npm run build` and `npm run start`, then confirm the app boots and serves both SPA and API routes.

- ID: `DEP-003`
- Priority: `P0`
- Title: Finalize launch env vars and signup policy
- Why it matters: the app cannot function publicly without Mongo, JWT, and Azure env vars, and signup can silently fail if invite gating is left on without seeded codes.
- Exact files involved: `.env.example`, `src/server/routes/auth.ts`, `src/server/db/mongoClient.ts`, `src/server/routes/pronunciationAssessment.ts`
- Concrete implementation guidance: set `MONGODB_URI`, `JWT_SECRET`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, and make an explicit launch decision on `REQUIRE_INVITE_CODE`; if invite gating stays on, seed valid invite codes before opening the app.
- How to verify it worked: deploy to staging, register a new account under the chosen policy, log in, and confirm pronunciation scoring works.

- ID: `DEP-004`
- Priority: `P0`
- Title: Run a real staging smoke test against Azure + Mongo
- Why it matters: current passing e2e coverage uses mocked media and mocked pronunciation responses, so it does not validate the live production path.
- Exact files involved: `e2e/phase04/core-loop.spec.ts`, `src/dev/e2eMediaMocks.ts`
- Concrete implementation guidance: after staging deploy, manually test microphone permission, upload, scoring, history persistence, and a reload round-trip using the real backend.
- How to verify it worked: complete one end-to-end sentence attempt in staging and confirm the result persists in Mongo-backed history after refresh.

## P1 Pre-Launch Hardening

- ID: `DEP-005`
- Priority: `P1`
- Title: Repair the default test command
- Why it matters: `npm test -- --run` fails today, which makes generic CI unusable and hides regressions behind a special-case release command.
- Exact files involved: `vitest.config.ts`, `e2e/readme-screenshots.spec.ts`, `e2e/phase04/core-loop.spec.ts`, `src/test/practiceLogStore.test.tsx`, `src/test/PhonemeChip.test.tsx`, `src/test/SentenceFeedback.test.tsx`
- Concrete implementation guidance: exclude `e2e/**/*.spec.ts` from Vitest, update tests for async `startSession`, fix the phoneme metadata mock to provide `getPhonemeById`, and render `SentenceFeedback` with its required providers.
- How to verify it worked: run `npm test -- --run` and confirm it exits 0.

- ID: `DEP-006`
- Priority: `P1`
- Title: Add a real lint gate
- Why it matters: the repo currently reports lint success even though no linting is configured.
- Exact files involved: `package.json`, lint config files if added
- Concrete implementation guidance: add ESLint for the React/TypeScript stack or remove the placeholder script until a real lint pass exists; wire the chosen command into CI.
- How to verify it worked: run `npm run lint` and confirm it executes a real linter rather than echoing text.

- ID: `DEP-007`
- Priority: `P1`
- Title: Make health checks reflect readiness
- Why it matters: Railway health checks currently succeed even if Mongo is disconnected, which weakens auto-restart and incident detection.
- Exact files involved: `src/server/routes/health.ts`, `railway.json`
- Concrete implementation guidance: return non-200 when Mongo is not ready, or add a stricter readiness endpoint and point Railway's `healthcheckPath` to it.
- How to verify it worked: simulate or force a disconnected Mongo state and confirm the health endpoint returns a failing status.

- ID: `DEP-008`
- Priority: `P1`
- Title: Expand deploy/env documentation to cover all runtime knobs
- Why it matters: `.env.example` does not currently document several runtime settings that affect uploads, origins, ffmpeg resolution, or speech health probes.
- Exact files involved: `.env.example`, `src/server/middleware/pronunciationSecurity.ts`, `src/server/lib/audioConversion.ts`, `src/server/routes/pronunciationAssessment.ts`
- Concrete implementation guidance: document all supported env vars used by auth, CORS, rate limiting, upload sizing, conversion timeout, speech health timeout, ffmpeg path override, and client build flags.
- How to verify it worked: provision a fresh staging environment from the docs alone and confirm the app boots successfully.

- ID: `DEP-009`
- Priority: `P1`
- Title: Add basic abuse protection outside pronunciation routes
- Why it matters: auth and other write routes currently lack rate limiting, and the existing pronunciation limiter is in-memory only.
- Exact files involved: `src/server/routes/auth.ts`, `src/server/middleware/pronunciationSecurity.ts`, potentially shared middleware files
- Concrete implementation guidance: add at least lightweight rate limiting for auth endpoints and decide whether v1 will accept per-instance in-memory limits or move to a shared store.
- How to verify it worked: confirm repeated auth attempts and pronunciation bursts are throttled as expected in staging.

- ID: `DEP-010`
- Priority: `P1`
- Title: Reduce stored payload size for pronunciation attempts
- Why it matters: the app can persist `recordingDataUrl` and `rawAssessment`, which will grow Mongo storage and request payload size quickly.
- Exact files involved: `src/hooks/useLivePronunciationPractice.ts`, `src/api/practice.ts`, `src/server/routes/practice.ts`, `src/server/models/PronunciationAttemptModel.ts`
- Concrete implementation guidance: for v1, keep only the fields needed for history and coaching; avoid storing base64 audio or full raw assessment payloads unless there is a concrete product need.
- How to verify it worked: inspect a new Mongo pronunciation-attempt document and confirm only the intended fields are stored.

## P2 Post-Launch Improvements

- ID: `DEP-011`
- Priority: `P2`
- Title: Narrow the v1 feature surface
- Why it matters: word practice, review, and related dashboard states materially expand QA scope without being necessary for the first launch.
- Exact files involved: `src/app/App.tsx`, `src/components/layout/AppLayout.tsx`, `src/components/layout/Sidebar.tsx`, relevant page components
- Concrete implementation guidance: hide word practice, review, and dev pages from production navigation and routes; keep the dashboard sentence-first.
- How to verify it worked: production navigation exposes only the intended v1 pages, and the reduced manual QA matrix is smaller.

- ID: `DEP-012`
- Priority: `P2`
- Title: Align dev-feature gating and remove dead production chunks
- Why it matters: production builds currently include dev chunks, and `VITE_ENABLE_DEV_ANALYTICS=true` would expose broken links.
- Exact files involved: `src/app/App.tsx`, `src/components/layout/AppLayout.tsx`, `src/components/layout/Sidebar.tsx`, `src/vite-env.d.ts`
- Concrete implementation guidance: make route mounting and navigation use the same gating rule, or remove the production flag entirely.
- How to verify it worked: production builds no longer emit the dev page chunks unless that feature is intentionally enabled end-to-end.

- ID: `DEP-013`
- Priority: `P2`
- Title: Improve long-term deployment portability
- Why it matters: the backend currently runs via `tsx` against TypeScript source, which is acceptable on Railway but less portable to other host models.
- Exact files involved: `package.json`, `tsconfig.json`, any future server build config
- Concrete implementation guidance: add a dedicated server build step that emits runnable JS and switch production start to compiled artifacts.
- How to verify it worked: build artifacts include a compiled server entrypoint, and production start no longer depends on `tsx`.
