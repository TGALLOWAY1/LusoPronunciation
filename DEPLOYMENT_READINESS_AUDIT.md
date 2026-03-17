# Deployment Readiness Audit

## Executive Summary

- Overall status: **Close but blocked**
- Best hosting target: **Other (Railway)**
- Confidence level: **Medium-high**

### Top 5 blockers

1. `npm run start` currently crashes on boot because Express 5 rejects `app.get('*', ...)` in `src/server/app.ts`.
2. The current runtime shape is a long-lived Node/Express server with ffmpeg, temp files, and 10 MB uploads, which is a poor fit for Vercel, Netlify Functions, and Cloudflare Workers.
3. The default `npm test -- --run` command is red, so the repo does not have a clean generic CI gate today.
4. Public signup will fail unless you either seed invite codes or explicitly disable invite-code gating.
5. Operational hardening is still thin: no real lint gate, no production monitoring, and `/api/health` does not fail when Mongo is disconnected.

### Top 5 strengths

1. The app is already structured as a single-origin SPA + API service, which is the simplest production shape for this codebase.
2. `npm run build` succeeds, and the built SPA serves correctly in preview, including deep links.
3. The core pronunciation pipeline has focused contract/unit coverage, and `npm run test:phase04` passes.
4. There are no websockets, queues, cron jobs, or background workers that would force a more complex platform.
5. The repo already includes `railway.json`, and the app exposes `/api/health`.

## 1. Product Architecture Summary

### Detected stack

- Frontend: React 19 + TypeScript + Vite + React Router 7
- Backend: Express 5 + TypeScript executed via `tsx`
- Database: MongoDB via Mongoose
- Auth: email/password + JWT bearer token stored in `localStorage`
- File upload: `multer` in-memory upload handling
- Audio processing: `ffmpeg-static` fallback plus `child_process.spawn()`
- Speech scoring: Azure Speech
- Styling: Tailwind CSS
- Testing: Vitest + Playwright
- Non-runtime scripting: Python is present only for content-generation scripts, not for the deployed app runtime

### Deployment model

- This is **not** an SSR app.
- This is **not** a static-only SPA.
- This is an **API-backed SPA served by a custom Node server**:
  - Vite builds the frontend into `dist/`
  - Express serves API routes and the built SPA
  - The browser uses same-origin `/api/*` fetches

### Runtime requirements

- Long-lived Node process
- Mongo connection at server startup
- Access to environment variables for Mongo, JWT, and Azure
- Ability to spawn `ffmpeg`
- Writable temp filesystem (`os.tmpdir()`)
- Support for multipart uploads up to 10 MB by default

### Key external services

- Azure Speech: pronunciation scoring and health probe
- MongoDB: users, sessions, pronunciation attempts, flashcards, invite codes

## 2. Vercel Fit Assessment

### What fits well

- The frontend is a standard Vite SPA.
- Relative `/api/*` fetch paths are easy to keep if frontend and backend stay on one origin.
- Vercel has good environment-variable management and preview deployment UX.

### What is risky

- The current backend assumes a **long-running Express server**, not a set of serverless functions.
- The app uses:
  - `child_process.spawn()` for ffmpeg
  - temp workspace creation under `os.tmpdir()`
  - in-memory rate limiting
  - startup-time Mongo connection before listening
- The pronunciation endpoint allows uploads up to 10 MB, while Vercel function request bodies are capped at 4.5 MB.
- Vercel's Express guidance says `express.static()` is ignored; static files must come from `public/**`. This repo currently relies on Express serving the built `dist/` directory.

### What may break

- The current `start` path already fails locally before any platform-specific issue is reached.
- Even after fixing the boot crash, the current server shape is likely to require:
  - refactoring Express into a Vercel function entrypoint, or
  - splitting the frontend and backend across different hosts
- If you split frontend and backend, current CORS coverage is incomplete because only the pronunciation routes apply CORS middleware.
- The in-memory rate limiter is not reliable in a serverless or horizontally scaled environment.

### Required Vercel config

- There is no `vercel.json` today.
- A minimal `vercel.json` alone is **not enough** to make the current architecture safe on Vercel.
- If you insist on Vercel, the practical path is:
  1. put the frontend on Vercel as a static SPA,
  2. move the Express API to a separate Node host,
  3. add SPA rewrites for BrowserRouter,
  4. expand CORS across all API routes, not just pronunciation routes.

