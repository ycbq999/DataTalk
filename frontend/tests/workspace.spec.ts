import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('browses and filters the public stock directory without an account', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Explore stocks', exact: true })).toBeVisible();
  await expect(page.getByText('Listing information only. Live prices aren’t available.')).toBeVisible();
  const directory = page.getByRole('region', { name: 'Stock directory' });
  await expect(directory.getByRole('rowheader', { name: 'NVDA' })).toBeVisible();
  await expect(directory.getByRole('rowheader', { name: 'HPE' })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search stocks' }).fill('NVIDIA');
  await expect(directory.getByRole('rowheader', { name: 'NVDA' })).toBeVisible();
  await expect(directory.getByRole('rowheader', { name: 'HPE' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear stock search' }).click();
  await page.getByLabel('Filter by exchange').selectOption('XNYS');
  await expect(directory.getByRole('rowheader', { name: 'HPE' })).toBeVisible();
  await expect(directory.getByRole('rowheader', { name: 'NVDA' })).toHaveCount(0);

  await page.goto('/workspace/');
  await expect(page).toHaveURL(/\/sign-in\/(?:\?.*)?$/);
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Research dashboard' })).toHaveCount(0);
});

test('creates an account from the public homepage and opens its workspace', async ({ page }) => {
  const account = `browser-${randomUUID()}`;
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Account' }).getByRole('link', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/sign-up\/$/);
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(account);
  await page.getByLabel('Password', { exact: true }).fill(`Strong-${randomUUID()}`);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/workspace\/$/);
  await expect(page.getByRole('heading', { name: 'Research dashboard' })).toBeVisible();

  await page.getByRole('link', { name: 'ThesisWatch home' }).click();
  await expect(page.getByRole('heading', { name: 'Explore stocks', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My workspace' })).toBeVisible();
});

test('signs in and loads a saved watchlist after a reload', async ({ page }) => {
  const { PLAYWRIGHT_USERNAME: username, PLAYWRIGHT_PASSWORD: password } = process.env;
  if (!username || !password) throw new Error('Provide a disposable account using PLAYWRIGHT_USERNAME and PLAYWRIGHT_PASSWORD.');
  const name = `Browser smoke ${randomUUID()}`;

  await page.goto('/');
  await page.getByRole('navigation', { name: 'Account' }).getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/sign-in\/$/);
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/workspace\/$/);
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
  await expect(page.getByRole('heading', { name: 'Explore stocks', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My workspace' })).toHaveCount(0);
});
