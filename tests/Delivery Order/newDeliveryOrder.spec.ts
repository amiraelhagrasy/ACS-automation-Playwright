import { test, expect } from '../../fixtures/testFixtures';
import { airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { deliveryOrderData } from '../../test-data/deliveryOrderData';
import { acsBrokerUser, ffwUser } from '../../test-data/users';

test.describe('Create New Air Delivery Order Test', () => {
  //1,2,3,4- Create, View, Edit, Submit DEO without FFW:
  test('#1 create new air delivery order', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
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

    await test.step('Open Air Delivery Order creation form', async () => {
      await newDeliveryOrderPage.clickAirServices();
      await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
      await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
    });

    let deliveryOrderRefNo = '';

    await test.step('#1 - Create DEO without FFW and with a valid importer', async () => {
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

    await test.step('#2-4 - View,Edit,Submit DEO without FFW and with a valid importer', async () => {
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
  });

  //5. Create Air Delivery Order with an invalid importer - gets rejected:
  test('#5 Submit DEO without FFW and with an invalid importer', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
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

    await test.step('#5 - Submit DEO without FFW and with a valid importer', async () => {
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
  });

  //6,7,8,9. Createو,View , Edit , Submit DEO with a valid FFW
  //FFW #1 Accept Assigned Request:
  test('#6-9 Create,View, Edit, Submit DEO with a valid FFW', async ({
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

    await test.step('Open Air Delivery Order creation form', async () => {
      await newDeliveryOrderPage.clickAirServices();
      await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
      await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
    });

    let deliveryOrderRefNo = '';

    await test.step('#6 - Create DEO with a valid FFW', async () => {
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

    await test.step('#7-9 - View,Edit, Submit DEO with a valid FFW', async () => {
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
    await test.step('FFW#1 - Accept Assigned Request', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');

      await shippingAgentAssignmentsPage.openAssignmentsList();
      await shippingAgentAssignmentsPage.acceptManifest(importReferenceNo, {
        intervalMs: 10_000,
        timeoutMs: 180_000,
      });
    });
  });

  
  //10. Create Air Delivery Order with an invalid freight forwarder - gets rejected:
  test('#10 Submit DEO with an invalid FFW', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
    loginPage,
  }) => {
    test.setTimeout(600_000);

    let importReferenceNo = '';

    //the preceding test (#6-9) ends its own flow logged in as the freight forwarder (ffwUser) and never switches
    //back - confirmed live, 2026-09-28: this test's first click then failed since ffw11's sidebar has no "خدمات
    //الطيران" menu item at all. Same root cause/fix already established for billReservationRequest.spec.ts #12:
    await test.step('Log back in as the broker', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');
    });

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
  });

  //11,12,13 Print, Download, then Cancel an accepted delivery order:
  test('#11-13 cancel delivery order', async ({
    page,
    newImportManPage,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    newDeliveryOrderPage,
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

    await test.step('#12 - Open the accepted delivery order and print it', async () => {
      await newDeliveryOrderPage.searchByReferenceNumber(deliveryOrderRefNo);
      await newDeliveryOrderPage.openDeliveryOrderByReferenceNumber(deliveryOrderRefNo);
      await newDeliveryOrderPage.clickPrintButton();
    });

    await test.step('#13 - Download the delivery order', async () => {
      const filename = await newDeliveryOrderPage.clickDownloadButton();
      console.log('Downloaded File Name:', filename);

      expect(filename).toContain(deliveryOrderRefNo);
    });

    await test.step('#11 - Cancel the delivery order', async () => {
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
  });

  //----------------------------------------------------------------------------------
  //End of the test suite(Air Delivery Order) - all other tests are in the Freight Forwarder test file, since they require logging in as the freight forwarder to accept or reject the referral request.
 
  //#FFw 2 - Reject Assigned Request:
  test('FFW#2 create air delivery order with freight forwarder referral and reject it', async ({
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

    await test.step('Open Air Delivery Order creation form', async () => {
      await newDeliveryOrderPage.clickAirServices();
      await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
      await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
    });

    let deliveryOrderRefNo = '';

    await test.step('Fill delivery order form, refer to a freight forwarder, and submit', async () => {
      await newDeliveryOrderPage.fillDeliveryOrderForm(
        deliveryOrderData,
        masterBillData.billNo,
        importReferenceNo,
        masterBillData.transportCompany
      );

      await newDeliveryOrderPage.checkReferToFreightForwarder();
      await newDeliveryOrderPage.fillFreightForwarder('7001');

      deliveryOrderRefNo = await newDeliveryOrderPage.clickSubmitButton();
      console.log('Delivery Order Reference Number:', deliveryOrderRefNo);

      expect(deliveryOrderRefNo).not.toBe('');
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

    await test.step('FFW#2 - Reject Assigned Request', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');

      await shippingAgentAssignmentsPage.openAssignmentsList();
      await shippingAgentAssignmentsPage.rejectManifest(importReferenceNo, 'بيانات المستلم غير مكتملة', {
        intervalMs: 10_000,
        timeoutMs: 180_000,
      });
    });
  });

  //FFW# 6 View Rejection Reason:
  test('FFW#6 create air delivery order with freight forwarder referral, reject it, and view the rejection reason', async ({
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

    let importReferenceNo = '';

    //the preceding test (FFW#2) ends its own flow logged in as the freight forwarder (ffwUser) and never
    //switches back - confirmed live, 2026-09-28: this test's first click then failed since ffw11's sidebar has
    //no "خدمات الطيران" menu item at all. Same root cause/fix already established for billReservationRequest
    //.spec.ts #12:
    await test.step('Log back in as the broker', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');
    });

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

    await test.step('Open Air Delivery Order creation form', async () => {
      await newDeliveryOrderPage.clickAirServices();
      await newDeliveryOrderPage.clickAirDeliveryOrderMenu();
      await newDeliveryOrderPage.clickCreateDeliveryOrderButton();
    });

    let deliveryOrderRefNo = '';

    await test.step('Fill delivery order form, refer to a freight forwarder, and submit', async () => {
      await newDeliveryOrderPage.fillDeliveryOrderForm(
        deliveryOrderData,
        masterBillData.billNo,
        importReferenceNo,
        masterBillData.transportCompany
      );

      await newDeliveryOrderPage.checkReferToFreightForwarder();
      await newDeliveryOrderPage.fillFreightForwarder('7001');

      deliveryOrderRefNo = await newDeliveryOrderPage.clickSubmitButton();
      console.log('Delivery Order Reference Number:', deliveryOrderRefNo);

      expect(deliveryOrderRefNo).not.toBe('');
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

    await test.step('FFW#2 - Reject Assigned Request', async () => {
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
    await test.step('FFW#6 - Logout and view the rejection reason as the broker', async () => {
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
  });

  //FFW#3 Withdraw Assigned Request, FFW#4 Accept Withdrawal Request:
  test('FFW#4 create withdrawal request', async ({
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
    await test.step('FFW#1 - Logout and accept the referral request as the freight forwarder', async () => {
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

    await test.step('FFW#3 - Open assignments list, search by manifest reference, and withdraw the request', async () => {
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

    await test.step('FFW#4 - Accept the withdrawal request', async () => {
      await shippingAgentAssignmentsPage.confirmWithdrawalRequest(assignmentNumber);
    });
  });

  //FFW#5 Reject Withdrawal Request , FFW#7 View Rejection Reason:
  test('FFW#5-7 Reject Withdrawal Request and view Rejection Reason', async ({
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

    let importReferenceNo = '';

    //the preceding test (FFW#4) ends its own flow logged in as the freight forwarder (ffwUser) and never
    //switches back - confirmed live, 2026-09-28: this test's first click then failed since ffw11's sidebar has
    //no "خدمات الطيران" menu item at all. Same root cause/fix already established for billReservationRequest
    //.spec.ts #12:
    await test.step('Log back in as the broker', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');
    });

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
    await test.step('FFW#1 - Logout and accept the referral request as the freight forwarder', async () => {
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

    await test.step('FFW#3 - Open assignments list, search by manifest reference, and withdraw the request', async () => {
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

    await test.step('FFW#5 - Reject the withdrawal request', async () => {
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

    await test.step('FFW#7 - Search by assignment number and view the rejection reason', async () => {
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
  });


});
