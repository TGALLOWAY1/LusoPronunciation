# Tour redesign structure

The new `/tour` is a guided evidence story designed to communicate the product in roughly 60–90 seconds without requiring interaction.

## Narrative order

1. **Compact hero — product value first.** “From speech scores to Brazilian Portuguese coaching you can act on.” The right-hand product frame is a deterministic illustrative attempt. Word and sound controls update the score context, phoneme timeline, and coaching panel. The sample label remains visible at all times.
2. **Guided walkthrough — the real learner sequence.** Four selectable steps explain reference playback, browser capture, returned word scores, and word-to-sound coaching. Desktop uses a sticky product frame plus scroll/click activation; mobile uses a readable horizontal stepper and non-sticky frame.
3. **Core transformation — provider data to teaching context.** A compact, sanitized word-level Azure-style excerpt flows through the real `AttemptScore` normalizer and canonical word/phoneme metadata join into learner-facing feedback. The section explicitly states that the current live provider path is word-level.
4. **Engineering challenges — one featured, three supporting.** Audio normalization is the visual centerpiece. Expandable technical notes cover quality gates, response trust/fallbacks, and canonical PT-BR mapping.
5. **Evidence ledger — facts, not growth metrics.** Dataset facts are source-derived and separated from demonstrated capabilities, deployment evidence, and illustrative sample states. Details reveal verification notes and source modules.
6. **Technical pipeline — responsibility and data shape.** A responsive DOM/CSS pipeline names browser, server, external provider, and storage boundaries. Each stage states input, responsibility, and output. Motion shows a single restrained data handoff and stops in reduced-motion mode.
7. **Final CTA — precise access requirements.** The sample demo is static and needs no account, microphone, backend, or Azure key. The live recording path requires sign-in, microphone permission, a configured backend, and Azure credentials.

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
