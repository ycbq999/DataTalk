import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('explores World Stories without an account', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'World Stories', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
  const movers = page.getByRole('complementary', { name: 'Top movers' });
  await expect(movers.getByText('Sample data', { exact: true })).toBeVisible();
  await expect(movers.getByRole('heading', { level: 3 })).toHaveText(['Top Loss', 'Top Gains', 'Top Rebound']);
  await expect(movers.getByRole('tab', { name: '12 months' })).toHaveAttribute('aria-selected', 'true');
  await movers.getByRole('tab', { name: '1 month', exact: true }).click();
  const monthlyMovers = movers.getByRole('tabpanel', { name: '1 month' });
  await expect(monthlyMovers.getByText('Ford Motor', { exact: true })).toBeVisible();
  await movers.getByRole('button', { name: 'Nasdaq-100' }).click();
  await expect(monthlyMovers.getByText('Qualcomm', { exact: true })).toBeVisible();
  await movers.getByRole('tab', { name: '1 month', exact: true }).press('End');
  await expect(movers.getByRole('tabpanel', { name: '5 years' }).getByText('PayPal', { exact: true })).toBeVisible();
  const events = page.getByRole('complementary', { name: 'Next 30 Days' });
  await expect(events.getByText('Sample schedule', { exact: true })).toBeVisible();
  await expect(events.getByRole('listitem')).toHaveCount(3);
  const sentiment = page.getByRole('region', { name: 'Fear & Greed' });
  await expect(sentiment.getByRole('meter')).toHaveAttribute('aria-valuenow', '68');
  const markets = page.getByRole('region', { name: 'World markets' });
  const americas = markets.getByRole('button', { name: 'Americas', exact: true });
  const europe = markets.getByRole('button', { name: 'Europe', exact: true });
  const asiaPacific = markets.getByRole('button', { name: 'Asia-Pacific', exact: true });
  await expect(americas).toHaveAttribute('aria-pressed', 'true');
  await expect(markets.getByRole('heading', { name: 'S&P 500' })).toBeVisible();

  await europe.click();
  await expect(americas).toHaveAttribute('aria-pressed', 'false');
  await expect(europe).toHaveAttribute('aria-pressed', 'true');
  await expect(markets.getByRole('heading', { name: 'STOXX Europe 600' })).toBeVisible();

  await asiaPacific.click();
  await expect(europe).toHaveAttribute('aria-pressed', 'false');
  await expect(asiaPacific).toHaveAttribute('aria-pressed', 'true');
  await expect(markets.getByRole('heading', { name: 'Nikkei 225' })).toBeVisible();

  const economy = page.getByRole('region', { name: 'U.S. economy' });
  await expect(economy.getByRole('heading', { level: 3 })).toHaveText(['Interest rate', 'Employment rate', 'Inflation rate']);
  const economyRanges = economy.getByRole('group', { name: 'U.S. economy chart range' });
  await expect(economyRanges.getByRole('button', { name: '10Y', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(economy.getByText('Nov 2016 – Oct 2026', { exact: true })).toBeVisible();

  for (const [name, dates] of [
    ['YTD', 'Jan 2026 – Oct 2026'],
    ['3Y', 'Nov 2023 – Oct 2026'],
    ['5Y', 'Nov 2021 – Oct 2026'],
    ['10Y', 'Nov 2016 – Oct 2026'],
  ]) {
    const range = economyRanges.getByRole('button', { name, exact: true });
    await range.click();
    await expect(range).toHaveAttribute('aria-pressed', 'true');
    await expect(economy.getByText(dates, { exact: true })).toBeVisible();
  }

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

  await page.getByRole('link', { name: 'DataTalk home' }).click();
  await expect(page.getByRole('heading', { name: 'World Stories', exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'World Stories', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My workspace' })).toHaveCount(0);
});
