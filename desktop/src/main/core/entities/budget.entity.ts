import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../numeric.transformer';

/**
 * The monthly budget for one category — one row per category (category is
 * unique, so it doubles as the natural upsert key).
 */
@Entity('budgets')
export class Budget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', unique: true })
  category: string;

  /** Target monthly spend for this category, in dollars. */
  @Column({ type: 'numeric', name: 'monthly_amount', transformer: numericTransformer })
  monthlyAmount: number;
}
