import 'dotenv/config';

function required(name: string, value: string | undefined, fallback?: string): string {
  if (value && value.trim()) return value.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';

/** In production a real secret is mandatory — refuse to boot with the dev default. */
const jwtSecret = isProd
  ? required('JWT_SECRET', process.env.JWT_SECRET)
  : required('JWT_SECRET', process.env.JWT_SECRET, 'dev-only-insecure-secret-change-me');

if (isProd && jwtSecret === 'dev-only-insecure-secret-change-me') {
  throw new Error('JWT_SECRET is still the development default. Generate one: openssl rand -hex 48');
}

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 4000),

  /** Empty in development means "start an in-memory MongoDB for me". */
  mongoUri: (process.env.MONGODB_URI ?? '').trim(),

  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',

  /**
   * Break-glass password reset.
   *
   * When set, the manager account's password is reset to this value on every
   * boot. It is the way back in when the password is forgotten and no recovery
   * code is to hand, without opening the database by hand.
   *
   * It is not a weakening: setting it requires access to the host's environment
   * variables, and anyone with that already holds MONGODB_URI and can rewrite
   * the account directly. Clear it once you are back in — while it is set,
   * every deploy resets the password again.
   */
  managerPasswordReset: (process.env.MANAGER_PASSWORD_RESET ?? '').trim(),

  seedManagerEmail: process.env.SEED_MANAGER_EMAIL ?? 'manager@encryptcap.com',
  seedManagerPassword: process.env.SEED_MANAGER_PASSWORD ?? 'ChangeMe!2026',
} as const;

/**
 * A configuration problem is not a crash — it is a setting someone needs to
 * change. Print the fix and stop, rather than burying it under a stack trace in
 * the host's log viewer.
 */
function configError(variable: string, problem: string, fix: string): never {
  console.error(
    `\n  Cannot start: ${variable} is not set correctly.\n\n` +
      `  Problem:  ${problem}\n` +
      `  Fix:      ${fix}\n\n` +
      '  Set it in your host\'s environment variables, then redeploy.\n',
  );
  process.exit(1);
}

/*
 * Production refuses to start on a misconfiguration rather than coming up in a
 * state that looks fine and is not. Each of these has a one-line fix.
 */
if (env.isProd) {
  if (!env.mongoUri) {
    configError(
      'MONGODB_URI',
      'It is empty. In production there is no in-memory fallback.',
      'Paste your MongoDB Atlas connection string, with the password filled in.',
    );
  }

  if (env.seedManagerPassword === 'ChangeMe!2026') {
    configError(
      'SEED_MANAGER_PASSWORD',
      'It is still the documented default, which is public knowledge.',
      'Choose a real password — this is the login for your manager account.',
    );
  }

  if (env.seedManagerPassword.length < 10) {
    configError(
      'SEED_MANAGER_PASSWORD',
      'It is shorter than 10 characters.',
      'Use at least 10 characters.',
    );
  }

  if (env.clientOrigin.includes('localhost') || env.clientOrigin.includes('127.0.0.1')) {
    configError(
      'CLIENT_ORIGIN',
      `It is still "${env.clientOrigin}", which no deployed browser will ever send.`,
      'Set it to your live site address, e.g. https://encryptcap.netlify.app',
    );
  }

  if (env.clientOrigin.split(',').some((o) => o.trim().endsWith('/'))) {
    configError(
      'CLIENT_ORIGIN',
      'It has a trailing slash. An origin is scheme + host + port only.',
      'Remove the trailing slash: https://encryptcap.netlify.app',
    );
  }
}
