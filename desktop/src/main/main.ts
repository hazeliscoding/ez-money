/**
 * Electron main-process entry point. Boots the app: opens the SQLite-backed
 * service layer (see db.ts), wires up the IPC handlers the renderer calls
 * through window.api (see ipc.ts/preload.ts), and creates the single window.
 *
 * `import 'reflect-metadata'` must be first — TypeORM's decorators read it at
 * module-load time, so any import that pulls in an entity needs it set up.
 */
import 'reflect-metadata';
import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { initServices } from './db';
import { registerIpc } from './ipc';

let win: BrowserWindow | null = null;

/**
 * Create the (single) application window with a locked-down webPreferences:
 * contextIsolation on and nodeIntegration off, so the renderer can only reach
 * the main process through the preload bridge. In dev it loads the Vite/Angular
 * dev server (ELECTRON_RENDERER_URL) and opens DevTools; packaged it loads the
 * built renderer/index.html from disk.
 */
async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    // Window + taskbar icon. build/icon.png is shipped in the app bundle (see
    // electron-builder "files"); app.getAppPath() resolves it in dev and packaged.
    icon: path.join(app.getAppPath(), 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    await win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  }

  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(async () => {
  // Gives the app its own taskbar identity/icon on Windows (instead of electron.exe).
  if (process.platform === 'win32') app.setAppUserModelId('com.ezmoney.app');
  const dbPath = path.join(app.getPath('userData'), 'ezmoney.sqlite');
  // eslint-disable-next-line no-console
  console.log('[ez-money] database:', dbPath);
  const services = await initServices(dbPath);
  registerIpc(services, () => win);
  await createWindow();

  // Auto-update: packaged builds only (no-op in dev/tests). Reads the GitHub
  // publish feed baked in at build time; failures are non-fatal. NOTE: until the
  // installer is code-signed, Windows auto-install is best-effort.
  if (app.isPackaged) {
    autoUpdater
      .checkForUpdatesAndNotify()
      .catch((err) => console.warn('[ez-money] update check failed:', err));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
