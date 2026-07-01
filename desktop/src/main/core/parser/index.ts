/**
 * Public entry point of the parser package: ties together text extraction
 * (pdf.ts), row parsing + period detection (parse.ts), and cleaning/
 * categorization (rules.ts).
 */
import { extractLines } from './pdf';
import { detectPeriod, detectStatementType, parseRawTransactions } from './parse';
import { clean, loadRules, RuleSet } from './rules';
import type { ParseResult } from '../../../shared/types';

/**
 * Parse a Chime statement (path or bytes) into cleaned, categorized transactions.
 *
 * Throws a user-facing {@link Error} for anything it can't (or shouldn't) import,
 * so the UI can show a specific reason rather than a generic failure:
 * - the file can't be read as a PDF;
 * - it's a Chime Checking/Savings statement (unsupported — the Combined Account
 *   Activity statement already includes those transactions, so importing one too
 *   would double-count);
 * - it isn't a recognizable Chime statement at all.
 *
 * @param src PDF file path or raw bytes.
 * @param ruleset Categorization rules; defaults to the bundled set so the parser
 *   is usable standalone (e.g. the golden test). The app passes the user's rules.
 */
export async function parsePdf(
  src: string | Uint8Array,
  ruleset: RuleSet = loadRules(),
): Promise<ParseResult> {
  let lines: string[];
  try {
    lines = await extractLines(src);
  } catch {
    throw new Error("Couldn't read that file as a PDF. Please choose a valid statement PDF.");
  }

  const type = detectStatementType(lines);
  if (type === 'checking' || type === 'savings') {
    const name = type === 'checking' ? 'Checking' : 'Savings';
    throw new Error(
      `This is a Chime ${name} statement. Import your Chime Credit Builder statement instead — ` +
        `its "Combined Account Activity" already includes your ${name.toLowerCase()} transactions, ` +
        `so importing this one too would double-count them.`,
    );
  }

  const period = detectPeriod(lines);
  if (type === 'unknown' || !period) {
    throw new Error(
      "This doesn't look like a Chime Combined Account Activity statement. " +
        'Please import a Chime Credit Builder statement PDF.',
    );
  }

  const raw = parseRawTransactions(lines);
  const { transactions, uncategorized } = clean(raw, period, ruleset);
  return { periods: [period], count: transactions.length, uncategorized, transactions };
}

export { loadRules } from './rules';
export type { RuleSet } from './rules';
