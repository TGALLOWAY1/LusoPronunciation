# Feat 16 – Full Content Generation Pipeline Plan

_Last updated: 2025-11-22_

This document is the single source of truth for executing the full content generation pipeline and migrating LusoPronounce from legacy/dummy datasets to pipeline-derived canonical content. It captures the current architecture, data contracts, operational commands, migration strategy, and risks for Feat 16.

---

## 1. Current Architecture Snapshot

### 1.1 Pipeline module map

| Module | Responsibility | Key Entry Points / Notes |
| --- | --- | --- |
| `config/generationPipeline.config.ts` | Central configuration for voices, filesystem paths, record limits. | Referenced by every pipeline stage. Paths currently point to `STATIC DATA/words.json`, `data/sentences.json`, `data/master*.json`, `public/audio`, `data/audio_index.json`, `data/test_data`. |
| `src/types/contentGeneration.ts` | Defines raw/enriched/master word & sentence types, TTS job shape, audio index entry, validation report. | Used across all pipeline stages; note that `Master*` types retain translations but `Enriched*` types currently drop English text. |
| `src/pipeline/loadSourceLists.ts` | Loads and flattens word & sentence JSON sources, dedupes by normalized PT text. | `loadRawWords`, `loadRawSentences`. Expects category-wrapped schemas matching `STATIC DATA/words.json` and `data/sentences.json`. |
| `src/pipeline/phonemeMapper.ts` | Minimal grapheme-to-phoneme (G2P) mapper using simple rules. | `getPhonemesForToken`, `mapWordToPhonemes`. Maps Portuguese graphemes to phoneme IDs verified against `phoneme_metadata.json`. Returns `phonemes: string[]` array. |
| `src/pipeline/tagging.ts` | Applies CEFR inference, difficulty scores, tags for words and sentences. | `applyWordTags`, `applySentenceTags`, `inferCategory`. |
| `src/pipeline/sentenceWordRefs.ts` | Links enriched sentences to words via normalized token matching. | `computeSentenceWordRefs`, `buildWordRefs`. Drives `wordRefs` metadata for UI word-by-word panels. |
| `src/pipeline/enrichItems.ts` | Orchestrates enrichment: normalize text, apply phonemes/tags, compute word refs. | `enrichWords`, `enrichSentences`. Currently drops English translations and raw difficulty numbers. |
| `src/pipeline/writeCanonicalDatasets.ts` | Writes enriched arrays to canonical JSON (`data/masterWords.json`, `data/masterSentences.json`). | `writeMasterWords`, `writeMasterSentences`. |
| `src/pipeline/audioJobPlanner.ts` | Plans TTS jobs for every word/sentence per configured voice. | `planTTSJobs` → outputs job objects referencing `public/audio/words/<voiceId>/<id>.wav` or `public/audio/sentences/<voiceId>/<id>.wav`. |
| `src/pipeline/azureTTSClient.ts` | Shared Azure Speech SDK wrapper w/ retry/backoff, idempotent file writes. | `textToSpeechToFile`. Requires `AZURE_SPEECH_KEY` & `AZURE_SPEECH_REGION`. |
| `src/pipeline/runTTSJobs.ts` | Executes queued TTS jobs with concurrency limits (default 4). | `runTTSJobs`. Skips existing files; safe to resume partial runs. |
| `src/pipeline/buildAudioIndex.ts` | Produces `AudioIndexEntryExtended[]` + writes `data/audio_index.json`. | `buildAudioIndex`, `writeAudioIndex`. Currently maps new file layout back to legacy `/audio/ptbr/{gender}/{id}.wav` paths for compatibility. |
| `src/pipeline/azurePronunciationClient.ts` | REST client for Azure Pronunciation Assessment. | `assessPronunciation`, `assessAudio`. Reuses Azure env vars. |
| `src/pipeline/generateAssessmentFixtures.ts` | Builds sentence/word fixture WAV + raw JSON responses under `data/test_data`. | `generatePronunciationFixtures`. Uses first configured voice. |
| `src/pipeline/validateGeneratedData.ts` | Validates enriched data vs audio index; outputs `ValidationReport`, logs summary, can assert. | `validateGeneratedData`, `logValidationReport`, `assertValidOrThrow`, `writeValidationReport`. |
| `src/pipeline/devHarness.ts` | Mini end-to-end (load → enrich → write) for local smoke tests. | `runDevHarness()`. |
| `scripts/generationPipeline.ts` | CLI orchestrator for all stages (`--stage` flag). Script behind `npm run generation:pipeline`. | Handles stage gating, dry-run, loads .env. |

### 1.2 Data sources & datasets in play

