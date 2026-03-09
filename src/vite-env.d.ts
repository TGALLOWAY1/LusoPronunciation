/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_DEV_ANALYTICS?: string;
  readonly VITE_CONTENT_SOURCE?: string;
  readonly DEV?: boolean;
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
