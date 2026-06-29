import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Budget,
  HealthResult,
  ImportResult,
  Summary,
  Transaction,
  TransactionPatch,
  TransactionQuery,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  health(): Observable<HealthResult> {
    return this.http.get<HealthResult>(`${this.base}/health`);
  }

  import(file: File): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ImportResult>(`${this.base}/import`, form);
  }

  getPeriods(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/periods`);
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/categories`);
  }

  getTransactions(query: TransactionQuery): Observable<Transaction[]> {
    let params = new HttpParams();
    if (query.period) params = params.set('period', query.period);
    if (query.category) params = params.set('category', query.category);
    if (query.kind) params = params.set('kind', query.kind);
    if (query.q) params = params.set('q', query.q);
    if (query.sort) params = params.set('sort', query.sort);
    if (query.dir) params = params.set('dir', query.dir);
    return this.http.get<Transaction[]>(`${this.base}/transactions`, { params });
  }

  patchTransaction(id: number, patch: TransactionPatch): Observable<Transaction> {
    return this.http.patch<Transaction>(`${this.base}/transactions/${id}`, patch);
  }

  deleteTransaction(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/transactions/${id}`);
  }

  getSummary(period: string): Observable<Summary> {
    const params = new HttpParams().set('period', period);
    return this.http.get<Summary>(`${this.base}/summary`, { params });
  }

  getBudgets(): Observable<Budget[]> {
    return this.http.get<Budget[]>(`${this.base}/budgets`);
  }

  putBudgets(budgets: Budget[]): Observable<Budget[]> {
    return this.http.put<Budget[]>(`${this.base}/budgets`, budgets);
  }
}
