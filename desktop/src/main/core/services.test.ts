import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Transaction } from './entities/transaction.entity';
import { Budget } from './entities/budget.entity';
import { TransactionsService } from './transactions.service';
import { BudgetsService } from './budgets.service';
import { SummaryService } from './summary.service';
import { RulesService } from './rules.service';

let ds: DataSource;
let tx: TransactionsService;
let budgets: BudgetsService;
let summary: SummaryService;
let rules: RulesService;
let tmpDir: string;

beforeAll(async () => {
  // In-memory sql.js DB (no file) — fast, isolated, no native build.
  ds = new DataSource({
    type: 'sqljs',
    autoSave: false,
    entities: [Transaction, Budget],
    synchronize: true,
  });
  await ds.initialize();
  tx = new TransactionsService(ds.getRepository(Transaction));
  budgets = new BudgetsService(ds.getRepository(Budget));
  await budgets.seed();
  summary = new SummaryService(ds.getRepository(Transaction), ds.getRepository(Budget));
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezmoney-vitest-'));
  rules = new RulesService(tmpDir);
});

afterAll(async () => {
  await ds.destroy();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('BudgetsService', () => {
  it('seeds the 13 categories exactly once', async () => {
    expect(await budgets.findAll()).toHaveLength(13);
    await budgets.seed(); // idempotent — must not duplicate
    expect(await budgets.findAll()).toHaveLength(13);
  });
  it('upserts an existing category by name', async () => {
    await budgets.upsertMany([{ category: 'Groceries', monthlyAmount: 1234 }]);
    const groceries = (await budgets.findAll()).find((b) => b.category === 'Groceries')!;
    expect(groceries.monthlyAmount).toBe(1234);
  });
});

describe('TransactionsService', () => {
  it('creates, lists, edits any field, and deletes', async () => {
    const t = await tx.create({
      date: '2026-06-02', period: 'Jun 2026', description: 'Coffee',
      category: 'Dining Out', kind: 'Expense', amount: 4.5, account: 'Cash',
    });
    expect(t.id).toBeGreaterThan(0);
    expect(t.amount).toBe(4.5);

    await tx.update(t.id, { amount: 5, description: 'Latte', date: '2026-06-03' });
    const row = (await tx.find({ period: 'Jun 2026' })).find((r) => r.id === t.id)!;
    expect(row.amount).toBe(5);
    expect(row.description).toBe('Latte');
    expect(row.date).toBe('2026-06-03');

    await tx.remove(t.id);
    expect((await tx.find({ period: 'Jun 2026' })).find((r) => r.id === t.id)).toBeUndefined();
  });

  it('updates the category (inline dropdown / edit-modal path)', async () => {
    const t = await tx.create({
      date: '2026-10-01', period: 'Oct 2026', description: 'Store',
      category: 'Other', kind: 'Expense', amount: 10, account: 'Cash',
    });
    const returned = await tx.update(t.id, { category: 'Groceries' });
    expect(returned.category).toBe('Groceries');
    const row = (await tx.find({ period: 'Oct 2026' })).find((r) => r.id === t.id)!;
    expect(row.category).toBe('Groceries');
    await tx.deletePeriod('Oct 2026');
  });

  it('renames and deletes whole periods', async () => {
    await tx.create({ date: '2026-07-01', period: 'Jul 2026', description: 'X', category: 'Other', kind: 'Expense', amount: 1 });
    expect(await tx.periods()).toContain('Jul 2026');
    const renamed = await tx.renamePeriod('Jul 2026', 'July 2026');
    expect(renamed.updated).toBe(1);
    expect(await tx.periods()).toContain('July 2026');
    const deleted = await tx.deletePeriod('July 2026');
    expect(deleted.deleted).toBe(1);
    expect(await tx.periods()).not.toContain('July 2026');
  });

  it('stores amounts as positive magnitude even if a negative is passed', async () => {
    const t = await tx.create({ date: '2026-09-01', period: 'Sep 2026', description: 'Neg', category: 'Other', kind: 'Expense', amount: -42 });
    expect(t.amount).toBe(42);
    await tx.deletePeriod('Sep 2026');
  });
});

describe('SummaryService', () => {
  beforeAll(async () => {
    await tx.create({ date: '2026-08-01', period: 'Aug 2026', description: 'Pay', category: 'Income', kind: 'Income', amount: 1000 });
    await tx.create({ date: '2026-08-02', period: 'Aug 2026', description: 'Rent', category: 'Rent', kind: 'Expense', amount: 600 });
    await tx.create({ date: '2026-08-03', period: 'Aug 2026', description: 'Food', category: 'Groceries', kind: 'Expense', amount: 150 });
  });

  it('computes income/expense/net/savings rate and a sorted budget-vs-actual breakdown', async () => {
    const s = await summary.forPeriod('Aug 2026');
    expect(s.income).toBe(1000);
    expect(s.expense).toBe(750);
    expect(s.net).toBe(250);
    expect(s.savingsRate).toBeCloseTo(0.25, 5);

    const rent = s.byCategory.find((c) => c.category === 'Rent')!;
    expect(rent.actual).toBe(600);
    // byCategory is sorted by actual spend descending
    for (let i = 1; i < s.byCategory.length; i++) {
      expect(s.byCategory[i - 1].actual).toBeGreaterThanOrEqual(s.byCategory[i].actual);
    }
  });

  it('returns zeros for a period with no transactions', async () => {
    const s = await summary.forPeriod('Nope 2099');
    expect(s.income).toBe(0);
    expect(s.expense).toBe(0);
    expect(s.net).toBe(0);
  });

  it('rolls up every period chronologically with net/savings as a fraction', async () => {
    // Two extra periods around the seeded Aug 2026, with known totals.
    await tx.create({ date: '2026-05-15', period: 'May 2026', description: 'Pay', category: 'Income', kind: 'Income', amount: 2000 });
    await tx.create({ date: '2026-05-16', period: 'May 2026', description: 'Rent', category: 'Rent', kind: 'Expense', amount: 500 });
    await tx.create({ date: '2026-12-10', period: 'Dec 2026', description: 'Pay', category: 'Income', kind: 'Income', amount: 800 });
    await tx.create({ date: '2026-12-11', period: 'Dec 2026', description: 'Gifts', category: 'Other', kind: 'Expense', amount: 800 });

    const rows = await summary.trends();
    const byPeriod = new Map(rows.map((r) => [r.period, r]));

    // chronological: May (oldest) → Aug → Dec (newest)
    const idxMay = rows.findIndex((r) => r.period === 'May 2026');
    const idxAug = rows.findIndex((r) => r.period === 'Aug 2026');
    const idxDec = rows.findIndex((r) => r.period === 'Dec 2026');
    expect(idxMay).toBeGreaterThanOrEqual(0);
    expect(idxMay).toBeLessThan(idxAug);
    expect(idxAug).toBeLessThan(idxDec);

    const may = byPeriod.get('May 2026')!;
    expect(may.income).toBe(2000);
    expect(may.expense).toBe(500);
    expect(may.net).toBe(1500);
    expect(may.savingsRate).toBeCloseTo(0.75, 5);

    const aug = byPeriod.get('Aug 2026')!;
    expect(aug.income).toBe(1000);
    expect(aug.expense).toBe(750);
    expect(aug.net).toBe(250);
    expect(aug.savingsRate).toBeCloseTo(0.25, 5);

    const dec = byPeriod.get('Dec 2026')!;
    expect(dec.net).toBe(0);
    expect(dec.savingsRate).toBe(0);
  });
});

describe('RulesService', () => {
  it('returns the bundled default until edits are saved, then persists them', () => {
    const def = rules.get();
    expect(def.rules.length).toBeGreaterThan(0);
    const saved = rules.save({ exclude: ['foo'], rules: [['bar', 'Other']], default: 'Other' });
    expect(saved.exclude).toContain('foo');
    expect(rules.get().rules[0]).toEqual(['bar', 'Other']);
  });
});
