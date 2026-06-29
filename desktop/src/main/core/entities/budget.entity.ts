import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../numeric.transformer';

@Entity('budgets')
export class Budget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', unique: true })
  category: string;

  @Column({ type: 'numeric', name: 'monthly_amount', transformer: numericTransformer })
  monthlyAmount: number;
}
