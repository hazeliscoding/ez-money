import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PeriodService } from './period.service';

/**
 * Root shell: the persistent header (brand + global period selector), the
 * sidebar nav, and the <router-outlet> that hosts each page. The period
 * dropdown here writes the app-wide selection via PeriodService, so it stays in
 * sync with whatever the active page shows.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  /** Public so the template can bind the header dropdown to the shared period state. */
  readonly periodSvc = inject(PeriodService);

  /** Header dropdown handler — pushes the chosen period into shared state. */
  onPeriodChange(value: string): void {
    this.periodSvc.select(value);
  }
}
