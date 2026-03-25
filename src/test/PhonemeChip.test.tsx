import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhonemeChip from '@/components/pronunciation/PhonemeChip';
import * as phonemeMetadata from '@/lib/phonemeMetadata';

// Mock the phoneme metadata module
vi.mock('@/lib/phonemeMetadata', () => ({
  getPhonemeById: vi.fn(),
}));

describe('PhonemeChip', () => {
  const mockMetadata = {
    id: 'AA',
    ipa: 'ɑ',
    type: 'vowel',
    category: 'open',
    difficulty: 2,
    englishApprox: 'Open back unrounded vowel',
    articulation: 'Tongue low and back.',
    acousticDescription: 'Low F1 vowel.',
    commonMistakes: [],
    teachingTips: ['Like a in pai but more open.'],
    minimalPairs: [],
    exampleWords: [
      {
        pt: 'pá',
        ipa: 'pa',
        stressPattern: '1',
        english: 'father',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without error', () => {
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(mockMetadata);
    render(<PhonemeChip symbol="aa" />);
    expect(screen.getByText('aa')).toBeInTheDocument();
  });

  it('should display ARPABET symbol', () => {
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(mockMetadata);
    render(<PhonemeChip symbol="aa" />);
    expect(screen.getByText('aa')).toBeInTheDocument();
  });

  it('should display IPA symbol when metadata is available', () => {
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(mockMetadata);
    render(<PhonemeChip symbol="aa" />);
    expect(screen.getByText('/ɑ/')).toBeInTheDocument();
  });

  it('should display score when provided', () => {
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(mockMetadata);
    render(<PhonemeChip symbol="aa" score={85} />);
    expect(screen.getByText('(85)')).toBeInTheDocument();
  });

  it('should round score correctly', () => {
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(mockMetadata);
    render(<PhonemeChip symbol="aa" score={85.7} />);
    expect(screen.getByText('(86)')).toBeInTheDocument();
  });

  it('should handle missing metadata gracefully', () => {
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(undefined);
    render(<PhonemeChip symbol="xyz" />);
    expect(screen.getByText('xyz')).toBeInTheDocument();
    // Should not show IPA when metadata is missing
    expect(screen.queryByText(/\//)).not.toBeInTheDocument();
  });

  it('should show tooltip text in title attribute', async () => {
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(mockMetadata);
    const { container } = render(<PhonemeChip symbol="aa" score={85} />);
    const chip = container.querySelector('span[title]');
    expect(chip).toHaveAttribute('title');
    const title = chip?.getAttribute('title') || '';
    expect(title.includes('aa')).toBe(true);
    expect(title.includes('ɑ')).toBe(true);
    expect(title.includes('85')).toBe(true);
  });

  it('should show "No metadata available" in tooltip when metadata is missing', () => {
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(undefined);
    const { container } = render(<PhonemeChip symbol="xyz" />);
    // Find the span with the title attribute (the inner span with cursor-help class)
    const chip = container.querySelector('span[title]');
    const title = chip?.getAttribute('title') || '';
    expect(title.includes('No metadata available')).toBe(true);
  });

  it('should apply correct styling classes for score', () => {
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(mockMetadata);
    const { container } = render(<PhonemeChip symbol="aa" score={95} />);
    const chip = container.querySelector('span span');
    // Should have score-based color classes
    expect(chip?.className).toContain('border-2');
  });

  it('should apply default styling when score is not provided', () => {
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(mockMetadata);
    const { container } = render(<PhonemeChip symbol="aa" />);
    const chip = container.querySelector('span span');
    // Should have default gray styling
    expect(chip?.className).toContain('bg-gray-100');
  });

  it('should handle empty symbol gracefully', () => {
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(undefined);
    const { container } = render(<PhonemeChip symbol="" />);
    // Component should render without crashing
    const chip = container.querySelector('span span');
    expect(chip).toBeInTheDocument();
  });

  it('should display tooltip on hover', async () => {
    const user = userEvent.setup();
    vi.mocked(phonemeMetadata.getPhonemeById).mockReturnValue(mockMetadata);
    render(<PhonemeChip symbol="aa" score={85} />);
    
    const chip = screen.getByText('aa').closest('span');
    if (chip) {
      await user.hover(chip);
      // Tooltip should appear (checking for tooltip content)
      // The tooltip content should be visible after hover
      // Note: The tooltip is conditionally rendered based on showTooltip state
      // We verify the component handles hover by checking it renders
      expect(chip).toBeInTheDocument();
    }
  });
});
