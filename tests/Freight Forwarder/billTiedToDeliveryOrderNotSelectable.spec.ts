import { test, expect } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { deliveryOrderData } from '../../test-data/deliveryOrderData';
import { ffwUser } from '../../test-data/users';

test.describe('Bill tied to a delivery order is not selectable in a reservation request', () => {
  //Scenario: create an import manifest + house bill, raise a delivery order (إذن تسليم) against that bill,
  //then log in as the freight forwarder and start a "انشاء طلب تعيين بوالص". Searching for the same bill must
  //return it in the results but with its checkbox DISABLED - a bill already linked to a delivery order can't be
  //reserved here. The test passes when the bill is found but not selectable.
  test('the bill appears in the reservation search but its checkbox is disabled', async ({
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

      await test.step('Open البوالص المعينة and start a new reservation request', async () => {
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
    } finally {
      await page.pause();
    }
  });
});
