import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { numericTransformer } from '../common/numeric.transformer';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'date' })
  date: string; // ISO 'YYYY-MM-DD'

  @Index()
  @Column()
  period: string; // e.g. 'Jun 2026'

  @Column()
  description: string;

  @Column({ name: 'raw_description', default: '' })
  rawDescription: string;

  @Index()
  @Column()
  category: string;

  @Column()
  kind: string; // 'Expense' | 'Income'

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({ default: '' })
  account: string;

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
