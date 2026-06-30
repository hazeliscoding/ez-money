/**
 * Whether a transaction is money out or money in. This carries the sign meaning
 * for the app: amounts are always stored and displayed as positive numbers, and
 * the kind determines how they're aggregated (Expense counts against spending,
 * Income toward income). There is no negative `amount`.
 */
export type TransactionKind = 'Expense' | 'Income';

/** A single stored transaction as returned by the main process. */
export interface Transaction {
  id: number;
  date: string; // YYYY-MM-DD
  period: string;
  description: string;
  /** Original, un-cleaned description from the source statement (kept for audit/re-matching). */
  rawDescription: string;
  category: string;
  kind: TransactionKind;
  /** Always positive; sign meaning comes from `kind`. */
  amount: number;
  account: string;
  notes: string;
}

/** One category's budget-vs-actual figures for a period (a Dashboard table row). */
export interface CategorySummary {
  category: string;
  budget: number;
  actual: number;
  /** budget - actual; negative means over budget. */
  remaining: number;
  /** actual as a percentage of budget. */
  pctBudget: number;
  /** This category's share of total spend, as a percentage. */
  pctSpend: number;
}

/** Aggregated KPIs and per-category breakdown for one period (Dashboard data). */
export interface Summary {
  period: string;
  income: number;
  expense: number;
  /** income - expense. */
  net: number;
  /** net as a percentage of income. */
  savingsRate: number;
  byCategory: CategorySummary[];
}

/** One period's aggregated totals for the Trends (multi-period) view. */
export interface TrendRow {
  period: string;
  income: number;
  expense: number;
  /** income - expense. */
  net: number;
  /** net as a fraction of income (0 when income is 0). */
  savingsRate: number;
}

/** A monthly budget target for a single category. */
export interface Budget {
  category: string;
  monthlyAmount: number;
}

/** Outcome of a statement import. */
export interface ImportResult {
  /** Periods touched by this import (may be more than one if the statement spans months). */
  periods: string[];
  imported: number;
  income: number;
  expense: number;
  net: number;
  /** Merchant descriptions that matched no rule and need a category assigned. */
  uncategorized: string[];
}

/** Response of the liveness check. */
export interface HealthResult {
  status: string;
}

export type SortField = 'date' | 'amount' | 'description' | 'category';
export type SortDir = 'asc' | 'desc';

/**
 * Filter + sort criteria for listing transactions. All fields optional; empty
 * string / undefined means "no filter". `kind: ''` matches both kinds.
 */
export interface TransactionQuery {
  period?: string;
  category?: string;
  kind?: '' | TransactionKind;
  /** Free-text search over the description. */
  q?: string;
  sort?: SortField;
  dir?: SortDir;
}

/** Narrow patch used for inline edits (category/notes only). */
export interface TransactionPatch {
  category?: string;
  notes?: string;
}

/** Payload for creating a manual transaction. `amount` is positive; see {@link TransactionKind}. */
export interface NewTransaction {
  date: string;
  period: string;
  description: string;
  category: string;
  kind: TransactionKind;
  amount: number;
  account?: string;
  notes?: string;
}

/** Partial update for an existing transaction; only provided fields are changed. */
export interface UpdateTransaction {
  date?: string;
  period?: string;
  description?: string;
  category?: string;
  kind?: TransactionKind;
  amount?: number;
  account?: string;
  notes?: string;
}

/**
 * Auto-categorization config edited on the Settings page.
 * - `exclude`: descriptions skipped entirely on import.
 * - `rules`: ordered `[pattern, category]` pairs; first match wins.
 * - `default`: category applied when no rule matches.
 */
export interface RuleSet {
  exclude: string[];
  rules: [string, string][];
  default: string;
}
