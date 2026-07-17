import { getPhonemeById } from './phonemeMetadata';

export interface PronunciationReference {
  sound: string;
  word: string;
}

export interface PronunciationSpellingRule {
  spelling: string;
  sound: string;
  referenceWord?: string;
}

export interface PronunciationGuide {
  respelling: string;
  references: PronunciationReference[];
  spellingRules: PronunciationSpellingRule[];
}

interface BuildPronunciationGuideOptions {
  word: string;
  phonemes?: string[];
  pronunciationNote?: string;
  respelling?: string;
}

interface EyeDialectPhone {
  id: string;
  text: string;
  vowel: boolean;
}

const EYE_DIALECT: Record<string, Omit<EyeDialectPhone, 'id'>> = {
  AA: { text: 'ah', vowel: true },
  AH: { text: 'uh', vowel: true },
  EY: { text: 'ay', vowel: true },
  EH: { text: 'eh', vowel: true },
  IY: { text: 'ee', vowel: true },
  OW: { text: 'oh', vowel: true },
  AO: { text: 'aw', vowel: true },
  UW: { text: 'oo', vowel: true },
  AN_NASAL: { text: 'uhn', vowel: true },
  EN_NASAL: { text: 'eng', vowel: true },
  IN_NASAL: { text: 'eeng', vowel: true },
  ON_NASAL: { text: 'ohng', vowel: true },
  UN_NASAL: { text: 'oong', vowel: true },
  P: { text: 'p', vowel: false },
  B: { text: 'b', vowel: false },
  T: { text: 't', vowel: false },
  D: { text: 'd', vowel: false },
  K: { text: 'k', vowel: false },
  G: { text: 'g', vowel: false },
  CH: { text: 'ch', vowel: false },
  JH: { text: 'j', vowel: false },
  F: { text: 'f', vowel: false },
  V: { text: 'v', vowel: false },
  S: { text: 's', vowel: false },
  Z: { text: 'z', vowel: false },
  SH: { text: 'sh', vowel: false },
  ZH: { text: 'zh', vowel: false },
  HH: { text: 'h', vowel: false },
  M: { text: 'm', vowel: false },
  N: { text: 'n', vowel: false },
  NH: { text: 'ny', vowel: false },
  L: { text: 'l', vowel: false },
  LH: { text: 'ly', vowel: false },
  R_TAP: { text: 'r', vowel: false },
  W: { text: 'w', vowel: false },
  Y: { text: 'y', vowel: false },
};

const PHONEME_ALIASES: Record<string, string> = {
  R: 'R_TAP',
  AX: 'AH',
  AE: 'EH',
  IH: 'IY',
  UH: 'UW',
  NG: 'N',
};

const REFERENCE_WORDS: Record<string, PronunciationReference> = {
  AA: { sound: 'ah', word: 'father' },
  AH: { sound: 'uh', word: 'sofa' },
  EY: { sound: 'ay', word: 'say' },
  EH: { sound: 'eh', word: 'bet' },
  IY: { sound: 'ee', word: 'see' },
  OW: { sound: 'oh', word: 'go' },
  AO: { sound: 'aw', word: 'law' },
  UW: { sound: 'oo', word: 'food' },
  AN_NASAL: { sound: 'nasal uh', word: 'huh' },
  EN_NASAL: { sound: 'nasal ay', word: 'pain' },
  IN_NASAL: { sound: 'nasal ee', word: 'seen' },
  ON_NASAL: { sound: 'nasal oh', word: 'own' },
  UN_NASAL: { sound: 'nasal oo', word: 'moon' },
  P: { sound: 'P', word: 'spin' },
  B: { sound: 'B', word: 'boy' },
  T: { sound: 'T', word: 'stop' },
  D: { sound: 'D', word: 'dog' },
  K: { sound: 'K', word: 'skate' },
  G: { sound: 'G', word: 'go' },
  CH: { sound: 'CH', word: 'cheese' },
  JH: { sound: 'J', word: 'jeep' },
  F: { sound: 'F', word: 'fan' },
  V: { sound: 'V', word: 'van' },
  S: { sound: 'S', word: 'sun' },
  Z: { sound: 'Z', word: 'zoo' },
  SH: { sound: 'SH', word: 'shoe' },
  ZH: { sound: 'ZH', word: 'pleasure' },
  HH: { sound: 'H', word: 'hat' },
  M: { sound: 'M', word: 'mom' },
  N: { sound: 'N', word: 'no' },
  NH: { sound: 'NY', word: 'canyon' },
  L: { sound: 'L', word: 'love' },
  LH: { sound: 'LY', word: 'million' },
  R_TAP: { sound: 'quick D', word: 'ladder' },
  W: { sound: 'W', word: 'water' },
  Y: { sound: 'Y', word: 'yes' },
};

