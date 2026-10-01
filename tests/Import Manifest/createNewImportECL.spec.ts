import { test, expect } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData, createMasterBillData } from '../../test-data/masterBillData';
import { createNewImportManifestData } from '../../test-data/newImportManifestData';
import { NewImportManPage } from '../../pages/Import Manifest/newImportManifest';
import { CreateNewEclPage } from '../../pages/Import Manifest/createNewImportEClPage';
import { claimManifestFromPool } from '../../test-data/manifestPool';

test.describe('Create New ECL Test', () => {
 
  async function createOwnManifestWithOneBill(
    newImportManPage: NewImportManPage,
    createNewEclPage: CreateNewEclPage,
    newImportManifestData: ReturnType<typeof createNewImportManifestData>,
    masterBillData: ReturnType<typeof createMasterBillData>
  ) {
    const claimed = claimManifestFromPool('normal-bill');
    if (claimed) {
      console.log('Reused pooled manifest reference number:', claimed.referenceNumber);
      return claimed.referenceNumber;
    }

      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await newImportManPage.clickCreateAirImportManifest();
      await newImportManPage.fillManifestForm(newImportManifestData);
      await newImportManPage.clickSaveAndConitnue();

    const { submittedReferenceNumber } = await createNewEclPage.addMasterBillWithHouseBill(
      masterBillData,
      airwayBillData,
      billItemData,
      warehouseData
    );
    console.log('Own manifest reference number:', submittedReferenceNumber);

    await newImportManPage.waitForManifestToReachStatus(submittedReferenceNumber, 'تم استلامها', {
      intervalMs: 5_000,
      timeoutMs: 150_000,
    });

    return submittedReferenceNumber;
  }

  async function createOwnManifestWithTwoBills(
    newImportManPage: NewImportManPage,
    createNewEclPage: CreateNewEclPage,
    newImportManifestData: ReturnType<typeof createNewImportManifestData>,
    masterBillData: ReturnType<typeof createMasterBillData>
  ) {
    const claimed = claimManifestFromPool('multi-bill');
    if (claimed) {
      console.log('Reused pooled multi-bill manifest reference number:', claimed.referenceNumber);
      return claimed.referenceNumber;
    }

    const { submittedReferenceNumber } = await newImportManPage.submitManifestWithMoreThanOneBill(
      createNewEclPage,
      newImportManifestData,
      masterBillData,
      airwayBillData,
      billItemData,
      warehouseData
    );
    console.log('Own multi-bill manifest reference number:', submittedReferenceNumber);

    await newImportManPage.waitForManifestToReachStatus(submittedReferenceNumber, 'تم استلامها', {
      intervalMs: 5_000,
      timeoutMs: 150_000,
    });

    return submittedReferenceNumber;
  }

  //25- Submit All information ECL with changes in header
  test('#25 All information ECL with changes in header', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(600_000);
    const referenceNo = await test.step('Create own manifest with one bill', async () => {
      return createOwnManifestWithOneBill(newImportManPage, createNewEclPage, newImportManifestData, masterBillData);
    });

    await test.step('View manifest header', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });

    // ---- 2) create the ECL and edit the header ----

    await test.step('Create ECL', async () => {
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step('Select ECL type and confirm', async () => {
      await createNewEclPage.selectEclType('1');
      await createNewEclPage.clickChooseEclTypeButton();
    });

    await test.step('Edit flight number (header) and save & continue', async () => {
      const newFlightNumber = `MS111${Date.now().toString().slice(-5)}`;
      await newImportManPage.fillFlightNumber(newFlightNumber);
      await createNewEclPage.clickSaveAndContinueButton();
    });

    //  3) view the ECL letter and submit it

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      await createNewEclPage.openEclLetterRow();
      eclNumber = await createNewEclPage.getOpenedEclNumber();
      console.log('ECL Number:', eclNumber);
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewEclPage.clickEditButton();
      await createNewEclPage.clickSaveAndSubmitEcl();
      await newImportManPage.confirmManifestSubmission();
    });

    // 4) poll the ECL status until مقبول 

    await test.step('Check ECL status every 4 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    //  5) open the manifest to see the change

    await test.step('Open manifest to see the changed data', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  //26 , 27 , 28- Create, View, Submit All information ECL with Updated Existing Bill
  test('#26-28 All information ECL with Updated Existing Bill', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    const referenceNo = await test.step('Create own manifest with one bill', async () => {
      return createOwnManifestWithOneBill(newImportManPage, createNewEclPage, newImportManifestData, masterBillData);
    });

    await test.step('View manifest header', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step('Select ECL type and confirm', async () => {
      await createNewEclPage.selectEclType('1');
      await createNewEclPage.clickChooseEclTypeButton();
    });

    await test.step('Edit master bill weight and save & continue', async () => {
      //the header form shows first; save & continue to reach the master bills step:
      await createNewEclPage.clickSaveAndContinueButton();
      await createNewEclPage.clickEditOnMasterBillIfPresent();
      await createNewEclPage.fillMasterBillWeight('200');
      await createNewEclPage.clickSaveAndContinueButton();
      await createNewEclPage.clickSubmitButton();
      await createNewEclPage.clickSaveAndContinueButton();
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      await createNewEclPage.openEclLetterRow();
      eclNumber = await createNewEclPage.getOpenedEclNumber();
      console.log('ECL Number:', eclNumber);
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewEclPage.clickEditButton();
      await createNewEclPage.clickSaveAndSubmitEcl();
      await newImportManPage.confirmManifestSubmission();
    });

    await test.step('Check ECL status every 4 seconds', async () => {
      const eclAccepted = await createNewEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('View manifest again to see the changed data', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  //29,30,31,32 - Create, View,Edit, Submit All information ECL with Deleted Existing Bill
  test('#29-32 All information ECL with Deleted Existing Bill', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    const referenceNo = await test.step('Create own manifest with two bills', async () => {
      return createOwnManifestWithTwoBills(newImportManPage, createNewEclPage, newImportManifestData, masterBillData);
    });

    let billCount = 2;

    await test.step('View manifest header', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('#29-Create All information ECL with Deleted Existing Bill', async () => {
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
      await createNewEclPage.selectEclType('1');
      await createNewEclPage.clickChooseEclTypeButton(); 
      await newImportManPage.fillTotalNumberOfBills((billCount - 1).toString());
      await createNewEclPage.clickSaveAndContinueButton();

      await test.step('Delete a master bill and save & continue', async () => {
        await createNewEclPage.clickDeleteOnMasterBillIfPresent();
        await createNewEclPage.clickSaveAndContinueButton();
        billCount -= 1;
      });
    });

    let eclNumber = '';

    await test.step('#30- View All information ECL with Deleted Existing Bill', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      await createNewEclPage.openEclLetterRow();
      eclNumber = await createNewEclPage.getOpenedEclNumber();
      console.log('ECL Number:', eclNumber);
    });

    await test.step('#31-Edit All information ECL with Deleted Existing Bill', async () => {
      await createNewEclPage.clickEditButton();
      await createNewEclPage.clickSaveAndContinueButton();
      await createNewEclPage.clickSaveAndContinueButton(); 
    });

    await test.step('#32-Submit All information ECL with Deleted Existing Bill', async () => {
      await createNewEclPage.clickSubmitButton();
      await newImportManPage.closeBlockingModalIfPresent();
    });

    await test.step('Check ECL status every 4 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the changed data', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  //33,34,35,36 - Create, View, Submit All information ECL with adding new completed Normal Bill
  test('#33-36 All information ECL with adding new completed Normal Bill', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    const referenceNo = await test.step('Create own manifest with one bill', async () => {
      return createOwnManifestWithOneBill(newImportManPage, createNewEclPage, newImportManifestData, masterBillData);
    });
    let billCount = 1;

    await test.step('View manifest header', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('#33- Create All information ECL with adding new completed Normal Bill', async () => {
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
      await createNewEclPage.selectEclType('1');
      await createNewEclPage.clickChooseEclTypeButton();
      billCount += 1;
      await newImportManPage.fillTotalNumberOfBills(billCount.toString());
      await createNewEclPage.clickSaveAndContinueButton();    
      const ownMasterBillData = createMasterBillData();
      await createNewEclPage.createMasterBill(ownMasterBillData);
      await createNewEclPage.addHouseBill(airwayBillData, billItemData, warehouseData, ownMasterBillData.billNo);
    });

    let eclNumber = '';

    await test.step('#34- Create All information ECL with adding new completed Normal Bill', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      await createNewEclPage.openEclLetterRow();
      eclNumber = await createNewEclPage.getOpenedEclNumber();
      console.log('ECL Number:', eclNumber);
    });

    await test.step('#35 - Edit All information ECL with adding new completed Normal Bill', async () => {
      await createNewEclPage.clickEditButton();
      await createNewEclPage.clickSaveAndContinueButton(); // header -> master bills
      await createNewEclPage.clickSaveAndContinueButton(); // master bills -> house bill
    });

    await test.step('#36 - Submit All information ECL with adding new completed Normal Bill', async () => {
      await createNewEclPage.clickSubmitButton();
      await newImportManPage.closeBlockingModalIfPresent();
    });

    await test.step('Check ECL status every 4 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the changed data', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  //37 - Create , View ,Submit All information ECL with adding new Waiting Normal Bill
  test('#37 All information ECL with adding new Waiting Normal Bill', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    const referenceNo = await test.step('Create own manifest with one bill', async () => {
      return createOwnManifestWithOneBill(newImportManPage, createNewEclPage, newImportManifestData, masterBillData);
    });
    let billCount = 1;

    await test.step('View manifest header', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('#37- Create All information ECL with adding new Waiting Normal Bill', async () => {
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
      await createNewEclPage.selectEclType('1');
      await createNewEclPage.clickChooseEclTypeButton();
      billCount += 1;
      await newImportManPage.fillTotalNumberOfBills(billCount.toString());
      await createNewEclPage.clickSaveAndContinueButton();
    });

    const ownMasterBillData = createMasterBillData();

    await test.step('Add a new master bill with a partial (waiting) house bill', async () => {
      const partialWeight = (parseFloat(ownMasterBillData.totalOriginalWeight) / 2).toString();
      const partialArrivalAirwayBillData = {
        deliveredWeight: partialWeight,
        deliveredQuantity: billItemData.itemQuantity,
        manifestType: '1',
      };
      const partialArrivalBillItemData = {
        ...billItemData,
        itemWeight: partialWeight,
      };

      await createNewEclPage.createMasterBill(ownMasterBillData);
      await createNewEclPage.addHouseBill(
        partialArrivalAirwayBillData,
        partialArrivalBillItemData,
        warehouseData,
        ownMasterBillData.billNo
      );
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      await createNewEclPage.openEclLetterRow();
      eclNumber = await createNewEclPage.getOpenedEclNumber();
      console.log('ECL Number:', eclNumber);
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewEclPage.clickEditButton();
      await createNewEclPage.clickSaveAndContinueButton(); 
      await createNewEclPage.clickSaveAndContinueButton(); 
    });
    await test.step('Submit the ECL', async () => {
      await createNewEclPage.clickSubmitButton();
      await newImportManPage.closeBlockingModalIfPresent();
    });

    await test.step('Check ECL status every 4 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the changed data', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  //38 - Submit All information ECL with adding new Transit  Bill
  test('#38 create new ECL adding a transit master bill', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    const referenceNo = await test.step('Create own manifest with one bill', async () => {
      return createOwnManifestWithOneBill(newImportManPage, createNewEclPage, newImportManifestData, masterBillData);
    });
    let billCount = 1;

    await test.step('View manifest header', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('#38 - Create All information ECL with adding new Transit  Bill', async () => {
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
      await createNewEclPage.selectEclType('1');
      await createNewEclPage.clickChooseEclTypeButton();
      billCount += 1;
      await newImportManPage.fillTotalNumberOfBills(billCount.toString());
      await createNewEclPage.clickSaveAndContinueButton();
    });

    await test.step('Add a new, transit master bill with its own house bill', async () => {
      const transitMasterBillData = createMasterBillData();
      transitMasterBillData.billType = '3';

      await createNewEclPage.createMasterBill(transitMasterBillData);
      await createNewEclPage.addHouseBill(airwayBillData, billItemData, warehouseData, transitMasterBillData.billNo);
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      await createNewEclPage.openEclLetterRow();
      eclNumber = await createNewEclPage.getOpenedEclNumber();
      console.log('ECL Number:', eclNumber);
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewEclPage.clickEditButton();
      await createNewEclPage.clickSaveAndContinueButton();
      await createNewEclPage.clickSaveAndContinueButton(); 
    });
    await test.step('Submit the ECL', async () => {
      await createNewEclPage.clickSubmitButton();
      await newImportManPage.closeBlockingModalIfPresent();
    });

    await test.step('Check ECL status every 4 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the changed data', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  //39 - Add Bills to Waiting Manifest
  test('#39- Add Bills to Waiting Manifest', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    let referenceNo = '';

    await test.step('Create header-only manifest and submit directly', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await newImportManPage.clickCreateAirImportManifest();

      await newImportManPage.fillManifestForm({ ...newImportManifestData, totalNumberOfBills: '1' });
      await newImportManPage.clickSaveAndSubmit();
      await newImportManPage.verifyManifestSubmittedSuccessfully();

      referenceNo = await newImportManPage.getReferenceNumber();
      console.log('Reference Number:', referenceNo);
    });
    await test.step('Wait for manifest status to become انتظار اكتمال المعلومات', async () => {
      await newImportManPage.waitForManifestToReachStatus(referenceNo, 'انتظار اكتمال المعلومات');
    });

    await test.step('View manifest header', async () => {
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step('Select ECL type and confirm', async () => {
      await createNewEclPage.selectEclType('1');
      await createNewEclPage.clickChooseEclTypeButton();
    });

    await test.step('Save & continue from header (total bills already 1)', async () => {
      await createNewEclPage.clickSaveAndContinueButton();
    });

    await test.step('Add the first master bill with its own house bill', async () => {
      await createNewEclPage.createMasterBill(masterBillData);
      await createNewEclPage.addHouseBill(airwayBillData, billItemData, warehouseData, masterBillData.billNo);
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      await createNewEclPage.openEclLetterRow();
      eclNumber = await createNewEclPage.getOpenedEclNumber();
      console.log('ECL Number:', eclNumber);
    });

    await test.step('Save and submit the ECL', async () => {

      await createNewEclPage.clickEditButton();
      await createNewEclPage.clickSaveAndContinueButton(); 
      await createNewEclPage.clickSaveAndContinueButton(); 
      await createNewEclPage.clickSubmitButton();
      await newImportManPage.closeBlockingModalIfPresent();
    });

    await test.step('Check ECL status every 4 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the changed data', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  //40,41,42,43 Create All information ECL with Header Update, MAWB Add/Update/Delete, Arrived Bill Add/Update/Delete, Item Add/Update/Delete, and Warehouse Add/Update/Delete
  //KNOWN FLAKY SPOT (as of 2026-09-26): this is the longest/most complex test in the ECL suite (multiple master
  //bill add/edit/delete rounds plus item/warehouse CRUD), so it's usually the first place a portal-side
  //session/timing issue surfaces on a long run - specifically inside the "House bill update + item/warehouse
  //add, update, delete" step below, hanging on fillBillItemForm()'s package-type dropdown for the full 20-minute
  //test timeout before the browser gets force-closed. Root causes found and fixed so far at this exact spot:
  //(1) a "انتهاء وقت الجلسة" session-continue dialog going unhandled - fixed via
  //ViewManifestPage.continueSessionIfPrompted(); (2) item/warehouse quantity data not summing to match the
  //master bill's declared quantity - fixed in this test's own data; (3) a 2nd item/warehouse row sometimes not
  //committing to the grid on the first "إضافة" click - fixed via the retry in clickAddAirwayBillModalButton().
  //A 4th attempt added a fail-fast check for the session having logged out entirely (back on the bare login
  //page), but that check gave false positives on perfectly healthy pages (caught by a race with an SPA route
  //transition) and was reverted. If this hangs again, check the failure screenshot first - the fix depends
  //entirely on what's actually on screen (dialog vs. login page vs. something new), guessing at another
  //speculative fix without that evidence has cost real time twice already:
  test('#40-43 All information ECL with header, MAWB, house bill, item, and warehouse changes', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(1_200_000);

    let referenceNo = '';

    await test.step('Create full import manifest with two master bills', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await newImportManPage.clickCreateAirImportManifest();

      await newImportManPage.fillManifestForm({ ...newImportManifestData, totalNumberOfBills: '2' });
      await newImportManPage.clickSaveAndConitnue();

      const secondMasterBillData = {
        ...masterBillData,
        billNo: (parseInt(masterBillData.billNo, 10) + 1).toString(),
      };
      const firstMasterBillData = { ...masterBillData, totalOriginalQuantity: '2' };

      await createNewEclPage.createTwoMasterBill(firstMasterBillData);
      await createNewEclPage.createMasterBill(secondMasterBillData);
      await createNewEclPage.addHouseBillWithTwoItems(
        { ...airwayBillData, deliveredQuantity: '2' },
        { ...billItemData, itemWeight: '50', itemQuantity: '1' },
        { ...billItemData, itemWeight: '50', itemQuantity: '1' },
        { ...warehouseData, warehouseCode: 'WH1', warehouseQuantity: '1' },
        { ...warehouseData, warehouseCode: 'WH2', warehouseQuantity: '1' },
        firstMasterBillData.billNo
      );
      await createNewEclPage.addHouseBill(airwayBillData, billItemData, warehouseData, secondMasterBillData.billNo);
      const { submittedReferenceNumber } = await createNewEclPage.submitManifest();
      referenceNo = submittedReferenceNumber;
      console.log('Reference Number:', referenceNo);
    });

    await test.step('Wait for manifest status to become تم استلامها', async () => {
      await newImportManPage.waitForManifestToReachStatus(referenceNo, 'تم استلامها');
    });

    await test.step('View manifest header', async () => {
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('#40 -Create ECL with all actions', async () => {
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
      await createNewEclPage.selectEclType('1');
      await createNewEclPage.clickChooseEclTypeButton();
    });

    await test.step('#Header update: edit flight number and save & continue', async () => {
      const newFlightNumber = `MS222${Date.now().toString().slice(-5)}`;
      await newImportManPage.fillFlightNumber(newFlightNumber);
      await createNewEclPage.clickSaveAndContinueButton();
    });

    await test.step('MAWB update: edit the first master bill\'s weight', async () => {
      await createNewEclPage.clickEditOnMasterBillIfPresent();
      await createNewEclPage.fillMasterBillWeight('250');
      await createNewEclPage.clickSaveAndContinueButton();
      await createNewEclPage.fillMasterBillPaymentMethod(masterBillData.paymentMethod);
      await createNewEclPage.clickSubmitButton();
    });

    await test.step('MAWB delete: remove the second master bill', async () => {
      await createNewEclPage.clickDeleteOnMasterBillIfPresent();
    });

    const thirdMasterBillData = {
      ...masterBillData,
      billNo: (parseInt(masterBillData.billNo, 10) + 2).toString(),
      totalOriginalQuantity: '2',
    };

    await test.step('MAWB add: create a new (third) master bill with its own house bill', async () => {
      await createNewEclPage.createMasterBill(thirdMasterBillData);
      await createNewEclPage.addHouseBillWithTwoItems(
        { ...airwayBillData, deliveredQuantity: '2' },
        { ...billItemData, itemWeight: '50', itemQuantity: '1' },
        { ...billItemData, itemWeight: '50', itemQuantity: '1' },
        { ...warehouseData, warehouseCode: 'WH1', warehouseQuantity: '1' },
        { ...warehouseData, warehouseCode: 'WH2', warehouseQuantity: '1' },
        thirdMasterBillData.billNo
      );
    });

    await test.step('House bill update + item/warehouse add, update, delete', async () => {
      await createNewEclPage.clickEditOnArrivedBill();
      await createNewEclPage.fillAirwayBillForm({ ...airwayBillData, manifestType: '5', deliveredQuantity: '2' });
      await createNewEclPage.clickSaveAndContinueButton();
      await createNewEclPage.clickDeleteItemButton();
      await createNewEclPage.fillBillItemForm({ ...billItemData, itemWeight: '75', itemQuantity: '1' });
      await createNewEclPage.clickAddAirwayBillModalButton();
      await createNewEclPage.clickEditItemButton();
      await createNewEclPage.fillBillItemForm({ ...billItemData, itemWeight: '50', itemQuantity: '1' });
      await createNewEclPage.clickSaveAndContinueButton();
      await createNewEclPage.clickDeleteWarehouseButton();
      await createNewEclPage.fillWarehouseForm({ ...warehouseData, warehouseCode: 'WH3', warehouseQuantity: '2' });
      await createNewEclPage.clickAddAirwayBillModalButton();
      await createNewEclPage.clickEditWarehouseGridButton();
      await createNewEclPage.fillWarehouseForm({ ...warehouseData, warehouseCode: 'ECLWH1', warehouseQuantity: '1' });
      await createNewEclPage.clickSubmitButton();
    });

    let eclNumber = '';

    await test.step('41 - View ECL with all actions', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      eclNumber = await createNewEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewEclPage.openEclLetterRow();
    });

    await test.step('#42- Edit ECL with all actions', async () => {
      await createNewEclPage.clickEditButton();
      await createNewEclPage.clickSaveAndContinueButton(); 
      await createNewEclPage.clickSaveAndContinueButton();
    });
    
    await test.step('#43- Submit ECL with all actions', async () => {
      await createNewEclPage.clickSubmitButton();
      await newImportManPage.closeBlockingModalIfPresent();
    });

    await test.step('Check ECL status every 4 seconds until مقبول (up to 3 minutes)', async () => {
      const eclAccepted = await createNewEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 180_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the changed data', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });
  
  //44,45,46,47 - Create,View ,Edit ,Submit "Edit owner information" ECL
  test('#44-47 create new ECL updating owner information', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    const referenceNo = await test.step('Create own manifest with one bill', async () => {
      return createOwnManifestWithOneBill(newImportManPage, createNewEclPage, newImportManifestData, masterBillData);
    });

    await test.step('View manifest header', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('#44 - Create ECL for updating owner information', async () => {
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
      await createNewEclPage.selectEclType('2');
      await createNewEclPage.clickChooseEclTypeButton();
    });

    await test.step(' Edit owner name (English and Arabic) and save', async () => {
      await createNewEclPage.clickEditOwnerInfoButton();
      await createNewEclPage.fillOwnerNameEnglish('Owner test ECL');
      await createNewEclPage.fillOwnerNameArabic('مالك اختبار الخطاب');
      await createNewEclPage.clickSaveOnlyButton();
      await newImportManPage.closeAllBlockingModals();
    });

    let eclNumber = '';

    await test.step('#45 -View ECL for updating owner information', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      eclNumber = await createNewEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewEclPage.openEclLetterRow();
    });

    await test.step('#46 - Edit ECL for updating owner information', async () => {
      await createNewEclPage.clickEditButton();
      await createNewEclPage.clickEditOwnerInfoButton();
    });
    await test.step('#47 - Submit ECL for updating owner information', async () => {
      await createNewEclPage.clickSubmitRequestButton();
      await newImportManPage.closeAllBlockingModals();
    });

    await test.step('Check ECL status every 4 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest and view the updated bill\'s details', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickMasterBillDetailsButton();
    });
  });

  //48 - Create, View, Submit "Edit Warehouse information" ECL - Edit one warehouse 
  test('#48 create new ECL updating warehouse information', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    const referenceNo = await test.step('Create own manifest with one bill', async () => {
      return createOwnManifestWithOneBill(newImportManPage, createNewEclPage, newImportManifestData, masterBillData);
    });

    await test.step('View manifest header', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('#48 - Create ECL for updating warehouse information', async () => {
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
      await createNewEclPage.selectEclType('3');
      await createNewEclPage.clickChooseEclTypeButton();
    });

    await test.step('#49 - Edit warehouse information', async () => {
      await createNewEclPage.clickEditWarehousesButton();
      await createNewEclPage.clickEditWarehouseRowButton();
      await createNewEclPage.fillNewWarehouseCode('ECLWH1');
      await createNewEclPage.clickSaveOnlyButton();
      await newImportManPage.closeAllBlockingModals();
    });

    await test.step('Submit the ECL request', async () => {
      await createNewEclPage.clickSubmitRequestButton();
      await newImportManPage.closeAllBlockingModals();
    });

    let eclNumber = '';

    await test.step('View manifest again and read the ECL number', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      eclNumber = await createNewEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
    });

    await test.step('Check ECL status every 4 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest and view the house bill\'s warehouse details', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickBillsTab();
      await createNewEclPage.openHouseBillDetails();
      await createNewEclPage.clickWarehouseTabInDetails();
    });
  });

  //49,50,51,52 - Create, view, Submit "Edit Warehouse information" ECL - Edit more than one warehouse
  test('#49-52 create new ECL updating two warehouses', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    const referenceNo = await test.step('Create own manifest with one bill', async () => {
      return createOwnManifestWithOneBill(newImportManPage, createNewEclPage, newImportManifestData, masterBillData);
    });

    let billCount = 1;
    await test.step('Add own bill (with two warehouses) to the manifest via ECL', async () => {
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
      await createNewEclPage.selectEclType('1');
      await createNewEclPage.clickChooseEclTypeButton();

      billCount += 1;
      await newImportManPage.fillTotalNumberOfBills(billCount.toString());
      await createNewEclPage.clickSaveAndContinueButton();
      const twoWarehouseMasterBillData = { ...createMasterBillData(), totalOriginalQuantity: '2' };
      const twoWarehouseAirwayBillData = { ...airwayBillData, deliveredQuantity: '2' };
      const twoWarehouseBillItemData = { ...billItemData, itemQuantity: '2' };
      const firstWarehouseData = { ...warehouseData, warehouseCode: 'WH1', warehouseQuantity: '1' };
      const secondWarehouseData = { ...warehouseData, warehouseCode: 'WH2', warehouseQuantity: '1' };

      await createNewEclPage.createMasterBill(twoWarehouseMasterBillData);
      await createNewEclPage.addHouseBillWithTwoWarehouses(
        twoWarehouseAirwayBillData,
        twoWarehouseBillItemData,
        firstWarehouseData,
        secondWarehouseData
      );

      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      await createNewEclPage.openEclLetterRow();
      const setupEclNumber = await createNewEclPage.getOpenedEclNumber();

      await createNewEclPage.clickEditButton();
      await createNewEclPage.clickSaveAndContinueButton();
      await createNewEclPage.clickSaveAndContinueButton();
      await createNewEclPage.clickSubmitButton();
      await newImportManPage.closeBlockingModalIfPresent();

      const setupAccepted = await createNewEclPage.waitForEclStatus(
        setupEclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );
      if (!setupAccepted) {
        throw new Error(`Setup ECL adding the two-warehouse bill to ${referenceNo} was not accepted in time`);
      }
    });

    await test.step('View manifest header', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('#49 - Create ECL for updating warehouse information', async () => {
      await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
      await createNewEclPage.selectEclType('3');
      await createNewEclPage.clickChooseEclTypeButton();
    });

    await test.step('#51 - Edit both warehouse codes and save each', async () => {
      await createNewEclPage.clickEditWarehousesButton();

      await createNewEclPage.clickEditWarehouseRowButton();
      await createNewEclPage.fillNewWarehouseCode('ECLWH1');
      await createNewEclPage.clickSaveOnlyButton();

      await createNewEclPage.clickEditWarehouseRowButton();
      await createNewEclPage.fillNewWarehouseCode('ECLWH2');
      await createNewEclPage.clickSaveOnlyButton();

      //close the row-edit form and the "تعديل المستودعات" list modal underneath it:
      await newImportManPage.closeAllBlockingModals();
    });

    await test.step('#52 - Submit the ECL request', async () => {
      await createNewEclPage.clickSubmitRequestButton();
      await newImportManPage.closeAllBlockingModals();
    });

    let eclNumber = '';

    await test.step('#50 - View manifest again and read the ECL number', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickEclHistoryTab();
      eclNumber = await createNewEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
    });

    await test.step('Check ECL status every 4 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newImportManPage.clickAirServices();
          await newImportManPage.clickAirImportManifest();
          await createNewEclPage.searchByReferenceNumber(referenceNo);
          await createNewEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest and view the house bill\'s warehouse details', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await createNewEclPage.searchByReferenceNumber(referenceNo);
      await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewEclPage.clickBillsTab();
      await createNewEclPage.openHouseBillDetails();
      await createNewEclPage.clickWarehouseTabInDetails();
    });
  });
});