| Dataset | Path(s) | Producer | Consumer(s) | Notes / Shape |
| --- | --- | --- | --- | --- |
| Legacy words | `STATIC DATA/words.json` | Curated JSON (manual) | `loadSourceLists`, front-end fallback (`loadAllWords`) | Category → words arrays with `pt`, `en`, `pos`, `difficulty`, `difficult_for_english`, `pronunciation_notes`. |
| Legacy sentences | `data/sentences.json` | Earlier manual dataset | `loadSourceLists`, `scripts/generate_audio.js`, front-end fallback (`loadAllSentences`) | Category → sentences arrays with `pt`, `en`, `difficulty`, `pronunciation_notes`. Includes 10 categories. |
| Master words | `data/masterWords.json` | Pipeline write target | Front-end preferred source (`loadAllWords`) | Currently empty array; once filled must include enriched info **and** translations. |
| Master sentences | `data/masterSentences.json` | Pipeline write target | Front-end preferred source (`loadAllSentences`) | Currently empty array. Needs translations + category metadata for UI. |
| Audio index | `data/audio_index.json` | Pipeline builder (`buildAudioIndex`) | `src/lib/audio.ts`, `src/utils/audioRouting.ts` | **Canonical scheme**: Each entry includes `voices` field mapping `voiceId` → canonical URL (`/audio/sentences/{voiceId}/{id}.wav` or `/audio/words/{voiceId}/{id}.wav`). Legacy `ptbr.male/female` paths retained for backward compatibility. |
| Sentence audio WAVs | `public/audio/sentences/{voiceId}/{id}.wav` | Pipeline TTS (`runTTSJobs`) | UI playback via canonical URLs | **Canonical path**: `/audio/sentences/ptbr_male/{id}.wav` or `/audio/sentences/ptbr_female/{id}.wav`. Legacy paths (`audio/ptbr/male|female/`) deprecated but still supported. |
| Word audio WAVs | `public/audio/words/{voiceId}/{id}.wav` | Pipeline TTS (`runTTSJobs`) | UI playback via canonical URLs | **Canonical path**: `/audio/words/ptbr_male/{id}.wav` or `/audio/words/ptbr_female/{id}.wav`. Legacy inferred paths (`/audio/words/{wordId}_{gender}.wav`) deprecated but still supported. |
| Phoneme metadata | `data/phoneme_metadata.json` | Manual (canonical) | `src/lib/phonemeMetadata.ts`, validator, UI components | **Canonical runtime metadata source.** Contains rich phoneme information (IPA, articulation, teaching tips, minimal pairs, example words). Old metadata moved to `data/deprecated/` for comparison only. |
| Pronunciation fixtures | `data/test_data/*` | `generatePronunciationFixtures` | Dev harness pages, QA | Contains WAV + raw Azure JSON (e.g., `phrase_1_JSON.json`). |
| Gemini sentence CSV | `Genearte Sentences.py` → `brazilian_portuguese_custom_legacy.csv` (root) | New Python script calling Gemini | Should become upstream feed for `loadSourceLists` | Currently outputs CSV with header `Portuguese;English` per category (50 sentences each). No IDs, difficulties, or categories embedded per row; category implied by batch. |

### 1.3 App data loading today

- `src/lib/data.ts` is the gateway for UI content (`loadAllSentences`, `loadAllWords`, `loadAllCategories`). It:
  - Prefers `/data/masterSentences.json` and `/data/masterWords.json`.
  - Falls back to `/data/sentences.json` then `/STATIC DATA/sentences.json` (sentences) or `/STATIC DATA/words.json` (words) when masters are empty/missing.
  - Ultimately falls back to `sampleData` if all sources fail.
  - When reading master files it fabricates category labels by fetching the legacy `sentences.json`, and because enriched sentences exclude translations, UI shows blank English text if we ever switch to master data without augmenting schema.
- Audio resolution lives in `src/lib/audio.ts` + `src/utils/audioRouting.ts`, which:
  - Fetch `/data/audio_index.json` and prioritize canonical `voices` field URLs (new format).
  - Fall back to legacy `ptbr.male/female` paths if canonical URLs not found.
  - Final fallback to inferred canonical paths (`/audio/sentences/{voiceId}/{id}.wav` or `/audio/words/{voiceId}/{id}.wav`).
  - Legacy inferred paths (`/audio/words/{wordId}_{gender}.wav`) supported as last resort.
- Multiple pages rely on the above loaders (`src/pages/UserDashboardPage.tsx`, `src/pages/SentencePractice.tsx`, `src/pages/Review.tsx`, `src/pages/dev/pronunciation-fixtures.tsx`, etc.), so switching datasets affects the entire app simultaneously.

### 1.4 Phoneme metadata (canonical source)

- **`data/phoneme_metadata.json`** is the authoritative phoneme metadata file for the runtime (UI + pipeline).
- The file contains an array of phoneme objects with rich metadata:
  - `id` (ARPABET symbol, e.g., "AA", "AH", "EY")
  - `ipa` (IPA symbol)
  - `type`, `category`, `difficulty`
  - `englishApprox`, `articulation`, `acousticDescription`
  - `commonMistakes`, `teachingTips`
  - `minimalPairs`, `exampleWords`
- **Loader**: `src/lib/phonemeMetadata.ts` provides:
  - `getPhonemeById(id: string): PhonemeMeta | undefined` - Primary lookup function
  - `getAllPhonemes(): PhonemeMeta[]` - Get all entries
  - `getPhonemeMetadata(symbol: string)` - Deprecated, kept for backward compatibility
- **Validation integration**: `src/pipeline/validateGeneratedData.ts` uses `getPhonemeById()` to check if phoneme IDs in enriched words exist in the metadata. Currently non-blocking (warnings only); strict validation will be enabled in future pipeline runs.
- **Old metadata**: Previous phoneme metadata files have been moved to `data/deprecated/` and should NOT be used unless explicitly referenced for comparison.

---

## 2. Pipeline stage breakdown

```
[Stage 0: Gemini Sentence Generation]
    ↓ Python script → data/raw/gemini_sentences.csv
    ↓ TypeScript normalizer → data/sentences.json
[loadSourceLists.ts]
    ↓ RawWord[] / RawSentence[]
[phonemeMapper.ts] + [tagging.ts]
    ↓ EnrichedWord[] (w/ tags, difficulty, phoneme placeholders)
[sentenceWordRefs.ts]
    ↓ EnrichedSentence[] (w/ wordRefs)
[enrichItems.ts]
    ↓ Combined enriched arrays
[writeCanonicalDatasets.ts]
    ↓ data/masterWords.json, data/masterSentences.json
[audioJobPlanner.ts] → [runTTSJobs.ts] via [azureTTSClient.ts]
    ↓ public/audio/(words|sentences)/<voice>/<id>.wav + audio debug logs
[buildAudioIndex.ts] → [writeAudioIndex.ts]
    ↓ data/audio_index.json (legacy-compatible paths)
[azurePronunciationClient.ts] → [generateAssessmentFixtures.ts]
    ↓ data/test_data/phrase_*.json + Phrase *.wav + pronunciation_fixtures.json
[validateGeneratedData.ts]
    ↓ Validation report + optional data/generated/generation_report.md
```

