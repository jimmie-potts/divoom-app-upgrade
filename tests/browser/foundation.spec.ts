import { test, expect } from '@playwright/test';

test('the built page reports a ready simulator without claiming a device', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pixoo playlists' })).toBeVisible();
  await expect(page.getByText('Simulator mode', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Server ready');
  await expect(page.getByText('No physical display connected.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('foundation.png'), fullPage: true });
});

test('a failed health request has a working retry', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Could not reach the local server');
  await page.unroute('**/api/health');
  await page.getByRole('button', { name: 'Retry connection' }).click();
  await expect(page.getByRole('status')).toHaveText('Server ready');
});

test('malformed readiness is not shown as a healthy connection', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({ json: { status: 'ready', mode: 'real', device: { connected: true } } }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Server ready', { exact: true })).toHaveCount(0);
});
