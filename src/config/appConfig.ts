/**
 * Application configuration.
 *
 * Centralized configuration for runtime behavior.
 */

/**
 * Content source mode for the application.
 *
 * The app now loads exclusively from the pipeline-generated master datasets
 * (`masterSentences.json` / `masterWords.json`). The former 'legacy' mode — with
 * its chain of fallbacks that ended in hardcoded sample data — has been removed:
 * presenting fabricated sample content as real content is prohibited, so on a
 * load failure the data layer surfaces the error instead of substituting fakes.
 *
 * The `VITE_CONTENT_SOURCE` env var is no longer consulted; any value is ignored.
 */
export const CONTENT_SOURCE = 'pipeline' as const;
