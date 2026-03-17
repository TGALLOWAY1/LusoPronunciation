import { InviteCodeModel } from '../models/InviteCodeModel';

const REQUIRED_LAUNCH_ENV_VARS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'AZURE_SPEECH_KEY',
  'AZURE_SPEECH_REGION',
] as const;

type RequiredLaunchEnvVar = (typeof REQUIRED_LAUNCH_ENV_VARS)[number];

function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function getMissingRequiredLaunchEnvVars(
  env: NodeJS.ProcessEnv = process.env
): RequiredLaunchEnvVar[] {
  return REQUIRED_LAUNCH_ENV_VARS.filter((name) => !hasValue(env[name]));
}

export function validateRequiredLaunchEnvVars(env: NodeJS.ProcessEnv = process.env): void {
  const missing = getMissingRequiredLaunchEnvVars(env);

  if (missing.length === 0) {
    return;
  }

  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
    'Set these before starting the production server.'
  );
}

export function isInviteCodeRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REQUIRE_INVITE_CODE !== 'false';
}

export async function logInviteCodeReadiness(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (!isInviteCodeRequired(env)) {
    console.log('[Server] Invite code gating disabled (REQUIRE_INVITE_CODE=false)');
    return;
  }

  try {
    const now = new Date();
    const availableInviteCodeCount = await InviteCodeModel.countDocuments({
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
      $expr: {
        $lt: ['$usedCount', '$maxUses'],
      },
    });

    if (availableInviteCodeCount === 0) {
      console.warn(
        '[Server] Invite code gating is enabled, but no active invite codes are available. ' +
        'Registration will remain blocked until you seed a code or set REQUIRE_INVITE_CODE=false.'
      );
      return;
    }

    console.log(
      `[Server] Invite code gating enabled with ${availableInviteCodeCount} active invite code(s)`
    );
  } catch (error) {
    console.warn('[Server] Failed to verify invite code readiness:', error);
  }
}
