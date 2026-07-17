/**
 * Demo Mode Data — SAMPLE / MOCK DATA ONLY
 * ------------------------------------------------------------------
 * Everything in this file is hand-authored sample data used to power
 * the public `/demo` experience and parts of `/tour`. It lets a
 * visitor explore LusoPronounce's scoring, pronunciation guidance, and
 * progress tracking WITHOUT an account, Azure Speech credentials, a
 * microphone, or a database.
 *
 * The demo items are REAL sentences drawn from the app's curated
 * content set (`data/masterSentences.json`). Each item's `id` matches
 * the real sentence id. The native reference audio for these few demo
 * sentences is shipped in `public/demo-audio/` — a dedicated, small copy
 * that is intentionally kept OUTSIDE `public/audio/`, because the public
 * static deploy (see `.vercelignore`) excludes the ~215MB `public/audio/`
 * practice corpus. Keeping the demo's clips in their own folder means the
 * "Listen (native voice)" button works both locally and on the deploy.
 *
 * The SCORES, sound breakdowns, and attempt history are illustrative
 * and are NOT real Azure Speech pronunciation-assessment output. The UI
 * clearly labels this as demo data wherever it is shown.
 */

import type { AttemptScore, ErrorType } from '@/types/pronunciation';

/** Voice folder used for the demo's native reference playback. */
const DEMO_VOICE = 'ptbr_female';

/**
 * Resolve the native reference audio URL for a demo item. The clips live
 * under `public/demo-audio/<voice>/<id>.wav` and are served statically, so
 * no account or API key is needed to play them.
 *
 * These are deliberately a separate, small copy of the corresponding files
 * in `public/audio/sentences/` — that directory is excluded from the public
 * static deploy (`.vercelignore`) to keep it lightweight, so the demo cannot
 * rely on it. If you add a demo item, copy its native WAV into
 * `public/demo-audio/<voice>/` as well.
 */
export function getDemoNativeAudioUrl(id: string): string {
  return `/demo-audio/${DEMO_VOICE}/${id}.wav`;
}

/**
 * Resolve the URL for an uploaded learner recording of a demo sentence.
 * Recordings live under `public/demo-audio/attempts/<id>.<kind>.wav` (see the
 * README in that folder). Files are optional — the demo probes availability
 * at runtime and hides the playback button until a recording is uploaded.
 */
export function getDemoAttemptAudioUrl(id: string, kind: 'bad' | 'best'): string {
  return `/demo-audio/attempts/${id}.${kind}.wav`;
}

/** A single assessed sound within a demo word, with its illustrative score. */
export interface DemoPhonemeScore {
  /** Phoneme id matching data/phoneme_metadata.json (e.g. "LH", "AN_NASAL"). */
  symbol: string;
  score: number;
}

/** Word-level demo feedback, including its assessed sound breakdown. */
export interface DemoWordFeedback {
  text: string;
  /** Curated English eye-dialect pronunciation shown to public-demo learners. */
  respelling: string;
  score: number;
  errorType?: ErrorType;
  phonemes: DemoPhonemeScore[];
  /** Short coaching note surfaced when the word is expanded. */
  tip?: string;
}

/** Which of the three demo audio examples an assessment belongs to. */
export type DemoExampleKind = 'native' | 'bad' | 'best';

/**
 * One selectable audio example for a demo sentence — the synthesized native
 * reference, an intentionally bad learner attempt, or a best-effort learner
 * attempt. Each carries its own full sample assessment so the demo can show
 * how scoring reacts to very different pronunciations of the same sentence.
 */
export interface DemoExample {
  kind: DemoExampleKind;
  /** Selector button label, e.g. "Native speaker". */
  label: string;
  /** One-line explanation shown when the example is selected. */
  description: string;
  /**
   * Audio for this example. The native example always resolves to the shipped
   * reference WAV; learner examples point at `public/demo-audio/attempts/`
   * and may not exist yet — the UI probes availability before offering play.
   */
  audioUrl: string;
  /** True when the audio is guaranteed to ship with the deploy (native TTS). */
  audioBundled: boolean;
  /** Sample assessment for this example. */
  attempt: AttemptScore;
  /** Word-by-word breakdown with assessed sounds for this example. */
  words: DemoWordFeedback[];
  /** Coaching notes tailored to this example. */
  coaching: string[];
}

