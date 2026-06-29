"""Shared configuration: the canonical category set and default budgets.

Both the categorizer and the Excel builder import from here so they never
drift apart. Edit DEFAULT_BUDGETS to change the starting targets used when a
workbook is created for the first time (existing workbooks keep their own).
"""

# Canonical spending categories (order drives Setup / Summary / Dashboard rows).
CATEGORIES = [
    "Rent",
    "Utilities",
    "Groceries",
    "Dining Out",
    "Transportation & Gas",
    "Shopping",
    "Entertainment & Games",
    "Subscriptions",
    "Health & Fitness",
    "Pets",
    "Insurance",
    "Debt & Loan Payments",
    "Other",
]

# Label used for income rows in the Category column (Type=Income drives the math).
INCOME_LABEL = "Income"

# Starting monthly budget targets (round numbers near the first imported month).
DEFAULT_BUDGETS = {
    "Rent": 2350,
    "Utilities": 450,
    "Groceries": 900,
    "Dining Out": 600,
    "Transportation & Gas": 75,
    "Shopping": 900,
    "Entertainment & Games": 900,
    "Subscriptions": 650,
    "Health & Fitness": 250,
    "Pets": 125,
    "Insurance": 360,
    "Debt & Loan Payments": 550,
    "Other": 150,
}
