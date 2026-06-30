import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

/**
 * App-wide selected-period state, shared across pages via signals. The header
 * dropdown and every page read/write the same `selected` signal here, so
 * changing the period in one place updates the whole app reactively. Lives at
 * the root so the selection survives navigation between routes.
 */
@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly api = inject(ApiService);

  private readonly _periods = signal<string[]>([]);
  private readonly _selected = signal<string>('');
  private readonly _loaded = signal<boolean>(false);

  /** All known statement periods (chronological order from the API). */
  readonly periods = this._periods.asReadonly();
  /** Currently selected period. */
  readonly selected = this._selected.asReadonly();
  /** True once the first period fetch has resolved (success or error) — used to gate "no data" UI. */
  readonly loaded = this._loaded.asReadonly();
  /** True when at least one period exists. */
  readonly hasPeriods = computed(() => this._periods().length > 0);

  constructor() {
    this.refresh();
  }

  /**
   * Loads the period list and, by default, selects the latest (last) period.
   * Pass `selectLatest = false` to preserve the current selection across a
   * refresh — though selection still falls back to the latest if nothing is
   * selected or the previously selected period no longer exists.
   */
  refresh(selectLatest = true): void {
    this.api.getPeriods().subscribe({
      next: (periods) => {
        this._periods.set(periods);
        this._loaded.set(true);
        const current = this._selected();
        if (selectLatest || !current || !periods.includes(current)) {
          this._selected.set(periods.length ? periods[periods.length - 1] : '');
        }
      },
      error: () => {
        this._loaded.set(true);
      },
    });
  }

  /** Sets the active period (e.g. from the header dropdown). */
  select(period: string): void {
    this._selected.set(period);
  }
}