### Serverless/runtime caveats

- Cold starts affect live pronunciation scoring more than they affect a content site.
- The pronunciation route is a poor match for serverless limits because it combines upload handling, optional conversion, outbound Azure requests, and JSON normalization in one request.
- Vercel is **not** the fastest path to production for this repo as it exists now.

## 3. Alternative Host Comparison

| Host | Ease of deployment | Runtime compatibility | Audio processing fit | Routing/functions compatibility | Env management | Operational simplicity | Likely production risks | Recommendation |
|---|---|---|---|---|---|---|---|---|
| Vercel | Medium-low | Partial | Weak | Frontend is easy; backend needs refactor or split hosting | Strong | Good after refactor | 4.5 MB body limit, `express.static()` mismatch, serverless cold starts, incomplete cross-origin API setup | Not the fastest path |
| Cloudflare Pages/Workers | Low | Poor | Very weak | Great for static assets, poor for this Node backend | Strong | Good only for edge-native apps | `child_process` is non-functional, temp-file assumptions do not map cleanly, would require major re-architecture | Do not use for current app |
| Netlify | Medium-low | Partial | Weak | SPA hosting is easy; function model is the wrong shape for this API | Strong | Fine for static/front-heavy apps | Function duration/body limits, same refactor burden as Vercel, split-origin CORS work | Better than Cloudflare, still not best |
| Railway | High | Strong | Strong | Matches the current single Express service directly | Strong | Simplest for this repo | Current boot crash, health endpoint semantics, missing prod hardening | Best fit and fastest path |

## 4. Build Validation Findings

### Command outcomes

| Area | Command / check | Result | Notes |
|---|---|---|---|
| Install viability | `npm ci --ignore-scripts --dry-run` | Pass | Dry-run only; clean reinstall was not run because this is an in-place audit of the current workspace |
| Typecheck/build | `npm run build` | Pass | Build completes and produces `dist/` |
| Lint | `npm run lint` | Pass, but misleading | Script only echoes `lint not configured` |
| Focused tests | `npm run test:phase04` | Pass | 32/32 tests passed |
| Full tests | `npm test -- --run` | Fail | 5 failed files, 27 failed tests |
| E2E | `npm run e2e:phase04` | Pass | Uses mocked media and mocked `/api/pronunciation/assessment`; does not validate real Azure/Mongo runtime |
| Preview | `npm run preview -- --host 127.0.0.1` | Pass | Built SPA served at `http://127.0.0.1:4173/`; deep links returned `index.html` |
| Production start | `npm run start` | Fail | Crashes before boot completes |

### Issues found

#### P0: Production boot crash

- Severity: **P0**
- Exact files: `src/server/app.ts`
- Why it matters: the current production start command cannot boot on any Node host.
- What to change: replace the Express 5-incompatible `app.get('*', ...)` fallback with an Express 5-safe catch-all that excludes `/api/*`, then re-run `npm run start`.

#### P1: Generic test command is red

- Severity: **P1**
- Exact files:
  - `vitest.config.ts`
  - `e2e/readme-screenshots.spec.ts`
  - `e2e/phase04/core-loop.spec.ts`
  - `src/test/practiceLogStore.test.tsx`
  - `src/test/PhonemeChip.test.tsx`
  - `src/test/SentenceFeedback.test.tsx`
- Why it matters: a normal CI pipeline keyed off `npm test` fails today, so release confidence depends on remembering a narrower custom command.
- What to change:
  - exclude Playwright specs from Vitest,
  - update `practiceLogStore` tests for async `startSession`,
  - update `PhonemeChip` mocks to match `getPhonemeById`,
  - wrap `SentenceFeedback` tests with required providers or update the test harness.

#### P1: Lint gate is not real

- Severity: **P1**
- Exact files: `package.json`
- Why it matters: there is no static analysis gate catching unused imports, unsafe patterns, or accidental client/server leakage.
- What to change: either add a real lint configuration and CI step or remove the misleading script until lint is configured.

#### P1: Health endpoint is not a real readiness check

- Severity: **P1**
- Exact files:
  - `src/server/routes/health.ts`
  - `railway.json`
