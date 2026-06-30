/**
 * Headless data-layer test: SQLite + services + import + persistence,
 * without launching Electron. Run: `npm run test:db` (from desktop/).
 */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { initServices } from '../db';

const PDF =
  process.env.PDF ||
  path.resolve(process.cwd(), '..', 'docs/statements/2026/Chime-Credit-Statement-June-2026.pdf');

(async () => {
  const dbPath = path.join(os.tmpdir(), `ezmoney-test-${Date.now()}.sqlite`);
  const svc = await initServices(dbPath);
  let ok = true;
  const check = (label: string, pass: boolean, got?: unknown) => {
    if (!pass) ok = false;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${pass ? '' : `   (got ${got})`}`);
  };

  try {
    const budgets = await svc.budgets.findAll();
    check('budgets seeded = 13', budgets.length === 13, budgets.length);

    const res = await svc.import.importPath(PDF);
    check('import.imported = 126', res.imported === 126, res.imported);
    check('import.income = 8290.01', res.income === 8290.01, res.income);
    check('import.expense = 8304.69', res.expense === 8304.69, res.expense);
    check('import.net = -14.68', res.net === -14.68, res.net);

    const periods = await svc.transactions.periods();
    check('periods = [Jun 2026]', periods.length === 1 && periods[0] === 'Jun 2026', JSON.stringify(periods));

    const summary = await svc.summary.forPeriod('Jun 2026');
    check('summary.expense = 8304.69', summary.expense === 8304.69, summary.expense);
    const rent = summary.byCategory.find((c) => c.category === 'Rent');
    check('summary Rent actual = 2332.75', rent?.actual === 2332.75, rent?.actual);

    const list = await svc.transactions.find({ period: 'Jun 2026', kind: 'Expense', sort: 'amount', dir: 'desc' });
    check('expense rows = 120', list.length === 120, list.length);
    check('top expense is Rent', list[0]?.category === 'Rent', list[0]?.category);

    // persistence: edit a category, re-read
    const target = list[1];
    await svc.transactions.update(target.id, { category: 'Other', notes: 'edited' });
    const again = await svc.transactions.find({ period: 'Jun 2026' });
    const edited = again.find((t) => t.id === target.id);
    check('category edit persisted', edited?.category === 'Other' && edited?.notes === 'edited', `${edited?.category}/${edited?.notes}`);

    // re-import replaces the period (no duplication)
    const res2 = await svc.import.importPath(PDF);
    check('re-import still 126 (replace)', res2.imported === 126, res2.imported);
    const afterReimport = await svc.transactions.find({ period: 'Jun 2026' });
    check('no duplication after re-import', afterReimport.length === 126, afterReimport.length);

    // --- manual create / full edit ---
    const created = await svc.transactions.create({
      date: '2026-07-02', period: 'Jul 2026', description: 'Starbucks',
      category: 'Other', kind: 'Expense', amount: 6.75, account: 'Cash',
    });
    check('manual create', created.id > 0 && created.account === 'Cash', created.id);
    await svc.transactions.update(created.id, { amount: 9.5, description: 'Starbucks Coffee', date: '2026-07-03' });
    const edm = (await svc.transactions.find({ period: 'Jul 2026' }))[0];
    check('full edit (amount/desc/date)',
      edm.amount === 9.5 && edm.description === 'Starbucks Coffee' && edm.date === '2026-07-03',
      `${edm.amount}/${edm.description}/${edm.date}`);

    // --- rules store + recategorize ---
    const baseRules = svc.rules.get();
    check('rules has defaults', baseRules.rules.length > 0, baseRules.rules.length);
    svc.rules.save({ ...baseRules, rules: [['starbucks', 'Dining Out'], ...baseRules.rules] });
    const rc = await svc.transactions.recategorize(svc.rules.get());
    const recat = (await svc.transactions.find({ period: 'Jul 2026' }))[0];
    check('recategorize (Starbucks -> Dining Out)', recat.category === 'Dining Out', `${rc.updated}/${recat.category}`);

    // --- period rename + delete ---
    const ren = await svc.transactions.renamePeriod('Jul 2026', 'July 2026');
    check('rename period', ren.updated === 1 && (await svc.transactions.periods()).includes('July 2026'), ren.updated);
    const del = await svc.transactions.deletePeriod('July 2026');
    check('delete period', del.deleted === 1 && !(await svc.transactions.periods()).includes('July 2026'), del.deleted);
  } finally {
    await svc.dataSource.destroy();
    fs.rmSync(dbPath, { force: true });
    fs.rmSync(path.join(path.dirname(dbPath), 'category-rules.json'), { force: true });
  }

  console.log(ok ? '\nALL DB CHECKS PASSED' : '\nDB TEST FAILED');
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
