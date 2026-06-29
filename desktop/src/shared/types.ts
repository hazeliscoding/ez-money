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

export interface ParseResult {
  periods: string[];
  count: number;
  uncategorized: string[];
  transactions: ParsedTransaction[];
}

/** A persisted transaction (parser output + DB id). */
export interface Transaction extends ParsedTransaction {
  id: number;
}

export interface Budget {
  category: string;
  monthlyAmount: number;
}

export interface CategorySummary {
  category: string;
  budget: number;
  actual: number;
  remaining: number;
  pctBudget: number;
  pctSpend: number;
}

export interface Summary {
  period: string | null;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  byCategory: CategorySummary[];
}

export interface TransactionQuery {
  period?: string;
  category?: string;
  kind?: string;
  q?: string;
  sort?: string;
  dir?: string;
}

export interface ImportResult {
  periods: string[];
  imported: number;
  income: number;
  expense: number;
  net: number;
  uncategorized: string[];
}

/** The bridge exposed to the renderer as window.api (see preload.ts). */
export interface EzApi {
  health(): Promise<{ status: string }>;
  categories(): Promise<string[]>;
  periods(): Promise<string[]>;
  listTransactions(query: TransactionQuery): Promise<Transaction[]>;
  updateTransaction(id: number, patch: { category?: string; notes?: string }): Promise<Transaction>;
  removeTransaction(id: number): Promise<{ deleted: boolean }>;
  summary(period?: string): Promise<Summary>;
  budgets(): Promise<Budget[]>;
  updateBudgets(list: Budget[]): Promise<Budget[]>;
  importDialog(): Promise<ImportResult | { canceled: true }>;
  importBytes(bytes: ArrayBuffer): Promise<ImportResult>;
}
