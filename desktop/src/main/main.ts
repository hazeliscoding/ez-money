import 'reflect-metadata';
import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { initServices } from './db';
import { registerIpc } from './ipc';

let win: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
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
  const dbPath = path.join(app.getPath('userData'), 'ezmoney.sqlite');
  // eslint-disable-next-line no-console
  console.log('[ez-money] database:', dbPath);
  const services = await initServices(dbPath);
  registerIpc(services, () => win);
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
