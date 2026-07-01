/**
 * Parse the Chime "Combined Account Activity" lines into raw transactions.
 * Combined-activity rows have six fields:
 *   <txn date> <description> <type> <amount> <account> <settlement date>
 * The later per-account billing sections are five-field, so this strict regex
 * ignores them (no double-counting).
 */

/** One Combined-Activity row, parsed but not yet cleaned/categorized. */
export interface RawTxn {
  date: string; // 'YYYY-MM-DD'
  description: string;
  statementType: string; // Chime's transaction type, e.g. 'Purchase', 'Deposit'
  amount: number; // signed: negative = money out
  account: string;
  settlement: string; // posting/settlement date, 'YYYY-MM-DD'
}

// Closed sets of the literal type/account tokens Chime prints. Anchoring on
// these is what makes the 6-field match strict (and lets the lazy `(.+?)`
// description stop at the type column instead of swallowing it).
const TYPES = 'Round Up Transfer|Direct Debit|Transfer|Purchase|Deposit|Adjustment|Payment';
const ACCTS = 'Secured Deposit Account|Chime Card|Checking';

// Full 6-field row: date, description, type, amount, account, settlement date.
// Five-field billing rows lack the trailing account+date and therefore won't match.
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

/**
 * Find the statement period by scanning for a "<Month> <Year> (" heading and
 * normalizing it to a short label, e.g. 'Jun 2026'. Returns null if no such
 * heading is present (the caller treats that as "not a recognizable statement").
 */
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

/** Which kind of Chime statement a PDF is — drives accept vs. reject on import. */
export type StatementType = 'combined' | 'checking' | 'savings' | 'unknown';

/**
 * Classify a statement by its title line. Only the **Combined Account Activity**
 * statement (on the Credit Builder statement) is supported: it already spans
 * every account (Checking, Chime Card, Secured Deposit), so importing the
 * standalone Checking/Savings statements too would double-count the same
 * transactions under a different (calendar-month vs. billing-cycle) period.
 * "Combined" is checked first so a Credit statement that merely mentions the word
 * "Checking" in a row isn't misclassified.
 */
export function detectStatementType(lines: string[]): StatementType {
  const text = lines.join('\n');
  if (/Combined Account Activity/i.test(text)) return 'combined';
  if (/Checking Account Statement/i.test(text)) return 'checking';
  if (/Savings Account Statement/i.test(text)) return 'savings';
  return 'unknown';
}

/**
 * Extract every Combined-Activity transaction from the page lines. The strict
 * 6-field {@link LINE} regex is the filter: only six-field rows match, so the
 * later five-field per-account billing sections are skipped and amounts are not
 * double-counted. Non-matching lines (headers, totals, page chrome) are ignored.
 */
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
