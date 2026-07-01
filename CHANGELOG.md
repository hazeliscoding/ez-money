# Changelog

All notable changes to **ez-money**. Releases track the desktop app version
(`desktop/package.json`); tag `vX.Y.Z` to publish installers via GitHub Actions.

## [1.0.1] — 2026-07-01

### Fixed
- **Timestamp the Windows code signature.** Azure Trusted Signing certificates are
  short-lived, so the Authenticode signature is now RFC-3161 timestamped — it stays
  valid after the signing certificate rotates. (1.0.0 was correctly signed but not
  timestamped.)

## [1.0.0] — 2026-07-01

First stable release. 🎉

### Added
- **Signed Windows installer** via Azure Trusted Signing — no more SmartScreen
  "unknown publisher" warning on install, and reliable Windows auto-update.

### Notes
1.0 rolls up everything since the 0.2 line: import Chime Credit Builder statements,
a dashboard with budget-vs-actual, editable budgets, the multi-period **Trends**
view, smart/safe import (Checking/Savings detection, graceful errors, richer
categorization), CSV export + SQLite backup, and an end-to-end test suite. All your
data stays local — no account, no server.

## [0.3.0] — 2026-07-01

### Added
- **Trends** page — a multi-period overview: income, spending, net, and savings
  rate per statement period, with an income-vs-spending bar chart.

### Changed
- **Smarter statement import.** Chime Checking/Savings statements are now detected
  and clearly declined (the Credit "Combined Account Activity" already includes
  those transactions — importing them too would double-count), and unreadable or
  unrecognized PDFs get specific messages instead of a generic failure.
- **Better categorization.** More built-in rules mean fewer transactions land in
  "Other"; internal transfers to Chime Savings/Checking are no longer miscounted
  as spending. Uncategorized merchants now point to Settings → Category rules.

### Internal
- End-to-end test suite (Playwright + Electron) running in CI, including a
  regression for category edits surviving a restart.

## [0.2.2] — 2026-06-30

### Fixed
- **Category edits now display correctly.** The per-row category dropdown reflects
  the saved value after a reload (edits were always persisted to disk — the
  dropdown was just redrawing to a stale value), and inline category changes no
  longer snap back to the old value.
- **Dashboard percentages.** "% of Budget", "% of Spend", and the Savings Rate now
  show the real figure (e.g. 47%) instead of rounding 0–1 fractions down to 0%/1%.

## [0.2.1] — 2026-06-30

### Added
- **Data tools** (Settings → Data): export transactions to CSV (current period or
  all), back up the SQLite database, and open the data folder. Restore = replace
  `ezmoney.sqlite` while the app is closed.

### Changed
- Licensed under **Apache-2.0** (`LICENSE` + `NOTICE`).
- Added `RELEASING.md` documenting the release + auto-update flow.

## [0.2.0] — 2026-06-30

First feature-complete release: a self-contained desktop app, all data local.

### Added
- **Import** Chime statement PDFs — a TypeScript parser extracts the combined
  activity, strips Credit Builder noise (Moved to/from, Round Ups, card
  auto-payment, payday-advance wash), and auto-categorizes transactions.
- **Dashboard** — income vs. spending, net, savings rate, and budget-vs-actual by
  category for the selected statement period.
- **Transactions** — filter/sort, inline category edit, add manual/cash entries,
  edit any field, and delete rows.
- **Budgets** — editable monthly target per category.
- **Settings** — rename/delete statement periods and edit the category rules
  (ordered patterns + exclude list) in-app, with "re-apply to existing".
- **Local storage** — SQLite (sql.js, pure WASM) in your OS user-data folder; the
  app makes no network calls for your data.
- **Packaging** — Windows NSIS installer + Linux AppImage config; Y2K app icon;
  window/taskbar identity.
- **Quality** — Vitest suite (parser, rules, services); GitHub Actions CI
  (test + build) and a tagged Release workflow.
- **Auto-update** groundwork via electron-updater (GitHub release feed).

### Known limitations
- Statements supported: **Chime** combined-activity PDFs.
- Installers are **unsigned** — Windows SmartScreen warns on first run
  ("More info" → "Run anyway"). macOS is not targeted yet.
- Auto-update install on Windows is best-effort until the build is code-signed.
