/**
 * Parse the Chime "Combined Account Activity" lines into raw transactions.
 * Combined-activity rows have six fields:
 *   <txn date> <description> <type> <amount> <account> <settlement date>
 * The later per-account billing sections are five-field, so this strict regex
 * ignores them (no double-counting).
 */

export interface RawTxn {
  date: string; // 'YYYY-MM-DD'
  description: string;
  statementType: string;
  amount: number; // signed: negative = money out
  account: string;
  settlement: string;
}

const TYPES = 'Round Up Transfer|Direct Debit|Transfer|Purchase|Deposit|Adjustment|Payment';
const ACCTS = 'Secured Deposit Account|Chime Card|Checking';

const LINE = new RegExp(
  `^(\\d{1,2}/\\d{2}/\\d{4})\\s+(.+?)\\s+(${TYPES})\\s+` +
    `(-?\\$[\\d,]+\\.\\d{2})\\s+(${ACCTS})\\s+(\\d{1,2}/\\d{2}/\\d{4})\\s*$`,
);

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PERIOD_RE = new RegExp(`\\b(${MONTHS.join('|')})\\s+(20\\d\\d)\\s*\\(`, 'i');

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseDate(s: string): string {
  const [m, d, y] = s.split('/').map((p) => parseInt(p, 10));
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseAmount(s: string): number {
  const negative = s.trim().startsWith('-');
  const value = parseFloat(s.replace(/-/g, '').replace(/\$/g, '').replace(/,/g, ''));
  return negative ? -value : value;
}

/** Statement period label, e.g. 'Jun 2026', or null if not found. */
export function detectPeriod(lines: string[]): string | null {
  for (const ln of lines) {
    const m = PERIOD_RE.exec(ln);
    if (m) {
      const idx = MONTHS.findIndex((mm) => mm.toLowerCase() === m[1].toLowerCase());
      return `${MONTH_ABBR[idx]} ${m[2]}`;
    }
  }
  return null;
}

export function parseRawTransactions(lines: string[]): RawTxn[] {
  const txns: RawTxn[] = [];
  for (const raw of lines) {
    const m = LINE.exec(raw.trim());
    if (!m) continue;
    txns.push({
      date: parseDate(m[1]),
      description: m[2].replace(/\s+/g, ' ').trim(),
      statementType: m[3],
      amount: parseAmount(m[4]),
      account: m[5],
      settlement: parseDate(m[6]),
    });
  }
  return txns;
}
