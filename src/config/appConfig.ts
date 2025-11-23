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

