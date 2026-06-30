import { parsePdf } from './parser';
import { TransactionsService } from './transactions.service';
import { RulesService } from './rules.service';
import type { ImportResult, ParseResult } from '../../shared/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export class ImportService {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly rules: RulesService,
  ) {}

  importPath(filePath: string): Promise<ImportResult> {
    return parsePdf(filePath, this.rules.get()).then((p) => this.ingest(p));
  }

  importBytes(bytes: Uint8Array): Promise<ImportResult> {
    return parsePdf(bytes, this.rules.get()).then((p) => this.ingest(p));
  }

  private async ingest(parsed: ParseResult): Promise<ImportResult> {
    const txns = parsed.transactions;
    if (txns.length === 0) {
      throw new Error('No transactions found. Is this a Chime combined-activity statement PDF?');
    }

    const byPeriod = new Map<string, typeof txns>();
    for (const t of txns) {
      if (!byPeriod.has(t.period)) byPeriod.set(t.period, []);
      byPeriod.get(t.period)!.push(t);
    }
    for (const [period, rows] of byPeriod) {
      await this.transactions.replacePeriod(period, rows);
    }

    let income = 0;
    let expense = 0;
    for (const t of txns) {
      if (t.kind === 'Income') income += t.amount;
      else expense += t.amount;
    }

    return {
      periods: parsed.periods.length ? parsed.periods : [...byPeriod.keys()],
      imported: txns.length,
      income: round2(income),
      expense: round2(expense),
      net: round2(income - expense),
      uncategorized: parsed.uncategorized,
    };
  }
}
