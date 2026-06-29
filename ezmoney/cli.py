"""Command-line interface:  python -m ezmoney import <pdf(s)> [-o out.xlsx]"""

import argparse
import glob
import os

from .parser import parse_pdf
from .rules import load_rules, clean
from .excel import build_workbook, read_existing_budgets


def _expand(patterns: list[str]) -> list[str]:
    paths: list[str] = []
    for patt in patterns:
        matched = glob.glob(patt)
        if not matched and os.path.exists(patt):
            matched = [patt]
        paths.extend(matched)
    return sorted(set(os.path.normpath(p) for p in paths))


def cmd_import(args) -> int:
    paths = _expand(args.pdfs)
    if not paths:
        print("No PDF files matched:", " ".join(args.pdfs))
        return 1

    ruleset = load_rules(args.rules)
    all_txns = []
    seen_periods: dict[str, str] = {}
    uncategorized: set[str] = set()

    print(f"Importing {len(paths)} statement(s):")
    for p in paths:
        name = os.path.basename(p)
        period, raw = parse_pdf(p)
        if period is None:
            print(f"  ! {name}: could not detect statement period — skipped")
            continue
        if period in seen_periods:
            print(f"  ! {name}: period {period} already imported from "
                  f"{seen_periods[period]} — skipped (avoids duplicates)")
            continue
        txns, uncat = clean(raw, period, ruleset)
        uncategorized.update(uncat)
        seen_periods[period] = name
        all_txns.extend(txns)
        inc = sum(t.amount for t in txns if t.kind == "Income")
        exp = sum(t.amount for t in txns if t.kind == "Expense")
        print(f"  + {name} [{period}]: {len(txns)} transactions "
              f"({len(raw)} raw lines)  |  income ${inc:,.2f}  "
              f"spend ${exp:,.2f}  net ${inc - exp:,.2f}")

    if not all_txns:
        print("Nothing imported.")
        return 1

    out = args.output
    budgets = read_existing_budgets(out) if os.path.exists(out) else None
    if budgets:
        print(f"  (kept your edited budgets from existing {os.path.basename(out)})")
    try:
        build_workbook(all_txns, out, budgets=budgets)
    except PermissionError:
        print(f"\nCan't write {out} — it's open in Excel (or read-only). "
              f"Close it and re-run, or pass -o <other-name>.xlsx.")
        return 1
    print(f"\nWrote {out}  —  {len(all_txns)} transactions across "
          f"{len(seen_periods)} period(s).")

    if uncategorized:
        print("\nUncategorized merchants (landed in 'Other') — add patterns to "
              "category_rules.json:")
        for desc in sorted(uncategorized):
            print("   -", desc)
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        prog="ezmoney",
        description="Turn Chime statement PDFs into a budget/spending tracker.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    imp = sub.add_parser("import", help="import statement PDF(s) and (re)build the tracker")
    imp.add_argument("pdfs", nargs="+",
                     help='PDF path(s) or glob, e.g. "docs/statements/2026/*.pdf"')
    imp.add_argument("-o", "--output", default="Financial-Tracker-2026.xlsx",
                     help="output .xlsx (default: Financial-Tracker-2026.xlsx)")
    imp.add_argument("--rules", default=None,
                     help="path to a custom category_rules.json")
    imp.set_defaults(func=cmd_import)
    args = ap.parse_args(argv)
    return args.func(args)
