import { describe, expect, it } from 'vitest';
import { findHomograph } from './homographs';

describe('findHomograph', () => {
  it('returns an entry for a known homograph', () => {
    const entry = findHomograph('sede');
    expect(entry).not.toBeNull();
    expect(entry?.form).toBe('sede');
    expect(entry?.readings.length).toBeGreaterThanOrEqual(2);
    expect(entry?.readings[0].meaning).toMatch(/thirst/i);
  });

  it('is case-insensitive', () => {
    expect(findHomograph('SEDE')).not.toBeNull();
    expect(findHomograph('Sede')).not.toBeNull();
  });

  it('is diacritic-insensitive', () => {
    expect(findHomograph('começo')).not.toBeNull();
    expect(findHomograph('comeco')).not.toBeNull();
  });

  it('returns null for words not in the dictionary', () => {
    expect(findHomograph('mundo')).toBeNull();
    expect(findHomograph('obrigado')).toBeNull();
  });

  it('returns null for empty or nullish input', () => {
    expect(findHomograph('')).toBeNull();
    expect(findHomograph('   ')).toBeNull();
    expect(findHomograph(null)).toBeNull();
    expect(findHomograph(undefined)).toBeNull();
  });
});
