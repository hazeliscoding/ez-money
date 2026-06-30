# 💸 ez-money

**Turn your Chime statements into a budget you'll actually look at — 100% on your own computer.**

> Most budgeting apps want your bank login and quietly sell your data. ez-money just reads the PDF statement you already have, shows you where your money went, and keeps **everything on your machine** — no accounts, no sign-ups, no internet. 🔒

---

## ✨ What it does

- 📥 **Import** — drop in a Chime statement PDF; it cleans out the noise and auto-sorts every transaction into categories.
- 📊 **See where it goes** — income vs. spending, budget-vs-actual, and your biggest categories at a glance.
- 🎯 **Set budgets** — give each category a monthly target and instantly see what's over.
- ✏️ **Fix & add** — re-categorize anything, add cash purchases by hand, rename or delete months.
- 🔒 **Stays private** — all data lives in a local file on your computer; the app never touches the network.

> Today it understands **Chime** statements specifically (it knows how to strip Chime's Credit Builder shuffle so your spending isn't triple-counted).

---

## 🚀 For developers

A desktop app: **Electron** (shell) + **Angular** (UI) + **SQLite** (local storage), with the PDF parsing done in TypeScript. Requires **Node 20+**.

### Run it (dev)

```bash
npm install        # root tooling
npm run setup      # installs desktop + renderer deps
npm run dev        # Angular dev server + Electron, together
```

The window opens — go to **Import** and choose a statement PDF. Edits persist in SQLite (`ezmoney.sqlite` in your OS user-data folder).

### Build an installer 📦

```bash
npm run package:win      # Windows NSIS installer -> desktop/release/
npm run package:linux    # Linux AppImage (build on Linux or WSL)
```

Installers are currently **unsigned**, so Windows SmartScreen warns on first run ("More info" → "Run anyway"). macOS isn't targeted yet.

### 🧠 How it works

```
Angular renderer  --IPC-->  Electron main  -->  SQLite (sql.js, in userData)
                                          \-->  TypeScript PDF parser (pdfjs)
```

- **Parser** (`desktop/src/main/core/parser/`) — pdfjs extracts the *Combined Account Activity* table; a strict regex picks out transaction rows; rules drop Credit Builder plumbing (Moved to/from, Round Ups, card auto-payment, the payday-advance wash). Income vs. expense is decided by the amount's sign.
- **Categorize** (`category-rules.json`) — an ordered `[pattern, category]` list (first match wins) plus an `exclude` list; fully editable in the app's Settings.
- **Storage** — SQLite via TypeORM using `sql.js` (pure WASM, no native build), in `app.getPath('userData')`.
- **Statement periods, not calendar months** — Chime statements run ~the 29th→28th, so rent and the late-month paycheck stay with the statement they belong to.

### 🗂️ Layout

```
desktop/
  src/main/      Electron main, IPC, SQLite services, the PDF parser (core/parser)
  src/preload/   the window.api bridge (contextIsolation on)
  src/shared/    types shared with the renderer
  renderer/      Angular app (Dashboard, Transactions, Budgets, Import, Settings)
package.json     root scripts: dev / build / package
```

### ✅ Tests (headless)

```bash
cd desktop && npm run test:parser   # parser matches known-good output for the sample statement
cd desktop && npm run test:db       # SQLite data layer: import, summary, persistence
cd desktop && npm run build:main && npm run smoke   # live IPC round-trip via Electron
```
