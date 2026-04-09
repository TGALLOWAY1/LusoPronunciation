# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LusoPronounce is a Brazilian Portuguese pronunciation trainer. Users record themselves speaking sentences or words, the app sends audio to Azure Speech Service for assessment, and returns word-by-word scores with phoneme-level feedback and coaching suggestions.

## Tech Stack

- **Frontend**: React 19 + TypeScript 5.9 + Vite 7
- **Backend**: Express 5 + Node.js (requires Node 22.x)
- **Styling**: Tailwind CSS 3.4
- **Database**: MongoDB via Mongoose 9
- **Speech**: Azure Cognitive Services Speech SDK
- **Testing**: Vitest 4 (unit/contract) + Playwright 1.58 (e2e)
- **Path aliases**: `@/*` resolves to `src/*` (configured in both tsconfig.json and vite/vitest configs)

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

- **Routing**: React Router in `src/app/App.tsx` — routes: `/`, `/practice/sentence`, `/practice/word`, `/review`
- **Layout**: `AppLayout` wraps all routes with responsive sidebar (desktop) / top nav (mobile)
- **Key hooks** (in `src/hooks/`):
  - `useLivePronunciationPractice` — core recording/assessment lifecycle
  - `useMicrophoneRecorder` — microphone access & recording
  - `useAudioPlayer` / `useGlobalAudioPlayer` — audio playback
- **State**: React Context stores in `src/state/` — `practiceLogStore`, `progressStore`, `settingsStore`
- **Audio quality gates** in `src/lib/audioQuality.ts`: minimum duration, silence detection

### Backend Architecture

- Entry point: `src/server/app.ts`
- API routes under `/api`: health, pronunciationAssessment, auth, oauth, practice, flashcards, migration
- Auth: JWT-based with `requireAuth` middleware; optional invite-code gating
- Security middleware: CORS, rate limiting, helmet

### Data Pipeline

- Static JSON datasets in `data/` (sentences, words, phonemes)
- Generated audio files in `audio/ptbr/` (male/female voices)
- `npm run generation:pipeline` runs the master generation pipeline
- `prebuild` copies data JSON into `public/data/` for frontend access

## Project Structure

Key directories:
- `src/components/` — feature-organized React components (auth, practice, pronunciation, dashboard, layout, common)
- `src/hooks/` — business logic hooks
- `src/lib/` — utilities & core logic (coaching engine, audio quality, types)
- `src/server/` — Express backend (routes, models, middleware, services)
- `src/state/` — React Context stores
- `src/shared/` — shared types between client/server
- `e2e/` — Playwright tests (phase-organized)
- `scripts/` — build & data generation scripts

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

## Environment Setup

Copy `.env.example` to `.env` and set required vars:
- `AZURE_SPEECH_KEY` — Azure Speech Service subscription key
- `AZURE_SPEECH_REGION` — Azure region (e.g., `eastus`, `brazilsouth`)
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — secret for signing JWT tokens

Optional: `REQUIRE_INVITE_CODE` (default false), OAuth provider keys (GitHub, LinkedIn), CORS/rate-limit tuning. See `.env.example` for full list.

## Port Configuration

| Service | Port |
|---------|------|
| Vite frontend (dev) | 3000 |
| Express backend | 4000 |
| Vite preview / Playwright e2e | 4173 |

The Vite dev server proxies `/api` requests to the backend on port 4000. Playwright spins up Vite in preview mode on 4173 automatically.

## Deployment

Target platform: **Railway**. Production: `npm run build && npm start`. Invite seed: `npm run invite:seed -- --code=LAUNCH-ACCESS --maxUses=25`.
