/**
 * Demo Mode Data — SAMPLE / MOCK DATA ONLY
 * ------------------------------------------------------------------
 * Everything in this file is hand-authored sample data used to power
 * the public `/demo` experience and parts of `/tour`. It lets a
 * visitor explore LusoPronounce's scoring, phoneme feedback, and
 * progress tracking WITHOUT an account, Azure Speech credentials, a
 * microphone, or a database.
 *
 * These numbers are illustrative and are NOT real Azure Speech
 * pronunciation-assessment output. The UI clearly labels this as demo
 * data wherever it is shown.
 */

import type { AttemptScore, ErrorType } from '@/types/pronunciation';

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

/** A complete demo item: a word or phrase plus its sample assessment. */
export interface DemoItem {
  id: string;
  /** Brazilian Portuguese text. */
  text: string;
  /** English translation. */
  translation: string;
  /** Rough IPA transcription for display. */
  ipa: string;
  /** 1 (easiest) – 4 (hardest). */
  difficulty: number;
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
 * The fixed demo word/phrase set. Ordered easiest → hardest so the demo
 * tells a coherent story about progressively trickier PT-BR sounds.
 */
export const DEMO_ITEMS: DemoItem[] = [
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'não',
        score: 71,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'N', score: 94 },
          { symbol: 'AN_NASAL', score: 58 },
          { symbol: 'W', score: 74 },
        ],
        tip: 'Let the air flow through your nose on the "ão" — don\'t close it into a hard "w".',
      },
    ];
    return {
      id: 'nao',
      text: 'não',
      translation: 'no',
      ipa: 'nɐ̃w̃',
      difficulty: 2,
      focusSounds: ['nasal ão'],
      attempt: attempt('demo-nao', 71, 78, 100, 69, words),
      words,
      history: [58, 63, 66, 71],
      coaching: [
        'Your nasal vowel "ão" is the weakest sound here. Practice humming "ãaão" with your mouth barely open.',
        'Try the minimal pair "pau" vs "pão" to feel the nasal contrast.',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'pão',
        score: 68,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'P', score: 96 },
          { symbol: 'AN_NASAL', score: 52 },
          { symbol: 'W', score: 70 },
        ],
        tip: 'Nasalize the vowel before the glide — the "ão" should resonate in the nose.',
      },
    ];
    return {
      id: 'pao',
      text: 'pão',
      translation: 'bread',
      ipa: 'pɐ̃w̃',
      difficulty: 2,
      focusSounds: ['nasal ão'],
      attempt: attempt('demo-pao', 68, 74, 100, 65, words),
      words,
      history: [55, 60, 64, 68],
      coaching: [
        'The nasal diphthong "ão" is dragging your score down. Keep the soft palate lowered throughout the vowel.',
        'Contrast "pau" (stick) with "pão" (bread) to train the nasalization.',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
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
    ];
    return {
      id: 'mae',
      text: 'mãe',
      translation: 'mother',
      ipa: 'mɐ̃j̃',
      difficulty: 3,
      focusSounds: ['nasal ãe'],
      attempt: attempt('demo-mae', 66, 70, 100, 64, words),
      words,
      history: [52, 57, 61, 66],
      coaching: [
        'Both halves of the "ãe" diphthong need to stay nasal. Practice slowly: "mã—ẽ".',
        'Compare "mãe" with the non-nasal "mais" to hear the difference.',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'filho',
        score: 74,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'F', score: 97 },
          { symbol: 'IY', score: 90 },
          { symbol: 'LH', score: 61 },
          { symbol: 'UW', score: 72 },
        ],
        tip: 'The "lh" is one sound (like the "lli" in "million"), not "l" + "y".',
      },
    ];
    return {
      id: 'filho',
      text: 'filho',
      translation: 'son',
      ipa: 'ˈfiʎu',
      difficulty: 3,
      focusSounds: ['lh (palatal l)', 'unstressed final -o'],
      attempt: attempt('demo-filho', 74, 80, 100, 72, words),
      words,
      history: [60, 65, 70, 74],
      coaching: [
        'Press the middle of your tongue against the roof of your mouth for "lh" — avoid an English "ly".',
        'The final "-o" reduces to a short "u" sound; keep it light and quick.',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'obrigado',
        score: 82,
        phonemes: [
          { symbol: 'OW', score: 84 },
          { symbol: 'B', score: 95 },
          { symbol: 'R_TAP', score: 70 },
          { symbol: 'IY', score: 91 },
          { symbol: 'G', score: 93 },
          { symbol: 'AA', score: 88 },
          { symbol: 'D', score: 94 },
          { symbol: 'UW', score: 74 },
        ],
        tip: 'The "r" in "-brig-" is a quick tongue tap, like the "tt" in American "butter".',
      },
    ];
    return {
      id: 'obrigado',
      text: 'obrigado',
      translation: 'thank you',
      ipa: 'obɾiˈgadu',
      difficulty: 2,
      focusSounds: ['tapped r', 'unstressed final -o'],
      attempt: attempt('demo-obrigado', 82, 85, 100, 80, words),
      words,
      history: [70, 74, 79, 82],
      coaching: [
        'Nice work — your consonants are solid. The tapped "r" is your main opportunity.',
        'Say "para" and "caro" to isolate the single-tap "r" between vowels.',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'trabalho',
        score: 70,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'T', score: 93 },
          { symbol: 'R_TAP', score: 66 },
          { symbol: 'AA', score: 89 },
          { symbol: 'B', score: 94 },
          { symbol: 'AA', score: 87 },
          { symbol: 'LH', score: 58 },
          { symbol: 'UW', score: 73 },
        ],
        tip: 'Two tricky sounds here: the tapped "r" and the palatal "lh". Slow the word down and hit each.',
      },
    ];
    return {
      id: 'trabalho',
      text: 'trabalho',
      translation: 'work',
      ipa: 'tɾaˈbaʎu',
      difficulty: 3,
      focusSounds: ['tapped r', 'lh (palatal l)'],
      attempt: attempt('demo-trabalho', 70, 74, 100, 68, words),
      words,
      history: [56, 61, 66, 70],
      coaching: [
        'The "lh" is your lowest sound. Anchor the tongue mid-mouth and voice it: "ba-lyo" → "baʎo".',
        'The "tr" cluster uses a tapped "r", not the English retroflex "r".',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'coração',
        score: 69,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'K', score: 95 },
          { symbol: 'OW', score: 82 },
          { symbol: 'R_TAP', score: 67 },
          { symbol: 'AA', score: 88 },
          { symbol: 'S', score: 90 },
          { symbol: 'AN_NASAL', score: 54 },
          { symbol: 'W', score: 71 },
        ],
        tip: 'Ends on the nasal "ão" — the same sound as "pão" and "não". Keep it resonating in the nose.',
      },
    ];
    return {
      id: 'coracao',
      text: 'coração',
      translation: 'heart',
      ipa: 'koɾaˈsɐ̃w̃',
      difficulty: 3,
      focusSounds: ['tapped r', 'nasal ão'],
      attempt: attempt('demo-coracao', 69, 72, 100, 67, words),
      words,
      history: [54, 59, 64, 69],
      coaching: [
        'The final "ão" and the medial tapped "r" are both below target. Drill them separately, then together.',
        'The "ç" is just an "s" sound — that part is already strong.',
      ],
    };
  })(),
  (() => {
    const words: DemoWordFeedback[] = [
      {
        text: 'Rio',
        score: 64,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'HH', score: 55 },
          { symbol: 'IY', score: 88 },
          { symbol: 'UW', score: 76 },
        ],
        tip: 'Word-initial "R" in PT-BR is guttural (like a soft "h" from the throat), not an English "r".',
      },
      {
        text: 'de',
        score: 83,
        phonemes: [
          { symbol: 'JH', score: 80 },
          { symbol: 'IY', score: 86 },
        ],
        tip: 'Before an "i" sound, "de" softens toward "dji".',
      },
      {
        text: 'Janeiro',
        score: 72,
        errorType: 'mispronounced',
        phonemes: [
          { symbol: 'ZH', score: 68 },
          { symbol: 'AH', score: 84 },
          { symbol: 'N', score: 92 },
          { symbol: 'EY', score: 85 },
          { symbol: 'R_TAP', score: 70 },
          { symbol: 'UW', score: 75 },
        ],
        tip: 'The "J" is a soft "zh" sound, like the "s" in "measure".',
      },
    ];
    return {
      id: 'rio-de-janeiro',
      text: 'Rio de Janeiro',
      translation: 'Rio de Janeiro',
      ipa: 'ˈʁiu dʒi ʒɐˈnejɾu',
      difficulty: 4,
      focusSounds: ['guttural R', 'zh (soft J)', 'tapped r'],
      attempt: attempt('demo-rio', 73, 76, 100, 71, words),
      words,
      history: [58, 63, 68, 73],
      coaching: [
        'The guttural "R" at the start of "Rio" is the biggest win here — practice it like clearing your throat gently.',
        'The "J" in "Janeiro" is a soft "zh", not an English "j".',
      ],
    };
  })(),
];

export function getDemoItem(id: string): DemoItem | undefined {
  return DEMO_ITEMS.find((item) => item.id === id);
}
