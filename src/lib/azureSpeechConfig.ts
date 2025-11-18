/**
 * Azure Speech Service Configuration
 * 
 * Reads Azure Speech credentials from environment variables.
 * 
 * For Vite projects, environment variables must be prefixed with VITE_
 * to be exposed to the client. Set these in your .env file:
 * 
 *   VITE_AZURE_SPEECH_KEY=your-key-here
 *   VITE_AZURE_SPEECH_REGION=your-region-here
 * 
 * Note: Exposing Azure Speech keys in the frontend has security implications.
 * Consider using a backend proxy for production applications.
 */

/**
 * Azure Speech subscription key
 * @throws {Error} If VITE_AZURE_SPEECH_KEY is not set
 */
export const AZURE_SPEECH_KEY: string = (() => {
  const key = import.meta.env.VITE_AZURE_SPEECH_KEY;
  if (!key || typeof key !== 'string' || key.trim() === '') {
    throw new Error(
      'Missing required environment variable: VITE_AZURE_SPEECH_KEY\n' +
      'Please set VITE_AZURE_SPEECH_KEY in your .env file or environment.'
    );
  }
  return key;
})();

/**
 * Azure Speech service region
 * @throws {Error} If VITE_AZURE_SPEECH_REGION is not set
 */
export const AZURE_SPEECH_REGION: string = (() => {
  const region = import.meta.env.VITE_AZURE_SPEECH_REGION;
  if (!region || typeof region !== 'string' || region.trim() === '') {
    throw new Error(
      'Missing required environment variable: VITE_AZURE_SPEECH_REGION\n' +
      'Please set VITE_AZURE_SPEECH_REGION in your .env file or environment.\n' +
      'Example values: "eastus", "westus2", "brazilsouth"'
    );
  }
  return region;
})();

