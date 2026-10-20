import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { breakGlassDecision } from './breakglass.js';

test('an unset variable does nothing at all', () => {
  assert.deepEqual(breakGlassDecision(''), { action: 'skip' });
  assert.deepEqual(breakGlassDecision('   '), { action: 'skip' }, 'whitespace is not a password');
});

test('a short password is refused rather than quietly accepted', () => {
  const decision = breakGlassDecision('short');
  assert.equal(decision.action, 'refuse');
  assert.match(
    decision.action === 'refuse' ? decision.reason : '',
    /10 characters/,
    'the log should say what to fix',
  );
});

test('exactly ten characters is allowed', () => {
  assert.deepEqual(breakGlassDecision('0123456789'), { action: 'reset' });
});

test('nine characters is not', () => {
  assert.equal(breakGlassDecision('012345678').action, 'refuse');
});

test('a real password resets', () => {
  assert.deepEqual(breakGlassDecision('TemporaryPass!2026'), { action: 'reset' });
});
