import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/transaction.entity';
import { Budget } from '../budgets/budget.entity';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class SummaryService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Budget)
    private readonly budgetRepo: Repository<Budget>,
  ) {}

  private async latestPeriod(): Promise<string | null> {
    const row = await this.txRepo
      .createQueryBuilder('t')
      .select('t.period', 'period')
      .addSelect('MIN(t.date)', 'min')
      .groupBy('t.period')
      .orderBy('min', 'DESC')
      .limit(1)
      .getRawOne<{ period: string }>();
    return row?.period ?? null;
  }

  private async sumKind(period: string, kind: string): Promise<number> {
    const row = await this.txRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 's')
      .where('t.period = :period', { period })
      .andWhere('t.kind = :kind', { kind })
      .getRawOne<{ s: string }>();
    return parseFloat(row?.s ?? '0');
  }

  async forPeriod(period?: string) {
    const p = period || (await this.latestPeriod());
    if (!p) {
      return { period: null, income: 0, expense: 0, net: 0, savingsRate: 0, byCategory: [] };
    }

    const income = await this.sumKind(p, 'Income');
    const expense = await this.sumKind(p, 'Expense');
    const net = round2(income - expense);
    const savingsRate = income > 0 ? net / income : 0;

    const catRows = await this.txRepo
      .createQueryBuilder('t')
      .select('t.category', 'category')
      .addSelect('COALESCE(SUM(t.amount), 0)', 'actual')
      .where('t.period = :period', { period: p })
      .andWhere("t.kind = 'Expense'")
      .groupBy('t.category')
      .getRawMany<{ category: string; actual: string }>();
    const actualByCat = new Map(catRows.map((r) => [r.category, parseFloat(r.actual)]));

    const budgets = await this.budgetRepo.find({ order: { id: 'ASC' } });
    const byCategory = budgets
      .map((b) => {
        const actual = round2(actualByCat.get(b.category) ?? 0);
        const budget = b.monthlyAmount;
        return {
          category: b.category,
          budget,
          actual,
          remaining: round2(budget - actual),
          pctBudget: budget > 0 ? actual / budget : 0,
          pctSpend: expense > 0 ? actual / expense : 0,
        };
      })
      .sort((a, b) => b.actual - a.actual);

    return {
      period: p,
      income: round2(income),
      expense: round2(expense),
      net,
      savingsRate,
      byCategory,
    };
  }
}
