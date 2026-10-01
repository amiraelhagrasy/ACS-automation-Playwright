import { test } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { createNewTransitManifestData } from '../../test-data/newTransitManifestData';

test.describe('Create New Transit Manifest Test', () => {
  //clickCreateAirTransitManifest()'s own comment: this screen's create form intermittently never renders within
  //any reasonable wait, regardless of how long we wait inside that one page load - a fresh whole-test retry
  //(new login, new page load) is the only mitigation that's shown any promise, since the failure isn't tied to
  //the wait duration itself:
  test.describe.configure({ retries: 1 });

  //1. Create Transit Manifest with header only:
  test('#1 Create Transit Manifest with header only', async ({ page, newTransitManPage, newTransitManifestData }) => {
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
  });

  //1. Create and submit draft transit manifest:
/*   test('#1 create new transit manifest and save as draft', async ({
    page,
    newTransitManPage,
    viewTransitManifestPage,
    newTransitManifestData,
  }) => {
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
  }); */

  //2. Create Transit Manifest with one Bill retrieved from system:
  test('#2 Create Transit Manifest with one Bill retrieved from system', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(300_000);

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
      await viewImportManifestPage.expectManifestStatus(
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
        },
        importReferenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );

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
  });

  //3. Create Transit Manifest with one Bill retrieved from ZATCA:
  test('#3 Create Transit Manifest with one Bill retrieved from ZATCA', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(300_000);

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
      await viewImportManifestPage.expectManifestStatus(
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
        },
        importReferenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
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
  });
  //4-7 Create Transit Manifest with multiple Bills retrieved from system:
  test('#4-7 Create, View, Edit, and Submit Transit Manifest with multiple Bills', async ({
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

    await test.step('Wait for import manifest to be received and read its customs number', async () => {
      await viewImportManifestPage.expectManifestStatus(
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
        },
        importReferenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 240_000 }
      );

      await viewImportManifestPage.openManifestByReferenceNumber(importReferenceNo);
      customsNo = await viewImportManifestPage.getCustomsNumber();
      console.log('Customs Number:', customsNo);
    });

    let transitReferenceNo = '';

    await test.step('#4- Create Transit Manifest with multiple Bills', async () => {
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
  });

  //8. Create Transit Manifest with Bill That Does Not Exist:
  test('#8 Create Transit Manifest with Bill That Does Not Exist', async ({
    page,
    newTransitManPage,
    newTransitManifestData,
    masterBillData,
  }) => {
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
        billNo: masterBillData.billNo,
      });

      await newTransitManPage.verifyTransitBillNotFound();
    });
  });

  //9. Create Transit Manifest with Bill with Weight and Quantity Exceeding Allowed Values:
  test('#9 Create Transit Manifest with Bill with Weight and Quantity Exceeding Allowed Values', async ({
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
      await viewImportManifestPage.expectManifestStatus(
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
        },
        importReferenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );

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
      await viewTransitManifestPage.expectManifestStatus(
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
        },
        firstTransitReferenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
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
      await viewTransitManifestPage.expectManifestStatus(
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
        },
        secondTransitReferenceNo,
        'مرفوض',
        { intervalMs: 5_000, timeoutMs: 240_000 }
      );

      await viewTransitManifestPage.openManifestByReferenceNumber(secondTransitReferenceNo);
    });

    await test.step('Open the document history tab and view the rejection details', async () => {
      await viewTransitManifestPage.clickHistoryTab();
      await viewTransitManifestPage.clickHistoryDetailsButton();
    });
  });
});
