# ez-money

A small **desktop app** (Electron) to import Chime statement PDFs and track your
budget — all local, no server, no account. It parses a statement, strips Chime's
Credit Builder noise, categorizes the transactions, and shows dashboards by month.

## Run it (dev)

Requires Node 20+.

```bash
npm install        # root tooling
npm run setup      # installs desktop + renderer deps
npm run dev        # Angular dev server + Electron, together
```

The window opens — go to **Import** and choose a statement PDF. Category and note
edits persist in SQLite (`ezmoney.sqlite` in your OS user-data folder). Importing
a statement replaces that period's transactions.

## Build an installer

```bash
npm run package:win      # Windows NSIS installer -> desktop/release/
npm run package:linux    # Linux AppImage (build on Linux or WSL)
```

Installers are **unsigned**, so Windows SmartScreen warns on first run
("More info" → "Run anyway"). macOS isn't targeted.

## How it works

```
Angular renderer  --IPC-->  Electron main  -->  SQLite (sql.js, in userData)
                                          \-->  TypeScript PDF parser (pdfjs)
```

- **Parser** (`desktop/src/main/core/parser/`): pdfjs-dist extracts the
  *Combined Account Activity* table; a strict regex selects transaction rows;
  rules drop Credit Builder plumbing (Moved to/from, Round Ups, the card
  auto-payment, the payday-advance wash). Income vs. expense is the amount's sign.
- **Categorize** (`category-rules.json`): an ordered `[pattern, category]` list,
  first match wins, plus an `exclude` list that drops lines entirely. Edit it and
  re-import.
- **Storage**: SQLite via TypeORM (`sql.js` — pure WASM, no native build), stored
  in `app.getPath('userData')`.
- **Statement periods, not calendar months**: Chime statements run ~the 29th→28th,
  so rent and the late-month paycheck stay with the statement they belong to.

## Layout

```
desktop/
  src/main/      Electron main, IPC, SQLite services, the PDF parser (core/parser)
  src/preload/   the window.api bridge (contextIsolation on)
  src/shared/    types shared with the renderer
  renderer/      Angular app (Dashboard, Transactions, Budgets, Import)
package.json     root scripts: dev / build / package
```

## Tests (headless)

```bash
cd desktop && npm run test:parser   # parser matches known-good output for the sample statement
cd desktop && npm run test:db       # SQLite data layer: import, summary, persistence
cd desktop && npm run build:main && npm run smoke   # live IPC round-trip via Electron
```
