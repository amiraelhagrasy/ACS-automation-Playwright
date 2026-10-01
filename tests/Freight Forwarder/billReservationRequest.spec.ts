import { test, expect } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData, masterBillData as defaultMasterBillData } from '../../test-data/masterBillData';
import { deliveryOrderData } from '../../test-data/deliveryOrderData';
import { newImportManifestData as defaultNewImportManifestData } from '../../test-data/newImportManifestData';
import { acsBrokerUser, ffwUser } from '../../test-data/users';


const fixedBillNo = process.env.RES_BILL_NO ?? '108026008';
const fixedBillDate = process.env.RES_BILL_DATE ?? '17-08-2026';
const fixedBillAirport = process.env.RES_AIRPORT ?? defaultNewImportManifestData.finalAirportText;
const fixedBillTransportCompany = process.env.RES_CARRIER ?? defaultMasterBillData.transportCompany;
const fixedBillFlightNumber = process.env.RES_FLIGHT ?? '';

//8,9,10,11 Create a Bill Reservation Request for a valid bill,View Bill Reservation Request for a valid bill,Edit Bill Reservation Request for a valid bill,Submit Bill Reservation Request for a valid bill

test.describe('Bill Reservation Request Test', () => {

  test('#8-11 Create a Bill Reservation Request for a valid bill', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
    shippingAgentAssignmentsPage,
  }) => {
    test.setTimeout(600_000);

    let importReferenceNo = '';

    await test.step('Create import manifest (normal bill) with a house bill and submit', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await newImportManPage.clickCreateAirImportManifest();
      await newImportManPage.fillManifestForm(newImportManifestData);
      await newImportManPage.clickSaveAndConitnue();

      const { submittedReferenceNumber } = await viewImportManifestPage.addMasterBillWithHouseBill(
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );
      importReferenceNo = submittedReferenceNumber;
      console.log('Import Manifest Reference Number:', importReferenceNo);
      console.log('Bill Number:', masterBillData.billNo);
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

    await test.step('Logout and login as the freight forwarder', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');
    });

    await test.step('Open assignments list, then reserved bills', async () => {
      await shippingAgentAssignmentsPage.openAssignmentsList();
      await shippingAgentAssignmentsPage.openReservedBillsTab();
    });

    await test.step('Click Create Reservation Request', async () => {
      await shippingAgentAssignmentsPage.clickCreateReservationRequest();
    });

    await test.step('Fill bill data and search until the bill appears (up to 3 minutes)', async () => {
      await shippingAgentAssignmentsPage.fillReservationSearchForm(
        masterBillData.billDate,
        masterBillData.billNo,
        newImportManifestData.finalAirportText,
        masterBillData.transportCompany,
        newImportManifestData.flightNumber
      );

      const found = await shippingAgentAssignmentsPage.waitForReservationBillResult(masterBillData.billNo, {
        intervalMs: 15_000,
        timeoutMs: 180_000,
      });

      if (!found) {
        throw new Error(`Bill ${masterBillData.billNo} did not appear in the reservation search in time`);
      }
    });

    await test.step('Check the matching bill checkbox', async () => {
      await shippingAgentAssignmentsPage.checkReservationBillCheckbox(masterBillData.billNo);
    });

    await test.step('#8 - Create a Bill Reservation Request for a valid bill', async () => {
      await shippingAgentAssignmentsPage.fillReceiverInfo(
        deliveryOrderData.receiverName,
        deliveryOrderData.receiverId
      );

      await shippingAgentAssignmentsPage.clickSaveReservationRequest();
    });

    let requestNumber = '';

    await test.step('Get the request number and close the success modal', async () => {
      requestNumber = await shippingAgentAssignmentsPage.getReservationRequestNumber();
      console.log('Request Number:', requestNumber);

      await shippingAgentAssignmentsPage.closeReservationRequestSuccessModal();
    });

    await test.step('#9 - View Bill Reservation Request for a valid bill', async () => {
      await shippingAgentAssignmentsPage.openReservedBillsTab();
      await shippingAgentAssignmentsPage.searchReservedBillsByRequestNumber(requestNumber);
      await shippingAgentAssignmentsPage.openReservedBillRequest(requestNumber);
    });

    await test.step('#10- Edit Bill Reservation Request for a valid bill', async () => {
      await shippingAgentAssignmentsPage.clickEditReservationRequest();
    });
    await test.step('#11- submit Bill Reservation Request for a valid bill', async () => {
      await shippingAgentAssignmentsPage.clickSubmitWithAutoAccept();
    });
  });

  //Scenario: create an import manifest + house bill, raise a delivery order (إذن تسليم) against that bill,
  //then log in as the freight forwarder and confirm that the bill appears in the reservation search but its
  //checkbox is disabled:
  test('#12 Create Bill Reservation Request for a Bill Linked to a DEO', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
    loginPage,
    shippingAgentAssignmentsPage,
  }) => {
    test.setTimeout(900_000);

    //confirmed live, 2026-09-27: the shared workerPage carries over whatever account the PREVIOUS test in this
    //file left it on - #8-11 (declared right before this test) switches to the freight forwarder and never
    //switches back, so this test's very first action (clickAirServices(), a broker-only menu) failed outright
    //since the page was still logged in as ffw11. Explicitly re-establish the broker session this test actually
    //needs, the same way #13 below unconditionally switches to whichever account IT needs regardless of what ran
    //before it:
    await test.step('Log back in as the broker', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');
    });

    let importReferenceNo = '';

    await test.step('Create import manifest (normal bill) with a house bill and submit', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await newImportManPage.clickCreateAirImportManifest();
      await newImportManPage.fillManifestForm(newImportManifestData);
      await newImportManPage.clickSaveAndConitnue();

      const { submittedReferenceNumber } = await viewImportManifestPage.addMasterBillWithHouseBill(
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );
      importReferenceNo = submittedReferenceNumber;
      console.log('Import Manifest Reference Number:', importReferenceNo);
      console.log('Bill Number:', masterBillData.billNo);
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

    let deliveryOrderRefNo = '';

    await test.step('Create a delivery order against the bill and submit it', async () => {
      await newDeliveryOrderPage.clickAirServices();
      await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
      await newDeliveryOrderPage.clickCreateDeliveryOrderButton();

      await newDeliveryOrderPage.fillDeliveryOrderForm(
        deliveryOrderData,
        masterBillData.billNo,
        importReferenceNo,
        masterBillData.transportCompany
      );

      deliveryOrderRefNo = await newDeliveryOrderPage.clickSaveButton();
      console.log('Delivery Order Reference Number:', deliveryOrderRefNo);
      expect(deliveryOrderRefNo).not.toBe('');

      await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
      await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
      await newDeliveryOrderPage.clickEditButton();
      await newDeliveryOrderPage.clickSubmitButton();
    });

    await test.step('Wait for the delivery order to be accepted (مقبول)', async () => {
      await newDeliveryOrderPage.clickAirServices();
      await newDeliveryOrderPage.clickAirDeliveryOrderMenu();

      const accepted = await newDeliveryOrderPage.waitForDeliveryOrderStatus(deliveryOrderRefNo, 'مقبول', {
        intervalMs: 5_000,
        timeoutMs: 180_000,
      });

      console.log('Delivery Order Accepted:', accepted);
      expect(accepted).toBe(true);
    });

    await test.step('Logout and login as the freight forwarder', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');
    });

    await test.step('Open Reserved Bills tab and start a new reservation request', async () => {
      await shippingAgentAssignmentsPage.openAssignmentsList();
      await shippingAgentAssignmentsPage.openReservedBillsTab();
      await shippingAgentAssignmentsPage.clickCreateReservationRequest();
    });

    await test.step('Search for the same bill and confirm it is found but not selectable', async () => {
      await shippingAgentAssignmentsPage.fillReservationSearchForm(
        masterBillData.billDate,
        masterBillData.billNo,
        newImportManifestData.finalAirportText,
        masterBillData.transportCompany,
        newImportManifestData.flightNumber
      );

      const found = await shippingAgentAssignmentsPage.waitForReservationBillResult(masterBillData.billNo, {
        intervalMs: 15_000,
        timeoutMs: 180_000,
      });

      if (!found) {
        throw new Error(`Bill ${masterBillData.billNo} did not appear in the reservation search in time`);
      }

      await shippingAgentAssignmentsPage.verifyReservationBillNotSelectable(masterBillData.billNo);
    });
  });

  test('#13 Create Bill Reservation Request for a Bill Linked to a Declaration', async ({
    page,
    loginPage,
    shippingAgentAssignmentsPage,
  }) => {
    test.setTimeout(600_000);

    //the shared fixture logs in as the broker by default - this scenario never needs a broker session, so it
    //switches straight to the freight forwarder (وسيط شحن) before doing anything else:
    await test.step('Logout and login as the freight forwarder', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');
    });

    await test.step('Open البوالص المعينة and start a new reservation request', async () => {
      await shippingAgentAssignmentsPage.openAssignmentsList();
      await shippingAgentAssignmentsPage.openReservedBillsTab();
      await shippingAgentAssignmentsPage.clickCreateReservationRequest();
    });

    await test.step('Search for the fixed bill and confirm it is found but not selectable', async () => {
      await shippingAgentAssignmentsPage.fillReservationSearchForm(
        fixedBillDate,
        fixedBillNo,
        fixedBillAirport,
        fixedBillTransportCompany,
        fixedBillFlightNumber || undefined
      );

      const found = await shippingAgentAssignmentsPage.waitForReservationBillResult(fixedBillNo, {
        intervalMs: 15_000,
        timeoutMs: 180_000,
      });

      if (!found) {
        throw new Error(`Bill ${fixedBillNo} did not appear in the reservation search in time`);
      }

      await shippingAgentAssignmentsPage.verifyReservationBillNotSelectable(fixedBillNo);
    });
  });
});
