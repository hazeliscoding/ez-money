import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transactions/transaction.entity';
import { Budget } from '../budgets/budget.entity';
import { SummaryService } from './summary.service';
import { SummaryController } from './summary.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Budget])],
  providers: [SummaryService],
  controllers: [SummaryController],
})
export class SummaryModule {}
