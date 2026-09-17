import { test, expect } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { deliveryOrderData } from '../../test-data/deliveryOrderData';
import { ffwUser } from '../../test-data/users';

//8,9,10,11 Create a Bill Reservation Request for a valid billوView Bill Reservation Request for a valid billوEdit Bill Reservation Request for a valid billوSubmit Bill Reservation Request for a valid bill

test.describe('Bill Reservation Request Test', () => {

  test('Create a Bill Reservation Request for a valid bill', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
    shippingAgentAssignmentsPage,
  }) => {
    test.setTimeout(600_000);

    try {
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
        await newImportManPage.clickAirServices();
        await newImportManPage.clickAirImportManifest();

        const received = await viewImportManifestPage.waitForManifestStatus(importReferenceNo, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });

        if (!received) {
          throw new Error(`Import manifest ${importReferenceNo} was not received in time`);
        }
      });

      await test.step('Logout and login as the freight forwarder', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');
      });

      await test.step('Open assignments list, then البوالص المعينة', async () => {
        await shippingAgentAssignmentsPage.openAssignmentsList();
        await shippingAgentAssignmentsPage.openReservedBillsTab();
      });

      await test.step('Click انشاء طلب تعيين بوالص', async () => {
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

      await test.step('Fill receiver info and save', async () => {
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

      await test.step('Reopen البوالص المعينة, search by request number, and open it', async () => {
        await shippingAgentAssignmentsPage.openReservedBillsTab();
        await shippingAgentAssignmentsPage.searchReservedBillsByRequestNumber(requestNumber);
        await shippingAgentAssignmentsPage.openReservedBillRequest(requestNumber);
      });

      await test.step('Edit the request, then submit with auto-accept', async () => {
        await shippingAgentAssignmentsPage.clickEditReservationRequest();
        await shippingAgentAssignmentsPage.clickSubmitWithAutoAccept();
      });
    } finally {
      await page.pause();
    }
  });
});
