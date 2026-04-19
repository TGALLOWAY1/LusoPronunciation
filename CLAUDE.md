# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LusoPronounce is a Brazilian Portuguese pronunciation trainer. Users record themselves speaking sentences or words, the app sends audio to Azure Speech Service for assessment, and returns word-by-word scores with phoneme-level feedback and coaching suggestions.

## Tech Stack

- **Frontend**: React 19 + TypeScript 5.9 + Vite 7
- **Backend**: Express 5 + Node.js (requires Node 22.x)
- **Styling**: Tailwind CSS 3.4 (dark mode via OS preference)
- **Database**: MongoDB via Mongoose 9
- **Speech**: Azure Cognitive Services Speech SDK
- **Testing**: Vitest 4 (unit/contract) + Playwright 1.58 (e2e)
- **Path aliases**: `@/*` resolves to `src/*` (configured in tsconfig.json, vite.config.ts, and vitest.config.ts)

## Common Commands

```bash
# Development
npm run dev              # Start Vite frontend on port 3000
npm run dev:server       # Start Express backend on port 4000

# Testing
npm run test             # Run Vitest in watch mode
npm test -- --run        # Run all Vitest tests once (no watch)
npx vitest run src/path/to/file.test.ts  # Run a single test file
npm run test:phase04     # Run targeted unit/contract tests (single run)
npm run e2e:phase04      # Run Playwright e2e tests
npm run verify:phase04   # Run both test:phase04 + e2e:phase04

# Build
npm run build            # prebuild (copy data JSON to public/) + tsc + vite build
npm run start            # Start production Express server (serves built frontend)
```

**Note**: `npm run lint` is currently a no-op placeholder.

## Architecture

### Pronunciation Assessment Pipeline

1. Client records audio via MediaRecorder (webm/opus)
2. Server converts to WAV (16kHz, 16-bit, mono) via `src/server/lib/audioConversion.ts` (uses ffmpeg-static)
3. Sent to Azure Speech Service for pronunciation assessment
4. Returns word-by-word scores + phoneme feedback
5. Coaching engine (`src/lib/coaching/`) generates next-step suggestions with confusion detection and minimal pairs

### Frontend Architecture

- **Entry point**: `src/app/App.tsx`
- **Provider hierarchy**: `ErrorBoundary` > `SettingsStoreProvider` > `ProgressStoreProvider` > `PracticeLogStoreProvider` > `LocalStorageMigrator` + `AppRoutes`
- **Routing** (React Router):
  - `/` → `UserDashboardPage` (protected)
  - `/auth` → `AuthPage`
  - `/auth/callback` → `OAuthCallbackPage`
  - `/practice/sentence` → `SentencePractice` (protected)
  - `/practice/word` → `WordPractice` (protected)
  - `/sessions` → `RecentSessions` (protected)
  - Dev-only (lazy-loaded, tree-shaken in prod): `/dev/pronunciation-fixtures`, `/dev/analytics`, `/dev/metrics`
- **Layout**: `AppLayout` wraps all routes with responsive sidebar (desktop) / top nav (mobile)
- **Key hooks** (in `src/hooks/`):
  - `useLivePronunciationPractice` — core recording/assessment lifecycle
  - `useMicrophoneRecorder` — microphone access & recording
  - `useAudioPlayer` / `useGlobalAudioPlayer` — audio playback
  - `useCanonicalWordMap` — word canonicalization for pronunciation mapping
- **State**: React Context stores in `src/state/` — `practiceLogStore`, `progressStore`, `settingsStore`
- **Audio quality gates** in `src/lib/audioQuality.ts`: minimum duration, silence detection

### Backend Architecture

- Entry point: `src/server/app.ts`
- API routes under `/api`: health, pronunciationAssessment, auth, oauth, practice, flashcards, migration
- Auth: JWT-based (7-day expiry) with `requireAuth` middleware; optional invite-code gating
- Security middleware: CORS, per-user rate limiting on pronunciation endpoints, Helmet CSP headers
- Database models (`src/server/models/`):
  - `UserModel` — accounts (email, passwordHash, OAuth provider)
  - `PronunciationAttemptModel` — assessment results with scoring
  - `PracticeSessionModel` — practice session containers
  - `FlashcardModel` — SM-2 spaced repetition data
  - `InviteCodeModel` — invite code access control

### Data Pipeline

- Static JSON datasets in `data/` (masterSentences, masterWords, phoneme_metadata, audio_index)
- Generated audio files in `audio/ptbr/` (male/female voices)
- `npm run generation:pipeline` runs the master generation pipeline
- `prebuild` copies data JSON into `public/data/` for frontend access

## Project Structure

### Frontend (`src/`)

- `app/` — App.tsx root component and routing
- `api/` — client-side API modules (auth, practice, flashcards)
- `components/` — feature-organized React components (auth, practice, pronunciation, dashboard, layout, common)
- `config/` — application configuration (appConfig.ts)
- `features/` — feature modules (migration/LocalStorageMigrator)
- `hooks/` — business logic hooks (recording, assessment, audio playback)
- `lib/` — core utilities & logic (coaching engine, audio quality, error taxonomy, metrics)
- `models/` — frontend data models (appData, audio, content, practice, progress, vocab)
- `pages/` — page-level components (UserDashboardPage, SentencePractice, WordPractice, etc.)
- `pipeline/` — content generation pipeline logic (enrichItems, phonemeMapper, TTS, validation)
- `shared/` — shared types between client/server
- `state/` — React Context stores
- `styles/` — CSS styles
- `types/` — TypeScript type definitions (pronunciation, drill, wordPractice)
- `utils/` — utility functions (audioRouting, difficultyLabels, drillLog)

