# Scripts

Data-generation and maintenance scripts for LusoPronounce. All Azure-dependent
scripts require:

```bash
export AZURE_SPEECH_KEY="your-azure-speech-key"
export AZURE_SPEECH_REGION="your-azure-region"  # e.g. "eastus", "brazilsouth"
```

## Audio generation

Canonical audio lives in `public/audio/{words,sentences}/{ptbr_male,ptbr_female}/{id}.wav`
(voices: pt-BR-AntonioNeural / pt-BR-FranciscaNeural) and is indexed by
`data/audio_index.json` (`voices` field keyed by voice id).

- `npm run audio:words` — generate word audio (`generateWordAudio.ts`; `--force`, `--voice=male|female` variants available)
- `npm run generation:pipeline` — full master pipeline (`generationPipeline.ts`), including TTS and audio-index stages
- `npm run verify:audio` — consistency check between datasets and the audio index (`verifyAudioConsistency.ts`)

## Content generation

- `npm run generate:sentences:stage0` — Gemini sentence corpus + normalization (`generateGeminiSentences.py`, `normalizeGeminiSentences.ts`)
- `npm run audit:dataset` — dataset readiness audit (`auditDatasetReadiness.ts`)
- `npm run analyze:words` — word/sentence analysis (`analyzeWordsAndSentences.ts`)
- `tsx scripts/remapWordPhonemes.ts` — recompute `phonemes` arrays in `data/masterWords.json` from the G2P mapper (no external APIs)
- `tsx scripts/realignDifficulty.ts` — derive the coarse `difficulty` bucket from `difficultyScore`

## Other

- `npm run invite:seed -- --code=... --maxUses=N` — seed invite codes (`seedInviteCodes.ts`)
- `npm run lexicon:aggregate` — aggregate unknown-word observations (`aggregateUnknownWords.ts`)
