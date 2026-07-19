import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from './AppLayout';

// Stub the nav chrome so the test needs no store providers and stays focused
// on how many times the routed content mounts.
vi.mock('./Header', () => ({
  default: ({ currentSection }: { currentSection?: string }) => (
    <div data-testid="header">{currentSection}</div>
  ),
}));
vi.mock('./Sidebar', () => ({
  default: () => <div data-testid="sidebar" />,
}));

const mountSpy = vi.fn();

function ProbeChild() {
  useEffect(() => {
    mountSpy();
  }, []);
  return <div data-testid="probe-child">content</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppLayout>
        <ProbeChild />
      </AppLayout>
    </MemoryRouter>,
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    mountSpy.mockClear();
  });

  it('mounts children exactly once (no double-render across breakpoints)', () => {
    renderAt('/');
    expect(mountSpy).toHaveBeenCalledTimes(1);
    // The single content container is the only place children live.
    expect(screen.getAllByTestId('probe-child')).toHaveLength(1);
  });

  it('renders the mobile nav with all primary destinations reachable', () => {
    renderAt('/');
    // Sidebar destinations that were previously missing from mobile nav.
    expect(screen.getByRole('link', { name: /Sentence Builder/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /My Sentences/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Take a Tour/i })).toBeTruthy();
    // And the ones that were already present.
    expect(screen.getByRole('link', { name: /Practice/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Review/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Progress/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Settings/i })).toBeTruthy();
  });

  it('shows a header section label for the builder route', () => {
    renderAt('/builder');
    expect(screen.getByTestId('header').textContent).toBe('Sentence Builder');
  });

  it('shows a header section label for the custom sentences route', () => {
    renderAt('/sentences/custom');
    expect(screen.getByTestId('header').textContent).toBe('My Sentences');
  });

  it('shows a sensible header label for a dynamic custom practice route', () => {
    renderAt('/practice/custom/abc123');
    expect(screen.getByTestId('header').textContent).toBe('Practice');
  });
});
