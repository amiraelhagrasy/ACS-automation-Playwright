import { test } from '../../fixtures/testFixtures';

test.describe('View Export Manifest Test', () => {
  test('create export manifest, add a bill, and submit', async ({
    page,
    newExportManPage,
    viewExportManifestPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(300_000);

    try {
      await test.step('Create and save export manifest as draft', async () => {
        await newExportManPage.clickAirServices();
        await newExportManPage.clickAirExportManifest();
        await newExportManPage.clickCreateAirExportManifest();
        await newExportManPage.fillManifestForm(newExportManifestData);
        await newExportManPage.clickSaveAndContinue();
        await newExportManPage.clickBackButton();
      });

      const referenceNumber = await newExportManPage.getReferenceNumberDraft();
      console.log(`Export Manifest Reference Number: ${referenceNumber}`);

      await test.step('Reopen the draft manifest by reference', async () => {
        await newExportManPage.clickAirServices();
        await newExportManPage.clickAirExportManifest();
        await viewExportManifestPage.searchByReferenceNumber(referenceNumber);
        await viewExportManifestPage.verifyReferenceNumberDisplayed(referenceNumber);
        await viewExportManifestPage.openManifestByReferenceNumber(referenceNumber);
      });

      await test.step('Edit and continue to bills step', async () => {
        await viewExportManifestPage.clickEditButton();
        await viewExportManifestPage.clickSaveAndContinueButton();
      });

      await test.step('Add export bill and submit', async () => {
        await viewExportManifestPage.addExportBill(exportBillData, exportBillItemData);
        await viewExportManifestPage.submitManifest();
      });
    } finally {
      await page.pause();
    }
  });
});
