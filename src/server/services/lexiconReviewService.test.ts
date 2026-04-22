import { describe, expect, it, vi } from 'vitest';

const findByIdMock = vi.hoisted(() => vi.fn());

vi.mock('../models/LexiconReviewItemModel', () => ({
  LexiconReviewItemModel: {
    findById: findByIdMock,
  },
}));

import {
  LexiconReviewError,
  promoteReviewItem,
  rejectReviewItem,
} from './lexiconReviewService';

function pendingDoc(surfaceForm = 'xilogravura') {
  return {
    _id: { toString: () => 'x1' },
    surfaceForm,
    displayForm: 'Xilogravura',
    status: 'pending' as 'pending' | 'promoted' | 'rejected',
    save: vi.fn(async function (this: any) {
      return this;
    }),
    promoted: undefined as unknown,
    rejected: undefined as unknown,
  };
}

const validId = '507f1f77bcf86cd799439011';

describe('promoteReviewItem', () => {
  beforeEach?.(() => {
    findByIdMock.mockReset();
  });

  it('rejects payloads missing text', async () => {
    findByIdMock.mockResolvedValue(pendingDoc());
    await expect(
      promoteReviewItem({
        id: validId,
        payload: {
          text: '',
          phonemes: ['SH'],
          pronunciationNotes: 'tip',
        },
        adminUserId: '507f1f77bcf86cd799439099',
      })
    ).rejects.toBeInstanceOf(LexiconReviewError);
  });

  it('rejects payloads with empty phonemes', async () => {
    findByIdMock.mockResolvedValue(pendingDoc());
    await expect(
      promoteReviewItem({
        id: validId,
        payload: {
          text: 'xilogravura',
          phonemes: [],
          pronunciationNotes: 'tip',
        },
        adminUserId: '507f1f77bcf86cd799439099',
      })
    ).rejects.toThrowError(/phonemes/);
  });

  it('rejects payloads without pronunciationNotes', async () => {
    findByIdMock.mockResolvedValue(pendingDoc());
    await expect(
      promoteReviewItem({
        id: validId,
        payload: {
          text: 'xilogravura',
          phonemes: ['SH'],
          pronunciationNotes: '',
        },
        adminUserId: '507f1f77bcf86cd799439099',
      })
    ).rejects.toThrowError(/pronunciationNotes/);
  });

  it('refuses to promote an already-promoted item', async () => {
    const doc = pendingDoc();
    doc.status = 'promoted';
    findByIdMock.mockResolvedValue(doc);
    await expect(
      promoteReviewItem({
        id: validId,
        payload: {
          text: 'xilogravura',
          phonemes: ['SH'],
          pronunciationNotes: 'tip',
        },
        adminUserId: '507f1f77bcf86cd799439099',
      })
    ).rejects.toThrowError(/"promoted"/);
  });

  it('promotes a pending item when the payload is valid', async () => {
    const doc = pendingDoc();
    findByIdMock.mockResolvedValue(doc);
    const result = await promoteReviewItem({
      id: validId,
      payload: {
        text: 'xilogravura',
        en: 'woodcut',
        partOfSpeech: 'noun',
        phonemes: ['SH', 'IY', 'L'],
        ipa: 'ʃiloɡɾaˈvuɾɐ',
        pronunciationNotes: 'Stress on the penultimate syllable.',
      },
      adminUserId: '507f1f77bcf86cd799439099',
    });
    expect(result.status).toBe('promoted');
    expect(result.promoted).toMatchObject({
      text: 'xilogravura',
      phonemes: ['SH', 'IY', 'L'],
      pronunciationNotes: 'Stress on the penultimate syllable.',
    });
    expect(doc.save).toHaveBeenCalled();
  });
});

describe('rejectReviewItem', () => {
  it('rejects non-pending items with INVALID_STATE', async () => {
    const doc = pendingDoc();
    doc.status = 'rejected';
    findByIdMock.mockResolvedValue(doc);
    await expect(
      rejectReviewItem({
        id: validId,
        adminUserId: '507f1f77bcf86cd799439099',
      })
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('marks pending items as rejected with reason', async () => {
    const doc = pendingDoc();
    findByIdMock.mockResolvedValue(doc);
    const result = await rejectReviewItem({
      id: validId,
      reason: 'proper noun',
      adminUserId: '507f1f77bcf86cd799439099',
    });
    expect(result.status).toBe('rejected');
    expect(result.rejected).toMatchObject({ reason: 'proper noun' });
  });
});
