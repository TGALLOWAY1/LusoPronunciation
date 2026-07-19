import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoiceSettings from './VoiceSettings';

const mockSetSelectedVoice = vi.fn();

vi.mock('@/state/settingsStore', () => ({
  useSettingsStore: () => ({
    selectedVoice: 'male',
    setSelectedVoice: mockSetSelectedVoice,
  }),
}));

describe('VoiceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<VoiceSettings isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exposes dialog semantics labeled by its heading', () => {
    render(<VoiceSettings isOpen onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Voice Settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus into the dialog when it opens', async () => {
    render(<VoiceSettings isOpen onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(screen.getByLabelText('Close settings')).toHaveFocus();
    });
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<VoiceSettings isOpen onClose={onClose} />);

    await vi.waitFor(() => {
      expect(screen.getByLabelText('Close settings')).toHaveFocus();
    });

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the triggering element after closing', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open settings';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { rerender } = render(<VoiceSettings isOpen={false} onClose={vi.fn()} />);
    // Re-focus the trigger (rendering the closed dialog shouldn't have moved focus).
    trigger.focus();

    rerender(<VoiceSettings isOpen onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(screen.getByLabelText('Close settings')).toHaveFocus();
    });

    rerender(<VoiceSettings isOpen={false} onClose={vi.fn()} />);
    expect(trigger).toHaveFocus();

    document.body.removeChild(trigger);
  });

  it('traps Tab focus within the dialog', async () => {
    const user = userEvent.setup();
    render(<VoiceSettings isOpen onClose={vi.fn()} />);

    const closeButton = screen.getByLabelText('Close settings');
    await vi.waitFor(() => expect(closeButton).toHaveFocus());

    // Shift+Tab from the first focusable element should wrap to the last.
    await user.tab({ shift: true });
    const focusable = screen.getAllByRole('button');
    const last = focusable[focusable.length - 1];
    expect(last).toHaveFocus();
  });

  it('calls setSelectedVoice when a voice option is clicked', async () => {
    const user = userEvent.setup();
    render(<VoiceSettings isOpen onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Female/i }));
    expect(mockSetSelectedVoice).toHaveBeenCalledWith('female');
  });
});
