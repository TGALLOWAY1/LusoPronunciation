# Dataset Portfolio Roadmap

This roadmap turns the current sentence and word corpus into a portfolio-grade dataset.

## Current Baseline

Measured with `npm run audit:dataset` after category preservation and audio regeneration:

- Raw sentences: 500
- Master sentences: 492
- Raw words: 434
- Master words: 433
- Sentence audio variants ready: 984/984
- Word audio variants ready: 866/866
- Sentence token coverage by word inventory: 72.5%
- Sentences with zero word refs: 22
- Empty sentence category/difficulty buckets: 15
- Difficulty 5 sentences: 0

## Portfolio Bar

The dataset is portfolio-ready only when all of the following are true:

- Canonical categories are preserved from source through master datasets
- No category shown in the UI has zero backing content
- Every sentence and word has:
  - English translation
  - audio in both configured voices
  - stable ID
  - canonical category
- Every master word has phonemes that resolve to canonical metadata
- Sentence token coverage by the word inventory is at least 90%
- Sentence word refs are present for at least 98% of sentences
- No sentence difficulty level is globally empty
- No category/difficulty bucket is empty for the active curriculum

## Target Corpus

Minimum target for a strong portfolio dataset:

- 10 core sentence categories
- 5 active difficulty levels
- 20 to 30 sentences per category/difficulty bucket
- 1,000 to 1,500 curated sentences total
- 800 to 1,200 words with complete translations and phoneme coverage

## Phase Order

### Phase 1: Structural integrity

Done in this pass:

- Preserve category IDs in the enrichment pipeline
- Stop category filters from reading an unrelated static source when master data exists
- Add dataset audit coverage for:
  - empty buckets
  - translation completeness
  - phoneme metadata coverage
  - audio readiness
  - token coverage
  - sentence word refs

### Phase 2: Close the vocabulary gap

Current blocker: 72.5% token coverage is too low.

Work:

- Add high-frequency missing tokens first:
  - `qual`, `pra`, `vai`, `ele`, `ja`, `seu`, `ela`, `nos`, `sempre`, `ta`
- For every newly added word, require:
  - English translation
  - phoneme sequence
  - pronunciation note if hard for English speakers
  - audio synthesis in both voices

Success criteria:

- sentence token coverage at or above 90%
- fewer than 5 sentences with zero word refs

### Phase 3: Fill sentence bucket gaps

Current blocker: 15 empty sentence category/difficulty buckets and no level 5 content.

Work:

- Define a real difficulty rubric before adding content
- Backfill category/difficulty cells systematically
- Prefer manually curated additions over bulk generation
- Treat repeated PT strings across categories as one of:
  - one canonical sentence with broader tags
  - multiple curated variants with distinct wording

Success criteria:

- zero empty sentence buckets for the active curriculum
- at least 10 curated level 5 sentences per category

### Phase 4: Raise lexical and pronunciation depth

Current blocker: some sentences still cannot resolve cleanly into word refs.

Work:

- Add missing base forms and common inflections to the word inventory
- Improve token normalization and matching rules only after adding missing vocabulary
- Expand pronunciation notes for words with `difficult_for_english = true`
- Keep phoneme metadata as the canonical teaching layer for new sounds

Success criteria:

- sentence word refs present for at least 98% of sentences
- no missing phoneme metadata IDs
- no words without phonemes

### Phase 5: Controlled corpus expansion

Only after phases 2 to 4 are stable:

- expand from ~500 to 1,000 to 1,500 sentences
- regenerate audio for the expanded corpus
- rerun dataset audit and pipeline validation
- spot-check naturalness, translation quality, and pronunciation coaching usefulness

## Operational Rules

Do not add new sentences unless the supporting assets are also planned:

- sentence text
- English translation
- category and difficulty
- linked words or word inventory additions
- phoneme coverage for any new words
- audio synthesis in both voices

## Commands

- `npm run generation:pipeline -- --stage=enrich`
- `npm run generation:pipeline -- --stage=tts`
- `npm run generation:pipeline -- --stage=index`
- `npm run audit:dataset`
