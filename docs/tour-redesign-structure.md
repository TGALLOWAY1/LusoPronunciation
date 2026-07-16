# Tour redesign structure

The new `/tour` is a guided evidence story designed to communicate the product in roughly 60–90 seconds without requiring interaction.

## Narrative order

1. **Compact hero — product value first.** “From speech scores to Brazilian Portuguese coaching you can act on.” The right-hand product frame is an interactive illustrative attempt. Words are grouped with their nested sounds, and either level updates the score context and coaching panel. The sample label remains visible at all times.
2. **Guided walkthrough — the real learner sequence.** Four selectable steps explain reference playback, browser capture, returned word scores, and word-to-sound coaching. Desktop uses a sticky product frame plus scroll/click activation; mobile uses a readable horizontal stepper and non-sticky frame.
3. **Distinctive transformation — provider result to teaching context.** A compact, sanitized word-level Azure-style excerpt flows through LusoPronounce’s normalization and PT-BR teaching layer into learner-facing feedback. The section explicitly states that the current live provider path is word-level.
4. **Full-stack pipeline — ownership and boundaries.** A five-stage responsive pipeline prioritizes the technically substantial work: browser capture and validation, server audio preparation, Azure Speech assessment, the coaching layer, and attempt history. Each stage states input, responsibility, and output without exposing implementation filenames in the primary narrative.
5. **Implemented proof — capabilities before counts.** Recruiter-relevant product capabilities lead the section. Source-derived dataset depth follows as supporting evidence, while source modules stay behind optional disclosure controls.
6. **Final CTA — precise access requirements.** The sample demo needs no account or microphone. The live recording path requires sign-in, microphone permission, and the configured Express/Azure persistence flow.

## Interaction and accessibility contract

- All sample word/sound controls are native buttons with visible focus states, pressed state, and descriptive labels.
- Color bands always pair color with score text and a status label.
- Walkthrough steps support click, focus, and viewport activation; no scroll-jacking or keyboard trapping.
- The sticky frame is desktop-only and relinquishes sticky behavior on smaller screens.
- Details use native `details`/`summary` controls.
- Animations are CSS-only, do not gate content, and are disabled by `prefers-reduced-motion`.
- The page remains structurally complete if intersection observers or enhanced scroll behavior do not run.

## Truthfulness contract

- Live Azure claims stop at overall/sub-score, word accuracy, and miscue data.
- Canonical phoneme sequences and teaching tips are identified as repository metadata.
- Per-phoneme values, attempt scores, and progress traces are labelled illustrative/static sample data.
- Azure TTS assets are called synthesized PT-BR reference audio.
- Vercel is called a verified static deployment; Railway is described only as repository configuration.
- Counts come from `tourFacts.generated.ts`, checked by `scripts/generateTourFacts.ts`.
