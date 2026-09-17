import { test, expect } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { deliveryOrderData } from '../../test-data/deliveryOrderData';
import { acsBrokerUser, ffwUser } from '../../test-data/users';

test.describe('Create New Air Delivery Order Test', () => {
  //1,2,3,4- Create, View, Edit, Submit DEO without FFW:
  test('create new air delivery order', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
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

      await test.step('Open Air Delivery Order creation form', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
        await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
      });

      let deliveryOrderRefNo = '';

      await test.step('Fill delivery order form (linking the received bill) and save as draft', async () => {
        await newDeliveryOrderPage.fillDeliveryOrderForm(
          deliveryOrderData,
          masterBillData.billNo,
          importReferenceNo,
          masterBillData.transportCompany
        );

        deliveryOrderRefNo = await newDeliveryOrderPage.clickSaveButton();
        console.log('Delivery Order Reference Number:', deliveryOrderRefNo);

        expect(deliveryOrderRefNo).not.toBe('');
      });

      await test.step('Reopen the draft, edit it, and submit', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickEditButton();
        await newDeliveryOrderPage.clickSubmitButton();
      });

      await test.step('Check delivery order status every 5 seconds until مقبول (up to 3 minutes)', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();

        const accepted = await newDeliveryOrderPage.waitForDeliveryOrderStatus(deliveryOrderRefNo, 'مقبول', {
          intervalMs: 5_000,
          timeoutMs: 180_000,
        });

        console.log('Delivery Order Accepted:', accepted);
        expect(accepted).toBe(true);
      });
    } finally {
      await page.pause();
    }
  });

  //5. Create Air Delivery Order with an invalid importer - gets rejected:
  test('create air delivery order with invalid importer gets rejected', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
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

      await test.step('Open Air Delivery Order creation form', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
        await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
      });

      let deliveryOrderRefNo = '';

      await test.step('Fill delivery order form, select an importer, and save as draft', async () => {
        await newDeliveryOrderPage.fillDeliveryOrderForm(
          deliveryOrderData,
          masterBillData.billNo,
          importReferenceNo,
          masterBillData.transportCompany
        );

        await newDeliveryOrderPage.fillImporterNo('مؤسسة قريطة للتجارة');

        deliveryOrderRefNo = await newDeliveryOrderPage.clickSaveButton();
        console.log('Delivery Order Reference Number:', deliveryOrderRefNo);

        expect(deliveryOrderRefNo).not.toBe('');
      });

      await test.step('Reopen the draft, edit it, and submit', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickEditButton();
        await newDeliveryOrderPage.clickSubmitButton();
      });

      await test.step('Check delivery order status every 5 seconds until مرفوض (up to 3 minutes)', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();

        const rejected = await newDeliveryOrderPage.waitForDeliveryOrderStatus(deliveryOrderRefNo, 'مرفوض', {
          intervalMs: 5_000,
          timeoutMs: 180_000,
        });

        console.log('Delivery Order Rejected:', rejected);
        expect(rejected).toBe(true);
      });

      await test.step('Open the delivery order, then the document history tab, and view the rejection details', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickHistoryTab();
        await newDeliveryOrderPage.clickHistoryDetailsButton();
      });
    } finally {
      await page.pause();
    }
  });

  //6,7,8,9. Createو,View , Edit , Submit DEO with a valid FFW
  test('create air delivery order with freight forwarder referral', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
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

      await test.step('Open Air Delivery Order creation form', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
        await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
      });

      let deliveryOrderRefNo = '';

      await test.step('Fill delivery order form, refer to a freight forwarder, and save as draft', async () => {
        await newDeliveryOrderPage.fillDeliveryOrderForm(
          deliveryOrderData,
          masterBillData.billNo,
          importReferenceNo,
          masterBillData.transportCompany
        );

        await newDeliveryOrderPage.checkReferToFreightForwarder();
        await newDeliveryOrderPage.fillFreightForwarder('7001');

        deliveryOrderRefNo = await newDeliveryOrderPage.clickSaveButton();
        console.log('Delivery Order Reference Number:', deliveryOrderRefNo);

        expect(deliveryOrderRefNo).not.toBe('');
      });

      await test.step('Reopen the draft, edit it, and submit', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickEditButton();
        await newDeliveryOrderPage.clickSubmitButton();
      });

      await test.step('Check delivery order status every 5 seconds until محالة الى وسيط الشحن (up to 3 minutes)', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();

        const referred = await newDeliveryOrderPage.waitForDeliveryOrderStatus(deliveryOrderRefNo, 'محالة الى وسيط الشحن', {
          intervalMs: 5_000,
          timeoutMs: 180_000,
        });

        console.log('Delivery Order Referred to Freight Forwarder:', referred);
        expect(referred).toBe(true);
      });

      //accepting the referral is a separate session from the broker's (b3078) - logs out and back in as the
      //freight forwarder (ffw11):
      await test.step('Logout and accept the referral request as the freight forwarder', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');

        await shippingAgentAssignmentsPage.openAssignmentsList();
        await shippingAgentAssignmentsPage.acceptManifest(importReferenceNo, {
          intervalMs: 10_000,
          timeoutMs: 180_000,
        });
      });
    } finally {
      await page.pause();
    }
  });

  //same as the referral+accept test above, but continues on to the withdraw-request flow - built up step by
  //step, confirming each one live before adding the next:
  test('create air delivery order with freight forwarder referral and accept withdrawal request', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
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

      await test.step('Open Air Delivery Order creation form', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
        await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
      });

      let deliveryOrderRefNo = '';

      await test.step('Fill delivery order form, refer to a freight forwarder, and save as draft', async () => {
        await newDeliveryOrderPage.fillDeliveryOrderForm(
          deliveryOrderData,
          masterBillData.billNo,
          importReferenceNo,
          masterBillData.transportCompany
        );

        await newDeliveryOrderPage.checkReferToFreightForwarder();
        await newDeliveryOrderPage.fillFreightForwarder('7001');

        deliveryOrderRefNo = await newDeliveryOrderPage.clickSaveButton();
        console.log('Delivery Order Reference Number:', deliveryOrderRefNo);

        expect(deliveryOrderRefNo).not.toBe('');
      });

      await test.step('Reopen the draft, edit it, and submit', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickEditButton();
        await newDeliveryOrderPage.clickSubmitButton();
      });

      await test.step('Check delivery order status every 5 seconds until محالة الى وسيط الشحن (up to 3 minutes)', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();

        const referred = await newDeliveryOrderPage.waitForDeliveryOrderStatus(deliveryOrderRefNo, 'محالة الى وسيط الشحن', {
          intervalMs: 5_000,
          timeoutMs: 180_000,
        });

        console.log('Delivery Order Referred to Freight Forwarder:', referred);
        expect(referred).toBe(true);
      });

      //accepting the referral is a separate session from the broker's (b3078) - logs out and back in as the
      //freight forwarder (ffw11):
      await test.step('Logout and accept the referral request as the freight forwarder', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');

        await shippingAgentAssignmentsPage.openAssignmentsList();
        await shippingAgentAssignmentsPage.acceptManifest(importReferenceNo, {
          intervalMs: 10_000,
          timeoutMs: 180_000,
        });
      });

      await test.step('Logout and login as the broker', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');
      });

      const withdrawalReason = 'تست سحب البوليصة';
      let assignmentNumber = '';

      await test.step('Open assignments list, search by manifest reference, and withdraw the request', async () => {
        await shippingAgentAssignmentsPage.openAssignmentsList();
        assignmentNumber = await shippingAgentAssignmentsPage.withdrawManifest(importReferenceNo, withdrawalReason, {
          intervalMs: 5_000,
          timeoutMs: 60_000,
        });
        console.log('Assignment number:', assignmentNumber);
      });

      await test.step('Logout and login as the freight forwarder', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');
      });

      await test.step('Open assignments list, then طلبات سحب البوالص المرسلة', async () => {
        await shippingAgentAssignmentsPage.openAssignmentsList();
        await shippingAgentAssignmentsPage.openWithdrawRequestsTab();
      });

      await test.step('Search by assignment number', async () => {
        const appeared = await shippingAgentAssignmentsPage.waitForWithdrawalRequestToAppear(assignmentNumber, {
          intervalMs: 5_000,
          timeoutMs: 60_000,
        });

        if (!appeared) {
          throw new Error(`Withdrawal request ${assignmentNumber} did not appear in time`);
        }
      });

      await test.step('Open سبب طلب سحب البوليصة', async () => {
        await shippingAgentAssignmentsPage.openWithdrawalReasonModal(assignmentNumber);
      });

      await test.step('Close the reason modal', async () => {
        await shippingAgentAssignmentsPage.closeWithdrawalReasonModal();
      });

      await test.step('Accept the withdrawal request', async () => {
        await shippingAgentAssignmentsPage.confirmWithdrawalRequest(assignmentNumber);
      });
    } finally {
      await page.pause();
    }
  });

  //same as the accept-withdrawal-request test above, but rejects the withdrawal request instead - built up
  //step by step, confirming each one live before adding the next:
  test('رفض طلب سحب بوليصة', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
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

      await test.step('Open Air Delivery Order creation form', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
        await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
      });

      let deliveryOrderRefNo = '';

      await test.step('Fill delivery order form, refer to a freight forwarder, and save as draft', async () => {
        await newDeliveryOrderPage.fillDeliveryOrderForm(
          deliveryOrderData,
          masterBillData.billNo,
          importReferenceNo,
          masterBillData.transportCompany
        );

        await newDeliveryOrderPage.checkReferToFreightForwarder();
        await newDeliveryOrderPage.fillFreightForwarder('7001');

        deliveryOrderRefNo = await newDeliveryOrderPage.clickSaveButton();
        console.log('Delivery Order Reference Number:', deliveryOrderRefNo);

        expect(deliveryOrderRefNo).not.toBe('');
      });

      await test.step('Reopen the draft, edit it, and submit', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickEditButton();
        await newDeliveryOrderPage.clickSubmitButton();
      });

      await test.step('Check delivery order status every 5 seconds until محالة الى وسيط الشحن (up to 3 minutes)', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();

        const referred = await newDeliveryOrderPage.waitForDeliveryOrderStatus(deliveryOrderRefNo, 'محالة الى وسيط الشحن', {
          intervalMs: 5_000,
          timeoutMs: 180_000,
        });

        console.log('Delivery Order Referred to Freight Forwarder:', referred);
        expect(referred).toBe(true);
      });

      //accepting the referral is a separate session from the broker's (b3078) - logs out and back in as the
      //freight forwarder (ffw11):
      await test.step('Logout and accept the referral request as the freight forwarder', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');

        await shippingAgentAssignmentsPage.openAssignmentsList();
        await shippingAgentAssignmentsPage.acceptManifest(importReferenceNo, {
          intervalMs: 10_000,
          timeoutMs: 180_000,
        });
      });

      await test.step('Logout and login as the broker', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');
      });

      const withdrawalReason = 'تست رفض سحب البوليصة';
      let assignmentNumber = '';

      await test.step('Open assignments list, search by manifest reference, and withdraw the request', async () => {
        await shippingAgentAssignmentsPage.openAssignmentsList();
        assignmentNumber = await shippingAgentAssignmentsPage.withdrawManifest(importReferenceNo, withdrawalReason, {
          intervalMs: 5_000,
          timeoutMs: 60_000,
        });
        console.log('Assignment number:', assignmentNumber);
      });

      await test.step('Logout and login as the freight forwarder', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');
      });

      await test.step('Open assignments list, then طلبات سحب البوالص المرسلة', async () => {
        await shippingAgentAssignmentsPage.openAssignmentsList();
        await shippingAgentAssignmentsPage.openWithdrawRequestsTab();
      });

      await test.step('Search by assignment number', async () => {
        const appeared = await shippingAgentAssignmentsPage.waitForWithdrawalRequestToAppear(assignmentNumber, {
          intervalMs: 5_000,
          timeoutMs: 60_000,
        });

        if (!appeared) {
          throw new Error(`Withdrawal request ${assignmentNumber} did not appear in time`);
        }
      });

      await test.step('Open سبب طلب سحب البوليصة', async () => {
        await shippingAgentAssignmentsPage.openWithdrawalReasonModal(assignmentNumber);
      });

      await test.step('Close the reason modal', async () => {
        await shippingAgentAssignmentsPage.closeWithdrawalReasonModal();
      });

      await test.step('Reject the withdrawal request', async () => {
        await shippingAgentAssignmentsPage.rejectWithdrawalRequest(assignmentNumber, 'تست رفض طلب السحب');
      });

      await test.step('Logout and login as the broker', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');
      });

      await test.step('Open assignments list, then طلبات سحب البوالص المرسلة', async () => {
        await shippingAgentAssignmentsPage.openAssignmentsList();
        await shippingAgentAssignmentsPage.openWithdrawRequestsTab();
      });

      await test.step('Search by assignment number and view the rejection reason', async () => {
        const appeared = await shippingAgentAssignmentsPage.waitForWithdrawalRequestToAppear(assignmentNumber, {
          intervalMs: 5_000,
          timeoutMs: 60_000,
        });

        if (!appeared) {
          throw new Error(`Withdrawal request ${assignmentNumber} did not appear in time`);
        }

        const reason = await shippingAgentAssignmentsPage.getWithdrawalRejectionReason(assignmentNumber);
        console.log('Withdrawal rejection reason shown to broker:', reason);
      });
    } finally {
      await page.pause();
    }
  });

  //creates a manifest + delivery order, refers it to a freight forwarder, then has that freight forwarder
  //(ffw11) decline the assignment itself (not to be confused with test #10 below, where the broker's own
  //freight-forwarder ID is invalid and never reaches ffw11 at all):
  test('create air delivery order with freight forwarder referral and reject it', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
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

      await test.step('Open Air Delivery Order creation form', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
        await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
      });

      let deliveryOrderRefNo = '';

      await test.step('Fill delivery order form, refer to a freight forwarder, and save as draft', async () => {
        await newDeliveryOrderPage.fillDeliveryOrderForm(
          deliveryOrderData,
          masterBillData.billNo,
          importReferenceNo,
          masterBillData.transportCompany
        );

        await newDeliveryOrderPage.checkReferToFreightForwarder();
        await newDeliveryOrderPage.fillFreightForwarder('7001');

        deliveryOrderRefNo = await newDeliveryOrderPage.clickSaveButton();
        console.log('Delivery Order Reference Number:', deliveryOrderRefNo);

        expect(deliveryOrderRefNo).not.toBe('');
      });

      await test.step('Reopen the draft, edit it, and submit', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickEditButton();
        await newDeliveryOrderPage.clickSubmitButton();
      });

      await test.step('Check delivery order status every 5 seconds until محالة الى وسيط الشحن (up to 3 minutes)', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();

        const referred = await newDeliveryOrderPage.waitForDeliveryOrderStatus(deliveryOrderRefNo, 'محالة الى وسيط الشحن', {
          intervalMs: 5_000,
          timeoutMs: 180_000,
        });

        console.log('Delivery Order Referred to Freight Forwarder:', referred);
        expect(referred).toBe(true);
      });

      await test.step('Logout and reject the delivery order as the freight forwarder', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');

        await shippingAgentAssignmentsPage.openAssignmentsList();
        await shippingAgentAssignmentsPage.rejectManifest(importReferenceNo, 'بيانات المستلم غير مكتملة', {
          intervalMs: 10_000,
          timeoutMs: 180_000,
        });
      });
    } finally {
      await page.pause();
    }
  });

  //same referral+reject flow as above, but also switches back to the broker account to confirm the reason
  //the freight forwarder typed actually shows up on the sender's side:
  test('create air delivery order with freight forwarder referral, reject it, and view the rejection reason', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
    loginPage,
    shippingAgentAssignmentsPage,
  }) => {
    test.setTimeout(600_000);

    const rejectionReason = 'بيانات المستلم غير مكتملة';

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

      await test.step('Open Air Delivery Order creation form', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
        await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
      });

      let deliveryOrderRefNo = '';

      await test.step('Fill delivery order form, refer to a freight forwarder, and save as draft', async () => {
        await newDeliveryOrderPage.fillDeliveryOrderForm(
          deliveryOrderData,
          masterBillData.billNo,
          importReferenceNo,
          masterBillData.transportCompany
        );

        await newDeliveryOrderPage.checkReferToFreightForwarder();
        await newDeliveryOrderPage.fillFreightForwarder('7001');

        deliveryOrderRefNo = await newDeliveryOrderPage.clickSaveButton();
        console.log('Delivery Order Reference Number:', deliveryOrderRefNo);

        expect(deliveryOrderRefNo).not.toBe('');
      });

      await test.step('Reopen the draft, edit it, and submit', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickEditButton();
        await newDeliveryOrderPage.clickSubmitButton();
      });

      await test.step('Check delivery order status every 5 seconds until محالة الى وسيط الشحن (up to 3 minutes)', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();

        const referred = await newDeliveryOrderPage.waitForDeliveryOrderStatus(deliveryOrderRefNo, 'محالة الى وسيط الشحن', {
          intervalMs: 5_000,
          timeoutMs: 180_000,
        });

        console.log('Delivery Order Referred to Freight Forwarder:', referred);
        expect(referred).toBe(true);
      });

      await test.step('Logout and reject the delivery order as the freight forwarder', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');

        await shippingAgentAssignmentsPage.openAssignmentsList();
        await shippingAgentAssignmentsPage.rejectManifest(importReferenceNo, rejectionReason, {
          intervalMs: 10_000,
          timeoutMs: 180_000,
        });
      });

      //back to the broker account to confirm the freight forwarder's rejection reason surfaces on the sender's
      //side too, not just on ffw11's own list:
      await test.step('Logout and view the rejection reason as the broker', async () => {
        await loginPage.logout();
        await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');

        await shippingAgentAssignmentsPage.openAssignmentsList();
        const reason = await shippingAgentAssignmentsPage.getRejectionReason(importReferenceNo, {
          intervalMs: 5_000,
          timeoutMs: 60_000,
        });

        console.log('Rejection reason shown to broker:', reason);
        expect(reason).toBe(rejectionReason);
      });
    } finally {
      await page.pause();
    }
  });

  //10. Create Air Delivery Order with an invalid freight forwarder - gets rejected:
  test('create air delivery order with invalid freight forwarder gets rejected', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
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

      await test.step('Open Air Delivery Order creation form', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
        await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
      });

      let deliveryOrderRefNo = '';

      await test.step('Fill delivery order form, refer to an invalid freight forwarder, and save as draft', async () => {
        await newDeliveryOrderPage.fillDeliveryOrderForm(
          deliveryOrderData,
          masterBillData.billNo,
          importReferenceNo,
          masterBillData.transportCompany
        );

        await newDeliveryOrderPage.checkReferToFreightForwarder();
        //this freight forwarder is not a valid referral target - customs rejects the delivery order.
        //("شركة دي اس في حلول للخدمات اللوجستية" is now accepted and just sits at "محالة الى وسيط الشحن".)
        await newDeliveryOrderPage.fillFreightForwarder('مؤسسة القمة للتخليص الجمركي');

        deliveryOrderRefNo = await newDeliveryOrderPage.clickSaveButton();
        console.log('Delivery Order Reference Number:', deliveryOrderRefNo);

        expect(deliveryOrderRefNo).not.toBe('');
      });

      await test.step('Reopen the draft, edit it, and submit', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickEditButton();
        await newDeliveryOrderPage.clickSubmitButton();
      });

      await test.step('Check delivery order status every 5 seconds until مرفوض (up to 3 minutes)', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();

        const rejected = await newDeliveryOrderPage.waitForDeliveryOrderStatus(deliveryOrderRefNo, 'مرفوض', {
          intervalMs: 5_000,
          timeoutMs: 180_000,
        });

        console.log('Delivery Order Rejected:', rejected);
        expect(rejected).toBe(true);
      });

      await test.step('Open the delivery order, then the document history tab, and view the rejection details', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickHistoryTab();
        await newDeliveryOrderPage.clickHistoryDetailsButton();
      });
    } finally {
      await page.pause();
    }
  });

  //11. Print, Download, then Cancel an accepted delivery order:
  test('cancel delivery order', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
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

      await test.step('Open Air Delivery Order creation form', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
        await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
      });

      let deliveryOrderRefNo = '';

      await test.step('Fill delivery order form (linking the received bill) and save as draft', async () => {
        await newDeliveryOrderPage.fillDeliveryOrderForm(
          deliveryOrderData,
          masterBillData.billNo,
          importReferenceNo,
          masterBillData.transportCompany
        );

        deliveryOrderRefNo = await newDeliveryOrderPage.clickSaveButton();
        console.log('Delivery Order Reference Number:', deliveryOrderRefNo);

        expect(deliveryOrderRefNo).not.toBe('');
      });

      await test.step('Reopen the draft, edit it, and submit', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickEditButton();
        await newDeliveryOrderPage.clickSubmitButton();
      });

      await test.step('Check delivery order status every 5 seconds until مقبول (up to 3 minutes)', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();

        const accepted = await newDeliveryOrderPage.waitForDeliveryOrderStatus(deliveryOrderRefNo, 'مقبول', {
          intervalMs: 5_000,
          timeoutMs: 180_000,
        });

        console.log('Delivery Order Accepted:', accepted);
        expect(accepted).toBe(true);
      });

      await test.step('Open the accepted delivery order and print it', async () => {
        await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
        await newDeliveryOrderPage.clickPrintButton();
      });

      await test.step('Download the delivery order', async () => {
        const filename = await newDeliveryOrderPage.clickDownloadButton();
        console.log('Downloaded File Name:', filename);

        expect(filename).toContain(deliveryOrderRefNo);
      });

      await test.step('Cancel the delivery order', async () => {
        await newDeliveryOrderPage.clickCancelButton();
      });

      await test.step('Check delivery order status every 5 seconds until ملغي (up to 3 minutes)', async () => {
        await newDeliveryOrderPage.clickAirServices();
        await newDeliveryOrderPage.clickAirDeliveryOrderMenu();

        const cancelled = await newDeliveryOrderPage.waitForDeliveryOrderStatus(deliveryOrderRefNo, 'ملغي', {
          intervalMs: 5_000,
          timeoutMs: 180_000,
        });

        console.log('Delivery Order Cancelled:', cancelled);
        expect(cancelled).toBe(true);
      });
    } finally {
      await page.pause();
    }
  });
});
