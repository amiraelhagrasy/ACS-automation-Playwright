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

  // عدد الـ workers اللي بيشتغلوا مع بعض - 1 دايمًا: البورتال بيستخدم sessionStorage للوجين (مش cookies)،
  // فكل worker بيضطر يعمل لوجين OTP لوحده. worker واحد يعني لوجين واحد بس لكل التستات (نفس فكرة
  // playwright.regression.config.ts) بدل ما كل تست ياخد worker/لوجين منفصل بسبب fullyParallel:
  workers: 1,

  // شكل التقرير - HTML report تفاعلي
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    // ✏️ حط رابط موقعك هنا لو عايز تستخدم baseURL في كل الـ tests
    // baseURL: 'https://your-site.com',

    // headless: أسرع (مفيش رسم فعلي للمتصفح) - غيّرها لـ false لو عايز تتابع التست لايف وقت الديباج
    headless: true,

    // كل الكود بيدور على نصوص عربي - Firefox افتراضيًا بيوديك لواجهة إنجليزي (en-US) بعد تسجيل الدخول
    // بدل العربي، فكل السيلكتورز بتفشل. ده بيفرض العربي زي ما كان مفترض من الأول:
    locale: 'ar',

    // ياخد trace أول مرة الـ test يفشل بعد retry - مفيد جداً للـ debugging
    trace: 'on-first-retry',

    // ياخد screenshot لو الـ test فشل
    screenshot: 'only-on-failure',

    // يسجل فيديو لو الـ test فشل
    video: 'retain-on-failure',

    // سرعة تنفيذ الأكشنز (بالميلي ثانية) - مفيد وأنت بتراقب المتصفح
    // actionTimeout: 500,

    // حد أقصى لأي أكشن مفرد (click, fill, ...) - من غيرها أي عنصر مغطى بحاجة (زي backdrop متبقي من popup)
    // بيخلي الـ .click() يستنى للأبد لحد ما مهلة التست كله تخلص، بدل ما يفشل بسرعة برسالة واضحة. نفس القيمة
    // المستخدمة في playwright.regression.config.ts (اتأكدنا منها هناك):
    actionTimeout: 45_000,
  },

  // المتصفحات اللي هتشغل عليها الـ tests
  // Firefox مش Chrome: نظام حماية فسح بيكشف بصمة التحكم الأوتوماتيكي بتاعة Chromium/CDP (Chrome وEdge)
  // ويوقف صفحة الـ OTP - اتأكدنا من كده (2026-09-21). Firefox بيسجل دخول عادي لأنه بيستخدم بروتوكول مختلف تمامًا.
  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // مؤقت للتجربة - هيتشال بعدين:
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },

    // لو حبيت تضيف متصفحات تانية بعدين، بس شيل الكومنت:
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});