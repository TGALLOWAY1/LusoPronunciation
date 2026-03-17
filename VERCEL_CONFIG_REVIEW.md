# Vercel Config Review

## Current State

- There is **no `vercel.json`** in the repo.
- The repo is **not** currently shaped like a clean Vercel deployment target.
- The frontend would be easy for Vercel to detect as a Vite app, but the backend is a custom Express server with Mongo, ffmpeg, temp-file usage, and multipart audio uploads.

## Framework Detection Assumptions

### What Vercel will see

- `package.json` with Vite frontend scripts
- React + Vite frontend output to `dist/`
- A custom Node server under `src/server/`

### Why defaults are not enough

- The app is not just a static Vite build.
- The deployed backend currently expects:
  - `npm run start`
  - a long-lived Express process
  - `app.listen(...)`
  - Mongo startup before accepting requests
  - ffmpeg via `child_process.spawn()`
  - temp workspace creation in `os.tmpdir()`

That is a much better fit for Railway than for Vercel's function-oriented deployment model.

## `vercel.json` Review

### Current repo

- `vercel.json`: **not present**

### Does the repo need one?

- If you were deploying only the frontend as a static SPA on Vercel, a small rewrite config might be enough.
- For the **current full-stack app**, a `vercel.json` alone is not sufficient because the bigger issue is deployment model mismatch, not missing config syntax.

## Build / Output Settings

### Current repo behavior

- Build command: `npm run build`
- Frontend output directory: `dist/`
- Static assets come from both:
  - Vite build output
  - `public/` copied into `dist/`

### Vercel-specific problem

- Vercel's Express docs state that `express.static()` is ignored and static files should come from `public/**`.
- This repo currently serves `dist/` via Express in `src/server/app.ts`, so the current production model does not map cleanly to Vercel defaults.

## Functions Config

### Current backend shape

- Express app with mounted routers
- Single pronunciation route that handles:
  - multipart upload
  - optional ffmpeg conversion
  - Azure request
  - response normalization

### Why this is risky on Vercel

- Vercel function request bodies are capped at 4.5 MB.
- The current pronunciation route allows uploads up to 10 MB.
- Cold starts and per-request execution ceilings are a bad fit for live speech scoring.
- The current in-memory rate limiter does not carry across serverless instances.

## Routes / Rewrites / Redirects

### Current routing model

- BrowserRouter on the frontend
- Same-origin `/api/*` fetches from the client
- Express SPA fallback for non-API routes

### What would be needed on Vercel

- SPA rewrites for BrowserRouter if the frontend is deployed statically
- A separate backend origin or a custom Vercel function entrypoint for the API
- Expanded CORS handling across auth, practice, migration, and flashcard routes if the frontend/backend split

## Environment Variables

### Runtime env vars the app expects

- `MONGODB_URI`
- `JWT_SECRET`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- `REQUIRE_INVITE_CODE`
- optional CORS and speech tuning vars

### Build-time client vars

- `VITE_CONTENT_SOURCE`
- do not set `VITE_ENABLE_DEV_ANALYTICS` in production unless routes and nav are intentionally aligned

## Preview vs Production Behavior

### Preview-friendly parts

- Vercel previews are excellent for frontend iteration.
- The SPA itself can build successfully.

### Preview-hostile parts

- The current API runtime is the blocker, not the frontend.
- A Vercel preview would still not prove the live pronunciation path unless the backend was moved elsewhere.

## Minimal Config Required?

### Honest answer

There is **no safe "minimal Vercel config"** that makes the current full-stack app deployment-ready.

If you insist on Vercel, the lowest-risk shape is:

1. Deploy the React/Vite frontend to Vercel as a static SPA.
2. Move the Express API to Railway or another Node PaaS.
3. Add SPA rewrites for BrowserRouter on the frontend.
4. Expand CORS across all API routes.
5. Keep live pronunciation uploads away from Vercel functions.

## Conclusion

- The absence of `vercel.json` is **not** the main problem.
- The main problem is that the app's current backend architecture is a poor fit for Vercel.
- The repo should **not** be treated as "one config file away" from a safe Vercel deployment.

## Reference Links

- Vercel Express docs: <https://vercel.com/docs/frameworks/backend/express>
- Vercel Functions limits: <https://vercel.com/docs/functions/limitations>
