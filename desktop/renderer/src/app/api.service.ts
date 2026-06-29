import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  Budget,
  HealthResult,
  ImportResult,
  Summary,
  Transaction,
  TransactionPatch,
  TransactionQuery,
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

  patchTransaction(id: number, patch: TransactionPatch): Observable<Transaction> {
    return from(this.api.updateTransaction(id, patch));
  }

  deleteTransaction(id: number): Observable<{ deleted: boolean }> {
    return from(this.api.removeTransaction(id));
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
}
