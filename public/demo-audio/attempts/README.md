# Demo learner recordings

Drop the uploaded learner recordings for the `/demo` page's audio examples in
this folder. The demo probes for these files at runtime and only shows the
playback button once a file exists, so missing recordings degrade gracefully
(scores still display).

## Naming convention

One WAV per demo sentence and example kind:

```
<sentenceId>.bad.wav    # intentionally poor pronunciation
<sentenceId>.best.wav   # best-effort pronunciation
```

The sentence ids are the real ids from `data/masterSentences.json` used by
`src/lib/demo/demoData.ts`:

- `gemini_small_talk_001` — "Oi, tudo bem?"
- `gemini_feelings_001` — "Estou muito feliz hoje."
- `gemini_food_003` — "A conta, por favor."
- `gemini_family_friends_001` — "Minha mãe se chama Ana."
- `gemini_questions_005` — "Que horas são?"

Example: `gemini_food_003.bad.wav`, `gemini_food_003.best.wav`.

Keep files small (16 kHz mono WAV is plenty). This folder ships with the
public static deploy — unlike `public/audio/`, it is NOT excluded by
`.vercelignore`, so anything placed here is publicly downloadable.
