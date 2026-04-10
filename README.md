# LusoPronounce

A browser-based Brazilian Portuguese pronunciation trainer that scores your speech word-by-word using Azure Speech Service and coaches you with targeted minimal-pair drills.

<!-- TODO: Replace this static hero with a short GIF showing a full record → score → coaching cycle -->
<img width="1289" height="1274" alt="LusoPronounce sentence practice" src="https://github.com/user-attachments/assets/eb5fcdd1-ab7e-41ff-a015-dd4f973b0e6f" />

## Why this project exists

English speakers learning Brazilian Portuguese rarely get fast, phoneme-level feedback. Most apps grade at the sentence level and miss the sound confusions that matter most in PT-BR: nasalization, `r`/`rr`, `lh`/`nh`, `tch`/`ti`, open vs. close vowels. LusoPronounce closes that loop — record a sentence, get per-word and per-phoneme scores in seconds, and receive deterministic coaching on what to drill next.

## What it does

- Record a sentence or word in the browser and get back word-by-word accuracy, fluency, completeness, and prosody scores
- Expand any word to see phoneme-level breakdowns with IPA and error-type tags
- Surface actionable coaching suggestions after each attempt, including minimal-pair drills tuned to the learner's confusion patterns
- Track progress via a spaced-repetition queue, weak-phoneme analysis, and a 7-day performance dashboard

## Why it is technically interesting

- **Full browser → server → Azure audio pipeline.** MediaRecorder captures webm/opus; the Express backend transcodes to 16 kHz / 16-bit / mono WAV with `ffmpeg-static` (`src/server/lib/audioConversion.ts`) before handing it to the Azure Speech SDK for assessment.
- **Deterministic coaching engine.** `src/lib/coaching/coachingEngine.ts` turns raw Azure scores into next-step suggestions. `confusionDetection.ts` identifies PT-BR sound confusions and `minimalPairs.ptbr.ts` serves targeted drills.
- **Client-side quality gates.** `src/lib/audioQuality.ts` rejects silent or too-short takes using RMS energy + duration checks before an upload is ever sent.
- **Stale-response protection.** `useLivePronunciationPractice` tags each assessment request with an ID so cancelled or superseded attempts can't overwrite newer results.
- **SM-2 spaced repetition tied to pronunciation scores.** Flashcard scheduling uses real assessment outcomes, not just self-rating.

## Architecture overview

```
Browser (MediaRecorder, webm/opus)
        │
        ▼
Vite dev proxy  ──►  Express /api/pronunciation/assessment
                              │
                              ▼
                      ffmpeg transcode (WAV 16 kHz mono)
                              │
                              ▼
                      Azure Speech SDK  ──►  word + phoneme scores
                              │
                              ▼
                      Coaching engine  ──►  React UI (hooks + context)
```

- **Frontend**: React 19 + TypeScript 5.9 + Vite 7, Tailwind CSS 3.4, React Router, feature-based components in `src/components/`, business logic in `src/hooks/`, global state via React Context in `src/state/`.
- **Backend**: Express 5 on Node 22, Mongoose 9 for MongoDB, JWT auth with an optional invite-code gate, CORS + Helmet + per-user rate limits on the pronunciation endpoint.
- **Testing**: Vitest for unit and contract tests; Playwright for end-to-end flows (organized by phase under `e2e/`).

## Key features

- **Pronunciation assessment** — live recording, word + phoneme scores, sentence-level accuracy/fluency/completeness/prosody
- **Coaching** — confusion detection and minimal-pair drills for PT-BR sound pairs
- **Sentence practice** — category/difficulty browser, native male/female audio, slow playback, attempt history with sparklines
- **Word practice** — pronunciation, text MC (PT↔EN), listening MC, self-rating, list/drill/weak-words views
- **Spaced repetition** — SM-2 flashcard scheduling linked to pronunciation scores
- **Dashboard** — 7-day performance charts, weak-phoneme surfacing, due-for-review queue, category breakdown
- **Auth** — email + password, GitHub and LinkedIn OAuth, optional invite-code gating

