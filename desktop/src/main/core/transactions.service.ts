import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { categorize } from './parser/rules';
import type {
  NewTransaction,
  RuleSet,
  TransactionQuery,
  UpdateTransaction,
} from '../../shared/types';

const SORT_COLUMNS: Record<string, string> = {
  date: 't.date',
  amount: 't.amount',
  description: 't.description',
  category: 't.category',
};

const EDITABLE: (keyof UpdateTransaction)[] = [
  'date', 'period', 'description', 'category', 'kind', 'account', 'notes',
];

export class TransactionsService {
  constructor(private readonly repo: Repository<Transaction>) {}

  find(query: TransactionQuery): Promise<Transaction[]> {
    const qb = this.repo.createQueryBuilder('t');
    if (query.period) qb.andWhere('t.period = :period', { period: query.period });
    if (query.category) qb.andWhere('t.category = :category', { category: query.category });
    if (query.kind) qb.andWhere('t.kind = :kind', { kind: query.kind });
    if (query.q) {
      qb.andWhere('LOWER(t.description) LIKE :q', { q: `%${query.q.toLowerCase()}%` });
    }
    const sortCol = SORT_COLUMNS[query.sort ?? ''] ?? 't.date';
    const dir = (query.dir ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(sortCol, dir).addOrderBy('t.id', 'DESC');
    return qb.getMany();
  }

  create(input: NewTransaction): Promise<Transaction> {
    const row = this.repo.create({
      date: input.date,
      period: input.period,
      description: input.description ?? '',
      rawDescription: input.description ?? '',
      category: input.kind === 'Income' ? 'Income' : input.category || 'Other',
      kind: input.kind,
      amount: Math.abs(Number(input.amount) || 0),
      account: input.account || 'Manual',
      notes: input.notes ?? '',
    });
    return this.repo.save(row);
  }

  async update(id: number, patch: UpdateTransaction): Promise<Transaction> {
    const txn = await this.repo.findOne({ where: { id } });
    if (!txn) throw new Error(`Transaction ${id} not found`);
    for (const key of EDITABLE) {
      if (patch[key] !== undefined) (txn as unknown as Record<string, unknown>)[key] = patch[key];
    }
    if (patch.amount !== undefined) txn.amount = Math.abs(Number(patch.amount) || 0);
    return this.repo.save(txn);
  }

  async remove(id: number): Promise<{ deleted: boolean }> {
    const res = await this.repo.delete({ id });
    if (!res.affected) throw new Error(`Transaction ${id} not found`);
    return { deleted: true };
  }

  async deletePeriod(period: string): Promise<{ deleted: number }> {
    const res = await this.repo.delete({ period });
    return { deleted: res.affected ?? 0 };
  }

  async renamePeriod(oldPeriod: string, newPeriod: string): Promise<{ updated: number }> {
    const res = await this.repo
      .createQueryBuilder()
      .update(Transaction)
      .set({ period: newPeriod })
      .where('period = :oldPeriod', { oldPeriod })
      .execute();
    return { updated: res.affected ?? 0 };
  }

  /** Re-apply categorization rules to every expense (overwrites manual categories). */
  async recategorize(ruleset: RuleSet): Promise<{ updated: number }> {
    const rows = await this.repo.find({ where: { kind: 'Expense' } });
    let updated = 0;
    for (const t of rows) {
      const cat = categorize(
        t.rawDescription || t.description,
        ruleset.rules,
        ruleset.default ?? 'Other',
        'Expense',
      );
      if (cat !== t.category) {
        t.category = cat;
        await this.repo.save(t);
        updated++;
      }
    }
    return { updated };
  }

  /** Replace all transactions for a period (used when (re)importing a statement). */
  async replacePeriod(period: string, rows: Partial<Transaction>[]): Promise<void> {
    await this.repo.delete({ period });
    if (rows.length) await this.repo.save(this.repo.create(rows));
  }

  async periods(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('t')
      .select('t.period', 'period')
      .addSelect('MIN(t.date)', 'min')
      .groupBy('t.period')
      .orderBy('min', 'ASC')
      .getRawMany<{ period: string; min: string }>();
    return rows.map((r) => r.period);
  }
}
