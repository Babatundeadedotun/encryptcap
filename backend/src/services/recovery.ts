import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Single-use recovery codes for staff accounts.
 *
 * These are the way back in when a manager has lost their password and there is
 * no second manager to reset it. The manager keeps them offline — printed, in a
 * safe, or in a password manager — and each one works exactly once.
 *
 * On hashing: these are stored as plain SHA-256, not bcrypt, and that is
 * deliberate. A slow KDF exists to make *guessable* secrets expensive to
 * attack; these are machine-generated with ~59 bits of entropy, so brute force
 * is already out of reach and bcrypt would buy nothing but latency. It would
 * also cost a separate comparison against every stored code on each attempt.
 * SHA-256 lets a code be looked up by its hash in one step.
 */

/** No I, L, O or U, so a handwritten code cannot be misread as 1, 0 or V. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUPS = 3;
const GROUP_LEN = 4;

export const RECOVERY_CODE_COUNT = 10;

/** One code, e.g. 4F2K-9QX7-MM31. */
function makeCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g += 1) {
    let group = '';
    for (let i = 0; i < GROUP_LEN; i += 1) {
      // randomInt is drawn from the CSPRNG and is free of modulo bias.
      group += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join('-');
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, makeCode);
}

/**
 * Accept what a human would actually type: any case, dashes or none, stray
 * spaces. A code that is rejected because of a lowercase letter is a code that
 * sends someone to edit the database by hand.
 */
export function normaliseRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normaliseRecoveryCode(code)).digest('hex');
}

/** Constant-time compare, so a wrong code cannot be narrowed down by timing. */
export function recoveryCodeMatches(code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashRecoveryCode(code), 'hex');
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, 'hex');
  } catch {
    return false;
  }
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/** Codes are shown once at issue; only hashes are kept. */
export function toStoredCodes(codes: string[]): Array<{ hash: string }> {
  return codes.map((code) => ({ hash: hashRecoveryCode(code) }));
}