Detailed per-stage view:

| Stage | Entry Points | Inputs | Outputs | Config / Env | Gaps / Notes |
| --- | --- | --- | --- | --- | --- |
| **Stage 0: Gemini Generation** | `scripts/generateGeminiSentences.py` | None (generates from Gemini API) | `data/raw/gemini_sentences.csv` | `GEMINI_API_KEY` env var, `--output` CLI arg | Generates 50 sentences per category (10 categories = 500 sentences). CSV format: `"Portuguese";"English"`. |
| **Stage 0: Normalization** | `scripts/normalizeGeminiSentences.ts` | `data/raw/gemini_sentences.csv` | `data/sentences.json` | None | Converts CSV to `SentencesData` schema. Creates stable IDs (`gemini_<category>_<index>`), infers difficulty (1-5), maps categories. |
| Source loading | `loadRawWords`, `loadRawSentences` | JSON matching `WordsData` / `SentencesData` | Arrays of `RawWord` / `RawSentence` (deduped, limited) | Uses `config.paths.rawWordsJsonPath`, `rawSentencesJsonPath`, `config.limits.*` | Now reads from `data/sentences.json` (normalized Gemini output). |
| Enrichment | `enrichWords`, `enrichSentences` | Raw arrays, config | `EnrichedWord[]`, `EnrichedSentence[]` | `GenerationPipelineConfig` (for future features) | Drops English translations + raw difficulty numbers, so master files would lose crucial UI text. |
| Phoneme/tagging helpers | `phonemeMapper`, `tagging`, `sentenceWordRefs` | Strings / enriched arrays | Adds `phonemes`, `ipa`, `tags`, `wordRefs`, CEFR, difficulty scores | `phoneme_metadata.json` (via `getPhonemeById`) | **G2P mapper implemented**: Simple rule-based mapping (consonants, vowels, nasalization). All phoneme IDs verified against metadata. Unknown cases return empty array with TODO comments. |
| Canonical writers | `writeMasterWords`, `writeMasterSentences` | Enriched arrays | Pretty-printed JSON at configured paths | Filesystem access | No schema validation; currently writes empty `[]` because pipeline hasn’t executed fully. |
| Audio planning | `planTTSJobs` | Enriched arrays, voices | `TTSJob[]` referencing canonical paths | `config.voices`, `config.paths.audioBaseDir` | **Canonical scheme**: `public/audio/words/{voiceId}/{id}.wav` and `public/audio/sentences/{voiceId}/{id}.wav`. Voice IDs: `ptbr_male`, `ptbr_female`. |
| TTS execution | `runTTSJobs` → `textToSpeechToFile` | TTS jobs | WAV assets under canonical paths | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, optional concurrency override | 4 concurrent syntheses by default; ensure Azure quota allows (cost/time). Files written to canonical paths. |
| Audio index build | `buildAudioIndex`, `writeAudioIndex` | Enriched arrays + config | `AudioIndexEntryExtended[]`, `data/audio_index.json` | Filesystem | **Unified scheme**: Each entry includes `voices` field with canonical URLs (`/audio/sentences/{voiceId}/{id}.wav` or `/audio/words/{voiceId}/{id}.wav`). Legacy `ptbr.male/female` paths retained for backward compatibility. |
| Assessment fixtures | `generatePronunciationFixtures` → `azurePronunciationClient` | Enriched arrays, config | WAV + JSON fixtures under `config.paths.testDataBaseDir` | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Expensive; limit default (10). CLI currently always runs when stage=all. |
| Validation | `validateGeneratedData`, `logValidationReport`, `assertValidOrThrow`, `writeValidationReport` | Enriched arrays + audio index | `ValidationReport`, optional markdown under `data/generated/generation_report.md` | `phoneme_metadata.json` (via `getPhonemeById`) | Validates phoneme IDs against metadata (warnings only, non-blocking). Checks for missing audio entries, invalid word refs. |
| Dev harness | `runDevHarness` | Config | Writes master files only | None beyond config | Great for quick smoke tests after hooking new data sources. |
| Orchestrator | `scripts/generationPipeline.ts` | CLI flags, .env | Runs selected stage(s) sequentially | `AZURE_*`, `config.*` | `npm run generation:pipeline -- --stage=<stage>` toggles; `--dry-run` avoids file writes. |

---

## 3. Stage 0 – Gemini sentence generation plan

**Current script**: `Genearte Sentences.py` (root) uses `google-generativeai` legacy SDK to produce 50 sentences per category, outputting a CSV named `brazilian_portuguese_custom_legacy.csv`. Issues:

- API key is hard-coded as `API_KEY = "YOUR_GEMINI_API_KEY"`; should read from env (`GEMINI_API_KEY`) or `.env.gemini`.
**Stage 0 Implementation** (✅ **COMPLETE**):

Stage 0 consists of two steps that generate and normalize sentences from Gemini:

1. **Gemini Sentence Generation** (`scripts/generateGeminiSentences.py`):
   - Generates 50 sentences per category (10 categories = 500 sentences total)
   - Outputs CSV format: `"Portuguese Sentence";"English Translation"`
   - Requires `GEMINI_API_KEY` environment variable
   - Command: `npm run generate:gemini:sentences`
   - Output: `data/raw/gemini_sentences.csv`

