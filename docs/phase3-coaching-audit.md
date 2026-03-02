# Phase 3 Coaching Data Audit (Read-Only)

Date: 2026-03-02
Branch baseline: `develop` @ `1cff1c7`

## Attempt result source of truth

Primary runtime data comes from `AttemptScore` in [src/types/pronunciation.ts](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/types/pronunciation.ts):

- `overallAccuracy` (number)
- `fluency?` (number)
- `completeness?` (number)
- `prosody?` (number)
- `wordScores: WordScore[]`, where each item has:
  - `word` (string)
  - `accuracy` (number)
  - `errorType?` (`mispronounced` | `omitted` | `extra`)

`LivePracticeSection` obtains:
- `currentAttempt`, `attempts`, `attemptState`, `rawAzureResponse` from [useLivePronunciationPractice.ts](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/hooks/useLivePronunciationPractice.ts)
- normalized words via `adaptWordScoresToNormalized(...)` in [adapters.ts](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/components/pronunciation/shared/adapters.ts)

## Current feedback render path

- Practice flow renders in [LivePracticeSection.tsx](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/components/practice/LivePracticeSection.tsx).
- Result panel rendering is delegated to [PronunciationFeedbackPanel.tsx](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/components/pronunciation/PronunciationFeedbackPanel.tsx).
- Existing hint/callout primitives are regular card blocks and banner/error blocks in practice components (no dedicated coaching card yet).

## What we can reliably use for Phase 3

- Current attempt score summary (`overallAccuracy`, `fluency`, `completeness`).
- Ordered per-word scores from `attempt.wordScores`.
- Prior attempt context from in-memory `attempts` list in `useLivePronunciationPractice` (most recent first).
- Sentence text from `sentence.textPt`.
- Optional phoneme data from normalized words when raw Azure response contains it.
- Local telemetry persistence in localStorage via [attemptMetrics.ts](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/lib/attemptMetrics.ts) and `/dev/metrics` page.

## Missing or weak signals (and graceful degradation)

- No guaranteed stable phoneme-level assessment in `AttemptScore` itself.
- Open/closed vowel distinctions are often absent in plain text or unaccented forms.
- Some attempts may have sparse or missing `wordScores`.

Graceful degrade plan:
- Coaching always falls back to score-level rules if weak-word extraction is unavailable.
- Confusion-tag detection is best-effort; if no tags are detected, no drill card is shown.
- UI still shows one actionable retry/coverage/rhythm cue even without word-level data.
