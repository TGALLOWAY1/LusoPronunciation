# Progress Analytics Pipeline

LusoPronunciation uses Azure Speech Pronunciation Assessment to evaluate pronunciation
accuracy, fluency, completeness, and phoneme-level performance. Historical assessment
data is analyzed to identify weaknesses, track improvement, and generate personalized
practice recommendations and learning resources. This document describes how that
pipeline works end to end.

## Speech assessment pipeline

1. **Microphone recording** — The client records audio via `MediaRecorder`
   (`useMicrophoneRecorder`, driven by `useLivePronunciationPractice`). Audio-quality
   gates (`src/lib/audioQuality.ts`) reject clips that are too short or silent.
2. **Audio processing** — The server converts WebM/Opus to 16 kHz / 16-bit mono WAV
   (`src/server/lib/audioConversion.ts`, ffmpeg-static).
3. **Azure Pronunciation Assessment** — The WAV is sent to Azure with
   `Granularity: Word` and `Dimension: Comprehensive`
   (`src/server/routes/pronunciationAssessment.ts`). Azure returns phrase-, word-, and
   phoneme-level scores.
4. **Scoring & normalization** — Responses are normalized
   (`src/lib/azurePronunciationNormalizer.ts`) and mapped to internal scores
   (`src/lib/pronunciationUtils.ts`).
5. **Persistence** — Each attempt is stored with phrase scores (overall / accuracy /
   fluency / completeness / optional prosody), `wordScores[]` (with `errorType`), and
   `phonemeScores[{phonemeId, overallScore}]`, plus `createdAt`, `retriesInThisSession`,
   and content references. Storage is dual-write: `localStorage` (offline source of
   truth) via `practiceLogStore`, and MongoDB (`PronunciationAttemptModel`).
6. **Analytics generation** — All analytics are computed **client-side** from the
   practice log by the pure functions in `src/lib/practiceAnalytics.ts`. No additional
   backend aggregation is required because the full per-attempt history (including
   phoneme scores) is already available to the client.
7. **Recommendation & resource generation** — Weaknesses are mapped to existing content
   and to learning resources (see below).

## Analytics features

All computation lives in `src/lib/practiceAnalytics.ts` (pure, unit-tested) and is
rendered by the section components under `src/components/analytics/`. The Progress page
(`src/pages/ProgressPage.tsx`) owns the data computations and passes results to
presentational sections.

### Score tracking

- `filterByWindow(items, window, now?)` filters any timestamped list to a 7d / 30d / 90d
  window (inclusive cutoff) or passes everything through for `all`.
- `buildMultiMetricTrend(...)` buckets attempts over the window (daily for short windows,
  weekly/monthly for longer ones) and collects raw scores per metric. The chart
  (`MultiMetricTrendChart`) averages each bucket and plots only buckets that contain data,
  so no-practice gaps collapse rather than dipping the line to zero.

### Improvement tracking

- `computeImprovement(...)` groups attempts by word, sentence, and phoneme, sorts each
  group chronologically, and compares the **earlier half** of attempts to the **recent
  half** (`delta = recentAvg - earlyAvg`).
- **Noise guard:** an item must have at least `minAttempts` attempts (default 4) — and
  optionally span `minSpanDays` days — to appear in either list. This prevents one or two
  lucky attempts from dominating "Most Improved".
- "Most Improved" = positive delta above a small threshold, sorted descending. "Needs More
  Practice" = low recent average or a non-positive delta.

### Weakness detection

- `computePhonemeStats(...)` aggregates per-phoneme scores and labels each weak / ok /
  strong. The dashboard surfaces the weakest sounds, the most frequently mispronounced
  words (from sentence `wordScores` with `errorType: mispronounced` or low scores), and the
  most-retried phrases (`retriesInThisSession` plus repeated attempts).

### Personalized recommendations

- `generateInsights(...)` runs a **fixed, ordered set of rules**, each guarded by a
  minimum-sample check, so output is fully deterministic for a given input (no randomness;
  `now` is injectable). Rules cover phoneme-category vs. personal average, short vs. long
  phrases, improvement-with-repetition, the easy-vs-hard difficulty gradient, and
  window momentum. Deterministic analytics are preferred over LLM-generated text.
- `buildRecommendations(...)` ranks weak phonemes, weak words, and low-scoring phrases,
  and maps them to **real content** (`loadAllWords` / `loadAllSentences`), so every
  recommendation points to an item that exists and links to the right practice surface.

### Learning resource integration

- `src/lib/learningResources.ts` resolves a phoneme or word to pronunciation tutorials.
  It always generates a deterministic YouTube **search** URL (and a Forvo link for words),
  so every difficult sound/word has a working "learn more" link with **no manual video
  curation and no API key**. A small optional `CURATED_*` override map pins durable
  reference pages (e.g. Wikipedia's Portuguese phonology) for the hardest sounds; because
  it links to reference pages rather than specific videos, it does not rot.

#### Why this approach

We evaluated three options for tutorial videos:

- **A — Dynamic search URLs (chosen):** zero maintenance, no API key, always relevant,
  fully deterministic and testable. Trade-off: links to a results page, not a single
  vetted video.
- **B — Curated database:** highest quality control, but requires ongoing manual curation
  and links rot over time. Retained only as the tiny optional override map.
- **C — AI-generated recommendations:** non-deterministic, adds latency/cost and an
  external dependency; conflicts with the "prefer deterministic analytics" goal.

## Resume / portfolio summary

> LusoPronunciation uses Azure Speech Pronunciation Assessment to evaluate pronunciation
> accuracy, fluency, completeness, and phoneme-level performance. Historical assessment
> data is analyzed to identify weaknesses, track improvement over time, and generate
> personalized, deterministic practice recommendations and learning resources —
> demonstrating an end-to-end speech-AI analytics and human-in-the-loop feedback system.

## Testing

Pure analytics and resource functions are unit-tested (Vitest):

- `src/lib/practiceAnalytics.test.ts` — window filtering boundaries, trend bucketing and
  optional-metric handling, improvement thresholds / early-recent split / topN caps,
  insight determinism, and recommendation grounding.
- `src/lib/learningResources.test.ts` — curated-then-generated ordering, fallback for
  unknown phonemes, and URL escaping.
