import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin, of, catchError } from 'rxjs';
import { ApiService } from '../api.service';
import { Budget } from '../models';
import { MoneyPipe } from '../money.pipe';

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="breadcrumb">Budgets</div>
    <h1>Budgets</h1>
    <p class="secondary meta">Set a monthly budget per category. Click Save to persist.</p>

    @if (error()) { <div class="status error">{{ error() }}</div> }
    @if (saved()) { <div class="status ok">Budgets saved.</div> }

    <table style="max-width:480px">
      <thead>
        <tr>
          <th>Category</th>
          <th class="num">Monthly Budget</th>
        </tr>
      </thead>
      <tbody>
        @for (b of budgets(); track b.category; let i = $index) {
          <tr>
            <td>{{ b.category }}</td>
            <td class="num">
              <input
                class="cell-input"
                type="number"
                min="0"
                step="1"
                [value]="b.monthlyAmount"
                (input)="setAmount(i, $any($event.target).value)"
              />
            </td>
          </tr>
        } @empty {
          <tr><td colspan="2" class="muted center">No categories available.</td></tr>
        }
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td class="num">{{ total() | money }}</td>
        </tr>
      </tfoot>
    </table>

    <div class="actions">
      <button class="btn-primary" (click)="save()" [disabled]="saving() || !budgets().length">
        {{ saving() ? 'Saving…' : 'Save' }}
      </button>
    </div>
  `,
})
export class BudgetsComponent {
  private readonly api = inject(ApiService);

  readonly budgets = signal<Budget[]>([]);
  readonly saving = signal<boolean>(false);
  readonly saved = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly total = computed(() => this.budgets().reduce((s, b) => s + (b.monthlyAmount || 0), 0));

  constructor() {
    forkJoin({
      budgets: this.api.getBudgets().pipe(catchError(() => of([] as Budget[]))),
      categories: this.api.getCategories().pipe(catchError(() => of([] as string[]))),
    }).subscribe(({ budgets, categories }) => {
      const map = new Map<string, number>();
      for (const b of budgets) map.set(b.category, b.monthlyAmount);
      // Ensure every canonical category has an editable row.
      for (const c of categories) if (!map.has(c)) map.set(c, 0);
      const merged: Budget[] = [...map.entries()]
        .map(([category, monthlyAmount]) => ({ category, monthlyAmount }))
        .sort((a, b) => a.category.localeCompare(b.category));
      this.budgets.set(merged);
    });
  }

  setAmount(index: number, value: string): void {
    const amount = parseFloat(value);
    this.budgets.update((list) =>
      list.map((b, i) => (i === index ? { ...b, monthlyAmount: isNaN(amount) ? 0 : amount } : b)),
    );
    this.saved.set(false);
  }

  save(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    this.api.putBudgets(this.budgets()).subscribe({
      next: (result) => {
        this.budgets.set([...result].sort((a, b) => a.category.localeCompare(b.category)));
        this.saving.set(false);
        this.saved.set(true);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Failed to save budgets.');
      },
    });
  }
}
