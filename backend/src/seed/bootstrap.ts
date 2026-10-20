import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { seed } from './seed.js';
import { generateRecoveryCodes, toStoredCodes } from '../services/recovery.js';

/**
 * Prepare an empty database on first boot.
 *
 * Development loads the full demo book, so pointing MONGODB_URI at a fresh
 * database is the only setup step.
 *
 * Production creates the manager login and nothing else. Invented investors and
 * invented performance figures must never appear on a live investment site —
 * but a database with no users at all would leave nobody able to sign in, so
 * the one account needed to bootstrap the business is created here.
 *
 * Both paths are conservative: neither runs if any user already exists, so
 * real data can never be overwritten.
 */
export async function seedIfEmpty(): Promise<boolean> {
  const existing = await User.estimatedDocumentCount();
  if (existing > 0) return false;

  if (env.isProd) {
    const manager = new User({
      name: 'Portfolio Manager',
      email: env.seedManagerEmail.toLowerCase(),
      role: 'manager',
      mustChangePassword: true,
    });
    // The hash is the only thing stored; there is no plain password field.
    await manager.setPassword(env.seedManagerPassword);

    // Issued now because this is the only moment the codes can be shown. They
    // are stored as digests, so they can never be read back — only replaced.
    const codes = generateRecoveryCodes();
    manager.recoveryCodes = toStoredCodes(codes);
    manager.recoveryCodesIssuedAt = new Date();
    await manager.save();

    console.log(
      '[setup] Empty database — created the manager login and nothing else.\n' +
        `        Sign in as: ${env.seedManagerEmail}\n` +
        '        You will be asked to set your own password on first sign-in.\n' +
        '        No demo investors and no demo figures were created.\n\n' +
        '        RECOVERY CODES — copy these somewhere safe now.\n' +
        '        They are shown once and cannot be read back. Each works a single\n' +
        '        time at /admin if you are ever locked out.\n\n' +
        codes.map((code) => `          ${code}`).join('\n') +
        '\n',
    );
    return true;
  }

  console.log('[seed] Database is empty — loading the demo book.');
  const result = await seed();

  console.log(
    `[seed] Ready: ${result.investors} investor accounts and ${result.articles} reports.\n` +
      `       Manager login: ${result.manager} / ${env.seedManagerPassword}\n` +
      '       These are invented people and invented figures. Clear them before going live.',
  );

  return true;
}