2. **Normalization** (`scripts/normalizeGeminiSentences.ts`):
   - Reads Gemini CSV output
   - Creates stable IDs: `gemini_<category>_<index>` (e.g., `gemini_food_001`)
   - Maps category names to category IDs with labels
   - Infers difficulty (1-5) based on sentence length and complexity
   - Outputs `data/sentences.json` in `SentencesData` schema
   - Command: `npm run generate:normalize:sentences`
   - Output: `data/sentences.json` (ready for pipeline Stage 1)

**Combined Stage 0 Command**:
```bash
npm run generate:sentences:stage0
```
This runs both steps sequentially.

**Configuration**:
- `config/generationPipeline.config.ts` already points `rawSentencesJsonPath` to `"data/sentences.json"`
- Stage 0 output becomes the input for Stage 1 (`loadSourceLists.ts`)

**Category Mapping**:
The normalizer maps Gemini category names to app category IDs:
- "Food & Eating" → `food` (Food & Eating / Comida e Refeições)
- "Travel" → `travel` (Travel / Viagem)
- "Family & Friends" → `family_friends` (Family & Friends / Família e Amigos)
- ... (see `scripts/normalizeGeminiSentences.ts` for full mapping)

**Note**: Gemini-generated sentences do not include `pronunciation_notes` - this field will be `undefined` in the normalized output. The pipeline can add pronunciation notes later via enrichment if needed.

---

## 4. End-to-End pipeline run

### 4.1 Prerequisites checklist

| Requirement | Purpose | Notes |
| --- | --- | --- |
| Node.js ≥ 20 + npm | Run TS pipeline via `tsx` | Align with repo’s existing toolchain (`vite`, `tsx`). |
| Python 3.10+ + `google-generativeai` | Gemini script | Install in virtualenv; keep API key in env var or `.env.gemini`. |
| Azure credentials | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Used by TTS + pronunciation assessment; export prior to running. |
| Optional: `AZURE_SPEECH_ENDPOINT` | If using custom endpoint for assessment | Not currently referenced but may become necessary. |
| GEMINI_API_KEY | Gemini Stage 0 | Should not be committed; use `.env.local` or shell export. |
| Filesystem | Write access to `data/`, `public/audio/`, `audio/`, `data/test_data/` | Ensure repo has enough disk space (audio can be large). |
| Optional: `ffmpeg` / `ffmpeg-static` | If we later convert between WAV/WebM | Already declared as optional dependency. |

### 4.2 Commands & sequence

1. **Generate/update raw sentences (Stage 0)**  
   ```bash
   # Set Gemini API key
   export GEMINI_API_KEY="your-api-key-here"
   
   # Run Stage 0 (generates CSV + normalizes to JSON)
   npm run generate:sentences:stage0
   
   # Or run steps separately:
   npm run generate:gemini:sentences      # Generates data/raw/gemini_sentences.csv
   npm run generate:normalize:sentences   # Normalizes to data/sentences.json
   ```
   - Normalizer ensures output matches `SentencesData` schema (categories array, stable IDs).
2. **Run the unified TS pipeline**  
   ```bash
   npm run generation:pipeline -- --stage=all
   ```
   - Internally executes: load/enrich/write → TTS → audio index → fixtures → validate.
   - Use `--dry-run` for rehearsal (skips file writes but runs logic).
   - Stage-specific runs: e.g., `npm run generation:pipeline -- --stage=enrich`, `--stage=tts`, etc.
3. **Optional dev harness** (fast smoke test without audio):  
   ```
   npm run dev:test-enrichment
   ```
4. **Targeted validation or regeneration**:
   - `npm run generation:pipeline -- --stage=index` to rebuild `audio_index.json` after manual audio tweaks.
   - `npm run generation:pipeline -- --stage=validate` to re-check data without re-running TTS (loads from master files/audio index).

### 4.3 Outputs & artifacts

| Artifact | Produced by | Notes |
| --- | --- | --- |
| `data/raw/gemini/*.csv|json` | Stage 0 Python + transformer | Keep for audit + reproducibility. |
| `data/masterWords.json`, `data/masterSentences.json` | `writeCanonicalDatasets.ts` | Canonical datasets consumed by UI. Must include translations, categories, difficulty metadata. |
| `public/audio/words/<voiceId>/<id>.wav` + `public/audio/sentences/<voiceId>/<id>.wav` | `runTTSJobs.ts` | Ensure directories exist; consider mirroring into legacy `audio/ptbr` until UI updated. |
| `data/audio_index.json` | `writeAudioIndex.ts` | Keyed by item ID; currently remaps to `/audio/ptbr/...` paths. Update plan to match actual file layout. |
| `data/test_data/phrase_*.json`, `Phrase *.wav`, `pronunciation_fixtures.json` | `generatePronunciationFixtures.ts` | Used for dev/testing of Azure assessment flows. |
| `data/generated/generation_report.md` | `writeValidationReport` (if invoked) | Snapshot of validation findings per run. |
| Console logs (per stage) | `scripts/generationPipeline.ts` | Capture job counts, failures, validation summary. |

---

## 5. Migration strategy: dummy → pipeline data

1. **Data parity work (before switching sources)**  
   - Extend `EnrichedWord`/`EnrichedSentence` to retain `englishGloss` / `englishTranslation`, original difficulty numbers, pronunciation notes, and raw category labels. Modify `enrichWords`/`enrichSentences` + writers accordingly so master files contain everything the UI expects.
   - Decide on canonical ID prefixes for Gemini-generated items to avoid collisions with legacy IDs.
