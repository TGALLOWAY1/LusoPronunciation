import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminLexiconPage from './AdminLexiconPage';
import * as adminLexiconApi from '@/api/adminLexicon';
import type { LexiconReviewItemDto } from '@/api/adminLexicon';

vi.mock('@/api/adminLexicon', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/adminLexicon')>('@/api/adminLexicon');
  return {
    ...actual,
    listReviewItems: vi.fn(),
    promoteReviewItem: vi.fn(),
    rejectReviewItem: vi.fn(),
    triggerAggregation: vi.fn(),
  };
});

const mockList = adminLexiconApi.listReviewItems as unknown as ReturnType<typeof vi.fn>;
const mockPromote = adminLexiconApi.promoteReviewItem as unknown as ReturnType<typeof vi.fn>;
const mockReject = adminLexiconApi.rejectReviewItem as unknown as ReturnType<typeof vi.fn>;

function buildItem(overrides: Partial<LexiconReviewItemDto> = {}): LexiconReviewItemDto {
  return {
    id: 'rev-1',
    surfaceForm: 'xilogravura',
    displayForm: 'xilogravura',
    frequency: 4,
    uniqueUsers: 2,
    firstSeenAt: new Date('2026-03-01T00:00:00Z').toISOString(),
    lastSeenAt: new Date('2026-04-10T00:00:00Z').toISOString(),
    lastResolutionType: 'generated',
    status: 'pending',
    examples: [
      {
        sentenceId: 's1',
        contextText: 'Eu vi uma xilogravura bonita.',
        observedAt: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

describe('AdminLexiconPage', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockPromote.mockReset();
    mockReject.mockReset();
  });

  it('renders pending items returned by the API', async () => {
    mockList.mockResolvedValue({
      items: [buildItem()],
      total: 1,
      limit: 100,
      offset: 0,
      status: 'pending',
    });

    render(<AdminLexiconPage />);

    await waitFor(() => {
      expect(screen.getByText('xilogravura')).toBeInTheDocument();
    });
    expect(screen.getByText(/1 total/i)).toBeInTheDocument();
    expect(screen.getByText(/4×/)).toBeInTheDocument();
  });

  it('refuses to promote without phonemes and notes', async () => {
    mockList.mockResolvedValue({
      items: [buildItem()],
      total: 1,
      limit: 100,
      offset: 0,
      status: 'pending',
    });

    render(<AdminLexiconPage />);

    await waitFor(() => {
      expect(screen.getByText('xilogravura')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /xilogravura/i }));

    const promoteBtn = await screen.findByRole('button', { name: /^promote$/i });
    // Required fields empty → disabled
    expect(promoteBtn).toBeDisabled();
    expect(mockPromote).not.toHaveBeenCalled();
  });

  it('submits a promotion with validated fields', async () => {
    mockList.mockResolvedValue({
      items: [buildItem()],
      total: 1,
      limit: 100,
      offset: 0,
      status: 'pending',
    });
    mockPromote.mockResolvedValue({
      ...buildItem(),
      status: 'promoted',
      promoted: {
        text: 'xilogravura',
        phonemes: ['SH', 'IY', 'L'],
        pronunciationNotes: 'notes',
        promotedBy: 'admin-1',
        promotedAt: new Date().toISOString(),
      },
    });

    render(<AdminLexiconPage />);

    await waitFor(() => {
      expect(screen.getByText('xilogravura')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /xilogravura/i }));

    const phonemeInput = await screen.findByLabelText(/Phonemes \(/i);
    const notesInput = await screen.findByLabelText(/Pronunciation notes/i);
    fireEvent.change(phonemeInput, { target: { value: 'SH IY L' } });
    fireEvent.change(notesInput, { target: { value: 'Stress on the penultimate syllable.' } });

    fireEvent.click(screen.getByRole('button', { name: /^promote$/i }));

    await waitFor(() => {
      expect(mockPromote).toHaveBeenCalledWith(
        'rev-1',
        expect.objectContaining({
          text: 'xilogravura',
          phonemes: ['SH', 'IY', 'L'],
          pronunciationNotes: 'Stress on the penultimate syllable.',
        })
      );
    });
  });

  it('submits a rejection with a reason', async () => {
    mockList.mockResolvedValue({
      items: [buildItem()],
      total: 1,
      limit: 100,
      offset: 0,
      status: 'pending',
    });
    mockReject.mockResolvedValue({
      ...buildItem(),
      status: 'rejected',
    });

    render(<AdminLexiconPage />);

    await waitFor(() => {
      expect(screen.getByText('xilogravura')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /xilogravura/i }));

    const reasonInput = await screen.findByLabelText(/Reason \(optional\)/i);
    fireEvent.change(reasonInput, { target: { value: 'proper noun' } });

    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

    await waitFor(() => {
      expect(mockReject).toHaveBeenCalledWith('rev-1', 'proper noun');
    });
  });
});
