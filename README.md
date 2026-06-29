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

## Web app

A local web app (Angular + NestJS + PostgreSQL) wraps the same Python parser.
Upload statement PDFs in the browser, edit categories that **persist** (unlike
the spreadsheet), and browse dashboards across periods. UI is intentionally
dense and fast (McMaster-Carr styling, vanilla CSS — no component framework).

```
browser (Angular SPA)  →  NestJS API  →  spawns `python -m ezmoney parse`  →  PostgreSQL
```

### Prerequisites
- Node 20+, Docker (for Postgres), and the Python package set up (`pip install -r requirements.txt`).

### Run it (three terminals)

```bash
# 1. database
docker compose up -d db                      # Postgres on host port 5433

# 2. API  (http://localhost:3000/api)
cd backend && cp .env.example .env && npm install && npm run start:dev

# 3. UI   (http://localhost:4200)
cd frontend && npm install && npm start      # proxies /api -> :3000
```

Then open http://localhost:4200, go to **Import**, and drop in a statement PDF.

Notes:
- Postgres is published on **5433** (not 5432) to avoid clashing with a local
  Postgres install; `backend/.env` is preconfigured to match.
- The API shells out to `python -m ezmoney parse` from the repo root, so the
  Python package and its deps must be importable (`PYTHON_BIN` in `.env`).
- Importing a statement **replaces** that period's transactions; category/notes
  edits persist in the DB. Budgets are editable on the Budgets page.

### Layout
- `backend/` — NestJS API (`transactions`, `budgets`, `import`, `summary` modules; TypeORM + Postgres).
- `frontend/` — Angular standalone SPA (Dashboard, Transactions, Budgets, Import).
- `docker-compose.yml` — Postgres 16.

## Roadmap

- **Step 1 (done):** PDF → cleaned, categorized Excel tracker.
- **Step 2 (done):** local web app with persistent edits + multi-period dashboards.
