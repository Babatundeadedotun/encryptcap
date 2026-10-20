import type { UserRole } from '../models/User.js';

/**
 * Which sign-in page the credentials were presented at.
 *
 * 'investor' is the public sign-in at /login. 'staff' is the manager sign-in at
 * /admin, which is not linked from anywhere on the site.
 */
export type LoginScope = 'investor' | 'staff';

/**
 * Whether a role may use a given door.
 *
 * The staff door is managers only: an investor's own password will not open it,
 * so the console's sign-in cannot be used as a general login. The investor door
 * takes either role — a manager who signs in there is simply sent on to the
 * console rather than being turned away for using the wrong page.
 *
 * Returns the message to show, or null when the door opens. Kept separate from
 * the route so the matrix can be tested directly, and so the rule lives in one
 * readable place rather than inside a request handler.
 */
export function doorRefusal(scope: LoginScope | undefined, role: UserRole): string | null {
  if (scope === 'staff' && role !== 'manager') {
    return 'This sign-in is for staff. Use the investor sign-in on the main site.';
  }
  return null;
}
