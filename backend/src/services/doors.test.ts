import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { doorRefusal } from './doors.js';

test('the staff door turns an investor away', () => {
  const refusal = doorRefusal('staff', 'investor');
  assert.ok(refusal, 'an investor must not be admitted at the staff door');
  assert.match(refusal, /investor sign-in/, 'the message should point them to the right page');
});

test('the staff door admits a manager', () => {
  assert.equal(doorRefusal('staff', 'manager'), null);
});

test('the investor door admits both roles', () => {
  assert.equal(doorRefusal('investor', 'investor'), null);
  assert.equal(
    doorRefusal('investor', 'manager'),
    null,
    'a manager signing in on the main page is routed to the console, not refused',
  );
});

test('an unspecified door behaves like the investor door', () => {
  // Older clients, and anything posting to the API directly, send no scope.
  // That must not become a way to bypass a rule, so it maps to the open door
  // rather than the privileged one.
  assert.equal(doorRefusal(undefined, 'investor'), null);
  assert.equal(doorRefusal(undefined, 'manager'), null);
});

test('only the staff door is ever restricted', () => {
  const roles = ['manager', 'investor'] as const;
  const scopes = ['investor', 'staff', undefined] as const;

  for (const scope of scopes) {
    for (const role of roles) {
      const refused = doorRefusal(scope, role) !== null;
      assert.equal(
        refused,
        scope === 'staff' && role !== 'manager',
        `unexpected result for scope=${String(scope)} role=${role}`,
      );
    }
  }
});
