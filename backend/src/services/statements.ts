/**
 * Branded PDF statements, generated on demand.
 *
 * Two documents, matching what the investor desk shows on screen: the monthly
 * performance report for one period, and the capital position statement as it
 * stands today. Both stream straight to the response — nothing is written to
 * disk, so there is no stale statement to invalidate when a figure is corrected.
 */
import PDFDocument from 'pdfkit';
import type { Writable } from 'node:stream';
import type { PerformanceRecordDoc } from '../models/PerformanceRecord.js';
import type { AccountView } from './portfolio.js';
import { FEE_RATE, KEEP_RATE, periodLabel } from './domain.js';

const INK = '#0A2342';
const GOLD = '#F2A900';
const GREEN = '#1F9D6B';
const RED = '#E5392B';
const MUTE = '#5D6A78';
const FAINT = '#8D97A2';
const LINE = '#E3D8C0';

const EMAIL = 'invest@encryptcap.com';
const RC = '7363337';

const money = (n: number): string =>
  '$' + Math.round(n).toLocaleString('en-US');

const signed = (n: number): string => (n >= 0 ? '+' : '−') + money(Math.abs(n));

type Doc = PDFKit.PDFDocument;

const MARGIN = 50;
const WIDTH = 595.28 - MARGIN * 2; // A4 width minus margins

function header(doc: Doc, title: string, subtitle: string): void {
  doc.rect(0, 0, 595.28, 108).fill(INK);

  doc
    .fillColor('#FFFFFF')
    .fontSize(17)
    .font('Helvetica-Bold')
    .text('Encrypt', MARGIN, 32, { continued: true })
    .fillColor(GOLD)
    .text('Capital');

  doc
    .fillColor('#9FB4CA')
    .fontSize(9)
    .font('Helvetica')
    .text(subtitle, MARGIN, 56);

  doc
    .fillColor('#FFFFFF')
    .fontSize(15)
    .font('Helvetica-Bold')
    .text(title, MARGIN, 74);

  doc.y = 140;
}

/** Label/value row with a hairline rule above it. */
function row(doc: Doc, label: string, value: string, opts: { color?: string; note?: string } = {}): void {
  const y = doc.y;

  doc.moveTo(MARGIN, y).lineTo(MARGIN + WIDTH, y).lineWidth(0.5).strokeColor(LINE).stroke();

  doc
    .fillColor(INK)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(label, MARGIN, y + 10, { width: WIDTH * 0.6 });

  const labelBottom = doc.y;

  if (opts.note) {
    doc
      .fillColor(FAINT)
      .fontSize(8)
      .font('Helvetica')
      .text(opts.note, MARGIN, doc.y + 1, { width: WIDTH * 0.6 });
  }

  doc
    .fillColor(opts.color ?? INK)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(value, MARGIN + WIDTH * 0.6, y + 10, { width: WIDTH * 0.4, align: 'right' });

  doc.y = Math.max(labelBottom, doc.y) + 10;
}

function sectionTitle(doc: Doc, text: string): void {
  doc
    .fillColor(GOLD)
    .fontSize(8)
    .font('Helvetica-Bold')
    .text(text.toUpperCase(), MARGIN, doc.y, { characterSpacing: 1.4 });
  doc.moveDown(0.5);
}

function accountBlock(doc: Doc, account: AccountView): void {
  sectionTitle(doc, 'Account');

  doc.fontSize(9).font('Helvetica').fillColor(MUTE);
  doc.text(
    `${account.investorName}   ·   ${account.reference}   ·   ${account.tierLabel}   ·   ${account.tierCycle} cycle`,
    MARGIN,
    doc.y,
    { width: WIDTH },
  );
  doc.moveDown(1);
}

