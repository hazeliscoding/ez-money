import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../api.service';
import { PeriodService } from '../period.service';
import { ImportResult } from '../models';
import { MoneyPipe } from '../money.pipe';

/**
 * Import page: drag-and-drop (or click-to-pick) a statement PDF, then send its
 * bytes to the main process to parse and import. Shows the import summary
 * afterward, including any merchants that matched no rule. On success it
 * refreshes the shared period list so newly imported periods become selectable.
 */
@Component({
  selector: 'app-import',
  standalone: true,
  imports: [MoneyPipe, DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="breadcrumb">Import</div>
    <h1>Import Statement</h1>
    <p class="secondary meta">Upload a bank/credit-card statement PDF to import its transactions.</p>

    <div
      class="dropzone"
      [class.dragover]="dragover()"
      (click)="picker.click()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <div>Drop a PDF here, or click to choose a file.</div>
      @if (file(); as f) {
        <div class="file-name">{{ f.name }} ({{ (f.size / 1024) | number: '1.0-0' }} KB)</div>
      }
    </div>
    <input
      #picker
      type="file"
      accept="application/pdf"
      hidden
      (change)="onFileSelected($any($event.target).files)"
    />

    <div class="actions">
      <button class="btn-primary" (click)="upload()" [disabled]="!file() || uploading()">
        {{ uploading() ? 'Importing…' : 'Import' }}
      </button>
      @if (file()) {
        <button (click)="clear()" [disabled]="uploading()">Clear</button>
      }
    </div>

    @if (error()) { <div class="status error">{{ error() }}</div> }

    @if (result(); as r) {
      <div class="section">
        <h2>Import Complete</h2>
        <div class="status ok">Imported <strong>{{ r.imported }}</strong> transaction(s).</div>
        <table style="max-width:420px; margin-top:12px">
          <tbody>
            <tr><td>Periods</td><td class="num">{{ r.periods.join(', ') || '—' }}</td></tr>
            <tr><td>Imported</td><td class="num">{{ r.imported }}</td></tr>
            <tr><td>Income</td><td class="num pos">{{ r.income | money }}</td></tr>
            <tr><td>Expense</td><td class="num neg">{{ r.expense | money }}</td></tr>
            <tr><td>Net</td><td class="num" [class.pos]="r.net >= 0" [class.neg]="r.net < 0">{{ r.net | money }}</td></tr>
          </tbody>
        </table>

        @if (r.uncategorized.length) {
          <div class="section">
            <h3>Uncategorized Merchants ({{ r.uncategorized.length }})</h3>
            <p class="secondary">
              These merchants had no matching rule and were filed under <strong>Other</strong>.
              Re-categorize them on the <a routerLink="/transactions">Transactions</a> page, or
              add rules under <a routerLink="/settings">Settings → Category rules</a> and
              re-import to auto-categorize them next time.
            </p>
            <ul class="plain">
              @for (m of r.uncategorized; track m) {
                <li>{{ m }}</li>
              }
            </ul>
          </div>
        }
      </div>
    }
  `,
})
export class ImportComponent {
  private readonly api = inject(ApiService);
  private readonly periodSvc = inject(PeriodService);

  /** The chosen file awaiting upload (null until one is picked/dropped). */
  readonly file = signal<File | null>(null);
  readonly uploading = signal<boolean>(false);
  /** Drives the drop-zone highlight while a drag is over it. */
  readonly dragover = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  /** The import summary, shown after a successful upload. */
  readonly result = signal<ImportResult | null>(null);

  /** Handles the hidden file input's selection. */
  onFileSelected(files: FileList | null): void {
    if (files && files.length) this.setFile(files[0]);
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragover.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.dragover.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragover.set(false);
    const files = e.dataTransfer?.files;
    if (files && files.length) this.setFile(files[0]);
  }

  /**
   * Accepts a candidate file, clearing any prior error/result. Rejects non-PDFs
   * (by MIME type when present, falling back to a .pdf extension check, since
   * dragged files don't always carry a type).
   */
  private setFile(f: File): void {
    this.error.set(null);
    this.result.set(null);
    if (f.type && f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      this.error.set('Please choose a PDF file.');
      this.file.set(null);
      return;
    }
    this.file.set(f);
  }

  /** Resets the page back to the empty drop-zone state. */
  clear(): void {
    this.file.set(null);
    this.result.set(null);
    this.error.set(null);
  }

  /**
   * Uploads the selected PDF and shows the result. On success it clears the file
   * and refreshes the shared period list so new periods become selectable. On
   * failure it strips Electron's "Error invoking remote method '…':" prefix to
   * surface just the underlying message (falling back to a generic hint).
   */
  upload(): void {
    const f = this.file();
    if (!f) return;
    this.uploading.set(true);
    this.error.set(null);
    this.result.set(null);
    this.api.import(f).subscribe({
      next: (res) => {
        this.result.set(res);
        this.uploading.set(false);
        this.file.set(null);
        // Refresh shared period list so new periods appear and become selectable.
        this.periodSvc.refresh();
      },
      error: (err) => {
        this.uploading.set(false);
        const detail = String(err?.message ?? err ?? '')
          .replace(/^Error invoking remote method '[^']*':\s*/, '')
          .replace(/^Error:\s*/, '')
          .trim();
        this.error.set(detail ? `Import failed: ${detail}` : 'Import failed — is this a valid Chime statement PDF?');
      },
    });
  }
}
