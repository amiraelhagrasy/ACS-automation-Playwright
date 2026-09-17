/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

//Re-run config for the tests that failed in the regression: HEADED with the normal 500ms slowMo (so tests
//behave exactly as they do day-to-day), one worker, one retry, but WITH a 45s action cap + a global cap so a
//stuck test / a leftover page.pause() can't stall the whole re-run.
//  npx playwright test --config=playwright.rerun.config.ts <file:line ...>
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results-rerun',

  timeout: 20 * 60 * 1000,
  globalTimeout: 6 * 60 * 60 * 1000,
  expect: { timeout: 8000 },

  fullyParallel: false,
  workers: 1,
  retries: 1,
  forbidOnly: true,

  reporter: [
    ['list'],
    ['json', { outputFile: 'rerun-results.json' }],
    ['html', { outputFolder: 'playwright-report-rerun', open: 'never' }],
  ],

  use: {
    headless: false,
    //the portal's own layout doesn't stretch past a certain width (a maximized/full-desktop-width window leaves
    //a large blank gutter next to a fixed-width content panel) - a bigger-than-default but bounded viewport
    //looks right without that gap.
    viewport: { width: 1600, height: 900 },
    launchOptions: { slowMo: 500 },
    actionTimeout: 45_000,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
});
