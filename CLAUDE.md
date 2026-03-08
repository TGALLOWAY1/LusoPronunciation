# CLAUDE.md - LusoPronunciation

## Project Overview

LusoPronounce is a Brazilian Portuguese pronunciation trainer. Users record themselves speaking sentences or words, the app sends audio to Azure Speech Service for assessment, and returns word-by-word scores with phoneme-level feedback and coaching suggestions.

## Tech Stack

- **Frontend**: React 19 + TypeScript 5.9 + Vite 7
- **Backend**: Express 5 + Node.js
- **Styling**: Tailwind CSS 3.4
- **Database**: MongoDB via Mongoose 9
- **Speech**: Azure Cognitive Services Speech SDK
- **Testing**: Vitest 4 (unit/contract) + Playwright 1.58 (e2e)
- **Path aliases**: `@/*` resolves to `src/*`

## Common Commands

```bash
# Development
npm run dev              # Start Vite frontend on port 3000
npm run dev:server       # Start Express backend on port 4000

# Testing
npm run test             # Run all Vitest tests (watch mode)
npm run test:phase04     # Run targeted unit/contract tests (single run)
npm run e2e:phase04      # Run Playwright e2e tests
npm run verify:phase04   # Run both test:phase04 + e2e:phase04

# Build
npm run build            # tsc + vite build

# Data generation
npm run generation:pipeline    # Master audio/data generation
npm run audio:words:female     # Generate word audio (female voice)
npm run audio:words:male       # Generate word audio (male voice)
```

**Note**: `npm run lint` is currently a no-op placeholder.

## Project Structure

```
src/
├── app/                  # React entry point, routing (App.tsx, main.tsx)
├── components/           # Feature-organized React components
│   ├── auth/             # Login/register
│   ├── common/           # Reusable UI (buttons, loaders, error boundaries)
│   ├── dashboard/        # Dashboard views
│   ├── layout/           # Header, sidebar, app wrapper
│   ├── practice/         # Practice session UI & recording interface
│   └── pronunciation/    # Score feedback & phoneme displays
├── hooks/                # Business logic hooks
├── lib/                  # Utilities & core logic
│   ├── coaching/         # Coaching engine, confusion detection, minimal pairs
│   └── types.ts          # Core domain types (Sentence, Word, etc.)
├── server/               # Express backend
│   ├── routes/           # API endpoints (pronunciationAssessment, auth, practice)
│   ├── models/           # Mongoose models
│   ├── middleware/        # Auth, CORS, rate limiting
│   ├── services/         # Business logic services
│   ├── lib/              # Server utilities (audio conversion)
│   └── __fixtures__/     # Test audio fixtures
├── state/                # React Context stores (practiceLog, progress, settings)
├── pages/                # Page-level components
│   └── dev/              # Dev-only pages (fixtures, analytics)
├── shared/               # Shared types (practice, user, auth)
├── api/                  # API client utilities
├── styles/               # Global CSS (dark mode, animations)
├── test/                 # Test setup & utilities
└── utils/                # Helper functions
data/                     # Static JSON datasets (sentences, words, phonemes)
audio/ptbr/               # Generated audio files (male/female voices)
scripts/                  # Build & data generation scripts
e2e/                      # Playwright e2e tests (phase-organized)
```

## Architecture

### Pronunciation Assessment Pipeline

1. Client records audio via MediaRecorder (webm/opus)
2. Server converts to WAV (16kHz, 16-bit, mono) via `src/server/lib/audioConversion.ts`
3. Sent to Azure Speech Service for pronunciation assessment
4. Returns word-by-word scores + phoneme feedback
5. Coaching engine generates next-step suggestions

### Key Hooks

- `useLivePronunciationPractice` - Core recording/assessment lifecycle
- `useMicrophoneRecorder` - Microphone access & recording
- `useAudioPlayer` / `useGlobalAudioPlayer` - Audio playback

### State Management

React Context stores in `src/state/`:
- `practiceLogStore` - Attempt history & session management
- `progressStore` - Progress tracking
- `settingsStore` - User preferences

### Quality Gates

Pre-submission audio quality checks in `src/lib/audioQuality.ts`:
- Minimum recording duration
- Silence detection

## Development Conventions

### Code Organization

- Feature-based component structure under `src/components/`
- Hooks encapsulate business logic; Context for global state
- Tests colocated with source files (`*.test.ts(x)`)

### TypeScript

- Strict mode enabled (`noUnusedLocals`, `noUnusedParameters`)
- Shared types in `src/shared/types/`; feature-specific types near usage
- Avoid loose `any` except for Azure raw response types

### Testing

- **Unit tests**: Core utilities (audioQuality, metricsPercentiles, coaching)
- **Contract tests**: API contract verification (pronunciationAssessment)
- **E2E tests**: User workflows via Playwright with deterministic media mocks
- Run `npm run verify:phase04` to validate changes across unit + e2e

### Error Handling

- Centralized error taxonomy via `ERROR_CLASS` enum
- Graceful fallbacks for missing Azure service
- Telemetry recording for failures via `attemptMetrics.ts`

### Commit Style

```
feat(scope): description
fix(scope): description
chore: description
test: description
docs: description
```

## Environment Setup

Copy `.env.example` to `.env` and set:
- `AZURE_SPEECH_KEY` - Azure Speech Service subscription key
- `AZURE_SPEECH_REGION` - Azure region (e.g., `eastus`, `brazilsouth`)

## Port Configuration

| Service | Port |
|---------|------|
| Vite frontend (dev) | 3000 |
| Express backend | 4000 |
| Vite preview (e2e) | 4173 |

The Vite dev server proxies `/api` requests to the backend on port 4000.
