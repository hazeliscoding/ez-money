import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../numeric.transformer';

/**
 * A persisted transaction (one statement line or a manual entry). Indexes on
 * date/period/category back the common dashboard filters and sorts.
 *
 * Explicit column types throughout: the dev runner (tsx/esbuild) does not emit
 * decorator metadata, so TypeORM cannot infer types from TS — we state them.
 */
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  /** Transaction date, 'YYYY-MM-DD' (string, not Date, to avoid TZ drift). */
  @Index()
  @Column({ type: 'date' })
  date: string;

  /** Statement period label this row belongs to, e.g. 'Jun 2026'. */
  @Index()
  @Column({ type: 'varchar' })
  period: string;

  /** Cleaned, human-friendly description shown in the UI. */
  @Column({ type: 'varchar' })
  description: string;

  /** Original statement text, kept so re-categorization matches the raw line. */
  @Column({ type: 'varchar', name: 'raw_description', default: '' })
  rawDescription: string;

  @Index()
  @Column({ type: 'varchar' })
  category: string;

  /** 'Income' or 'Expense' — implies the sign of `amount`. */
  @Column({ type: 'varchar' })
  kind: string;

  /** Positive magnitude; the sign is carried by `kind`, never stored here. */
  @Column({ type: 'numeric', transformer: numericTransformer })
  amount: number;

  @Column({ type: 'varchar', default: '' })
  account: string;

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
