import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
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
 * Talks to the Electron main process over IPC (window.api, exposed by the
 * preload bridge). Public method shapes are unchanged from the old HTTP version
 * (Observables), so components and PeriodService didn't need to change — only
 * the transport (HttpClient -> IPC).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  /**
   * The IPC bridge injected by the Electron preload. Read lazily (not cached in
   * a field) so it resolves at call time rather than at service construction.
   */
  private get api() {
    return window.api;
  }

  /** Liveness check against the main process (used to confirm the bridge works). */
  health(): Observable<HealthResult> {
    return from(this.api.health());
  }

  /**
   * Imports a statement from an in-memory file. Reads the file to an ArrayBuffer
   * in the renderer and ships the raw bytes over IPC, so no path/permissions are
   * involved. Each `from(...promise...)` turns the one-shot IPC reply into a
   * single-emit Observable that completes.
   */
  import(file: File): Observable<ImportResult> {
    return from(file.arrayBuffer().then((buf) => this.api.importBytes(buf)));
  }

  /** All known statement periods, in the order the main process returns them. */
  getPeriods(): Observable<string[]> {
    return from(this.api.periods());
  }

  /** The canonical category list (rule categories + defaults). */
  getCategories(): Observable<string[]> {
    return from(this.api.categories());
  }

  /** Lists transactions matching the filter/sort query. */
  getTransactions(query: TransactionQuery): Observable<Transaction[]> {
    return from(this.api.listTransactions(query));
  }

  /** Persists a new manual transaction and returns the stored row (with id). */
  createTransaction(input: NewTransaction): Observable<Transaction> {
    return from(this.api.createTransaction(input));
  }

  /** Partially updates a transaction; returns the full updated row. */
  patchTransaction(id: number, patch: UpdateTransaction): Observable<Transaction> {
    return from(this.api.updateTransaction(id, patch));
  }

  /** Deletes a single transaction by id. */
  deleteTransaction(id: number): Observable<{ deleted: boolean }> {
    return from(this.api.removeTransaction(id));
  }

  /** Deletes a period and every transaction in it; resolves with the count removed. */
  deletePeriod(period: string): Observable<{ deleted: number }> {
    return from(this.api.deletePeriod(period));
  }

  /** Renames a period (re-tags its transactions); resolves with the count updated. */
  renamePeriod(oldPeriod: string, newPeriod: string): Observable<{ updated: number }> {
    return from(this.api.renamePeriod(oldPeriod, newPeriod));
  }

  /** Budget-vs-actual summary (KPIs + per-category breakdown) for one period. */
  getSummary(period: string): Observable<Summary> {
    return from(this.api.summary(period));
  }

  /** Current monthly budget per category. */
  getBudgets(): Observable<Budget[]> {
    return from(this.api.budgets());
  }

  /** Replaces the stored budgets with the given list; returns the saved set. */
  putBudgets(budgets: Budget[]): Observable<Budget[]> {
    return from(this.api.updateBudgets(budgets));
  }

  /** Loads the category-rules config (patterns, exclusions, default). */
  getRules(): Observable<RuleSet> {
    return from(this.api.getRules());
  }

  /** Saves the category-rules config; returns the normalized saved set. */
  saveRules(rules: RuleSet): Observable<RuleSet> {
    return from(this.api.saveRules(rules));
  }

  /** Re-runs the rules over existing transactions; resolves with the count re-categorized. */
  recategorize(): Observable<{ updated: number }> {
    return from(this.api.recategorize());
  }
}
