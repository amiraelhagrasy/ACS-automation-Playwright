/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

//Regression run config: the whole suite, one worker (the tests share the same portal accounts), headless (so
//any leftover page.pause() in a finally block is a no-op instead of hanging the run), no slowMo, one retry to
//ride out the portal's intermittent flakiness, and a hard global cap so a stuck test can't stall the whole run.
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
    ['json', { outputFile: 'regression-results.json' }],
    ['html', { outputFolder: 'playwright-report-regression', open: 'never' }],
  ],

  use: {
    headless: true,
    //no slowMo - this run isn't watched live, and every action across a 71+ test suite is significant added
    //wall-clock time. Documented waitForTimeout() calls in the page objects stay in place: those cover confirmed
    //portal-side race conditions, not just pacing for a human to follow along.
    launchOptions: { slowMo: 0 },
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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
