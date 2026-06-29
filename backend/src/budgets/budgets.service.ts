import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Budget } from './budget.entity';
import { CATEGORIES, DEFAULT_BUDGETS } from '../common/categories';

export interface BudgetInput {
  category: string;
  monthlyAmount: number;
}

@Injectable()
export class BudgetsService implements OnModuleInit {
  constructor(
    @InjectRepository(Budget)
    private readonly repo: Repository<Budget>,
  ) {}

  /** Seed the canonical categories with default budgets on first boot. */
  async onModuleInit(): Promise<void> {
    if ((await this.repo.count()) > 0) return;
    const rows = CATEGORIES.map((category) =>
      this.repo.create({ category, monthlyAmount: DEFAULT_BUDGETS[category] ?? 0 }),
    );
    await this.repo.save(rows);
  }

  findAll(): Promise<Budget[]> {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async upsertMany(inputs: BudgetInput[]): Promise<Budget[]> {
    for (const input of inputs) {
      if (!input?.category) continue;
      const existing = await this.repo.findOne({ where: { category: input.category } });
      if (existing) {
        existing.monthlyAmount = Number(input.monthlyAmount) || 0;
        await this.repo.save(existing);
      } else {
        await this.repo.save(
          this.repo.create({
            category: input.category,
            monthlyAmount: Number(input.monthlyAmount) || 0,
          }),
        );
      }
    }
    return this.findAll();
  }
}
