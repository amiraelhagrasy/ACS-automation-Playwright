/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

//Regression run config: the whole suite, one worker (the tests share the same portal accounts), headless,
//one retry to ride out the portal's intermittent flakiness, and a hard global cap so a stuck test can't
//stall the whole run.
//  npx playwright test --config=playwright.regression.config.ts
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results-regression',

  timeout: 20 * 60 * 1000, // 20 min per test - the slowest real tests (multi-bill submit + status polls) need it
  globalTimeout: 10 * 60 * 60 * 1000, // 10 h cap for the whole run

  expect: { timeout: 8000 },

  fullyParallel: false,
  workers: 1,
  retries: 1,
  forbidOnly: true,

  reporter: [
    ['list'],
    // outputFile/outputFolder are read from env so run-regression-parallel.sh can point each bucket at its own
    // files without clobbering the others - Playwright's own PLAYWRIGHT_JSON_OUTPUT_NAME only overrides this
    // when outputFile isn't set in config at all, so setting it via env directly here is what actually works.
    ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME || 'regression-results.json' }],
    ['html', { outputFolder: process.env.PLAYWRIGHT_HTML_REPORT || 'playwright-report-regression', open: 'never' }],
    ['blob', { outputDir: process.env.PLAYWRIGHT_BLOB_OUTPUT_DIR || 'blob-report' }],
  ],

  use: {
    headless: true,
    //every page object locates elements by Arabic text/labels - Chrome's default locale apparently steered the
    //portal to its Arabic UI, but Firefox's default locale doesn't, landing on the English UI instead (confirmed
    //2026-09-21: post-login URL was /en-US/... not /ar/...), so every Arabic locator failed to find anything.
    //Forcing Arabic here makes the portal serve the same UI both browsers were always meant to be tested against:
    locale: 'ar',
    //hard cap on any single action. The base config leaves this at 0 (unbounded), so a click on an element
    //that never becomes actionable hangs until the whole test times out (10-25 min) - across 71 tests that's
    //days. 45s is well above any legitimate portal interaction.
    actionTimeout: 45_000,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    //Firefox, not Chrome: Fasah's anti-bot system was confirmed (2026-09-21) to block Playwright's
    //Chromium/CDP automation fingerprint specifically - both Chrome and Edge hang on the OTP field every
    //time, while Firefox (a different engine, different automation protocol) logs in cleanly:
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
