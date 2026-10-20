/**
 * End-to-end check against a throwaway in-memory database.
 *
 *   npm run smoke
 *
 * Boots the real app, seeds it, and walks the flows that matter — manager
 * login, the book, creating an account, posting a report, investor login,
 * statement PDFs, and the privacy boundary between investors.
 */
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { connectDb, disconnectDb } from '../db/connect.js';
import { seed } from './seed.js';
import { env } from '../config/env.js';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}`, detail !== undefined ? detail : '');
  }
}

/** Minimal cookie-aware fetch wrapper. */
function createClient(base: string) {
  let cookie = '';
  return async function call(
    path: string,
    init: RequestInit = {},
  ): Promise<{ status: number; body: any; raw: Response }> {
    const res = await fetch(base + path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
        ...(init.headers ?? {}),
      },
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];

    const type = res.headers.get('content-type') ?? '';
    if (type.includes('pdf')) return { status: res.status, body: await res.arrayBuffer(), raw: res };

    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body, raw: res };
  };
}

async function main(): Promise<void> {
  await connectDb();
  const summary = await seed();
  console.log(`\nSeeded ${summary.investors} investors, ${summary.articles} articles.\n`);

  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const manager = createClient(base);
  const investor = createClient(base);
  const anon = createClient(base);

  console.log('Public endpoints');
  const health = await anon('/api/health');
  check('health responds', health.status === 200 && health.body.ok === true, health.body);

  const articles = await anon('/api/articles');
  check('published articles are public', articles.body?.articles?.length === 4, articles.status);

  const article = await anon('/api/articles/bitcoin-hedge');
  check('single article by slug', article.body?.article?.slug === 'bitcoin-hedge', article.status);

  const guardedBook = await anon('/api/accounts');
  check('the book rejects anonymous callers', guardedBook.status === 401, guardedBook.status);

  const subscribe = await anon('/api/subscribers', {
    method: 'POST',
    body: JSON.stringify({ email: 'reader@example.com' }),
  });
  check('anyone can join the research list', subscribe.status === 201, subscribe.body);

  const resubscribe = await anon('/api/subscribers', {
    method: 'POST',
    body: JSON.stringify({ email: 'reader@example.com' }),
  });
  check('re-subscribing is idempotent, not an error', resubscribe.status === 201, resubscribe.status);

  console.log('\nManager');
  const badLogin = await manager('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: env.seedManagerEmail, password: 'wrong-password' }),
  });
  check('a wrong password is rejected', badLogin.status === 401, badLogin.status);

  const login = await manager('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: env.seedManagerEmail, password: env.seedManagerPassword }),
  });
  check('manager logs in', login.status === 200 && login.body.user.role === 'manager', login.body);

  const book = await manager('/api/accounts');
  const totals = book.body?.totals;
  check('book returns 30 accounts', book.body?.accounts?.length === 30, book.body?.accounts?.length);
  check('AUM is positive', totals?.assetsUnderManagement > 0, totals?.assetsUnderManagement);
  check(
    'net P&L reconciles to AUM minus capital',
    Math.abs(totals.netPnl - (totals.assetsUnderManagement - totals.capitalDeployed)) < 0.01,
    totals,
  );
  check(
    'tier AUM sums to total AUM',
    Math.abs(
      book.body.byTier.reduce((sum: number, t: any) => sum + t.aum, 0) -
        totals.assetsUnderManagement,
    ) < 0.01,
    book.body.byTier,
  );

  const subscribers = await manager('/api/subscribers');
  check('manager can read the research list', subscribers.body?.count === 1, subscribers.body);

  const created = await manager('/api/accounts', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test Investor',
      email: 'test.investor@example.com',
      tier: 'consortium',
      depositedCapital: 5000,
      joinedAt: '2026-01-01',
    }),
  });
  check('manager creates an account', created.status === 201, created.body);
  check('a one-off password is issued', typeof created.body?.temporaryPassword === 'string');
  check(
    'a new account starts at its deposited capital',
    created.body?.account?.position?.equity === 5000,
    created.body?.account?.position,
  );

  const newAccountId = created.body.account.id;
  const posted = await manager(`/api/accounts/${newAccountId}/records`, {
    method: 'POST',
    body: JSON.stringify({
      year: 2026,
      month: 2,
      openingBalance: 5000,
      nfpResult: 400,
      realisedPnl: 400,
      closingEquity: 5400,
    }),
  });
  check('manager posts a monthly report', posted.status === 201, posted.body);
  check(
    'equity follows the posted closing figure',
    posted.body?.account?.position?.equity === 5400,
    posted.body?.account?.position,
  );
  check(
    'fee is one third of profit above the deposit',
    Math.abs(posted.body.account.position.fee - 400 / 3) < 0.01,
    posted.body.account.position.fee,
  );
  check(
    'investor share is two thirds of that profit',
    Math.abs(posted.body.account.position.investorShare - (400 * 2) / 3) < 0.01,
    posted.body.account.position.investorShare,
  );

  const duplicate = await manager(`/api/accounts/${newAccountId}/records`, {
    method: 'POST',
    body: JSON.stringify({
      year: 2026,
      month: 2,
      openingBalance: 5000,
      nfpResult: 1,
      realisedPnl: 1,
      closingEquity: 5001,
    }),
  });
  check('a second report for the same month is refused', duplicate.status === 409, duplicate.status);

  console.log('\nInvestor');
  const invLogin = await investor('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'test.investor@example.com',
      password: created.body.temporaryPassword,
    }),
  });
  check('investor logs in with the issued password', invLogin.status === 200, invLogin.body);
  check('investor is told to change it', invLogin.body?.user?.mustChangePassword === true);

  const mine = await investor('/api/accounts/me');
  check('investor sees their own account', mine.body?.account?.id === newAccountId, mine.status);
  check(
    'investor sees their own name only',
    mine.body?.account?.investorName === 'Test Investor',
    mine.body?.account?.investorName,
  );

  const theBook = await investor('/api/accounts');
  check('investor cannot list the whole book', theBook.status === 403, theBook.status);

  const someoneElse = book.body.accounts[0].id;
  const peek = await investor(`/api/accounts/${someoneElse}`);
  check('investor cannot open another account', peek.status === 403, peek.status);

  const peekRecords = await investor(`/api/accounts/${someoneElse}/records`);
  check('investor cannot read another account’s reports', peekRecords.status === 403, peekRecords.status);

  const peekPdf = await investor(`/api/accounts/${someoneElse}/statements/position.pdf`);
  check('investor cannot download another account’s statement', peekPdf.status === 403, peekPdf.status);

  console.log('\nStatements');
  const position = await investor(`/api/accounts/${newAccountId}/statements/position.pdf`);
  const positionBytes = position.body as ArrayBuffer;
  check('capital position statement returns a PDF', position.status === 200, position.status);
  check(
    'the PDF has real content',
    positionBytes.byteLength > 800 &&
      new TextDecoder().decode(positionBytes.slice(0, 5)).startsWith('%PDF'),
    positionBytes.byteLength,
  );

  const records = await investor(`/api/accounts/${newAccountId}/records`);
  const recordId = records.body.records[0]._id;
  const monthly = await investor(`/api/accounts/${newAccountId}/statements/${recordId}.pdf`);
  const monthlyBytes = monthly.body as ArrayBuffer;
  check('monthly report returns a PDF', monthly.status === 200, monthly.status);
  check(
    'the monthly PDF has real content',
    monthlyBytes.byteLength > 800 &&
      new TextDecoder().decode(monthlyBytes.slice(0, 5)).startsWith('%PDF'),
    monthlyBytes.byteLength,
  );

  console.log('\nCapital requests and passwords');
  const request = await investor('/api/capital-requests', {
    method: 'POST',
    body: JSON.stringify({ action: 'Compound', contactName: 'Test Investor', amount: 267 }),
  });
  check('investor logs a capital request', request.status === 201, request.body);

  const queue = await manager('/api/capital-requests');
  check('request reaches the manager queue', queue.body?.requests?.length === 1, queue.body);

  const changed = await investor('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: created.body.temporaryPassword,
      newPassword: 'a-much-longer-password',
    }),
  });
  check('investor changes their password', changed.status === 200, changed.body);

  const afterChange = await investor('/api/auth/me');
  check(
    'the change-password prompt clears',
    afterChange.body?.user?.mustChangePassword === false,
    afterChange.body,
  );

  // Manager-issued reset — the only recovery path for a forgotten password.
  const reset = await manager(`/api/accounts/${newAccountId}/reset-password`, { method: 'POST' });
  check('manager can reset an investor password', reset.status === 200, reset.body);

  const investor2 = createClient(base);
  const afterReset = await investor2('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'test.investor@example.com',
      password: reset.body.temporaryPassword,
    }),
  });
  check('the reset password works', afterReset.status === 200, afterReset.body);
  check(
    'a reset re-flags must-change-password',
    afterReset.body?.user?.mustChangePassword === true,
    afterReset.body?.user,
  );

  const oldPassword = await createClient(base)('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'test.investor@example.com',
      password: 'a-much-longer-password',
    }),
  });
  check('the old password stops working after a reset', oldPassword.status === 401, oldPassword.status);

  const investorReset = await investor2(`/api/accounts/${newAccountId}/reset-password`, {
    method: 'POST',
  });
  check('an investor cannot reset a password', investorReset.status === 403, investorReset.status);

  /*
   * Settlement — the distribution flow. This is where money actually moves and
   * where the high-water mark ratchets, so it gets checked end to end.
   */
  console.log('\nSettlement and the high-water mark');

  // Put the new account clearly into profit.
  await manager(`/api/accounts/${newAccountId}/records`, {
    method: 'POST',
    body: JSON.stringify({
      year: 2026,
      month: 7,
      openingBalance: 5_000,
      nfpResult: 1_000,
      realisedPnl: 1_000,
      closingEquity: 6_000,
    }),
  });

  const inProfit = await manager(`/api/accounts/${newAccountId}`);
  const beforeMark = inProfit.body?.account?.highWaterMark;
  check('a profitable account shows a projected fee', inProfit.body?.account?.position?.fee > 0, {
    fee: inProfit.body?.account?.position?.fee,
  });

  const compound = await investor2('/api/capital-requests', {
    method: 'POST',
    body: JSON.stringify({ action: 'Compound', contactName: 'Test Investor', amount: 0 }),
  });
  const compoundId = compound.body?.request?._id;

  const preview = await manager(`/api/capital-requests/${compoundId}/preview`);
  check('the manager can preview a settlement', preview.body?.preview != null, preview.body);
  check(
    'the preview does not change anything',
    (await manager(`/api/accounts/${newAccountId}`)).body?.account?.highWaterMark === beforeMark,
  );

  const settled = await manager(`/api/capital-requests/${compoundId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'settled' }),
  });
  check('settling succeeds', settled.status === 200, settled.body);

  const afterSettle = (await manager(`/api/accounts/${newAccountId}`)).body?.account;
  check('the high-water mark ratcheted up', afterSettle?.highWaterMark > beforeMark, {
    before: beforeMark,
    after: afterSettle?.highWaterMark,
  });
  check(
    'the same profit is not charged twice',
    afterSettle?.position?.fee === 0,
    afterSettle?.position,
  );
  check(
    'the distribution shows on the chart',
    afterSettle?.series?.some((point: { label: string }) => point.label.includes('settled')),
  );

  const twice = await manager(`/api/capital-requests/${compoundId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'settled' }),
  });
  check('settling the same request twice is refused', twice.status === 409, twice.status);

  console.log(`\n${passed} passed, ${failed} failed.`);

  server.close();
  await disconnectDb();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('smoke run failed:', err);
  process.exit(1);
});
