# DEMO_READY.md

The fastest, safest path to running, showing, and (optionally) deploying
**LusoPronounce** for a portfolio / recruiter audience.

> **TL;DR** — Run `npm install && npm run dev`, open **http://localhost:3000/tour**.
> The `/tour` and `/demo` routes are **public** (no login, no Azure, no
> database) and use clearly-labeled sample data. The full recording flow needs
> Azure Speech + MongoDB (see below).

---

## 1. Install dependencies

Requires **Node 22.x** (see `.nvmrc` / `package.json` engines).

```bash
npm install
```

## 2. Run locally

You can explore the **tour and demo with only the frontend**:

```bash
npm run dev          # Vite frontend → http://localhost:3000
```

For the **full app** (real recording + scoring) also run the backend:

```bash
npm run dev:server   # Express backend → http://localhost:4000
```

The Vite dev server proxies `/api` requests to the backend on port 4000
automatically.

### Public URLs (no login required)

| Route | What it is |
|-------|------------|
| **http://localhost:3000/tour** | "Take a Tour" — a portfolio-friendly product explainer |
| **http://localhost:3000/demo** | Interactive demo with sample scores, phoneme feedback & progress |

### App URLs (login required)

| Route | What it is |
|-------|------------|
| `http://localhost:3000/` | Practice (protected → redirects to `/auth`) |
| `http://localhost:3000/auth` | Sign in / register (links to the tour & demo) |
| `/review`, `/progress`, `/settings`, `/builder`, … | Authenticated app features |

## 3. Required environment variables (full app only)

Copy `.env.example` to `.env`. These are required for the **real** record →
score flow and for accounts:

| Variable | Purpose |
|----------|---------|
| `AZURE_SPEECH_KEY` | Azure Cognitive Services Speech key |
| `AZURE_SPEECH_REGION` | Azure region (e.g. `eastus`, `brazilsouth`) |
| `MONGODB_URI` | MongoDB connection string (Atlas or local) |
| `JWT_SECRET` | Secret for signing JWT auth tokens |

## 4. Optional environment variables

| Variable | Purpose |
|----------|---------|
| `REQUIRE_INVITE_CODE` | Gate registration behind an invite code (default off) |
| `ENABLE_DEV_LOGIN` | Enables a one-click dev login (non-production) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth |
| `APP_ORIGIN` | Public URL used for OAuth redirects |
| `SPEECH_RATE_LIMIT_*`, `SPEECH_MAX_UPLOAD_BYTES` | Rate-limit / upload-cap tuning |
| `AUDIO_CONVERT_TIMEOUT_MS` | ffmpeg timeout (default 12 s) |

See `.env.example` for the complete list.

## 5. What works WITHOUT Azure credentials

- ✅ **`/tour`** — the full product explainer (static, self-contained).
- ✅ **`/demo`** — pick a real PT-BR sentence, play its native reference audio,
  "Analyze demo recording", and see a realistic **sample** score, word-by-word
  chips, phoneme breakdown (with IPA and teaching tips), coaching suggestions,
  and a progress trend. The sentences and native audio are real; the scores and
  history are hand-authored sample data in `src/lib/demo/demoData.ts` and are
  clearly labeled "Sample data" in the UI.
- ✅ The frontend builds and runs; navigation, styling, and layout all work.

## 6. What REQUIRES Azure credentials (and MongoDB)

- ❌ Real microphone recording → **Azure Speech** pronunciation assessment.
- ❌ Real word-by-word / phoneme scoring of *your* voice.
- ❌ User accounts, saved attempts, streaks, spaced-repetition review
  (needs **MongoDB** + `JWT_SECRET`).
- ❌ Native TTS reference audio generation pipeline.

In short: the **demo mode simulates** the experience; the **real app** needs
Azure + MongoDB.

## 7. Known limitations

- The demo's "Listen (native voice)" button is illustrative on `/demo`; real
  TTS playback lives in the authenticated practice flow.
- `PhraseScoreOverview` renders a small "Progress over time (simulated)"
  sparkline of its own (existing app behavior); the `/demo` progress panel adds
  a separate, explicitly-labeled sample history.
- CEFR-level estimation is not yet wired up.
- Pass threshold is hardcoded at 70 in the card components.
- No true offline mode — real assessment requires connectivity to Azure.

## 8. Deployment

### Current target: Railway

The repo already ships a production setup (`Dockerfile`, `railway.json`,
`nixpacks.toml`) that serves the built frontend from the Express server:

```bash
npm run build
npm start
```

This is the right target for the **full app** because it needs a Node server
(for the Azure proxy + auth + MongoDB).

### Easiest public demo (frontend-only)

Because `/tour` and `/demo` are pure client-side routes with no backend
dependency, the lowest-effort *public demo* is a **static deploy of the built
frontend** to Vercel / Netlify / Cloudflare Pages / GitHub Pages:

```bash
npm run build        # outputs to dist/
# deploy the dist/ folder as a static SPA (enable SPA fallback to index.html)
```

Then share **`/tour`** as the landing link. Visitors can explore the tour and
demo; the protected app routes will simply redirect to `/auth`.

> ⚠️ A static-only deploy means the real record→score flow won't work (no
> backend). If you want the live Azure flow public, deploy the full server to
> Railway instead and set the required env vars there. **Never commit secrets**
> — set them in the host's environment configuration.

## 9. Easiest next steps to deploy

1. **Static tour/demo (5 min, recommended first):** `npm run build`, then
   deploy `dist/` to Vercel/Netlify with SPA fallback. Share `/tour`.
2. **Full live app (Railway):** set `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`,
   `MONGODB_URI`, `JWT_SECRET` in Railway; `npm run build && npm start` is
   already wired via the Dockerfile.
3. If gating signups: `npm run invite:seed -- --code=LAUNCH-ACCESS --maxUses=25`.

---

## Verification

```bash
npm run build          # typecheck + production build  ✅
npm run test:phase04   # deploy-critical unit suite     ✅ (42 tests)
```

Both pass as of this document. The `/tour` and `/demo` routes were verified to
render with no console errors.
