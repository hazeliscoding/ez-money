import { Repository } from 'typeorm';
import { Budget } from './entities/budget.entity';
import { CATEGORIES, DEFAULT_BUDGETS } from './categories';
import type { Budget as BudgetDTO } from '../../shared/types';

/**
 * Manages the per-category monthly budget rows. One row per category; the
 * canonical category list lives in categories.ts.
 */
export class BudgetsService {
  constructor(private readonly repo: Repository<Budget>) {}

  /**
   * Seed the canonical categories with their default budgets on first run only.
   * No-op once any budget row exists, so it never clobbers user edits.
   */
  async seed(): Promise<void> {
    if ((await this.repo.count()) > 0) return;
    const rows = CATEGORIES.map((category) =>
      this.repo.create({ category, monthlyAmount: DEFAULT_BUDGETS[category] ?? 0 }),
    );
    await this.repo.save(rows);
  }

  /** All budgets in stable insertion order (by id). */
  findAll(): Promise<Budget[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  /**
   * Upsert budgets keyed by category: update the amount if the category exists,
   * otherwise insert it. Entries without a category are skipped, and a non-numeric
   * amount coerces to 0.
   *
   * @returns The full budget list after applying the changes.
   */
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
