import { test } from '../../fixtures/testFixtures';

test.describe('Create New Export Manifest Test', () => {

  test('#1-4 Save,View,Edit,Submit Export Manifest with header only', async ({
    page,
    newExportManPage,
    viewExportManifestPage,
    newExportManifestData,
  }) => {
    test.setTimeout(300_000);

    await test.step('#1 - Save Export Manifest with header only as Draft', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await newExportManPage.clickCreateAirExportManifest();
      await newExportManPage.fillManifestForm(newExportManifestData);
      await newExportManPage.clickSaveAndContinue();
      await newExportManPage.clickBackButton();
    });

    const referenceNumber = await newExportManPage.getReferenceNumberDraft();
    console.log(`Export Manifest Reference Number: ${referenceNumber}`);
    await test.step('#2 -View Export Manifest with header only as Draft', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await viewExportManifestPage.searchByReferenceNumber(referenceNumber);
      await viewExportManifestPage.verifyReferenceNumberDisplayed(referenceNumber);
      await viewExportManifestPage.openManifestByReferenceNumber(referenceNumber);
    });

    await test.step('#3 - Edit Export Manifest with header only as Draft', async () => {
      await viewExportManifestPage.clickEditButton();
      await newExportManPage.fillFlightNumber(newExportManifestData.flightNumber);
    });
    //a plain header-only draft (no bills, no wizard steps) submits via #submitDraftManifest directly - same
    //method/pattern as the import manifest's own header-only #3 step. clickSubmitButton() (the multi-step wizard's
    //"تقديم الطلب") doesn't apply here and left the test hanging on a button that was never shown (confirmed
    //live, 2026-09-26: 5-minute test timeout waiting for it):
    await test.step('#4 - Submit Export Manifest with header only as Draft', async () => {
      await newExportManPage.clickSaveAndSubmit();
    });
  });

  test('#5,6,7,8 Submit Export Manifest with one Export Bill', async ({
    page,
    newExportManPage,
    viewExportManifestPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(180_000);

    await test.step('#5 - Submit Export Manifest with one Export Bill', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await newExportManPage.clickCreateAirExportManifest();
      await newExportManPage.fillManifestForm(newExportManifestData);
      await newExportManPage.clickSaveAndContinue();
      await viewExportManifestPage.addExportBill(exportBillData, exportBillItemData);
      const { submittedReferenceNumber, submittedMessageId } = await viewExportManifestPage.submitManifest();
      console.log(`Export Manifest Reference Number: ${submittedReferenceNumber}`);
      console.log(`Export Manifest Message Id: ${submittedMessageId}`);
    });
  });

  test('#6-9 Save,View,Edit,Submit Export Manifest with multiple Export Bills', async ({
    page,
    newExportManPage,
    viewExportManifestPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(240_000);

    await test.step('#6 - Save Export Manifest with multiple Export Bills', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await newExportManPage.clickCreateAirExportManifest();
      await newExportManPage.fillManifestForm(newExportManifestData);
      await newExportManPage.clickSaveAndContinue();     
      await newExportManPage.clickBackButton();
    });

    const referenceNumber = await newExportManPage.getReferenceNumberDraft();
    console.log(`Export Manifest Reference Number: ${referenceNumber}`);

    await test.step('#7 - View Export Manifest with multiple Export Bills', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await viewExportManifestPage.searchByReferenceNumber(referenceNumber);
      await viewExportManifestPage.verifyReferenceNumberDisplayed(referenceNumber);
      await viewExportManifestPage.openManifestByReferenceNumber(referenceNumber);
    });

    await test.step('#8 -Edit Export Manifest with multiple Export Bills', async () => {
      await viewExportManifestPage.clickEditButton();
      await viewExportManifestPage.clickSaveAndContinueButton();
    });

    const secondExportBillData = {
      ...exportBillData,
      billNo: (parseInt(exportBillData.billNo, 10) + 1).toString(),
    };

    await test.step('#9 - Submit Export Manifest with multiple Export Bills', async () => {
      await viewExportManifestPage.addExportBill(exportBillData, exportBillItemData);
      await viewExportManifestPage.addExportBill(secondExportBillData, exportBillItemData);

      const { submittedReferenceNumber, submittedMessageId } = await viewExportManifestPage.submitManifest();
      console.log(`Export Manifest Reference Number: ${submittedReferenceNumber}`);
      console.log(`Export Manifest Message Id: ${submittedMessageId}`);
    });
  });  

});
