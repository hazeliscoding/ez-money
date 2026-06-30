/**
 * Canonical expense categories (the single source of truth used to seed budgets
 * and validate categorization). `as const` keeps it a readonly literal tuple so
 * the values can be used as a union type elsewhere. 'Income' is intentionally
 * excluded here — it's a transaction kind, not a budgeted expense category.
 */
export const CATEGORIES = [
  'Rent',
  'Utilities',
  'Groceries',
  'Dining Out',
  'Transportation & Gas',
  'Shopping',
  'Entertainment & Games',
  'Subscriptions',
  'Health & Fitness',
  'Pets',
  'Insurance',
  'Debt & Loan Payments',
  'Other',
] as const;

/** The category assigned to all income rows. */
export const INCOME_LABEL = 'Income';

/** Categories plus 'Income' — the full set offered in the UI's category dropdown. */
export const CATEGORY_PICKLIST = [...CATEGORIES, INCOME_LABEL];

/** Starting monthly budget per category, applied once by BudgetsService.seed(). */
export const DEFAULT_BUDGETS: Record<string, number> = {
  Rent: 2350,
  Utilities: 450,
  Groceries: 900,
  'Dining Out': 600,
  'Transportation & Gas': 75,
  Shopping: 900,
  'Entertainment & Games': 900,
  Subscriptions: 650,
  'Health & Fitness': 250,
  Pets: 125,
  Insurance: 360,
  'Debt & Loan Payments': 550,
  Other: 150,
};
