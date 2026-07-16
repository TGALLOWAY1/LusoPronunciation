# Tour claims audit

Audit date: 2026-07-16

Audited route: `/tour` at `src/pages/TourPage.tsx`

Supporting content: `src/pages/tour/tourContent.ts`, `src/pages/tour/TourVisuals.tsx`, and the public `/demo`

## Audit standard

- **Verified**: directly exercised or deterministically derived from current implementation or repository data.
- **Demonstrated**: implemented and visible in a current route, but not necessarily exercised against a live external service during this audit.
- **Illustrative sample**: local deterministic fixture shaped like the product output; not a learner outcome and not a live provider response.
- **Unsupported**: the repository does not substantiate the claim, or the active code contradicts it.
- **Outdated**: the claim describes an earlier implementation or documentation state.

Types, schemas, comments, or unfinished components are not treated as proof that a capability is connected. Live/debug Azure payloads in `data/debug/` and `data/test_data/` were inspected separately from hand-authored demo fixtures.

## Material findings

1. The live assessment request is configured with `Granularity: 'Word'`. All checked live/debug payloads contain overall and word-level pronunciation fields but no `Words[].Phonemes` arrays. The public tour must not claim that the current live path returns phoneme-level Azure scores.
2. The application can still present canonical phoneme sequences and teaching metadata by joining scored words to `masterWords.json` and `phoneme_metadata.json`. That is reference metadata, not provider-scored phoneme accuracy.
3. The public `/demo` is deterministic and unauthenticated. Its scores, per-phoneme values, progress histories, and coaching copy are hand-authored samples in `src/lib/demo/demoData.ts`; they are not Azure results or learner outcomes.
4. Browser recordings prefer Ogg/Opus, then WebM/Opus, WebM, or the browser default. The server attempts FFmpeg conversion to 16 kHz mono signed 16-bit WAV. If conversion fails, it intentionally falls back to the original upload and reports `fallbackUsed`; “Azure always receives normalized WAV” is therefore too strong.
5. A static Vercel tour/demo is live and returned HTTP 200 on 2026-07-16. Railway deployment files are present, but the repository and public links do not prove a live Railway service.
6. Male and female reference files are Azure neural TTS assets, not recorded native speakers. Public wording should use “synthesized PT-BR reference audio.”
7. Attempt history and progress analysis are implemented. Current client state persists locally and dual-writes authenticated attempts to MongoDB; the client does not yet rehydrate its full history from the server as the source of truth.

## Claim ledger

