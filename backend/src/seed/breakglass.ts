import { User } from '../models/User.js';
import { env } from '../config/env.js';

/**
 * Reset the manager password from MANAGER_PASSWORD_RESET, if it is set.
 *
 * This exists because the alternative, when a password is lost and no recovery
 * code is to hand, is editing a bcrypt hash into the database by hand — which
 * is worse in every way: easy to get wrong, and it leaves no trace.
 *
 * Runs on every boot while the variable is set, so the log says plainly to
 * remove it. Nothing here is reachable over HTTP.
 */
export type BreakGlassDecision =
  | { action: 'skip' }
  | { action: 'refuse'; reason: string }
  | { action: 'reset' };

/** The rule, separated from the database work so it can be tested directly. */
export function breakGlassDecision(value: string): BreakGlassDecision {
  const password = value.trim();
  if (!password) return { action: 'skip' };
  if (password.length < 10) {
    return { action: 'refuse', reason: 'It is shorter than 10 characters.' };
  }
  return { action: 'reset' };
}

export async function applyBreakGlassReset(): Promise<boolean> {
  const password = env.managerPasswordReset;
  const decision = breakGlassDecision(password);

  if (decision.action === 'skip') return false;

  if (decision.action === 'refuse') {
    console.error(
      `\n[reset] MANAGER_PASSWORD_RESET is set but will not be used. ${decision.reason}\n` +
        '        Choose a longer one and redeploy.\n',
    );
    return false;
  }

  // Prefer the configured address; fall back to the only manager there is, so
  // a mismatched SEED_MANAGER_EMAIL cannot lock someone out permanently.
  const manager =
    (await User.findOne({ email: env.seedManagerEmail.toLowerCase(), role: 'manager' }).select(
      '+passwordHash',
    )) ?? (await User.findOne({ role: 'manager' }).sort({ createdAt: 1 }).select('+passwordHash'));

  if (!manager) {
    console.error('\n[reset] MANAGER_PASSWORD_RESET is set, but there is no manager account.\n');
    return false;
  }

  // setPassword bumps tokenVersion, so any session on the old password dies.
  await manager.setPassword(password);
  manager.active = true;
  // Left as-is deliberately: this password is meant to be usable repeatedly
  // while the variable is set, not to force a change on every single boot.
  manager.mustChangePassword = false;
  await manager.save();

  console.log(
    '\n[reset] MANAGER_PASSWORD_RESET was set — the manager password has been reset.\n' +
      `        Sign in at /admin as: ${manager.email}\n` +
      '        Every existing session was signed out.\n\n' +
      '        REMOVE MANAGER_PASSWORD_RESET from the environment once you are\n' +
      '        back in. While it is set, every deploy resets the password to it.\n',
  );

  return true;
}
