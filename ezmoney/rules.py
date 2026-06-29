"""Turn raw statement lines into cleaned, categorized transactions.

Two responsibilities:
  1. Drop Chime's internal plumbing (the noise) and honor the user exclude list.
  2. Categorize what's left, using the editable patterns in category_rules.json.

Income vs. expense is decided by the sign of the amount AFTER plumbing is
removed: money out -> Expense, money in -> Income. That's robust because every
internal/wash transfer is filtered first.
"""

import json
import os
import re

from .config import INCOME_LABEL
from .models import RawTxn, Transaction

_RULES_PATH = os.path.join(os.path.dirname(__file__), "category_rules.json")


def load_rules(path: str | None = None) -> dict:
    with open(path or _RULES_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def is_plumbing(raw: RawTxn) -> bool:
    """True for Chime Credit Builder mechanics that aren't real cash flow."""
    d = raw.description.lower()
    t = raw.statement_type.lower()
    if t == "round up transfer":
        return True
    if d.startswith("moved to") or d.startswith("moved from"):
        return True
    if t == "payment" or "card payment" in d:          # credit-card auto-payment
        return True
    if "my pay advance" in d or "my pay repayment" in d:  # advance/repayment wash
        return True
    if d.startswith("transfer from savings") or d.startswith("transfer to savings"):
        return True
    if "spotme" in d:                                   # SpotMe line-of-credit move
        return True
    if "round up to savings" in d:
        return True
    return False


def classify_kind(raw: RawTxn) -> str:
    return "Income" if raw.amount > 0 else "Expense"


def categorize(description: str, rules: list, default: str, kind: str) -> str:
    if kind == "Income":
        return INCOME_LABEL
    d = description.lower()
    for pattern, category in rules:
        if pattern.lower() in d:
            return category
    return default


def display_description(raw_desc: str) -> str:
    """Light cleanup for the display column; raw is kept for re-categorizing."""
    s = raw_desc.strip()
    if s.lower().startswith("direct debit:"):
        s = s.split(":", 1)[1].strip()
    return re.sub(r"\s+", " ", s)


def clean(raw_txns: list[RawTxn], period: str, ruleset: dict
          ) -> tuple[list[Transaction], list[str]]:
    """Filter + categorize. Returns (transactions, uncategorized_descriptions)."""
    rules = ruleset.get("rules", [])
    default = ruleset.get("default", "Other")
    excludes = [e.lower() for e in ruleset.get("exclude", [])]

    out: list[Transaction] = []
    uncategorized: set[str] = set()
    for raw in raw_txns:
        dl = raw.description.lower()
        if any(e in dl for e in excludes):
            continue
        if is_plumbing(raw):
            continue
        kind = classify_kind(raw)
        category = categorize(raw.description, rules, default, kind)
        if kind == "Expense" and category == default:
            uncategorized.add(raw.description)
        out.append(
            Transaction(
                date=raw.date,
                description=display_description(raw.description),
                raw_description=raw.description,
                category=category,
                kind=kind,
                amount=abs(raw.amount),
                account=raw.account,
                period=period,
            )
        )
    return out, sorted(uncategorized)
