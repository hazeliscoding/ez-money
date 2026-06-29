# ez-money-management

Turn Chime statement PDFs into a clean, formatted budget & spending tracker
(`.xlsx`). Drop in a statement, run one command, get a dashboard.

## Setup

```bash
pip install -r requirements.txt
```

Requires Python 3.10+.

## Usage

Put statements under `docs/statements/<year>/` and run:

```bash
python -m ezmoney import "docs/statements/2026/*.pdf"
```

This writes `Financial-Tracker-2026.xlsx` with five tabs:

- **Dashboard** — pick a period (gold cell) → KPIs, budget-vs-actual, charts.
- **Transactions** — the cleaned, categorized data table.
- **Monthly Summary** — category × statement-period grid + income/expense trend.
- **Setup** — categories and editable monthly budgets.
- **Guide** — in-workbook how-to.

Options: `-o <file.xlsx>` to change the output, `--rules <file.json>` for a
custom category map.

## How it works

```
PDF → parser.py → rules.py (clean + categorize) → excel.py → workbook
```

1. **Parse** (`parser.py`) — pdfplumber reads the *Combined Account Activity*
   table (one row = one transaction) and the statement period.
2. **Clean** (`rules.py`) — drops Chime Credit Builder plumbing that isn't real
   cash flow: `Moved to/from` transfers, `Round Up to Savings`, the card
   auto-payment, and the payday-advance/repayment wash (the advance *fee* is
   kept). Income vs. expense is then decided by the sign of the amount.
3. **Categorize** (`category_rules.json`) — ordered `[pattern, category]` list,
   first match wins. Unmatched merchants land in **Other** and are listed after
   each import so you can add a rule.
4. **Render** (`excel.py`) — formula-driven workbook; transactions are bucketed
   by **statement period** (Chime's ~29th–28th cycle) so rent and the
   late-month paycheck stay with the statement they belong to.

## Customizing

Edit `ezmoney/category_rules.json` and re-import — changes are reproducible:

- **Recategorize a merchant:** add/reorder a `[pattern, category]` rule.
- **Hide a line entirely:** add a substring to the `exclude` list.

Re-importing rebuilds the workbook from the PDFs (your edited **budgets** are
preserved; direct edits to category/description cells in the sheet are not — put
those in `category_rules.json` instead).

## Desktop app

A distributable desktop app (Electron) — import statement PDFs, edit categories
that **persist**, and browse dashboards across periods, all stored locally in
SQLite. No server, no Docker, and **no Python at runtime**. The UI is the same
dense, fast Angular renderer (McMaster-Carr styling, vanilla CSS).

```
Angular renderer  --IPC-->  Electron main  -->  SQLite (sql.js, in userData)
                                          \-->  TypeScript PDF parser (no Python)
```

### Prerequisites
- Node 20+. (No Python, Docker, or database needed.)

### Run it (one command)

```bash
npm install        # root tooling
npm run setup      # installs frontend + desktop deps
npm run dev        # Angular dev server + Electron, together
```

The window opens; go to **Import** and choose a statement PDF. Category and note
edits persist in SQLite (`ezmoney.sqlite` in your OS user-data folder). Importing
a statement replaces that period's transactions.

### Build installers
```bash
npm run package:win      # Windows NSIS installer -> desktop/release/
npm run package:linux    # Linux AppImage (build on Linux or WSL)
```
Installers are **unsigned**, so Windows SmartScreen / "unknown publisher" will
warn on first run (code signing is a separate, paid step). macOS is not targeted.

### Layout
- `desktop/` — Electron app: `src/main` (window, IPC, SQLite via TypeORM, and the
  TS PDF parser in `core/parser`), `src/preload` (the `window.api` bridge).
- `frontend/` — Angular renderer (Dashboard, Transactions, Budgets, Import),
  built into `desktop/dist/renderer`.
- `ezmoney/` — the original Python CLI + Excel exporter (unchanged).

### Tests (headless)
```bash
cd desktop && npm run test:parser   # TS parser matches the Python output exactly
cd desktop && npm run test:db       # SQLite data layer: import, summary, persistence
cd desktop && npm run build:main && npm run smoke   # live IPC round-trip via Electron
```

## Roadmap

- **Step 1 (done):** PDF → cleaned, categorized Excel tracker (`ezmoney/`).
- **Step 2 (done):** desktop app — local SQLite, persistent edits, multi-period
  dashboards, distributable installers. (Superseded the earlier web-app prototype.)
