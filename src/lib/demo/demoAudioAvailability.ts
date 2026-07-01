import { useEffect, useState } from 'react';

/**
 * Runtime probe for optional demo audio files (the uploaded learner
 * recordings under `public/demo-audio/attempts/`). Both the Vite dev server
 * and the static deploy fall back to `index.html` for unknown paths, so a
 * plain `fetch().ok` check would report missing WAVs as present — we also
 * require a non-HTML content type before treating the file as available.
 *
 * Results are cached per URL for the lifetime of the page so switching
 * between demo sentences/examples doesn't re-probe.
 */
const availabilityCache = new Map<string, Promise<boolean>>();

export function checkDemoAudioAvailable(url: string): Promise<boolean> {
  let cached = availabilityCache.get(url);
  if (!cached) {
    cached = fetch(url, { method: 'HEAD' })
      .then((res) => {
        if (!res.ok) return false;
        const contentType = res.headers.get('content-type') ?? '';
        return !contentType.includes('text/html');
      })
      .catch(() => false);
    availabilityCache.set(url, cached);
  }
  return cached;
}

/**
 * React hook wrapper around {@link checkDemoAudioAvailable}.
 * Returns `null` while the probe is in flight, then true/false.
 * Pass `true` for `assumeAvailable` to skip probing (bundled assets).
 */
export function useDemoAudioAvailability(url: string, assumeAvailable = false): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(assumeAvailable ? true : null);

  useEffect(() => {
    if (assumeAvailable) {
      setAvailable(true);
      return;
    }
    let active = true;
    setAvailable(null);
    checkDemoAudioAvailable(url).then((result) => {
      if (active) setAvailable(result);
    });
    return () => {
      active = false;
    };
  }, [url, assumeAvailable]);

  return available;
}
