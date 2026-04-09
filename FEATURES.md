# Features

A comprehensive list of what LusoPronounce can do, organized by feature area.

## Pronunciation Assessment

- **Live Recording & Scoring** — Record audio in-browser via MediaRecorder; the server converts webm/opus to WAV (16kHz, 16-bit, mono) with ffmpeg and sends it to Azure Speech Service for pronunciation assessment.
- **Word-by-Word Scores** — Each word in a sentence receives individual accuracy scores. Click any word to expand phoneme-level detail including IPA transcription and error type tags (insertion, omission, mispronunciation).
- **Sentence-Level Metrics** — Overall accuracy, fluency, completeness, and prosody scores returned for every attempt.
- **Audio Quality Gates** — Client-side validation rejects recordings that are too short or silent (minimum duration + RMS energy checks) before sending to the server.

## Coaching & Feedback

- **Coaching Engine** — Analyzes scores after each attempt and generates actionable suggestions: retry weak words, improve rhythm, increase coverage, or sharpen clarity.
- **Confusion Detection** — Identifies Brazilian Portuguese sound confusions the learner struggles with (e.g., nasalization, r/rr, open/close vowels, tch/ti) and prioritizes targeted feedback.
- **Minimal Pair Drills** — Pre-built Brazilian Portuguese minimal pairs for common sound confusions, surfaced as coaching suggestions when relevant confusion patterns are detected.

## Sentence Practice

- **Sentence Browser** — Browse sentences filtered by category and difficulty level, with keyboard arrow-key navigation between sentences.
- **Native Audio Playback** — Listen to pre-generated male or female Brazilian Portuguese audio for each sentence, with a slowed playback option.
- **Attempt History & Trends** — View all past attempts for a sentence with score trend sparklines, recording playback, and detailed word-by-word breakdowns.

## Word Practice

- **Multiple Practice Modes** — Pronunciation recording, text multiple-choice (PT-to-EN, EN-to-PT, mixed directions), listening multiple-choice, and self-rating (Know It / Review Later).
- **Multiple View Modes** — List/glossary view (card grid for browsing), drill view (single-card focus for active practice), and weak words focus (filters to bottom 50 words by score).
- **Word Phoneme Panel** — Displays phoneme breakdown with IPA symbols and pronunciation tips from the phoneme metadata dataset.

## Spaced Repetition (SRS)

- **SM-2 Flashcard Scheduling** — Server-side flashcard system using the SM-2 algorithm with interval, ease factor, reps, and lapse tracking.
- **Pronunciation Score Linking** — Flashcard review outcomes are tied to pronunciation assessment scores for data-driven scheduling.
- **Due Queue** — API endpoint returns flashcards due for review, ordered by due date.

## Dashboard & Analytics

- **Today's Summary** — Daily metrics including practice count, daily streak, and sentence/word coverage.
- **7-Day Performance Charts** — Rolling charts for overall score, accuracy, and fluency trends over the past week.
- **Difficulty Analysis** — Bar chart and scatter plot showing performance broken down by content difficulty level.
- **Category Breakdown** — Table view of progress across content categories.
- **Weak Phonemes** — Highlights phonemes that need the most practice based on recent scores.
- **Items Needing Review** — Surfaces sentences and words that are due for re-practice.

## Session Tracking

- **Automatic Sessions** — Practice sessions are auto-started and auto-ended with duration calculation and attempt logging.
- **Recent Sessions View** — Dedicated page listing past sessions grouped by date with summary stats.
- **Dual-Write Persistence** — Sessions are written to both localStorage (offline resilience) and the MongoDB backend.

## Authentication & Security

- **Email + OAuth Login** — Email/password registration and login, plus GitHub OAuth and LinkedIn OAuth. Dev-only quick-login for local development.
- **JWT Authentication** — 7-day token expiry with `requireAuth` middleware protecting all practice and data endpoints.
- **Invite Code Gating** — Optional invite-code requirement for registration with configurable usage limits and expiration.
- **Security Middleware** — CORS with configurable origin allowlist, per-user rate limiting on pronunciation endpoints, and Helmet CSP headers.

## Content & Data Pipeline

- **Static Datasets** — Master sentences, master words, phoneme metadata, and audio index stored as JSON in `data/`.
- **Audio Generation** — Azure TTS pipeline generates male and female Brazilian Portuguese voice recordings for all content items.
- **Content Generation Pipeline** — Scripts for enrichment, audio generation, indexing, and validation (`npm run generation:pipeline`).
- **Data Migration** — Server endpoint for migrating legacy practice data from older formats.

## UI & Accessibility

- **Responsive Layout** — Sidebar navigation on desktop, top navigation bar on mobile.
- **Dark Mode** — Full dark theme support via Tailwind CSS.
- **Keyboard Navigation** — Arrow keys navigate between sentences and words in practice views.
- **Voice Preference** — Toggle between male and female native audio voices; preference is persisted.
- **Category & Difficulty Filters** — Multi-select filter chips on practice pages for narrowing content.
- **Error Handling** — React ErrorBoundary at the app root, centralized error taxonomy (`ERROR_CLASS` enum), and safe error payloads in API responses.
- **Local Storage Management** — Audio cache capped at 1.5 MB with graceful handling when storage is full.

## Infrastructure

- **Testing** — Vitest for unit and contract tests, Playwright for end-to-end browser tests, organized by project phase.
- **CI/CD** — GitHub Actions pipeline runs on push/PR to `main` and `develop`: install, build, unit tests, and Playwright e2e.
- **Deployment** — Railway-targeted with static SPA serving and aggressive caching.
- **Database** — MongoDB via Mongoose with singleton connection, retry logic, and connection health reporting.
