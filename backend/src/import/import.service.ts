import { BadRequestException, Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { unlink } from 'fs/promises';
import * as path from 'path';
import { TransactionsService } from '../transactions/transactions.service';

interface ParsedTxn {
  date: string;
  period: string;
  description: string;
  rawDescription: string;
  category: string;
  kind: string;
  amount: number;
  account: string;
  notes?: string;
}

interface ParserOutput {
  periods: string[];
  count: number;
  uncategorized: string[];
  transactions: ParsedTxn[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class ImportService {
  constructor(private readonly transactions: TransactionsService) {}

  /** Repo root holds the `ezmoney` Python package; backend runs from ./backend. */
  private get repoRoot(): string {
    return path.resolve(process.cwd(), '..');
  }

  private get pythonBin(): string {
    return process.env.PYTHON_BIN || 'python';
  }

  async importPdf(filePath: string) {
    let parsed: ParserOutput;
    try {
      parsed = await this.runParser(filePath);
    } finally {
      unlink(filePath).catch(() => undefined);
    }

    const txns = parsed.transactions ?? [];
    if (txns.length === 0) {
      throw new BadRequestException(
        'No transactions found. Is this a Chime combined-activity statement PDF?',
      );
    }

    // Replace each affected period wholesale (idempotent re-import).
    const byPeriod = new Map<string, ParsedTxn[]>();
    for (const t of txns) {
      if (!byPeriod.has(t.period)) byPeriod.set(t.period, []);
      byPeriod.get(t.period)!.push(t);
    }
    for (const [period, rows] of byPeriod) {
      await this.transactions.replacePeriod(
        period,
        rows.map((t) => ({
          date: t.date,
          period: t.period,
          description: t.description,
          rawDescription: t.rawDescription,
          category: t.category,
          kind: t.kind,
          amount: t.amount,
          account: t.account,
          notes: t.notes ?? '',
        })),
      );
    }

    let income = 0;
    let expense = 0;
    for (const t of txns) {
      if (t.kind === 'Income') income += t.amount;
      else expense += t.amount;
    }

    return {
      periods: parsed.periods ?? [...byPeriod.keys()],
      imported: txns.length,
      income: round2(income),
      expense: round2(expense),
      net: round2(income - expense),
      uncategorized: parsed.uncategorized ?? [],
    };
  }

  private runParser(filePath: string): Promise<ParserOutput> {
    return new Promise((resolve, reject) => {
      const proc = spawn(
        this.pythonBin,
        ['-m', 'ezmoney', 'parse', filePath],
        { cwd: this.repoRoot },
      );
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('error', (err) =>
        reject(
          new BadRequestException(
            `Could not run the Python parser (${this.pythonBin}): ${err.message}`,
          ),
        ),
      );
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(
            new BadRequestException(
              `Parser exited with code ${code}. ${stderr.trim()}`,
            ),
          );
          return;
        }
        try {
          resolve(JSON.parse(stdout) as ParserOutput);
        } catch {
          reject(new BadRequestException('Parser returned invalid JSON.'));
        }
      });
    });
  }
}
