const { test, expect } = require('@playwright/test');

async function openApp(page, baseURL) {
  const targetUrl = process.env.BASE_URL || baseURL || 'https://klevby.com/?v=surface-gate-test';
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
}

async function expectSurface(page, surface) {
  await expect(page.locator('html')).toHaveAttribute('data-app-surface', surface);

  if (surface === 'mobile-allowed') {
    await expect(page.locator('#klevbyAppRoot')).toBeVisible();
    await expect(page.locator('#desktopBlockedScreen')).toBeHidden();
  } else {
    await expect(page.locator('#klevbyAppRoot')).toBeHidden();
    await expect(page.locator('#desktopBlockedScreen')).toBeVisible();
  }
}

test.describe('app surface gate', () => {
  test('allows widths up to 900px and blocks wider desktop viewports without replacing app state', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page, baseURL);
    await expectSurface(page, 'mobile-allowed');

    await page.evaluate(() => {
      document.querySelector('#klevbyAppRoot').dataset.surfaceGateStateCheck = 'preserved';
    });

    await page.setViewportSize({ width: 900, height: 844 });
    await expectSurface(page, 'mobile-allowed');

    await page.setViewportSize({ width: 901, height: 844 });
    await expectSurface(page, 'desktop-blocked');

    await page.setViewportSize({ width: 390, height: 844 });
    await expectSurface(page, 'mobile-allowed');
    await expect(page.locator('#klevbyAppRoot')).toHaveAttribute('data-surface-gate-state-check', 'preserved');
  });

  test('allows standalone PWA at desktop width', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (query !== '(display-mode: standalone)') return originalMatchMedia(query);

        return {
          matches: true,
          media: query,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent() { return true; },
        };
      };
    });
    await page.setViewportSize({ width: 1200, height: 844 });
    await openApp(page, baseURL);
    await expectSurface(page, 'mobile-allowed');
  });

  test('allows Capacitor native at desktop width', async ({ page, baseURL }) => {
    await page.addInitScript(() => {
      window.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
      };
    });
    await page.setViewportSize({ width: 1200, height: 844 });
    await openApp(page, baseURL);
    await expectSurface(page, 'mobile-allowed');
  });
});
