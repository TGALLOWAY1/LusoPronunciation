/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_SPEECH_KEY?: string;
  readonly VITE_AZURE_SPEECH_REGION?: string;
  readonly DEV?: boolean;
  // Add other env vars as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __E2E__?: {
    enabled?: boolean;
    mediaScenario?: 'success' | 'silent' | 'short' | 'micDenied';
    mediaStopDelayMs?: number;
  };
}
