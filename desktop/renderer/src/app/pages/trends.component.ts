import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap, startWith, catchError, map } from 'rxjs';
import { ApiService } from '../api.service';
import { PeriodService } from '../period.service';
import { TrendRow } from '../models';
import { MoneyPipe } from '../money.pipe';

/** Loading/error/data envelope for the async trends fetch, so the template can branch on one signal. */
interface TrendsState {
  loading: boolean;
  error: string | null;
  data: TrendRow[];
}

/**
 * Trends page: a multi-period overview — one row per statement period with
 * income / spending / net / savings rate, plus a vanilla-CSS bar visualization
 * of income vs spending per period. Read-only; it doesn't depend on the selected
 * period (it shows them all) but re-fetches whenever the known period list
 * changes (e.g. after an import).
 */
@Component({
  selector: 'app-trends',
  standalone: true,
  imports: [MoneyPipe, PercentPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="breadcrumb">Trends</div>
    <h1>Trends</h1>

    @if (!periodSvc.hasPeriods()) {
      <div class="empty-state">
        <h2>No data yet</h2>
        <p>Import a statement or add a transaction to get started.</p>
        <div class="links">
          <a routerLink="/import">Import a statement</a>
          <a routerLink="/transactions">Add a transaction</a>
        </div>
      </div>
    } @else if (state().loading) {
      <div class="status">Loading trends…</div>
    } @else if (state().error) {
      <div class="status error">{{ state().error }}</div>
    } @else {
      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th class="num">Income</th>
            <th class="num">Spending</th>
            <th class="num">Net</th>
            <th class="num">Savings Rate</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.period) {
            <tr>
              <td>{{ row.period }}</td>
              <td class="num pos">{{ row.income | money }}</td>
              <td class="num neg">{{ row.expense | money }}</td>
              <td class="num" [class.pos]="row.net >= 0" [class.neg]="row.net < 0">{{ row.net | money }}</td>
              <td class="num" [class.pos]="row.savingsRate >= 0" [class.neg]="row.savingsRate < 0">
                {{ row.savingsRate | percent: '1.0-1' }}
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="muted center">No periods to show.</td></tr>
          }
        </tbody>
      </table>

      @if (rows().length) {
        <h2>Income vs Spending</h2>
        <div class="meta">Bars are scaled to the largest amount across all periods — income in green, spending in red.</div>
        @for (row of rows(); track row.period) {
          <div class="meta"><strong>{{ row.period }}</strong></div>
          <div class="bar-cell">
            <div class="bar-track">
              <div class="bar-fill" [style.width.%]="barWidth(row.income)"></div>
            </div>
            <div class="bar-amt pos">{{ row.income | money }}</div>
          </div>
          <div class="bar-cell">
            <div class="bar-track">
              <div class="bar-fill over" [style.width.%]="barWidth(row.expense)"></div>
            </div>
            <div class="bar-amt over">{{ row.expense | money }}</div>
          </div>
        }
      }
    }
  `,
})
export class TrendsComponent {
  private readonly api = inject(ApiService);
  readonly periodSvc = inject(PeriodService);

  /**
   * Per-period trend rows as a signal. Bridges the shared period list to an
   * Observable and `switchMap`s into a fresh fetch whenever it changes — so an
   * import that adds a period refreshes the view. Each fetch emits a `loading`
   * state first (startWith) and maps failures to an error state. An empty period
   * list short-circuits to an empty (no-data) state.
   */
  readonly state = toSignal(
    toObservable(this.periodSvc.periods).pipe(
      switchMap((periods) => {
        if (!periods.length) {
          return of<TrendsState>({ loading: false, error: null, data: [] });
        }
        return this.api.getTrends().pipe(
          map((data) => ({ loading: false, error: null, data } as TrendsState)),
          startWith({ loading: true, error: null, data: [] } as TrendsState),
          catchError(() =>
            of<TrendsState>({ loading: false, error: 'Failed to load trends.', data: [] }),
          ),
        );
      }),
    ),
    { initialValue: { loading: false, error: null, data: [] } as TrendsState },
  );

  /** Trend rows for the table/bars, chronological (oldest→newest) as returned by the API. */
  readonly rows = computed<TrendRow[]>(() => this.state().data);

  /**
   * The largest income or spending figure across all periods — the scale for the
   * bar widths so every bar is comparable. 0 when there's no data.
   */
  readonly maxValue = computed<number>(() =>
    this.rows().reduce((max, r) => Math.max(max, r.income, r.expense), 0),
  );

  /**
   * Bar fill width (%) for a value, relative to {@link maxValue}. Clamped to 100
   * and guards divide-by-zero (no data → 0 width).
   */
  barWidth(value: number): number {
    const max = this.maxValue();
    if (max <= 0) return 0;
    return Math.min(100, (value / max) * 100);
  }
}
