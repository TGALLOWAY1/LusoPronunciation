import { describe, expect, it } from 'vitest';
import { deriveStatus } from './customSentenceService';
import type { CustomSentenceTokenDto } from '../../shared/types/customSentence';

function token(
  position: number,
  confidence: CustomSentenceTokenDto['confidence']
): CustomSentenceTokenDto {
  return {
    position,
    surfaceForm: `t${position}`,
    normalizedForm: `t${position}`,
    confidence,
  };
}

describe('deriveStatus', () => {
  it('returns needs_review for empty tokens', () => {
    expect(deriveStatus([])).toBe('needs_review');
  });

  it('returns ready when every token is high confidence', () => {
    expect(
      deriveStatus([token(0, 'high'), token(1, 'high'), token(2, 'high')])
    ).toBe('ready');
  });

  it('returns needs_review when any token is low confidence', () => {
    expect(
      deriveStatus([token(0, 'high'), token(1, 'low')])
    ).toBe('needs_review');
  });

  it('returns partial_support when any token is medium and none are low', () => {
    expect(
      deriveStatus([token(0, 'high'), token(1, 'medium')])
    ).toBe('partial_support');
  });
});
