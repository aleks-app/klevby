const { test, expect } = require('@playwright/test');

const IPHONE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

async function configureDeviceSignals(page, {
  userAgent,
  screenWidth = 1440,
  screenHeight = 900,
  standalone = false,
  capacitor = false,
} = {}) {
  await page.addInitScript((config) => {
    if (config.userAgent) {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        get: () => config.userAgent,
      });
    }

    Object.defineProperty(window.screen, 'width', {
      configurable: true,
      get: () => config.screenWidth,
    });
    Object.defineProperty(window.screen, 'height', {
      configurable: true,
      get: () => config.screenHeight,
    });
    Object.defineProperty(window, 'orientation', {
      configurable: true,
      get: () => (window.innerWidth > window.innerHeight ? 90 : 0),
    });

    if (config.standalone) {
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
    }

    if (config.capacitor) {
      window.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
      };
    }
  }, { userAgent, screenWidth, screenHeight, standalone, capacitor });
}

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

async function expectPhoneOrientation(page, orientation) {
  await expect(page.locator('html')).toHaveAttribute('data-device-class', 'phone');
  await expect(page.locator('html')).toHaveAttribute('data-phone-orientation', orientation);
  if (orientation === 'landscape') {
    await expect(page.locator('#portraitRequiredScreen')).toBeVisible();
  } else {
    await expect(page.locator('#portraitRequiredScreen')).toBeHidden();
  }
}

test.describe('app surface gate', () => {
  test('allows widths up to 900px and blocks wider desktop viewports without replacing app state', async ({ page, baseURL }) => {
    await configureDeviceSignals(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page, baseURL);
    await expectSurface(page, 'mobile-allowed');
    await expect(page.locator('html')).toHaveAttribute('data-device-class', 'non-phone');

    await page.evaluate(() => {
      document.querySelector('#klevbyAppRoot').dataset.surfaceGateStateCheck = 'preserved';
    });

    await page.setViewportSize({ width: 900, height: 844 });
    await expectSurface(page, 'mobile-allowed');

    await page.setViewportSize({ width: 901, height: 844 });
    await expectSurface(page, 'desktop-blocked');

    await page.setViewportSize({ width: 1200, height: 844 });
    await expectSurface(page, 'desktop-blocked');

    await page.setViewportSize({ width: 390, height: 844 });
    await expectSurface(page, 'mobile-allowed');
    await expect(page.locator('#klevbyAppRoot')).toHaveAttribute('data-surface-gate-state-check', 'preserved');
  });

  test('shows the portrait overlay for iPhone landscape and preserves mounted app state', async ({ page, baseURL }) => {
    await configureDeviceSignals(page, {
      userAgent: IPHONE_USER_AGENT,
      screenWidth: 390,
      screenHeight: 844,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page, baseURL);

    await expectSurface(page, 'mobile-allowed');
    await expectPhoneOrientation(page, 'portrait');

    await page.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'surfaceGateTypedState';
      input.value = 'сохранённый текст';
      document.querySelector('#klevbyAppRoot').append(input);
      document.querySelector('#klevbyAppRoot').dataset.activeScreen = 'chat';
    });

    await page.setViewportSize({ width: 844, height: 390 });
    await expectSurface(page, 'mobile-allowed');
    await expectPhoneOrientation(page, 'landscape');
    await expect(page.locator('#surfaceGateTypedState')).toHaveValue('сохранённый текст');

    await page.setViewportSize({ width: 390, height: 844 });
    await expectSurface(page, 'mobile-allowed');
    await expectPhoneOrientation(page, 'portrait');
    await expect(page.locator('#surfaceGateTypedState')).toHaveValue('сохранённый текст');
    await expect(page.locator('#klevbyAppRoot')).toHaveAttribute('data-active-screen', 'chat');
  });

  test('keeps a large iPhone-like standalone landscape mobile-allowed', async ({ page, baseURL }) => {
    await configureDeviceSignals(page, {
      userAgent: IPHONE_USER_AGENT,
      screenWidth: 430,
      screenHeight: 932,
      standalone: true,
    });
    await page.setViewportSize({ width: 932, height: 430 });
    await openApp(page, baseURL);

    await expectSurface(page, 'mobile-allowed');
    await expectPhoneOrientation(page, 'landscape');
  });

  test('allows standalone PWA at desktop width without classifying desktop as a phone', async ({ page, baseURL }) => {
    await configureDeviceSignals(page, { standalone: true });
    await page.setViewportSize({ width: 1200, height: 844 });
    await openApp(page, baseURL);

    await expectSurface(page, 'mobile-allowed');
    await expect(page.locator('html')).toHaveAttribute('data-device-class', 'non-phone');
    await expect(page.locator('#portraitRequiredScreen')).toBeHidden();
  });

  test('allows Capacitor native at a viewport wider than 900px', async ({ page, baseURL }) => {
    await configureDeviceSignals(page, { capacitor: true, screenWidth: 430, screenHeight: 932 });
    await page.setViewportSize({ width: 920, height: 1200 });
    await openApp(page, baseURL);

    await expectSurface(page, 'mobile-allowed');
    await expectPhoneOrientation(page, 'portrait');
  });
});
