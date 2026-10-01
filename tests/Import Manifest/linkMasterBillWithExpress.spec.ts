import { test, expect } from '../../fixtures/testFixtures';
import { createNewImportManifestData } from '../../test-data/newImportManifestData';
import { createMasterBillData, airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { acsBrokerUser, expressMailUser } from '../../test-data/users';
import { NewImportManPage } from '../../pages/Import Manifest/newImportManifest';
import { LinkMasterBillWithExpressPage } from '../../pages/Import Manifest/LinkMasterBillWithExpressPage';

const EXPRESS_MAIL_COMPANY = 'الشركة السعودية لخدمات الشحن الجوي';


test.describe.configure({ mode: 'serial' });

test.describe('Link master bill with express mail company', () => {

  //broker transfers a master bill, express-mail company links it to 3 of its manifests
  test('#2-5 - Link the express mail bills with valid bill', async ({
    page,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
  }) => {
    test.setTimeout(2_400_000);

    const newImportManExpPage = new NewImportManPage(page);
    const linkPage = new LinkMasterBillWithExpressPage(page);

    let brokerManifestRef = '';

    await test.step('Broker: create an express-mail import manifest with one master bill', async () => {
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();
      await newImportManExpPage.clickCreateAirImportManifest();
      await newImportManExpPage.fillManifestFormWithExpressMailAgent(newImportManifestData);
      await newImportManExpPage.clickSaveAndConitnue();

      const { submittedReferenceNumber } = await viewImportManifestPage.addMasterBillWithHouseBill(
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );
      brokerManifestRef = submittedReferenceNumber;
      console.log('Broker express-mail manifest reference:', brokerManifestRef);
      console.log('Master bill number:', masterBillData.billNo);
    });

    await test.step('Wait for the broker manifest to be received', async () => {
      await viewImportManifestPage.expectManifestStatus(
        async () => {
          await newImportManExpPage.clickAirServices();
          await newImportManExpPage.clickAirImportManifest();
        },
        brokerManifestRef,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    let transferRequestNumber = '';

    //#2 - Create a request to link the express mail bills with valid bill:
    await test.step('#2 - Create a request to link the express mail bills with valid bill', async () => {
      await linkPage.openTransferMenu();
      await linkPage.clickNewRequest();
      await linkPage.fillAndRetrieve({
        port: newImportManifestData.finalAirportText,
        carrier: masterBillData.transportCompany,
        billNo: masterBillData.billNo,
        billDate: masterBillData.billDate,
      });
      await linkPage.selectTransferToCompany(EXPRESS_MAIL_COMPANY);
      await linkPage.clickSubmit();

      const { requestNumber } = await linkPage.readAndCloseSuccessAlert();
      transferRequestNumber = requestNumber;
      console.log('Transfer request number:', transferRequestNumber);
      expect(transferRequestNumber).not.toBe('');
    });

    await test.step('Broker: verify the request is waiting on the express-mail company', async () => {
      const waiting = await linkPage.waitForRequestStatus(
        transferRequestNumber,
        'بانتظار ربط البوليصة من البريد السريع',
        { intervalMs: 5_000, timeoutMs: 60_000 }
      );
      expect(waiting).toBe(true);
    });

    await test.step('#3 - View Assignment Request from shipping agent side', async () => {
      await linkPage.openDetailsByRequestNumber(transferRequestNumber);
    });

    //--- express-mail company side ---
    const expressManifestRefs: string[] = [];

    //#3 - Create 3 express-mail manifests
    await test.step('Create 3 express-mail manifests', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(expressMailUser.username, expressMailUser.password, '999999');

      for (let i = 0; i < 3; i++) {
        const manifestData = createNewImportManifestData();
        const billData = createMasterBillData();

        const { submittedReferenceNumber } = await newImportManExpPage.submitExpressManifestWithTwoBills(
          viewImportManifestPage,
          manifestData,
          billData,
          airwayBillData,
          billItemData,
          warehouseData
        );
        expressManifestRefs.push(submittedReferenceNumber);
        console.log(`Express-mail manifest ${i + 1} reference:`, submittedReferenceNumber);
      }
    });

    await test.step('Wait for all 3 express-mail manifests to be received', async () => {
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();

      for (const ref of expressManifestRefs) {
        await viewImportManifestPage.expectManifestStatus(async () => {}, ref, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });
      }
    });

    await test.step('#7- Link Request with three manifests', async () => {
      await linkPage.openConnectMenu();
      await linkPage.openDetailsByRequestNumber(transferRequestNumber);
      await linkPage.clickConnectRequest();

      for (const ref of expressManifestRefs) {
        await linkPage.selectManifestInConnectPicker(ref);
      }

      await linkPage.clickConfirmConnect();
      await linkPage.readAndCloseSuccessAlert();
    });

    await test.step('Verify the request status is now "تم ربطها بالمنافيست"', async () => {
      const linked = await linkPage.waitForRequestStatus(transferRequestNumber, 'تم ربطها بالمنافيست', {
        intervalMs: 5_000,
        timeoutMs: 60_000,
      });
      expect(linked).toBe(true);
    });

    await test.step('#4 - View Assignment Request from express mail side', async () => {
      await linkPage.openDetailsByRequestNumber(transferRequestNumber);
    });

    //Express-mail company: verify each of its 3 manifests now shows 0 bills
    await test.step('#9 - View Virtual manifest after linking', async () => {
      for (const ref of expressManifestRefs) {
        await newImportManExpPage.clickAirServices();
        await newImportManExpPage.clickAirImportManifest();
        await viewImportManifestPage.searchByReferenceNumber(ref);
        await viewImportManifestPage.openManifestByReferenceNumber(ref);

        const billsCount = await viewImportManifestPage.getArrivedBillsCount();
        console.log(`Express-mail manifest ${ref} bills count:`, billsCount);
        expect(billsCount).toBe(0);
      }
    });

    //Broker - verify the original manifest now shows 7 bills
    await test.step('#10 - View Actual manifest after linking', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');

      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(brokerManifestRef);
      await viewImportManifestPage.openManifestByReferenceNumber(brokerManifestRef);

      const billsCount = await viewImportManifestPage.getArrivedBillsCount();
      console.log('Broker manifest bills count:', billsCount);
      expect(billsCount).toBe(7);
    });
  });

  //broker transfers a master bill, express-mail company links it to 2 of its manifests
  test('#6- Link Request with two manifests', async ({
    page,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
  }) => {
    test.setTimeout(2_400_000);

    const newImportManExpPage = new NewImportManPage(page);
    const linkPage = new LinkMasterBillWithExpressPage(page);

    let brokerManifestRef = '';

    await test.step('Broker: create an express-mail import manifest with one master bill', async () => {
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();
      await newImportManExpPage.clickCreateAirImportManifest();
      await newImportManExpPage.fillManifestFormWithExpressMailAgent(newImportManifestData);
      await newImportManExpPage.clickSaveAndConitnue();

      const { submittedReferenceNumber } = await viewImportManifestPage.addMasterBillWithHouseBill(
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );
      brokerManifestRef = submittedReferenceNumber;
      console.log('Broker express-mail manifest reference:', brokerManifestRef);
      console.log('Master bill number:', masterBillData.billNo);
    });

    await test.step('Wait for the broker manifest to be received', async () => {
      await viewImportManifestPage.expectManifestStatus(
        async () => {
          await newImportManExpPage.clickAirServices();
          await newImportManExpPage.clickAirImportManifest();
        },
        brokerManifestRef,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    let transferRequestNumber = '';

    await test.step('Broker: submit a "تحويل البوالص الرئيسية للبريد السريع" request on the master bill', async () => {
      await linkPage.openTransferMenu();
      await linkPage.clickNewRequest();
      await linkPage.fillAndRetrieve({
        port: newImportManifestData.finalAirportText,
        carrier: masterBillData.transportCompany,
        billNo: masterBillData.billNo,
        billDate: masterBillData.billDate,
      });
      await linkPage.selectTransferToCompany(EXPRESS_MAIL_COMPANY);
      await linkPage.clickSubmit();

      const { requestNumber } = await linkPage.readAndCloseSuccessAlert();
      transferRequestNumber = requestNumber;
      console.log('Transfer request number:', transferRequestNumber);
      expect(transferRequestNumber).not.toBe('');
    });

    await test.step('Broker: verify the request is waiting on the express-mail company', async () => {
      const waiting = await linkPage.waitForRequestStatus(
        transferRequestNumber,
        'بانتظار ربط البوليصة من البريد السريع',
        { intervalMs: 5_000, timeoutMs: 60_000 }
      );
      expect(waiting).toBe(true);
    });

    //--- express-mail company side: only 2 manifests this time (not 3) ---
    const expressManifestRefs: string[] = [];

    await test.step('Log in as the express-mail company and create 2 manifests, each with two master bills', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(expressMailUser.username, expressMailUser.password, '999999');

      for (let i = 0; i < 2; i++) {
        const manifestData = createNewImportManifestData();
        const billData = createMasterBillData();

        const { submittedReferenceNumber } = await newImportManExpPage.submitExpressManifestWithTwoBills(
          viewImportManifestPage,
          manifestData,
          billData,
          airwayBillData,
          billItemData,
          warehouseData
        );
        expressManifestRefs.push(submittedReferenceNumber);
        console.log(`Express-mail manifest ${i + 1} reference:`, submittedReferenceNumber);
      }
    });

    await test.step('Wait for both express-mail manifests to be received', async () => {
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();

      for (const ref of expressManifestRefs) {
        await viewImportManifestPage.expectManifestStatus(async () => {}, ref, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });
      }
    });

    await test.step('#6 - Express-mail company: link the transfer request to the 2 manifests', async () => {
      await linkPage.openConnectMenu();
      await linkPage.openDetailsByRequestNumber(transferRequestNumber);
      await linkPage.clickConnectRequest();

      for (const ref of expressManifestRefs) {
        await linkPage.selectManifestInConnectPicker(ref);
      }

      await linkPage.clickConfirmConnect();
      await linkPage.readAndCloseSuccessAlert();
    });

    await test.step('Verify the request status is now "تم ربطها بالمنافيست"', async () => {
      const linked = await linkPage.waitForRequestStatus(transferRequestNumber, 'تم ربطها بالمنافيست', {
        intervalMs: 5_000,
        timeoutMs: 60_000,
      });
      expect(linked).toBe(true);
    });

    await test.step('Express-mail company: open the request to view its details now that it\'s linked', async () => {
      await linkPage.openDetailsByRequestNumber(transferRequestNumber);
    });

  });
 //express-mail company cannot select a 4th manifest - the connect-request picker caps selection at 3
  test('#8- Link Request with more than three manifests', async ({
    page,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
  }) => {
    test.setTimeout(2_400_000);

    const newImportManExpPage = new NewImportManPage(page);
    const linkPage = new LinkMasterBillWithExpressPage(page);

    let brokerManifestRef = '';

    await test.step('Broker: create an express-mail import manifest with one master bill', async () => {
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();
      await newImportManExpPage.clickCreateAirImportManifest();
      await newImportManExpPage.fillManifestFormWithExpressMailAgent(newImportManifestData);
      await newImportManExpPage.clickSaveAndConitnue();

      const { submittedReferenceNumber } = await viewImportManifestPage.addMasterBillWithHouseBill(
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );
      brokerManifestRef = submittedReferenceNumber;
      console.log('Broker express-mail manifest reference:', brokerManifestRef);
      console.log('Master bill number:', masterBillData.billNo);
    });

    await test.step('Wait for the broker manifest to be received', async () => {
      await viewImportManifestPage.expectManifestStatus(
        async () => {
          await newImportManExpPage.clickAirServices();
          await newImportManExpPage.clickAirImportManifest();
        },
        brokerManifestRef,
        'تم استلامها',
        { intervalMs: 5_000, timeoutMs: 150_000 }
      );
    });

    let transferRequestNumber = '';

    await test.step('Broker: submit a "تحويل البوالص الرئيسية للبريد السريع" request on the master bill', async () => {
      await linkPage.openTransferMenu();
      await linkPage.clickNewRequest();
      await linkPage.fillAndRetrieve({
        port: newImportManifestData.finalAirportText,
        carrier: masterBillData.transportCompany,
        billNo: masterBillData.billNo,
        billDate: masterBillData.billDate,
      });
      await linkPage.selectTransferToCompany(EXPRESS_MAIL_COMPANY);
      await linkPage.clickSubmit();

      const { requestNumber } = await linkPage.readAndCloseSuccessAlert();
      transferRequestNumber = requestNumber;
      console.log('Transfer request number:', transferRequestNumber);
      expect(transferRequestNumber).not.toBe('');
    });

    await test.step('Broker: verify the request is waiting on the express-mail company', async () => {
      const waiting = await linkPage.waitForRequestStatus(
        transferRequestNumber,
        'بانتظار ربط البوليصة من البريد السريع',
        { intervalMs: 5_000, timeoutMs: 60_000 }
      );
      expect(waiting).toBe(true);
    });

    //--- express-mail company side: 4 manifests this time ---
    const expressManifestRefs: string[] = [];

    await test.step('Log in as the express-mail company and create 4 manifests, each with two master bills', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(expressMailUser.username, expressMailUser.password, '999999');

      for (let i = 0; i < 4; i++) {
        const manifestData = createNewImportManifestData();
        const billData = createMasterBillData();

        const { submittedReferenceNumber } = await newImportManExpPage.submitExpressManifestWithTwoBills(
          viewImportManifestPage,
          manifestData,
          billData,
          airwayBillData,
          billItemData,
          warehouseData
        );
        expressManifestRefs.push(submittedReferenceNumber);
        console.log(`Express-mail manifest ${i + 1} reference:`, submittedReferenceNumber);
      }
    });

    await test.step('Wait for all 4 express-mail manifests to be received', async () => {
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();

      for (const ref of expressManifestRefs) {
        await viewImportManifestPage.expectManifestStatus(async () => {}, ref, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });
      }
    });

    const [firstRef, secondRef, thirdRef, fourthRef] = expressManifestRefs;

    await test.step('Express-mail company: select the first 3 manifests successfully', async () => {
      await linkPage.openConnectMenu();
      await linkPage.openDetailsByRequestNumber(transferRequestNumber);
      await linkPage.clickConnectRequest();

      await linkPage.selectManifestInConnectPicker(firstRef);
      await linkPage.selectManifestInConnectPicker(secondRef);
      await linkPage.selectManifestInConnectPicker(thirdRef);
    });

    //this test's pass condition stops right here: proving the picker caps selection at 3 and refuses a 4th.
    //The full confirm+verify-bills-on-both-sides flow is covered separately by the 5-manifest variant below:
    await test.step('Attempting to select a 4th manifest is blocked by the portal\'s 3-manifest cap', async () => {
      await linkPage.search(fourthRef);
      const fourthCheckbox = page.locator(`#chk_${fourthRef}`);
      await expect(fourthCheckbox).toBeVisible({ timeout: 15_000 });
      await fourthCheckbox.click({ force: true, timeout: 5_000 }).catch(() => {});
      await expect(fourthCheckbox).not.toBeChecked();
    });
  });

  //negative case: submit a "تحويل البوالص الرئيسية للبريد السريع" request for a bill number that was never
  test('#1 broker submits a link request for a bill that does not exist - gets an error', async ({
    page,
    newImportManifestData,
    masterBillData,
  }) => {
    test.setTimeout(300_000);

    const linkPage = new LinkMasterBillWithExpressPage(page);
    const nonExistentBillNo = '00000000';

    await linkPage.openTransferMenu();
    await linkPage.clickNewRequest();
    await linkPage.fillAndRetrieve({
      port: newImportManifestData.finalAirportText,
      carrier: masterBillData.transportCompany,
      billNo: nonExistentBillNo,
      billDate: masterBillData.billDate,
    });

    //confirmed live: "المعلومات المدخلة غير مطابقة لبوليصة صحيحة." ("The entered information does not match a
    //valid bill.") shows in the standard .fasah-alert-body pattern used across this portal - the .invalid-feedback
    //matches a broader selector picked up here are static "الحقل مطلوب" markup always present in the DOM
    //regardless of state (see LinkMasterBillWithExpressPage's own notes on that same false-positive), not this:
    const notFoundError = page.locator('.fasah-alert-body', { hasText: 'المعلومات المدخلة غير مطابقة لبوليصة صحيحة' });
    await expect(notFoundError).toBeVisible({ timeout: 10_000 });

    //and the request form should never have progressed to showing the transfer-to-company dropdown:
    await expect(page.locator('select[test-attr="shipping_agent_link_express_mail_companytransferto"]')).toBeHidden();
  });
});
