import { test } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { createNewTransitManifestData } from '../../test-data/newTransitManifestData';

test.describe('Create New Transit Manifest Test', () => {
  //1. Create Transit Manifest with header only:
  test('Create Transit Manifest with header only:', async ({ page, newTransitManPage, newTransitManifestData }) => {
    try {
      await test.step('Open Air Transit Manifest page', async () => {
        await newTransitManPage.clickAirServices();
        await newTransitManPage.clickAirTransitManifest();
        await newTransitManPage.clickCreateAirTransitManifest();
      });

      await test.step('Fill manifest information', async () => {
        await newTransitManPage.fillManifestForm(newTransitManifestData);
      });

      await test.step('Save and submit', async () => {
        await newTransitManPage.clickSaveAndSubmit();
        await newTransitManPage.verifyManifestSubmittedSuccessfully();

        const referenceNo = await newTransitManPage.getReferenceNumber();
        console.log('Transit Manifest Reference Number:', referenceNo);
      });
    } finally {
      await page.pause();
    }
  });

  //1. Create and submit draft transit manifest:
  test('create new transit manifest and save as draft', async ({
    page,
    newTransitManPage,
    viewTransitManifestPage,
    newTransitManifestData,
  }) => {
    try {
      await test.step('Open Air Transit Manifest page', async () => {
        await newTransitManPage.clickAirServices();
        await newTransitManPage.clickAirTransitManifest();
        await newTransitManPage.clickCreateAirTransitManifest();
      });

      await test.step('Fill manifest information', async () => {
        await newTransitManPage.fillManifestForm(newTransitManifestData);
      });

      let referenceNo = '';

      await test.step('Save as draft and get reference number', async () => {
        await newTransitManPage.clickSaveAndContinue();
        await newTransitManPage.clickBackButton();

        referenceNo = await newTransitManPage.getReferenceNumberDraft();
        console.log('Transit Manifest Reference Number:', referenceNo);
      });

      await test.step('View the draft manifest by reference', async () => {
        await newTransitManPage.clickAirServices();
        await newTransitManPage.clickAirTransitManifest();
        await viewTransitManifestPage.searchByReferenceNumber(referenceNo);
        await viewTransitManifestPage.verifyReferenceNumberDisplayed(referenceNo);
        await viewTransitManifestPage.openManifestByReferenceNumber(referenceNo);
      });
    } finally {
      await page.pause();
    }
  });

  //2. Create Transit Manifest with one Bill retrieved from system:
  test('create new transit manifest with a transit AWB from system', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(300_000);

    try {
      let importReferenceNo = '';

      await test.step('Create import manifest with one completed transit bill', async () => {
        const { submittedReferenceNumber } = await newImportManPage.submitImportManifestWithOneCompletedTransitBill(
          viewImportManifestPage,
          newImportManifestData,
          masterBillData,
          airwayBillData,
          billItemData,
          warehouseData
        );
        importReferenceNo = submittedReferenceNumber;
        console.log('Import Manifest Reference Number:', importReferenceNo);
      });

      let customsNo = '';

      await test.step('Wait for import manifest to be received and read its customs number', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        const received = await viewImportManifestPage.waitForManifestStatus(importReferenceNo, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });

        if (!received) {
          throw new Error(`Import manifest ${importReferenceNo} was not received in time`);
        }

        await viewImportManifestPage.openManifestByReferenceNumber(importReferenceNo);
        customsNo = await viewImportManifestPage.getCustomsNumber();
        console.log('Customs Number:', customsNo);
      });

      let transitReferenceNo = '';

      await test.step('Create transit manifest and attach the transit bill', async () => {
        await newTransitManPage.clickAirServices();
        await newTransitManPage.clickAirTransitManifest();
        await newTransitManPage.clickCreateAirTransitManifest();
        await newTransitManPage.fillManifestForm(newTransitManifestData);
        await newTransitManPage.clickSaveAndContinue();

        await newTransitManPage.addTransitBill(
          {
            transportCompany: newTransitManifestData.transportCompany,
            customsNo,
            viaAirportText: newTransitManifestData.viaAirportText,
            billNo: masterBillData.billNo,
          },
          {
            transitQuantity: masterBillData.totalOriginalQuantity,
            transitWeight: masterBillData.totalOriginalWeight,
          }
        );

        await newTransitManPage.clickSubmitRequestButton();

        const { referenceNumber, messageId } = await newTransitManPage.getSubmittedReferenceNumberAndClose();
        transitReferenceNo = referenceNumber;
        console.log('Transit Manifest Reference Number:', transitReferenceNo);
        console.log('Transit Manifest Message Id:', messageId);
      });
    } finally {
      await page.pause();
    }
  });

  //3. Create Transit Manifest with one Bill retrieved from ZATCA:
  //Transit-type ("ترانزيت") master bill, waits until it's received ("تم استلامها") by customs, reads the
  //customs number that appears on it once received, then creates a new Transit Manifest and, in step 2, searches
  //for and attaches that same bill (by transport company + customs number + via-port + bill number):
  test('create new transit manifest with a transit AWB from ZATCA', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(300_000);

    try {
      let importReferenceNo = '';

      await test.step('Create import manifest with one completed transit bill', async () => {
        const { submittedReferenceNumber } = await newImportManPage.submitImportManifestWithOneCompletedTransitBill(
          viewImportManifestPage,
          newImportManifestData,
          masterBillData,
          airwayBillData,
          billItemData,
          warehouseData
        );
        importReferenceNo = submittedReferenceNumber;
        console.log('Import Manifest Reference Number:', importReferenceNo);
      });

      await test.step('Wait for import manifest to be received', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        const received = await viewImportManifestPage.waitForManifestStatus(importReferenceNo, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });

        if (!received) {
          throw new Error(`Import manifest ${importReferenceNo} was not received in time`);
        }
      });

      let transitReferenceNo = '';

      await test.step('Create transit manifest and attach the transit bill via ZATCA lookup', async () => {
        await newTransitManPage.clickAirServices();
        await newTransitManPage.clickAirTransitManifest();
        await newTransitManPage.clickCreateAirTransitManifest();
        await newTransitManPage.fillManifestForm(newTransitManifestData);
        await newTransitManPage.clickSaveAndContinue();

        await newTransitManPage.addTransitBill(
          {
            transportCompany: newTransitManifestData.transportCompany,
            viaAirportText: newTransitManifestData.viaAirportText,
            billNo: masterBillData.billNo,
          },
          {
            transitQuantity: masterBillData.totalOriginalQuantity,
            transitWeight: masterBillData.totalOriginalWeight,
          }
        );

        await newTransitManPage.clickSubmitRequestButton();

        const { referenceNumber, messageId } = await newTransitManPage.getSubmittedReferenceNumberAndClose();
        transitReferenceNo = referenceNumber;
        console.log('Transit Manifest Reference Number:', transitReferenceNo);
        console.log('Transit Manifest Message Id:', messageId);
      });
    } finally {
      await page.pause();
    }
  });

  //4,5,6,7. Create, View, Edit and Submit Transit Manifest with two transit AWBs: creates an Import Manifest with two completed Transit-type
  //master bills (reusing submitManifestWithMoreThanOneBill() with billType forced to '3'), waits for it to be
  //received, then creates a new Transit Manifest and attaches both bills (same customs number - it's per
  //manifest, not per bill - but each bill's own bill number) before submitting:
  test('create new transit manifest with two transit AWBs', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(480_000);

    const transitMasterBillData = { ...masterBillData, billType: '3' };
    const secondBillNo = (parseInt(masterBillData.billNo, 10) + 1).toString();

    try {
      let importReferenceNo = '';

      await test.step('Create import manifest with two completed transit bills', async () => {
        const { submittedReferenceNumber } = await newImportManPage.submitManifestWithMoreThanOneBill(
          viewImportManifestPage,
          newImportManifestData,
          transitMasterBillData,
          airwayBillData,
          billItemData,
          warehouseData
        );
        importReferenceNo = submittedReferenceNumber;
        console.log('Import Manifest Reference Number:', importReferenceNo);
      });

      let customsNo = '';

      //two-bill manifests take longer for customs to process than a single-bill one, so this gets more headroom
      //than the single-AWB tests above:
      await test.step('Wait for import manifest to be received and read its customs number', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        const received = await viewImportManifestPage.waitForManifestStatus(importReferenceNo, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 240_000,
        });

        if (!received) {
          throw new Error(`Import manifest ${importReferenceNo} was not received in time`);
        }

        await viewImportManifestPage.openManifestByReferenceNumber(importReferenceNo);
        customsNo = await viewImportManifestPage.getCustomsNumber();
        console.log('Customs Number:', customsNo);
      });

      let transitReferenceNo = '';

      await test.step('Create transit manifest and attach both transit bills', async () => {
        await newTransitManPage.clickAirServices();
        await newTransitManPage.clickAirTransitManifest();
        await newTransitManPage.clickCreateAirTransitManifest();
        await newTransitManPage.fillManifestForm(newTransitManifestData);
        await newTransitManPage.clickSaveAndContinue();

        await newTransitManPage.addTransitBill(
          {
            transportCompany: newTransitManifestData.transportCompany,
            customsNo,
            viaAirportText: newTransitManifestData.viaAirportText,
            billNo: masterBillData.billNo,
          },
          {
            transitQuantity: masterBillData.totalOriginalQuantity,
            transitWeight: masterBillData.totalOriginalWeight,
          }
        );

        await newTransitManPage.addTransitBill(
          {
            transportCompany: newTransitManifestData.transportCompany,
            customsNo,
            viaAirportText: newTransitManifestData.viaAirportText,
            billNo: secondBillNo,
          },
          {
            transitQuantity: masterBillData.totalOriginalQuantity,
            transitWeight: masterBillData.totalOriginalWeight,
          }
        );

        await newTransitManPage.clickSubmitRequestButton();

        const { referenceNumber, messageId } = await newTransitManPage.getSubmittedReferenceNumberAndClose();
        transitReferenceNo = referenceNumber;
        console.log('Transit Manifest Reference Number:', transitReferenceNo);
        console.log('Transit Manifest Message Id:', messageId);
      });
    } finally {
      await page.pause();
    }
  });

  //8. Create Transit Manifest with Bill That Does Not Exist:
  test('create transit manifest with bill that does not exist', async ({
    page,
    newTransitManPage,
    newTransitManifestData,
    masterBillData,
  }) => {
    try {
      await test.step('Open Air Transit Manifest page', async () => {
        await newTransitManPage.clickAirServices();
        await newTransitManPage.clickAirTransitManifest();
        await newTransitManPage.clickCreateAirTransitManifest();
      });

      await test.step('Fill manifest information', async () => {
        await newTransitManPage.fillManifestForm(newTransitManifestData);
      });

      await test.step('Continue to bills step', async () => {
        await newTransitManPage.clickSaveAndContinue();
      });

      await test.step('Search for a non-existent transit bill and verify the error', async () => {
        await newTransitManPage.clickAddTransitBillButton();
        await newTransitManPage.searchTransitBill({
          transportCompany: newTransitManifestData.transportCompany,
          viaAirportText: newTransitManifestData.viaAirportText,
          //never actually submitted as a real bill anywhere - just the fixture's fresh, unused bill number:
          billNo: masterBillData.billNo,
        });

        await newTransitManPage.verifyTransitBillNotFound();
      });
    } finally {
      await page.pause();
    }
  });

  //9. Create Transit Manifest with Bill with Weight and Quantity Exceeding Allowed Values:
  test('create new transit manifest with bill weight and quantity exceeding remaining balance', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    viewTransitManifestPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(900_000);

    //the imported bill needs a full 100/100 to split 50/50 + 60/60 across the two transit manifests below - the
    //fixture default is only 100 weight / 1 quantity, so quantity is bumped to 100 here, and the house
    //bill/item/warehouse quantities are bumped to match (the site requires them to sum to the master bill's own
    //total quantity):
    const transitBillData = { ...masterBillData, totalOriginalWeight: '100', totalOriginalQuantity: '100' };
    const transitAirwayBillData = { ...airwayBillData, deliveredQuantity: '100' };
    const transitBillItemData = { ...billItemData, itemQuantity: '100' };
    const transitWarehouseData = { ...warehouseData, warehouseQuantity: '100' };

    try {
      let importReferenceNo = '';

      await test.step('Create import manifest with one completed transit bill (weight 100, quantity 100)', async () => {
        const { submittedReferenceNumber } = await newImportManPage.submitImportManifestWithOneCompletedTransitBill(
          viewImportManifestPage,
          newImportManifestData,
          transitBillData,
          transitAirwayBillData,
          transitBillItemData,
          transitWarehouseData
        );
        importReferenceNo = submittedReferenceNumber;
        console.log('Import Manifest Reference Number:', importReferenceNo);
      });

      let customsNo = '';

      await test.step('Wait for import manifest to be received and read its customs number', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        const received = await viewImportManifestPage.waitForManifestStatus(importReferenceNo, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });

        if (!received) {
          throw new Error(`Import manifest ${importReferenceNo} was not received in time`);
        }

        await viewImportManifestPage.openManifestByReferenceNumber(importReferenceNo);
        customsNo = await viewImportManifestPage.getCustomsNumber();
        console.log('Customs Number:', customsNo);
      });

      let firstTransitReferenceNo = '';

      await test.step('Create first transit manifest with half the bill (weight 50, quantity 50) and submit', async () => {
        await newTransitManPage.clickAirServices();
        await newTransitManPage.clickAirTransitManifest();
        await newTransitManPage.clickCreateAirTransitManifest();
        await newTransitManPage.fillManifestForm(newTransitManifestData);
        await newTransitManPage.clickSaveAndContinue();

        await newTransitManPage.addTransitBill(
          {
            transportCompany: newTransitManifestData.transportCompany,
            customsNo,
            viaAirportText: newTransitManifestData.viaAirportText,
            billNo: masterBillData.billNo,
          },
          {
            transitQuantity: '50',
            transitWeight: '50',
          }
        );

        await newTransitManPage.clickSubmitRequestButton();

        const { referenceNumber, messageId } = await newTransitManPage.getSubmittedReferenceNumberAndClose();
        firstTransitReferenceNo = referenceNumber;
        console.log('First Transit Manifest Reference Number:', firstTransitReferenceNo);
        console.log('First Transit Manifest Message Id:', messageId);
      });

      await test.step('Wait for the first transit manifest to be received', async () => {
        await newTransitManPage.clickAirServices();
        await newTransitManPage.clickAirTransitManifest();

        const received = await viewTransitManifestPage.waitForManifestStatus(firstTransitReferenceNo, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });

        if (!received) {
          throw new Error(`Transit manifest ${firstTransitReferenceNo} was not received in time`);
        }
      });

      let secondTransitReferenceNo = '';

      await test.step('Create second transit manifest reusing the same bill (weight 60, quantity 60 - only 50/50 remain) and submit', async () => {
        //fresh flight number for this second manifest, distinct from the first's newTransitManifestData:
        const secondTransitManifestData = createNewTransitManifestData();

        await newTransitManPage.clickAirServices();
        await newTransitManPage.clickAirTransitManifest();
        await newTransitManPage.clickCreateAirTransitManifest();
        await newTransitManPage.fillManifestForm(secondTransitManifestData);
        await newTransitManPage.clickSaveAndContinue();

        await newTransitManPage.addTransitBill(
          {
            transportCompany: secondTransitManifestData.transportCompany,
            customsNo,
            viaAirportText: secondTransitManifestData.viaAirportText,
            billNo: masterBillData.billNo,
          },
          {
            transitQuantity: '60',
            transitWeight: '60',
          }
        );

        await newTransitManPage.clickSubmitRequestButton();

        const { referenceNumber, messageId } = await newTransitManPage.getSubmittedReferenceNumberAndClose();
        secondTransitReferenceNo = referenceNumber;
        console.log('Second Transit Manifest Reference Number:', secondTransitReferenceNo);
        console.log('Second Transit Manifest Message Id:', messageId);
      });

      await test.step('Wait for the second transit manifest to be rejected, then view it', async () => {
        await newTransitManPage.clickAirServices();
        await newTransitManPage.clickAirTransitManifest();

        const rejected = await viewTransitManifestPage.waitForManifestStatus(secondTransitReferenceNo, 'مرفوض', {
          intervalMs: 5_000,
          timeoutMs: 240_000,
        });

        if (!rejected) {
          throw new Error(`Transit manifest ${secondTransitReferenceNo} was not rejected in time`);
        }

        await viewTransitManifestPage.openManifestByReferenceNumber(secondTransitReferenceNo);
      });

      await test.step('Open the document history tab and view the rejection details', async () => {
        await viewTransitManifestPage.clickHistoryTab();
        await viewTransitManifestPage.clickHistoryDetailsButton();
      });
    } finally {
      await page.pause();
    }
  });
});
