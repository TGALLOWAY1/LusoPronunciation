# Option B Data Pipeline Deliverables (LLM-Generated + Light Validation)

This document defines concrete deliverables for a deterministic, reproducible pre-runtime data pipeline for LusoPronunciation using **Option B** (generated-first) with two LLM sources and lightweight validation gates.

## 1) Target Deliverables

### 1.1 Folder structure

```text
/Users/tjgalloway/Programming Projects 2025/LusoPronunciation/
  config/
    generationPipeline.config.ts
    dataQuality.config.ts
  data/
    raw/
      llm_runs/
        <run_id>/
          model_a_output.json
          model_b_output.json
          verify_report.json
    intermediate/
      normalized/
        words.normalized.json
        sentences.normalized.json
      scored/
        words.scored.json
        sentences.scored.json
    releases/
      v2.0.0/
        categories.json
        phonemes.json
        pronunciationTips.json
        words.json
        sentences.json
        lessons.json
        audio_index.json
        validation-report.json
        confidence-report.json
        dataset-manifest.json
  schemas/
    phoneme.schema.json
    pronunciationTip.schema.json
    wordItem.schema.json
    sentenceItem.schema.json
    category.schema.json
    lessonItem.schema.json
    azureAssessmentConfig.schema.json
    datasetManifest.schema.json
  scripts/
    data/
      generateWithModelA.ts
      verifyWithModelB.ts
      normalizeGeneratedData.ts
      scoreAndFilter.ts
      buildDatasetRelease.ts
      validateDataset.ts
      azureSmokeTest.ts
      generateDatasetManifest.ts
  src/
    pipeline/
      validators/
        schemaValidators.ts
        localeValidators.ts
        dedupeValidators.ts
        coverageValidators.ts
        azureCompatibilityValidators.ts
      scoring/
        confidenceScoring.ts
      release/
        datasetBootstrap.ts
```

