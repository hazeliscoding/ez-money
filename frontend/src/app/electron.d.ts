import {
  Budget,
  HealthResult,
  ImportResult,
  Summary,
  Transaction,
  TransactionPatch,
  TransactionQuery,
} from './models';

/** The IPC bridge exposed by the Electron preload as window.api. */
export interface EzApi {
  health(): Promise<HealthResult>;
  categories(): Promise<string[]>;
  periods(): Promise<string[]>;
  listTransactions(query: TransactionQuery): Promise<Transaction[]>;
  updateTransaction(id: number, patch: TransactionPatch): Promise<Transaction>;
  removeTransaction(id: number): Promise<{ deleted: boolean }>;
  summary(period?: string): Promise<Summary>;
  budgets(): Promise<Budget[]>;
  updateBudgets(list: Budget[]): Promise<Budget[]>;
  importDialog(): Promise<ImportResult | { canceled: true }>;
  importBytes(bytes: ArrayBuffer): Promise<ImportResult>;
}

declare global {
  interface Window {
    api: EzApi;
  }
}

export {};
