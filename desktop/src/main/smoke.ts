/**
 * Automated IPC smoke test: boots Electron with a hidden window, loads a tiny
 * page through the real preload bridge, and exercises window.api over IPC.
 * Verifies preload + contextBridge + every read/update channel + the data layer
 * end-to-end (import path is covered by the headless db-test).
 * Run: `npm run smoke` (after `npm run build:main`).
 */
import 'reflect-metadata';
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { initServices } from './db';
import { registerIpc } from './ipc';

// Headless-friendly switches so the hidden window can composite in a
// non-interactive session (CI / sandbox). The real app (main.ts) keeps GPU on.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Watchdog: never hang the smoke run.
setTimeout(() => {
  console.log('SMOKE {"ok":false,"error":"watchdog timeout"}');
  app.exit(3);
}, 40000);

const PDF = path.resolve(process.cwd(), '..', 'docs/statements/2026/Chime-Credit-Statement-June-2026.pdf');

const HTML = `<!doctype html><meta charset="utf-8"><body><script>
(async () => {
  const r = {};
  try {
    r.health = (await window.api.health()).status;
    r.categories = (await window.api.categories()).length;
    r.budgets = (await window.api.budgets()).length;
    r.periods = await window.api.periods();
    r.summaryExpense = (await window.api.summary('Jun 2026')).expense;
    const list = await window.api.listTransactions({ period:'Jun 2026', kind:'Expense', sort:'amount', dir:'desc' });
    r.count = list.length;
    r.top = list[0] && list[0].category;
    const upd = await window.api.updateTransaction(list[1].id, { category:'Other', notes:'smoke' });
    r.patched = upd.category;
    const again = await window.api.listTransactions({ period:'Jun 2026' });
    const edited = again.find(t => t.id === list[1].id);
    r.persisted = !!edited && edited.category === 'Other' && edited.notes === 'smoke';
    r.ok = r.health === 'ok' && r.categories === 14 && r.budgets === 13
        && JSON.stringify(r.periods) === JSON.stringify(['Jun 2026'])
        && r.summaryExpense === 8304.69 && r.count === 120 && r.top === 'Rent'
        && r.patched === 'Other' && r.persisted === true;
  } catch (e) { r.error = String((e && e.stack) || e); r.ok = false; }
  window.__smoke = r;
})();
</script></body>`;

app.whenReady().then(async () => {
  const dbPath = path.join(os.tmpdir(), `ezmoney-smoke-${Date.now()}.sqlite`);
  const services = await initServices(dbPath);
  await services.import.importPath(PDF); // seed data, then verify reads over IPC

  let win: BrowserWindow | null = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  registerIpc(services, () => win);

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(HTML));

  let result: any = null;
  for (let i = 0; i < 80; i++) {
    result = await win.webContents.executeJavaScript('window.__smoke || null');
    if (result) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log('SMOKE ' + JSON.stringify(result));
  await services.dataSource.destroy();
  fs.rmSync(dbPath, { force: true });
  app.exit(result && result.ok ? 0 : 1);
});
