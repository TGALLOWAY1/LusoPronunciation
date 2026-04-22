import { describe, expect, it } from 'vitest';
import { getVoiceTagFromUrl, isSameVoiceFamily } from './audioConsistency';

describe('getVoiceTagFromUrl', () => {
  it('parses male from /audio/ptbr/male/ paths', () => {
    expect(getVoiceTagFromUrl('/audio/ptbr/male/basic_001.wav')).toBe('male');
  });

  it('parses female from /audio/ptbr/female/ paths', () => {
    expect(getVoiceTagFromUrl('/audio/ptbr/female/basic_001.wav')).toBe('female');
  });

  it('parses ptbr_male / ptbr_female segments', () => {
    expect(getVoiceTagFromUrl('/audio/words/ptbr_male/basic_001.wav')).toBe('male');
    expect(getVoiceTagFromUrl('/audio/words/ptbr_female/basic_001.wav')).toBe('female');
  });

  it('parses trailing _male / _female filename suffix', () => {
    expect(getVoiceTagFromUrl('/audio/words/basic_001_male.wav')).toBe('male');
    expect(getVoiceTagFromUrl('/audio/words/basic_001_female.wav')).toBe('female');
  });

  it('returns null when no voice tag is present', () => {
    expect(getVoiceTagFromUrl('/audio/foo/bar.wav')).toBeNull();
    expect(getVoiceTagFromUrl('')).toBeNull();
    expect(getVoiceTagFromUrl(null)).toBeNull();
    expect(getVoiceTagFromUrl(undefined)).toBeNull();
  });
});

describe('isSameVoiceFamily', () => {
  it('is true when sentence and words all match the selected voice', () => {
    expect(
      isSameVoiceFamily(
        '/audio/ptbr/male/s1.wav',
        ['/audio/ptbr/male/w1.wav', '/audio/words/w2_male.wav'],
        'male'
      )
    ).toBe(true);
  });

  it('is false when sentence voice disagrees with selected', () => {
    expect(isSameVoiceFamily('/audio/ptbr/female/s1.wav', [], 'male')).toBe(false);
  });

  it('is false when any word voice disagrees with selected', () => {
    expect(
      isSameVoiceFamily(
        '/audio/ptbr/male/s1.wav',
        ['/audio/ptbr/male/w1.wav', '/audio/ptbr/female/w2.wav'],
        'male'
      )
    ).toBe(false);
  });

  it('treats untagged URLs as consistent', () => {
    expect(
      isSameVoiceFamily('/audio/s1.wav', ['/audio/w1.wav', null, undefined], 'female')
    ).toBe(true);
  });
});
