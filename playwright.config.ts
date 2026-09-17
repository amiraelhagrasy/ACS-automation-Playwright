/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Config - ACS Automation
 * https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // مكان ملفات الـ tests
  testDir: './tests',

  // فولدر تقارير الـ HTML report
  outputDir: './test-results',

  // Timeout لكل test (بالميلي ثانية)
  timeout: 120 * 1000,

  expect: {
    // Timeout بتاع الـ assertions (زي expect(locator).toBeVisible())
    timeout: 5000,
  },

  // يشغل الـ tests بشكل متوازي (parallel) - غيرها لـ false لو عايز تشغيل متسلسل
  fullyParallel: true,

  // يمنع .only يفضل موجود لو نسيته قبل ما تعمل push على CI
  forbidOnly: !!process.env.CI,

  // عدد مرات إعادة المحاولة لو الـ test فشل
  retries: process.env.CI ? 2 : 0,

  // عدد الـ workers اللي بيشتغلوا مع بعض
  workers: process.env.CI ? 1 : undefined,

  // شكل التقرير - HTML report تفاعلي
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    // ✏️ حط رابط موقعك هنا لو عايز تستخدم baseURL في كل الـ tests
    // baseURL: 'https://your-site.com',

    // يشغل المتصفح بشكل headed (تشوف المتصفح وهو شغال)
    headless: false,

    // يبطئ كل أكشن (بالميلي ثانية) عشان تقدر تتابع الاختبار وهو شغال
    launchOptions: {
      slowMo: 500,
    },

    // ياخد trace أول مرة الـ test يفشل بعد retry - مفيد جداً للـ debugging
    trace: 'on-first-retry',

    // ياخد screenshot لو الـ test فشل
    screenshot: 'only-on-failure',

    // يسجل فيديو لو الـ test فشل
    video: 'retain-on-failure',

    // سرعة تنفيذ الأكشنز (بالميلي ثانية) - مفيد وأنت بتراقب المتصفح
    // actionTimeout: 500,
  },

  // المتصفحات اللي هتشغل عليها الـ tests
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },

    // لو حبيت تضيف متصفحات تانية بعدين، بس شيل الكومنت:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});