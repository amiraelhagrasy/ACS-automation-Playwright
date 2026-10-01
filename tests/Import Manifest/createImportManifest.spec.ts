import { test } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { addManifestToPool, claimManifestFromPool } from '../../test-data/manifestPool';

test.describe('Create New Import Manifest Test', () => {



  //1,2,3,4 - Create, View, Edit, and Submit Import Manifest with header only:
  test('#1-4 create, view, edit, and submit import manifest with header only', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData }) => {
    test.setTimeout(300_000);

    let referenceNumber = '';

    await test.step('#1 - Save Import Manifest with header only as Draft', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await newImportManPage.clickCreateAirImportManifest();
      await newImportManPage.fillManifestForm(newImportManifestData);
      await newImportManPage.clickSaveAndSubmitDraft();
      referenceNumber = await newImportManPage.getReferenceNumberDraft();
      console.log('Reference Number:', referenceNumber);
    });

    await test.step('#2 - View Import Manifest with header', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNumber);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNumber);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNumber);
    });

    await test.step('#3 - Edit Import Manifest with header', async () => {
      await viewImportManifestPage.clickEditButton();
      await newImportManPage.fillFlightNumber(newImportManifestData.flightNumber);
      await newImportManPage.clickSaveAndSubmit();
    });

    await test.step('#4 - Wait for manifest status to become انتظار اكتمال المعلومات', async () => {
      await newImportManPage.waitForManifestToReachStatus(referenceNumber, 'انتظار اكتمال المعلومات');
    });
    console.log('Submitted Reference Number:', referenceNumber);
    addManifestToPool('header-only', referenceNumber, '');
  });

  //5-8 - Import Manifest with one Completed Normal Import Bill:
  test('#5-8 create new Import Manifest with one Completed Normal Import Bill', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
  test.setTimeout(300_000);
  await newImportManPage.clickAirServices();
  await newImportManPage.clickAirImportManifest();
  await newImportManPage.clickCreateAirImportManifest();

  let referenceNo = '';
  let submittedMessageId = '';
  //5 - Save Import Manifest with one Completed Normal Import Bill
  await test.step('#5 - Save Import Manifest with one Completed Normal Import Bill', async () => {
    await newImportManPage.fillManifestForm(newImportManifestData);
    await newImportManPage.clickSaveAndConitnue();

    referenceNo = await newImportManPage.saveMasterBillWithHouseBill(
      viewImportManifestPage,
      masterBillData,
      airwayBillData,
      billItemData,
      warehouseData
    );
  });

  //6 - View Import Manifest with one Completed Normal Import Bill:
  await test.step('#6 - View Import Manifest with one Completed Normal Import Bill', async () => {
    await newImportManPage.clickAirServices();
    await newImportManPage.clickAirImportManifest();
    await viewImportManifestPage.searchByReferenceNumber(referenceNo);
    await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
    await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
    await viewImportManifestPage.openAllArrivedBillsDetails();
    await viewImportManifestPage.clickHistoryTab();
    await viewImportManifestPage.clickEclHistoryTab();
  });

  //7 - Edit Import Manifest with one Completed Normal Import Bill:
  await test.step('#7 - Edit Import Manifest with one Completed Normal Import Bill', async () => {
    await viewImportManifestPage.clickEditButton();
    await newImportManPage.fillFlightNumber(newImportManifestData.flightNumber);
    await viewImportManifestPage.clickSaveAndContinueButton();
  });

  //8 - Submit Import Manifest with one Completed Normal  Import Bill:
  await test.step('#8 - Submit Import Manifest with one Completed Normal  Import Bill', async () => {
    //#7's edit only advances the edit wizard to its own step-2 (master bills list) screen, which has its own
    //"حفظ واستمرار" button, not "تقديم الطلب" - same extra click #19-22's #22 step needs before submitManifest():
    await viewImportManifestPage.clickSaveAndContinueButton();
    await viewImportManifestPage.clickSubmitButton();
    //captures the message id off the same success alert submitManifest() reads, so this manifest can be
    //donated to the pool below once its status is confirmed:
    await viewImportManifestPage.verifyManifestSubmittedWithBillsSuccessfully();
    submittedMessageId = await viewImportManifestPage.getSubmittedMessageId();
  });

  //checks the manifest's status every 5 seconds (up to 2 minutes total) until it becomes "تم استلامها" (Received):
  await test.step('Wait for manifest status to become تم استلامها', async () => {
    await newImportManPage.waitForManifestToReachStatus(referenceNo, 'تم استلامها');
  });

  //logged so generate-test-case-report.js can surface them in the HTML report (it extracts these exact labels
  //from each test's captured console output):
  console.log('Submitted Reference Number:', referenceNo);
  console.log('Submitted Message Id:', submittedMessageId);

  //donates this manifest to the pool so createNewImportECL.spec.ts's createOwnManifestWithOneBill() can reuse
  //it instead of building the same one-master-bill-plus-house-bill shape from scratch:
  addManifestToPool('normal-bill', referenceNo, submittedMessageId);
  });

  //#9- Submit Import Manifest with one Normal Waiting Import Bill:
  test('#9- Submit Import Manifest with one Normal Waiting  Import Bill', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    let referenceNo = '';

    await newImportManPage.clickAirServices();
    await newImportManPage.clickAirImportManifest();
    await newImportManPage.clickCreateAirImportManifest();
    await newImportManPage.fillManifestForm(newImportManifestData);
    await newImportManPage.clickSaveAndConitnue();
    const { submittedReferenceNumber } = await newImportManPage.addMasterBillWithPartialArrival(
      viewImportManifestPage,
      masterBillData,
      billItemData,
      warehouseData
    );
    referenceNo = submittedReferenceNumber;

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
    });

  //10-13- Import Manifest with one Completed Express mail  Import Bill
  test('#10-13 create new import manifest full with express mail agent', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    await newImportManPage.clickAirServices();
    await newImportManPage.clickAirImportManifest();
    await newImportManPage.clickCreateAirImportManifest();

    let referenceNo = '';
    await test.step('#10 - Save Import Manifest with one Completed Express mail Import Bill ', async () => {
      await newImportManPage.fillManifestFormWithExpressMailAgent(newImportManifestData);
      await newImportManPage.clickSaveAndConitnue();
      referenceNo = await newImportManPage.saveMasterBillWithHouseBill(
        viewImportManifestPage,
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );
      console.log('Import Manifest Reference Number:', referenceNo);
      console.log('Master Bill Number:', masterBillData.billNo);
      console.log('Master Bill Date:', masterBillData.billDate);
      console.log('Port (المنفذ):', newImportManifestData.finalAirportText);
      console.log('Carrier (شركة النقل):', masterBillData.transportCompany);
    });

    await test.step('#11 - View Import Manifest with one Completed Express mail Import Bill', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNo);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
      await viewImportManifestPage.openAllArrivedBillsDetails();
      await viewImportManifestPage.clickHistoryTab();
      await viewImportManifestPage.clickEclHistoryTab();
    });

    await test.step('#12 - Edit Import Manifest with one Completed Express mail Import Bill', async () => {
      await viewImportManifestPage.clickEditButton();
      await newImportManPage.fillFlightNumber(newImportManifestData.flightNumber);
      await viewImportManifestPage.clickSaveAndContinueButton();
    });

    await test.step('#13 - Submit Import Manifest with one Completed Express mail Import Bill', async () => {
      await viewImportManifestPage.clickSaveAndContinueButton();
      await viewImportManifestPage.clickSubmitButton();
    });
  });

  //14 - Submit Import Manifest with one Express mail Waiting Import Bill :
  test('#14 Submit Import Manifest with one Express mail Waiting Import Bill', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    await newImportManPage.clickAirServices();
    await newImportManPage.clickAirImportManifest();
    await newImportManPage.clickCreateAirImportManifest();

    let referenceNo = '';

    await test.step('#14 - Fill manifest with Express Mail agent and add master bill with partial arrival', async () => {
      await newImportManPage.fillManifestFormWithExpressMailAgent(newImportManifestData);
      await newImportManPage.clickSaveAndConitnue();

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
  });

  //15-18 - Save, View, Edit ,submit Import Manifest with one Completed Transit Bill:
  test('#15-18 Save, View, Edit, and Submit Import Manifest with one Completed Transit Bill', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(300_000);
    let referenceNo = '';
    await test.step('#15 - Save import manifest with one Completed Transit Bill', async () => {
      referenceNo = await newImportManPage.saveImportManifestWithOneCompletedTransitBill(
      viewImportManifestPage,
      newImportManifestData,
      masterBillData,
      airwayBillData,
      billItemData,
      warehouseData
    );
    console.log('Reference Number:', referenceNo);
    });

  //16 - View Import Manifest with one Completed Transit Bill:
    await test.step('#16 - View import manifest with one Completed Transit Bill', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNo);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
    });
  //17 - Edit Import Manifest with one Completed Transit Bill:
    await test.step('#17 - Edit Import Manifest with one Completed Transit Bill', async () => {
      await viewImportManifestPage.clickEditButton();
      await newImportManPage.fillFlightNumber(newImportManifestData.flightNumber);
      await viewImportManifestPage.clickSaveAndContinueButton();
    });
    //18 - Submit Import Manifest with one Completed Transit Bill:
    await test.step('#18 - Submit Import Manifest with one Completed Transit Bill', async () => {
      await viewImportManifestPage.clickSaveAndContinueButton();
      const { submittedReferenceNumber } = await viewImportManifestPage.submitManifest();
      referenceNo = submittedReferenceNumber;
    });

    //checks the manifest's status every 5 seconds (up to 2 minutes total) until it becomes "تم استلامها" (Received):
    await test.step('Wait for manifest status to become تم استلامها', async () => {
      await newImportManPage.waitForManifestToReachStatus(referenceNo, 'تم استلامها');
    });

  //View created import manifest after submission with one Completed Transit Bill:
    await test.step('View created import manifest', async () => {
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
      await viewImportManifestPage.openAllArrivedBillsDetails();
      await viewImportManifestPage.clickHistoryTab();
      await viewImportManifestPage.clickEclHistoryTab();
    });
  });

  //19-22 - Save ,view, Edit  Manifest with more than one Bill:
  test('#19-22 Save ,view, Edit  Manifest with more than one Bill', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);
    let referenceNo = '';
    //19 - Save import manifest with more than one Bill:
    await test.step('#19 - Save import manifest with more than one Bill', async () => {
      referenceNo = await newImportManPage.saveManifestWithMoreThanOneBill(
        viewImportManifestPage,
        newImportManifestData,
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );
    console.log('Reference Number:', referenceNo);
    });
    //20 - View Import Manifest with more than one Bill:
    await test.step('#20 - View created import manifest', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNo);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
    });
    //21- Edit Manifest with more than one Bill:
    await test.step('#21 - Edit created import manifest', async () => {
      await viewImportManifestPage.clickEditButton();
      await newImportManPage.fillFlightNumber(newImportManifestData.flightNumber);
      await viewImportManifestPage.clickSaveAndContinueButton();
      await viewImportManifestPage.editAndSaveAllMasterBills();
    });
    //22 - Submit Manifest with more than one Bill:
    let submittedMessageId = '';
    await test.step('#22 - SubmitManifest with more than one Bill', async () => {
      await viewImportManifestPage.clickSaveAndContinueButton();
      const { submittedReferenceNumber, submittedMessageId: msgId } = await viewImportManifestPage.submitManifest();
      referenceNo = submittedReferenceNumber;
      submittedMessageId = msgId;
    });

    await test.step('Wait for manifest status to become تم استلامها', async () => {
      await newImportManPage.waitForManifestToReachStatus(referenceNo, 'تم استلامها');
    });

    //View created import manifest after submission with more than one bill:
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
    addManifestToPool('multi-bill', referenceNo, submittedMessageId);
  });

  // This will create a new import manifest with one bill to give it to the ECL test to use, in case of any issues with the manifest created in 5-8 test.
  test('should wait for import manifest to be accepted then view it', async ({ page, newImportManPage, viewImportManifestPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(300_000);

    let submittedReferenceNumber = '';
    await test.step('Create own manifest with one bill', async () => {
      //#5-8 (earlier in this same file) already donates this exact one-master-bill-plus-house-bill shape,
      //already accepted ("تم استلامها") - reuse it instead of duplicating that whole build+submit flow again:
      const claimed = claimManifestFromPool('normal-bill');
      if (claimed) {
        console.log('Reused pooled manifest reference number:', claimed.referenceNumber);
        submittedReferenceNumber = claimed.referenceNumber;
        return;
      }

      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await newImportManPage.clickCreateAirImportManifest();
      await newImportManPage.fillManifestForm(newImportManifestData);
      await newImportManPage.clickSaveAndConitnue();

      submittedReferenceNumber = await newImportManPage.saveMasterBillWithHouseBill(
        viewImportManifestPage,
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );

      await viewImportManifestPage.clickEditButton();
      await newImportManPage.fillFlightNumber(newImportManifestData.flightNumber);
      await viewImportManifestPage.clickSaveAndContinueButton();
      await viewImportManifestPage.clickSaveAndContinueButton();
      await viewImportManifestPage.clickSubmitButton();
      await viewImportManifestPage.verifyManifestSubmittedWithBillsSuccessfully();
    });

    await test.step('Wait for manifest status to become تم استلامها', async () => {
      await newImportManPage.waitForManifestToReachStatus(submittedReferenceNumber, 'تم استلامها');
    });

    await test.step('View accepted manifest', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(submittedReferenceNumber);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(submittedReferenceNumber);
      await viewImportManifestPage.openManifestByReferenceNumber(submittedReferenceNumber);
      await viewImportManifestPage.openAllArrivedBillsDetails();
      await viewImportManifestPage.clickHistoryTab();
      await viewImportManifestPage.clickEclHistoryTab();
    });
  });
});
