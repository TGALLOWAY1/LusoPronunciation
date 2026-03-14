# Dataset Portfolio Roadmap

This roadmap turns the current sentence and word corpus into a portfolio-grade dataset.

## Current Baseline

Measured with `npm run audit:dataset` after bucket completion, alias-aware matching, and the first sentence-support vocabulary pass:

- Raw sentences: 511
- Master sentences: 503
- Raw words: 563
- Master words: 562
- Sentence audio variants ready: 1006/1006
- Word audio variants ready: 1124/1124
- Sentence token coverage by word inventory: 85.5%
- Sentences with zero word refs: 0
- Empty sentence category/difficulty buckets: 0
- Difficulty 5 sentences: present in all active categories

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

Current blocker: 85.5% token coverage is still below the 90% stretch target, but the remaining gap is now concentrated in a small set of mainstream missing words plus a longer low-value tail.

Work:

- Add high-frequency missing tokens first.
- Prefer alias forms for existing canonical words where the sentence gap is inflectional:
  - `pra`, `tá`, `estava`, `fez`, `podemos`, `chego`
- Add high-value mainstream vocabulary next:
  - `embora`, `aconteceu`, `costumo`, `escovo`, `levar`, `wi-fi`, `e-mail`
- Use sentence-led backfilling:
  - patch the few lowest-coverage sentences first
  - then stop rather than chasing lexical tail coverage
- For every newly added word, require:
  - English translation
  - phoneme sequence
  - pronunciation note if hard for English speakers
  - audio synthesis in both voices

Success criteria:

- sentence token coverage materially improves without expanding into obscure vocabulary
- zero sentences with zero word refs
- the lowest-coverage active sentences are covered by mainstream vocabulary only

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
