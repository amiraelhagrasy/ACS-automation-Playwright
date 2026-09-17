import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { NewImportManExpPage } from '../../pages/Import Manifest/newImportManExpPage';
import { ViewImportManExpPage } from '../../pages/Import Manifest/viewImportManExpPage';
import { acsBrokerUser } from '../../test-data/users';
import { newImportManifestData } from '../../test-data/newImportManifestData';
import { loadExpressReferenceNumber } from '../../test-data/expressReferenceStore';

test.describe('View Import Manifest Express Test', () => {
  let loginPage: LoginPage;
  let newImportManExpPage: NewImportManExpPage;
  let viewImportManExpPage: ViewImportManExpPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);

    newImportManExpPage = new NewImportManExpPage(page);

    viewImportManExpPage = new ViewImportManExpPage(page);

    try {
      await loginPage.navigateTo(
        'https://soga.fasah.sa/ar/login/1.0/'
      );

      await page.bringToFront();

      await loginPage.loginToApplication(
        acsBrokerUser.username,
        acsBrokerUser.password,
        '999999'
      );
    } catch (error) {
      await page.pause();
      throw error;
    }
  });

  //reference number written by the "save import manifest express" test (newImportManExpTest.spec.ts) after creating a fresh manifest:
  const referenceNumber: string = loadExpressReferenceNumber();

  test('should view express import manifest by reference number', async ({ page }) => {
    try {
      await test.step('View Express Import Manifest with header', async () => {
        await newImportManExpPage.clickAirServices();
        await newImportManExpPage.clickAirImportManifest();
        await viewImportManExpPage.searchByReferenceNumber(referenceNumber);
        await viewImportManExpPage.verifyReferenceNumberDisplayed(referenceNumber);
        await viewImportManExpPage.openManifestByReferenceNumber(referenceNumber);
        await viewImportManExpPage.openAllArrivedBillsDetails();
        await viewImportManExpPage.clickHistoryTab();
        await viewImportManExpPage.clickEclHistoryTab();
      });
    } finally {
      await page.pause();
    }
  });

  test('should edit express import manifest header', async ({ page }) => {
    try {
      await test.step('Open Express Import Manifest by reference', async () => {
        await newImportManExpPage.clickAirServices();
        await newImportManExpPage.clickAirImportManifest();
        await viewImportManExpPage.searchByReferenceNumber(referenceNumber);
        await viewImportManExpPage.verifyReferenceNumberDisplayed(referenceNumber);
        await viewImportManExpPage.openManifestByReferenceNumber(referenceNumber);
      });

      await test.step('Edit express import manifest header', async () => {
        await viewImportManExpPage.clickEditButton();
        await newImportManExpPage.fillFlightNumber(newImportManifestData.flightNumber);
        await viewImportManExpPage.clickSaveAndContinueButton();
      });
    } finally {
      await page.pause();
    }
  });

  //checks the manifest's status every minute (up to 2 minutes total) until it becomes "مقبول" (Accepted), then views it:
  test('should wait for import manifest to be accepted then view it', async ({ page }) => {
    test.setTimeout(180_000);

    try {
      await test.step('Open manifest list', async () => {
        await newImportManExpPage.clickAirServices();
        await newImportManExpPage.clickAirImportManifest();
      });

      let accepted = false;

      await test.step('Wait for manifest status to become مقبول', async () => {
        accepted = await viewImportManExpPage.waitForManifestStatus(
          referenceNumber,
          'مقبول',
          { intervalMs: 60_000, timeoutMs: 120_000 }
        );
      });

      expect(accepted).toBe(true);

      await test.step('View accepted manifest', async () => {
        await viewImportManExpPage.openManifestByReferenceNumber(referenceNumber);
        await viewImportManExpPage.openAllArrivedBillsDetails();
        await viewImportManExpPage.clickHistoryTab();
        await viewImportManExpPage.clickEclHistoryTab();
      });
    } finally {
      await page.pause();
    }
  });
});