/** A complete demo item: a real sentence plus its sample assessment. */
export interface DemoItem {
  /** Real sentence id from masterSentences.json — also drives audio lookup. */
  id: string;
  /** Brazilian Portuguese sentence text. */
  text: string;
  /** English translation. */
  translation: string;
  /** 1 (easiest) – 4 (hardest). */
  difficulty: number;
  /** CEFR level of the source sentence (e.g. "A1"). */
  cefr?: string;
  /** Human-friendly labels for the tricky sounds in this item. */
  focusSounds: string[];
  /** Sample assessment shown in the score card (the best-effort attempt). */
  attempt: AttemptScore;
  /** Word-by-word breakdown with assessed sounds (the best-effort attempt). */
  words: DemoWordFeedback[];
  /** Illustrative history of overall scores across prior attempts (oldest → newest). */
  history: number[];
  /** Coaching suggestions surfaced after the sample attempt. */
  coaching: string[];
  /**
   * The three selectable audio examples — native TTS, an intentionally bad
   * attempt, and a best-effort attempt — ordered for display. The best
   * example reuses `attempt`/`words`/`coaching`; the other two are derived.
   */
  examples: DemoExample[];
}

/** A demo item before its three audio examples are derived. */
type DemoItemBase = Omit<DemoItem, 'examples'>;

function attempt(
  id: string,
  overall: number,
  fluency: number,
  completeness: number,
  prosody: number,
  words: DemoWordFeedback[],
): AttemptScore {
  return {
    attemptId: id,
    sentenceId: id,
    overallAccuracy: overall,
    fluency,
    completeness,
    prosody,
    createdAt: '2026-06-30T12:00:00.000Z',
    recognitionStatus: 'Success',
    wordScores: words.map((w, index) => ({
      word: w.text,
      accuracy: w.score,
      errorType: w.errorType ?? 'none',
      azureWordIndex: index,
      referenceTokenIndex: index,
    })),
  };
}

/**
 * Score transforms used to derive the native and bad examples from the
 * hand-authored best-effort assessment. Deterministic (no randomness) so
 * the demo renders identically on every visit:
 *
 * - Native: clamped into 96–100. The reference audio *is* the target, so
 *   assessing it against itself scores near-perfect. Uses the original
 *   score's low bits for a little natural-looking variation.
 * - Bad: scaled down to roughly 60% (floored at 28) — an intentionally
 *   rough attempt where the tricky sounds fall apart.
 */
function toNativeScore(score: number): number {
  return Math.min(100, 96 + (score % 4));
}

function toBadScore(score: number): number {
  return Math.max(28, Math.round(score * 0.6));
}

function averageWordScore(words: DemoWordFeedback[]): number {
  return Math.round(words.reduce((sum, w) => sum + w.score, 0) / words.length);
}

function mapWordScores(
  words: DemoWordFeedback[],
  transform: (score: number) => number,
  errorFloor: number | null,
): DemoWordFeedback[] {
  return words.map((w) => {
    const score = transform(w.score);
    return {
      text: w.text,
      respelling: w.respelling,
      score,
      errorType: errorFloor !== null && score < errorFloor ? 'mispronounced' : undefined,
      phonemes: w.phonemes.map((p) => ({ symbol: p.symbol, score: transform(p.score) })),
      tip: w.tip,
    };
  });
}