### Backend (`src/server/`)

- `routes/` — API route handlers (health, pronunciationAssessment, auth, oauth, practice, flashcards, migration)
- `models/` — Mongoose schemas (User, PronunciationAttempt, PracticeSession, Flashcard, InviteCode)
- `middleware/` — auth (JWT), pronunciationSecurity (CORS + rate limiting)
- `services/` — business logic (flashcardService with SM-2 algorithm)
- `db/` — MongoDB singleton connection (mongoClient.ts)
- `lib/` — audio conversion (ffmpeg), temp workspace, timing utilities
- `config/` — startup checks and environment validation
- `mappers/` — DTO mappers (practiceMapper, userMapper)
- `utils/` — server utilities (speechDebug)

### Testing (`src/test/`, `src/mock/`, `e2e/`)

- `src/test/` — test setup (setupTests.ts) and shared test files
- `src/mock/` — test fixtures (pronunciationFixtures, wordPracticeSynthetic)
- `src/dev/` — dev-only utilities (e2eMediaMocks for Playwright)
- `src/server/__fixtures__/` — server test fixtures
- `e2e/` — Playwright tests (phase-organized under `e2e/phase04/`)

### Other Key Directories

- `data/` — master JSON datasets, test data, raw/debug artifacts (static source lists live in `data/static/`, legacy/deprecated data in `data/legacy/`)
- `scripts/` — data generation, audio generation, invite code seeding (`scripts/legacy/` holds retired scripts)
- `docs/` — documentation, grouped under `architecture/`, `audits/`, `planning/`, `retrospectives/`, and `dev-tools/`
- `config/` — generation pipeline configuration

## Testing

- **Framework**: Vitest 4 with `globals: true` (describe/it/expect available without imports)
- **Environment**: jsdom (via vitest.config.ts)
- **Setup file**: `src/test/setupTests.ts`
- **Test colocation**: tests live alongside source files (`*.test.ts(x)`)
- **Phase-based organization**: test commands target specific phases (`test:phase04` is the current CI suite)
- **E2E media mocking**: `src/dev/e2eMediaMocks.ts` provides deterministic WAV blob generation for Playwright tests (scenarios: success, silent, short, micDenied)
- **Auth in tests**: protected route tests seed `luso_auth_token` to localStorage before navigation
- **Fixture locations**: `src/mock/`, `data/test_data/`, `src/server/__fixtures__/`

## Development Conventions

- Feature-based component structure; hooks encapsulate business logic; Context for global state
- Tests colocated with source files (`*.test.ts(x)`)
- TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`)
- Shared types in `src/shared/types/`; feature-specific types near usage
- Avoid loose `any` except for Azure raw response types
- Centralized error taxonomy via `ERROR_CLASS` enum
- Telemetry recording for failures via `attemptMetrics.ts`

### Keeping FEATURES.md in Sync

When adding, modifying, or removing user-facing functionality, update `FEATURES.md` at the project root to reflect the change. This includes new features, renamed or restructured features, and removed features. Keep descriptions concise (one to two sentences). Do not document internal refactors or implementation details that have no user-visible effect.

### Commit Style

```
feat(scope): description
fix(scope): description
chore: description
test: description
docs: description
```

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main` and `develop`:
1. `npm ci` → `npm run build` → `npm test -- --run` → Playwright e2e (phase04)

**Note**: CI currently uses Node 20 while the project specifies Node 22.x in `package.json` engines and `.nvmrc`.

## Environment Setup

Copy `.env.example` to `.env` and set required vars:
- `AZURE_SPEECH_KEY` — Azure Speech Service subscription key
- `AZURE_SPEECH_REGION` — Azure region (e.g., `eastus`, `brazilsouth`)
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — secret for signing JWT tokens

Optional: `REQUIRE_INVITE_CODE` (default false), `ENABLE_DEV_LOGIN` (dev-only quick-login), OAuth provider keys (GitHub, LinkedIn), CORS/rate-limit tuning, audio conversion settings. See `.env.example` for full list.

## Port Configuration

| Service | Port |
|---------|------|
| Vite frontend (dev) | 3000 |
| Express backend | 4000 |
| Vite dev / Playwright e2e | 4173 |

The Vite dev server proxies `/api` requests to the backend on port 4000. Playwright auto-starts Vite in dev mode on port 4173 for e2e tests.

## Deployment

Target platform: **Railway** via multi-stage Dockerfile (node:22-slim).

- `railway.json` — healthcheck at `/api/health`, restart on failure
- `nixpacks.toml` — Node 22 fallback config
- Dockerfile installs CA certificates for MongoDB Atlas TLS
- Production: `npm run build && npm start`
- Invite seed: `npm run invite:seed -- --code=LAUNCH-ACCESS --maxUses=25`
