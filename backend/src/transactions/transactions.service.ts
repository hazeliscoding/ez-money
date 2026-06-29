import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transaction.entity';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

export interface TransactionQuery {
  period?: string;
  category?: string;
  kind?: string;
  q?: string;
  sort?: string;
  dir?: string;
}

const SORT_COLUMNS: Record<string, string> = {
  date: 't.date',
  amount: 't.amount',
  description: 't.description',
  category: 't.category',
};

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
  ) {}

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

  async update(id: number, dto: UpdateTransactionDto): Promise<Transaction> {
    const txn = await this.repo.findOne({ where: { id } });
    if (!txn) throw new NotFoundException(`Transaction ${id} not found`);
    if (dto.category !== undefined) txn.category = dto.category;
    if (dto.notes !== undefined) txn.notes = dto.notes;
    return this.repo.save(txn);
  }

  async remove(id: number): Promise<{ deleted: boolean }> {
    const res = await this.repo.delete({ id });
    if (!res.affected) throw new NotFoundException(`Transaction ${id} not found`);
    return { deleted: true };
  }

  /** Replace all transactions for a period (used when (re)importing a statement). */
  async replacePeriod(period: string, rows: Partial<Transaction>[]): Promise<void> {
    await this.repo.delete({ period });
    if (rows.length) await this.repo.save(this.repo.create(rows));
  }

  /** Distinct statement periods, ordered chronologically by earliest date. */
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
