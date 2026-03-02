# Coaching And Drills (Phase 3)

## Overview

Phase 3 adds a deterministic coaching layer on top of attempt scoring so every scored attempt produces one clear next action.

Implementation files:
- [coachingEngine.ts](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/lib/coaching/coachingEngine.ts)
- [confusionDetection.ts](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/lib/coaching/confusionDetection.ts)
- [minimalPairs.ptbr.ts](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/lib/coaching/minimalPairs.ptbr.ts)
- [NextStepCoachingCard.tsx](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/components/practice/NextStepCoachingCard.tsx)
- [LivePracticeSection.tsx](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/components/practice/LivePracticeSection.tsx)

## Deterministic coaching engine

`buildCoachingSuggestion(attempt, context)` returns exactly one suggestion card with:
- `kind`
- short `message`
- one `ctaLabel`
- optional weak-word `targets`
- optional drill payload

Rule order is deterministic:
1. Low `completeness` -> `coverage`
2. Low `fluency` -> `rhythm`
3. Low pronunciation / weak words -> `clarity`
4. Otherwise -> `retry`

If a previous attempt is available, the message can include confidence framing (improved word count).

## Confusion tag detection (best effort)

`detectConfusionTags(attempt, sentenceText?)` infers likely confusion classes from weak words first, then sentence text fallback.

Current heuristics include:
- `lh` / `nh` -> `lh_nh`
- `rr` and initial `r` -> `r_rr`, `r_initial`
- nasal spellings (`ão`, `ãe`, `em`, `en`, etc.) -> `nasalization`
- `ti` / `di` before vowels -> `tch_ti`, `dji_di`
- final `l` -> `final_l_u`
- additional consonant voicing and `s_z` tags

Detection is non-blocking by design. If tags are not found, the UI still shows score-level coaching without drill content.

## Minimal pairs dataset

`minimalPairs.ptbr.ts` contains a curated, tag-based PT-BR pair list (`PTBR_MINIMAL_PAIRS`) and selectors (`pickMinimalPairsByTags`).

Expansion guidelines:
1. Add new pairs with one or more `tags`.
2. Keep words common and pronounceable in isolation.
3. Add short `note` cues only when useful.
4. Keep UI usage capped at 2-3 pairs per drill reveal (`pickMinimalPairsByTags(..., 3)`).

## UI behavior

After a scored attempt, `LivePracticeSection` renders exactly one Next Step card.

- If suggestion kind is non-drill (`coverage`, `rhythm`, `clarity`, `retry`):
  - CTA triggers retry flow.
- If tag detection and pair selection qualify:
  - suggestion upgrades to `minimal_pairs`
  - CTA becomes `Start drill`
  - drill reveals 2-3 minimal pairs and keeps `Retry sentence` available.

## Coaching telemetry and privacy

Local coaching telemetry is stored in `localStorage` via:
- [coachingTelemetry.ts](/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/src/lib/coaching/coachingTelemetry.ts)

Tracked events:
- `coaching_shown`
- `coaching_cta_clicked`
- `minimal_pairs_opened`

Telemetry payload intentionally excludes speech content:
- no audio blobs
- no reference sentence text
- no transcript text

Only event name, coaching kind, optional confusion tags, and timestamp are persisted.
