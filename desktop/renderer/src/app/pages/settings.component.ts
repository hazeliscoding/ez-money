import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, catchError } from 'rxjs';
import { ApiService } from '../api.service';
import { PeriodService } from '../period.service';
import { RuleSet } from '../models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="breadcrumb">Settings</div>
    <h1>Settings</h1>

    <div class="section">
      <h2>Periods</h2>
      <p class="secondary meta">Rename or delete statement periods. Deleting a period removes all of its transactions.</p>

      @if (periodsError()) { <div class="status error">{{ periodsError() }}</div> }

      <table style="max-width:480px">
        <thead>
          <tr>
            <th>Period</th>
            <th style="width:170px">Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (p of periodSvc.periods(); track p) {
            <tr>
              <td>
                @if (editingPeriod() === p) {
                  <input
                    class="cell-input"
                    type="text"
                    [value]="periodDraft()"
                    (input)="periodDraft.set($any($event.target).value)"
                  />
                } @else {
                  {{ p }}
                }
              </td>
              <td class="row-actions">
                @if (editingPeriod() === p) {
                  <button class="btn-primary" (click)="saveRename(p)">Save</button>
                  <button (click)="cancelRename()">Cancel</button>
                } @else {
                  <button (click)="startRename(p)">Rename</button>
                  <button (click)="deletePeriod(p)">Delete</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="2" class="muted center">No periods yet.</td></tr>
          }
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Category rules</h2>
      <p class="secondary meta">
        Rules are matched top to bottom against the transaction description — the first matching pattern wins.
      </p>

      @if (rulesError()) { <div class="status error">{{ rulesError() }}</div> }
      @if (rulesSaved()) { <div class="status ok">Rules saved.</div> }

      <table style="max-width:680px">
        <thead>
          <tr>
            <th class="num" style="width:36px">#</th>
            <th>Pattern</th>
            <th style="width:200px">Category</th>
            <th style="width:110px">Order</th>
            <th style="width:64px">Remove</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rules(); track $index; let i = $index) {
            <tr>
              <td class="num muted">{{ i + 1 }}</td>
              <td>
                <input
                  type="text"
                  style="width:100%"
                  placeholder="e.g. NETFLIX"
                  [value]="r[0]"
                  (input)="setRulePattern(i, $any($event.target).value)"
                />
              </td>
              <td>
                <select class="cell-select" [value]="r[1]" (change)="setRuleCategory(i, $any($event.target).value)">
                  @if (!categories().includes(r[1])) { <option [value]="r[1]">{{ r[1] }}</option> }
                  @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
                </select>
              </td>
              <td class="row-actions">
                <button (click)="moveRule(i, -1)" [disabled]="i === 0" title="Move up">↑</button>
                <button (click)="moveRule(i, 1)" [disabled]="i === rules().length - 1" title="Move down">↓</button>
              </td>
              <td class="center"><button (click)="removeRule(i)" title="Remove rule">✕</button></td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="muted center">No rules yet. Add one below.</td></tr>
          }
        </tbody>
      </table>

      <div class="actions">
        <button (click)="addRule()">Add rule</button>
      </div>

      <div class="form-field" style="max-width:320px">
        <label>Default category (when no rule matches)</label>
        <select [value]="ruleDefault()" (change)="ruleDefault.set($any($event.target).value)">
          @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
        </select>
      </div>

      <div class="form-field" style="max-width:680px; margin-top:var(--space-5)">
        <label>Excluded descriptions (one per line — these are skipped on import)</label>
        <textarea rows="4" [value]="exclude()" (input)="exclude.set($any($event.target).value)"></textarea>
      </div>

      <div class="actions">
        <button class="btn-primary" (click)="saveRules()" [disabled]="rulesSaving()">
          {{ rulesSaving() ? 'Saving…' : 'Save rules' }}
        </button>
        <button (click)="reapply()" [disabled]="recatRunning()">
          {{ recatRunning() ? 'Working…' : 'Re-apply rules to existing transactions' }}
        </button>
        @if (recatResult() !== null) {
          <span class="meta"><strong>{{ recatResult() }}</strong> updated</span>
        }
      </div>
    </div>
  `,
})
export class SettingsComponent {
  private readonly api = inject(ApiService);
  readonly periodSvc = inject(PeriodService);

  readonly categories = toSignal(
    this.api.getCategories().pipe(catchError(() => of([] as string[]))),
    { initialValue: [] as string[] },
  );

  // Periods.
  readonly editingPeriod = signal<string | null>(null);
  readonly periodDraft = signal<string>('');
  readonly periodsError = signal<string | null>(null);

  // Rules.
  readonly rules = signal<[string, string][]>([]);
  readonly exclude = signal<string>('');
  readonly ruleDefault = signal<string>('Other');
  readonly rulesSaving = signal<boolean>(false);
  readonly rulesSaved = signal<boolean>(false);
  readonly rulesError = signal<string | null>(null);
  readonly recatRunning = signal<boolean>(false);
  readonly recatResult = signal<number | null>(null);

  constructor() {
    this.api.getRules().subscribe({
      next: (r) => {
        this.rules.set(r.rules ?? []);
        this.exclude.set((r.exclude ?? []).join('\n'));
        this.ruleDefault.set(r.default || 'Other');
      },
      error: () => this.rulesError.set('Failed to load category rules.'),
    });
  }

  // ----- periods -----

  startRename(period: string): void {
    this.periodsError.set(null);
    this.editingPeriod.set(period);
    this.periodDraft.set(period);
  }

  cancelRename(): void {
    this.editingPeriod.set(null);
  }

  saveRename(oldPeriod: string): void {
    const next = this.periodDraft().trim();
    if (!next || next === oldPeriod) {
      this.editingPeriod.set(null);
      return;
    }
    this.api.renamePeriod(oldPeriod, next).subscribe({
      next: () => {
        this.editingPeriod.set(null);
        this.periodSvc.refresh();
      },
      error: () => this.periodsError.set(`Failed to rename "${oldPeriod}".`),
    });
  }

  deletePeriod(period: string): void {
    if (!window.confirm(`Delete period "${period}" and all of its transactions? This cannot be undone.`)) {
      return;
    }
    this.api.deletePeriod(period).subscribe({
      next: () => this.periodSvc.refresh(),
      error: () => this.periodsError.set(`Failed to delete "${period}".`),
    });
  }

  // ----- rules -----

  addRule(): void {
    this.rules.update((list) => [...list, ['', this.categories()[0] ?? 'Other'] as [string, string]]);
    this.rulesSaved.set(false);
  }

  removeRule(index: number): void {
    this.rules.update((list) => list.filter((_, i) => i !== index));
    this.rulesSaved.set(false);
  }

  setRulePattern(index: number, value: string): void {
    this.rules.update((list) =>
      list.map((row, i) => (i === index ? ([value, row[1]] as [string, string]) : row)),
    );
    this.rulesSaved.set(false);
  }

  setRuleCategory(index: number, value: string): void {
    this.rules.update((list) =>
      list.map((row, i) => (i === index ? ([row[0], value] as [string, string]) : row)),
    );
    this.rulesSaved.set(false);
  }

  moveRule(index: number, delta: number): void {
    const target = index + delta;
    this.rules.update((list) => {
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    this.rulesSaved.set(false);
  }

  saveRules(): void {
    this.rulesSaving.set(true);
    this.rulesSaved.set(false);
    this.rulesError.set(null);
    const exclude = this.exclude()
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const rules = this.rules()
      .filter((r) => r[0].trim().length > 0)
      .map((r) => [r[0].trim(), r[1]] as [string, string]);
    const ruleset: RuleSet = { exclude, rules, default: this.ruleDefault() };
    this.api.saveRules(ruleset).subscribe({
      next: (saved) => {
        this.rules.set(saved.rules ?? []);
        this.exclude.set((saved.exclude ?? []).join('\n'));
        this.ruleDefault.set(saved.default || 'Other');
        this.rulesSaving.set(false);
        this.rulesSaved.set(true);
      },
      error: () => {
        this.rulesSaving.set(false);
        this.rulesError.set('Failed to save category rules.');
      },
    });
  }

  reapply(): void {
    if (
      !window.confirm(
        'Re-apply rules to all existing expense transactions? This overwrites any manually set categories.',
      )
    ) {
      return;
    }
    this.recatRunning.set(true);
    this.recatResult.set(null);
    this.rulesError.set(null);
    this.api.recategorize().subscribe({
      next: (res) => {
        this.recatRunning.set(false);
        this.recatResult.set(res.updated);
      },
      error: () => {
        this.recatRunning.set(false);
        this.rulesError.set('Failed to re-apply rules.');
      },
    });
  }
}