See [`FEATURES.md`](./FEATURES.md) for the full list.

## Demo

<!-- TODO: Add the live Railway URL here once deployed, or delete this section -->

## Local setup

Requires Node 22.x.

```bash
npm install
cp .env.example .env       # fill in the values listed below
npm run dev                # frontend on http://localhost:3000
npm run dev:server         # backend  on http://localhost:4000
```

The Vite dev server proxies `/api` requests to the backend automatically.

Common commands:

```bash
npm test -- --run          # run all unit + contract tests once
npm run verify:phase04     # targeted unit tests + Playwright e2e
npm run build              # typecheck + production build
npm run screenshots:readme # regenerate the PNGs in docs/assets/readme/
```

## Environment variables

Copy `.env.example` to `.env` and set the required values.

**Required**

| Variable              | Purpose                                             |
|-----------------------|-----------------------------------------------------|
| `AZURE_SPEECH_KEY`    | Azure Cognitive Services Speech subscription key    |
| `AZURE_SPEECH_REGION` | Azure region (e.g. `eastus`, `brazilsouth`)         |
| `MONGODB_URI`         | MongoDB connection string (Atlas or local)          |
| `JWT_SECRET`          | Secret for signing JWT auth tokens                  |

**Optional**

| Variable                                         | Purpose                                               |
|--------------------------------------------------|-------------------------------------------------------|
| `REQUIRE_INVITE_CODE`                            | Gate registration behind an invite code (default off) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`      | GitHub OAuth                                          |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`  | LinkedIn OAuth                                        |
| `APP_ORIGIN`                                     | Public URL used for OAuth redirects                   |
| `SPEECH_RATE_LIMIT_*`, `SPEECH_MAX_UPLOAD_BYTES` | Tune rate limits and upload cap                       |
| `AUDIO_CONVERT_TIMEOUT_MS`                       | ffmpeg timeout (default 12 s)                         |

See [`.env.example`](./.env.example) for the full list.

## Deployment

Target platform: **Railway**. Railway auto-detects Node and sets `PORT`.

```bash
npm run build
npm start
```

For a gated launch, seed at least one invite code before going live:

```bash
npm run invite:seed -- --code=LAUNCH-ACCESS --maxUses=25
```

Set `REQUIRE_INVITE_CODE=false` in the deployed environment for open signup.

## Screenshots

<!-- TODO: Refresh screenshots via `npm run screenshots:readme` if the UI has changed -->

| | |
|---|---|
| **Sentence Practice** | **Word Practice** |
| ![Sentence practice](docs/assets/readme/sentence-practice.png) | ![Word practice](docs/assets/readme/word-practice.png) |
| **Dashboard** | **Recent Sessions** |
| ![Dashboard](docs/assets/readme/dashboard.png) | ![Recent sessions](docs/assets/readme/recent-sessions.png) |
| **Review Queue** | |
| ![Review queue](docs/assets/readme/review-queue.png) | |

## Limitations

- CEFR-level estimation is not yet wired up (`src/lib/practiceAnalytics.ts` TODO)
- Pass threshold is currently hardcoded at 70 inside the card components
- Audio uploads are capped at 10 MB (tunable via `SPEECH_MAX_UPLOAD_BYTES`)
- No true offline mode — sessions dual-write to `localStorage` for resilience, but Azure assessment requires connectivity
- Azure Speech Service costs scale with usage; there is no bundled on-device fallback

## Future work

- Virtual scrolling for lists over ~500 items (see `docs/PERFORMANCE_NOTES.md`)
- IndexedDB-backed storage for larger datasets
- Service worker for offline practice of previously fetched content
- Configurable per-user pass thresholds
- Deeper phoneme-score extraction from Azure's raw response
- CEFR-level auto-estimation from aggregate scores
