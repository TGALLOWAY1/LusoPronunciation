# Dataset Expansion Next Steps

This document describes the next expansion pass after phase 5 batches 01 and 02.

## Current Snapshot

Measured from the current canonical dataset:

- Master sentences: 593
- Raw sentences: 601
- Sentence token coverage: 100.0%
- Fully covered sentences: 601/601
- Sentences with zero word refs: 0
- Sentence audio readiness: 1186/1186
- Portfolio blockers: none

Current category and difficulty counts:

| Category | L1 | L2 | L3 | L4 | L5 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| food | 13 | 11 | 31 | 3 | 3 | 61 |
| travel | 7 | 7 | 37 | 4 | 3 | 58 |
| family_friends | 3 | 10 | 27 | 17 | 3 | 60 |
| daily_routine | 3 | 11 | 25 | 18 | 3 | 60 |
| feelings | 17 | 21 | 16 | 3 | 3 | 60 |
| questions | 3 | 5 | 44 | 4 | 3 | 59 |
| shopping | 9 | 9 | 32 | 3 | 3 | 56 |
| directions | 3 | 7 | 40 | 6 | 3 | 59 |
| work_study | 3 | 9 | 33 | 12 | 3 | 60 |
| small_talk | 11 | 10 | 31 | 5 | 3 | 60 |

## What To Optimize Next

The corpus is no longer blocked by coverage, phonemes, refs, or audio. The next problem is balance.

The biggest gap is not sentence count overall. It is underrepresented low and high difficulty content in a subset of categories:

- Level 1 is thin in `family_friends`, `daily_routine`, `questions`, `directions`, and `work_study`
- Level 4 is thin in `food`, `travel`, `feelings`, `questions`, and `shopping`
- Level 5 is thin in every category
- Level 3 is already overrepresented and should be deprioritized for now

## Near-Term Milestones

### Milestone A: Raise every bucket to at least 5

This is the next clean balancing target because it improves curriculum shape quickly without adding too much volume.

Net additions needed from the current baseline:

- `food`: +2 L4, +2 L5
- `travel`: +1 L4, +2 L5
- `family_friends`: +2 L1, +2 L5
- `daily_routine`: +2 L1, +2 L5
- `feelings`: +2 L4, +2 L5
- `questions`: +2 L1, +1 L4, +2 L5
- `shopping`: +2 L4, +2 L5
- `directions`: +2 L1, +2 L5
- `work_study`: +2 L1, +2 L5
- `small_talk`: +2 L5

Total needed: 38 new sentences

### Milestone B: Raise weak buckets to at least 8

After Milestone A, continue lifting sparse cells before adding more mid-level material.

Priority order:

1. Level 5 across all categories
2. Level 1 in practical categories
3. Level 4 in practical categories
4. Level 2 only where it still feels thin
5. Level 3 only when a category needs a very natural bridge sentence

### Milestone C: Push toward portfolio density

Once buckets are no longer sparse:

- move the weakest categories toward 12 to 15 sentences in L1, L2, L4, and L5
- keep L3 mostly flat unless a category genuinely needs more variety
- keep total expansion in curated batches of 30 to 60 sentences

## Recommended Batch Sequence

### Batch 03

Goal: complete most of Milestone A.

Target categories:

- `family_friends`
- `daily_routine`
- `questions`
- `directions`
- `work_study`
- `food`
- `travel`

Target difficulty mix:

- mostly L1, L4, and L5
- no more than 1 or 2 L3 additions total

Suggested size:

- 35 to 45 sentences

### Batch 04

Goal: finish Milestone A and start Milestone B.

Target categories:

- `feelings`
- `shopping`
- `small_talk`
- any remaining weak buckets from batch 03

Target difficulty mix:

- mostly L4 and L5
- a few L1 additions where categories still feel too advanced at the entry point

Suggested size:

- 30 to 40 sentences

### Batch 05

Goal: start lifting weak buckets toward 8 each.

Target categories:

- all categories still below 8 in L1, L4, or L5

Target difficulty mix:

- almost entirely L1, L4, and L5

Suggested size:

- 40 to 60 sentences

## Content Rules For New Batches

Keep using the existing narrowed difficulty model:

- Level 1:
  - short, high-frequency, immediately useful
- Level 2:
  - slightly longer but still simple and direct
- Level 3:
  - normal conversational middle
- Level 4:
  - denser but still everyday
- Level 5:
  - mainstream, connected, and teachable
  - no literary phrasing
  - no specialist terminology
  - no rare idioms

Operational rules:

- prefer expanding with already-covered vocabulary when possible
- only add new words if the sentence is clearly worth supporting
- avoid duplicate PT strings across categories unless the reuse is intentional
- do not add more level 3 filler just because it is easy to write

## Batch Acceptance Checklist

Every expansion batch should pass all of the following before commit:

- raw source file added under `data/sentence_expansions/`
- sentence text, translation, category, and difficulty present for every entry
- `npm run generation:pipeline -- --stage=all` passes
- `npm run audit:dataset` passes
- sentence token coverage remains at 100.0% or intentionally drops only with an explicit vocabulary follow-up
- sentence word refs remain at 100%
- sentence audio reaches full readiness in both voices
- no new portfolio blockers appear

## Editing Workflow

Use this workflow for each new batch:

1. Draft candidate sentences outside the base file.
2. Check them against the current word inventory.
3. Write a new batch file in `data/sentence_expansions/phase5_batch_XX.json`.
4. Add the new file to `config/generationPipeline.config.ts`.
5. Regenerate the pipeline.
6. Run the dataset audit.
7. Commit the infrastructure or content changes separately when possible.

## Stop Conditions

Pause expansion and fix the issue first if any of the following happens:

- sentence token coverage drops below 100% unexpectedly
- new words create missing phonemes or missing audio
- a batch introduces a large number of duplicate PT strings
- level 5 starts drifting into unnatural or specialist language
- the category mix becomes less balanced after a batch

## Next Recommended Action

Start `phase5_batch_03.json` and spend it almost entirely on L1, L4, and L5 sentences for:

- `family_friends`
- `daily_routine`
- `questions`
- `directions`
- `work_study`
- `food`
- `travel`

That is the fastest way to improve portfolio quality from the current baseline.