2. **Introduce a content-source toggle** ✅ **COMPLETED**  
   - **Environment flag**: `VITE_CONTENT_SOURCE` (set to `'pipeline'` or `'legacy'`, defaults to `'legacy'`)
   - **Configuration**: `src/config/appConfig.ts` exports `CONTENT_SOURCE` constant
   - **Behavior**:
     - When `CONTENT_SOURCE === 'pipeline'`: Loads from `masterWords.json` and `masterSentences.json` only, **throws error** if files are missing or empty
     - When `CONTENT_SOURCE === 'legacy'`: Uses current fallback chain (master → legacy → sample data)
   - **Error messages**: Pipeline mode logs clear errors with `[CONTENT_SOURCE=pipeline]` prefix when master data is missing
   - See Section 12 for detailed usage instructions
3. **Normalize loaders**  
   - Create dedicated adapters (`mapEnrichedSentenceToSentence`, `mapEnrichedWordToWord`) that share logic between pipeline and legacy data.  
   - Ensure `loadCategoryLabels` does not rely on legacy files once new canonical categories exist (e.g., store category metadata alongside master datasets or a separate `data/masterCategories.json`).
4. **Audio alignment** ✅ **COMPLETED**  
   - **Canonical path scheme unified**: `/audio/sentences/{voiceId}/{id}.wav` and `/audio/words/{voiceId}/{id}.wav`.
   - `audio_index.json` includes `voices` field mapping `voiceId` → canonical URL for each entry.
   - Legacy `ptbr.male/female` paths retained in `ptbr` field for backward compatibility.
   - UI loaders (`src/lib/audio.ts`) prioritize canonical URLs, fall back to legacy paths, then inferred paths.
   - `audio_index.json` includes **both** word and sentence entries with canonical URLs.
5. **Validation + QA gates**  
   - Run `npm run generation:pipeline -- --stage=validate` with enhanced rules once data parity is fixed (allowing some warnings initially).  
   - Add snapshot/unit tests to assert schema contracts for master files (e.g., `translationEn` non-empty, `wordRefs` valid, `audioIndex` path matches actual files).  
   - Update `src/pages/dev/pronunciation-fixtures.tsx` to read canonical data and allow testers to compare pipeline vs dummy side-by-side.
6. **Deployment plan**  
   - During rollout, keep dummy data accessible via flag for quick rollback.  
   - Once confidence is achieved, remove legacy `STATIC DATA/` dependencies and sample data, but only after migrating analytics and word stats modules.

**Checklist before flipping default to pipeline data**:

1. ✅ Master files contain translations, categories, difficulty, wordRefs, tags.  
2. ✅ `audio_index.json` lists every master word/sentence with correct serveable paths.  
3. ✅ `public/audio/...` (and/or `audio/ptbr/...`) contains WAVs for all IDs referenced in master files.  
4. ✅ `loadAllSentences`/`loadAllWords` successfully parse master files and their derived `Sentence`/`Word` objects render correctly (UI smoke tests).  
5. ✅ Pronunciation fixtures regenerate without errors (Azure creds OK).  
6. ✅ Validation passes with only acceptable warnings.  
7. ✅ Feature flag implemented and tested - `VITE_CONTENT_SOURCE` environment variable controls data source selection.  
8. ✅ Documented runbook (this file) kept up to date after each change.

---

## 6. Validation, QA, and manual test flows

1. **Automated validation**  
   - `npm run generation:pipeline -- --stage=validate` after every full run.  
   - Once phoneme mapping is implemented, treat missing phonemes/wordRefs/audio as release blockers; until then, downgrade known gaps to warnings via configuration (e.g., skip phoneme check when `config.flags.allowEmptyPhonemes`).
2. **Schema/unit checks**  
   - Add Vitest tests that load master files and assert required fields (translations, difficulty, etc.).  
   - Add tests for `src/lib/data.ts` ensuring both dummy and pipeline loaders return equivalent `Sentence`/`Word` counts for a known subset.
3. **Manual QA sweeps after pipeline run**  
   - Sentence Practice page: ensure lists render, audio plays for both male/female voices, word-by-word breakdown highlights tags.  
   - Word Practice page: confirm translations, tricky features, and audio exist.  
   - Dashboard analytics: verify counts/difficulty stats match dataset sizes.  
   - Pronunciation fixtures page (`/dev/pronunciation-fixtures`): verify newly generated fixtures load and Azure assessment mapping still works.  
   - Spot-check raw files (`data/master*.json`, `data/audio_index.json`) for structural sanity in an editor.
4. **Regression guardrails**  
   - Keep sample/dummy data accessible for quick comparison (maybe a “Preview pipeline data” toggle in dev builds).  
   - Track TTS failures via `runTTSJobs` logs; rerun only failed jobs to avoid redundant Azure costs.

---

## 7. Risks, edge cases, and mitigations

