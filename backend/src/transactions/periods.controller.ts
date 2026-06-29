import { Controller, Get } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Controller('periods')
export class PeriodsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  list(): Promise<string[]> {
    return this.service.periods();
  }
}
