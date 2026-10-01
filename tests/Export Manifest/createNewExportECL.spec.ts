import { test, expect } from '../../fixtures/testFixtures';

test.describe('Create New Export ECL Test', () => {

  test('#10- Submit Air Export Manifest ECL with change in header', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    let referenceNo = '';

    await test.step('Create full export manifest', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await newExportManPage.clickCreateAirExportManifest();
      await newExportManPage.fillManifestForm(newExportManifestData);
      await newExportManPage.clickSaveAndContinue();

      await createNewExportEclPage.addExportBill(exportBillData, exportBillItemData);
      const { submittedReferenceNumber } = await createNewExportEclPage.submitManifest();
      referenceNo = submittedReferenceNumber;
      console.log('Reference Number:', referenceNo);
    });

    await test.step('Wait for manifest status to become تم استلامها', async () => {
      await createNewExportEclPage.expectManifestStatus(
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
        },
        referenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewExportEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step('Edit flight number (header) and save & continue', async () => {
      const newFlightNumber = `ECL${Date.now().toString().slice(-5)}`;
      await newExportManPage.fillFlightNumber(newFlightNumber);
      await createNewExportEclPage.clickSaveAndContinueButton();
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewExportEclPage.clickEclHistoryTab();
      eclNumber = await createNewExportEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewExportEclPage.openEclLetterRow();
    });

    await test.step('Submit the ECL', async () => {
      await createNewExportEclPage.clickEditButton();
      await createNewExportEclPage.clickSaveAndContinueButton();
      await createNewExportEclPage.clickSubmitButton();
    });

    //export ECLs settle at تم استلامها, not مقبول like import's:
    await test.step('Check ECL status every 4 seconds until تم استلامها (up to 2 minutes)', async () => {
      const eclAccepted = await createNewExportEclPage.waitForEclStatus(
        eclNumber,
        'تم استلامها',
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
          await createNewExportEclPage.searchByReferenceNumber(referenceNo);
          await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewExportEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the changed data', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  test('#11- Submit Air Export Manifest ECL with Editing existing Bill', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    let referenceNo = '';

    await test.step('Create full export manifest', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await newExportManPage.clickCreateAirExportManifest();
      await newExportManPage.fillManifestForm(newExportManifestData);
      await newExportManPage.clickSaveAndContinue();

      await createNewExportEclPage.addExportBill(exportBillData, exportBillItemData);
      const { submittedReferenceNumber } = await createNewExportEclPage.submitManifest();
      referenceNo = submittedReferenceNumber;
      console.log('Reference Number:', referenceNo);
    });

    await test.step('Wait for manifest status to become تم استلامها', async () => {
      await createNewExportEclPage.expectManifestStatus(
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
        },
        referenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewExportEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step('Save & continue from header (unchanged) to bills step', async () => {
      await createNewExportEclPage.clickSaveAndContinueButton();
    });

    await test.step('Update the existing bill\'s owner name (Arabic) and continue', async () => {
      await createNewExportEclPage.clickEditOnExportBillIfPresent();
      await createNewExportEclPage.fillExportBillOwnerNameArabic('مالك اختبار تعديل');
      await createNewExportEclPage.clickSaveAndContinueButton();
      await createNewExportEclPage.clickSubmitButton();
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewExportEclPage.clickEclHistoryTab();
      eclNumber = await createNewExportEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewExportEclPage.openEclLetterRow();
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewExportEclPage.clickEditButton();
      await createNewExportEclPage.clickSaveAndContinueButton();
      await createNewExportEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 4 seconds until تم استلامها (up to 2 minutes)', async () => {
      const eclAccepted = await createNewExportEclPage.waitForEclStatus(
        eclNumber,
        'تم استلامها',
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
          await createNewExportEclPage.searchByReferenceNumber(referenceNo);
          await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewExportEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the changed data', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  test('#12- Submit Air Export Manifest ECL with Deleted Existing Bill', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    let referenceNo = '';

    await test.step('Create full export manifest with two bills', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await newExportManPage.clickCreateAirExportManifest();
      await newExportManPage.fillManifestForm(newExportManifestData);
      await newExportManPage.clickSaveAndContinue();

      const secondExportBillData = {
        ...exportBillData,
        billNo: (parseInt(exportBillData.billNo, 10) + 1).toString(),
      };

      await createNewExportEclPage.addExportBill(exportBillData, exportBillItemData);
      await createNewExportEclPage.addExportBill(secondExportBillData, exportBillItemData);

      const { submittedReferenceNumber } = await createNewExportEclPage.submitManifest();
      referenceNo = submittedReferenceNumber;
      console.log('Reference Number:', referenceNo);
    });

    await test.step('Wait for manifest status to become تم استلامها', async () => {
      await createNewExportEclPage.expectManifestStatus(
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
        },
        referenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewExportEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step('Save & continue from header (unchanged) to bills step', async () => {
      await createNewExportEclPage.clickSaveAndContinueButton();
    });

    await test.step('Delete one of the two bills', async () => {
      await createNewExportEclPage.clickDeleteOnExportBillIfPresent();
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewExportEclPage.clickEclHistoryTab();
      eclNumber = await createNewExportEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewExportEclPage.openEclLetterRow();
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewExportEclPage.clickEditButton();
      await createNewExportEclPage.clickSaveAndContinueButton();
      await createNewExportEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 4 seconds until تم استلامها (up to 2 minutes)', async () => {
      const eclAccepted = await createNewExportEclPage.waitForEclStatus(
        eclNumber,
        'تم استلامها',
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
          await createNewExportEclPage.searchByReferenceNumber(referenceNo);
          await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewExportEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the changed data', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  test('#13- Submit Air Export Manifest ECL with Added Export Bill', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    let referenceNo = '';

    await test.step('Create full export manifest with one bill', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await newExportManPage.clickCreateAirExportManifest();
      await newExportManPage.fillManifestForm(newExportManifestData);
      await newExportManPage.clickSaveAndContinue();

      await createNewExportEclPage.addExportBill(exportBillData, exportBillItemData);
      const { submittedReferenceNumber } = await createNewExportEclPage.submitManifest();
      referenceNo = submittedReferenceNumber;
      console.log('Reference Number:', referenceNo);
    });

    await test.step('Wait for manifest status to become تم استلامها', async () => {
      await createNewExportEclPage.expectManifestStatus(
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
        },
        referenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewExportEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step('Save & continue from header (unchanged) to bills step', async () => {
      await createNewExportEclPage.clickSaveAndContinueButton();
    });

    const secondExportBillData = {
      ...exportBillData,
      billNo: (parseInt(exportBillData.billNo, 10) + 1).toString(),
    };

    await test.step('Add a new (second) bill', async () => {
      await createNewExportEclPage.addExportBill(secondExportBillData, exportBillItemData);
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewExportEclPage.clickEclHistoryTab();
      eclNumber = await createNewExportEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewExportEclPage.openEclLetterRow();
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewExportEclPage.clickEditButton();
      await createNewExportEclPage.clickSaveAndContinueButton();
      await createNewExportEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 4 seconds until تم استلامها (up to 2 minutes)', async () => {
      const eclAccepted = await createNewExportEclPage.waitForEclStatus(
        eclNumber,
        'تم استلامها',
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
          await createNewExportEclPage.searchByReferenceNumber(referenceNo);
          await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewExportEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the new bill', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  test('#14- Add Bills to Waiting Manifest', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    let referenceNo = '';

    await test.step('Create header-only export manifest and submit directly', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await newExportManPage.clickCreateAirExportManifest();
      await newExportManPage.fillManifestForm(newExportManifestData);
      await newExportManPage.clickSaveAndSubmit();
      await newExportManPage.confirmManifestSubmission();
      await newExportManPage.verifyManifestSubmittedSuccessfully();

      referenceNo = await newExportManPage.getReferenceNumber();
      console.log('Reference Number:', referenceNo);
    });

    //this manifest declares no bills, so it lands on "انتظار اكتمال المعلومات" (waiting for information
    //completion) rather than "تم استلامها" - that's expected here, since the ECL below is what actually
    //fulfills the missing bill (same as import's equivalent test):
    await test.step('Wait for manifest status to become انتظار اكتمال المعلومات', async () => {
      await createNewExportEclPage.expectManifestStatus(
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
        },
        referenceNo,
        'انتظار اكتمال المعلومات',
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('Create ECL', async () => {
      await createNewExportEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step('Save & continue from header (unchanged) to bills step', async () => {
      await createNewExportEclPage.clickSaveAndContinueButton();
    });

    await test.step('Add the first bill', async () => {
      await createNewExportEclPage.addExportBill(exportBillData, exportBillItemData);
    });

    let eclNumber = '';

    await test.step('View manifest again and open the ECL letter', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewExportEclPage.clickEclHistoryTab();
      eclNumber = await createNewExportEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewExportEclPage.openEclLetterRow();
    });

    await test.step('Save and submit the ECL', async () => {
      await createNewExportEclPage.clickEditButton();
      await createNewExportEclPage.clickSaveAndContinueButton();
      await createNewExportEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 4 seconds until تم استلامها (up to 2 minutes)', async () => {
      const eclAccepted = await createNewExportEclPage.waitForEclStatus(
        eclNumber,
        'تم استلامها',
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
          await createNewExportEclPage.searchByReferenceNumber(referenceNo);
          await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewExportEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the new bill', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  test('#15-18 Create Air Export Manifest ECL with Edit Header Update, Export Bill Add/Update/Delete', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    let referenceNo = '';

    await test.step('Create full export manifest with two bills', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await newExportManPage.clickCreateAirExportManifest();
      await newExportManPage.fillManifestForm(newExportManifestData);
      await newExportManPage.clickSaveAndContinue();

      const secondExportBillData = {
        ...exportBillData,
        billNo: (parseInt(exportBillData.billNo, 10) + 1).toString(),
      };

      await createNewExportEclPage.addExportBill(exportBillData, exportBillItemData);
      await createNewExportEclPage.addExportBill(secondExportBillData, exportBillItemData);

      const { submittedReferenceNumber } = await createNewExportEclPage.submitManifest();
      referenceNo = submittedReferenceNumber;
      console.log('Reference Number:', referenceNo);
    });

    await test.step('Wait for manifest status to become تم استلامها', async () => {
      await createNewExportEclPage.expectManifestStatus(
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
        },
        referenceNo,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 120_000 }
      );
    });

    await test.step('View manifest header', async () => {
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });

    await test.step('#15 - Create Air Export Manifest ECL with Edit Header Update, Export Bill Add/Update/Delete', async () => {
      await createNewExportEclPage.clickCreateElectronicAmendmentLetterButton();
    });

    await test.step('Header update: edit flight number and save & continue', async () => {
      const newFlightNumber = `ECL${Date.now().toString().slice(-5)}`;
      await newExportManPage.fillFlightNumber(newFlightNumber);
      await createNewExportEclPage.clickSaveAndContinueButton();
    });

    await test.step('Bill delete: remove one of the two bills', async () => {
      await createNewExportEclPage.clickDeleteOnExportBillIfPresent();
    });

    await test.step('Bill update: edit the remaining bill\'s owner name (Arabic)', async () => {
      await createNewExportEclPage.clickEditOnExportBillIfPresent();
      await createNewExportEclPage.fillExportBillOwnerNameArabic('مالك اختبار تعديل');
      await createNewExportEclPage.clickSaveAndContinueButton();
      await createNewExportEclPage.clickSubmitButton();
    });

    const thirdExportBillData = {
      ...exportBillData,
      billNo: (parseInt(exportBillData.billNo, 10) + 2).toString(),
    };

    await test.step('Bill add: add a new bill', async () => {
      await createNewExportEclPage.addExportBill(thirdExportBillData, exportBillItemData);
    });

    let eclNumber = '';

    await test.step('#16 - View manifest again and open the ECL letter', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.verifyReferenceNumberDisplayed(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
      await createNewExportEclPage.clickEclHistoryTab();
      eclNumber = await createNewExportEclPage.getEclSeqNo();
      console.log('ECL Number:', eclNumber);
      await createNewExportEclPage.openEclLetterRow();
    });

    await test.step('#18 - Save and submit the ECL', async () => {
      await createNewExportEclPage.clickEditButton();
      await createNewExportEclPage.clickSaveAndContinueButton();
      await createNewExportEclPage.clickSubmitButton();
    });

    await test.step('Check ECL status every 4 seconds until تم استلامها (up to 2 minutes)', async () => {
      const eclAccepted = await createNewExportEclPage.waitForEclStatus(
        eclNumber,
        'تم استلامها',
        async () => {
          await newExportManPage.clickAirServices();
          await newExportManPage.clickAirExportManifest();
          await createNewExportEclPage.searchByReferenceNumber(referenceNo);
          await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
          await createNewExportEclPage.clickEclHistoryTab();
        },
        { intervalMs: 4_000, timeoutMs: 120_000 }
      );

      expect(eclAccepted).toBe(true);
    });

    await test.step('Open manifest to see the changed data', async () => {
      await newExportManPage.clickAirServices();
      await newExportManPage.clickAirExportManifest();
      await createNewExportEclPage.searchByReferenceNumber(referenceNo);
      await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
    });
  });

  
});
