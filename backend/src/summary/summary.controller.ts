import { Controller, Get, Query } from '@nestjs/common';
import { SummaryService } from './summary.service';

@Controller('summary')
export class SummaryController {
  constructor(private readonly service: SummaryService) {}

  @Get()
  forPeriod(@Query('period') period?: string) {
    return this.service.forPeriod(period);
  }
}
