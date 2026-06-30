import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/** A launched app plus the temp user-data dir it owns, so tests can clean up. */
export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
}

/**
 * Launch the built Electron app against a fresh, isolated SQLite store.
 *
 * - args[0] is the desktop project dir, so Electron reads its package.json
 *   `main` (the compiled dist/main entry) — i.e. we exercise the production load
 *   path (loadFile of dist/renderer), not the dev server.
 * - `--user-data-dir` points userData at a throwaway temp dir, so every run
 *   starts empty and tests never see each other's (or your real) data.
 * - `--no-sandbox` is required on CI Linux runners; harmless locally.
 * - Clearing ELECTRON_RENDERER_URL forces the file:// load even if the launching
 *   shell had it set (it won't in CI).
 *
 * Pass the same `userDataDir` back in via `opts.userDataDir` to simulate an app
 * restart that keeps its data (used by the persistence test).
 */
export async function launchApp(opts: { userDataDir?: string } = {}): Promise<LaunchedApp> {
  const appPath = path.resolve(__dirname, '..');
  const userDataDir =
    opts.userDataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'ezmoney-e2e-'));

  const app = await electron.launch({
    args: [appPath, `--user-data-dir=${userDataDir}`, '--no-sandbox'],
    env: { ...process.env, ELECTRON_RENDERER_URL: '' },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page, userDataDir };
}
