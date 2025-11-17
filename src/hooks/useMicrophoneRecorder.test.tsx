/**
 * Unit tests for useMicrophoneRecorder hook
 * 
 * To run these tests, install the required dependencies:
 *   npm install -D vitest @testing-library/react @vitest/ui jsdom
 * 
 * Add to package.json scripts:
 *   "test": "vitest"
 * 
 * Configure Vitest in vite.config.ts:
 *   import { defineConfig } from 'vite'
 *   export default defineConfig({
 *     test: {
 *       globals: true,
 *       environment: 'jsdom',
 *     },
 *   })
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMicrophoneRecorder } from './useMicrophoneRecorder';

// Mock MediaRecorder and getUserMedia
const mockMediaStream = {
  getTracks: vi.fn(() => [
    { stop: vi.fn() },
    { stop: vi.fn() },
  ]),
} as unknown as MediaStream;

const mockMediaRecorder = {
  state: 'inactive',
  start: vi.fn(),
  stop: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  ondataavailable: null as ((event: BlobEvent) => void) | null,
  onstop: null as (() => void) | null,
  onerror: null as ((event: MediaRecorderErrorEvent) => void) | null,
};

describe('useMicrophoneRecorder', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock navigator.mediaDevices.getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
    } as unknown as MediaDevices;

    // Mock MediaRecorder
    global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as unknown as typeof MediaRecorder;
    (global.MediaRecorder as unknown as { isTypeSupported: (type: string) => boolean }).isTypeSupported = vi.fn().mockReturnValue(true);

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useMicrophoneRecorder());

    expect(result.current.isRecording).toBe(false);
    expect(result.current.audioBlob).toBe(null);
    expect(result.current.audioUrl).toBe(null);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.startRecording).toBe('function');
    expect(typeof result.current.stopRecording).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('should handle reset correctly', () => {
    const { result } = renderHook(() => useMicrophoneRecorder());

    // Reset should work even when not recording
    result.current.reset();

    expect(result.current.isRecording).toBe(false);
    expect(result.current.audioBlob).toBe(null);
    expect(result.current.audioUrl).toBe(null);
    expect(result.current.error).toBe(null);
  });
});

