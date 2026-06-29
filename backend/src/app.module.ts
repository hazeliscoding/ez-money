import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { TransactionsModule } from './transactions/transactions.module';
import { BudgetsModule } from './budgets/budgets.module';
import { ImportModule } from './import/import.module';
import { SummaryModule } from './summary/summary.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // forRootAsync so .env is loaded (by ConfigModule) before we read DB_* —
    // a static forRoot reads process.env too early and ignores .env.
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 5432)),
        username: config.get<string>('DB_USER', 'ezmoney'),
        password: config.get<string>('DB_PASSWORD', 'ezmoney'),
        database: config.get<string>('DB_NAME', 'ezmoney'),
        autoLoadEntities: true,
        synchronize: true, // dev convenience — auto-creates tables
      }),
    }),
    TransactionsModule,
    BudgetsModule,
    ImportModule,
    SummaryModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