/** Derive the three selectable audio examples for a demo sentence. */
function buildExamples(item: DemoItemBase): DemoExample[] {
  const nativeWords = mapWordScores(item.words, toNativeScore, null);
  const nativeOverall = averageWordScore(nativeWords);

  const badWords = mapWordScores(item.words, toBadScore, 65);
  const badOverall = averageWordScore(badWords);

  const focus = item.focusSounds.join(' and ');

  return [
    {
      kind: 'native',
      label: 'Native speaker',
      description:
        'Synthesized native-speaker audio — the reference the app compares every attempt against. Assessed against itself, it scores near-perfect.',
      audioUrl: getDemoNativeAudioUrl(item.id),
      audioBundled: true,
      attempt: attempt(`${item.attempt.attemptId}-native`, nativeOverall, 98, 100, 97, nativeWords),
      words: nativeWords,
      coaching: [
        'This is the synthesized native reference — the same voice the full app plays before you record.',
        `Listen for the ${focus}, then switch to the sample attempts to hear how the scoring reacts when they slip.`,
      ],
    },
    {
      kind: 'bad',
      label: 'My bad attempt',
      description:
        'A deliberately poor pronunciation of the same sentence, so you can see how the scoring pinpoints trouble.',
      audioUrl: getDemoAttemptAudioUrl(item.id, 'bad'),
      audioBundled: false,
      attempt: attempt(
        `${item.attempt.attemptId}-bad`,
        badOverall,
        Math.max(35, badOverall - 8),
        100,
        Math.max(30, badOverall - 12),
        badWords,
      ),
      words: badWords,
      coaching: [
        `An intentionally rough attempt — the ${focus} drift far from the native targets, and the word scores show exactly where.`,
        'Toggle between this attempt and the native speaker to hear the contrast the scores are picking up.',
      ],
    },
    {
      kind: 'best',
      label: 'My best attempt',
      description:
        'A realistic best effort — strong scores overall, with a few tricky sounds still left to polish.',
      audioUrl: getDemoAttemptAudioUrl(item.id, 'best'),
      audioBundled: false,
      attempt: item.attempt,
      words: item.words,
      coaching: item.coaching,
    },
  ];
}

/**
 * The fixed demo sentence set. Ordered strongest → trickiest so the demo
 * tells a coherent story: an easy greeting first, then progressively
 * harder PT-BR sounds (nasal diphthongs, the palatal "lh/nh", the tapped
 * "r"). Every `id` is a real sentence id, so native audio plays.
 */
