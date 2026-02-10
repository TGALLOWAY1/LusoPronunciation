/**
 * Application configuration.
 * 
 * Centralized configuration for runtime behavior, including content source selection.
 */

/**
 * Content source mode for the application.
 * 
 * - 'legacy': Use legacy/dummy data sources (default)
 * - 'pipeline': Use pipeline-generated master datasets
 * 
 * Set via environment variable: VITE_CONTENT_SOURCE
 * 
 * @example
 * // In .env file:
 * VITE_CONTENT_SOURCE=pipeline
 */
export const CONTENT_SOURCE: 'legacy' | 'pipeline' = 
  (import.meta.env.VITE_CONTENT_SOURCE as 'legacy' | 'pipeline' | undefined) ?? 'legacy';

/**
 * Dataset release version to load when CONTENT_SOURCE is "pipeline".
 * Example: VITE_DATASET_VERSION=2.0.0
 */
export const DATASET_VERSION: string =
  (import.meta.env.VITE_DATASET_VERSION as string | undefined)?.trim() ?? '';

/**
 * Whether runtime bootstrap validation is required before loading pipeline data.
 * Defaults to true in pipeline mode.
 */
export const REQUIRE_DATASET_BOOTSTRAP: boolean =
  ((import.meta.env.VITE_REQUIRE_DATASET_BOOTSTRAP as string | undefined)?.toLowerCase() ?? 'true') !== 'false';

/**
 * Returns a release-scoped data path.
 */
export function getReleaseDataPath(relativePath: string): string {
  if (!DATASET_VERSION) {
    throw new Error(
      'Missing VITE_DATASET_VERSION. Set this env var when CONTENT_SOURCE=pipeline.'
    );
  }

  const cleanRelative = relativePath.replace(/^\/+/, '');
  return `/data/releases/v${DATASET_VERSION}/${cleanRelative}`;
}