- Why it matters: Railway will consider the service healthy as long as the route responds, even if Mongo is disconnected.
- What to change: make `/api/health` return non-200 when core dependencies are unavailable, or add a dedicated readiness endpoint and point Railway at that.

#### P1: Env/deploy documentation is incomplete

- Severity: **P1**
- Exact files:
  - `.env.example`
  - `src/server/routes/auth.ts`
  - `src/server/routes/pronunciationAssessment.ts`
  - `src/server/lib/audioConversion.ts`
  - `src/server/middleware/pronunciationSecurity.ts`
- Why it matters: operators can easily miss invite-code policy, ffmpeg overrides, upload limits, timeout knobs, or origin allowlists.
- What to change: document all runtime env vars that affect auth, pronunciation uploads, conversion, health probes, and CORS.

#### P2: Build includes dev-only chunks and mixed gating

- Severity: **P2**
- Exact files:
  - `src/app/App.tsx`
  - `src/components/layout/AppLayout.tsx`
  - `src/components/layout/Sidebar.tsx`
  - `src/vite-env.d.ts`
- Why it matters: production builds include dev chunks, and `VITE_ENABLE_DEV_ANALYTICS=true` would expose nav links whose routes are not actually mounted in production.
- What to change: align nav gating and route gating, or remove the production env flag entirely.

#### P2: Production runtime uses TypeScript directly

- Severity: **P2**
- Exact files:
  - `package.json`
  - `tsconfig.json`
- Why it matters: the deployed backend currently runs via `tsx src/server/app.ts` instead of compiled server artifacts. That is acceptable on Railway but increases portability risk if you later move to a different host model.
- What to change: for long-term portability, add a dedicated server build output and run compiled JS in production.

## 5. Production Blockers

### Must fix before launch

1. Fix the current `npm run start` crash in `src/server/app.ts`.
2. Choose a host that matches the actual runtime shape. For the current codebase, that means Railway (or a similar Node PaaS), not Vercel/Cloudflare/Netlify.
3. Set and verify required production env vars:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `AZURE_SPEECH_KEY`
   - `AZURE_SPEECH_REGION`
   - explicit invite-code policy via `REQUIRE_INVITE_CODE`
4. Run a staging smoke test against the **real** Mongo + Azure path. The existing passing e2e suite is mocked and does not prove the live audio path.

### Should fix soon after launch

1. Repair `npm test` so generic CI is green.
2. Replace the placeholder lint script with a real lint gate.
3. Make the health endpoint fail when critical dependencies are down.
4. Add basic auth/rate-limit protection outside the pronunciation route.
5. Add production monitoring and log review on failed pronunciation requests.

### Nice to have

1. Hide word practice and review for v1 to reduce QA surface.
2. Stop bundling dev-only chunks into production builds.
3. Reduce what is stored per pronunciation attempt, especially base64 audio and raw assessment payloads.

## 6. Hidden Deployment Risks

- **Serverless cold starts**: live speech scoring is latency-sensitive and will feel worse behind cold starts than it does on a warm Node process.
- **Upload/body ceilings**: the pronunciation route allows 10 MB uploads, which is already above Vercel's 4.5 MB request-body cap and mismatched with function-oriented hosting.
- **Memory/runtime ceilings**: upload buffering, ffmpeg conversion, Azure round-trips, and JSON normalization all happen inside one request.
- **Filesystem assumptions**: `createWorkspace()` writes temp files to `os.tmpdir()`, which is fine on a Node host but a portability risk on edge/serverless platforms.
- **`child_process` dependence**: the app shells out to ffmpeg; that is a hard incompatibility for Cloudflare Workers and a bad fit for edge runtimes.
- **Same-origin assumption**: most client fetches use relative `/api/*` paths, but only pronunciation routes implement explicit CORS. Split hosting will require wider CORS work.
- **In-memory rate limiting**: the current rate limiter resets per process and does not coordinate across instances.
- **Asset fallback masking**: in preview, missing JSON paths such as `/STATIC DATA/sentences.json` returned `index.html` with HTTP 200. Some code checks `response.ok` before parsing JSON, so missing assets can surface as runtime parse errors instead of clean 404s.
- **Attempt payload growth**: the app can persist `recordingDataUrl` and `rawAssessment` into Mongo documents, which will increase storage size quickly.
- **No real production monitoring**: current visibility is mostly host logs and request IDs.

