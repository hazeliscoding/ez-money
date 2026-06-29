/** Parse a Chime statement PDF into cleaned, categorized transactions. */
import { extractLines } from './pdf';
import { detectPeriod, parseRawTransactions } from './parse';
import { clean, loadRules, RuleSet } from './rules';
import type { ParseResult } from '../../../shared/types';

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
