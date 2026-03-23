# Deployment Commands And Env

## Recommended Platform

- Recommended host: **Railway**
- Deployment shape: **single Node service serving both SPA and API**

## Commands

### Install

```bash
npm ci
```

For local-only development, `npm install` is also acceptable, but CI and deploy pipelines should use `npm ci`.

### Local development

Run these in separate terminals:

```bash
npm run dev
```

```bash
npm run dev:server
```

### Typecheck

```bash
npx tsc --noEmit
```

Note: `npm run build` already runs TypeScript checking as part of the build.

### Lint

```bash
npm run lint
```

Important: this is currently a placeholder script and does **not** run a real linter yet.

### Tests

Recommended pre-launch gates:

```bash
npm test -- --run
```

Deploy-critical browser smoke test:

```bash
npm run e2e:phase04
```

### Build

```bash
npm run build
```

### Start

```bash
npm run start
```

Important: startup now fails fast when required launch env vars are missing. Set `MONGODB_URI`, `JWT_SECRET`, `AZURE_SPEECH_KEY`, and `AZURE_SPEECH_REGION` before using this as a deploy smoke test.

### Seed invite codes when launch gating is enabled

```bash
npm run invite:seed -- --code=LAUNCH-ACCESS --maxUses=25
```

## Expected Output Directory

- Frontend build output: `dist/`
- Vite also copies `public/` assets into `dist/`

## Required Env Vars

## Required for local dev

- `MONGODB_URI`
  - Mongo connection string for users, sessions, attempts, flashcards, and invite codes
- `JWT_SECRET`
  - secret used to sign auth tokens
- `AZURE_SPEECH_KEY`
  - Azure Speech API key
- `AZURE_SPEECH_REGION`
  - Azure Speech region

## Required for preview deploys

- `MONGODB_URI`
- `JWT_SECRET`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- `REQUIRE_INVITE_CODE`
  - explicit signup policy for preview environments

Recommended for preview deploys:

- `APP_ORIGINS` or `CORS_ALLOWED_ORIGINS` or `SPEECH_CORS_ALLOWED_ORIGINS`
  - include the preview domain if requests will cross origins

## Required for production

- `MONGODB_URI`
- `JWT_SECRET`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- `REQUIRE_INVITE_CODE`
  - set explicitly to match the launch plan

Recommended for production:

- `APP_ORIGINS` or `CORS_ALLOWED_ORIGINS` or `SPEECH_CORS_ALLOWED_ORIGINS`
  - include the final production domain

## Optional runtime tuning env vars

- `PORT`
  - port binding for the Node server; Railway usually injects this automatically
- `SPEECH_RATE_LIMIT_WINDOW_MS`
  - pronunciation rate-limit window
- `SPEECH_RATE_LIMIT_MAX_REQUESTS`
  - max pronunciation requests per window
- `SPEECH_MAX_UPLOAD_BYTES`
  - max pronunciation upload size
- `AUDIO_CONVERT_TIMEOUT_MS`
  - ffmpeg conversion timeout
- `SPEECH_HEALTH_TIMEOUT_MS`
  - Azure speech health probe timeout
- `AUDIO_CONVERT_FFMPEG_PATH`
  - explicit ffmpeg binary path override
- `SPEECH_DEBUG`
  - verbose speech debugging; leave off in production unless actively diagnosing an issue

## Optional build-time client env vars

- `VITE_CONTENT_SOURCE`
  - content source selection for the frontend build; `pipeline` is the intended launch mode
- `VITE_ENABLE_DEV_ANALYTICS`
  - do **not** set this in preview or production unless you intentionally want dev navigation and matching routes

## Railway Deploy Steps

1. Set the required launch env vars and run `npm run start` as a smoke test.
2. Push the branch to the remote you will deploy from.
3. Create a Railway service from this repo.
4. Keep the existing `railway.json` settings:
   - build command: `npm run build`
   - start command: `npm run start`
   - health check path: `/api/health`
5. Add the required env vars in Railway.
6. Deploy to a staging environment first.
7. Verify the full smoke test list below.
8. Add a custom production domain after staging is green.

## Post-Deploy Smoke Tests

1. Open `/api/health` and confirm the service responds with Mongo connected.
2. Open `/` and `/practice/sentence` directly to confirm SPA routing works.
3. Register a user under the chosen invite policy.
4. Log in and confirm the client can hit `/api/pronunciation/speech-health`.
5. Record and submit one real sentence-practice attempt.
6. Confirm the scoring response returns and the feedback UI renders.
7. Refresh the page and confirm history/session data still appears.
8. Check Railway logs for:
   - Mongo connection failures
   - ffmpeg spawn failures
   - Azure request failures
   - 413 or 429 pronunciation errors

## Recommended Release Gate

Use this sequence before deployment:

```bash
npm ci
npm run build
npm test -- --run
npm run e2e:phase04
```

Then perform one real staging smoke test before public launch.
