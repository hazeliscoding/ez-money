/**
 * Public entry point of the parser package: ties together text extraction
 * (pdf.ts), row parsing + period detection (parse.ts), and cleaning/
 * categorization (rules.ts).
 */
import { extractLines } from './pdf';
import { detectPeriod, parseRawTransactions } from './parse';
import { clean, loadRules, RuleSet } from './rules';
import type { ParseResult } from '../../../shared/types';

/**
 * Parse a Chime statement (path or bytes) into cleaned, categorized
 * transactions. If no statement period is detected the PDF is treated as
 * unrecognized and an empty result is returned (rather than throwing).
 *
 * @param src PDF file path or raw bytes.
 * @param ruleset Categorization rules; defaults to the bundled set so the parser
 *   is usable standalone (e.g. the golden test). The app passes the user's rules.
 */
export async function parsePdf(
  src: string | Uint8Array,
  ruleset: RuleSet = loadRules(),
): Promise<ParseResult> {
  const lines = await extractLines(src);
  const period = detectPeriod(lines);
  if (!period) {
    return { periods: [], count: 0, uncategorized: [], transactions: [] };
  }
  const raw = parseRawTransactions(lines);
  const { transactions, uncategorized } = clean(raw, period, ruleset);
  return { periods: [period], count: transactions.length, uncategorized, transactions };
}

export { loadRules } from './rules';
export type { RuleSet } from './rules';
