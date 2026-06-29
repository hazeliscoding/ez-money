import { Controller, Get } from '@nestjs/common';
import { CATEGORY_PICKLIST } from './common/categories';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('categories')
  categories(): string[] {
    return CATEGORY_PICKLIST;
  }
}
