import { test, expect } from '../../fixtures/testFixtures';

test.describe('Create New Export ECL Test', () => {
  //flow: create a full export manifest -> create an ECL on it -> edit the header -> view the ECL ->
  //submit it -> poll its status until مقبول -> open the manifest to see the change take effect.
  //mirrors the import ECL header-edit test, but export's "حفظ وتقديم" submits directly without a confirmation
  //dialog (unlike import's #submitDraftManifest, which shows "هل ترغب بتقديم المانيفست؟"):
  test('All information ECL with changes in header', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    try {
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

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newExportManPage.clickAirServices();
        await newExportManPage.clickAirExportManifest();

        received = await createNewExportEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

      await test.step('View manifest header', async () => {
        await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
      });

      //export manifests only have one ECL type - clicking "إنشاء خطاب تعديل إلكتروني" lands directly on the
      //header edit screen, unlike import's ECL type selection screen (3 types to choose from):
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
        //read the ECL number from the History table row itself before opening it - the opened ECL letter page
        //doesn't reuse the #reference-view1 component the way import's does:
        eclNumber = await createNewExportEclPage.getEclSeqNo();
        console.log('ECL Number:', eclNumber);
        await createNewExportEclPage.openEclLetterRow();
      });

      await test.step('Save and submit the ECL', async () => {
        //تعديل -> حفظ واستمرار (header -> bills step, unchanged) -> تقديم الطلب (actual submit, via the inherited
        //clickSaveButton(), which targets button[data-i18n="submitButtonText"] - same button used everywhere else):
        await createNewExportEclPage.clickEditButton();
        await createNewExportEclPage.clickSaveAndContinueButton();
        await createNewExportEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //flow: create a full export manifest -> create an ECL on it -> save & continue past the (unchanged) header ->
  //edit the existing bill's owner name (Arabic) -> view the ECL -> submit it -> poll until تم استلامها -> open the
  //manifest to see the change take effect. Same overall steps as the header-edit test above, only the middle
  //"what gets edited" step differs:
  test('All information ECL with Updated Existing Bill', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    try {
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

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newExportManPage.clickAirServices();
        await newExportManPage.clickAirExportManifest();

        received = await createNewExportEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

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
        await createNewExportEclPage.clickSaveButton();
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
        await createNewExportEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //flow: create a full export manifest with TWO bills -> create an ECL on it -> save & continue past the
  //(unchanged) header -> delete one of the two bills -> view the ECL -> submit it -> poll until تم استلامها ->
  //open the manifest to see the change take effect. Export manifests have no "total number of bills" header field
  //to keep in sync (unlike import), so deleting is simpler - no header edit needed first:
  test('All information ECL with Deleted Existing Bill', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    try {
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

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newExportManPage.clickAirServices();
        await newExportManPage.clickAirExportManifest();

        received = await createNewExportEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

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
        await createNewExportEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //flow: create a full export manifest with one bill -> create an ECL on it -> save & continue past the
  //(unchanged) header -> add a new (second) bill -> view the ECL -> submit it -> poll until تم استلامها -> open
  //the manifest to see the new bill. addExportBill() is reused as-is - it's DOM-generic (based on visible
  //text/data-i18n), so it works the same whether called during manifest creation or during an ECL:
  test('All information ECL with adding new bill', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    try {
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

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newExportManPage.clickAirServices();
        await newExportManPage.clickAirExportManifest();

        received = await createNewExportEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

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
        await createNewExportEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //combined - header update + bill delete/update/add, all in one ECL submission:
  //flow: create a full export manifest with TWO bills -> create an ECL -> edit the header (flight number) ->
  //delete one of the two bills -> update the remaining bill's owner name (Arabic) -> add a new bill -> view the
  //ECL -> submit it -> poll until تم استلامها -> open the manifest to see the changes. Ends with two bills (the
  //updated original + the new one):
  test('All information ECL with header, bill add, update, and delete', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    try {
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

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newExportManPage.clickAirServices();
        await newExportManPage.clickAirExportManifest();

        received = await createNewExportEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

      await test.step('View manifest header', async () => {
        await createNewExportEclPage.openManifestByReferenceNumber(referenceNo);
      });

      await test.step('Create ECL', async () => {
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
        await createNewExportEclPage.clickSaveButton();
      });

      const thirdExportBillData = {
        ...exportBillData,
        billNo: (parseInt(exportBillData.billNo, 10) + 2).toString(),
      };

      await test.step('Bill add: add a new bill', async () => {
        await createNewExportEclPage.addExportBill(thirdExportBillData, exportBillItemData);
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
        await createNewExportEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //flow: create a header-only export manifest and submit it directly (حفظ وتقديم, no bills) -> create an ECL on
  //it to add its first bill -> view the ECL -> submit it -> poll until تم استلامها -> open the manifest to see
  //the new bill. Mirrors import's "Add Bills to Waiting Manifest with header only" test:
  test('Add bill to header-only export manifest', async ({
    page,
    newExportManPage,
    createNewExportEclPage,
    newExportManifestData,
    exportBillData,
    exportBillItemData,
  }) => {
    test.setTimeout(600_000);

    try {
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

      let received = false;

      //this manifest declares no bills, so it lands on "انتظار اكتمال المعلومات" (waiting for information
      //completion) rather than "تم استلامها" - that's expected here, since the ECL below is what actually
      //fulfills the missing bill (same as import's equivalent test):
      await test.step('Wait for manifest status to become انتظار اكتمال المعلومات', async () => {
        await newExportManPage.clickAirServices();
        await newExportManPage.clickAirExportManifest();

        received = await createNewExportEclPage.waitForManifestStatus(
          referenceNo,
          'انتظار اكتمال المعلومات',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

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
        await createNewExportEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });
});
