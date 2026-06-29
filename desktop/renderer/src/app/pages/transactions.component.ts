import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, of, catchError, tap } from 'rxjs';
import { ApiService } from '../api.service';
import { PeriodService } from '../period.service';
import { SortDir, SortField, Transaction, TransactionKind, TransactionQuery } from '../models';
import { MoneyPipe } from '../money.pipe';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="breadcrumb">Transactions</div>
    <h1>Transactions</h1>

    <div class="toolbar">
      <div class="field">
        <label>Period</label>
        <select [value]="periodSvc.selected()" (change)="onPeriod($any($event.target).value)">
          @if (!periodSvc.hasPeriods()) { <option value="">All</option> }
          @for (p of periodSvc.periods(); track p) {
            <option [value]="p">{{ p }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label>Category</label>
        <select [value]="category()" (change)="category.set($any($event.target).value)">
          <option value="">All</option>
          @for (c of categories(); track c) {
            <option [value]="c">{{ c }}</option>
          }
        </select>
      </div>
      <div class="field">
        <label>Kind</label>
        <select [value]="kind()" (change)="kind.set($any($event.target).value)">
          <option value="">All</option>
          <option value="Expense">Expense</option>
          <option value="Income">Income</option>
        </select>
      </div>
      <div class="field">
        <label>Search</label>
        <input type="text" placeholder="description…" [value]="q()" (input)="q.set($any($event.target).value)" />
      </div>
    </div>

    @if (error()) {
      <div class="status error">{{ error() }}</div>
    }

    <div class="meta">
      <strong>{{ txns().length }}</strong> transaction(s)
      @if (loading()) { · loading… }
      · sum <strong>{{ sum() | money }}</strong>
    </div>

    <table>
      <thead>
        <tr>
          <th class="sortable" (click)="toggleSort('date')">Date <span class="sort-ind">{{ ind('date') }}</span></th>
          <th class="sortable" (click)="toggleSort('description')">Description <span class="sort-ind">{{ ind('description') }}</span></th>
          <th class="sortable" (click)="toggleSort('category')">Category <span class="sort-ind">{{ ind('category') }}</span></th>
          <th>Account</th>
          <th class="num sortable" (click)="toggleSort('amount')">Amount <span class="sort-ind">{{ ind('amount') }}</span></th>
        </tr>
      </thead>
      <tbody>
        @for (t of txns(); track t.id) {
          <tr>
            <td>{{ t.date }}</td>
            <td>{{ t.description }}</td>
            <td>
              <select
                class="cell-select"
                [value]="t.category"
                (change)="onCategoryChange(t, $any($event.target).value)"
              >
                @if (!categories().includes(t.category)) {
                  <option [value]="t.category">{{ t.category }}</option>
                }
                @for (c of categories(); track c) {
                  <option [value]="c">{{ c }}</option>
                }
              </select>
            </td>
            <td>{{ t.account }}</td>
            <td class="num" [class.pos]="t.kind === 'Income'" [class.neg]="t.kind === 'Expense'">
              {{ t.amount | money }}
            </td>
          </tr>
        } @empty {
          <tr><td colspan="5" class="muted center">No transactions match the current filters.</td></tr>
        }
      </tbody>
    </table>
  `,
})
export class TransactionsComponent {
  private readonly api = inject(ApiService);
  readonly periodSvc = inject(PeriodService);

  readonly category = signal<string>('');
  readonly kind = signal<'' | TransactionKind>('');
  readonly q = signal<string>('');
  readonly sort = signal<SortField>('date');
  readonly dir = signal<SortDir>('desc');

  readonly txns = signal<Transaction[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly categories = toSignal(this.api.getCategories().pipe(catchError(() => of([] as string[]))), {
    initialValue: [] as string[],
  });

  readonly query = computed<TransactionQuery>(() => ({
    period: this.periodSvc.selected(),
    category: this.category(),
    kind: this.kind(),
    q: this.q(),
    sort: this.sort(),
    dir: this.dir(),
  }));

  readonly sum = computed(() => this.txns().reduce((s, t) => s + t.amount, 0));

  constructor() {
    toObservable(this.query)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        debounceTime(250),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap((query) =>
          this.api.getTransactions(query).pipe(
            catchError(() => {
              this.error.set('Failed to load transactions.');
              return of([] as Transaction[]);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((rows) => {
        this.txns.set(rows);
        this.loading.set(false);
      });
  }

  onPeriod(value: string): void {
    this.periodSvc.select(value);
  }

  toggleSort(field: SortField): void {
    if (this.sort() === field) {
      this.dir.set(this.dir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sort.set(field);
      this.dir.set(field === 'date' || field === 'amount' ? 'desc' : 'asc');
    }
  }

  ind(field: SortField): string {
    if (this.sort() !== field) return '';
    return this.dir() === 'asc' ? '▲' : '▼';
  }

  onCategoryChange(t: Transaction, category: string): void {
    if (category === t.category) return;
    this.api.patchTransaction(t.id, { category }).subscribe({
      next: (updated) => {
        this.txns.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      },
      error: () => this.error.set(`Failed to update category for transaction ${t.id}.`),
    });
  }
}
