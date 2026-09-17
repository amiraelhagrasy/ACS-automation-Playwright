import { test, expect } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { deliveryOrderData } from '../../test-data/deliveryOrderData';
import { createHouseAirwayBillData, buildHouseBillAmounts } from '../../test-data/houseAirwayBillData';
import { ffwUser } from '../../test-data/users';
import { HouseAirwayBillPage } from '../../pages/Freight Forwarder/HouseAirwayBillPage';
import { InternalDeliveryOrderPage } from '../../pages/Freight Forwarder/InternalDeliveryOrderPage';

//Shared setup (shortened - no delivery order on the master bill): broker creates an import manifest + house
//bill and it is received, then the freight forwarder logs in and raises a reservation assignment
//(انشاء طلب تعيين بوالص) directly on that bill, submitting it with auto-accept. After that the bill is assigned
//to the ffw and ready to be split.
type SetupFixtures = {
  newImportManPage: any;
  viewImportManifestPage: any;
  newImportManifestData: any;
  masterBillData: any;
  loginPage: any;
  shippingAgentAssignmentsPage: any;
};

async function setupAssignedBill(f: SetupFixtures): Promise<void> {
  let importReferenceNo = '';

  await test.step('Create import manifest (normal bill) with a house bill and submit', async () => {
    await f.newImportManPage.clickAirServices();
    await f.newImportManPage.clickAirImportManifest();
    await f.newImportManPage.clickCreateAirImportManifest();
    await f.newImportManPage.fillManifestForm(f.newImportManifestData);
    await f.newImportManPage.clickSaveAndConitnue();

    const { submittedReferenceNumber } = await f.viewImportManifestPage.addMasterBillWithHouseBill(
      f.masterBillData,
      airwayBillData,
      billItemData,
      warehouseData
    );
    importReferenceNo = submittedReferenceNumber;
    console.log('Import Manifest Reference Number:', importReferenceNo);
    console.log('Bill Number:', f.masterBillData.billNo);
  });

  await test.step('Wait for import manifest to be received', async () => {
    await f.newImportManPage.clickAirServices();
    await f.newImportManPage.clickAirImportManifest();

    const received = await f.viewImportManifestPage.waitForManifestStatus(importReferenceNo, 'تم استلامها', {
      intervalMs: 5_000,
      timeoutMs: 150_000,
    });
    if (!received) {
      throw new Error(`Import manifest ${importReferenceNo} was not received in time`);
    }
  });

  await test.step('Login as the freight forwarder and raise a reservation assignment on the bill', async () => {
    await f.loginPage.logout();
    await f.loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');

    await f.shippingAgentAssignmentsPage.openAssignmentsList();
    await f.shippingAgentAssignmentsPage.openReservedBillsTab();
    await f.shippingAgentAssignmentsPage.clickCreateReservationRequest();

    await f.shippingAgentAssignmentsPage.fillReservationSearchForm(
      f.masterBillData.billDate,
      f.masterBillData.billNo,
      f.newImportManifestData.finalAirportText,
      f.masterBillData.transportCompany,
      f.newImportManifestData.flightNumber
    );

    const found = await f.shippingAgentAssignmentsPage.waitForReservationBillResult(f.masterBillData.billNo, {
      intervalMs: 15_000,
      timeoutMs: 180_000,
    });
    if (!found) {
      throw new Error(`Bill ${f.masterBillData.billNo} did not appear in the reservation search in time`);
    }

    await f.shippingAgentAssignmentsPage.checkReservationBillCheckbox(f.masterBillData.billNo);
    await f.shippingAgentAssignmentsPage.fillReceiverInfo(deliveryOrderData.receiverName, deliveryOrderData.receiverId);
    await f.shippingAgentAssignmentsPage.clickSaveReservationRequest();

    const requestNumber = await f.shippingAgentAssignmentsPage.getReservationRequestNumber();
    console.log('Reservation request number:', requestNumber);
    await f.shippingAgentAssignmentsPage.closeReservationRequestSuccessModal();

    await f.shippingAgentAssignmentsPage.openReservedBillsTab();
    await f.shippingAgentAssignmentsPage.searchReservedBillsByRequestNumber(requestNumber);
    await f.shippingAgentAssignmentsPage.openReservedBillRequest(requestNumber);
    await f.shippingAgentAssignmentsPage.clickEditReservationRequest();
    await f.shippingAgentAssignmentsPage.clickSubmitWithAutoAccept();

    const { deliveryOrderNumber } = await f.shippingAgentAssignmentsPage.readAndCloseAutoAcceptSuccessModal();
    console.log('Auto-accept delivery order number:', deliveryOrderNumber);
  });

  //the auto-accept creates a delivery order that the backend processes asynchronously - the bill can't be split
  //until that's done (splitting too early leaves the house bill wizard unable to advance past step 1, or pops a
  //"اذن التسليم ... غير مقبول للآن" modal). openBillAndStartHouseBillWizard() retries the modal case; give the
  //backend a head start here too.
  await test.step('Let the auto-accept settle', async () => {
    await new Promise((r) => setTimeout(r, 45_000));
  });
}

