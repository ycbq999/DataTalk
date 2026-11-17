import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('signs in and loads a saved watchlist after a reload', async ({ page }) => {
  const { PLAYWRIGHT_USERNAME: username, PLAYWRIGHT_PASSWORD: password } = process.env;
  if (!username || !password) throw new Error('Provide a disposable account using PLAYWRIGHT_USERNAME and PLAYWRIGHT_PASSWORD.');
  const name = `Browser smoke ${randomUUID()}`;

  const pageResponse = await page.goto('/');
  expect(pageResponse?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Research dashboard' })).toBeVisible();

  await page.getByRole('button', { name: 'Create a watchlist' }).click();
  await page.getByLabel('New watchlist name').fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const watchlists = page.getByRole('combobox', { name: 'Current watchlist' });
  await expect(watchlists.getByRole('option', { name })).toBeAttached();

  await page.reload();
  const savedWatchlist = watchlists.getByRole('option', { name });
  await expect(savedWatchlist).toBeAttached();
  await watchlists.selectOption({ label: name });
  await page.getByRole('button', { name: 'Delete watchlist', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(savedWatchlist).toHaveCount(0);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
});
