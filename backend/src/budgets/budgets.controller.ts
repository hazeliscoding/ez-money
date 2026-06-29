import { Body, Controller, Get, Put } from '@nestjs/common';
import { BudgetsService, BudgetInput } from './budgets.service';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Put()
  update(@Body() body: BudgetInput[]) {
    return this.service.upsertMany(Array.isArray(body) ? body : []);
  }
}
