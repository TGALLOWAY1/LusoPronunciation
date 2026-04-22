# LusoPronounce Trust-Breaking Bug Audit (April 22, 2026)

## 1) System Map

End-to-end path audited for sentence practice:

1. **Sentence source / UI sentence selection**
   - `SentencePractice`/`LivePracticeSection` supplies `sentence.textPt` as the assessment `referenceText` and for UI display.
2. **Audio capture + submission**
   - `useLivePronunciationPractice` records client audio and submits multipart payload to `/api/pronunciation/assessment`.
3. **Server assessment + normalization**
   - `src/server/routes/pronunciationAssessment.ts` converts audio, calls Azure, then maps response via `mapAzurePronunciationResultToAttemptScore`.
4. **Attempt model / word scoring**
   - `src/lib/pronunciationUtils.ts` maps normalized Azure words into `AttemptScore.wordScores`.
5. **UI feedback adaptation**
   - `adaptWordScoresToNormalized` and `extractPhonemesFromAzureResponse` enrich words + phonemes for display.
6. **Rendering / interaction**
   - `PronunciationFeedbackPanel` aligns sentence UI tokens to Azure-style words and routes selected token into `PhonemePanel`.

## 2) Top Trust-Breaking Risks

### Critical

1. **Stale assessment leakage across sentence changes**
   - Cause: `useLivePronunciationPractice` attempts persisted across sentence switches; `LivePracticeSection` only reset recording state.
   - Impact: scores/phonemes from old sentence could appear under new sentence text.

2. **Duplicate-word phoneme extraction ambiguity**
   - Cause: adapter fallback could text-match duplicate tokens (e.g., repeated words), risking wrong phoneme payload for same surface form.
   - Impact: user clicks one word occurrence and sees phonemes from another.

### High

3. **Non-deterministic low-score phoneme tips**
   - Cause: randomized tip selection per render in `mapAzurePhonemeToNormalized`.
   - Impact: same phoneme could show changing guidance across renders, reducing trust.

### Medium

4. **Limited lineage metadata from server mapping**
   - Cause: UI had little explicit mapping metadata from Azure word index/reference token index.
   - Impact: harder to debug misalignment regressions and less reliable downstream matching.

## 3) Reproduction Cases

Recommended matrix cases for manual/dev verification:

- Accented vowels: `Você está ótima hoje.`
- Nasal + tilde: `Pão e limão são bons.`
- Digraphs / symbols: `Trabalho com chuva, carro e coração.`
- Repeated words: `Casa da casa.`
- Punctuation-adjacent: `Olá, tudo bem?`
- Hyphen/apostrophe: `E-mails d'água.`

For each case validate:

- sentence text vs `referenceText`
- token index clicked vs mapped Azure word index
- phoneme panel symbols
- native audio preview locale/voice
- word-level score chip alignment

## 4) Root Causes Found

1. **State-scoping bug:** attempt state not scoped/reset on sentence transitions.
2. **Mapping lineage gap:** phoneme extraction relied on index/text heuristics without preserved Azure index in `WordScore`.
3. **Guidance instability:** randomized coaching text for problem phonemes.

## 5) Code Changes Made

- Added explicit mapping lineage fields in `WordScore`:
  - `azureWordIndex`
  - `referenceTokenIndex`
- Updated Azure mapping to populate those lineage fields and use reference token count guard.
- Updated server route to pass `referenceText` into score mapping.
- Updated phoneme extraction adapter to prefer `azureWordIndex` and removed random tip generation.
- Added `clearAssessmentState()` in `useLivePronunciationPractice` and invoked it on sentence change in `LivePracticeSection`.

## 6) Tests Added

- `src/components/pronunciation/shared/adapters.test.ts`
  - verifies duplicate-word extraction uses `azureWordIndex`
  - verifies low-score tip is deterministic
- `src/lib/pronunciationUtils.test.ts`
  - verifies `azureWordIndex`/`referenceTokenIndex` lineage mapping
- `src/hooks/useLivePronunciationPractice.test.tsx`
  - verifies `clearAssessmentState()` removes stale attempts/raw Azure data

## 7) Remaining Risks

Follow-up work (branch `claude/review-ui-bugs-plan-nxddp`) addressed all three
items below:

1. **Homograph pronunciation nuance** — *Mitigated*. A curated dictionary
   (`data/static/homographs.ptbr.json`, ~20 common BR-PT homographs: `sede`,
   `gosto`, `para`, `almoço`, `jogo`, `colher`, `acordo`, `começo`, `molho`,
   `olho`, `choro`, `forma`, `corte`, `pelo`, `seco`, `toco`, …) is consulted
   in `PhonemePanel` via `src/lib/homographs.ts`; when the selected word is a
   homograph the panel shows an inline note listing the alternate IPA readings
   and makes clear that Azure scored whichever reading matched the audio.
   Underlying Azure phoneme quality for homographs is unchanged — this is a
   UX/expectation fix, not a scoring fix.

2. **Sentence vs per-word audio voice mismatch** — *Mitigated*. A prebuild
   gate (`scripts/verifyAudioConsistency.ts`, wired into `npm run prebuild`)
   fails the build if any entry in `data/audio_index.json` has a URL whose
   voice tag disagrees with its voice key (`ptbr.male` must resolve to a
   `male`-tagged path, etc.). A dev-only runtime warning in
   `PronunciationFeedbackPanel` also logs when sentence and word native URLs
   resolve to different voice families, catching drift during local work.

3. **No explicit trust gate UI** — *Fixed*. `AttemptScore` now carries
   `recognitionStatus`. `src/lib/assessmentTrust.ts` classifies each attempt
   as `trusted` / `degraded` / `untrusted` based on `recognitionStatus`,
   `completenessScore`, and the share of `omitted`/`extra` word errors.
   `PronunciationFeedbackPanel` shows a single status badge above the phoneme
   panel when a result is not trusted; `PhonemePanel` hides phoneme cards and
   Focus Areas entirely when `untrusted`, and shows a softer caveat when
   `degraded`. Thresholds: `completeness < 40` or > 50% omitted → untrusted;
   `completeness < 70` or > 25% omitted → degraded.

## 8) Release Recommendation

**Safe to share.**

Major trust-breaking mapping bugs (stale result leakage + duplicate-word
phoneme ambiguity + randomized guidance) were fixed and regression-tested in
PR #110, and the three documented follow-up risks (homograph expectations,
voice asset consistency, confidence signaling) were addressed on
`claude/review-ui-bugs-plan-nxddp`.
