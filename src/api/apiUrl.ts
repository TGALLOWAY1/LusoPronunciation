/**
 * API URL helper.
 *
 * Same-origin deploys (default) leave `VITE_API_BASE_URL` unset and all
 * requests fire against relative `/api/...` paths. Split deploys set the env
 * var to the backend origin (e.g. `https://api.example.com`) and every call
 * is rewritten to absolute URLs.
 */

const rawBase =
  (typeof import.meta !== 'undefined'
    ? (import.meta as unknown as { env?: Record<string, string | undefined> })
        .env?.VITE_API_BASE_URL
    : undefined) ?? '';

export const API_BASE_URL = rawBase.replace(/\/+$/, '');

export function buildApiUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`buildApiUrl: path must start with '/', got '${path}'`);
  }
  return `${API_BASE_URL}${path}`;
}
