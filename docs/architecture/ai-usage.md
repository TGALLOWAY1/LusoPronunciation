# AI Usage in LusoPronounce

_Last updated: 2026-04-20_

This document catalogs every external AI/ML service the project relies on, what it is used for, and whether it runs at **runtime** (user-facing) or in an **offline pipeline** (content generation / fixtures). All API keys are server-side only and validated at startup by `src/server/config/startupChecks.ts`.

## Summary

| Service | Provider | Stage | Purpose |
| --- | --- | --- | --- |
| Azure Speech – Pronunciation Assessment | Microsoft Azure Cognitive Services | **Runtime** | Scores user recordings word-by-word and flags miscues during live practice. |
| Azure Speech – Text-to-Speech | Microsoft Azure Cognitive Services | Offline pipeline | Synthesizes male/female pt-BR reference audio for every word and sentence. |
| Azure Speech – Token health probe | Microsoft Azure Cognitive Services | Runtime | `/api/pronunciation/speech-health` liveness check for the speech service. |
| Gemini (`gemini-1.5-flash`) | Google Generative AI | Offline pipeline | Generates the high-frequency Brazilian Portuguese sentence corpus across 10 categories. |

OpenAI, Anthropic, AWS, and ElevenLabs are **not** used anywhere in the product. All coaching logic (confusion detection, minimal-pair selection, next-drill suggestions) is rule-based and runs client-side with no model calls.

## Runtime AI (user-facing)

### Azure Pronunciation Assessment
The core of the app. Implemented in `src/server/routes/pronunciationAssessment.ts` and `src/pipeline/azurePronunciationClient.ts`; called against `https://{region}.stt.speech.microsoft.com/.../v1?language=pt-BR&format=detailed` with a base64-encoded `Pronunciation-Assessment` config (`HundredMark`, `Word` granularity, `Comprehensive` dimension, `EnableMiscue=true`). The client records webm/opus audio, the server converts it to 16 kHz mono WAV via `ffmpeg-static` (`src/server/lib/audioConversion.ts`), submits it to Azure, then normalizes the response (`src/lib/azurePronunciationNormalizer.ts`) into the internal `AttemptScore` shape containing overall, accuracy, fluency, completeness, and per-word/per-phoneme scores. Security middleware enforces per-user rate limits (20 req / 5 min), a daily quota (200 req/day), a 10 MB upload cap, and magic-byte signature validation before the request is ever forwarded to Azure.

### Azure Speech health probe
`pingAzureSpeechService()` in the same route issues an `issueToken` call to verify regional availability and surfaces it at `GET /api/pronunciation/speech-health`.

## Offline / Content-Generation AI

### Azure Text-to-Speech (TTS)
`src/pipeline/azureTTSClient.ts` wraps `microsoft-cognitiveservices-speech-sdk` with retry + exponential backoff and idempotent file writes. `src/pipeline/runTTSJobs.ts` runs queued jobs with a concurrency of 4 to produce canonical WAVs at `public/audio/{words,sentences}/{ptbr_male,ptbr_female}/{id}.wav` using the voices `pt-BR-AntonioNeural` (male) and `pt-BR-FranciscaNeural` (female). Additional TTS entry points: `scripts/generate_audio.js`, `scripts/generateWordAudio.ts`, and `src/pipeline/generateAssessmentFixtures.ts` (which also calls the Pronunciation Assessment API to build JSON+WAV test fixtures under `data/test_data/`). Invoked via `npm run audio:words`, `npm run generate:audio`, and `npm run generation:pipeline -- --stage=tts|fixtures`.

### Google Gemini – sentence corpus generation
`scripts/generateGeminiSentences.py` calls `gemini-1.5-flash` (Python `google-generativeai` SDK, key via `GEMINI_API_KEY`) with a structured prompt that asks for 50 natural spoken pt-BR sentences plus English translations across 10 categories (Food & Eating, Travel, Family & Friends, Daily Routine, Feelings & Emotions, Questions & Asking for Help, Shopping & Money, Directions & Transport, Work & Study, Small Talk & Social) — 500 sentences total, written to `data/raw/gemini_sentences.csv` with a 2-second inter-category delay for quota. `scripts/normalizeGeminiSentences.ts` then parses the CSV, infers difficulty (2/3/4) from length and lexical complexity, assigns stable IDs (`gemini_{category}_{index}`), and emits `data/sentences.json` in the schema consumed by the rest of the pipeline. The legacy equivalent lives at `scripts/legacy/generateSentences.legacy.py` (uses `gemini-pro`). Commands: `npm run generate:gemini:sentences`, `npm run generate:normalize:sentences`, `npm run generate:sentences:stage0`. Gemini is **never** called at user runtime.

## Non-AI components worth noting

- **Phoneme metadata** (`data/phoneme_metadata.json`) is a manually curated catalog of IPA symbols, articulation notes, teaching tips, and minimal pairs — not model-generated. Loaded at runtime via `src/lib/phonemeMetadata.ts`.
- **Grapheme-to-phoneme mapping** (`src/pipeline/phonemeMapper.ts`) is a rule-based heuristic, not an ML model.
- **Coaching engine** (`src/lib/coaching/`) — confusion detection, minimal-pair drill selection, and next-step suggestions are deterministic heuristics keyed off the Azure assessment output; there is no LLM in the feedback loop.
- **Output validation** (`src/pipeline/validateGeneratedData.ts`) is a static consistency check (cross-referencing enriched data against the audio index and phoneme metadata), not an AI filter.

## Required environment variables

| Variable | Consumer | Required at runtime? |
| --- | --- | --- |
| `AZURE_SPEECH_KEY` | Pronunciation Assessment + TTS | Yes |
| `AZURE_SPEECH_REGION` | Pronunciation Assessment + TTS | Yes |
| `GEMINI_API_KEY` | Sentence generation script only | No — offline only |