## 7. Recommended Deployment Plan

### Recommended path

- Hosting provider: **Railway**
- Build command: `npm run build`
- Start command: `npm run start`
- Output directory: `dist/`
- Deployment model: single Node service serving both the SPA and API

### Why this is the fastest path

- It preserves the current architecture.
- It avoids split-origin CORS work.
- It supports the Express server, Mongo connection, ffmpeg conversion, temp files, and larger uploads.
- The repo already contains `railway.json`.

### Env var categories

- Core runtime:
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `AZURE_SPEECH_KEY`
  - `AZURE_SPEECH_REGION`
- Launch policy:
  - `REQUIRE_INVITE_CODE`
- Origin/CORS:
  - `APP_ORIGINS`
  - `CORS_ALLOWED_ORIGINS`
  - `SPEECH_CORS_ALLOWED_ORIGINS`
- Runtime tuning:
  - `SPEECH_RATE_LIMIT_WINDOW_MS`
  - `SPEECH_RATE_LIMIT_MAX_REQUESTS`
  - `SPEECH_MAX_UPLOAD_BYTES`
  - `AUDIO_CONVERT_TIMEOUT_MS`
  - `SPEECH_HEALTH_TIMEOUT_MS`
  - `AUDIO_CONVERT_FFMPEG_PATH`
- Client build flags:
  - `VITE_CONTENT_SOURCE`
  - leave `VITE_ENABLE_DEV_ANALYTICS` unset in preview and production

### Domain setup notes

- Keep frontend and API on the same domain for v1.
- After adding the final domain, add it to the origin allowlist env vars if you keep the pronunciation CORS middleware.
- Use separate preview and production domains so Azure/Mongo validation can be tested before launch.

### Staging vs production

- Use a staging Railway service first.
- Prefer separate Mongo databases or at least separate database names for staging and production.
- Re-run the full staging smoke test after every env or host-level change.

### Launch checklist

1. Fix the Express fallback route and confirm `npm run start` boots.
2. Set production env vars in Railway.
3. Deploy to staging.
4. Verify `/api/health` and `/api/pronunciation/speech-health`.
5. Register a new user using the chosen invite policy.
6. Complete one real sentence-practice attempt with live microphone audio.
7. Confirm session history persists after refresh.
8. Confirm deep links like `/practice/sentence` load directly.
9. Review Railway logs for ffmpeg, Mongo, and Azure errors.
10. Promote the same setup to production.

## 8. Recommended Feature Cuts for v1

### Cut or hide for launch

- Hide **Word Practice** from the main nav and route surface.
- Hide **Review Queue** from the main nav and route surface.
- Keep **dev analytics/dev metrics** routes out of production.
- Reduce the dashboard to sentence-first metrics only.

### Keep for v1

- Auth
- Sentence practice
- Pronunciation scoring
- Basic history/sessions
- Lightweight dashboard

### Rationale

- Sentence practice is the one end-to-end loop that already has the strongest implementation and test coverage.
- Word practice and review expand the QA matrix substantially without being necessary for the first public release.
- Narrowing the product surface makes a Railway launch much safer and faster.

## 9. Verdict

**Do not move this app to Vercel, Cloudflare, or Netlify as the fastest path to launch.**

**Fix the current `npm run start` crash, keep the app as a single Node/Express service, and deploy it to Railway after one real staging pass against Mongo + Azure.**

That is the shortest path to a working public deployment with the least hosting complexity.

## Provider References

- Vercel Express docs: <https://vercel.com/docs/frameworks/backend/express>
- Vercel Functions limits: <https://vercel.com/docs/functions/limitations>
- Cloudflare Workers Node.js compatibility: <https://developers.cloudflare.com/workers/runtime-apis/nodejs/>
- Cloudflare Workers limits: <https://developers.cloudflare.com/workers/platform/limits/>
- Netlify Functions limits: <https://docs.netlify.com/build/functions/limits/>
- Netlify Vite docs: <https://docs.netlify.com/frameworks/vite/>
- Railway Nixpacks docs: <https://docs.railway.com/guides/nixpacks>