//these tests share the ffw11 / b3078 portal accounts, so they cannot run in parallel (the repo config has
//fullyParallel: true) - force them onto one worker, one after the other.
test.describe.configure({ mode: 'serial' });

test.describe('FFW reservation assignment, then split the bill into house air waybills', () => {
//Create,view,edit and submit Multiple HAWB with multiple items and warehouses for each HAWB:
  test('two house air waybills (50 + 50)', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
    shippingAgentAssignmentsPage,
  }) => {
    test.setTimeout(1_500_000);

    const houseAirwayBillPage = new HouseAirwayBillPage(page);
    const first = createHouseAirwayBillData('50');
    const second = createHouseAirwayBillData('50');
    const amounts = buildHouseBillAmounts('50');

    async function fillWizard(hawb: ReturnType<typeof createHouseAirwayBillData>) {
      console.log('HAWB Number:', hawb.hawbNumber);
      await houseAirwayBillPage.fillHouseBillHeader(hawb);
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillItem(amounts.item);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillWarehouse(amounts.warehouse);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSave();
    }

    await setupAssignedBill({
      newImportManPage,
      viewImportManifestPage,
      newImportManifestData,
      masterBillData,
      loginPage,
      shippingAgentAssignmentsPage,
    });

    await test.step('First house air waybill (50) - from بوالص قيد الانتظار', async () => {
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'pending');
      await fillWizard(first);
    });

    await test.step('Second house air waybill (50) - from بوالص قيد التقسيم', async () => {
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'splitting');
      await fillWizard(second);
    });

    await test.step('Submit the request and verify it lands in البوالص المكتملة', async () => {
      const assignmentNumber = await houseAirwayBillPage.clickSubmitRequest();
      console.log('House bills assignment number:', assignmentNumber);
      await houseAirwayBillPage.verifyBillInCompleted(assignmentNumber, masterBillData.billNo);
    });
  });
//Submit One HAWB containing all weights and quantities with multiple Items and warehouses:
  test('one house air waybill taking the whole bill (100)', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
    shippingAgentAssignmentsPage,
  }) => {
    test.setTimeout(1_500_000);

    const houseAirwayBillPage = new HouseAirwayBillPage(page);
    const hawb = createHouseAirwayBillData('100');
    const amounts = buildHouseBillAmounts('100');

    await setupAssignedBill({
      newImportManPage,
      viewImportManifestPage,
      newImportManifestData,
      masterBillData,
      loginPage,
      shippingAgentAssignmentsPage,
    });

    await test.step('One house air waybill (100) - from بوالص قيد الانتظار', async () => {
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'pending');

      console.log('HAWB Number:', hawb.hawbNumber);
      await houseAirwayBillPage.fillHouseBillHeader(hawb);
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillItem(amounts.item);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillWarehouse(amounts.warehouse);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSave();
    });

    await test.step('Submit the request and verify it lands in البوالص المكتملة', async () => {
      const assignmentNumber = await houseAirwayBillPage.clickSubmitRequest();
      console.log('House bills assignment number:', assignmentNumber);
      await houseAirwayBillPage.verifyBillInCompleted(assignmentNumber, masterBillData.billNo);
    });
  });