### 1.2 NPM scripts/commands

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "data:generate:a": "tsx scripts/data/generateWithModelA.ts",
    "data:verify:b": "tsx scripts/data/verifyWithModelB.ts",
    "data:normalize": "tsx scripts/data/normalizeGeneratedData.ts",
    "data:score": "tsx scripts/data/scoreAndFilter.ts",
    "data:release": "tsx scripts/data/buildDatasetRelease.ts --version=${DATASET_VERSION:-2.0.0}",
    "data:validate": "tsx scripts/data/validateDataset.ts --version=${DATASET_VERSION:-2.0.0}",
    "data:manifest": "tsx scripts/data/generateDatasetManifest.ts --version=${DATASET_VERSION:-2.0.0}",
    "data:bootstrap-check": "tsx scripts/data/bootstrapCheck.ts --version=${DATASET_VERSION:-2.0.0}",
    "data:azure-smoke": "tsx scripts/data/azureSmokeTest.ts",
    "data:build": "npm run data:generate:a && npm run data:verify:b && npm run data:normalize && npm run data:score && npm run data:release && npm run data:validate && npm run data:manifest",
    "data:ci-gates": "npm run data:validate && npm run data:bootstrap-check"
  }
}
```

### 1.3 Minimal dataset manifest format

```json
{
  "datasetVersion": "2.0.0",
  "schemaVersion": "1.0.0",
  "locale": "pt-BR",
  "buildTimestamp": "2026-02-10T00:00:00Z",
  "sourceFingerprint": "sha256:...",
  "configFingerprint": "sha256:...",
  "artifacts": {
    "categories": { "path": "categories.json", "count": 12, "sha256": "..." },
    "phonemes": { "path": "phonemes.json", "count": 36, "sha256": "..." },
    "pronunciationTips": { "path": "pronunciationTips.json", "count": 120, "sha256": "..." },
    "words": { "path": "words.json", "count": 500, "sha256": "..." },
    "sentences": { "path": "sentences.json", "count": 700, "sha256": "..." },
    "lessons": { "path": "lessons.json", "count": 80, "sha256": "..." },
    "audioIndex": { "path": "audio_index.json", "count": 1200, "sha256": "..." }
  },
  "validation": {
    "status": "passed",
    "rulesetVersion": "1.0.0",
    "reportPath": "validation-report.json"
  },
  "confidence": {
    "modelA": "google-ai-studio",
    "modelB": "openai",
    "acceptThreshold": 0.85,
    "reviewThreshold": 0.7,
    "reportPath": "confidence-report.json"
  }
}
```

## 2) Option B generation and scoring design

### 2.1 Model orchestration

1. **Model A (generator)** creates structured `pt-BR` data first.
2. **Model B (verifier)** evaluates each generated record and proposes corrections.
3. Deterministic comparator computes per-record confidence score.
4. Data passes only if confidence + deterministic validations satisfy thresholds.

### 2.2 Recommended confidence score

`confidence_score` in range `[0,1]`:

- translation agreement: `0.35`
- grammar/naturalness verdict: `0.30`
- category + difficulty agreement: `0.20`
- pronunciation tip quality agreement: `0.15`

Thresholds:

- `>= 0.85` auto-accept
- `0.70 - 0.84` keep with `low_confidence: true`
- `< 0.70` reject

### 2.3 Lightweight deterministic validations

Required checks:

1. JSON schema validity for all entities.
2. Locale hard-check (`pt-BR` only).
3. Character whitelist check (no emojis/unapproved symbols).
4. Exact dedupe by normalized Portuguese text.
5. Near-duplicate check (string similarity threshold).
6. Referential integrity (word refs, tip refs, config refs).
7. Coverage minimums by category and phoneme.
8. Azure compatibility checks:
   - non-empty reference text
   - punctuation and token safety profile
   - max text length constraint per prompt type

## 3) Current state -> changes

### Already present in repo

1. Pipeline orchestrator: `scripts/generationPipeline.ts`
2. Enrichment + validation modules under `src/pipeline/`
3. Runtime pipeline source toggle: `VITE_CONTENT_SOURCE`
4. Existing artifacts: `data/masterWords.json`, `data/masterSentences.json`, `data/audio_index.json`

### Needed for Option B

1. New generated-data scripts under `scripts/data/`.
2. New schemas under `schemas/`.
3. Confidence scoring + report generation.
4. Versioned release folder under `data/releases/<semver>/`.
5. Manifest generation and runtime bootstrap verification.

## 4) Prioritized implementation checklist (shippable milestones)

### Milestone 1: Contracts and validation foundation

1. Add JSON schemas for all core entities and manifest.
2. Add `dataQuality.config.ts` for thresholds and rule toggles.
3. Implement `scripts/data/validateDataset.ts` and wire to CI.

### Milestone 2: Option B generation path

1. Implement `generateWithModelA.ts` for structured generation output.
2. Implement `verifyWithModelB.ts` for independent verification pass.
3. Implement `normalizeGeneratedData.ts` for deterministic canonical formatting.

### Milestone 3: Confidence and filtering

1. Implement `scoreAndFilter.ts` using weighted confidence formula.
2. Emit `confidence-report.json` with accepted/review/rejected item counts.
3. Tag low-confidence items in output records.

### Milestone 4: Release artifact build

1. Implement `buildDatasetRelease.ts` to write `data/releases/vX.Y.Z/*`.
2. Implement `generateDatasetManifest.ts` with checksums/counts.
3. Add semver version input and fail on overwrite unless `--force`.

### Milestone 5: Azure and runtime safety

1. Implement `azureSmokeTest.ts` with mocked mode and optional live mode.
2. Add startup preflight (`datasetBootstrap.ts`) to block app use when manifest/data invalid.
3. Add migration hooks to support future schema changes without breaking existing user history.

### Milestone 6: Cutover and cleanup

1. Switch runtime default to pipeline mode after stable release.
2. Keep legacy fallback for one release as rollback path.
3. Remove old fallback chain once Option B pipeline is stable.

## 5) Practical defaults for a personal-use app

1. Start with low review burden: accept threshold `0.82` initially.
2. Keep all rejected items in `data/raw/llm_runs/<run_id>/` for later salvage.
3. Prioritize sentence naturalness over perfect linguistic annotations for early iterations.
4. Run live Azure smoke tests only on release builds, not every local build.

## 6) Exact prioritized checklist coverage (from earlier plan)

This section maps your exact checklist items to explicit deliverables.

1. **Add strict schemas and validators for all core entities.**
   - Covered by: `schemas/*.schema.json`, `scripts/data/validateDataset.ts`, `src/pipeline/validators/schemaValidators.ts`
2. **Introduce manifest generation + checksum verification.**
   - Covered by: `scripts/data/generateDatasetManifest.ts`, `data/releases/<version>/dataset-manifest.json`, startup checksum verification in `src/pipeline/release/datasetBootstrap.ts`
3. **Refactor category handling to remove heuristic default-to-general.**
   - Covered by: add canonical `categories.json` and use explicit category IDs from generation output; remove fallback behavior from `src/pipeline/tagging.ts::inferCategory`
4. **Add Azure compatibility validator and set prompt-level AzureAssessmentConfig.**
   - Covered by: `src/pipeline/validators/azureCompatibilityValidators.ts` and required `azureAssessmentConfigId` on prompt entities
5. **Expand error taxonomy types to include break/prosody-related errors.**
   - Covered by: extend `src/types/pronunciation.ts` error types to include `unexpected_break`, `missing_break`, `monotone` (when available from Azure)
6. **Add CI data gates (schema, coverage, dedupe, integrity).**
   - Covered by: `npm run data:validate` in CI with fail-on-error gating
7. **Add optional Azure smoke tests (nightly with secrets).**
   - Covered by: `npm run data:azure-smoke` with mock mode in regular CI and live mode in nightly pipeline
8. **Implement startup bootstrap gate that blocks practice until manifest is valid.**
   - Covered by: runtime preflight in `src/pipeline/release/datasetBootstrap.ts`; app blocks practice if manifest/schema/checksum fails
9. **Migrate existing master* and audio_index into versioned release layout.**
   - Covered by: `scripts/data/buildDatasetRelease.ts` migration step from `data/masterWords.json`, `data/masterSentences.json`, `data/audio_index.json` into `data/releases/vX.Y.Z/`
10. **Remove legacy fallback dependency once release pipeline is stable.**
    - Covered by: Milestone 6 cutover plan; remove legacy fallback in `src/lib/data.ts` after one stable release cycle

## 7) Sources

1. Internal implementation references:
   - `scripts/generationPipeline.ts`
   - `src/pipeline/validateGeneratedData.ts`
   - `src/pipeline/tagging.ts`
   - `src/server/routes/pronunciationAssessment.ts`
   - `src/types/pronunciation.ts`
   - `src/lib/data.ts`
2. Azure documentation (for compatibility and scoring constraints):
   - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment
   - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short