function footer(doc: Doc, note: string): void {
  const y = 720;

  doc.moveTo(MARGIN, y).lineTo(MARGIN + WIDTH, y).lineWidth(0.5).strokeColor(LINE).stroke();

  doc
    .fillColor(FAINT)
    .fontSize(7.5)
    .font('Helvetica')
    .text(note, MARGIN, y + 10, { width: WIDTH, lineGap: 2 });

  doc.text(
    `Encrypt Capital Ltd. (RC ${RC})  ·  ${EMAIL}  ·  Generated ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    MARGIN,
    doc.y + 6,
    { width: WIDTH },
  );
}

const RISK_NOTE =
  'Figures are realized and broker-verified, denominated in USD. Trading global markets carries substantial risk ' +
  'and past results do not guarantee future returns; your capital can fall below the amount invested. This statement ' +
  'is a record of your account, not investment advice.';

/** Monthly performance report for a single period. */
export function streamMonthlyReport(
  out: Writable,
  account: AccountView,
  record: PerformanceRecordDoc,
): void {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  doc.pipe(out);

  const period = periodLabel(record.year, record.month);
  header(doc, 'Monthly performance report', period);
  accountBlock(doc, account);

  sectionTitle(doc, 'This period');

  row(doc, 'Opening balance', money(record.openingBalance), {
    note: 'Your equity at the start of the period.',
  });
  row(doc, 'NFP trade executed', signed(record.nfpResult), {
    color: record.nfpResult >= 0 ? GREEN : RED,
    note: 'Result of the trade placed around the Non-Farm Payrolls release.',
  });
  row(doc, 'Realised profit / loss', signed(record.realisedPnl), {
    color: record.realisedPnl >= 0 ? GREEN : RED,
    note: 'Booked result for the period — money actually made or lost, not on-paper.',
  });
  row(doc, 'Closing equity', money(record.closingEquity), {
    note: 'Your equity at the end of the period.',
  });

  doc.moveDown(1);

  if (record.brokerVerified) {
    doc
      .fillColor(GREEN)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('✓  Broker-verified', MARGIN, doc.y);
    doc
      .fillColor(FAINT)
      .fontSize(8)
      .font('Helvetica')
      .text('These figures are drawn from broker records.', MARGIN, doc.y + 2);
  }

  footer(doc, RISK_NOTE);
  doc.end();
}

/** Capital position statement — where the account stands today. */
export function streamPositionStatement(out: Writable, account: AccountView): void {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  doc.pipe(out);

  const { position } = account;

  header(
    doc,
    'Capital position statement',
    `As at ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`,
  );
  accountBlock(doc, account);

  sectionTitle(doc, 'Your position');

  row(doc, 'Deposited capital', money(account.depositedCapital), {
    note: 'The capital you put in — your baseline. Fees only apply to profit above this.',
  });
  row(doc, 'Current equity', money(position.equity), {
    note: 'What your account is worth today.',
  });
  row(doc, 'Profit this cycle', signed(position.profit), {
    color: position.profit >= 0 ? GREEN : RED,
    note: 'Profit accrued since your cycle began.',
  });
  row(doc, 'Return on capital', `${(position.returnOnCapital * 100).toFixed(1)}%`, {
    color: position.returnOnCapital >= 0 ? GREEN : RED,
  });

  doc.moveDown(0.8);
  sectionTitle(doc, 'How this settles');

  row(doc, `Your projected share (${(KEEP_RATE * 100).toFixed(1)}%)`, `~${money(position.investorShare)}`, {
    color: GREEN,
    note: 'An estimate until the cycle settles. Calculated on profit above your deposit only.',
  });
  row(doc, `Management fee (${(FEE_RATE * 100).toFixed(1)}%)`, `~${money(position.fee)}`, {
    note: 'Charged on profit only. If the account does not profit, this is zero.',
  });
  row(doc, 'Next distribution', account.nextDistributionLabel, {
    note: `Your ${account.tierCycle.toLowerCase()} review.`,
  });

  if (!position.aboveHighWaterMark) {
    doc.moveDown(0.6);
    doc
      .fillColor(MUTE)
      .fontSize(8.5)
      .font('Helvetica')
      .text(
        'This account is currently below its invested capital. No management fee applies until it recovers above ' +
          `${money(account.highWaterMark)}. Losses reduce your capital; they are not carried as a debt.`,
        MARGIN,
        doc.y,
        { width: WIDTH, lineGap: 2 },
      );
  }

  footer(doc, RISK_NOTE);
  doc.end();
}
