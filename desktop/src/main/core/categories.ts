/** Canonical category set + default budgets. Mirrors ezmoney/config.py. */
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

export const INCOME_LABEL = 'Income';
export const CATEGORY_PICKLIST = [...CATEGORIES, INCOME_LABEL];

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
