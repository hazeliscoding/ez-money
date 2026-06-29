import { Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { CATEGORIES, DEFAULT_BUDGETS } from './categories';
import type { Budget as BudgetDTO } from '../../shared/types';

export class BudgetsService {
  constructor(private readonly repo: Repository<Budget>) {}

  /** Seed the canonical categories with default budgets on first run. */
  async seed(): Promise<void> {
    if ((await this.repo.count()) > 0) return;
    const rows = CATEGORIES.map((category) =>
      this.repo.create({ category, monthlyAmount: DEFAULT_BUDGETS[category] ?? 0 }),
    );
    await this.repo.save(rows);
  }

  findAll(): Promise<Budget[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async upsertMany(inputs: BudgetDTO[]): Promise<Budget[]> {
    for (const input of inputs) {
      if (!input?.category) continue;
      const existing = await this.repo.findOne({ where: { category: input.category } });
      if (existing) {
        existing.monthlyAmount = Number(input.monthlyAmount) || 0;
        await this.repo.save(existing);
      } else {
        await this.repo.save(
          this.repo.create({ category: input.category, monthlyAmount: Number(input.monthlyAmount) || 0 }),
        );
      }
    }
    return this.findAll();
  }
}