const BASE_ITEMS: DemoItemBase[] = [
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'Oi,',
        respelling: 'Oy',
        score: 95,
        phonemes: [
          { symbol: 'OW', score: 96 },
          { symbol: 'IY', score: 94 },
        ],
      },
      {
        text: 'tudo',
        respelling: 'TOO-doo',
        score: 90,
        phonemes: [
          { symbol: 'T', score: 95 },
          { symbol: 'UW', score: 89 },
          { symbol: 'D', score: 93 },
          { symbol: 'UW', score: 84 },
        ],
        tip: 'The final "-o" reduces to a short "u" sound — "tudo" ends like "too-doo".',
      },
      {
        text: 'bem?',
        respelling: 'BAYNG',
        score: 80,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'B', score: 94 },
          { symbol: 'EN_NASAL', score: 72 },
          { symbol: 'Y', score: 78 },
        ],
        tip: 'The "em" is nasal and glides toward "y" — start from "bay" and keep the sound in your nose; do not finish with a hard "ng".',
      },
    ];
    return {
      id: 'gemini_small_talk_001',
      text: 'Oi, tudo bem?',
      translation: 'Hi, how are you?',
      difficulty: 1,
      cefr: 'A1',
      focusSounds: ['nasal em', 'vowel reduction'],
      attempt: attempt('demo-oi-tudo-bem', 88, 90, 100, 86, words),
      words,
      history: [72, 78, 83, 88],
      coaching: [
        'Nice and natural. The only soft spot is the nasal "em" in "bem" — let it resonate in your nose and glide up toward "y".',
        'Keep the final "-o" in "tudo" light and short; it reduces to "u", not a full "oh".',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'Estou',
        respelling: 'ees-TOH',
        score: 85,
        phonemes: [
          { symbol: 'IY', score: 82 },
          { symbol: 'S', score: 92 },
          { symbol: 'T', score: 90 },
          { symbol: 'OW', score: 84 },
        ],
        tip: 'The unstressed "es-" sounds like "is"; the "-ou" is a clean "oh".',
      },
      {
        text: 'muito',
        respelling: 'MWEEN-too',
        score: 82,
        phonemes: [
          { symbol: 'M', score: 94 },
          { symbol: 'UW', score: 86 },
          { symbol: 'IY', score: 80 },
          { symbol: 'T', score: 88 },
          { symbol: 'UW', score: 78 },
        ],
        tip: '"muito" carries a hidden nasal — it sounds like "muin-too".',
      },
      {
        text: 'feliz',
        respelling: 'feh-LEES',
        score: 84,
        phonemes: [
          { symbol: 'F', score: 96 },
          { symbol: 'EH', score: 86 },
          { symbol: 'L', score: 90 },
          { symbol: 'IY', score: 88 },
          { symbol: 'S', score: 80 },
        ],
        tip: 'A final "-z" is pronounced as a soft "s" here: "feh-lees".',
      },
      {
        text: 'hoje.',
        respelling: 'OH-zhee',
        score: 78,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'OW', score: 82 },
          { symbol: 'ZH', score: 72 },
          { symbol: 'IY', score: 80 },
        ],
        tip: 'The "h" is silent and the "j" is a soft "zh", like the "s" in "measure": "oh-zhee".',
      },
    ];
    return {
      id: 'gemini_feelings_001',
      text: 'Estou muito feliz hoje.',
      translation: "I'm very happy today.",
      difficulty: 2,
      cefr: 'A1',
      focusSounds: ['soft j (zh)', 'silent h'],
      attempt: attempt('demo-estou-feliz', 83, 85, 100, 81, words),
      words,
      history: [70, 74, 79, 83],
      coaching: [
        'The soft "j" (zh) in "hoje" is your best opportunity — the "h" is silent, so aim for "oh-zhee".',
        'Solid vowels overall. Keep the final "-z" of "feliz" light, closer to an "s".',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'A',
        respelling: 'Ah',
        score: 92,
        phonemes: [{ symbol: 'AH', score: 92 }],
      },
      {
        text: 'conta,',
        respelling: 'KOHN-tah',
        score: 78,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'K', score: 95 },
          { symbol: 'ON_NASAL', score: 66 },
          { symbol: 'T', score: 88 },
          { symbol: 'AH', score: 84 },
        ],
        tip: 'The "on" is nasal — let the air flow through your nose before the "t".',
      },
      {
        text: 'por',
        respelling: 'Pohr',
        score: 76,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'P', score: 94 },
          { symbol: 'OW', score: 82 },
          { symbol: 'R_TAP', score: 68 },
        ],
        tip: 'This "r" is a quick tongue tap, like the "tt" in American "butter".',
      },
      {
        text: 'favor.',
        respelling: 'fah-VOHR',
        score: 74,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'F', score: 96 },
          { symbol: 'AH', score: 88 },
          { symbol: 'V', score: 90 },
          { symbol: 'OW', score: 80 },
          { symbol: 'R_TAP', score: 66 },
        ],
        tip: 'End on a single tapped "r", not the English retroflex "r".',
      },
    ];
    return {
      id: 'gemini_food_003',
      text: 'A conta, por favor.',
      translation: 'The check, please.',
      difficulty: 3,
      cefr: 'A1',
      focusSounds: ['tapped r', 'nasal on'],
      attempt: attempt('demo-a-conta', 79, 82, 100, 77, words),
      words,
      history: [64, 70, 75, 79],
      coaching: [
        'The tapped "r" in "por favor" is your lowest sound. Practice "para" and "caro" to isolate the single tap between vowels.',
        'Nasalize the "on" in "conta" — keep the soft palate lowered so the air resonates in your nose.',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'Minha',
        respelling: 'MEEN-yah',
        score: 82,
        phonemes: [
          { symbol: 'M', score: 96 },
          { symbol: 'IY', score: 88 },
          { symbol: 'NH', score: 70 },
          { symbol: 'AH', score: 86 },
        ],
        tip: 'The "nh" is a palatal nasal, like the "ni" in "onion" — one sound, not "n" + "y".',
      },
      {
        text: 'mãe',
        respelling: 'MYE',
        score: 66,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'M', score: 95 },
          { symbol: 'AN_NASAL', score: 55 },
          { symbol: 'Y', score: 62 },
        ],
        tip: 'The "ãe" is a nasal "eye" glide — keep the airflow through your nose and do not finish with a hard "y".',
      },
      {
        text: 'se',
        respelling: 'See',
        score: 88,
        phonemes: [
          { symbol: 'S', score: 92 },
          { symbol: 'IY', score: 84 },
        ],
        tip: 'Before "chama", "se" softens to "si".',
      },
      {
        text: 'chama',
        respelling: 'SHAH-mah',
        score: 85,
        phonemes: [
          { symbol: 'SH', score: 88 },
          { symbol: 'AA', score: 90 },
          { symbol: 'M', score: 92 },
          { symbol: 'AH', score: 82 },
        ],
        tip: 'The "ch" is a single "sh" sound.',
      },
      {
        text: 'Ana.',
        respelling: 'AH-nah',
        score: 90,
        phonemes: [
          { symbol: 'AA', score: 92 },
          { symbol: 'N', score: 94 },
          { symbol: 'AH', score: 88 },
        ],
      },
    ];
    return {
      id: 'gemini_family_friends_001',
      text: 'Minha mãe se chama Ana.',
      translation: "My mother's name is Ana.",
      difficulty: 3,
      cefr: 'B2',
      focusSounds: ['nasal ãe', 'nh (palatal)'],
      attempt: attempt('demo-minha-mae', 74, 76, 100, 72, words),
      words,
      history: [60, 65, 70, 74],
      coaching: [
        'Keep the "eye" glide in "mãe" nasal from start to finish; never close into a hard "y".',
        'For "nh" in "Minha", press the middle of your tongue to the roof of your mouth — think "meen-ya" as one blended sound.',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'Que',
        respelling: 'Kee',
        score: 90,
        phonemes: [
          { symbol: 'K', score: 94 },
          { symbol: 'IY', score: 86 },
        ],
        tip: '"que" is just "ki" — the "u" is silent.',
      },
      {
        text: 'horas',
        respelling: 'OH-rahs',
        score: 80,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'OW', score: 84 },
          { symbol: 'R_TAP', score: 70 },
          { symbol: 'AA', score: 88 },
          { symbol: 'S', score: 90 },
        ],
        tip: 'The "h" is silent and the middle "r" is a quick tap: "OH-ras".',
      },
      {
        text: 'são?',
        respelling: 'SOWN',
        score: 64,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'S', score: 92 },
          { symbol: 'AN_NASAL', score: 52 },
          { symbol: 'W', score: 68 },
        ],
        tip: 'The "ão" is a nasal "own" glide — keep it resonating in the nose and do not finish with a hard "n".',
      },
    ];
    return {
      id: 'gemini_questions_005',
      text: 'Que horas são?',
      translation: 'What time is it?',
      difficulty: 4,
      cefr: 'B2',
      focusSounds: ['nasal ão', 'tapped r'],
      attempt: attempt('demo-que-horas-sao', 71, 74, 100, 69, words),
      words,
      history: [56, 62, 67, 71],
      coaching: [
        'The nasal "ão" in "são" is dragging the score down. Start from "own", keep the sound in your nose, and avoid a hard final "n".',
        'Remember the "h" in "horas" is silent, and the "r" is a single tap — not an English "r".',
      ],
    };
  })(),
];

export const DEMO_ITEMS: DemoItem[] = BASE_ITEMS.map((item) => ({
  ...item,
  examples: buildExamples(item),
}));

export function getDemoItem(id: string): DemoItem | undefined {
  return DEMO_ITEMS.find((item) => item.id === id);
}
