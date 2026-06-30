import { describe, it, expect } from 'vitest';
import { toCsv } from './export';
import type { Transaction } from '../../shared/types';

const tx = (o: Partial<Transaction>): Transaction => ({
  id: 1, date: '2026-06-01', period: 'Jun 2026', description: 'Coffee', rawDescription: 'Coffee',
  category: 'Dining Out', kind: 'Expense', amount: 4.5, account: 'Cash', notes: '', ...o,
});

describe('toCsv', () => {
  it('writes a header and one row per transaction', () => {
    const lines = toCsv([tx({}), tx({ id: 2, description: 'Rent', amount: 2000 })]).trimEnd().split('\r\n');
    expect(lines[0]).toBe('date,period,description,category,kind,amount,account,notes');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Coffee');
    expect(lines[2]).toContain('Rent');
  });

  it('escapes commas, quotes, and newlines', () => {
    const csv = toCsv([tx({ description: 'Acme, "Best" Co\nLLC' })]);
    expect(csv).toContain('"Acme, ""Best"" Co\nLLC"');
  });

  it('returns just the header for an empty list', () => {
    expect(toCsv([])).toBe('date,period,description,category,kind,amount,account,notes\r\n');
  });
});
