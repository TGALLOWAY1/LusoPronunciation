export type ConfusionTag =
  | 'vowel_open_close'
  | 'nasalization'
  | 'r_initial'
  | 'r_rr'
  | 'lh_nh'
  | 'tch_ti'
  | 'dji_di'
  | 's_z'
  | 'final_l_u'
  | 'b_p'
  | 'f_v'
  | 't_d'
  | 'k_g';

export type MinimalPair = {
  a: string;
  b: string;
  note?: string;
  tags: ConfusionTag[];
};

export type MinimalPairDrill = {
  tags: ConfusionTag[];
  pairs: MinimalPair[];
};

export const PTBR_MINIMAL_PAIRS: MinimalPair[] = [
  { a: 'avó', b: 'avô', note: 'Open vs closed O in stressed syllables.', tags: ['vowel_open_close'] },
  { a: 'pode', b: 'pôde', note: 'Present vs past pronunciation contrast.', tags: ['vowel_open_close'] },
  { a: 'forma', b: 'fôrma', note: 'Open vs closed O in stressed syllables.', tags: ['vowel_open_close'] },

  { a: 'ma', b: 'mã', note: 'Nasalize the vowel in the second word.', tags: ['nasalization'] },
  { a: 'la', b: 'lã', note: 'Keep the second vowel nasal and sustained.', tags: ['nasalization'] },
  { a: 'mata', b: 'manta', note: 'Add clear nasal resonance before -nta.', tags: ['nasalization'] },
  { a: 'cata', b: 'canta', note: 'Nasalize before N in the second form.', tags: ['nasalization'] },

  { a: 'rua', b: 'lua', note: 'PT-BR initial R should stay strong and breathy.', tags: ['r_initial'] },
  { a: 'rato', b: 'lato', note: 'Differentiate initial R from L cleanly.', tags: ['r_initial'] },
  { a: 'riso', b: 'liso', note: 'Keep the first consonant distinct (R vs L).', tags: ['r_initial'] },

  { a: 'caro', b: 'carro', note: 'Tap R vs stronger RR in the middle.', tags: ['r_rr'] },
  { a: 'coro', b: 'corro', note: 'Lengthen and roughen the RR sound.', tags: ['r_rr'] },
  { a: 'para', b: 'parra', note: 'Single R is lighter than RR.', tags: ['r_rr'] },

  { a: 'malha', b: 'manha', note: 'Contrast LH /ly/ and NH /ny/ clearly.', tags: ['lh_nh'] },
  { a: 'pilha', b: 'pinha', note: 'Keep LH and NH tongue positions separate.', tags: ['lh_nh'] },
  { a: 'galho', b: 'ganho', note: 'Aim for LH glide vs NH nasal glide.', tags: ['lh_nh'] },

  { a: 'tio', b: 'tchio', note: 'Avoid adding a ch-sound before TI.', tags: ['tch_ti'] },
  { a: 'tia', b: 'tchia', note: 'Say TI directly, without extra affrication.', tags: ['tch_ti'] },
  { a: 'ativo', b: 'atchivo', note: 'Keep TI crisp and light.', tags: ['tch_ti'] },

  { a: 'dia', b: 'djia', note: 'Avoid adding a j-glide before DI.', tags: ['dji_di'] },
  { a: 'difícil', b: 'djifícil', note: 'Keep DI clean, especially at word start.', tags: ['dji_di'] },
  { a: 'adiante', b: 'adjiante', note: 'Maintain DI without extra glide.', tags: ['dji_di'] },

  { a: 'casa', b: 'caça', note: 'Voice the S in casa; keep Ç voiceless in caça.', tags: ['s_z'] },
  { a: 'coser', b: 'cozer', note: 'Contrast voiceless S and voiced Z.', tags: ['s_z'] },
  { a: 'preso', b: 'preço', note: 'S in preso can voice between vowels.', tags: ['s_z'] },

  { a: 'mal', b: 'mau', note: 'Final L in PT-BR often sounds like a soft U glide.', tags: ['final_l_u'] },
  { a: 'sol', b: 'sou', note: 'Keep final L rounded, not fully alveolar.', tags: ['final_l_u'] },
  { a: 'Brasil', b: 'Brasiu', note: 'Learner contrast: final L tends toward U-like sound.', tags: ['final_l_u'] },
  { a: 'jornal', b: 'jornau', note: 'Practice the PT-BR final L release.', tags: ['final_l_u'] },
  { a: 'papel', b: 'papeu', note: 'Use a rounded glide at final L.', tags: ['final_l_u'] },

  { a: 'bala', b: 'pala', note: 'Keep B voiced and P unvoiced.', tags: ['b_p'] },
  { a: 'bato', b: 'pato', note: 'Short voicing onset distinguishes B/P.', tags: ['b_p'] },
  { a: 'bico', b: 'pico', note: 'Feel vocal fold vibration for B.', tags: ['b_p'] },

  { a: 'faca', b: 'vaca', note: 'F is voiceless; V is voiced.', tags: ['f_v'] },
  { a: 'fila', b: 'vila', note: 'Turn on voicing for V in vila.', tags: ['f_v'] },
  { a: 'fenda', b: 'venda', note: 'Contrast fricative voicing (F vs V).', tags: ['f_v'] },

  { a: 'tia', b: 'dia', note: 'T is voiceless; D is voiced.', tags: ['t_d'] },
  { a: 'tato', b: 'dado', note: 'Use stronger voicing onset on D.', tags: ['t_d'] },
  { a: 'tomo', b: 'domo', note: 'Separate T and D with clear voicing contrast.', tags: ['t_d'] },

  { a: 'cama', b: 'gama', note: 'K-like C is voiceless; G is voiced.', tags: ['k_g'] },
  { a: 'cola', b: 'gola', note: 'Voice G from the first consonant release.', tags: ['k_g'] },
  { a: 'cato', b: 'gato', note: 'Keep C/G contrast consistent in quick speech.', tags: ['k_g'] },
];

export function getMinimalPairsForTag(tag: ConfusionTag): MinimalPair[] {
  return PTBR_MINIMAL_PAIRS.filter((pair) => pair.tags.includes(tag));
}

export function pickMinimalPairsByTags(
  tags: ConfusionTag[],
  limit: number = 3
): MinimalPair[] {
  if (tags.length === 0 || limit <= 0) {
    return [];
  }

  const uniquePairs: MinimalPair[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const pairsForTag = getMinimalPairsForTag(tag);

    for (const pair of pairsForTag) {
      if (uniquePairs.length >= limit) {
        return uniquePairs;
      }

      const key = `${pair.a}::${pair.b}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      uniquePairs.push(pair);
    }
  }

  return uniquePairs.slice(0, limit);
}
