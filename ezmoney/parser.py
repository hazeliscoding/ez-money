"""Parse a Chime 'Combined Account Activity Statement' PDF.

Extracts the statement period and every line in the combined-activity table.
The combined-activity rows have six fields:

    <txn date> <description> <type> <amount> <account> <settlement date>

The later per-account billing sections use a five-field layout (no account
column), so the strict regex below naturally ignores them and we never
double-count.
"""

import datetime as dt
import re

import pdfplumber

from .models import RawTxn

# Multi-word types/accounts first so the alternation prefers the longer match.
_TYPES = r"Round Up Transfer|Direct Debit|Transfer|Purchase|Deposit|Adjustment|Payment"
_ACCTS = r"Secured Deposit Account|Chime Card|Checking"

_LINE = re.compile(
    rf"^(?P<date>\d{{1,2}}/\d{{2}}/\d{{4}})\s+"
    rf"(?P<desc>.+?)\s+"
    rf"(?P<type>{_TYPES})\s+"
    rf"(?P<amt>-?\$[\d,]+\.\d{{2}})\s+"
    rf"(?P<acct>{_ACCTS})\s+"
    rf"(?P<settle>\d{{1,2}}/\d{{2}}/\d{{4}})\s*$"
)

_MONTHS = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11,
    "December": 12,
}
_MONTH_ABBR = {v: k[:3] for k, v in _MONTHS.items()}

_PERIOD_RE = re.compile(
    r"\b(" + "|".join(_MONTHS) + r")\s+(20\d\d)\s*\(", re.IGNORECASE
)


def _parse_date(s: str) -> dt.date:
    m, d, y = (int(p) for p in s.split("/"))
    return dt.date(y, m, d)


def _parse_amount(s: str) -> float:
    neg = s.lstrip().startswith("-")
    val = float(s.replace("-", "").replace("$", "").replace(",", ""))
    return -val if neg else val


def extract_text_lines(pdf_path: str) -> list[str]:
    lines: list[str] = []
    with pdfplumber.open(pdf_path) as doc:
        for page in doc.pages:
            text = page.extract_text() or ""
            lines.extend(text.splitlines())
    return lines


def detect_period(lines: list[str]) -> str | None:
    """Return the statement period label, e.g. 'Jun 2026', or None."""
    for ln in lines:
        m = _PERIOD_RE.search(ln)
        if m:
            month = _MONTHS[m.group(1).capitalize()]
            return f"{_MONTH_ABBR[month]} {m.group(2)}"
    return None


def parse_pdf(pdf_path: str) -> tuple[str | None, list[RawTxn]]:
    """Parse a statement PDF into (period_label, [RawTxn, ...])."""
    lines = extract_text_lines(pdf_path)
    period = detect_period(lines)
    txns: list[RawTxn] = []
    for ln in lines:
        m = _LINE.match(ln.strip())
        if not m:
            continue
        txns.append(
            RawTxn(
                date=_parse_date(m.group("date")),
                description=re.sub(r"\s+", " ", m.group("desc")).strip(),
                statement_type=m.group("type"),
                amount=_parse_amount(m.group("amt")),
                account=m.group("acct"),
                settlement=_parse_date(m.group("settle")),
            )
        )
    return period, txns
