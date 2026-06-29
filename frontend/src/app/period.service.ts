import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

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
  readonly loaded = this._loaded.asReadonly();
  readonly hasPeriods = computed(() => this._periods().length > 0);

  constructor() {
    this.refresh();
  }

  /** Loads the period list and defaults selection to the latest (last) period. */
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

  select(period: string): void {
    this._selected.set(period);
  }
}
