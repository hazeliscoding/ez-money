import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { launchApp } from './helpers';

/**
 * Regression guard for the category-edit bug: an inline category change must
 * survive an app restart. (The data layer always persisted it; the dropdown was
 * redrawing to a stale value on a fresh load — a UI-only bug the logic tests
 * couldn't catch, which is exactly what this E2E exists for.)
 *
 * Session 1 adds a transaction, re-categorizes it inline, and waits — via a
 * direct window.api round-trip — until the main process confirms the new
 * category (so the app can't be closed before the autosave flushes). Session 2
 * relaunches against the same user-data dir and asserts the dropdown shows the
 * edited category.
 */
test('an inline category edit survives an app restart', async () => {
  const s1 = await launchApp();
  const userDataDir = s1.userDataDir;
  try {
    const page = s1.page;
    await expect(page.locator('.brand-name')).toBeVisible();
    await page.locator('.sidebar nav').getByRole('link', { name: 'Transactions' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Transactions' })).toBeVisible();

    // Add a transaction (toolbar button — the empty state has one too, so scope it).
    await page.locator('.toolbar').getByRole('button', { name: 'Add transaction' }).click();
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await modal.getByLabel('Period').fill('Jun 2026');
    await modal.getByLabel('Description').fill('E2E Coffee');
    await modal.getByLabel('Amount').fill('12.50');
    await modal.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(modal).toBeHidden();

    // It lands as 'Other' (expense, no category chosen); re-categorize it inline.
    const catSelect = page.locator('tbody .cell-select');
    await expect(page.getByText('E2E Coffee')).toBeVisible();
    await expect(catSelect).toHaveValue('Other');
    await catSelect.selectOption('Groceries');
    await expect(catSelect).toHaveValue('Groceries');

    // Wait until the main process actually has the new category (the update IPC
    // resolved → autosave flushed), so closing below can't race the write.
    await expect
      .poll(async () =>
        (await page.evaluate(() => (window as any).api.listTransactions({}))).find(
          (r: { description: string }) => r.description === 'E2E Coffee',
        )?.category,
      )
      .toBe('Groceries');
  } finally {
    await s1.app.close();
  }

  // Restart against the same data dir: the edit must still be there.
  const s2 = await launchApp({ userDataDir });
  try {
    const page = s2.page;
    await expect(page.locator('.brand-name')).toBeVisible();
    await page.locator('.sidebar nav').getByRole('link', { name: 'Transactions' }).click();
    await expect(page.getByText('E2E Coffee')).toBeVisible();
    await expect(page.locator('tbody .cell-select')).toHaveValue('Groceries');
  } finally {
    await s2.app.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