const ALLOWED_ONSETS = new Set([
  'BR', 'BL', 'CR', 'CL', 'DR', 'FR', 'FL', 'GR', 'GL', 'PR', 'PL', 'TR', 'VR',
]);

function normalizePhonemeId(id: string): string {
  const upper = id.trim().toUpperCase();
  return PHONEME_ALIASES[upper] ?? upper;
}

function pronunciationPhonemes(word: string, phonemes: string[]): string[] {
  const normalized = phonemes.map(normalizePhonemeId);

  // In Brazilian Portuguese, a written R at the start is the English H-like
  // sound even when older canonical data labels it as a tap.
  if (/^r/i.test(word.trim()) && normalized[0] === 'R_TAP') {
    normalized[0] = 'HH';
  }

  return normalized;
}

function mergeDiphthongs(phones: EyeDialectPhone[]): EyeDialectPhone[] {
  const merged: EyeDialectPhone[] = [];

  for (let index = 0; index < phones.length; index += 1) {
    const current = phones[index];
    const next = phones[index + 1];
    const pair = next ? `${current.id}+${next.id}` : '';
    const diphthong =
      pair === 'AN_NASAL+OW' ? 'own' :
      pair === 'OW+IY' ? 'oy' :
      pair === 'EH+IY' ? 'ay' :
      pair === 'AA+IY' ? 'eye' :
      pair === 'AA+UW' ? 'ow' :
      undefined;

    if (diphthong) {
      merged.push({ id: pair, text: diphthong, vowel: true });
      index += 1;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function splitIntervocalicConsonants(consonants: EyeDialectPhone[]): {
  coda: EyeDialectPhone[];
  onset: EyeDialectPhone[];
} {
  if (consonants.length <= 1) {
    return { coda: [], onset: consonants };
  }

  const lastTwo = consonants.slice(-2);
  const cluster = lastTwo.map((phone) => phone.id === 'R_TAP' ? 'R' : phone.id).join('');
  if (ALLOWED_ONSETS.has(cluster)) {
    return {
      coda: consonants.slice(0, -2),
      onset: lastTwo,
    };
  }

  return {
    coda: consonants.slice(0, -1),
    onset: consonants.slice(-1),
  };
}

function respellFromPhonemes(word: string, phonemes: string[]): string {
  const normalized = pronunciationPhonemes(word, phonemes);
  const phones = mergeDiphthongs(
    normalized
      .map((id) => EYE_DIALECT[id] ? { id, ...EYE_DIALECT[id] } : undefined)
      .filter((phone): phone is EyeDialectPhone => phone !== undefined),
  );
  const vowelIndices = phones
    .map((phone, index) => phone.vowel ? index : -1)
    .filter((index) => index >= 0);

  if (vowelIndices.length === 0) {
    return word;
  }

  const syllables: string[] = [];
  let onset = phones.slice(0, vowelIndices[0]);

  vowelIndices.forEach((vowelIndex, position) => {
    const nextVowelIndex = vowelIndices[position + 1];
    const consonants = nextVowelIndex === undefined
      ? phones.slice(vowelIndex + 1)
      : phones.slice(vowelIndex + 1, nextVowelIndex);
    const split = nextVowelIndex === undefined
      ? { coda: consonants, onset: [] }
      : splitIntervocalicConsonants(consonants);

    syllables.push([...onset, phones[vowelIndex], ...split.coda].map((phone) => phone.text).join(''));
    onset = split.onset;
  });

  const respelling = syllables.filter(Boolean).join('-');
  return respelling.charAt(0).toUpperCase() + respelling.slice(1);
}

function extractRespellingFromNote(note?: string): string | undefined {
  if (!note) {
    return undefined;
  }

  const parenthetical = [...note.matchAll(/\(([^()]*)\)/g)]
    .map((match) => match[1].trim())
    .filter((candidate) => /^\p{L}+(?:-\p{L}+)+$/u.test(candidate));
  if (parenthetical.length > 0) {
    return parenthetical[parenthetical.length - 1];
  }

  const hyphenated = note.match(/(?<!\p{L})\p{L}+(?:-\p{L}+)+(?!\p{L})/gu) ?? [];
  const eyeDialectCandidate = hyphenated
    .filter((candidate) => /[A-Z]{2}|ee|oo|ah|eh|ay|oy|sh|zh|ny|ly/i.test(candidate))
    .sort((a, b) => b.length - a.length)[0];
  if (eyeDialectCandidate) {
    return eyeDialectCandidate;
  }

  const soundsLike = note.match(/^Sounds like ['‘]([^'’]+)['’]/i);
  if (soundsLike && /^\p{L}+$/u.test(soundsLike[1])) {
    const candidate = soundsLike[1];
    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  return undefined;
}

function buildReferences(word: string, phonemes: string[]): PronunciationReference[] {
  const ids = pronunciationPhonemes(word, phonemes);
  const references: PronunciationReference[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const curated = REFERENCE_WORDS[id];
    const metadata = getPhonemeById(id);
    const reference = curated ?? (
      metadata?.englishExamples?.[0]
        ? { sound: EYE_DIALECT[id]?.text ?? id, word: metadata.englishExamples[0] }
        : undefined
    );

    if (reference && !seen.has(reference.sound.toLowerCase())) {
      references.push(reference);
      seen.add(reference.sound.toLowerCase());
    }
  }

  return references.slice(0, 4);
}

function buildSpellingRules(word: string): PronunciationSpellingRule[] {
  const normalized = word.normalize('NFC').toLowerCase().trim();
  const rules: PronunciationSpellingRule[] = [];
  const add = (rule: PronunciationSpellingRule) => {
    if (!rules.some((existing) => existing.spelling === rule.spelling)) {
      rules.push(rule);
    }
  };

  if (/^r/.test(normalized)) add({ spelling: 'R at the start', sound: '"H" sound', referenceWord: 'hat' });
  if (/rr/.test(normalized)) add({ spelling: 'RR between vowels', sound: 'strong "H" sound', referenceWord: 'hat' });
  if (/nh/.test(normalized)) add({ spelling: 'NH', sound: '"NY" sound', referenceWord: 'canyon' });
  if (/lh/.test(normalized)) add({ spelling: 'LH', sound: '"LY" sound', referenceWord: 'million' });
  if (/ch/.test(normalized)) add({ spelling: 'CH', sound: '"SH" sound', referenceWord: 'shoe' });
  if (/ão/.test(normalized)) add({ spelling: 'ÃO', sound: 'nasal "OWN" sound' });
  if (/ãe/.test(normalized)) add({ spelling: 'ÃE', sound: 'nasal "EYE" sound' });
  if (/ç/.test(normalized)) add({ spelling: 'Ç', sound: '"S" sound', referenceWord: 'sun' });
  if (/c[eiéêí]/.test(normalized)) add({ spelling: 'C before E or I', sound: '"S" sound', referenceWord: 'sun' });
  if (/g[eiéêí]/.test(normalized)) add({ spelling: 'G before E or I', sound: '"ZH" sound', referenceWord: 'pleasure' });
  if (/j/.test(normalized)) add({ spelling: 'J', sound: '"ZH" sound', referenceWord: 'pleasure' });
  if (/[aeiouáéíóúâêôãõ]s[aeiouáéíóúâêôãõ]/.test(normalized)) add({ spelling: 'S between vowels', sound: '"Z" sound', referenceWord: 'zoo' });
  if (/^h/.test(normalized)) add({ spelling: 'H at the start', sound: 'silent' });
  if (/ti|te$/.test(normalized)) add({ spelling: 'T before an "ee" sound', sound: '"CH" sound', referenceWord: 'cheese' });
  if (/di|de$/.test(normalized)) add({ spelling: 'D before an "ee" sound', sound: '"J" sound', referenceWord: 'jeep' });
  if (/[aeiouáéíóúâêôãõ][mn](?:[^aeiouáéíóúâêôãõ]|$)/.test(normalized)) {
    add({ spelling: 'Vowel before M or N', sound: 'nasal vowel; do not fully pronounce the M or N' });
  }

  if (rules.length === 0) {
    add({ spelling: 'Portuguese vowels', sound: 'clear, steady sounds; say every syllable' });
  }

  return rules.slice(0, 3);
}

export function buildPronunciationGuide({
  word,
  phonemes = [],
  pronunciationNote,
  respelling: providedRespelling,
}: BuildPronunciationGuideOptions): PronunciationGuide {
  const rawNoteRespelling = extractRespellingFromNote(pronunciationNote);
  // Older notes spell a word-initial R literally (e.g. "RU-a") instead of
  // the "H" sound the spelling rules teach; only trust the note once it
  // already follows that convention, otherwise fall back to the phoneme-
  // derived respelling so the two don't contradict each other.
  const initialSoundIsH = phonemes.length > 0 && pronunciationPhonemes(word, phonemes)[0] === 'HH';
  const noteRespelling = rawNoteRespelling && (!initialSoundIsH || /^h/i.test(rawNoteRespelling.trim()))
    ? rawNoteRespelling
    : undefined;
  const respelling = providedRespelling ?? noteRespelling ?? (
    phonemes.length > 0 ? respellFromPhonemes(word, phonemes) : word
  );

  return {
    respelling,
    references: buildReferences(word, phonemes),
    spellingRules: buildSpellingRules(word),
  };
}

export function getEyeDialectSound(phoneme: string): string {
  const id = normalizePhonemeId(phoneme);
  return REFERENCE_WORDS[id]?.sound ?? EYE_DIALECT[id]?.text ?? 'this sound';
}

export function getReferenceWord(phoneme: string): string | undefined {
  return REFERENCE_WORDS[normalizePhonemeId(phoneme)]?.word;
}
