import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as path from 'path';
import { copyFile, writeFile } from 'fs/promises';
import { Services } from './db';
import { CATEGORY_PICKLIST } from './core/categories';
import { toCsv } from './core/export';

/**
 * Register every `ipcMain.handle` channel the renderer invokes. The channel
 * names here map 1:1 to the methods on window.api (see preload.ts) — adding a
 * feature means touching both sides plus the {@link EzApi} type.
 *
 * Handlers are thin: they unwrap args and delegate to a service, so business
 * logic stays testable without Electron (see core/db-test.ts).
 *
 * @param services The wired service layer from {@link initServices}.
 * @param getWindow Lazily resolves the current BrowserWindow — needed so the
 *   import dialog can be shown modally; it may be null (e.g. all windows closed)
 *   in which case the dialog is shown windowless.
 */
export function registerIpc(services: Services, getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('health', () => ({ status: 'ok' }));
  ipcMain.handle('categories', () => CATEGORY_PICKLIST);
  ipcMain.handle('periods', () => services.transactions.periods());

  ipcMain.handle('transactions:list', (_e, query) => services.transactions.find(query ?? {}));
  ipcMain.handle('transactions:create', (_e, input) => services.transactions.create(input));
  ipcMain.handle('transactions:update', (_e, id, patch) => services.transactions.update(id, patch ?? {}));
  ipcMain.handle('transactions:remove', (_e, id) => services.transactions.remove(id));
  ipcMain.handle('transactions:recategorize', () =>
    services.transactions.recategorize(services.rules.get()),
  );

  ipcMain.handle('periods:delete', (_e, period) => services.transactions.deletePeriod(period));
  ipcMain.handle('periods:rename', (_e, oldPeriod, newPeriod) =>
    services.transactions.renamePeriod(oldPeriod, newPeriod),
  );

  ipcMain.handle('summary:get', (_e, period) => services.summary.forPeriod(period));

  ipcMain.handle('budgets:list', () => services.budgets.findAll());
  ipcMain.handle('budgets:update', (_e, list) => services.budgets.upsertMany(list ?? []));

  ipcMain.handle('rules:get', () => services.rules.get());
  ipcMain.handle('rules:save', (_e, ruleset) => services.rules.save(ruleset));

  // --- data: export / backup / locate ---
  // Export transactions (a period, or all) to a CSV the user picks.
  ipcMain.handle('data:exportCsv', async (_e, period?: string) => {
    const rows = await services.transactions.find(period ? { period } : {});
    const win = getWindow();
    const opts = {
      title: 'Export transactions (CSV)',
      defaultPath: `ez-money-${(period ?? 'all').replace(/\s+/g, '-')}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    };
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (res.canceled || !res.filePath) return { canceled: true };
    await writeFile(res.filePath, toCsv(rows), 'utf-8');
    return { saved: res.filePath, count: rows.length };
  });

  // Copy the live SQLite file (kept current by sql.js autoSave) to a chosen path.
  ipcMain.handle('data:backup', async () => {
    const dbPath = path.join(app.getPath('userData'), 'ezmoney.sqlite');
    const win = getWindow();
    const opts = {
      title: 'Back up database',
      defaultPath: 'ezmoney-backup.sqlite',
      filters: [{ name: 'SQLite database', extensions: ['sqlite'] }],
    };
    const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
    if (res.canceled || !res.filePath) return { canceled: true };
    await copyFile(dbPath, res.filePath);
    return { saved: res.filePath };
  });

  // Reveal the userData folder (where ezmoney.sqlite + category-rules.json live).
  ipcMain.handle('data:openFolder', () => shell.openPath(app.getPath('userData')));

  ipcMain.handle('import:bytes', (_e, bytes: ArrayBuffer) =>
    services.import.importBytes(new Uint8Array(bytes)),
  );
  // Opens the native file picker, then imports the chosen PDF. Returns
  // { canceled: true } (not an ImportResult) when the user dismisses the dialog.
  ipcMain.handle('import:dialog', async () => {
    const win = getWindow();
    const opts = {
      title: 'Import Chime statement PDF',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['openFile' as const],
    };
    const result = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts);
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    return services.import.importPath(result.filePaths[0]);
  });
}
