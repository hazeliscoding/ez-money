import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap, startWith, catchError, map } from 'rxjs';
import { ApiService } from '../api.service';
import { PeriodService } from '../period.service';
import { CategorySummary, Summary } from '../models';
import { MoneyPipe } from '../money.pipe';

/** Loading/error/data envelope for the async summary fetch, so the template can branch on one signal. */
interface SummaryState {
  loading: boolean;
  error: string | null;
  data: Summary | null;
}

/**
 * Dashboard page: the at-a-glance overview for the selected period — KPI tiles
 * (income / spending / net / savings rate) plus a budget-vs-actual table with
 * progress bars. Read-only; it reacts to the shared period selection and
 * re-fetches its summary whenever that changes.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MoneyPipe, DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="breadcrumb">Dashboard</div>
    <h1>Dashboard</h1>

    @if (!periodSvc.hasPeriods()) {
      <div class="empty-state">
        <h2>No data yet</h2>
        <p>Import a statement or add a transaction to get started.</p>
        <div class="links">
          <a routerLink="/import">Import a statement</a>
          <a routerLink="/transactions">Add a transaction</a>
        </div>
      </div>
    } @else {
      <div class="meta">Period: <strong>{{ periodSvc.selected() }}</strong></div>

      @if (state().loading) {
        <div class="status">Loading summary…</div>
      } @else if (state().error) {
        <div class="status error">{{ state().error }}</div>
      } @else if (state().data?.period) {
        @if (state().data; as s) {
        <div class="kpi-row">
          <div class="kpi">
            <div class="kpi-label">Income</div>
            <div class="kpi-value pos">{{ s.income | money }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Spending</div>
            <div class="kpi-value neg">{{ s.expense | money }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Net</div>
            <div class="kpi-value" [class.pos]="s.net >= 0" [class.neg]="s.net < 0">{{ s.net | money }}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Savings Rate</div>
            <div class="kpi-value" [class.pos]="s.savingsRate >= 0" [class.neg]="s.savingsRate < 0">
              {{ s.savingsRate | number: '1.0-1' }}%
            </div>
          </div>
        </div>

        <h2>Budget vs Actual</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th class="num">Budget</th>
              <th>Actual</th>
              <th class="num">Remaining</th>
              <th class="num">% of Budget</th>
              <th class="num">% of Spend</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.category) {
              <tr>
                <td>{{ row.category }}</td>
                <td class="num">{{ row.budget | money }}</td>
                <td>
                  <div class="bar-cell">
                    <div class="bar-track">
                      <div class="bar-fill" [class.over]="row.remaining < 0" [style.width.%]="barWidth(row)"></div>
                    </div>
                    <div class="bar-amt" [class.over]="row.remaining < 0">{{ row.actual | money }}</div>
                  </div>
                </td>
                <td class="num" [class.over]="row.remaining < 0">{{ row.remaining | money }}</td>
                <td class="num" [class.over]="row.remaining < 0">{{ row.pctBudget | number: '1.0-0' }}%</td>
                <td class="num">{{ row.pctSpend | number: '1.0-0' }}%</td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="muted center">No category data for this period.</td></tr>
            }
          </tbody>
          @if (rows().length) {
            <tfoot>
              <tr>
                <td>Total</td>
                <td class="num">{{ totals().budget | money }}</td>
                <td class="num">{{ totals().actual | money }}</td>
                <td class="num" [class.over]="totals().remaining < 0">{{ totals().remaining | money }}</td>
                <td class="num">{{ totals().pctBudget | number: '1.0-0' }}%</td>
                <td class="num">100%</td>
              </tr>
            </tfoot>
          }
        </table>
        }
      } @else {
        <div class="empty-state">
          <h2>No data for this period</h2>
          <p>Import a statement or add a transaction to get started.</p>
          <div class="links">
            <a routerLink="/import">Import a statement</a>
            <a routerLink="/transactions">Add a transaction</a>
          </div>
        </div>
      }
    }
  `,
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  readonly periodSvc = inject(PeriodService);

  /**
   * Summary for the selected period as a signal. Bridges the shared `selected`
   * signal to an Observable and `switchMap`s into a fresh fetch on every change
   * — switchMap cancels any in-flight request so a fast period switch can't land
   * a stale response. Each fetch emits a `loading` state first (startWith) and
   * maps failures to an error state, so the template never has to handle raw
   * errors. An empty period short-circuits to an empty (no-data) state.
   */
  readonly state = toSignal(
    toObservable(this.periodSvc.selected).pipe(
      switchMap((period) => {
        if (!period) {
          return of<SummaryState>({ loading: false, error: null, data: null });
        }
        return this.api.getSummary(period).pipe(
          map((data) => ({ loading: false, error: null, data } as SummaryState)),
          startWith({ loading: true, error: null, data: null } as SummaryState),
          catchError(() =>
            of<SummaryState>({ loading: false, error: 'Failed to load summary.', data: null }),
          ),
        );
      }),
    ),
    { initialValue: { loading: false, error: null, data: null } as SummaryState },
  );

  /** Category rows for the table, sorted by actual spend descending (highest first). */
  readonly rows = computed<CategorySummary[]>(() => {
    const data = this.state().data;
    if (!data) return [];
    return [...data.byCategory].sort((a, b) => b.actual - a.actual);
  });

  /** Footer totals across all category rows; pctBudget guards divide-by-zero. */
  readonly totals = computed(() => {
    const list = this.rows();
    const budget = list.reduce((s, r) => s + r.budget, 0);
    const actual = list.reduce((s, r) => s + r.actual, 0);
    const remaining = budget - actual;
    const pctBudget = budget > 0 ? (actual / budget) * 100 : 0;
    return { budget, actual, remaining, pctBudget };
  });

  /**
   * Progress-bar fill width (%) for a row, clamped to 100 so over-budget rows
   * don't overflow the track (the "over" styling signals the overage instead).
   * With no budget set, any spend fills the bar fully.
   */
  barWidth(row: CategorySummary): number {
    if (row.budget <= 0) return row.actual > 0 ? 100 : 0;
    return Math.min(100, (row.actual / row.budget) * 100);
  }
}
