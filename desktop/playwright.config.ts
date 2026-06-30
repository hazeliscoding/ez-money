import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the Electron end-to-end tests (see e2e/). These launch
 * the *built* app (dist/main + dist/renderer) through Electron, so run
 * `npm run build:main` and the renderer build first. Electron needs a display —
 * locally that's your desktop; in CI we run under Xvfb (see .github/workflows).
 *
 * Tests run serially with a single worker: each spec launches its own Electron
 * instance against an isolated --user-data-dir, and parallel app windows would
 * just contend for resources without buying speed for this small suite.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
});