| Risk / Gap | Impact | Mitigation |
| --- | --- | --- |
| ~~**Translations missing in enriched/master data**~~ | ~~UI would show blank English text once we switch to master datasets.~~ | ✅ **RESOLVED**: `EnrichedWord`/`EnrichedSentence` now preserve `en`, `difficulty`, and `pronunciationNotes` from raw data. Transformers updated to use preserved fields. |
| **Phoneme mapper stub returns empty arrays** | Validator flags every word as missing phonemes; learning features relying on phonemes cannot launch. | Short-term: allow empty phonemes via config or skip that check. Long-term: implement real grapheme-to-phoneme mapping or integrate Azure Lexicon/IPA service. |
| **Audio path mismatch** (`buildAudioIndex` writes `/audio/ptbr/...` while new files live under `public/audio/...`). | UI loads stale/404 audio paths; invalidation in validation step. | Decide on canonical path (likely `audio/words/<voiceId>/<id>.wav` served from `public`). Update `buildAudioIndex` + UI to reference actual paths or copy files into expected legacy structure. |
| **Gemini output quality / duplicates / register mismatch** | Poor learning content, inconsistent difficulty. | Add manual review and heuristics to dedupe + tag forms (Stage 0). Consider storing Gemini prompt metadata + rejection list. |
| **Azure TTS throttling or quota exhaustion** | Pipeline stalls mid-run; partial audio sets. | Keep concurrency at 4, leverage idempotent job runner, monitor `runTTSJobs` failure logs. Optionally add exponential backoff config or per-voice throttling. |
| **Partial pipeline runs leave inconsistent artifacts** (e.g., master files updated but audio index not). | UI may reference IDs without audio or vice versa. | Encourage always running `--stage=all` for release builds; if running piecemeal, follow `enrich → write → tts → index → fixtures → validate` order. Add metadata file capturing run timestamp + git commit. |
| **Pronunciation fixture generation costs/time** | Running Stage `fixtures` repeatedly is slow & billable. | Gate behind dedicated CLI flag (`--stage=fixtures`) unless needed. Consider caching fixtures per sentence ID. |
| **Env secrets management** | Risk of leaking API keys or inconsistent configs across machines. | Document `.env` expectations, use `.env.local` ignored by git, do not hard-code keys in scripts. |
| **UI fallback order hides issues** (since it silently falls back to legacy data). | Hard to notice master file regressions. | Add console warnings when fallback occurs, expose debugging info, and run automated tests that force `CONTENT_SOURCE=pipeline`. |
| **Large audio footprint** | Repo bloat, slow git operations. | Store generated audio outside git (e.g., `.gitignore public/audio/sentences/*`). For releases, consider packaging audio separately or using cloud storage/CDN. |

Open questions to resolve during implementation:
1. Should we split raw data sources per domain (words vs sentences) or maintain a single aggregated JSON?  
2. Do we need to version master datasets (e.g., `data/masterSentences.v1.json`) for rollback?  
3. How do we want to store difficulty metadata from Gemini (LLM-provided vs heuristic)?  
4. Should audio index carry full metadata (tags, CEFR) for quick lookup, or remain minimal?

---

## 8. Master Dataset Schema

### 8.1 Master Word Object Shape

Master words (`data/masterWords.json`) are written as arrays of `EnrichedWord` objects with the following guaranteed fields:

**Required fields:**
- `id: string` - Unique word identifier
- `text: string` - Portuguese text (pt)
- `normalizedText: string` - Normalized version for matching
- `en: string` - English translation (required for UI)
- `category: string` - Category ID
- `partOfSpeech: string` - Part of speech (noun, verb, etc.)
- `difficulty: 1 | 2 | 3 | 4 | 5` - Difficulty level (1-5 scale, required for UI)
- `difficultForEnglish: boolean` - Whether this word is difficult for English speakers
- `phonemes: string[]` - ARPABET or similar phoneme codes (may be empty array initially)

**Optional fields:**
- `baseForm?: string` - Optional base/infinitive form
- `pronunciationNotes?: string` - Pronunciation guidance notes
- `englishDifficultyFlag?: boolean` - Alias for `difficultForEnglish` (backward compatibility)
- `ipa?: string` - IPA representation
- `tags?: string[]` - Additional tags (e.g., "nasal", "contains_lh", "contains_rr")
- `cefr?: string` - CEFR level (A1, A2, B1, B2, C1, C2)
- `difficultyScore?: number` - Numeric difficulty score (0-100)

**Example:**
```json
{
  "id": "food_word_001",
  "text": "pão",
  "normalizedText": "pão",
  "en": "bread",
  "category": "food",
  "partOfSpeech": "noun",
  "difficulty": 1,
  "difficultForEnglish": true,
  "pronunciationNotes": "The 'ão' sound is nasal",
  "phonemes": [],
  "tags": ["nasal"],
  "cefr": "A1",
  "difficultyScore": 25
}
```

### 8.2 Master Sentence Object Shape

Master sentences (`data/masterSentences.json`) are written as arrays of `EnrichedSentence` objects with the following guaranteed fields:

**Required fields:**
- `id: string` - Unique sentence identifier
- `text: string` - Portuguese text (pt)
- `normalizedText: string` - Normalized version for matching
- `en: string` - English translation (required for UI)
- `category: string` - Category ID
- `difficulty: 1 | 2 | 3 | 4 | 5` - Difficulty level (1-5 scale, required for UI)

**Optional fields:**
- `pronunciationNotes?: string` - Pronunciation guidance notes
- `tags?: string[]` - Additional tags (e.g., "has_nasal", "has_lh", "question", "first-person")
- `hardForEnglish?: boolean` - Whether this sentence is hard for English speakers
- `wordRefs?: Array<{ wordId: string; tokenIndex: number }>` - References to words in this sentence
- `cefr?: string` - CEFR level (A1, A2, B1, B2, C1, C2)
- `difficultyScore?: number` - Numeric difficulty score (0-100)

**Example:**
```json
{
  "id": "food_001",
  "text": "Estou com fome, o que você quer comer?",
  "normalizedText": "estou com fome, o que você quer comer?",
  "en": "I'm hungry, what do you want to eat?",
  "category": "food",
  "difficulty": 2,
  "pronunciationNotes": "'Estou' has nasalized 'om'; stress in 'você' is on 'cê'.",
  "tags": ["question", "first-person"],
  "hardForEnglish": false,
  "wordRefs": [
    { "wordId": "food_word_001", "tokenIndex": 0 },
    { "wordId": "food_word_002", "tokenIndex": 3 }
  ],
  "cefr": "A2",
  "difficultyScore": 35
}
```

### 8.3 Field Preservation Guarantees

The enrichment pipeline now **guarantees** that all fields required by the UI are preserved:

✅ **English translations** (`en`) - Preserved from raw data  
✅ **Difficulty levels** (`difficulty` 1-5) - Preserved from raw data  
✅ **Pronunciation notes** (`pronunciationNotes`) - Preserved from raw data  
✅ **Category IDs** (`category`) - Preserved or inferred  
✅ **Part of speech** (`partOfSpeech`) - Preserved from raw data  
✅ **Difficulty flags** (`difficultForEnglish`) - Preserved from raw data  

This ensures that switching from legacy/dummy data to pipeline-generated master datasets will **not break the UI** - all required fields are present.

---

## 9. Unified Audio Path Scheme

### 9.1 Canonical Path Structure

All audio files follow a unified canonical path scheme:

- **Sentences**: `/audio/sentences/{voiceId}/{id}.wav`
  - Example: `/audio/sentences/ptbr_male/food_001.wav`
  - Physical location: `public/audio/sentences/ptbr_male/food_001.wav`

- **Words**: `/audio/words/{voiceId}/{id}.wav`
  - Example: `/audio/words/ptbr_female/adj_001.wav`
  - Physical location: `public/audio/words/ptbr_female/adj_001.wav`

**Voice IDs**: Currently `ptbr_male` and `ptbr_female` (from `config/generationPipeline.config.ts`).

### 9.2 Audio Index Structure

The `data/audio_index.json` file uses the following structure:

```typescript
{
  [itemId: string]: {
    type: 'word' | 'sentence';
    sourceId: string;
    textPt: string;
    textEn: string;
    ptbr: {
      male: string;    // Legacy path (e.g., "audio/ptbr/male/food_001.wav")
      female: string;  // Legacy path (e.g., "audio/ptbr/female/food_001.wav")
    };
    voices?: {         // Canonical URLs per voice (new format)
      [voiceId: string]: string;  // e.g., { "ptbr_male": "/audio/sentences/ptbr_male/food_001.wav" }
    };
  }
}
```

### 9.3 Audio URL Resolution Priority

The audio routing system (`src/lib/audio.ts`) resolves URLs in the following priority order:

1. **Canonical `voices` field** (new format): Check `entry.voices[voiceId]` for canonical URL
2. **Legacy `ptbr` field** (backward compatibility): Check `entry.ptbr[gender]` for legacy path
3. **Inferred canonical path**: Fall back to `/audio/{type}s/{voiceId}/{id}.wav`
4. **Inferred legacy path** (words only): Last resort `/audio/words/{wordId}_{gender}.wav`

### 9.4 Implementation Details

- **TTS Job Planning** (`audioJobPlanner.ts`): Generates jobs with canonical output paths
- **Audio Index Building** (`buildAudioIndex.ts`): Creates entries with both canonical `voices` field and legacy `ptbr` field
- **Audio Routing** (`src/lib/audio.ts`, `src/utils/audioRouting.ts`): Implements priority-based URL resolution
- **Global Audio Player** (`useGlobalAudioPlayer.ts`): Uses audio routing helpers automatically

### 9.5 Migration Notes

- Legacy paths (`audio/ptbr/male|female/`) are still supported for backward compatibility
- New pipeline-generated audio uses canonical paths exclusively
- UI components automatically benefit from canonical URLs when available in `audio_index.json`
- Validation (`validateGeneratedData.ts`) checks for missing audio index entries (warnings only)

---

## 10. Grapheme-to-Phoneme (G2P) Mapping

### 10.1 Implementation Overview

The G2P mapper (`src/pipeline/phonemeMapper.ts`) implements a minimal rule-based grapheme-to-phoneme conversion for Portuguese words. All mapped phoneme IDs are verified against `data/phoneme_metadata.json` using `getPhonemeById()`.

### 10.2 Mapping Rules

**Direct Consonant Mapping:**
- `p` → `P`
- `b` → `B`
- `m` → `M` (with special handling for final `m` → nasal vowel, TODO)
- `n` → `N` (with special handling for final `n` → nasal vowel, TODO)
- `t` → `T`
- `d` → `D`
- `k`/`c` (before a, o, u) → `K`
- `g` → `G`
- `f` → `F`
- `v` → `V`
- `s` → `S`
- `z` → `Z`
- `l` → `L`
- `r` → `R_TAP` (word-initial or intervocalic)
- `j` → `JH`

**Digraphs (processed first):**
- `lh` → `LH`
- `nh` → `NH`
- `ch` → `CH`
- `rr` → `R_TAP`

**Basic Vowel Mapping:**
- `a` → `AA` (most cases) or `AH` (final unstressed)
- `e` → `EH`
- `i` → `IY`
- `o` → `OW`
- `u` → `UW`

**Nasal Vowels:**
- `ã` → `AN_NASAL`
- `õ` → `ON_NASAL`
- `ão` → `AN_NASAL`

### 10.3 Phoneme Field Shape

**In `EnrichedWord`:**
```typescript
{
  phonemes: string[];  // Array of phoneme IDs (e.g., ["P", "AA", "T", "OW"])
  ipa?: string;        // Optional IPA representation (not yet generated)
}
```

**In `EnrichedSentence`:**
- Phonemes are **not** included at sentence level (optional for future enhancement).

### 10.4 Validation

The validator (`src/pipeline/validateGeneratedData.ts`) checks each phoneme ID in enriched words:
- **Warns** (non-blocking) if `getPhonemeById(phonemeId)` returns `undefined`
- Logs warning: `WARNING: Phoneme ID "{phonemeId}" not found in phoneme_metadata.json (word: {wordId})`
- Does **not** hard error - allows pipeline to continue with warnings

### 10.5 Limitations and TODOs