| Exact displayed claim | Classification | Evidence and symbols | How verified | Revised public wording | Decision |
| --- | --- | --- | --- | --- | --- |
| “Full-stack speech AI · portfolio project” | Verified | `package.json`; `src/app/App.tsx`; `src/server/app.ts`; `src/server/routes/pronunciationAssessment.ts` | Confirmed React client, Express server, Azure request path, and Mongo models in one repository. | “Independent full-stack portfolio build” | Keep, simplify. |
| “Solo full-stack build” | Demonstrated | Git history has one human identity plus disclosed Claude-authored commits; client/server/data/deployment code is in one repo. | `git shortlog -sne --all` does not support the stronger “single-author codebase” wording. | “Independent full-stack portfolio build” | Qualify; do not claim single authorship. |
| “React · TS · Azure Speech · MongoDB” | Verified | `package.json`; `src/server/routes/pronunciationAssessment.ts`; `src/server/db/mongoClient.ts` | Dependencies and connected runtime code inspected. | Same. | Keep. |
| “Deployed demo” | Verified | `vercel.json`; `README.md`; `https://luso-pronunciation.vercel.app/demo` | Public `/demo` returned HTTP 200 on 2026-07-16. | “Static tour + demo live on Vercel” | Keep with scope. |
| “Hear native male or female reference audio for the phrase.” | Unsupported | `config/generationPipeline.config.ts`; `scripts/generateWordAudio.ts`; `data/audio_index.json` | Files are synthesized with `pt-BR-AntonioNeural` and `pt-BR-FranciscaNeural`; no human recording provenance exists. | “Hear synthesized male or female PT-BR reference audio.” | Replace. |
| “Speak in the browser — audio is captured and normalized for scoring.” | Verified | `useMicrophoneRecorder`; `analyzeAudioBlob`; `processPronunciationAssessment`; `convertToWav` | Followed capture, client quality gate, multipart upload, temp file, FFmpeg, and request content type. | “Capture in the browser; screen for duration/loudness; attempt server-side WAV normalization.” | Keep with fallback disclosure. |
| “Azure Speech returns word- and phoneme-level pronunciation scores.” | Unsupported | `buildPronunciationAssessmentHeader`; `mapAzurePronunciationResultToAttemptScore`; checked `data/debug/*.json` and `data/test_data/azure_response_*.json` | Active request uses word granularity. Checked provider payloads have `Words[].AccuracyScore` but no phoneme arrays. | “Azure returns overall, fluency, completeness, miscue, and word-level accuracy data on the current live path.” | Replace everywhere. |
| “Get targeted coaching on the exact sounds to fix” | Unsupported | `buildCoachingSuggestion`; `detectConfusionTags`; `enrichWordsWithCanonicalData` | Coaching prioritizes completeness, fluency, overall score, weak words, and spelling heuristics. Canonical phonemes can explain a word, but the live response does not identify the exact missed phoneme. | “Move from a weak word to relevant PT-BR sound metadata and a concrete retry cue.” | Replace. |
| “Browser recording → ffmpeg WAV normalization (16 kHz, mono)” | Verified | `convertToWav` arguments `-ar 16000`, `-ac 1`, `-sample_fmt s16`; route conversion branch | Code and conversion tests confirm target shape. | “FFmpeg conversion target: 16 kHz, mono, signed 16-bit WAV.” | Keep. |
| “Azure always receives a consistent signal.” | Unsupported | `processPronunciationAssessment` conversion catch/fallback | Conversion failure sends the original upload and sets `fallbackUsed`. | “The server attempts a consistent WAV target and exposes whether fallback was used.” | Replace. |
| “36-phoneme Brazilian-Portuguese knowledge base” / “36 PT-BR phoneme map” | Verified | `data/phoneme_metadata.json`; `scripts/generateTourFacts.ts` | Deterministically counted 36 metadata records. | “36 phoneme metadata entries in the current PT-BR teaching set.” | Keep; do not imply complete linguistic coverage. |
| “13 sound-confusion sets” | Verified | `ConfusionTag`; `PTBR_MINIMAL_PAIRS`; `detectConfusionTags`; generated facts | Counted 13 unique tags used by the heuristic detector and pair selectors. | “13 confusion-pattern tags in deterministic coaching rules.” | Keep with precise noun. |
| “42 minimal-pair drills” | Outdated | `PTBR_MINIMAL_PAIRS`; `pickMinimalPairsByTags`; pre-existing worktree removes `NextStepCoachingCard` from the active UI | There are 42 pair records and tested selection logic, but the restored current UI no longer surfaces the drill card. | “42 tagged contrast prompts in the coaching dataset.” | Keep only as repository data, not demonstrated UI. |
| “593 sentences and 974 words” | Verified | `masterSentences.json`; `masterWords.json`; generated facts utility/test | Deterministic array counts. | “593 sentence records · 974 word records — verified in current master datasets.” | Keep. |
| “Word-by-word and phoneme-level score visualizations” | Partly unsupported | `ScoringPanel`; `InteractiveSentenceDisplay`; `PhonemePanel`; `adapters.ts` | Word scores are live. Phoneme score rendering exists and is demonstrated with fixtures, but live checked responses lack scored phonemes. | “Live word-level scoring; phoneme metadata in the product; per-phoneme values only in clearly labelled illustrative samples.” | Split and qualify. |
| “Trend sparklines” / sample progress line | Illustrative sample | `PhraseTrendSparkline`; `SampleProgress`; `demoData.history` | UI exists; tour/demo values are hand-authored arrays. | “Illustrative score history — not a learner outcome.” | Keep only with adjacent label. |
| “Express + MongoDB backend with JWT auth persists per-user attempts, sessions, and progress analytics over time.” | Demonstrated | `requireAuth`; `PronunciationAttemptModel`; `practiceRouter`; `practiceLogStore`; `ProgressPage` | Authenticated dual-write and analytics computation are connected. Client TODO notes server history is not yet its source of truth. | “Authenticated attempts dual-write to MongoDB; current history and analytics render from the client practice log.” | Keep with architecture detail. |
| “Client-side quality gates reject silent or too-short takes” | Verified | `MIN_DURATION_MS`; `MIN_RMS`; `analyzeAudioBlob`; `submitAttempt` | Gate runs before `fetch`, blocking short or quiet attempts. | Same, optionally include thresholds in details. | Keep. |
| “A confidence badge suppresses coaching when recognition is unreliable” | Demonstrated | `computeTrustLevel`; `getTrustMessage`; `PhonemePanel` `trustLevel === 'untrusted'` branch | Trust state is computed and detailed phoneme help is hidden for untrusted attempts. | “Completeness, recognition status, and missing-word ratio gate detailed feedback.” | Keep. |
| “Progressive disclosure — overall score → sub-scores → word → phoneme” | Demonstrated | `LivePracticeSection`; `ScoringPanel`; `InteractiveSentenceDisplay`; `PhonemePanel` | Current practice layout follows that order and word controls are interactive. | Same, but describe phoneme content as metadata unless a scored fixture is active. | Keep. |
| “Interactive demo — no account, mic, or API keys” | Verified | Public routes in `App.tsx`; `DemoPage`; `demoData`; `useDemoAudioAvailability` | `/demo` is outside `RequireAuth`, has no MediaRecorder, and makes only static audio HEAD/media requests. | “The sample demo needs no account, microphone, backend, or Azure key.” | Keep. |
| “The demo uses real phrases” | Verified | Demo IDs/text matched `masterSentences.json` | Checked each demo ID against the master dataset. | “Sentences come from the current master dataset.” | Keep. |
| Demo scores, phoneme breakdowns, histories, “bad/best/native” score changes | Illustrative sample | `demoData.ts` header; `toNativeScore`; `toBadScore`; `history` arrays | All values are hand-authored or deterministically transformed. The audio files are real static assets, but the scores are not produced from them at runtime. | “Illustrative scored attempt” / “static sample based on the production feedback format.” | Keep only with persistent labels. |
| “Assessed against itself, [native reference] scores near-perfect.” | Unsupported | `toNativeScore` | Values are generated by a local arithmetic transform; no runtime or stored provider assessment links the audio to those scores. | “Illustrative near-perfect reference state.” | Replace. |
| “Native male & female reference audio” | Unsupported | Azure TTS voice configuration and generated audio paths | Audio is synthesized; “native” could imply human speech. | “Male and female Azure neural PT-BR reference audio.” | Replace. |
| “Attempt history & progress analytics” | Demonstrated | `practiceLogStore`; `AttemptHistory`; `ProgressPage`; analytics tests | Connected pages, persistence, and analytics functions/tests exist behind auth. | “Authenticated product includes locally hydrated attempt history and progress analysis, with server dual-write.” | Keep. |
| “Responsive, dark-mode web UI” | Demonstrated | Tailwind responsive classes; media dark mode; existing screenshot/e2e files | Implemented throughout current components; must be re-verified after redesign. | “Responsive dark interface.” | Keep after viewport QA. |
| “Deployed on Vercel + Railway” | Unsupported | `vercel.json`; `railway.json`; `Dockerfile`; public Vercel URL | Vercel deployment verified. Railway is deployment-ready configuration only; no live Railway URL or service evidence. | “Static tour/demo verified on Vercel; full-stack Railway configuration is present but deployment is not claimed.” | Replace. |
| “From microphone to MongoDB” architecture | Demonstrated | `useMicrophoneRecorder`; pronunciation route; Azure normalizer; practice log dual-write; Mongo models | End-to-end stages are implemented for authenticated use, but demo viewing does not execute them. | “Authenticated live path: browser capture → quality gate → conversion → Azure word assessment → normalization/UI → local log + Mongo dual-write.” | Keep with locations and boundaries. |
| “Tour and demo use clearly-labelled sample data. No account or microphone required.” | Verified | `/tour` and `/demo` routes; local fixtures; no recorder mounted | Route and network path inspection confirms the public story is local/static apart from audio asset requests. | Same, adding that live recording requires sign-in, microphone, backend, and Azure configuration. | Keep. |
| “Full app for live recording and saved progress” | Demonstrated | Protected app routes; `RequireAuth`; recorder and persistence code | Implemented behind sign-in. A working live public backend was not verified in this audit. | “In the configured full-stack app, live recording requires sign-in, microphone permission, backend connectivity, and Azure credentials.” | Qualify. |

