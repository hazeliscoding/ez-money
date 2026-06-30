import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { categorize } from './parser/rules';
import type {
  NewTransaction,
  RuleSet,
  TransactionQuery,
  UpdateTransaction,
} from '../../shared/types';

// Whitelist mapping the public `sort` value to a real column. Guards against
// SQL injection / invalid columns: any unknown sort key falls back to t.date.
const SORT_COLUMNS: Record<string, string> = {
  date: 't.date',
  amount: 't.amount',
  description: 't.description',
  category: 't.category',
};

// Fields a client may patch via update(); anything else in the patch is ignored
// (notably `amount` is handled separately so it can be normalized).
const EDITABLE: (keyof UpdateTransaction)[] = [
  'date', 'period', 'description', 'category', 'kind', 'account', 'notes',
];

/**
 * CRUD + query surface over the transactions table. Amounts are always stored
 * as a positive magnitude (the sign is implied by `kind`), so create/update
 * normalize incoming amounts with Math.abs.
 */
export class TransactionsService {
  constructor(private readonly repo: Repository<Transaction>) {}

  /**
   * Query transactions with optional period/category/kind filters and a free-text
   * `q` match against the description (case-insensitive LIKE). Results are sorted
   * by the requested column (whitelisted, default date) and direction (default
   * desc), with id desc as a stable tiebreaker.
   */
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

  /**
   * Insert a manually-entered transaction. `rawDescription` is seeded from the
   * description (there's no statement text to preserve), Income rows are forced
   * to the 'Income' category, expenses default to 'Other', and the amount is
   * stored as a positive magnitude.
   */
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

  /**
   * Apply a partial patch to one transaction. Only {@link EDITABLE} keys with a
   * defined value are copied (undefined = leave unchanged); amount is normalized
   * to a positive magnitude.
   *
   * @throws Error if no transaction has the given id.
   */
  async update(id: number, patch: UpdateTransaction): Promise<Transaction> {
    const txn = await this.repo.findOne({ where: { id } });
    if (!txn) throw new Error(`Transaction ${id} not found`);
    for (const key of EDITABLE) {
      if (patch[key] !== undefined) (txn as unknown as Record<string, unknown>)[key] = patch[key];
    }
    if (patch.amount !== undefined) txn.amount = Math.abs(Number(patch.amount) || 0);
    return this.repo.save(txn);
  }

  /**
   * Delete one transaction by id.
   * @throws Error if no row matched (nothing deleted).
   */
  async remove(id: number): Promise<{ deleted: boolean }> {
    const res = await this.repo.delete({ id });
    if (!res.affected) throw new Error(`Transaction ${id} not found`);
    return { deleted: true };
  }

  /** Delete every transaction in a period; returns how many rows were removed. */
  async deletePeriod(period: string): Promise<{ deleted: number }> {
    const res = await this.repo.delete({ period });
    return { deleted: res.affected ?? 0 };
  }

  /** Move every transaction from one period label to another; returns the count moved. */
  async renamePeriod(oldPeriod: string, newPeriod: string): Promise<{ updated: number }> {
    const res = await this.repo
      .createQueryBuilder()
      .update(Transaction)
      .set({ period: newPeriod })
      .where('period = :oldPeriod', { oldPeriod })
      .execute();
    return { updated: res.affected ?? 0 };
  }

  /**
   * Re-apply the categorization rules to every expense, overwriting categories
   * (including manual edits). Income rows are skipped — their category is always
   * 'Income'. Matching uses the stored `rawDescription` (falling back to the
   * cleaned description) so it sees the same text the import-time categorizer did.
   *
   * @returns The number of rows whose category actually changed.
   */
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

  /**
   * Replace all transactions for a period in one shot: delete the existing rows,
   * then insert the supplied ones. This is how re-importing a statement stays
   * idempotent (no duplicate rows) — see {@link ImportService.ingest}.
   *
   * Note: not wrapped in an explicit transaction, so a failure mid-insert could
   * leave the period emptied; acceptable for a single-user local app.
   */
  async replacePeriod(period: string, rows: Partial<Transaction>[]): Promise<void> {
    await this.repo.delete({ period });
    if (rows.length) await this.repo.save(this.repo.create(rows));
  }

  /** Distinct period labels, ordered by their earliest transaction date (oldest first). */
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
