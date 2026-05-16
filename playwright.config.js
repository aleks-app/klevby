// @ts-check
const { defineConfig } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'https://klevby.com/?v=smoke-test';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 7_000,
  },
  retries: 0,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    video: 'off',
    screenshot: 'only-on-failure',
  },
});
