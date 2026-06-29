"""Data models shared across the parser, cleaner, and output layers."""

from dataclasses import dataclass
import datetime as dt


@dataclass
class RawTxn:
    """A single line from the Chime combined-activity statement, as parsed."""
    date: dt.date
    description: str          # original statement description
    statement_type: str      # Purchase / Transfer / Direct Debit / Deposit / ...
    amount: float            # SIGNED: negative = money out, positive = money in
    account: str             # Checking / Chime Card / Secured Deposit Account
    settlement: dt.date


@dataclass
class Transaction:
    """A cleaned, categorized transaction ready for the tracker."""
    date: dt.date
    description: str          # display description (lightly cleaned)
    raw_description: str      # original, kept for re-categorization/debugging
    category: str
    kind: str                # "Expense" or "Income"
    amount: float            # POSITIVE magnitude
    account: str
    period: str              # statement period label, e.g. "Jun 2026"
    notes: str = ""
