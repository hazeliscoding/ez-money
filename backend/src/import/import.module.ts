import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';

@Module({
  imports: [TransactionsModule],
  providers: [ImportService],
  controllers: [ImportController],
})
export class ImportModule {}
