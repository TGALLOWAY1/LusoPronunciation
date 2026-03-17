import { describe, expect, it } from 'vitest';
import {
  getMissingRequiredLaunchEnvVars,
  isInviteCodeRequired,
  validateRequiredLaunchEnvVars,
} from './startupChecks';

describe('startupChecks', () => {
  it('reports missing launch env vars', () => {
    const missing = getMissingRequiredLaunchEnvVars({
      MONGODB_URI: 'mongodb://example',
      JWT_SECRET: '',
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: undefined,
    });

    expect(missing).toEqual(['JWT_SECRET', 'AZURE_SPEECH_REGION']);
  });

  it('passes validation when all required launch env vars are present', () => {
    expect(() =>
      validateRequiredLaunchEnvVars({
        MONGODB_URI: 'mongodb://example',
        JWT_SECRET: 'secret',
        AZURE_SPEECH_KEY: 'speech-key',
        AZURE_SPEECH_REGION: 'eastus',
      })
    ).not.toThrow();
  });

  it('throws when required launch env vars are missing', () => {
    expect(() =>
      validateRequiredLaunchEnvVars({
        MONGODB_URI: 'mongodb://example',
        JWT_SECRET: 'secret',
        AZURE_SPEECH_KEY: '',
        AZURE_SPEECH_REGION: 'eastus',
      })
    ).toThrow(/AZURE_SPEECH_KEY/);
  });

  it('treats invite gating as enabled unless REQUIRE_INVITE_CODE=false', () => {
    expect(isInviteCodeRequired({})).toBe(true);
    expect(isInviteCodeRequired({ REQUIRE_INVITE_CODE: 'true' })).toBe(true);
    expect(isInviteCodeRequired({ REQUIRE_INVITE_CODE: 'false' })).toBe(false);
  });
});
