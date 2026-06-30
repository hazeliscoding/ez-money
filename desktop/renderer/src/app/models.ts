export type TransactionKind = 'Expense' | 'Income';

export interface Transaction {
  id: number;
  date: string; // YYYY-MM-DD
  period: string;
  description: string;
  rawDescription: string;
  category: string;
  kind: TransactionKind;
  amount: number;
  account: string;
  notes: string;
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
  period: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  byCategory: CategorySummary[];
}

export interface Budget {
  category: string;
  monthlyAmount: number;
}

export interface ImportResult {
  periods: string[];
  imported: number;
  income: number;
  expense: number;
  net: number;
  uncategorized: string[];
}

export interface HealthResult {
  status: string;
}

export type SortField = 'date' | 'amount' | 'description' | 'category';
export type SortDir = 'asc' | 'desc';

export interface TransactionQuery {
  period?: string;
  category?: string;
  kind?: '' | TransactionKind;
  q?: string;
  sort?: SortField;
  dir?: SortDir;
}

export interface TransactionPatch {
  category?: string;
  notes?: string;
}

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

export interface RuleSet {
  exclude: string[];
  rules: [string, string][];
  default: string;
}
