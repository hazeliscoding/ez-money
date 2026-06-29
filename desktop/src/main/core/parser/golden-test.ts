/**
 * Golden test: the TS parser must reproduce the Python output exactly for the
 * real June statement. Run: `npm run test:parser` (from desktop/).
 */
import * as path from 'path';
import { parsePdf } from './index';

const PDF =
  process.env.PDF ||
  path.resolve(process.cwd(), '..', 'docs/statements/2026/Chime-Credit-Statement-June-2026.pdf');

const round2 = (n: number) => Math.round(n * 100) / 100;

const EXPECT = {
  count: 126,
  income: 8290.01,
  expense: 8304.69,
  net: -14.68,
  uncategorized: 0,
  byCategory: {
    Rent: 2332.75,
    Utilities: 358.71,
    Groceries: 869.02,
    'Dining Out': 598.82,
    'Transportation & Gas': 40.16,
    Shopping: 1259.48,
    'Entertainment & Games': 1060.62,
    Subscriptions: 574.47,
    'Health & Fitness': 216.24,
    Pets: 90.41,
    Insurance: 353.44,
    'Debt & Loan Payments': 550.57,
  } as Record<string, number>,
};

(async () => {
  const res = await parsePdf(PDF);
  const income = round2(res.transactions.filter((t) => t.kind === 'Income').reduce((s, t) => s + t.amount, 0));
  const expense = round2(res.transactions.filter((t) => t.kind === 'Expense').reduce((s, t) => s + t.amount, 0));
  const net = round2(income - expense);

  const byCat: Record<string, number> = {};
  for (const t of res.transactions) {
    if (t.kind === 'Expense') byCat[t.category] = round2((byCat[t.category] ?? 0) + t.amount);
  }

  const checks: [string, boolean, string][] = [];
  checks.push(['period = Jun 2026', res.periods[0] === 'Jun 2026', String(res.periods[0])]);
  checks.push([`count = ${EXPECT.count}`, res.count === EXPECT.count, String(res.count)]);
  checks.push([`income = ${EXPECT.income}`, income === EXPECT.income, String(income)]);
  checks.push([`expense = ${EXPECT.expense}`, expense === EXPECT.expense, String(expense)]);
  checks.push([`net = ${EXPECT.net}`, net === EXPECT.net, String(net)]);
  checks.push([`uncategorized = 0`, res.uncategorized.length === 0, JSON.stringify(res.uncategorized)]);
  for (const [cat, exp] of Object.entries(EXPECT.byCategory)) {
    checks.push([`${cat} = ${exp}`, (byCat[cat] ?? 0) === exp, String(byCat[cat] ?? 0)]);
  }

  let ok = true;
  for (const [label, pass, got] of checks) {
    if (!pass) ok = false;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${pass ? '' : `   (got ${got})`}`);
  }
  console.log(ok ? '\nALL GOLDEN CHECKS PASSED' : '\nGOLDEN TEST FAILED');
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
