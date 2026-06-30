import 'reflect-metadata';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { Transaction } from './core/entities/transaction.entity';
import { Budget } from './core/entities/budget.entity';
import { TransactionsService } from './core/transactions.service';
import { BudgetsService } from './core/budgets.service';
import { SummaryService } from './core/summary.service';
import { ImportService } from './core/import.service';
import { RulesService } from './core/rules.service';

export interface Services {
  dataSource: DataSource;
  transactions: TransactionsService;
  budgets: BudgetsService;
  summary: SummaryService;
  import: ImportService;
  rules: RulesService;
}

/** Open the SQLite DB at dbPath, run migrations/seed, and wire up services. */
export async function initServices(dbPath: string): Promise<Services> {
  // sql.js = SQLite compiled to WebAssembly: no native build, no electron-rebuild.
  // `location` + `autoSave` load/persist the DB to a file (works in Node & Electron main).
  const dataSource = new DataSource({
    type: 'sqljs',
    location: dbPath,
    autoSave: true,
    entities: [Transaction, Budget],
    synchronize: true,
  });
  await dataSource.initialize();

  const transactions = new TransactionsService(dataSource.getRepository(Transaction));
  const budgets = new BudgetsService(dataSource.getRepository(Budget));
  await budgets.seed();
  const summary = new SummaryService(
    dataSource.getRepository(Transaction),
    dataSource.getRepository(Budget),
  );
  // The user-editable rules file lives alongside the DB (the userData dir).
  const rules = new RulesService(path.dirname(dbPath));
  const importer = new ImportService(transactions, rules);

  return { dataSource, transactions, budgets, summary, import: importer, rules };
}
