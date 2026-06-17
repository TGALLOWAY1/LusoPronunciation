# Features

A comprehensive list of what LusoPronounce can do, organized by feature area.

## Pronunciation Assessment

- **Live Recording & Scoring** — Record audio in-browser via MediaRecorder; the server converts webm/opus to WAV (16kHz, 16-bit, mono) with ffmpeg and sends it to Azure Speech Service for pronunciation assessment.
- **Word-by-Word Scores** — Each word in a sentence receives individual accuracy scores. Click any word to expand phoneme-level detail including IPA transcription and error type tags (insertion, omission, mispronunciation).
- **Sentence-Level Metrics** — Overall accuracy, fluency, completeness, and prosody scores returned for every attempt.
- **Audio Quality Gates** — Client-side validation rejects recordings that are too short or silent (minimum duration + RMS energy checks) before sending to the server.
- **Confidence Trust Badge** — When Azure recognition fails or completeness is very low, the feedback panel shows a status message and suppresses phoneme coaching so users don't act on unreliable tips; softer caveat shown for partially-scored attempts.
- **Homograph Awareness** — When a selected word is a known Brazilian Portuguese homograph (e.g. *sede*, *gosto*, *para*), the phoneme panel lists the alternate IPA readings and clarifies that the score reflects whichever reading matched the recording.

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

## Custom Sentence Builder

- **English-to-Portuguese Ingestion** — Type an English sentence; the server translates it to Brazilian Portuguese via Azure AI Translator, synthesizes native TTS audio, and persists the result to the signed-in user's custom sentence list.
- **Per-Word Coverage Indicators** — Preview shows each translated word color-coded by pronunciation data source: green for curated dictionary entries (exact or lemma match), yellow for heuristically-generated pronunciation, red for words with no resolved pronunciation.
- **Sentence Trust Status** — Each custom sentence is tagged `ready`, `partial_support`, or `needs_review` so learners know how much to trust the scoring before practicing.
- **Native Audio Preview** — In-page play/pause control for the generated pt-BR audio before practicing.
- **Dedicated Custom Practice Page** — `/practice/custom/:id` reuses the same Azure Speech pronunciation assessment pipeline as the standard practice flow; attempts land in the user's history as regular sentence attempts.
- **Delete From Practice** — One-click delete on the custom practice page removes the sentence document and its synthesized WAV; attempt history is preserved so learners keep the scores they earned.
- **Per-User Rate Limit** — `POST /api/sentences/custom` is capped at 20 new sentences per hour per user to bound Azure spend on abusive clients; configurable via `CUSTOM_SENTENCE_CREATE_MAX` / `CUSTOM_SENTENCE_CREATE_WINDOW_MS`.

## Lexicon Expansion Pipeline

- **Unknown Word Tracking** — Every custom sentence observation logs the normalized surface form, user, sentence context, and resolution type (generated/unresolved) of any word the resolver could not match against the curated corpus.
- **Automatic 90-Day Purge** — Raw observation rows expire via a MongoDB TTL index 90 days after creation; aggregated stats on `LexiconReviewItem` persist indefinitely.
- **Daily Aggregation** — `npm run lexicon:aggregate` rolls raw observations into a per-surface-form review queue with frequency, unique-user count, and up to three example sentences. Promoted and rejected items are never touched by aggregation.
- **Admin Review UI** — `/admin/lexicon` is an admin-only page that lists pending/promoted/rejected words, shows example sentences, and exposes promote and reject forms inline. Access is gated by `LEXICON_ADMIN_USER_IDS`.
- **Admin Review API** — `/api/admin/lexicon/*` endpoints back the UI and are also available for CLI / scripted workflows.
- **Manual Promotion** — Promotion requires an admin-supplied payload (text, phonemes, pronunciation notes, optional POS/English gloss). Promoted entries are merged into the master word index at runtime, so the pronunciation resolver starts picking them up immediately — no redeploy.

## Spaced Repetition (SRS)

- **SM-2 Flashcard Scheduling** — Server-side flashcard system using the SM-2 algorithm with interval, ease factor, reps, and lapse tracking.
- **Pronunciation Score Linking** — Flashcard review outcomes are tied to pronunciation assessment scores for data-driven scheduling.
- **Due Queue** — API endpoint returns flashcards due for review, ordered by due date.

