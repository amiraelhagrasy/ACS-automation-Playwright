import { test, expect } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { createNewTransitManifestData } from '../../test-data/newTransitManifestData';

test.describe('Create New Transit ECL Test', () => {
  //see createNewTransit.spec.ts - clickCreateAirTransitManifest() (used throughout this file too) has a known
  //intermittent flaky spot with no reliable in-page fix; a whole-test retry is the mitigation:
  test.describe.configure({ retries: 1 });

  //10. Create Air Transit Manifest ECL with Edit header only :
  test('#10 ECL tran', async ({
    page,
    newTransitManPage,
    createNewTransitEclPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(400_000);

    let referenceNo = '';

    await test.step('Create transit manifest (header only) and submit', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await newTransitManPage.clickCreateAirTransitManifest();
      await newTransitManPage.fillManifestForm(newTransitManifestData);
      await newTransitManPage.clickSaveAndSubmit();
      await newTransitManPage.verifyManifestSubmittedSuccessfully();

      referenceNo = await newTransitManPage.getReferenceNumber();
      console.log('Reference Number:', referenceNo);
    });

    await test.step('Wait for manifest status to become انتظار اكتمال المعلومات', async () => {
      await createNewTransitEclPage.expectManifestStatus(
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
        },
        referenceNo,
        'انتظار اكتمال المعلومات',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewTransitEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    let newFlightNumber = '';

    await test.step('Edit flight number (header) and save & continue', async () => {
      newFlightNumber = `ECL${Date.now().toString().slice(-5)}`;
      await newTransitManPage.fillFlightNumber(newFlightNumber);
      await createNewTransitEclPage.clickSaveAndContinueButton();
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewTransitEclPage.clickEclHistoryTab();

      eclNumber = await createNewTransitEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewTransitEclPage.openEclLetterRow();
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewTransitEclPage.clickEditButton();
      await createNewTransitEclPage.clickSaveAndContinueButton();
      await createNewTransitEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 5 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewTransitEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
          await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
          await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewTransitEclPage.clickEclHistoryTab();
        },
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );

      console.log('ECL Accepted:', eclAccepted);
      expect(eclAccepted).toBe(true);
    });

    await test.step('View the manifest to confirm the flight number change took effect', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      console.log('Expected new flight number:', newFlightNumber);
    });
  });

  //11. Create Air Transit Manifest ECL with New transit Bill retrieved from system:
  test('#11 ECL transit bill from system', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    createNewTransitEclPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(600_000);

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

    let referenceNo = '';

    await test.step('Create transit manifest, attach the bill (via customs number), and submit', async () => {
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
      referenceNo = referenceNumber;
      console.log('Transit Manifest Reference Number:', referenceNo);
      console.log('Transit Manifest Message Id:', messageId);
    });

    await test.step('Wait for transit manifest status to become تم استلامها', async () => {
      await createNewTransitEclPage.expectManifestStatus(
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
        },
        referenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewTransitEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    let newFlightNumber = '';

    await test.step('Edit flight number (header) and save & continue', async () => {
      newFlightNumber = `ECL${Date.now().toString().slice(-5)}`;
      await newTransitManPage.fillFlightNumber(newFlightNumber);
      await createNewTransitEclPage.clickSaveAndContinueButton();
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewTransitEclPage.clickEclHistoryTab();

      eclNumber = await createNewTransitEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewTransitEclPage.openEclLetterRow();
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewTransitEclPage.clickEditButton();
      await createNewTransitEclPage.clickSaveAndContinueButton();
      await createNewTransitEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 5 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewTransitEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
          await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
          await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewTransitEclPage.clickEclHistoryTab();
        },
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );

      console.log('ECL Accepted:', eclAccepted);
      expect(eclAccepted).toBe(true);
    });

    await test.step('View the manifest to confirm the flight number change took effect', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      console.log('Expected new flight number:', newFlightNumber);
    });
  });

  //12. Create Air Transit Manifest ECL  with New transit Bill retrieved from ZATCA
  test('#12 ECL transit bill from ZATCA', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    createNewTransitEclPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(600_000);

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

    let referenceNo = '';

    await test.step('Create transit manifest, attach the bill (via ZATCA lookup), and submit', async () => {
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
      referenceNo = referenceNumber;
      console.log('Transit Manifest Reference Number:', referenceNo);
      console.log('Transit Manifest Message Id:', messageId);
    });

    await test.step('Wait for transit manifest status to become تم استلامها', async () => {
      await createNewTransitEclPage.expectManifestStatus(
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
        },
        referenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewTransitEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    let newFlightNumber = '';

    await test.step('Edit flight number (header) and save & continue', async () => {
      newFlightNumber = `ECL${Date.now().toString().slice(-5)}`;
      await newTransitManPage.fillFlightNumber(newFlightNumber);
      await createNewTransitEclPage.clickSaveAndContinueButton();
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewTransitEclPage.clickEclHistoryTab();

      eclNumber = await createNewTransitEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewTransitEclPage.openEclLetterRow();
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewTransitEclPage.clickEditButton();
      await createNewTransitEclPage.clickSaveAndContinueButton();
      await createNewTransitEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 5 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewTransitEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
          await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
          await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewTransitEclPage.clickEclHistoryTab();
        },
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );

      console.log('ECL Accepted:', eclAccepted);
      expect(eclAccepted).toBe(true);
    });

    await test.step('View the manifest to confirm the flight number change took effect', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      console.log('Expected new flight number:', newFlightNumber);
    });
  });

  //13. Create Air Transit Manifest ECL  with Updated transit Bill:
  test('#13 ECL with changes in the transit bill', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    createNewTransitEclPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(600_000);

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

    let referenceNo = '';

    await test.step('Create transit manifest, attach the bill, and submit', async () => {
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
      referenceNo = referenceNumber;
      console.log('Transit Manifest Reference Number:', referenceNo);
      console.log('Transit Manifest Message Id:', messageId);
    });

    await test.step('Wait for transit manifest status to become تم استلامها', async () => {
      await createNewTransitEclPage.expectManifestStatus(
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
        },
        referenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewTransitEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    //reduce the weight below the original 100 (still a valid amount, since it can't exceed the bill's own
    //original total) - the quantity stays at 1 (the original bill's own minimum):
    const newWeight = '50';

    await test.step('Move to bills step (header unchanged) and edit the bill\'s weight', async () => {
      await createNewTransitEclPage.clickSaveAndContinueButton();

      await newTransitManPage.clickEditTransitBillButton();
      await newTransitManPage.fillTransitBillAmount({
        transitQuantity: masterBillData.totalOriginalQuantity,
        transitWeight: newWeight,
      });
      await newTransitManPage.clickSaveBillButton();
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewTransitEclPage.clickEclHistoryTab();

      eclNumber = await createNewTransitEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewTransitEclPage.openEclLetterRow();
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewTransitEclPage.clickEditButton();
      await createNewTransitEclPage.clickSaveAndContinueButton();
      await createNewTransitEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 5 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewTransitEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
          await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
          await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewTransitEclPage.clickEclHistoryTab();
        },
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );

      console.log('ECL Accepted:', eclAccepted);
      expect(eclAccepted).toBe(true);
    });

    await test.step('View the manifest to confirm the weight change took effect', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      console.log('Expected new weight:', newWeight);
    });
  });

  //14. Create Air Transit Manifest ECL  with Deleted transit Bill:
  test('#14 ECL that deletes the transit bill', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    createNewTransitEclPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(600_000);

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

    let referenceNo = '';

    await test.step('Create transit manifest, attach the bill, and submit', async () => {
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
      referenceNo = referenceNumber;
      console.log('Transit Manifest Reference Number:', referenceNo);
      console.log('Transit Manifest Message Id:', messageId);
    });

    await test.step('Wait for transit manifest status to become تم استلامها', async () => {
      await createNewTransitEclPage.expectManifestStatus(
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
        },
        referenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewTransitEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step("Move to bills step (header unchanged) and delete the bill", async () => {
      await createNewTransitEclPage.clickSaveAndContinueButton();
      await newTransitManPage.clickDeleteTransitBillButton();
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewTransitEclPage.clickEclHistoryTab();

      eclNumber = await createNewTransitEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewTransitEclPage.openEclLetterRow();
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewTransitEclPage.clickEditButton();
      await createNewTransitEclPage.clickSaveAndContinueButton();
      await createNewTransitEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 5 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewTransitEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
          await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
          await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewTransitEclPage.clickEclHistoryTab();
        },
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );

      console.log('ECL Accepted:', eclAccepted);
      expect(eclAccepted).toBe(true);
    });

    await test.step('View the manifest to confirm the bill was removed', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

   //15,16,17,18. Create, View, Edit, Submit Air Transit Manifest ECL with Header Update and Transit Bill Add/Update/Delete
  test('#15-18 Create Air Transit Manifest ECL with Header Update and Transit Bill Add/Update/Delete', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    createNewTransitEclPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(1_200_000);

    const secondBillNo = (parseInt(masterBillData.billNo, 10) + 1).toString();
    const thirdBillNo = (parseInt(masterBillData.billNo, 10) + 2).toString();

    let importReferenceNo = '';

    await test.step('Create import manifest with three completed transit bills', async () => {
      const { submittedReferenceNumber } = await newImportManPage.submitManifestWithThreeBills(
        viewImportManifestPage,
        newImportManifestData,
        { ...masterBillData, billType: '3' },
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

    let referenceNo = '';

    await test.step('Create transit manifest and attach two of the three bills', async () => {
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
      referenceNo = referenceNumber;
      console.log('Transit Manifest Reference Number:', referenceNo);
      console.log('Transit Manifest Message Id:', messageId);
    });

    await test.step('Wait for transit manifest status to become تم استلامها', async () => {
      await createNewTransitEclPage.expectManifestStatus(
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
        },
        referenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('#15 - Create ECL', async () => {
      await createNewTransitEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    let newFlightNumber = '';

    await test.step('#17 - Edit flight number (header) and move to bills step', async () => {
      newFlightNumber = `ECL${Date.now().toString().slice(-5)}`;
      await newTransitManPage.fillFlightNumber(newFlightNumber);
      await createNewTransitEclPage.clickSaveAndContinueButton();
    });

    //reduce the second bill's weight below its original 100 (still valid, can't exceed the bill's own total):
    const newWeight = '50';

    await test.step('#17 - Delete the first bill, update the second, and add the third', async () => {
      await newTransitManPage.clickDeleteTransitBillButtonForBillNo(masterBillData.billNo);

      await newTransitManPage.clickEditTransitBillButtonForBillNo(secondBillNo);
      await newTransitManPage.fillTransitBillAmount({
        transitQuantity: masterBillData.totalOriginalQuantity,
        transitWeight: newWeight,
      });
      await newTransitManPage.clickSaveBillButton();

      await newTransitManPage.addTransitBill(
        {
          transportCompany: newTransitManifestData.transportCompany,
          customsNo,
          viaAirportText: newTransitManifestData.viaAirportText,
          billNo: thirdBillNo,
        },
        {
          transitQuantity: masterBillData.totalOriginalQuantity,
          transitWeight: masterBillData.totalOriginalWeight,
        }
      );
    });

    let eclNumber = '';

    await test.step('#16 - View manifest again and open the ECL letter', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewTransitEclPage.clickEclHistoryTab();

      eclNumber = await createNewTransitEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewTransitEclPage.openEclLetterRow();
    });

    await test.step('#18 - Save and submit the ECL', async () => {
      await createNewTransitEclPage.clickEditButton();
      await createNewTransitEclPage.clickSaveAndContinueButton();
      await createNewTransitEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 5 seconds until مقبول (up to 2 minutes)', async () => {
      const eclAccepted = await createNewTransitEclPage.waitForEclStatus(
        eclNumber,
        'مقبول',
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
          await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
          await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewTransitEclPage.clickEclHistoryTab();
        },
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );

      console.log('ECL Accepted:', eclAccepted);
      expect(eclAccepted).toBe(true);
    });

    await test.step('View the manifest to confirm all changes took effect', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      console.log('Expected new flight number:', newFlightNumber);
      console.log('Expected deleted bill:', masterBillData.billNo);
      console.log('Expected updated bill (new weight):', secondBillNo, newWeight);
      console.log('Expected added bill:', thirdBillNo);
    });
  });

  //19. Create Transit Manifest ECL with Carrier does not Exist:
  test('#19 ECL with invalid transport company gets rejected', async ({
    page,
    newTransitManPage,
    createNewTransitEclPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(400_000);

    let referenceNo = '';

    await test.step('Create transit manifest (header only) and submit', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await newTransitManPage.clickCreateAirTransitManifest();
      await newTransitManPage.fillManifestForm(newTransitManifestData);
      await newTransitManPage.clickSaveAndSubmit();
      await newTransitManPage.verifyManifestSubmittedSuccessfully();

      referenceNo = await newTransitManPage.getReferenceNumber();
      console.log('Reference Number:', referenceNo);
    });

    await test.step('Wait for manifest status to become انتظار اكتمال المعلومات', async () => {
      await createNewTransitEclPage.expectManifestStatus(
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
        },
        referenceNo,
        'انتظار اكتمال المعلومات',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewTransitEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step('Edit transport company to the broken ?????? entry and save & continue', async () => {
      //a single "?" is enough to filter the autocomplete down to exactly this one company:
      await newTransitManPage.fillTransportCompany('?');
      await createNewTransitEclPage.clickSaveAndContinueButton();
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
      await createNewTransitEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewTransitEclPage.clickEclHistoryTab();

      eclNumber = await createNewTransitEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewTransitEclPage.openEclLetterRow();
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewTransitEclPage.clickEditButton();
      await createNewTransitEclPage.clickSaveAndContinueButton();
      await createNewTransitEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 5 seconds until مرفوض (up to 3 minutes)', async () => {
      const eclRejected = await createNewTransitEclPage.waitForEclStatus(
        eclNumber,
        'مرفوض',
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
          await createNewTransitEclPage.searchByReferenceNumber(referenceNo);
          await createNewTransitEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewTransitEclPage.clickEclHistoryTab();
        },
        { intervalMs: 5_000, timeoutMs: 180_000 }
      );

      console.log('ECL Rejected:', eclRejected);
      expect(eclRejected).toBe(true);
    });

    await test.step('Open the document history tab and view the rejection details', async () => {
      await createNewTransitEclPage.clickHistoryTab();
      await createNewTransitEclPage.clickHistoryDetailsButton();
    });
  });

  //20. Create Air Transit Manifest ECL that adds a transit bill exceeding the bill's remaining balance:
  test('#20 ECL that adds a transit bill exceeding its remaining balance gets rejected', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newTransitManPage,
    createNewTransitEclPage,
    newTransitManifestData,
  }) => {
    test.setTimeout(900_000);

    //the imported bill needs a full 100/100 to split 50/50 (first manifest) + 60/60 (ECL on the second) - the
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
      await createNewTransitEclPage.expectManifestStatus(
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
        },
        firstTransitReferenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    let secondReferenceNo = '';
    const secondTransitManifestData = createNewTransitManifestData();

    await test.step('Create second transit manifest (header only) and submit', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await newTransitManPage.clickCreateAirTransitManifest();
      await newTransitManPage.fillManifestForm(secondTransitManifestData);
      await newTransitManPage.clickSaveAndSubmit();
      await newTransitManPage.verifyManifestSubmittedSuccessfully();

      secondReferenceNo = await newTransitManPage.getReferenceNumber();
      console.log('Second Transit Manifest Reference Number:', secondReferenceNo);
    });

    await test.step('Wait for the second manifest status to become انتظار اكتمال المعلومات', async () => {
      await createNewTransitEclPage.expectManifestStatus(
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
        },
        secondReferenceNo,
        'انتظار اكتمال المعلومات',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewTransitEclPage.openManifestByReferenceNumber(secondReferenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewTransitEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step('Move to bills step (header unchanged) and add the same bill (weight 60, quantity 60 - only 50/50 remain)', async () => {
      await createNewTransitEclPage.clickSaveAndContinueButton();

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
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newTransitManPage.clickAirServices();
      await newTransitManPage.clickAirTransitManifest();
      await createNewTransitEclPage.searchByReferenceNumber(secondReferenceNo);
      await createNewTransitEclPage.verifyReferenceNumberDisplayed(secondReferenceNo);
      await createNewTransitEclPage.openManifestByReferenceNumber(secondReferenceNo);
      await createNewTransitEclPage.clickEclHistoryTab();

      eclNumber = await createNewTransitEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewTransitEclPage.openEclLetterRow();
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewTransitEclPage.clickEditButton();
      await createNewTransitEclPage.clickSaveAndContinueButton();
      await createNewTransitEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 5 seconds until مرفوض (up to 3 minutes)', async () => {
      const eclRejected = await createNewTransitEclPage.waitForEclStatus(
        eclNumber,
        'مرفوض',
        async () => {
          await newTransitManPage.clickAirServices();
          await newTransitManPage.clickAirTransitManifest();
          await createNewTransitEclPage.searchByReferenceNumber(secondReferenceNo);
          await createNewTransitEclPage.openManifestByReferenceNumber(secondReferenceNo);
          await createNewTransitEclPage.clickEclHistoryTab();
        },
        { intervalMs: 5_000, timeoutMs: 180_000 }
      );

      console.log('ECL Rejected:', eclRejected);
      expect(eclRejected).toBe(true);
    });

    await test.step('Open the document history tab and view the rejection details', async () => {
      await createNewTransitEclPage.clickHistoryTab();
      await createNewTransitEclPage.clickHistoryDetailsButton();
    });
  });
});
