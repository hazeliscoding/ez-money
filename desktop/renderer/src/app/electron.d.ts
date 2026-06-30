import {
  Budget,
  HealthResult,
  ImportResult,
  NewTransaction,
  RuleSet,
  Summary,
  Transaction,
  TransactionQuery,
  UpdateTransaction,
} from './models';

/** The IPC bridge exposed by the Electron preload as window.api. */
export interface EzApi {
  health(): Promise<HealthResult>;
  categories(): Promise<string[]>;
  periods(): Promise<string[]>;
  listTransactions(query: TransactionQuery): Promise<Transaction[]>;
  createTransaction(input: NewTransaction): Promise<Transaction>;
  updateTransaction(id: number, patch: UpdateTransaction): Promise<Transaction>;
  removeTransaction(id: number): Promise<{ deleted: boolean }>;
  deletePeriod(period: string): Promise<{ deleted: number }>;
  renamePeriod(oldPeriod: string, newPeriod: string): Promise<{ updated: number }>;
  summary(period?: string): Promise<Summary>;
  budgets(): Promise<Budget[]>;
  updateBudgets(list: Budget[]): Promise<Budget[]>;
  getRules(): Promise<RuleSet>;
  saveRules(rules: RuleSet): Promise<RuleSet>;
  recategorize(): Promise<{ updated: number }>;
  importDialog(): Promise<ImportResult | { canceled: true }>;
  importBytes(bytes: ArrayBuffer): Promise<ImportResult>;
}

declare global {
  interface Window {
    api: EzApi;
  }
}

export {};