## Progress & Review

- **Progress Analytics Dashboard** — A sectioned Progress page (Overview, Progress, Strengths, Focus Areas, Recommendations, Learning Resources) answering "Am I improving?" and "What should I practice next?" with a sticky in-page nav.
- **Score Trends** — Multi-metric trend chart (pronunciation, accuracy, fluency, completeness) with selectable 7-day / 30-day / 90-day / all-time windows.
- **Improvement Tracking** — "Most Improved" and "Needs More Practice" lists for words, phrases, and phonemes, comparing earlier attempts to recent ones (e.g. `pão 72 → 91`), with a noise guard that requires several attempts.
- **Weakness Detection** — Hardest sounds, frequently mispronounced words, and most-retried phrases surfaced from stored assessment data.
- **Personalized Insights** — Deterministic, data-grounded insights (e.g. nasal vowels below your average, better on short than long phrases, scores improving with repetition).
- **Practice Recommendations** — Recommended sounds, words, and phrases grounded in real content and your own weaknesses, each linking to the relevant practice surface.
- **Learning Resources** — Click any difficult sound or word to open pronunciation tutorials; resource links are generated dynamically (YouTube search + Forvo) with no manual video curation or API key required.
- **Review Page** — Tabbed interface with a Review Queue (SRS-driven items) and Recent Attempts timeline. Queue shows progress bar and item-by-item navigation with difficulty rating. Attempts list shows scores with "Practice again" links.
- **Review Queue Algorithm** — Score-weighted review queue (`buildReviewQueue`) ranks items by `(1 - bestScore/100) * recencyWeight`, filtering items below a configurable threshold (default 80).
- **Completion Moments** — Animated confirmation when the review queue is cleared, linking back to practice.
- **Momentum Strip** — Compact header strip on the Practice page showing current streak, today's attempt count vs daily target, and review-due badge.

## Session Tracking

- **Automatic Sessions** — Practice sessions are auto-started and auto-ended with duration calculation and attempt logging.
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

- **Practice-First Navigation** — Four-item navigation (Practice, Review, Progress, Settings). Practice is the default landing page with Sentences/Words tabs.
- **Responsive Layout** — Sidebar navigation on desktop, top navigation bar on mobile.
- **Dark Mode** — Full dark theme support via Tailwind CSS.
- **Keyboard Navigation** — Arrow keys navigate between sentences and words in practice views.
- **Voice Preference** — Toggle between male and female native audio voices; persisted in Settings page.
- **Resume Practice** — Header button to resume practice from any non-practice page, remembering last practice mode.
- **Category & Difficulty Filters** — Multi-select filter chips on practice pages for narrowing content.
- **Shared Layout Primitives** — PageScaffold, MetricTile, ActionPanel, and ChartContainer components for consistent page structure.
- **Error Handling** — React ErrorBoundary at the app root, centralized error taxonomy (`ERROR_CLASS` enum), and safe error payloads in API responses.
- **Local Storage Management** — Audio cache capped at 1.5 MB with graceful handling when storage is full.

## Infrastructure

- **Testing** — Vitest for unit and contract tests, Playwright for end-to-end browser tests, organized by project phase.
- **CI/CD** — GitHub Actions pipeline runs on push/PR to `main` and `develop`: install, build, unit tests, and Playwright e2e.
- **Deployment** — Railway-targeted with static SPA serving and aggressive caching.
- **Database** — MongoDB via Mongoose with singleton connection, retry logic, and connection health reporting.
- **Fail-fast Startup** — Production boots refuse to bind the port when required environment variables or the MongoDB connection are missing, so the app never appears "up" with broken core flows.
- **Readiness Probe** — `/api/health` reports MongoDB and Azure Speech configuration state alongside liveness, making deploy issues observable without calling Azure.
- **Configurable API Origin** — `VITE_API_BASE_URL` and `CSP_CONNECT_SRC` let the SPA target a separate backend origin when needed; default same-origin deploys remain zero-config.
