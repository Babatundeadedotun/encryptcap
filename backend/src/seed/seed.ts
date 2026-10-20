/**
 * Populate a database with the manager login, the synthetic book and the four
 * research pieces.
 *
 * Destructive: wipes users, accounts, performance records, capital requests,
 * subscribers and articles first. Intended for development and demos.
 *
 *   npm run seed
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../db/connect.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { Account } from '../models/Account.js';
import { PerformanceRecord } from '../models/PerformanceRecord.js';
import { CapitalRequest } from '../models/CapitalRequest.js';
import { Subscriber } from '../models/Subscriber.js';
import { Article } from '../models/Article.js';
import { TIMELINE, buildSeedBook } from './data.js';
import { SEED_ARTICLES } from './articles.js';

const DEMO_INVESTOR_PASSWORD = process.env.SEED_INVESTOR_PASSWORD ?? 'Investor!2026';

export async function seed(): Promise<{ manager: string; investors: number; articles: number }> {
  await Promise.all([
    User.deleteMany({}),
    Account.deleteMany({}),
    PerformanceRecord.deleteMany({}),
    CapitalRequest.deleteMany({}),
    Subscriber.deleteMany({}),
    Article.deleteMany({}),
  ]);

  const manager = new User({
    name: 'Portfolio Manager',
    email: env.seedManagerEmail.toLowerCase(),
    role: 'manager',
    mustChangePassword: true,
  });
  await manager.setPassword(env.seedManagerPassword);
  await manager.save();

  const book = buildSeedBook();
  let reference = 1041;

  for (const entry of book) {
    reference += 1;

    const user = new User({
      name: entry.name,
      email: entry.email,
      role: 'investor',
      mustChangePassword: true,
    });
    await user.setPassword(DEMO_INVESTOR_PASSWORD);
    await user.save();

    const joined = TIMELINE[entry.startMonth];
    const account = await Account.create({
      reference: `EC-${reference}`,
      owner: user._id,
      tier: entry.tier,
      depositedCapital: entry.depositedCapital,
      highWaterMark: entry.depositedCapital,
      joinedAt: new Date(joined.year, joined.month - 1, 1),
    });

    // One record per traded month. The funding month itself has no result, so
    // records begin the month after the account was opened.
    const records = [];
    for (let m = entry.startMonth + 1; m < TIMELINE.length; m += 1) {
      const closing = entry.series[m];
      const opening = entry.series[m - 1];
      if (closing == null || opening == null) continue;

      const realised = closing - opening;
      records.push({
        account: account._id,
        year: TIMELINE[m].year,
        month: TIMELINE[m].month,
        periodKey: TIMELINE[m].year * 100 + TIMELINE[m].month,
        openingBalance: opening,
        nfpResult: realised,
        realisedPnl: realised,
        closingEquity: closing,
        brokerVerified: true,
        createdBy: manager._id,
      });
    }
    if (records.length) await PerformanceRecord.insertMany(records);
  }

  for (const article of SEED_ARTICLES) {
    await Article.create({
      ...article,
      published: true,
      createdBy: manager._id,
    });
  }

  return {
    manager: manager.email,
    investors: book.length,
    articles: SEED_ARTICLES.length,
  };
}

/**
 * Only run when this file is the entry point, so importing seed() has no side
 * effects. Compare resolved paths — a substring check on "seed" also matches
 * sibling files under this directory, such as smoke.ts.
 */
const invokedDirectly =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const uri = await connectDb();
  const result = await seed();

  console.log('\nSeeded.');
  console.log(`  database   ${uri.replace(/\/\/[^@]*@/, '//<credentials>@')}`);
  console.log(`  manager    ${result.manager} / ${env.seedManagerPassword}`);
  console.log(`  investors  ${result.investors} accounts, password: ${DEMO_INVESTOR_PASSWORD}`);
  console.log(`  articles   ${result.articles}`);
  console.log('\nEvery seeded login is flagged must-change-password.');

  if (!env.mongoUri) {
    console.warn(
      '\nWARNING: this wrote to a throwaway in-memory database, which is now gone.\n' +
        'Set MONGODB_URI in backend/.env and re-run to seed something that persists.',
    );
  }

  await mongoose.connection.close();
  await disconnectDb();
  process.exit(0);
}