## Counts generated from source

`scripts/generateTourFacts.ts` reads the master datasets, phoneme metadata, audio index, and minimal-pair source and generates `src/pages/tour/tourFacts.generated.ts`. `npm run tour:facts:check` runs before the production build, and `scripts/generateTourFacts.test.ts` verifies that the committed values match current sources.

Current generated facts:

- 593 sentence records.
- 974 word records.
- 36 phoneme metadata entries.
- 13 unique confusion-pattern tags.
- 42 tagged contrast prompts.
- 1,567 audio-index records containing both male and female PT-BR voice URLs. This is an index fact, not proof that every referenced file is shipped by the static Vercel demo; `.vercelignore` intentionally excludes the full practice audio corpus.

## Claims intentionally omitted from the redesign

- Live phoneme-level Azure scores.
- Complete PT-BR phoneme coverage.
- Human native-speaker recordings.
- A live Railway deployment.
- Real learner improvement or outcome metrics.
- A production- or enterprise-readiness label.
- “Real-time” scoring or a fixed time-to-feedback promise.
- Minimal-pair drills as a currently accessible product capability.
- Any statement that a demo audio clip produced its displayed sample score.

## Evidence limitations

- This audit verified the static Vercel deployment and repository implementation. It did not use production Azure, MongoDB, or Railway credentials.
- Historical documentation contains stale route and deployment statements. Runtime code and current configuration take precedence.
- Linguistic coaching shown in the redesigned tour must be sourced from `phoneme_metadata.json` or explicitly labelled as an illustrative sample based on current demo data. No new articulation advice should be invented in the page component.
