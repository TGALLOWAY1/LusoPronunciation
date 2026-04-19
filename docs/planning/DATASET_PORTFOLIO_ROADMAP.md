# Dataset Portfolio Roadmap

This roadmap turns the current sentence and word corpus into a portfolio-grade dataset.

## Current Baseline

Measured with `npm run audit:dataset` after bucket completion, alias-aware matching, the supplemental coverage lexicon pass, and phase 5 batches 01 to 02:

- Raw sentences: 601
- Master sentences: 593
- Raw words: 975
- Master words: 974
- Sentence audio variants ready: 1186/1186
- Word audio variants ready: 1948/1948
- Sentence token coverage by word inventory: 100.0%
- Fully covered sentences: 601/601
- Sentences with zero word refs: 0
- Empty sentence category/difficulty buckets: 0
- Difficulty 5 sentences: present in all active categories
- Portfolio blockers: none

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

## Difficulty Guardrails

Difficulty should stay within the normal handling range of Azure TTS and mainstream LLM translation/support.

- Level 1 to 3:
  - frequent everyday vocabulary
  - short to medium sentences
  - plain present/past/future usage
- Level 4:
  - denser everyday vocabulary
  - longer clauses
  - common contractions and connected speech
- Level 5:
  - still mainstream and conversational
  - can include subordinate clauses, conditionals, polite formality, and a moderate amount of abstraction
  - must avoid literary phrasing, regional edge cases, rare idioms, tongue-twister phonotactics, or domain-specialist terminology

Operational cap:

- Do not add hard content just to raise lexical coverage.
- Prefer high-frequency support words, common inflections, and reusable phrase chunks over obscure one-off vocabulary.
- If a token is missing but only appears in a fringe sentence, rewrite or deprioritize the sentence instead of expanding the inventory around it.

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

Done in this pass:

- Add a supplemental coverage lexicon for active-curriculum tokens that were still missing from sentence practice.
- Keep the scope aligned to the difficulty guardrails:
  - common support words
  - common inflections
  - reusable phrase chunks
  - mainstream travel, shopping, family, work, and routine vocabulary
- Merge alternate forms into existing canonical words during raw-load deduplication so inflectional coverage does not create duplicate master entries.
- Regenerate translations, phonemes, audio, and audio index for every new supporting word.

Success criteria:

- sentence token coverage reaches 100.0%
- zero sentences with zero word refs
- no remaining uncovered active-curriculum tokens

### Phase 3: Fill sentence bucket gaps

Current blocker was structural and is now resolved. The active curriculum has no empty sentence category/difficulty buckets.

Work:

- Use the difficulty guardrails above before adding content
- Backfill category/difficulty cells systematically
- Prefer manually curated additions over bulk generation
- Treat repeated PT strings across categories as one of:
  - one canonical sentence with broader tags
  - multiple curated variants with distinct wording

Success criteria:

- zero empty sentence buckets for the active curriculum
- level 5 remains mainstream, teachable, and machine-friendly

### Phase 4: Raise lexical and pronunciation depth

Done in this pass:

- Ensure every new coverage word resolves through the existing phoneme pipeline.
- Regenerate both configured voice variants for the expanded word inventory.
- Keep phoneme metadata as the canonical teaching layer for all new words.

Success criteria:

- sentence word refs present for 100% of sentences
- no missing phoneme metadata IDs
- no words without phonemes

### Phase 5: Controlled corpus expansion

In progress.

Done in this pass:

- Allow the pipeline and audit to load multiple raw sentence sources instead of one monolithic file.
- Start a dedicated batch folder at `data/sentence_expansions/`.
- Add phase 5 batch 01 with 40 curated sentences:
  - 1 new level 1 sentence per category
  - 1 new level 2 sentence per category
  - 1 new level 4 sentence per category
  - 1 new level 5 sentence per category
- Add phase 5 batch 02 with 50 curated sentences:
  - 1 new level 1 sentence per category
  - 1 new level 2 sentence per category
  - 1 new level 3 sentence per category
  - 1 new level 4 sentence per category
  - 1 new level 5 sentence per category
- Regenerate sentence audio, master datasets, and audio index for the expanded corpus.

Next work:

- keep adding curated batch files instead of editing the legacy base source directly
- prioritize the weakest category/difficulty buckets first
- push every category toward the 20 to 30 sentence per difficulty target without reopening coverage gaps
- spot-check naturalness and translation quality after each batch

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
