import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, of, catchError, tap } from 'rxjs';
import { ApiService } from '../api.service';
import { PeriodService } from '../period.service';
import {
  NewTransaction,
  SortDir,
  SortField,
  Transaction,
  TransactionKind,
  TransactionQuery,
  UpdateTransaction,
} from '../models';
import { MoneyPipe } from '../money.pipe';

/** Which operation the shared modal is performing; `null` (elsewhere) means the modal is closed. */
type FormMode = 'add' | 'edit';

/**
 * View-model for the add/edit modal. `amount` is a string (not number) because
 * it's bound to a text/number input; it's parsed and validated on submit.
 */
interface TxnForm {
  date: string;
  period: string;
  description: string;
  kind: TransactionKind;
  category: string;
  amount: string;
  account: string;
  notes: string;
}

/**
 * Transactions page: filterable, sortable table of transactions for the selected
 * period, with inline category editing and a single modal reused for both adding
 * and editing rows. Filters (period/category/kind/search) drive a debounced
 * reactive query; the period filter is the app-wide selection from PeriodService.
 */
@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [MoneyPipe, RouterLink],
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
      <div class="field" style="margin-left:auto">
        <button class="btn-primary" (click)="openAdd()">Add transaction</button>
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

    @if (txns().length) {
      <table>
        <thead>
          <tr>
            <th class="sortable" (click)="toggleSort('date')">Date <span class="sort-ind">{{ ind('date') }}</span></th>
            <th class="sortable" (click)="toggleSort('description')">Description <span class="sort-ind">{{ ind('description') }}</span></th>
            <th class="sortable" (click)="toggleSort('category')">Category <span class="sort-ind">{{ ind('category') }}</span></th>
            <th>Account</th>
            <th class="num sortable" (click)="toggleSort('amount')">Amount <span class="sort-ind">{{ ind('amount') }}</span></th>
            <th style="width:120px">Actions</th>
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
              <td class="row-actions">
                <button (click)="openEdit(t)">Edit</button>
                <button (click)="remove(t)">Delete</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    } @else if (!loading()) {
      <div class="empty-state">
        <h2>No transactions</h2>
        <p>Import a statement or add a transaction to get started.</p>
        <div class="links">
          <a routerLink="/import">Import a statement</a>
          <button class="btn-primary" (click)="openAdd()">Add transaction</button>
        </div>
      </div>
    }

    @if (formMode(); as mode) {
      <div class="modal-overlay" (click)="closeForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ mode === 'add' ? 'Add transaction' : 'Edit transaction' }}</h2>
            <button (click)="closeForm()" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            @if (formError()) { <div class="status error">{{ formError() }}</div> }
            <div class="form-grid">
              <div class="form-field">
                <label>Date</label>
                <input type="date" [value]="form().date" (input)="patch('date', $any($event.target).value)" />
              </div>
              <div class="form-field">
                <label>Period</label>
                <input type="text" [value]="form().period" (input)="patch('period', $any($event.target).value)" placeholder="e.g. 2026-06" />
              </div>
              <div class="form-field full">
                <label>Description</label>
                <input type="text" [value]="form().description" (input)="patch('description', $any($event.target).value)" />
              </div>
              <div class="form-field">
                <label>Kind</label>
                <select [value]="form().kind" (change)="patch('kind', $any($event.target).value)">
                  <option value="Expense">Expense</option>
                  <option value="Income">Income</option>
                </select>
              </div>
              <div class="form-field">
                <label>Category</label>
                <select [value]="form().category" (change)="patch('category', $any($event.target).value)">
                  <option value="">—</option>
                  @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
                </select>
              </div>
              <div class="form-field">
                <label>Amount</label>
                <input type="number" min="0" step="0.01" [value]="form().amount" (input)="patch('amount', $any($event.target).value)" />
              </div>
              <div class="form-field">
                <label>Account</label>
                <input type="text" [value]="form().account" (input)="patch('account', $any($event.target).value)" />
              </div>
              <div class="form-field full">
                <label>Notes</label>
                <textarea rows="2" [value]="form().notes" (input)="patch('notes', $any($event.target).value)"></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button (click)="closeForm()" [disabled]="saving()">Cancel</button>
            <button class="btn-primary" (click)="submitForm()" [disabled]="saving()">
              {{ saving() ? 'Saving…' : (mode === 'add' ? 'Add' : 'Save') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TransactionsComponent {
  private readonly api = inject(ApiService);
  readonly periodSvc = inject(PeriodService);

  // ----- filter / sort state (each is bound to a toolbar control) -----
  readonly category = signal<string>('');
  readonly kind = signal<'' | TransactionKind>('');
  readonly q = signal<string>('');
  readonly sort = signal<SortField>('date');
  readonly dir = signal<SortDir>('desc');

  // ----- list state -----
  readonly txns = signal<Transaction[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  /** Bumped to force a reload without changing the filter query (e.g. after an add). */
  readonly reloadTick = signal<number>(0);

  // ----- add/edit modal state -----
  /** Non-null while the modal is open; its value selects add vs edit behavior. */
  readonly formMode = signal<FormMode | null>(null);
  readonly form = signal<TxnForm>(this.emptyForm());
  /** The row being edited (null in add mode); kept to diff against on save. */
  readonly editing = signal<Transaction | null>(null);
  readonly formError = signal<string | null>(null);
  readonly saving = signal<boolean>(false);

  /** Category options for the filter and form selects; empty on failure rather than erroring. */
  readonly categories = toSignal(this.api.getCategories().pipe(catchError(() => of([] as string[]))), {
    initialValue: [] as string[],
  });

  /** The current query, recomputed whenever any filter/sort signal (or the shared period) changes. */
  readonly query = computed<TransactionQuery>(() => ({
    period: this.periodSvc.selected(),
    category: this.category(),
    kind: this.kind(),
    q: this.q(),
    sort: this.sort(),
    dir: this.dir(),
  }));

  /** Running total of the listed amounts, shown in the meta line. */
  readonly sum = computed(() => this.txns().reduce((s, t) => s + t.amount, 0));

  constructor() {
    // Reactive load pipeline: re-fetch whenever the query changes OR reloadTick
    // is bumped. The leading `tap` shows the spinner immediately (before the
    // debounce) so typing feels responsive; debounce then collapses rapid
    // keystrokes/filter changes into one request. distinctUntilChanged (deep,
    // via JSON) skips redundant fetches when the effective query is unchanged.
    // switchMap cancels any in-flight request so only the latest result lands,
    // and takeUntilDestroyed tears the subscription down with the component.
    toObservable(computed(() => ({ query: this.query(), tick: this.reloadTick() })))
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        debounceTime(250),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap(({ query }) =>
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

  /** Period filter handler — writes to the shared selection (affects the whole app). */
  onPeriod(value: string): void {
    this.periodSvc.select(value);
  }

  /**
   * Header-click sort handler. Clicking the active column flips direction;
   * clicking a new column switches to it with a sensible default direction —
   * descending for date/amount (newest/largest first), ascending for text.
   */
  toggleSort(field: SortField): void {
    if (this.sort() === field) {
      this.dir.set(this.dir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sort.set(field);
      this.dir.set(field === 'date' || field === 'amount' ? 'desc' : 'asc');
    }
  }

  /** Sort-direction arrow for a column header (empty unless it's the active sort). */
  ind(field: SortField): string {
    if (this.sort() !== field) return '';
    return this.dir() === 'asc' ? '▲' : '▼';
  }

  /**
   * Inline category change from the per-row dropdown. No-ops if unchanged.
   *
   * We update the row in the list OPTIMISTICALLY (synchronously) before the async
   * save: the dropdown is a one-way `[value]="t.category"` binding, so if we waited
   * for the round-trip, change detection would re-apply the old value and snap the
   * select back — looking like the edit did nothing. On success we reconcile with
   * the persisted row; on failure we roll back to the previous category.
   */
  onCategoryChange(t: Transaction, category: string): void {
    if (category === t.category) return;
    const previous = t.category;
    this.txns.update((list) => list.map((x) => (x.id === t.id ? { ...x, category } : x)));
    this.api.patchTransaction(t.id, { category }).subscribe({
      next: (updated) => {
        this.txns.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      },
      error: () => {
        this.error.set(`Failed to update category for transaction ${t.id}.`);
        this.txns.update((list) => list.map((x) => (x.id === t.id ? { ...x, category: previous } : x)));
      },
    });
  }

  // ----- add / edit form -----

  /** Immutably updates one form field and clears any pending validation error. */
  patch<K extends keyof TxnForm>(key: K, value: TxnForm[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
    this.formError.set(null);
  }

  /** Opens the modal in add mode, pre-filling today's date and the current period. */
  openAdd(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.form.set({
      ...this.emptyForm(),
      date: this.today(),
      period: this.periodSvc.selected(),
    });
    this.formMode.set('add');
  }

  /** Opens the modal in edit mode, snapshotting the row into the form (amount stringified for the input). */
  openEdit(t: Transaction): void {
    this.editing.set(t);
    this.formError.set(null);
    this.form.set({
      date: t.date,
      period: t.period,
      description: t.description,
      kind: t.kind,
      category: t.category,
      amount: String(t.amount),
      account: t.account,
      notes: t.notes ?? '',
    });
    this.formMode.set('edit');
  }

  /** Closes the modal, unless a save is mid-flight (avoid losing in-flight state). */
  closeForm(): void {
    if (this.saving()) return;
    this.formMode.set(null);
  }

  /**
   * Validates and submits the modal. In add mode it creates the transaction,
   * refreshes the shared period list (a new period may have appeared) and bumps
   * reloadTick to reload the table. In edit mode it diffs the form against the
   * original and sends only the changed fields — sending nothing if unchanged —
   * and patches the row in place, refreshing periods only if the period changed.
   * Amounts stay positive; `kind` carries the sign meaning.
   */
  submitForm(): void {
    const f = this.form();
    const amount = parseFloat(f.amount);
    if (!f.date || !f.description.trim() || isNaN(amount)) {
      this.formError.set('Date, description, and amount are required.');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    if (this.formMode() === 'add') {
      const input: NewTransaction = {
        date: f.date,
        period: f.period.trim() || this.periodSvc.selected(),
        description: f.description.trim(),
        category: f.category,
        kind: f.kind,
        amount,
        account: f.account.trim() || 'Manual',
        notes: f.notes,
      };
      this.api.createTransaction(input).subscribe({
        next: () => {
          this.saving.set(false);
          this.formMode.set(null);
          this.periodSvc.refresh();
          this.reloadTick.update((n) => n + 1);
        },
        error: () => {
          this.saving.set(false);
          this.formError.set('Failed to add transaction.');
        },
      });
      return;
    }

    const orig = this.editing();
    if (!orig) {
      this.saving.set(false);
      this.formMode.set(null);
      return;
    }
    const patch: UpdateTransaction = {};
    const account = f.account.trim() || 'Manual';
    const period = f.period.trim();
    if (f.date !== orig.date) patch.date = f.date;
    if (period && period !== orig.period) patch.period = period;
    if (f.description.trim() !== orig.description) patch.description = f.description.trim();
    if (f.category !== orig.category) patch.category = f.category;
    if (f.kind !== orig.kind) patch.kind = f.kind;
    if (amount !== orig.amount) patch.amount = amount;
    if (account !== orig.account) patch.account = account;
    if (f.notes !== orig.notes) patch.notes = f.notes;

    if (Object.keys(patch).length === 0) {
      this.saving.set(false);
      this.formMode.set(null);
      return;
    }
    const periodChanged = patch.period !== undefined;
    this.api.patchTransaction(orig.id, patch).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.txns.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
        this.formMode.set(null);
        if (periodChanged) this.periodSvc.refresh();
      },
      error: () => {
        this.saving.set(false);
        this.formError.set('Failed to save changes.');
      },
    });
  }

  /** Deletes a row after a confirm prompt, removing it from the list in place on success. */
  remove(t: Transaction): void {
    if (!window.confirm(`Delete "${t.description}" (${t.date})? This cannot be undone.`)) return;
    this.api.deleteTransaction(t.id).subscribe({
      next: () => this.txns.update((list) => list.filter((x) => x.id !== t.id)),
      error: () => this.error.set(`Failed to delete transaction ${t.id}.`),
    });
  }

  /** Blank form defaults (Expense, "Manual" account) for a fresh add. */
  private emptyForm(): TxnForm {
    return {
      date: '',
      period: '',
      description: '',
      kind: 'Expense',
      category: '',
      amount: '',
      account: 'Manual',
      notes: '',
    };
  }

  /** Today's date as a YYYY-MM-DD string for the date input default. */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
