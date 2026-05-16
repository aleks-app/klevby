const { test, expect } = require('@playwright/test');

const IGNORED_ERROR_PATTERNS = [
  /yandex/i,
  /ymaps/i,
  /yandex maps api/i,
  /deprecated/i,
  /non-passive event listener/i,
];

function isIgnorable(message) {
  return IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

test('read-only mobile smoke test for main navigation', async ({ page, baseURL }) => {
  /** @type {string[]} */
  const criticalConsoleErrors = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;

    const text = msg.text() || '';
    if (isIgnorable(text)) return;

    criticalConsoleErrors.push(text);
  });

  const targetUrl = process.env.BASE_URL || baseURL || 'https://klevby.com/?v=smoke-test';
  const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  expect(response, 'Main page should respond').toBeTruthy();
  expect(response && response.ok(), 'Main page response should be OK').toBeTruthy();

  const expectedOrigin = new URL(targetUrl).origin;
  const loadedOrigin = new URL(page.url()).origin;
  expect(loadedOrigin, 'Loaded page origin should match targetUrl origin').toBe(expectedOrigin);
  await expect(page.locator('body')).toBeVisible();

  const titleOrFeed = page.getByText(/Klevby|Лента/i).first();
  await expect(titleOrFeed, 'Klevby/Лента marker should be visible').toBeVisible();

  const navOrButtons = page.locator(
    'nav, .bottom-nav, [class*="bottom"], button:has-text("Лента"), button:has-text("Профиль"), button:has-text("Чат")'
  );
  await expect(navOrButtons.first(), 'Bottom nav or primary buttons should be visible').toBeVisible();

  const chatButton = page.getByRole('button', { name: /чат/i }).first();
  if (await chatButton.isVisible().catch(() => false)) {
    await chatButton.click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(500);
  }

  const profileButton = page.getByRole('button', { name: /профиль/i }).first();
  if (await profileButton.isVisible().catch(() => false)) {
    await profileButton.click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(500);
  }

  expect(
    criticalConsoleErrors,
    `Critical console errors found:\n${criticalConsoleErrors.join('\n')}`
  ).toEqual([]);
});
