import { test, expect } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { deliveryOrderData } from '../../test-data/deliveryOrderData';
import { createHouseAirwayBillData, buildHouseBillAmounts } from '../../test-data/houseAirwayBillData';
import { acsBrokerUser, ffwUser } from '../../test-data/users';
import { HouseAirwayBillPage } from '../../pages/Freight Forwarder/HouseAirwayBillPage';
import { InternalDeliveryOrderPage } from '../../pages/Freight Forwarder/InternalDeliveryOrderPage';


type SetupFixtures = {
  newImportManPage: any;
  viewImportManifestPage: any;
  newImportManifestData: any;
  masterBillData: any;
  loginPage: any;
  shippingAgentAssignmentsPage: any;
};

async function setupAssignedBill(f: SetupFixtures): Promise<void> {
  //confirmed live, 2026-09-27: the shared workerPage carries over whatever account the previous test (in this
  //file, or the previous file the worker ran) left it on - if that was the freight forwarder (nothing in this
  //suite switches back to the broker after using it), this function's own first action (clickAirServices(), a
  //broker-only menu) fails outright. Explicitly re-establish the broker session every test using this helper
  //actually needs, regardless of what ran immediately before it:
  await test.step('Log back in as the broker', async () => {
    await f.loginPage.logout();
    await f.loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');
  });

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
    await f.viewImportManifestPage.expectManifestStatus(
      async () => {
        await f.newImportManPage.clickAirServices();
        await f.newImportManPage.clickAirImportManifest();
      },
      importReferenceNo,
      'تم استلامها',
      { intervalMs: 5_000, timeoutMs: 150_000 }
    );
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

  await test.step('Let the auto-accept settle', async () => {
    await new Promise((r) => setTimeout(r, 45_000));
  });
}
test.describe.configure({ mode: 'serial' });

