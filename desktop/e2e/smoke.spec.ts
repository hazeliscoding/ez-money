import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import * as fs from 'fs';
import { launchApp } from './helpers';

/**
 * Smoke-level E2E: the app boots, the renderer mounts, the IPC bridge answers
 * (every page queries the main process on load), routing works, and a fresh
 * install shows the right empty states. This is the safety net the unit tests
 * can't provide — it catches white-screen crashes, a broken preload bridge, or a
 * page that throws on render, none of which the headless logic tests would see.
 */
let app: ElectronApplication;
let page: Page;
let userDataDir: string;

test.beforeAll(async () => {
  ({ app, page, userDataDir } = await launchApp());
  // Angular has mounted once the header brand is on screen.
  await expect(page.locator('.brand-name')).toBeVisible();
});

test.afterAll(async () => {
  await app?.close();
  if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
});

test('boots to the dashboard with an empty state', async () => {
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('No data yet')).toBeVisible();
});

test('navigates to every section and renders its page', async () => {
  const nav = page.locator('.sidebar nav');

  await nav.getByRole('link', { name: 'Transactions' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible();
  await expect(page.getByText('No transactions')).toBeVisible();

  await nav.getByRole('link', { name: 'Trends' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Trends' })).toBeVisible();

  await nav.getByRole('link', { name: 'Budgets' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Budgets' })).toBeVisible();

  await nav.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

  await nav.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
});

test('exposes the IPC bridge on window.api', async () => {
  // The preload contextBridge must have run; a health() round-trip proves the
  // renderer can actually reach the main process.
  const health = await page.evaluate(() => (window as any).api?.health?.());
  expect(health).toEqual({ status: 'ok' });
});
