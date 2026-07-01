import { describe, it, expect } from 'vitest';
import { detectPeriod, detectStatementType, parseRawTransactions } from './parse';

// A handful of representative Combined-Activity lines plus chrome the parser
// must ignore (the period heading, a page footer, and a 5-field billing row).
const LINES = [
  'June 2026 (May 29th, 2026 - June 28th, 2026)',
  '6/22/2026 Brilliant Purchase -$204.67 Checking 6/24/2026',
  '6/12/2026 C Deposit $3,956.84 Checking 6/12/2026',
  '6/22/2026 Moved from Secured Deposit Account Transfer $9.36 Checking 6/22/2026',
  '6/15/2026 Direct Debit: Geico, Prem Coll Direct Debit -$353.44 Checking 6/15/2026',
  '6/14/2026 H E B Gas Purchase -$26.24 Checking 6/15/2026',
  '6/25/2026 Square Enix Purchase $16.20 6/25/2026', // 5-field billing line -> ignored
  'Page 1 of 22',
];

describe('detectPeriod', () => {
  it('normalizes the statement heading to a short label', () => {
    expect(detectPeriod(LINES)).toBe('Jun 2026');
  });
  it('returns null when no heading is present', () => {
    expect(detectPeriod(['Page 1 of 22', 'random text'])).toBeNull();
  });
});

describe('detectStatementType', () => {
  it('recognizes the supported Combined Account Activity statement', () => {
    expect(detectStatementType(['Combined Account Activity Statement', 'Statement period'])).toBe('combined');
  });
  it('flags Checking and Savings statements as unsupported', () => {
    expect(detectStatementType(['Checking Account Statement'])).toBe('checking');
    expect(detectStatementType(['Savings Account Statement'])).toBe('savings');
  });
  it('returns unknown for an unrelated document', () => {
    expect(detectStatementType(['Some Other Bank Monthly Statement'])).toBe('unknown');
  });
  it('prefers combined even when a row mentions Checking', () => {
    expect(
      detectStatementType(['Combined Account Activity Statement', '6/1/2026 Foo Purchase -$1.00 Checking 6/1/2026']),
    ).toBe('combined');
  });
});

describe('parseRawTransactions', () => {
  const txns = parseRawTransactions(LINES);

  it('matches only the 6-field combined-activity rows', () => {
    // Brilliant, C deposit, Moved-from, Geico, HEB Gas = 5; the 5-field row is skipped.
    expect(txns).toHaveLength(5);
  });

  it('parses signed amounts, dates, type, and account', () => {
    const brilliant = txns.find((t) => t.description === 'Brilliant')!;
    expect(brilliant.amount).toBe(-204.67);
    expect(brilliant.date).toBe('2026-06-22');
    expect(brilliant.statementType).toBe('Purchase');
    expect(brilliant.account).toBe('Checking');
    expect(brilliant.settlement).toBe('2026-06-24');
  });

  it('handles thousands separators and positive deposits', () => {
    const deposit = txns.find((t) => t.statementType === 'Deposit')!;
    expect(deposit.amount).toBe(3956.84);
  });

  it('keeps multi-word descriptions/types intact (lazy desc stops at the type column)', () => {
    const heb = txns.find((t) => t.description === 'H E B Gas')!;
    expect(heb.amount).toBe(-26.24);
    const moved = txns.find((t) => t.description === 'Moved from Secured Deposit Account')!;
    expect(moved.amount).toBe(9.36);
    expect(moved.account).toBe('Checking');
  });
});
