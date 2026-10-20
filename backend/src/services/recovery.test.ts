import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  hashRecoveryCode,
  normaliseRecoveryCode,
  recoveryCodeMatches,
  toStoredCodes,
} from './recovery.js';

test('issues ten codes in a readable shape', () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, RECOVERY_CODE_COUNT);
  for (const code of codes) {
    assert.match(code, /^[2-9A-HJ-NP-TV-Z]{4}-[2-9A-HJ-NP-TV-Z]{4}-[2-9A-HJ-NP-TV-Z]{4}$/, code);
  }
});

test('codes avoid characters that are misread by hand', () => {
  // 500 codes is enough that any of these appearing would be systematic.
  const all = generateRecoveryCodes(500).join('');
  for (const banned of ['I', 'L', 'O', 'U', '0', '1']) {
    assert.ok(!all.includes(banned), `code alphabet must not contain ${banned}`);
  }
});

test('codes do not repeat', () => {
  const codes = generateRecoveryCodes(200);
  assert.equal(new Set(codes).size, codes.length, 'every issued code should be distinct');
});

test('a code is accepted however the human types it', () => {
  const [code] = generateRecoveryCodes(1);
  const [stored] = toStoredCodes([code]);

  assert.ok(recoveryCodeMatches(code, stored.hash), 'exactly as issued');
  assert.ok(recoveryCodeMatches(code.toLowerCase(), stored.hash), 'lowercased');
  assert.ok(recoveryCodeMatches(code.replace(/-/g, ''), stored.hash), 'without dashes');
  assert.ok(recoveryCodeMatches(`  ${code} `, stored.hash), 'with stray spaces');
  assert.ok(recoveryCodeMatches(code.replace(/-/g, ' '), stored.hash), 'spaces for dashes');
});

test('a different code is rejected', () => {
  const [a, b] = generateRecoveryCodes(2);
  const [storedA] = toStoredCodes([a]);
  assert.ok(!recoveryCodeMatches(b, storedA.hash));
  assert.ok(!recoveryCodeMatches('', storedA.hash));
  assert.ok(!recoveryCodeMatches('ZZZZ-ZZZZ-ZZZZ', storedA.hash));
});

test('a malformed stored hash never matches', () => {
  const [code] = generateRecoveryCodes(1);
  assert.ok(!recoveryCodeMatches(code, ''));
  assert.ok(!recoveryCodeMatches(code, 'not-hex'));
  assert.ok(!recoveryCodeMatches(code, 'abcd'), 'wrong length must not throw or pass');
});

test('the plaintext code is never recoverable from what is stored', () => {
  const codes = generateRecoveryCodes(3);
  const stored = toStoredCodes(codes);
  for (const entry of stored) {
    assert.match(entry.hash, /^[0-9a-f]{64}$/, 'stored value is a SHA-256 digest');
    for (const code of codes) {
      assert.ok(!entry.hash.includes(normaliseRecoveryCode(code)), 'digest must not embed the code');
    }
  }
});

test('hashing is stable across equivalent spellings', () => {
  assert.equal(hashRecoveryCode('4f2k-9qx7-mm31'), hashRecoveryCode('4F2K9QX7MM31'));
  assert.notEqual(hashRecoveryCode('4F2K-9QX7-MM31'), hashRecoveryCode('4F2K-9QX7-MM32'));
});
