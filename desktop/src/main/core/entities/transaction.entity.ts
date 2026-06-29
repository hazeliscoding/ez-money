import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../numeric.transformer';

// Explicit column types throughout: the dev runner (tsx/esbuild) does not emit
// decorator metadata, so TypeORM cannot infer types from TS — we state them.
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'date' })
  date: string;

  @Index()
  @Column({ type: 'varchar' })
  period: string;

  @Column({ type: 'varchar' })
  description: string;

  @Column({ type: 'varchar', name: 'raw_description', default: '' })
  rawDescription: string;

  @Index()
  @Column({ type: 'varchar' })
  category: string;

  @Column({ type: 'varchar' })
  kind: string;

  @Column({ type: 'numeric', transformer: numericTransformer })
  amount: number;

  @Column({ type: 'varchar', default: '' })
  account: string;

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
