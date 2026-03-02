export const MIN_DURATION_MS = 900;
export const MIN_RMS = 0.012;
const DEFAULT_SAMPLE_STRIDE = 4;

type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export type DecodedAudioChannels = {
  durationSeconds: number;
  channels: Float32Array[];
};

export type AudioQualityAnalysis = {
  durationMs: number;
  rms: number;
  isTooShort: boolean;
  isSilent: boolean;
};

export type AnalyzeAudioOptions = {
  minDurationMs?: number;
  minRms?: number;
  sampleStride?: number;
  decodeAudioData?: (blob: Blob) => Promise<DecodedAudioChannels>;
};

export function computeRms(signal: Float32Array, sampleStride: number = DEFAULT_SAMPLE_STRIDE): number {
  if (signal.length === 0) {
    return 0;
  }

  let sumSquares = 0;
  let sampledCount = 0;
  const stride = Math.max(1, Math.floor(sampleStride));

  for (let index = 0; index < signal.length; index += stride) {
    const sample = signal[index];
    sumSquares += sample * sample;
    sampledCount += 1;
  }

  if (sampledCount === 0) {
    return 0;
  }

  return Math.sqrt(sumSquares / sampledCount);
}

export function computeCombinedRms(
  channels: Float32Array[],
  sampleStride: number = DEFAULT_SAMPLE_STRIDE
): number {
  if (channels.length === 0) {
    return 0;
  }

  const sum = channels.reduce((total, channel) => total + computeRms(channel, sampleStride), 0);
  return sum / channels.length;
}

async function decodeAudioBlob(blob: Blob): Promise<DecodedAudioChannels> {
  const AudioContextConstructor =
    window.AudioContext || (window as WebkitWindow).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error('AudioContext is not available in this browser.');
  }

  const audioContext = new AudioContextConstructor();
  try {
    const encoded = await blob.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(encoded.slice(0));
    const channels: Float32Array[] = [];
    for (let channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex += 1) {
      channels.push(decoded.getChannelData(channelIndex));
    }

    return {
      durationSeconds: decoded.duration,
      channels,
    };
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

export async function analyzeAudioBlob(
  blob: Blob,
  options: AnalyzeAudioOptions = {}
): Promise<AudioQualityAnalysis> {
  const minDurationMs = options.minDurationMs ?? MIN_DURATION_MS;
  const minRms = options.minRms ?? MIN_RMS;
  const sampleStride = options.sampleStride ?? DEFAULT_SAMPLE_STRIDE;
  const decode = options.decodeAudioData ?? decodeAudioBlob;
  const decoded = await decode(blob);

  const durationMs = Math.round(decoded.durationSeconds * 1000);
  const rms = computeCombinedRms(decoded.channels, sampleStride);

  return {
    durationMs,
    rms,
    isTooShort: durationMs < minDurationMs,
    isSilent: rms < minRms,
  };
}
