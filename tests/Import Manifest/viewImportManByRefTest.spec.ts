import { test, expect } from '../../fixtures/testFixtures';
//intentionally NOT the fresh-per-test factories: this file's tests share a single manifest/master bill across
//them (test 1 creates it, test 3 edits it by the same billNo), so the data must stay the same for the whole run:
import { newImportManifestData } from '../../test-data/newImportManifestData';
import { masterBillData, airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';

test.describe('View Import Manifest Test', () => {
 //these tests share a single referenceNumber/masterBillData across the file (test 1 creates it, later tests
 //edit/view/accept the same one) and reflect a real sequence of portal state changes - fullyParallel would run
 //them concurrently in separate workers, racing on referenceNumber and triggering the site's login throttling
 //from too many simultaneous logins:
 test.describe.configure({ mode: 'serial' });

 let referenceNumber: string = '20260720486843';

  test('should create and search import manifest by reference number', async ({ page, newImportManPage, viewImportManifestPage }) => {
    test.setTimeout(300_000);

    try {

      await test.step('Open Air Import Manifest page', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await newImportManPage.clickCreateAirImportManifest();

    });

    await test.step('Fill manifest information', async () => {
      await newImportManPage.fillManifestForm(newImportManifestData);
    });

    await test.step('Submit manifest and get reference number', async () => {
      await newImportManPage. clickSaveAndSubmitDraft();
      referenceNumber = await newImportManPage.getReferenceNumberDraft();
      console.log(`Created Manifest Reference Number: ${referenceNumber}`);
    });

    await test.step('Reopen the draft manifest by reference', async () => {
      //clickSaveAndSubmitDraft() ends up back on the wizard's own header step, not a manifest detail page - the
      //تعديل button clicked next only exists on a manifest's detail view, reached by actually searching for and
      //opening it (same pattern every other test in this suite uses):
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNumber);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNumber);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNumber);
    });

    await test.step('Submit Import manifest with header', async () => {
      await viewImportManifestPage.clickEditButton();
      await viewImportManifestPage.clickSaveAndContinueButton();
      await viewImportManifestPage.addMasterBillWithHouseBill(masterBillData,airwayBillData,billItemData,warehouseData);
    });

    } finally {
      await page.pause();
    }
  });

  test('should view import manifest by reference number', async ({ page, newImportManPage, viewImportManifestPage }) => {
    try {
        await test.step('View Import Manifest with header', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();
        await viewImportManifestPage.searchByReferenceNumber(referenceNumber);
        await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNumber);
        await viewImportManifestPage.openManifestByReferenceNumber(referenceNumber);
        await viewImportManifestPage.openAllArrivedBillsDetails();
        await viewImportManifestPage.clickHistoryTab();
        await viewImportManifestPage.clickEclHistoryTab();
      });
    } finally {
      await page.pause();
    }
  });

  test('should edit import manifest header', async ({ page, newImportManPage, viewImportManifestPage }) => {
    test.setTimeout(300_000);

    try {
      await test.step('Open Import Manifest by reference', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();
        await viewImportManifestPage.searchByReferenceNumber(referenceNumber);
        await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNumber);
        await viewImportManifestPage.openManifestByReferenceNumber(referenceNumber);
      });

      await test.step('Edit Import manifest with header', async () => {
        await viewImportManifestPage.clickEditButton();
        await newImportManPage.fillFlightNumber(newImportManifestData.flightNumber);
        await viewImportManifestPage.clickSaveAndContinueButton();
        await viewImportManifestPage.clickEditOnMasterBillIfPresent();
        await viewImportManifestPage.fillMasterBillNo(masterBillData.billNo);
        await viewImportManifestPage.clickSaveAndContinueButton();
        await viewImportManifestPage.clickSaveButton();
        await viewImportManifestPage.clickSaveAndContinueButton();
        await viewImportManifestPage.clickEditOnArrivedBill();
        await viewImportManifestPage.clickSaveAndContinueButton();
        await viewImportManifestPage.clickSaveAndContinueButton();
        await viewImportManifestPage.clickSaveButton();

        
      });
    } finally {
      await page.pause();
    }
  });

  //checks the manifest's status every 5 seconds (up to 2 minutes total) until it becomes "تم استلامها" (Received), then views it:
  test('should wait for import manifest to be accepted then view it', async ({ page, newImportManPage, viewImportManifestPage }) => {
    test.setTimeout(180_000);

    const submittedReferenceNumber = '20260729485951';

    try {
      await test.step('Open manifest list', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();
      });

      let accepted = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        accepted = await viewImportManifestPage.waitForManifestStatus(
          submittedReferenceNumber,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(accepted).toBe(true);

      await test.step('View accepted manifest', async () => {
        await viewImportManifestPage.openManifestByReferenceNumber(submittedReferenceNumber);
        await viewImportManifestPage.openAllArrivedBillsDetails();
        await viewImportManifestPage.clickHistoryTab();
        await viewImportManifestPage.clickEclHistoryTab();
      });
    } finally {
      await page.pause();
    }
  });

});