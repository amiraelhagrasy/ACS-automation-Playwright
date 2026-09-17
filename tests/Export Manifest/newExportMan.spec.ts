import { test } from '../../fixtures/testFixtures';

test.describe('Create New Export Manifest Test', () => {
  //export manifest full test: fills the header, then continues straight into the same wizard's bills step to add
  //a bill and submit - no need to leave and reopen by reference number, since addExportBill()/submitManifest() are
  //DOM-generic (based on visible text/data-i18n) and work on whichever bills step is currently on screen:
  test('create new export manifest full', async ({
    page,
    newExportManPage,
    viewExportManifestPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(180_000);

    try {
      await test.step('Open Air Export Manifest page', async () => {
        await newExportManPage.clickAirServices();
        await newExportManPage.clickAirExportManifest();
        await newExportManPage.clickCreateAirExportManifest();
      });

      await test.step('Fill manifest information', async () => {
        await newExportManPage.fillManifestForm(newExportManifestData);
      });

      await test.step('Continue to bills step', async () => {
        await newExportManPage.clickSaveAndContinue();
      });

      await test.step('Add export bill and submit', async () => {
        await viewExportManifestPage.addExportBill(exportBillData, exportBillItemData);
        const { submittedReferenceNumber, submittedMessageId } = await viewExportManifestPage.submitManifest();
        console.log(`Export Manifest Reference Number: ${submittedReferenceNumber}`);
        console.log(`Export Manifest Message Id: ${submittedMessageId}`);
      });
    } finally {
      await page.pause();
    }
  });

  //export manifest with more than one bill: saves the header as a draft first (like the draft test below), leaves
  //the wizard entirely, then reopens the manifest by reference number and edits it to add two bills before
  //submitting - the bills list is flat (no master/house bill hierarchy like import), so addExportBill() is just
  //called twice in a row with different bill numbers, no per-bill scoping needed:
  test('create new export manifest with more than one bill', async ({
    page,
    newExportManPage,
    viewExportManifestPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(240_000);

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

      const secondExportBillData = {
        ...exportBillData,
        billNo: (parseInt(exportBillData.billNo, 10) + 1).toString(),
      };

      await test.step('Add two export bills and submit', async () => {
        await viewExportManifestPage.addExportBill(exportBillData, exportBillItemData);
        await viewExportManifestPage.addExportBill(secondExportBillData, exportBillItemData);

        const { submittedReferenceNumber, submittedMessageId } = await viewExportManifestPage.submitManifest();
        console.log(`Export Manifest Reference Number: ${submittedReferenceNumber}`);
        console.log(`Export Manifest Message Id: ${submittedMessageId}`);
      });
    } finally {
      await page.pause();
    }
  });

  test('create new export manifest and save as draft', async ({ page, newExportManPage, newExportManifestData }) => {
    test.setTimeout(180_000);

    try {
      await test.step('Open Air Export Manifest page', async () => {
        await newExportManPage.clickAirServices();
        await newExportManPage.clickAirExportManifest();
        await newExportManPage.clickCreateAirExportManifest();
      });

      await test.step('Fill manifest information', async () => {
        await newExportManPage.fillManifestForm(newExportManifestData);
      });

      await test.step('Save as draft and get reference number', async () => {
        await newExportManPage.clickSaveAndContinue();
        await newExportManPage.clickBackButton();

        const referenceNumber = await newExportManPage.getReferenceNumberDraft();
        console.log(`Export Manifest Reference Number: ${referenceNumber}`);
      });
    } finally {
      await page.pause();
    }
  });
});