//Submit multiple HAWB containing up to 110% of total original weights and quantities:
  test('two house air waybills that together exceed the bill (50 + 60) - the second is rejected', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
    shippingAgentAssignmentsPage,
  }) => {
    test.setTimeout(1_500_000);

    const houseAirwayBillPage = new HouseAirwayBillPage(page);
    const first = createHouseAirwayBillData('50');
    const firstAmounts = buildHouseBillAmounts('50');
    const secondOverBill = createHouseAirwayBillData('60'); // 50 + 60 = 110 > the master bill's 100
    const secondAmounts = buildHouseBillAmounts('60');

    await setupAssignedBill({
      newImportManPage,
      viewImportManifestPage,
      newImportManifestData,
      masterBillData,
      loginPage,
      shippingAgentAssignmentsPage,
    });

    await test.step('First house air waybill (50) - from بوالص قيد الانتظار', async () => {
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'pending');
      console.log('HAWB Number:', first.hawbNumber);
      await houseAirwayBillPage.fillHouseBillHeader(first);
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillItem(firstAmounts.item);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillWarehouse(firstAmounts.warehouse);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSave();
    });

    await test.step('Second house air waybill (60) - only 50 is left, so it must be rejected', async () => {
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'splitting');
      console.log('HAWB Number (should be rejected):', secondOverBill.hawbNumber);
      const { stage, text } = await houseAirwayBillPage.createHouseBillExpectingReject(secondOverBill, secondAmounts);
      console.log(`Rejected at stage "${stage}": ${text}`);
      expect(text.length).toBeGreaterThan(0);
    });
  });

  //continues past the split: after the house bills are submitted, take one of the sub bills (a HAWB) and raise
  //a delivery order (إذن تسليم) against it via "إذن التسليم الجوي الداخلي".
  test('raise a delivery order against a sub bill (house air waybill)', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
    shippingAgentAssignmentsPage,
  }) => {
    test.setTimeout(1_500_000);

    const houseAirwayBillPage = new HouseAirwayBillPage(page);
    const internalDeliveryOrderPage = new InternalDeliveryOrderPage(page);
    const first = createHouseAirwayBillData('50');
    const second = createHouseAirwayBillData('50');
    const amounts = buildHouseBillAmounts('50');

    async function fillWizard(hawb: ReturnType<typeof createHouseAirwayBillData>) {
      console.log('HAWB Number:', hawb.hawbNumber);
      await houseAirwayBillPage.fillHouseBillHeader(hawb);
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillItem(amounts.item);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillWarehouse(amounts.warehouse);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSave();
    }

    await setupAssignedBill({
      newImportManPage,
      viewImportManifestPage,
      newImportManifestData,
      masterBillData,
      loginPage,
      shippingAgentAssignmentsPage,
    });

    await test.step('Split the bill into two house air waybills and submit', async () => {
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'pending');
      await fillWizard(first);
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'splitting');
      await fillWizard(second);

      const assignmentNumber = await houseAirwayBillPage.clickSubmitRequest();
      console.log('House bills assignment number:', assignmentNumber);
      await houseAirwayBillPage.verifyBillInCompleted(assignmentNumber, masterBillData.billNo);
    });

    await test.step('Raise a delivery order (إذن تسليم) against one of the sub bills and submit it', async () => {
      console.log('Sub bill (HAWB) to raise a delivery order on:', first.hawbNumber);
      await internalDeliveryOrderPage.openMenu();
      await internalDeliveryOrderPage.clickCreate();
      await internalDeliveryOrderPage.fillForm(deliveryOrderData, first.hawbNumber, '65');

      const ref = await internalDeliveryOrderPage.clickSave();
      console.log('Internal delivery order reference:', ref);
      expect(ref).not.toBe('');

      await internalDeliveryOrderPage.searchByReference(ref);
      await internalDeliveryOrderPage.openByReference(ref);
      await internalDeliveryOrderPage.clickEdit();
      await internalDeliveryOrderPage.clickSubmit();
      console.log('Internal delivery order submitted:', ref);
    });
  });

  //negative case: same sub-bill delivery order flow, but with an invalid importer number filled in - gets rejected
  //once submitted (mirrors newDeliveryOrder.spec.ts's "create air delivery order with invalid importer gets
  //rejected" test, but against a house air waybill via InternalDeliveryOrderPage instead of the broker form).
  test('raise a delivery order against a sub bill with an invalid importer - gets rejected', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
    shippingAgentAssignmentsPage,
  }) => {
    test.setTimeout(1_500_000);

    const houseAirwayBillPage = new HouseAirwayBillPage(page);
    const internalDeliveryOrderPage = new InternalDeliveryOrderPage(page);
    const first = createHouseAirwayBillData('50');
    const second = createHouseAirwayBillData('50');
    const amounts = buildHouseBillAmounts('50');

    async function fillWizard(hawb: ReturnType<typeof createHouseAirwayBillData>) {
      console.log('HAWB Number:', hawb.hawbNumber);
      await houseAirwayBillPage.fillHouseBillHeader(hawb);
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillItem(amounts.item);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillWarehouse(amounts.warehouse);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSave();
    }

    await setupAssignedBill({
      newImportManPage,
      viewImportManifestPage,
      newImportManifestData,
      masterBillData,
      loginPage,
      shippingAgentAssignmentsPage,
    });

    await test.step('Split the bill into two house air waybills and submit', async () => {
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'pending');
      await fillWizard(first);
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'splitting');
      await fillWizard(second);

      const assignmentNumber = await houseAirwayBillPage.clickSubmitRequest();
      console.log('House bills assignment number:', assignmentNumber);
      await houseAirwayBillPage.verifyBillInCompleted(assignmentNumber, masterBillData.billNo);
    });

    let ref = '';

    await test.step('Raise a delivery order against a sub bill, fill in an invalid importer, and save as draft', async () => {
      console.log('Sub bill (HAWB) to raise a delivery order on:', first.hawbNumber);
      await internalDeliveryOrderPage.openMenu();
      await internalDeliveryOrderPage.clickCreate();
      await internalDeliveryOrderPage.fillForm(deliveryOrderData, first.hawbNumber, '65');
      await internalDeliveryOrderPage.fillImporterNo('مؤسسة قريطة للتجارة');

      ref = await internalDeliveryOrderPage.clickSave();
      console.log('Internal delivery order reference:', ref);
      expect(ref).not.toBe('');
    });

    await test.step('Reopen the draft, edit it, and submit', async () => {
      await internalDeliveryOrderPage.searchByReference(ref);
      await internalDeliveryOrderPage.openByReference(ref);
      await internalDeliveryOrderPage.clickEdit();
      await internalDeliveryOrderPage.clickSubmit();
    });

    //the edit->submit above occasionally no-ops (same quirk documented for the broker DEO flow in
    //setupAssignedBill() - the request stays at مسودة instead of moving on) - check for that and re-submit if so,
    //rather than waiting the full 3 minutes below just to find out it never left مسودة.
    await test.step('Confirm the submit actually went through - re-submit if it silently stayed at مسودة', async () => {
      await internalDeliveryOrderPage.openMenu();

      for (let attempt = 1; attempt <= 2; attempt++) {
        await internalDeliveryOrderPage.searchByReference(ref);
        const status = await internalDeliveryOrderPage.getStatus(ref);
        console.log(`Internal delivery order ${ref} status after submit (check ${attempt}): ${status}`);

        if (!status.includes('مسودة')) break;

        console.log(`Still مسودة - re-opening and re-submitting (attempt ${attempt})`);
        await internalDeliveryOrderPage.openByReference(ref);
        await internalDeliveryOrderPage.clickEdit();
        await internalDeliveryOrderPage.clickSubmit();
        await internalDeliveryOrderPage.openMenu();
      }
    });

    await test.step('Check the internal delivery order status until مرفوض (up to 3 minutes)', async () => {
      const rejected = await internalDeliveryOrderPage.waitForStatus(ref, 'مرفوض', {
        intervalMs: 5_000,
        timeoutMs: 180_000,
      });

      console.log('Internal delivery order rejected:', rejected);
      expect(rejected).toBe(true);
    });
  });
});
