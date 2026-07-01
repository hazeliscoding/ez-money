import { describe, it, expect } from 'vitest';
import {
  categorize,
  classifyKind,
  clean,
  displayDescription,
  isPlumbing,
  loadRules,
} from './rules';
import type { RawTxn } from './parse';

const raw = (over: Partial<RawTxn>): RawTxn => ({
  date: '2026-06-10',
  description: 'X',
  statementType: 'Purchase',
  amount: -10,
  account: 'Checking',
  settlement: '2026-06-10',
  ...over,
});

describe('isPlumbing', () => {
  it('drops Credit Builder + internal-transfer noise', () => {
    expect(isPlumbing(raw({ description: 'Moved from Secured Deposit Account', statementType: 'Transfer', amount: 9 }))).toBe(true);
    expect(isPlumbing(raw({ description: 'Moved to Checking Account', statementType: 'Transfer', amount: -9 }))).toBe(true);
    expect(isPlumbing(raw({ description: 'Round Up to Savings Account', statementType: 'Round Up Transfer', amount: -0.8 }))).toBe(true);
    expect(isPlumbing(raw({ description: 'Card Payment from Secured Account', statementType: 'Payment', amount: 453.53 }))).toBe(true);
    expect(isPlumbing(raw({ description: 'My Pay Advance', statementType: 'Deposit', amount: 500 }))).toBe(true);
    expect(isPlumbing(raw({ description: 'My Pay Repayment', statementType: 'Adjustment', amount: -500 }))).toBe(true);
    expect(isPlumbing(raw({ description: 'Transfer from SpotMe Line of Credit', statementType: 'Transfer', amount: 16.2 }))).toBe(true);
    expect(isPlumbing(raw({ description: 'Transfer from Savings Account', statementType: 'Transfer', amount: 8.42 }))).toBe(true);
    expect(isPlumbing(raw({ description: 'Transfer to Chime Savings Account', statementType: 'Transfer', amount: -600 }))).toBe(true);
    expect(isPlumbing(raw({ description: 'Transfer to Chime Checking Account', statementType: 'Transfer', amount: 38 }))).toBe(true);
  });

  it('keeps real purchases, the advance fee, and external person-to-person transfers', () => {
    expect(isPlumbing(raw({ description: 'Brilliant' }))).toBe(false);
    expect(isPlumbing(raw({ description: 'My Pay Instant Advance Fees', statementType: 'Adjustment', amount: -5 }))).toBe(false);
    expect(isPlumbing(raw({ description: 'Transfer from Deanna G.', statementType: 'Transfer', amount: 353.44 }))).toBe(false);
  });
});

describe('classifyKind', () => {
  it('is decided by amount sign', () => {
    expect(classifyKind(raw({ amount: -5 }))).toBe('Expense');
    expect(classifyKind(raw({ amount: 5 }))).toBe('Income'); // e.g. a refund posts positive
  });
});

describe('categorize', () => {
  const { rules, default: fallback } = loadRules();
  it('is ordered, first-match-wins (specific before general)', () => {
    expect(categorize('H E B Gas', rules, fallback, 'Expense')).toBe('Transportation & Gas');
    expect(categorize('H E B', rules, fallback, 'Expense')).toBe('Groceries');
    expect(categorize('Amazon Web Services', rules, fallback, 'Expense')).toBe('Subscriptions');
    expect(categorize('Amazon Mark* Zi', rules, fallback, 'Expense')).toBe('Shopping');
  });
  it('falls back to default, and income always gets the Income label', () => {
    expect(categorize('Totally Unknown Merchant', rules, fallback, 'Expense')).toBe('Other');
    expect(categorize('anything', rules, fallback, 'Income')).toBe('Income');
  });
});

describe('displayDescription', () => {
  it('strips the "Direct Debit:" prefix', () => {
    expect(displayDescription('Direct Debit: Geico, Prem Coll')).toBe('Geico, Prem Coll');
  });
  it('leaves normal descriptions alone (whitespace collapsed)', () => {
    expect(displayDescription('  Brilliant   ')).toBe('Brilliant');
  });
});

describe('clean', () => {
  it('drops plumbing + excluded lines, categorizes, makes amount positive, lists uncategorized', () => {
    const ruleset = loadRules();
    const input: RawTxn[] = [
      raw({ description: 'Brilliant', statementType: 'Purchase', amount: -204.67 }),
      raw({ description: 'Moved to Checking Account', statementType: 'Transfer', amount: -9 }),
      raw({ description: 'Anlatan Inc.', statementType: 'Purchase', amount: -15 }), // in exclude list
      raw({ description: 'C', statementType: 'Deposit', amount: 3956.84 }),
      raw({ description: 'Some New Merchant', statementType: 'Purchase', amount: -12.5 }),
    ];
    const { transactions, uncategorized } = clean(input, 'Jun 2026', ruleset);

    expect(transactions.map((t) => t.description).sort()).toEqual(['Brilliant', 'C', 'Some New Merchant']);

    const brilliant = transactions.find((t) => t.description === 'Brilliant')!;
    expect(brilliant.amount).toBe(204.67); // abs magnitude
    expect(brilliant.kind).toBe('Expense');
    expect(brilliant.category).toBe('Subscriptions');
    expect(brilliant.period).toBe('Jun 2026');

    const income = transactions.find((t) => t.description === 'C')!;
    expect(income.kind).toBe('Income');
    expect(income.category).toBe('Income');

    expect(uncategorized).toContain('Some New Merchant');
    expect(uncategorized).not.toContain('Brilliant');
  });
});
