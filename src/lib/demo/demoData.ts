/**
 * Demo Mode Data — SAMPLE / MOCK DATA ONLY
 * ------------------------------------------------------------------
 * Everything in this file is hand-authored sample data used to power
 * the public `/demo` experience and parts of `/tour`. It lets a
 * visitor explore LusoPronounce's scoring, phoneme feedback, and
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
 * The SCORES, phoneme breakdowns, and attempt history are illustrative
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

/** A single phoneme within a demo word, with its illustrative score. */
export interface DemoPhonemeScore {
  /** Phoneme id matching data/phoneme_metadata.json (e.g. "LH", "AN_NASAL"). */
  symbol: string;
  score: number;
}

/** Word-level demo feedback, including its phoneme breakdown. */
export interface DemoWordFeedback {
  text: string;
  score: number;
  errorType?: ErrorType;
  phonemes: DemoPhonemeScore[];
  /** Short coaching note surfaced when the word is expanded. */
  tip?: string;
}

/** A complete demo item: a real sentence plus its sample assessment. */
export interface DemoItem {
  /** Real sentence id from masterSentences.json — also drives audio lookup. */
  id: string;
  /** Brazilian Portuguese sentence text. */
  text: string;
  /** English translation. */
  translation: string;
  /** Rough IPA transcription for display. */
  ipa: string;
  /** 1 (easiest) – 4 (hardest). */
  difficulty: number;
  /** CEFR level of the source sentence (e.g. "A1"). */
  cefr?: string;
  /** Human-friendly labels for the tricky sounds in this item. */
  focusSounds: string[];
  /** Sample assessment shown in the score card. */
  attempt: AttemptScore;
  /** Word-by-word breakdown with phonemes. */
  words: DemoWordFeedback[];
  /** Illustrative history of overall scores across prior attempts (oldest → newest). */
  history: number[];
  /** Coaching suggestions surfaced after the sample attempt. */
  coaching: string[];
  /**
   * Optional URL to a real learner recording of this sentence, so the
   * demo can play back "a sample attempt" alongside the native voice.
   * Drop a WAV/MP3 in `public/demo-audio/` and point this at it, e.g.
   * `/demo-audio/gemini_food_003.wav`. (Use `public/demo-audio/`, not
   * `public/audio/`, so it ships with the public static deploy.) Left
   * undefined when no recording is available yet.
   */
  learnerAudioUrl?: string;
}

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
 * The fixed demo sentence set. Ordered strongest → trickiest so the demo
 * tells a coherent story: an easy greeting first, then progressively
 * harder PT-BR sounds (nasal diphthongs, the palatal "lh/nh", the tapped
 * "r"). Every `id` is a real sentence id, so native audio plays.
 */
export const DEMO_ITEMS: DemoItem[] = [
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'Oi,',
        score: 95,
        phonemes: [
          { symbol: 'OW', score: 96 },
          { symbol: 'IY', score: 94 },
        ],
      },
      {
        text: 'tudo',
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
        score: 80,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'B', score: 94 },
          { symbol: 'EN_NASAL', score: 72 },
          { symbol: 'Y', score: 78 },
        ],
        tip: 'The "em" is nasal and glides toward "y" — "bẽi", not a flat English "beng".',
      },
    ];
    return {
      id: 'gemini_small_talk_001',
      text: 'Oi, tudo bem?',
      translation: 'Hi, how are you?',
      ipa: 'oj ˈtudu ˈbẽj',
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
      ipa: 'isˈto ˈmũjtu feˈlis ˈoʒi',
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
        score: 92,
        phonemes: [{ symbol: 'AH', score: 92 }],
      },
      {
        text: 'conta,',
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
      ipa: 'a ˈkõtɐ poɾ faˈvoɾ',
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
        score: 66,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'M', score: 95 },
          { symbol: 'AN_NASAL', score: 55 },
          { symbol: 'Y', score: 62 },
        ],
        tip: 'The "ãe" is a nasal diphthong — glide from a nasal "ã" toward "i" without stopping the airflow.',
      },
      {
        text: 'se',
        score: 88,
        phonemes: [
          { symbol: 'S', score: 92 },
          { symbol: 'IY', score: 84 },
        ],
        tip: 'Before "chama", "se" softens to "si".',
      },
      {
        text: 'chama',
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
      ipa: 'ˈmiɲɐ ˈmɐ̃j si ˈʃɐmɐ ˈɐnɐ',
      difficulty: 3,
      cefr: 'B2',
      focusSounds: ['nasal ãe', 'nh (palatal)'],
      attempt: attempt('demo-minha-mae', 74, 76, 100, 72, words),
      words,
      history: [60, 65, 70, 74],
      coaching: [
        'Both halves of the "ãe" in "mãe" need to stay nasal. Practice slowly: "mã—ẽ", never closing into a hard "y".',
        'For "nh" in "Minha", press the middle of your tongue to the roof of your mouth — think "meen-ya" as one blended sound.',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'Que',
        score: 90,
        phonemes: [
          { symbol: 'K', score: 94 },
          { symbol: 'IY', score: 86 },
        ],
        tip: '"que" is just "ki" — the "u" is silent.',
      },
      {
        text: 'horas',
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
        score: 64,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'S', score: 92 },
          { symbol: 'AN_NASAL', score: 52 },
          { symbol: 'W', score: 68 },
        ],
        tip: 'The "ão" is the same nasal diphthong as in "pão" — keep it resonating in the nose, then glide to "w".',
      },
    ];
    return {
      id: 'gemini_questions_005',
      text: 'Que horas são?',
      translation: 'What time is it?',
      ipa: 'ki ˈɔɾɐs ˈsɐ̃w',
      difficulty: 4,
      cefr: 'B2',
      focusSounds: ['nasal ão', 'tapped r'],
      attempt: attempt('demo-que-horas-sao', 71, 74, 100, 69, words),
      words,
      history: [56, 62, 67, 71],
      coaching: [
        'The nasal "ão" in "são" is dragging the score down. Hum "ãaão" with your mouth barely open, then add the final "w" glide.',
        'Remember the "h" in "horas" is silent, and the "r" is a single tap — not an English "r".',
      ],
    };
  })(),
];

export function getDemoItem(id: string): DemoItem | undefined {
  return DEMO_ITEMS.find((item) => item.id === id);
}
