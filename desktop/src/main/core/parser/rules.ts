/**
 * Clean + categorize raw transactions.
 * 1. Drop Chime Credit Builder plumbing (and the user exclude list).
 * 2. Income vs. expense by amount sign (after plumbing removed).
 * 3. Categorize via category-rules.json (ordered, first match wins).
 */
import rulesJson from './category-rules.json';
import type { ParsedTransaction, RuleSet } from '../../../shared/types';
import type { RawTxn } from './parse';

export type { RuleSet };

const INCOME_LABEL = 'Income';

/** The bundled default ruleset (category-rules.json), used when no user file exists. */
export function loadRules(): RuleSet {
  return rulesJson as unknown as RuleSet;
}

/**
 * True for Chime "plumbing" — internal money movement that isn't real
 * income/spending and would distort totals: Round Up transfers, Credit Builder
 * card payments, savings transfers, MyPay advances/repayments, SpotMe, and
 * "moved to/from" lines. These rows are dropped before classification so the two
 * sides of an internal transfer don't both count.
 */
export function isPlumbing(raw: RawTxn): boolean {
  const d = raw.description.toLowerCase();
  const t = raw.statementType.toLowerCase();
  if (t === 'round up transfer') return true;
  if (d.startsWith('moved to') || d.startsWith('moved from')) return true;
  if (t === 'payment' || d.includes('card payment')) return true;
  if (d.includes('my pay advance') || d.includes('my pay repayment')) return true;
  if (d.startsWith('transfer from savings') || d.startsWith('transfer to savings')) return true;
  if (d.includes('spotme')) return true;
  if (d.includes('round up to savings')) return true;
  return false;
}

/**
 * Income vs. expense purely by amount sign (positive = money in = Income). Only
 * meaningful after {@link isPlumbing} rows are removed, since internal transfers
 * also have signs but aren't real income/expense.
 */
export function classifyKind(raw: RawTxn): 'Expense' | 'Income' {
  return raw.amount > 0 ? 'Income' : 'Expense';
}

/**
 * Pick a category for an expense description. Rules are ordered [substring,
 * category] pairs and the first case-insensitive substring match wins, so place
 * more specific patterns earlier. Income short-circuits to 'Income' (it isn't
 * rule-categorized); unmatched expenses get `fallback`.
 *
 * @param description Raw statement text to match against.
 * @param rules Ordered match rules; first hit wins.
 * @param fallback Category for expenses that match nothing.
 * @param kind Already-classified kind (see {@link classifyKind}).
 */
export function categorize(
  description: string,
  rules: [string, string][],
  fallback: string,
  kind: 'Expense' | 'Income',
): string {
  if (kind === 'Income') return INCOME_LABEL;
  const d = description.toLowerCase();
  for (const [pattern, category] of rules) {
    if (d.includes(pattern.toLowerCase())) return category;
  }
  return fallback;
}

/**
 * Tidy a raw description for display: strip a leading "Direct Debit:" prefix and
 * collapse runs of whitespace. The original text is kept separately as
 * `rawDescription` so categorization still matches the unmodified line.
 */
export function displayDescription(rawDesc: string): string {
  let s = rawDesc.trim();
  if (s.toLowerCase().startsWith('direct debit:')) {
    s = s.slice(s.indexOf(':') + 1).trim();
  }
  return s.replace(/\s+/g, ' ');
}

/**
 * Turn raw rows into final {@link ParsedTransaction}s: drop user-excluded and
 * plumbing rows, classify income/expense by sign, categorize expenses, and store
 * amounts as positive magnitudes. Expenses that fall through to the fallback
 * category are collected in `uncategorized` (deduped + sorted) so the UI can
 * surface descriptions that need a new rule.
 */
export function clean(
  rawTxns: RawTxn[],
  period: string,
  ruleset: RuleSet,
): { transactions: ParsedTransaction[]; uncategorized: string[] } {
  const fallback = ruleset.default ?? 'Other';
  const excludes = (ruleset.exclude ?? []).map((e) => e.toLowerCase());
  const transactions: ParsedTransaction[] = [];
  const uncategorized = new Set<string>();

  for (const raw of rawTxns) {
    const dl = raw.description.toLowerCase();
    if (excludes.some((e) => dl.includes(e))) continue;
    if (isPlumbing(raw)) continue;
    const kind = classifyKind(raw);
    const category = categorize(raw.description, ruleset.rules, fallback, kind);
    if (kind === 'Expense' && category === fallback) uncategorized.add(raw.description);
    transactions.push({
      date: raw.date,
      period,
      description: displayDescription(raw.description),
      rawDescription: raw.description,
      category,
      kind,
      amount: Math.abs(raw.amount),
      account: raw.account,
      notes: '',
    });
  }
  return { transactions, uncategorized: [...uncategorized].sort() };
}
