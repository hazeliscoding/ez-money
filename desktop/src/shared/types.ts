/** Types shared between the Electron main process and the Angular renderer. */

export type Kind = 'Expense' | 'Income';

/** A cleaned, categorized transaction as produced by the parser. */
export interface ParsedTransaction {
  date: string; // 'YYYY-MM-DD'
  period: string; // e.g. 'Jun 2026'
  description: string;
  rawDescription: string;
  category: string;
  kind: Kind;
  amount: number; // positive magnitude
  account: string;
  notes: string;
}

/** Raw output of parsing a statement, before anything is persisted. */
export interface ParseResult {
  periods: string[];
  count: number;
  /** Distinct expense descriptions that hit the fallback category (need a rule). */
  uncategorized: string[];
  transactions: ParsedTransaction[];
}

/** A persisted transaction (parser output + DB id). */
export interface Transaction extends ParsedTransaction {
  id: number;
}

/** A category's monthly budget target. */
export interface Budget {
  category: string;
  monthlyAmount: number;
}

/** Budget-vs-actual for one category within a period. */
export interface CategorySummary {
  category: string;
  budget: number;
  actual: number;
  /** budget − actual (negative = over budget). */
  remaining: number;
  /** actual / budget (0 when budget is 0). */
  pctBudget: number;
  /** actual / total expense for the period (0 when there's no spend). */
  pctSpend: number;
}

/** Dashboard totals for a period; `period` is null when there's no data. */
export interface Summary {
  period: string | null;
  income: number;
  expense: number;
  /** income − expense. */
  net: number;
  /** net / income (0 when income is 0). */
  savingsRate: number;
  byCategory: CategorySummary[];
}

/** Filters/sort for listing transactions; all fields optional. `q` is free-text. */
export interface TransactionQuery {
  period?: string;
  category?: string;
  kind?: string;
  q?: string;
  sort?: string;
  dir?: string;
}

/** Summary of a completed import, returned to the UI. */
export interface ImportResult {
  periods: string[];
  /** Number of transactions persisted. */
  imported: number;
  income: number;
  expense: number;
  net: number;
  uncategorized: string[];
}

/** Fields for a manually-added transaction. */
export interface NewTransaction {
  date: string;
  period: string;
  description: string;
  category: string;
  kind: Kind;
  amount: number;
  account?: string;
  notes?: string;
}

/** Partial update of a transaction (any field). */
export interface UpdateTransaction {
  date?: string;
  period?: string;
  description?: string;
  category?: string;
  kind?: Kind;
  amount?: number;
  account?: string;
  notes?: string;
}

/** Editable categorization rules (mirrors category-rules.json). */
export interface RuleSet {
  exclude: string[];
  rules: [string, string][];
  default: string;
}

/** The bridge exposed to the renderer as window.api (see preload.ts). */
export interface EzApi {
  health(): Promise<{ status: string }>;
  categories(): Promise<string[]>;
  periods(): Promise<string[]>;
  listTransactions(query: TransactionQuery): Promise<Transaction[]>;
  createTransaction(input: NewTransaction): Promise<Transaction>;
  updateTransaction(id: number, patch: UpdateTransaction): Promise<Transaction>;
  removeTransaction(id: number): Promise<{ deleted: boolean }>;
  deletePeriod(period: string): Promise<{ deleted: number }>;
  renamePeriod(oldPeriod: string, newPeriod: string): Promise<{ updated: number }>;
  summary(period?: string): Promise<Summary>;
  budgets(): Promise<Budget[]>;
  updateBudgets(list: Budget[]): Promise<Budget[]>;
  getRules(): Promise<RuleSet>;
  saveRules(rules: RuleSet): Promise<RuleSet>;
  recategorize(): Promise<{ updated: number }>;
  importDialog(): Promise<ImportResult | { canceled: true }>;
  importBytes(bytes: ArrayBuffer): Promise<ImportResult>;
  exportCsv(period?: string): Promise<{ saved?: string; count?: number; canceled?: boolean }>;
  backupDatabase(): Promise<{ saved?: string; canceled?: boolean }>;
  openDataFolder(): Promise<string>;
}
