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
  private get api() {
    return window.api;
  }

  health(): Observable<HealthResult> {
    return from(this.api.health());
  }

  import(file: File): Observable<ImportResult> {
    return from(file.arrayBuffer().then((buf) => this.api.importBytes(buf)));
  }

  getPeriods(): Observable<string[]> {
    return from(this.api.periods());
  }

  getCategories(): Observable<string[]> {
    return from(this.api.categories());
  }

  getTransactions(query: TransactionQuery): Observable<Transaction[]> {
    return from(this.api.listTransactions(query));
  }

  createTransaction(input: NewTransaction): Observable<Transaction> {
    return from(this.api.createTransaction(input));
  }

  patchTransaction(id: number, patch: UpdateTransaction): Observable<Transaction> {
    return from(this.api.updateTransaction(id, patch));
  }

  deleteTransaction(id: number): Observable<{ deleted: boolean }> {
    return from(this.api.removeTransaction(id));
  }

  deletePeriod(period: string): Observable<{ deleted: number }> {
    return from(this.api.deletePeriod(period));
  }

  renamePeriod(oldPeriod: string, newPeriod: string): Observable<{ updated: number }> {
    return from(this.api.renamePeriod(oldPeriod, newPeriod));
  }

  getSummary(period: string): Observable<Summary> {
    return from(this.api.summary(period));
  }

  getBudgets(): Observable<Budget[]> {
    return from(this.api.budgets());
  }

  putBudgets(budgets: Budget[]): Observable<Budget[]> {
    return from(this.api.updateBudgets(budgets));
  }

  getRules(): Observable<RuleSet> {
    return from(this.api.getRules());
  }

  saveRules(rules: RuleSet): Observable<RuleSet> {
    return from(this.api.saveRules(rules));
  }

  recategorize(): Observable<{ updated: number }> {
    return from(this.api.recategorize());
  }
}
