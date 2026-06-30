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

/**
 * The IPC bridge exposed by the Electron preload as `window.api`. Every method
 * is a Promise-returning wrapper over an `ipcRenderer.invoke` round-trip to a
 * handler in the main process; the renderer never touches the database or
 * filesystem directly. ApiService wraps these Promises as rxjs Observables —
 * this interface is the single source of truth for that contract, so the two
 * sides stay in sync.
 */
export interface EzApi {
  /** Liveness check; resolves once the main process is responsive. */
  health(): Promise<HealthResult>;
  /** Canonical category list. */
  categories(): Promise<string[]>;
  /** All known statement periods. */
  periods(): Promise<string[]>;
  /** Lists transactions matching the filter/sort query. */
  listTransactions(query: TransactionQuery): Promise<Transaction[]>;
  /** Inserts a manual transaction; resolves with the stored row (with id). */
  createTransaction(input: NewTransaction): Promise<Transaction>;
  /** Applies a partial update; resolves with the full updated row. */
  updateTransaction(id: number, patch: UpdateTransaction): Promise<Transaction>;
  /** Deletes one transaction by id. */
  removeTransaction(id: number): Promise<{ deleted: boolean }>;
  /** Deletes a period and all its transactions; resolves with the count removed. */
  deletePeriod(period: string): Promise<{ deleted: number }>;
  /** Renames a period; resolves with the count of transactions re-tagged. */
  renamePeriod(oldPeriod: string, newPeriod: string): Promise<{ updated: number }>;
  /** Budget-vs-actual summary for a period (defaults to latest when omitted). */
  summary(period?: string): Promise<Summary>;
  /** Current monthly budgets. */
  budgets(): Promise<Budget[]>;
  /** Replaces stored budgets; resolves with the saved set. */
  updateBudgets(list: Budget[]): Promise<Budget[]>;
  /** Loads the category-rules config. */
  getRules(): Promise<RuleSet>;
  /** Saves the category-rules config; resolves with the normalized set. */
  saveRules(rules: RuleSet): Promise<RuleSet>;
  /** Re-applies rules to existing transactions; resolves with the count changed. */
  recategorize(): Promise<{ updated: number }>;
  /** Opens a native file-picker in the main process and imports the chosen PDF; `canceled` if dismissed. */
  importDialog(): Promise<ImportResult | { canceled: true }>;
  /** Imports a statement from raw bytes read in the renderer (no file path needed). */
  importBytes(bytes: ArrayBuffer): Promise<ImportResult>;
}

declare global {
  // Augments the global Window so `window.api` is typed everywhere without an import.
  interface Window {
    api: EzApi;
  }
}

export {};
