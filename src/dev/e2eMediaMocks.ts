type E2EMediaScenario = 'success' | 'silent' | 'short' | 'micDenied';

type E2EConfig = {
  enabled?: boolean;
  mediaScenario?: E2EMediaScenario;
  mediaStopDelayMs?: number;
};

type MediaRecorderErrorEventLike = Event & { error?: DOMException };

let installed = false;

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function buildWavBlob(params: { durationMs: number; amplitude: number; frequencyHz?: number }): Blob {
  const sampleRate = 16_000;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.max(1, Math.floor((params.durationMs / 1000) * sampleRate));
  const dataSize = sampleCount * bytesPerSample;
  const totalSize = 44 + dataSize;
  const frequencyHz = params.frequencyHz ?? 220;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const amplitude = Math.max(0, Math.min(1, params.amplitude));
  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * amplitude;
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * bytesPerSample, Math.round(clamped * 32_767), true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function getScenario(): E2EMediaScenario {
  const config = (window as Window & { __E2E__?: E2EConfig }).__E2E__;
  if (config?.mediaScenario === 'micDenied') {
    return 'micDenied';
  }
  if (config?.mediaScenario === 'silent') {
    return 'silent';
  }
  if (config?.mediaScenario === 'short') {
    return 'short';
  }
  return 'success';
}

function createScenarioBlob(): Blob {
  const scenario = getScenario();

  if (scenario === 'short') {
    return buildWavBlob({ durationMs: 350, amplitude: 0.4 });
  }
  if (scenario === 'silent') {
    return buildWavBlob({ durationMs: 1_200, amplitude: 0 });
  }

  return buildWavBlob({ durationMs: 1_300, amplitude: 0.45 });
}

function createMockMediaStream(): MediaStream {
  const track = {
    kind: 'audio',
    enabled: true,
    muted: false,
    readyState: 'live',
    onended: null,
    onmute: null,
    onunmute: null,
    stop: () => undefined,
  };

  return {
    getTracks: () => [track],
  } as unknown as MediaStream;
}

class E2EMediaRecorderMock {
  static isTypeSupported(_mimeType: string): boolean {
    return true;
  }

  readonly mimeType: string;
  readonly stream: MediaStream;
  state: RecordingState = 'inactive';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: MediaRecorderErrorEventLike) => void) | null = null;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.mimeType = options?.mimeType ?? 'audio/wav';
  }

  start(): void {
    if (this.state !== 'inactive') {
      return;
    }
    this.state = 'recording';
  }

  stop(): void {
    if (this.state !== 'recording') {
      this.state = 'inactive';
      return;
    }

    this.state = 'inactive';
    const blob = createScenarioBlob();
    const delayMs =
      (window as Window & { __E2E__?: E2EConfig }).__E2E__?.mediaStopDelayMs ?? 12;

    window.setTimeout(() => {
      try {
        this.ondataavailable?.({ data: blob } as BlobEvent);
        this.onstop?.();
      } catch (error) {
        const domError =
          error instanceof DOMException
            ? error
            : new DOMException(String(error), 'OperationError');
        this.onerror?.({ error: domError } as MediaRecorderErrorEventLike);
      }
    }, delayMs);
  }
}

export function setupE2EMediaMocks(): void {
  if (installed || !import.meta.env.DEV) {
    return;
  }

  const config = (window as Window & { __E2E__?: E2EConfig }).__E2E__;
  if (!config?.enabled) {
    return;
  }

  installed = true;

  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {},
    });
  }

  const mediaDevices = navigator.mediaDevices as MediaDevices & {
    getUserMedia?: (constraints?: MediaStreamConstraints) => Promise<MediaStream>;
  };

  mediaDevices.getUserMedia = async () => {
    if (getScenario() === 'micDenied') {
      throw new DOMException('Permission denied by e2e scenario.', 'NotAllowedError');
    }
    return createMockMediaStream();
  };

  Object.defineProperty(window, 'MediaRecorder', {
    configurable: true,
    writable: true,
    value: E2EMediaRecorderMock,
  });
}