The current implementation is **minimal** and includes several TODO comments for:
- Unknown character handling (skipped with TODO)
- Final `m`/`n` nasalization rules (currently maps to `M`/`N` instead of nasal vowels)
- Context-dependent vowel quality (e.g., open vs. close `e`/`o`)
- Stress-based vowel reduction
- Diphthong handling
- More sophisticated consonant clusters

**Future enhancements** will improve accuracy but the current implementation provides a foundation for phoneme-based features.

---

## 11. Content Source Configuration

### 11.1 Overview

The application supports switching between legacy and pipeline-generated data sources via the `VITE_CONTENT_SOURCE` environment variable. This allows for safe migration and side-by-side testing.

### 11.2 Configuration

**Environment Variable**: `VITE_CONTENT_SOURCE`

**Values**:
- `'legacy'` (default): Uses legacy/dummy data with fallback chain
- `'pipeline'`: Uses pipeline-generated master datasets only

**Configuration File**: `src/config/appConfig.ts`

```typescript
export const CONTENT_SOURCE: 'legacy' | 'pipeline' = 
  (import.meta.env.VITE_CONTENT_SOURCE as 'legacy' | 'pipeline' | undefined) ?? 'legacy';
```

### 11.3 Usage

**Setting the flag** (in `.env` or `.env.local`):
```bash
# Use pipeline-generated data
VITE_CONTENT_SOURCE=pipeline

# Use legacy data (default)
VITE_CONTENT_SOURCE=legacy
```

**Note**: Vite requires the `VITE_` prefix for environment variables to be exposed to the client.

### 11.4 Behavior by Mode

#### Pipeline Mode (`CONTENT_SOURCE === 'pipeline'`)

**Data Sources**:
- **Sentences**: `/data/masterSentences.json` (required)
- **Words**: `/data/masterWords.json` (required)

**Error Handling**:
- **Throws error** if `masterSentences.json` or `masterWords.json` are missing (404)
- **Throws error** if master files are empty arrays
- **No fallback** to legacy data - fails loudly to surface configuration issues
- Error messages include `[CONTENT_SOURCE=pipeline]` prefix for easy identification

**Example Error Messages**:
```
[CONTENT_SOURCE=pipeline] Failed to load masterSentences.json: 404 Not Found. Master dataset is required when CONTENT_SOURCE=pipeline.
[CONTENT_SOURCE=pipeline] masterWords.json is empty. Master dataset must contain data when CONTENT_SOURCE=pipeline.
```

#### Legacy Mode (`CONTENT_SOURCE === 'legacy'`)

**Data Sources** (fallback chain):
1. **Master datasets** (if available and non-empty):
   - `/data/masterSentences.json`
   - `/data/masterWords.json`
2. **Legacy files**:
   - `/data/sentences.json` or `/STATIC DATA/sentences.json`
   - `/STATIC DATA/words.json`
3. **Sample data** (sentences only, last resort)

**Error Handling**:
- **Silent fallback** through the chain
- **Warns** when falling back to next source
- **Throws error** only if all sources fail (words) or uses sample data (sentences)

### 11.5 Data Transformation

Both modes use the same transformation functions:
- `transformEnrichedSentence()` - Converts `EnrichedSentence` → `Sentence`
- `transformEnrichedWord()` - Converts `EnrichedWord` → `Word`

This ensures that returned objects match existing UI types (`Sentence` and `Word` from `src/lib/types.ts`) regardless of data source.

### 11.6 Migration Checklist

Before switching to `CONTENT_SOURCE=pipeline`:

1. ✅ Run full pipeline: `npm run generation:pipeline -- --stage=all`
2. ✅ Verify master files exist and are non-empty
3. ✅ Run validation: `npm run generation:pipeline -- --stage=validate`
4. ✅ Test UI with `VITE_CONTENT_SOURCE=pipeline` in development
5. ✅ Ensure audio files are generated and `audio_index.json` is up to date
6. ✅ Verify all required fields are present (translations, difficulty, categories, etc.)

### 11.7 Troubleshooting

**Error: "Failed to load masterSentences.json: 404 Not Found"**
- **Cause**: Master dataset file is missing
- **Solution**: Run pipeline to generate: `npm run generation:pipeline -- --stage=all`

**Error: "masterWords.json is empty"**
- **Cause**: Master dataset file exists but contains empty array
- **Solution**: Check pipeline output, ensure enrichment stage completed successfully

**UI shows blank translations or missing data**
- **Cause**: Master dataset missing required fields
- **Solution**: Verify enrichment pipeline preserves all fields (see Section 8)

---

## 12. Immediate next steps

1. ~~**Stabilize data schema**~~: ✅ **COMPLETE** - Enrichment pipeline now preserves translations, difficulty, pronunciation notes.  
2. ~~**Integrate Stage 0**~~: ✅ **COMPLETE** - Gemini generator in `scripts/generateGeminiSentences.py`, normalizer in `scripts/normalizeGeminiSentences.ts`, config points to `data/sentences.json`.  
3. ~~**Align audio paths**~~: ✅ **COMPLETE** - Unified canonical path scheme (`/audio/sentences/{voiceId}/{id}.wav` and `/audio/words/{voiceId}/{id}.wav`), audio index includes `voices` field, routing prioritizes canonical URLs.  
4. ~~**Implement migration flag + tests**~~: ✅ **COMPLETE** - `VITE_CONTENT_SOURCE` flag implemented in `src/config/appConfig.ts`, data loader respects flag, pipeline mode throws errors if master data missing.  
5. **Document runbook updates**: Keep this plan updated after each structural change so future runs remain deterministic.

Once the above are complete, we can run a full Stage 0 → Stage all pipeline, validate artifacts, and begin wiring the UI to canonical data in a low-risk, toggleable manner.

---

_Maintainers: keep this file updated whenever pipeline configuration, commands, or data contracts change._ 

