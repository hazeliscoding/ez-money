import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import type { TransactionQuery } from '../../shared/types';

const SORT_COLUMNS: Record<string, string> = {
  date: 't.date',
  amount: 't.amount',
  description: 't.description',
  category: 't.category',
};

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

  async update(id: number, patch: { category?: string; notes?: string }): Promise<Transaction> {
    const txn = await this.repo.findOne({ where: { id } });
    if (!txn) throw new Error(`Transaction ${id} not found`);
    if (patch.category !== undefined) txn.category = patch.category;
    if (patch.notes !== undefined) txn.notes = patch.notes;
    return this.repo.save(txn);
  }

  async remove(id: number): Promise<{ deleted: boolean }> {
    const res = await this.repo.delete({ id });
    if (!res.affected) throw new Error(`Transaction ${id} not found`);
    return { deleted: true };
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
