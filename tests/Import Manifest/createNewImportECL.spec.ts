import { test, expect } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';

test.describe('Create New ECL Test', () => {

  //25- Submit All information ECL with changes in header
  //flow: create a full manifest -> create an ECL on it -> edit the header -> view the ECL ->
  //submit it -> poll its status until مقبول -> open the manifest to see the change take effect.
  test('All information ECL with changes in header', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(600_000);

    try {
      // ---- 1) create a full import manifest and wait for it to be accepted ----

      let referenceNo = '';

      await test.step('Create full import manifest', async () => {
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
        referenceNo = submittedReferenceNumber;
        console.log('Reference Number:', referenceNo);
      });

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        received = await createNewEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

      await test.step('View manifest header', async () => {
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

      // ---- 3) view the ECL letter and submit it ----

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

      // ---- 4) poll the ECL status until مقبول ----

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

      // ---- 5) open the manifest to see the change ----

      await test.step('Open manifest to see the changed data', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();
        await createNewEclPage.searchByReferenceNumber(referenceNo);
        await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      });
    } finally {
      await page.pause();
    }
  });

  //26 , 27 , 28- Create, View, Submit All information ECL with Updated Existing Bill
  test('All information ECL with Updated Existing Bill', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    try {
      let referenceNo = '';

      await test.step('Create full import manifest', async () => {
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
        referenceNo = submittedReferenceNumber;
        console.log('Reference Number:', referenceNo);
      });

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        received = await createNewEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

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

      await test.step('Edit master bill weight and save & continue', async () => {
        //the header form shows first; save & continue to reach the master bills step:
        await createNewEclPage.clickSaveAndContinueButton();

        await createNewEclPage.clickEditOnMasterBillIfPresent();

        //note: the bill number field ("رقم بوليصة الشحن") is disabled in this ECL edit flow, same as the
        //owner/details fields - once a master bill is submitted its bill number can't be amended here:
        await createNewEclPage.fillMasterBillWeight('200');

        await createNewEclPage.clickSaveAndContinueButton();
        //the other owner/details fields are disabled in this ECL edit flow; only payment method needs filling:
        await createNewEclPage.fillMasterBillPaymentMethod(masterBillData.paymentMethod);
        await createNewEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //29,30,31,32 - Create, View, Submit All information ECL with Deleted Existing Bill
  test('All information ECL with Deleted Existing Bill', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    try {
      let referenceNo = '';

      await test.step('Create full import manifest with two master bills', async () => {
        const { submittedReferenceNumber } = await newImportManPage.submitManifestWithMoreThanOneBill(
          createNewEclPage,
          newImportManifestData,
          masterBillData,
          airwayBillData,
          billItemData,
          warehouseData
        );
        referenceNo = submittedReferenceNumber;
        console.log('Reference Number:', referenceNo);
      });

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        received = await createNewEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

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

      await test.step('Edit total number of bills (header) and save & continue', async () => {
        await newImportManPage.fillTotalNumberOfBills('1');
        await createNewEclPage.clickSaveAndContinueButton();
      });

      await test.step('Delete a master bill and save & continue', async () => {
        await createNewEclPage.clickDeleteOnMasterBillIfPresent();
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
        //don't open any bill's "التفاصيل" - just click through each wizard screen (master bills, house bill)
        //to reach the final "تقديم الطلب" submit button (button[data-i18n="submitButtonText"], via clickSaveButton() -
        //not clickSaveAndSubmitEcl()'s #submitDraftManifest, which isn't the button shown on this last screen).
        //submitting here shows a "تنبيه من فسح" success popup directly, not the usual "هل ترغب بتقديم المانيفست؟"
        //confirmation dialog, so it's closed the same way as other blocking popups instead of confirmManifestSubmission():
        await createNewEclPage.clickEditButton();
        await createNewEclPage.clickSaveAndContinueButton(); // header -> master bills
        await createNewEclPage.clickSaveAndContinueButton(); // master bills -> house bill
        await createNewEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //33,34,35,36 - Create, View, Submit All information ECL with adding new completed Normal Bill
  test('All information ECL with adding new completed Normal Bill', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    try {
      let referenceNo = '';

      await test.step('Create full import manifest with one master bill', async () => {
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
        referenceNo = submittedReferenceNumber;
        console.log('Reference Number:', referenceNo);
      });

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        received = await createNewEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

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

      await test.step('Edit total number of bills (header) and save & continue', async () => {
        await newImportManPage.fillTotalNumberOfBills('2');
        await createNewEclPage.clickSaveAndContinueButton();
      });

      await test.step('Add a second master bill with its own house bill', async () => {
        const secondMasterBillData = {
          ...masterBillData,
          billNo: (parseInt(masterBillData.billNo, 10) + 1).toString(),
        };

        await createNewEclPage.createMasterBill(secondMasterBillData);
        await createNewEclPage.addHouseBill(airwayBillData, billItemData, warehouseData, secondMasterBillData.billNo);
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
        //don't open any bill's "التفاصيل" - just click through each wizard screen (master bills, house bill)
        //to reach the final "تقديم الطلب" submit button (button[data-i18n="submitButtonText"], via clickSaveButton() -
        //not clickSaveAndSubmitEcl()'s #submitDraftManifest, which isn't the button shown on this last screen).
        //submitting here shows a "تنبيه من فسح" success popup directly, not the usual "هل ترغب بتقديم المانيفست؟"
        //confirmation dialog, so it's closed the same way as other blocking popups instead of confirmManifestSubmission():
        await createNewEclPage.clickEditButton();
        await createNewEclPage.clickSaveAndContinueButton(); // header -> master bills
        await createNewEclPage.clickSaveAndContinueButton(); // master bills -> house bill
        await createNewEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //37 - Create , View ,Submit All information ECL with adding new Waiting Normal Bill
  //only 1 arrived, weight arrived less than the master bill's total original weight
  test('All information ECL with adding new Waiting Normal Bill', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    try {
      let referenceNo = '';

      await test.step('Create full import manifest with one master bill', async () => {
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
        referenceNo = submittedReferenceNumber;
        console.log('Reference Number:', referenceNo);
      });

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        received = await createNewEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

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

      await test.step('Edit total number of bills (header) and save & continue', async () => {
        await newImportManPage.fillTotalNumberOfBills('2');
        await createNewEclPage.clickSaveAndContinueButton();
      });

      await test.step('Add a second master bill with a partial (waiting) house bill', async () => {
        //total quantity 2, only 1 arrived - leaves the bill "waiting" for the remaining quantity:
        const secondMasterBillData = {
          ...masterBillData,
          billNo: (parseInt(masterBillData.billNo, 10) + 1).toString(),
          totalOriginalQuantity: '2',
        };

        const partialWeight = (parseFloat(masterBillData.totalOriginalWeight) / 2).toString();

        const partialArrivalAirwayBillData = {
          deliveredWeight: partialWeight,
          deliveredQuantity: '1',
          manifestType: '1',
        };

        const partialArrivalBillItemData = {
          ...billItemData,
          itemWeight: partialWeight,
        };

        await createNewEclPage.createMasterBill(secondMasterBillData);
        await createNewEclPage.addHouseBill(
          partialArrivalAirwayBillData,
          partialArrivalBillItemData,
          warehouseData,
          secondMasterBillData.billNo
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
        //don't open any bill's "التفاصيل" - just click through each wizard screen (master bills, house bill)
        //to reach the final "تقديم الطلب" submit button (button[data-i18n="submitButtonText"], via clickSaveButton() -
        //not clickSaveAndSubmitEcl()'s #submitDraftManifest, which isn't the button shown on this last screen).
        //submitting here shows a "تنبيه من فسح" success popup directly, not the usual "هل ترغب بتقديم المانيفست؟"
        //confirmation dialog, so it's closed the same way as other blocking popups instead of confirmManifestSubmission():
        await createNewEclPage.clickEditButton();
        await createNewEclPage.clickSaveAndContinueButton(); // header -> master bills
        await createNewEclPage.clickSaveAndContinueButton(); // master bills -> house bill
        await createNewEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //38 - Submit All information ECL with adding new Transit  Bill
  //calculation-method/currency/transfer-fees/payment-method fields (handled automatically by fillMasterBillDetailsForm):
  test('create new ECL adding a transit master bill', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    try {
      let referenceNo = '';

      await test.step('Create full import manifest with one master bill', async () => {
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
        referenceNo = submittedReferenceNumber;
        console.log('Reference Number:', referenceNo);
      });

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        received = await createNewEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

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

      await test.step('Edit total number of bills (header) and save & continue', async () => {
        await newImportManPage.fillTotalNumberOfBills('2');
        await createNewEclPage.clickSaveAndContinueButton();
      });

      await test.step('Add a second, transit master bill with its own house bill', async () => {
        const transitMasterBillData = {
          ...masterBillData,
          billNo: (parseInt(masterBillData.billNo, 10) + 1).toString(),
          billType: '3',
        };

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
        //don't open any bill's "التفاصيل" - just click through each wizard screen (master bills, house bill)
        //to reach the final "تقديم الطلب" submit button (button[data-i18n="submitButtonText"], via clickSaveButton() -
        //not clickSaveAndSubmitEcl()'s #submitDraftManifest, which isn't the button shown on this last screen).
        //submitting here shows a "تنبيه من فسح" success popup directly, not the usual "هل ترغب بتقديم المانيفست؟"
        //confirmation dialog, so it's closed the same way as other blocking popups instead of confirmManifestSubmission():
        await createNewEclPage.clickEditButton();
        await createNewEclPage.clickSaveAndContinueButton(); // header -> master bills
        await createNewEclPage.clickSaveAndContinueButton(); // master bills -> house bill
        await createNewEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //39 - Add Bills to Waiting Manifest
  //ECL to add its first master bill
  test('Add Bills to Waiting Manifest with header only', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    try {
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

      let received = false;

      //this manifest declares 1 bill but never creates one, so it lands on "انتظار اكتمال المعلومات" (waiting for
      //information completion) rather than "تم استلامها" - that's expected here, since the ECL below is what
      //actually fulfills that missing bill:
      await test.step('Wait for manifest status to become انتظار اكتمال المعلومات', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        received = await createNewEclPage.waitForManifestStatus(
          referenceNo,
          'انتظار اكتمال المعلومات',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

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
        //don't open any bill's "التفاصيل" - just click through each wizard screen (master bills, house bill)
        //to reach the final "تقديم الطلب" submit button (button[data-i18n="submitButtonText"], via clickSaveButton() -
        //not clickSaveAndSubmitEcl()'s #submitDraftManifest, which isn't the button shown on this last screen).
        //submitting here shows a "تنبيه من فسح" success popup directly, not the usual "هل ترغب بتقديم المانيفست؟"
        //confirmation dialog, so it's closed the same way as other blocking popups instead of confirmManifestSubmission():
        await createNewEclPage.clickEditButton();
        await createNewEclPage.clickSaveAndContinueButton(); // header -> master bills
        await createNewEclPage.clickSaveAndContinueButton(); // master bills -> house bill
        await createNewEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //44,45,46 - Create,View ,Submit "Edit owner information" ECL
  test('create new ECL updating owner information', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    try {
      let referenceNo = '';

      await test.step('Create full import manifest with one master bill', async () => {
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
        referenceNo = submittedReferenceNumber;
        console.log('Reference Number:', referenceNo);
      });

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        received = await createNewEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

      await test.step('View manifest header', async () => {
        await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      });

      await test.step('Create ECL for updating owner information', async () => {
        await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
        await createNewEclPage.selectEclType('2');
        await createNewEclPage.clickChooseEclTypeButton();
      });

      await test.step('Edit owner name (English and Arabic) and save', async () => {
        await createNewEclPage.clickEditOwnerInfoButton();
        await createNewEclPage.fillOwnerNameEnglish('Owner test ECL');
        await createNewEclPage.fillOwnerNameArabic('مالك اختبار الخطاب');
        await createNewEclPage.clickSaveOnlyButton();
        //two modals stack here: the "تنبيه من فسح" success alert on top of the owner-edit form itself (which is
        //also a modal, not a page) - close both, topmost first:
        await newImportManPage.closeAllBlockingModals();
      });

      let eclNumber = '';

      await test.step('View manifest again and open the ECL letter', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();
        await createNewEclPage.searchByReferenceNumber(referenceNo);
        await createNewEclPage.verifyReferenceNumberDisplayed(referenceNo);
        await createNewEclPage.openManifestByReferenceNumber(referenceNo);
        await createNewEclPage.clickEclHistoryTab();
        //read the ECL number from the History table row itself before opening it - opening this ECL type lands
        //directly on the updated bill rather than the reference-view header (which getOpenedEclNumber() reads from):
        eclNumber = await createNewEclPage.getEclSeqNo();
        console.log('ECL Number:', eclNumber);
        await createNewEclPage.openEclLetterRow();
      });

      await test.step('Save and submit the ECL', async () => {
        //opening this ECL type lands directly on the updated bill (not the reference-view header like ECL type 1):
        //first "تعديل" (btn-primary float-right, via clickEditButton()) enters edit mode, second "تعديل"
        //(btn-sm btn-secondary btn-info, via clickEditOwnerInfoButton()) opens the bill's own edit form, then
        //"تقديم الطلب" actually submits it (saving alone leaves it as مسودة); its follow-up success alert is
        //closed the same double-modal way as before:
        await createNewEclPage.clickEditButton();
        await createNewEclPage.clickEditOwnerInfoButton();
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
    } finally {
      await page.pause();
    }
  });

  //48 - Create, View, Submit "Edit Warehouse information" ECL - Edit one warehouse 
  test('create new ECL updating warehouse information', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    try {
      let referenceNo = '';

      await test.step('Create full import manifest with one master bill', async () => {
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
        referenceNo = submittedReferenceNumber;
        console.log('Reference Number:', referenceNo);
      });

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        received = await createNewEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

      await test.step('View manifest header', async () => {
        await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      });

      await test.step('Create ECL for updating warehouse information', async () => {
        await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
        await createNewEclPage.selectEclType('3');
        await createNewEclPage.clickChooseEclTypeButton();
      });

      await test.step('Edit the warehouse code and save', async () => {
        await createNewEclPage.clickEditWarehousesButton();
        await createNewEclPage.clickEditWarehouseRowButton();
        await createNewEclPage.fillNewWarehouseCode('ECLWH1');
        await createNewEclPage.clickSaveOnlyButton();
        //close the warehouse-row form and the "تعديل المستودعات" list modal underneath it:
        await newImportManPage.closeAllBlockingModals();
      });

      await test.step('Submit the ECL request', async () => {
        //"تقديم الطلب" lives on the outer page here, not inside a modal - no re-open/re-edit cycle needed:
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
    } finally {
      await page.pause();
    }
  });

  //combined - Create All information ECL with Header Update, MAWB Add/Update/Delete, Arrived Bill Add/Update/Delete,
  //Item Add/Update/Delete, and Warehouse Add/Update/Delete - all in one ECL submission:
  test('All information ECL with header, MAWB, house bill, item, and warehouse changes', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(1_200_000);

    try {
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

        //the master bill's own declared quantity must match its house bill's delivered quantity (same rule
        //exercised by the "two warehouses" test above), so this needs totalOriginalQuantity: '2' to match the
        //house bill's deliveredQuantity: '2' below:
        const firstMasterBillData = { ...masterBillData, totalOriginalQuantity: '2' };

        await createNewEclPage.createTwoMasterBill(firstMasterBillData);
        await createNewEclPage.createMasterBill(secondMasterBillData);

        //the site requires an arrived bill's items AND its warehouses to each separately sum to the bill's own
        //delivered quantity (and items to also sum to delivered weight) before letting the step advance - the
        //first master bill's house bill starts with two items (50 each, quantity 1 each) and two warehouses
        //(quantity 1 each), matching a bumped delivered weight/quantity of 100/2:
        await createNewEclPage.addHouseBillWithTwoItems(
          { ...airwayBillData, deliveredQuantity: '2' },
          { ...billItemData, itemWeight: '50' },
          { ...billItemData, itemWeight: '50' },
          { ...warehouseData, warehouseCode: 'WH1' },
          { ...warehouseData, warehouseCode: 'WH2' },
          firstMasterBillData.billNo
        );
        await createNewEclPage.addHouseBill(airwayBillData, billItemData, warehouseData, secondMasterBillData.billNo);

        const { submittedReferenceNumber } = await createNewEclPage.submitManifest();
        referenceNo = submittedReferenceNumber;
        console.log('Reference Number:', referenceNo);
      });

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        received = await createNewEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

      await test.step('View manifest header', async () => {
        await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      });

      await test.step('Create ECL and select all-information type', async () => {
        await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
        await createNewEclPage.selectEclType('1');
        await createNewEclPage.clickChooseEclTypeButton();
      });

      await test.step('Header update: edit flight number and save & continue', async () => {
        const newFlightNumber = `MS222${Date.now().toString().slice(-5)}`;
        await newImportManPage.fillFlightNumber(newFlightNumber);
        await createNewEclPage.clickSaveAndContinueButton();
      });

      await test.step('MAWB update: edit the first master bill\'s weight', async () => {
        await createNewEclPage.clickEditOnMasterBillIfPresent();
        await createNewEclPage.fillMasterBillWeight('250');
        await createNewEclPage.clickSaveAndContinueButton();
        await createNewEclPage.fillMasterBillPaymentMethod(masterBillData.paymentMethod);
        await createNewEclPage.clickSaveButton();
      });

      await test.step('MAWB delete: remove the second master bill', async () => {
        await createNewEclPage.clickDeleteOnMasterBillIfPresent();
      });

      const thirdMasterBillData = {
        ...masterBillData,
        billNo: (parseInt(masterBillData.billNo, 10) + 2).toString(),
        //must match its own house bill's deliveredQuantity: '2' below, same rule as firstMasterBillData above:
        totalOriginalQuantity: '2',
      };

      await test.step('MAWB add: create a new (third) master bill with its own house bill', async () => {
        //this also exercises House Bill Add, Item Add and Warehouse Add, all part of addHouseBillWithTwoItems() -
        //two items (50 each) for the same weight/quantity-sum reason as the first master bill's house bill, since
        //clickEditOnArrivedBill() below targets whichever house bill is last on the page and either one (this one
        //or the first master bill's) could end up being the one edited:
        await createNewEclPage.createMasterBill(thirdMasterBillData);
        await createNewEclPage.addHouseBillWithTwoItems(
          { ...airwayBillData, deliveredQuantity: '2' },
          { ...billItemData, itemWeight: '50' },
          { ...billItemData, itemWeight: '50' },
          { ...warehouseData, warehouseCode: 'WH1' },
          { ...warehouseData, warehouseCode: 'WH2' },
          thirdMasterBillData.billNo
        );
      });

      await test.step('House bill update + item/warehouse add, update, delete', async () => {
        await createNewEclPage.clickEditOnArrivedBill();
        //manifestType, not deliveredWeight/Quantity, since those must keep matching the items' weight/quantity sum:
        await createNewEclPage.fillAirwayBillForm({ ...airwayBillData, manifestType: '5' });
        await createNewEclPage.clickSaveAndContinueButton();

        //items: delete one of the two starting items (50+50=100), add a new one (75), then edit that new item
        //down to 50 so the total is exactly 100 again right before navigating - the site requires items to sum to
        //the bill's delivered weight before letting the step advance. Editing the item last (nothing touches its
        //form afterward) avoids any ambiguity about which value ends up committed. "تعديل" doesn't need a
        //follow-up "إضافة" click to commit - just change the field and move to the next step:
        await createNewEclPage.clickDeleteItemButton();
        await createNewEclPage.fillBillItemForm({ ...billItemData, itemWeight: '75' });
        await createNewEclPage.clickAddAirwayBillModalButton();
        await createNewEclPage.clickEditItemButton();
        await createNewEclPage.fillBillItemForm({ ...billItemData, itemWeight: '50' });
        await createNewEclPage.clickSaveAndContinueButton();

        //warehouse: starts with two (WH1, WH2, quantity 1 each = 2, matching deliveredQuantity). Delete one, add
        //a new one (WH3, quantity 2), then edit that new one down to quantity 1 (renaming to ECLWH1) so the total
        //is exactly 2 again right before the final save - same quantity-sum requirement and "edit is the last
        //thing touched" safety as the items above:
        await createNewEclPage.clickDeleteWarehouseButton();
        await createNewEclPage.fillWarehouseForm({ ...warehouseData, warehouseCode: 'WH3', warehouseQuantity: '2' });
        await createNewEclPage.clickAddAirwayBillModalButton();
        await createNewEclPage.clickEditWarehouseGridButton();
        await createNewEclPage.fillWarehouseForm({ ...warehouseData, warehouseCode: 'ECLWH1', warehouseQuantity: '1' });

        await createNewEclPage.clickSaveButton();
      });

      let eclNumber = '';

      await test.step('View manifest again and open the ECL letter', async () => {
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

      await test.step('Save and submit the ECL', async () => {
        //don't open any bill's "التفاصيل" - just click through each wizard screen (master bills, house bill)
        //to reach the final "تقديم الطلب" submit button (button[data-i18n="submitButtonText"], via clickSaveButton() -
        //not clickSaveAndSubmitEcl()'s #submitDraftManifest, which isn't the button shown on this last screen).
        //submitting here shows a "تنبيه من فسح" success popup directly, not the usual "هل ترغب بتقديم المانيفست؟"
        //confirmation dialog, so it's closed the same way as other blocking popups instead of confirmManifestSubmission():
        await createNewEclPage.clickEditButton();
        await createNewEclPage.clickSaveAndContinueButton(); // header -> master bills
        await createNewEclPage.clickSaveAndContinueButton(); // master bills -> house bill
        await createNewEclPage.clickSaveButton();
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
    } finally {
      await page.pause();
    }
  });

  //49,50,51,52 - Create, view, Submit "Edit Warehouse information" ECL - Edit more than one warehouse
  test('create new ECL updating two warehouses', async ({ page, newImportManPage, createNewEclPage, newImportManifestData, masterBillData }) => {
    test.setTimeout(420_000);

    try {
      let referenceNo = '';

      await test.step('Create full import manifest with one master bill and two warehouses', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();
        await newImportManPage.clickCreateAirImportManifest();

        await newImportManPage.fillManifestForm(newImportManifestData);
        await newImportManPage.clickSaveAndConitnue();

        //quantities must sum: the master bill's own totalOriginalQuantity, the delivered quantity, and the item
        //quantity must all be 2 too, or the site rejects delivery with "الكمية الواصلة داخل البوليصة يجب أن لا
        //يتجاوز 1" (arrived quantity must not exceed the master bill's declared total) - split across two
        //warehouses of 1 each:
        const twoWarehouseMasterBillData = { ...masterBillData, totalOriginalQuantity: '2' };
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

        const { submittedReferenceNumber } = await createNewEclPage.submitManifest();
        referenceNo = submittedReferenceNumber;
        console.log('Reference Number:', referenceNo);
      });

      let received = false;

      await test.step('Wait for manifest status to become تم استلامها', async () => {
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        received = await createNewEclPage.waitForManifestStatus(
          referenceNo,
          'تم استلامها',
          { intervalMs: 5_000, timeoutMs: 120_000 }
        );
      });

      expect(received).toBe(true);

      await test.step('View manifest header', async () => {
        await createNewEclPage.openManifestByReferenceNumber(referenceNo);
      });

      await test.step('Create ECL for updating warehouse information', async () => {
        await createNewEclPage.clickCreateElectronicAmendmentLetterButton();
        await createNewEclPage.selectEclType('3');
        await createNewEclPage.clickChooseEclTypeButton();
      });

      await test.step('Edit both warehouse codes and save each', async () => {
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
    } finally {
      await page.pause();
    }
  });
});
