import { BrowserWindow, dialog, ipcMain } from 'electron';
import { Services } from './db';
import { CATEGORY_PICKLIST } from './core/categories';

/** Register all IPC handlers. Channels mirror the old REST endpoints. */
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

  ipcMain.handle('import:bytes', (_e, bytes: ArrayBuffer) =>
    services.import.importBytes(new Uint8Array(bytes)),
  );
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
