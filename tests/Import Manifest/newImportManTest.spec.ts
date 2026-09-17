import { test, expect } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';

test.describe('Create New Import Manifest Test', () => {

  //import manifest with header only test:
  test('create new import manifest without AWBs', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    await newImportManPage.clickAirServices();
    await newImportManPage.clickAirImportManifest();
    await newImportManPage.clickCreateAirImportManifest();
    await test.step('Fill manifest information', async () => {await newImportManPage.fillManifestForm(newImportManifestData);});
    await newImportManPage.clickSaveAndSubmit();
    await newImportManPage.verifyManifestSubmittedSuccessfully();
    const referenceNo = await newImportManPage.getReferenceNumber();
    console.log('Reference Number:',referenceNo);
    await page.pause();
    
  });
  //import manifest full test:
  test('create new import manifest full', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    try {
    await newImportManPage.clickAirServices();
    await newImportManPage.clickAirImportManifest();
    await newImportManPage.clickCreateAirImportManifest();

    await test.step('Fill manifest information', async () => {
      await newImportManPage.fillManifestForm(newImportManifestData);
    });

    await test.step('Click save and continue button', async () => {
      await newImportManPage.clickSaveAndConitnue();
    });

    let referenceNo = '';

    await test.step('Add master bill with house bill', async () => {
      const { submittedReferenceNumber } = await viewImportManifestPage.addMasterBillWithHouseBill(
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );
      referenceNo = submittedReferenceNumber;
    });

    await test.step('View created import manifest', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNo);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
      await viewImportManifestPage.openAllArrivedBillsDetails();
      await viewImportManifestPage.clickHistoryTab();
      await viewImportManifestPage.clickEclHistoryTab();
    });
    } finally {
      await page.pause();
    }
  });

  //import manifest with partial arrival (delivered weight less than master bill's total weight):
  test('create new import manifest with partial arrival', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    try {
    await newImportManPage.clickAirServices();
    await newImportManPage.clickAirImportManifest();
    await newImportManPage.clickCreateAirImportManifest();

    await test.step('Fill manifest information', async () => {
      await newImportManPage.fillManifestForm(newImportManifestData);
    });

    await test.step('Click save and continue button', async () => {
      await newImportManPage.clickSaveAndConitnue();
    });

    let referenceNo = '';

    await test.step('Add master bill with partial arrival', async () => {
      const { submittedReferenceNumber } = await newImportManPage.addMasterBillWithPartialArrival(
        viewImportManifestPage,
        masterBillData,
        billItemData,

        warehouseData 
      );
      referenceNo = submittedReferenceNumber;
    });

    await test.step('View created import manifest', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNo);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
      await viewImportManifestPage.openAllArrivedBillsDetails();
      await viewImportManifestPage.clickHistoryTab();
      await viewImportManifestPage.clickEclHistoryTab();
    });
    } finally {
      await page.pause();
    }
  });

  //import manifest draft test:
  test('create new import manifest draft', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    await newImportManPage.clickAirServices();
    await newImportManPage.clickAirImportManifest();
    await newImportManPage.clickCreateAirImportManifest();
    await test.step('Fill manifest information', async () => {await newImportManPage.fillManifestForm(newImportManifestData);});
    await newImportManPage.clickSaveAndSubmitDraft();
    const referenceNoDraft = await newImportManPage.getReferenceNumberDraft();
    console.log('Reference Number Draft:',referenceNoDraft);
    await page.pause();

  }); 

  //17 - Save Import Manifest with one Completed Transit Bill:
  test('Save Import Manifest with one Completed Transit Bill', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    try {
    const referenceNo = await newImportManPage.saveImportManifestWithOneCompletedTransitBill(
      viewImportManifestPage,
      newImportManifestData,
      masterBillData
    );
    console.log('Reference Number:', referenceNo);
   //17 - View Import Manifest with one Completed Transit Bill:
    await test.step('View import manifest with one Completed Transit Bill', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNo);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
    });
   //17 - Edit Import Manifest with one Completed Transit Bill:
    await test.step('Edit created import manifest', async () => {
      await viewImportManifestPage.clickEditButton();
      await newImportManPage.fillFlightNumber(newImportManifestData.flightNumber);
      await viewImportManifestPage.clickSaveAndContinueButton();
    });
    } finally {
      await page.pause();
    }
  });

  //20 - Submit Import Manifest with one Completed Transit  Bill:
  test('Submit Import Manifest with one Completed Transit Bill', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(240_000);

    try {
    let referenceNo = '';

    await test.step('Add master bill with transit bill type', async () => {
      const { submittedReferenceNumber } = await newImportManPage.submitImportManifestWithOneCompletedTransitBill(
        viewImportManifestPage,
        newImportManifestData,
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );
      referenceNo = submittedReferenceNumber;
    });

    await newImportManPage.clickAirServices();
    await newImportManPage.clickAirImportManifest();

    let received = false;

    //checks the manifest's status every 5 seconds (up to 2 minutes total) until it becomes "تم استلامها" (Received):
    await test.step('Wait for manifest status to become تم استلامها', async () => {
      received = await viewImportManifestPage.waitForManifestStatus(
        referenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );
    });

    expect(received).toBe(true);

   //17 - View Import Manifest with one Completed Transit Bill:
    await test.step('View created import manifest', async () => {
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
      await viewImportManifestPage.openAllArrivedBillsDetails();
      await viewImportManifestPage.clickHistoryTab();
      await viewImportManifestPage.clickEclHistoryTab();
    });
    } finally {
      await page.pause();
    }
  });

  //19,20,21- Save ,view, Edit  Manifest with more than one Bill:
  test('Save Manifest with more than one Bill', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    try {
    const referenceNo = await newImportManPage.saveManifestWithMoreThanOneBill(
      viewImportManifestPage,
      newImportManifestData,
      masterBillData
    );
    console.log('Reference Number:', referenceNo);

    await test.step('View created import manifest', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNo);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
    });
    //21- Save Manifest with more than one Bill:
    await test.step('Edit created import manifest', async () => {
      await viewImportManifestPage.clickEditButton();
      await newImportManPage.fillFlightNumber(newImportManifestData.flightNumber);
      await viewImportManifestPage.clickSaveAndContinueButton();
    });

    await test.step('Edit and save each master bill without changes', async () => {
      await viewImportManifestPage.editAndSaveAllMasterBills();
    });

    await test.step('Add house bills and submit manifest', async () => {
      await viewImportManifestPage.clickSaveAndContinueButton();

      const secondBillNo = (parseInt(masterBillData.billNo, 10) + 1).toString();

      await viewImportManifestPage.addHouseBill(airwayBillData, billItemData, warehouseData, masterBillData.billNo);
      await viewImportManifestPage.addHouseBill(airwayBillData, billItemData, warehouseData, secondBillNo);

      await viewImportManifestPage.submitManifest();
    });
    } finally {
      await page.pause();
    }
  });

  //22- Submit , view  a manifest with more than one master bill, then views it:
  test('Submit Manifest with more than one Bill', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    try {
    let referenceNo = '';

    await test.step('Submit manifest with more than one bill', async () => {
      const { submittedReferenceNumber } = await newImportManPage.submitManifestWithMoreThanOneBill(
        viewImportManifestPage,
        newImportManifestData,
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );
      referenceNo = submittedReferenceNumber;
    });

    await test.step('View created import manifest', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNo);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
      await viewImportManifestPage.openAllArrivedBillsDetails();
      await viewImportManifestPage.clickHistoryTab();
      await viewImportManifestPage.clickEclHistoryTab();
    });
    } finally {
      await page.pause();
    }
  });

  

});