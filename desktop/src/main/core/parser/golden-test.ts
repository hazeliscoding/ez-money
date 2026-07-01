/**
 * Golden test: the TS parser must reproduce known-good output for the real Chime
 * Credit Builder ("Combined Account Activity") statements in docs/statements.
 * Run: `npm run test:parser` (from desktop/).
 *
 * These PDFs are gitignored (PII), so this runs locally only — a fresh clone / CI
 * won't have them. The CI-safe logic lives in the *.test.ts vitest specs.
 *
 * Totals (count/income/expense/net) are exact; uncategorized is an upper bound
 * (adding category rules can only lower it). June also pins the per-category
 * breakdown as the primary parity anchor.
 */
import * as path from 'path';
import { parsePdf } from './index';

const DIR = path.resolve(process.cwd(), '..', 'docs/statements/2026');
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Spec {
  file: string;
  period: string;
  count: number;
  income: number;
  expense: number;
  net: number;
  maxUncategorized: number;
  byCategory?: Record<string, number>;
}

const SPECS: Spec[] = [
  {
    file: 'Chime-Credit-Statement-March-2026.pdf',
    period: 'Mar 2026', count: 110, income: 3965.41, expense: 4759.8, net: -794.39, maxUncategorized: 5,
  },
  {
    file: 'Chime-Credit-Statement-April-2026.pdf',
    period: 'Apr 2026', count: 113, income: 9215.91, expense: 9101.79, net: 114.12, maxUncategorized: 5,
  },
  {
    file: 'Chime-Credit-Statement-May-2026.pdf',
    period: 'May 2026', count: 109, income: 8415.4, expense: 8505.36, net: -89.96, maxUncategorized: 1,
  },
  {
    file: 'Chime-Credit-Statement-June-2026.pdf',
    period: 'Jun 2026', count: 126, income: 8290.01, expense: 8304.69, net: -14.68, maxUncategorized: 0,
    byCategory: {
      Rent: 2332.75, Utilities: 358.71, Groceries: 869.02, 'Dining Out': 598.82,
      'Transportation & Gas': 40.16, Shopping: 1259.48, 'Entertainment & Games': 1060.62,
      Subscriptions: 574.47, 'Health & Fitness': 216.24, Pets: 90.41, Insurance: 353.44,
      'Debt & Loan Payments': 550.57,
    },
  },
];

(async () => {
  let ok = true;

  for (const spec of SPECS) {
    const res = await parsePdf(path.join(DIR, spec.file));
    const income = round2(res.transactions.filter((t) => t.kind === 'Income').reduce((s, t) => s + t.amount, 0));
    const expense = round2(res.transactions.filter((t) => t.kind === 'Expense').reduce((s, t) => s + t.amount, 0));
    const net = round2(income - expense);

    const checks: [string, boolean, string][] = [
      ['period', res.periods[0] === spec.period, String(res.periods[0])],
      [`count = ${spec.count}`, res.count === spec.count, String(res.count)],
      [`income = ${spec.income}`, income === spec.income, String(income)],
      [`expense = ${spec.expense}`, expense === spec.expense, String(expense)],
      [`net = ${spec.net}`, net === spec.net, String(net)],
      [`uncategorized <= ${spec.maxUncategorized}`, res.uncategorized.length <= spec.maxUncategorized, JSON.stringify(res.uncategorized)],
    ];

    if (spec.byCategory) {
      const byCat: Record<string, number> = {};
      for (const t of res.transactions) {
        if (t.kind === 'Expense') byCat[t.category] = round2((byCat[t.category] ?? 0) + t.amount);
      }
      for (const [cat, exp] of Object.entries(spec.byCategory)) {
        checks.push([`${cat} = ${exp}`, (byCat[cat] ?? 0) === exp, String(byCat[cat] ?? 0)]);
      }
    }

    console.log(`\n=== ${spec.file} ===`);
    for (const [label, pass, got] of checks) {
      if (!pass) ok = false;
      console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${pass ? '' : `   (got ${got})`}`);
    }
  }

  console.log(ok ? '\nALL GOLDEN CHECKS PASSED' : '\nGOLDEN TEST FAILED');
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