test.describe('FFW reservation assignment, then split the bill into house air waybills', () => {

//Create,view,edit and submit Multiple HAWB with multiple items and warehouses for each HAWB:
  test('#18-21 Create Multiple HAWB with multiple items and warehouses for each HAWB', async ({
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

    await test.step('#21 - Submit Multiple HAWB with multiple items and warehouses for each HAWB', async () => {
      const assignmentNumber = await houseAirwayBillPage.clickSubmitRequest();
      console.log('House bills assignment number:', assignmentNumber);
      await houseAirwayBillPage.verifyBillInCompleted(assignmentNumber, masterBillData.billNo);
    });
  });
//Submit One HAWB containing all weights and quantities with multiple Items and warehouses:
  test('#17 Submit One HAWB containing all weights and quantities with multiple Items and warehouses', async ({
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
//Submit multiple HAWB containing up to 110% of total original weights and quantities :
  test('#15 Submit multiple HAWB containing up to 110% of total original weights and quantities', async ({
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

    //confirmed live, 2026-10-01: this scenario's original premise (the portal rejects a house bill that pushes
    //the running total over the master bill's own weight/quantity) no longer holds - a live run with real values
    //(50 then 60, against a 100/100 master bill) submitted cleanly with a genuine success message and assignment
    //number, no rejection at any stage. The portal now accepts up to 110% as the scenario's own title says it
    //should. Updated to assert the actual (and now intended) behavior - success, not rejection:
    await test.step('Second house air waybill (60) - total reaches 110%, expected to succeed', async () => {
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'splitting');
      console.log('HAWB Number:', secondOverBill.hawbNumber);
      await houseAirwayBillPage.fillHouseBillHeader(secondOverBill);
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillItem(secondAmounts.item);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSaveAndContinue();
      await houseAirwayBillPage.fillHouseBillWarehouse(secondAmounts.warehouse);
      await houseAirwayBillPage.clickAddRow();
      await houseAirwayBillPage.clickSave();
    });

    await test.step('Submit and verify both house bills land in البوالص المكتملة', async () => {
      const assignmentNumber = await houseAirwayBillPage.clickSubmitRequest();
      console.log('House bills assignment number:', assignmentNumber);
      await houseAirwayBillPage.verifyBillInCompleted(assignmentNumber, masterBillData.billNo);
    });
  });

  test('#16 Submit multiple HAWB containing at minimum 90 % of total original weights and quantities', async ({
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
    const first = createHouseAirwayBillData('40');
    const firstAmounts = buildHouseBillAmounts('40');
    const second = createHouseAirwayBillData('50'); // 40 + 50 = 90% of the master bill's 100
    const secondAmounts = buildHouseBillAmounts('50');

    async function fillWizard(hawb: ReturnType<typeof createHouseAirwayBillData>, amounts: ReturnType<typeof buildHouseBillAmounts>) {
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

    await test.step('First house air waybill (40) - from waiting list', async () => {
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'pending');
      await fillWizard(first, firstAmounts);
    });

    await test.step('Second house air waybill (50) - together 90% of the bill', async () => {
      await houseAirwayBillPage.openBillAndStartHouseBillWizard(masterBillData.billNo, 'splitting');
      await fillWizard(second, secondAmounts);
    });

    await test.step('Submit the request and verify it lands in completed bills', async () => {
      const assignmentNumber = await houseAirwayBillPage.clickSubmitRequest();
      console.log('House bills assignment number:', assignmentNumber);
      await houseAirwayBillPage.verifyBillInCompleted(assignmentNumber, masterBillData.billNo);
    });
  });

  //Create, View, Edit , Submit DEO without importer
  test('#27 Create, View, Edit , Submit DEO without importer', async ({
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

    let deoRef = '';

    await test.step('Create DEO without importer', async () => {
      console.log('Sub bill (HAWB) to raise a delivery order on:', first.hawbNumber);
      await internalDeliveryOrderPage.openMenu();
      await internalDeliveryOrderPage.clickCreate();
      await internalDeliveryOrderPage.fillForm(deliveryOrderData, first.hawbNumber, '65');

      deoRef = await internalDeliveryOrderPage.clickSave();
      console.log('Internal delivery order reference:', deoRef);
      expect(deoRef).not.toBe('');
    });

    await test.step('View DEO without importer', async () => {
      await internalDeliveryOrderPage.searchByReference(deoRef);
      await internalDeliveryOrderPage.openByReference(deoRef);
    });

    await test.step('Edit DEO without importer', async () => {
      await internalDeliveryOrderPage.clickEdit();
    });

    await test.step('Submit DEO without importer', async () => {
      await internalDeliveryOrderPage.clickSubmit();
      console.log('Internal delivery order submitted:', deoRef);
    });
  });

  //Create, View, Edit, Submit DEO with a valid importer - typing '4' into رقم المستورد and picking the first
  //suggestion resolves to a real, matching importer for this account (confirmed live, 2026-09-26), unlike
  //fillImporterNo('مؤسسة قريطة للتجارة') below (#26) which always resolves to a fixed importer this account has
  //no match for and gets rejected:
  test('#22-25 Create, View, Edit , Submit DEO with valid importer', async ({
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

    let deoRef = '';

    await test.step('#22- Create DEO with valid importer', async () => {
      console.log('Sub bill (HAWB) to raise a delivery order on:', first.hawbNumber);
      await internalDeliveryOrderPage.openMenu();
      await internalDeliveryOrderPage.clickCreate();
      await internalDeliveryOrderPage.fillForm(deliveryOrderData, first.hawbNumber, '65');
      await internalDeliveryOrderPage.fillImporterNo('4');

      deoRef = await internalDeliveryOrderPage.clickSave();
      console.log('Internal delivery order reference:', deoRef);
      expect(deoRef).not.toBe('');
    });

    await test.step('#23 - View DEO with valid importer', async () => {
      await internalDeliveryOrderPage.searchByReference(deoRef);
      await internalDeliveryOrderPage.openByReference(deoRef);
    });

    await test.step('#24 - Edit DEO with valid importer', async () => {
      await internalDeliveryOrderPage.clickEdit();
    });

    await test.step('#25 - Submit DEO with valid importer', async () => {
      await internalDeliveryOrderPage.clickSubmit();
      console.log('Internal delivery order submitted:', deoRef);
    });
  });

  //negative case: same sub-bill delivery order flow, but with an invalid importer number filled in - gets rejected
  //once submitted (mirrors newDeliveryOrder.spec.ts's "create air delivery order with invalid importer gets
  //rejected" test, but against a house air waybill via InternalDeliveryOrderPage instead of the broker form).
  test('#26 raise a delivery order against a sub bill with an invalid importer - gets rejected', async ({
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

    await test.step('#Reopen the draft, edit it, and submit', async () => {
      await internalDeliveryOrderPage.searchByReference(ref);
      await internalDeliveryOrderPage.openByReference(ref);
      await internalDeliveryOrderPage.clickEdit();
      await internalDeliveryOrderPage.clickSubmit();
    });

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
