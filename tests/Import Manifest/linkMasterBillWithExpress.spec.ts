import { test, expect } from '../../fixtures/testFixtures';
import { createNewImportManifestData } from '../../test-data/newImportManifestData';
import { createMasterBillData, airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { acsBrokerUser, expressMailUser } from '../../test-data/users';
import { NewImportManExpPage } from '../../pages/Import Manifest/newImportManExpPage';
import { LinkMasterBillWithExpressPage } from '../../pages/Import Manifest/LinkMasterBillWithExpressPage';

const EXPRESS_MAIL_COMPANY = 'الشركة السعودية لخدمات الشحن الجوي';

//these tests share the b3078 / blqur002 portal accounts, so they cannot run in parallel (the repo config has
//fullyParallel: true) - force them onto one worker, one after the other.
test.describe.configure({ mode: 'serial' });

test.describe('Link master bill with express mail company', () => {
  //broker creates an express-mail manifest with one master bill and submits a "تحويل البوالص الرئيسية للبريد
  //السريع" request on it -> the express-mail company (blqur002) creates its own 3 manifests (2 master bills
  //each) and links the request to all 3 -> the broker's original manifest ends up with all 7 bills (1 + 2+2+2),
  //while each of the express-mail company's own manifests drops to 0 (its bills got absorbed into the linked
  //broker manifest instead).
  test('broker transfers a master bill, express-mail company links it to its manifests', async ({
    page,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
  }) => {
    test.setTimeout(2_400_000);

    const newImportManExpPage = new NewImportManExpPage(page);
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
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();

      const received = await viewImportManifestPage.waitForManifestStatus(brokerManifestRef, 'تم استلامها', {
        intervalMs: 5_000,
        timeoutMs: 150_000,
      });
      if (!received) {
        throw new Error(`Broker manifest ${brokerManifestRef} was not received in time`);
      }
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

    //--- express-mail company side ---
    const expressManifestRefs: string[] = [];

    await test.step('Log in as the express-mail company and create 3 manifests, each with two master bills', async () => {
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
        const received = await viewImportManifestPage.waitForManifestStatus(ref, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });
        if (!received) {
          throw new Error(`Express-mail manifest ${ref} was not received in time`);
        }
      }
    });

    await test.step('Express-mail company: link the transfer request to the 3 manifests', async () => {
      await linkPage.openConnectMenu();
      await linkPage.openDetailsByRequestNumber(transferRequestNumber);
      await linkPage.clickConnectRequest();

      for (const ref of expressManifestRefs) {
        await linkPage.selectManifestInConnectPicker(ref);
      }

      await linkPage.clickConfirmConnect();
      await linkPage.readAndCloseSuccessAlert();
    });

    //confirmed live: the portal's actual wording is "تم ربطها بالمنافيست" (منافيست, not مانفيست):
    await test.step('Verify the request status is now "تم ربطها بالمنافيست"', async () => {
      const linked = await linkPage.waitForRequestStatus(transferRequestNumber, 'تم ربطها بالمنافيست', {
        intervalMs: 5_000,
        timeoutMs: 60_000,
      });
      expect(linked).toBe(true);
    });

    await test.step('Express-mail company: verify each of its 3 manifests now shows 0 bills', async () => {
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

    await test.step('Log back in as the broker and verify the original manifest now shows 7 bills', async () => {
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

  //variant of the happy path with only 2 express-mail manifests instead of 3 - broker's manifest ends up with
  //5 bills (1 + 2+2) instead of 7, and only 2 manifests to verify on the express-mail side:
  test('broker transfers a master bill, express-mail company links it to 2 of its manifests', async ({
    page,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
  }) => {
    test.setTimeout(2_400_000);

    const newImportManExpPage = new NewImportManExpPage(page);
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
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();

      const received = await viewImportManifestPage.waitForManifestStatus(brokerManifestRef, 'تم استلامها', {
        intervalMs: 5_000,
        timeoutMs: 150_000,
      });
      if (!received) {
        throw new Error(`Broker manifest ${brokerManifestRef} was not received in time`);
      }
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
        const received = await viewImportManifestPage.waitForManifestStatus(ref, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });
        if (!received) {
          throw new Error(`Express-mail manifest ${ref} was not received in time`);
        }
      }
    });

    await test.step('Express-mail company: link the transfer request to the 2 manifests', async () => {
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

    await test.step('Express-mail company: verify each of its 2 manifests now shows 0 bills', async () => {
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

    await test.step('Log back in as the broker and verify the original manifest now shows 5 bills', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');

      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(brokerManifestRef);
      await viewImportManifestPage.openManifestByReferenceNumber(brokerManifestRef);

      const billsCount = await viewImportManifestPage.getArrivedBillsCount();
      console.log('Broker manifest bills count:', billsCount);
      expect(billsCount).toBe(5);
    });
  });

  //negative case discovered live while trying a 4-manifest variant of the happy path: the connect-request picker
  //modal caps selection at 3 manifests ("يمكنك اختيار ثلاث مانفيست كحد أعلى" banner at the top of the modal) - a
  //4th checkbox never becomes checkable once 3 are already selected (confirmed live via screenshot: clicking it
  //just times out with "<td>...</td> intercepts pointer events", the same portal pattern used elsewhere for a
  //disabled control that still reports as visually "enabled"). Verifies the cap is enforced and that only the
  //first 3 manifests actually get linked - the 4th manifest is created but never selected, so it keeps its own
  //2 bills and the broker's manifest ends up with 7 (1 + 2+2+2), not 9:
  test('express-mail company cannot select a 4th manifest - the connect-request picker caps selection at 3', async ({
    page,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
  }) => {
    test.setTimeout(2_400_000);

    const newImportManExpPage = new NewImportManExpPage(page);
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
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();

      const received = await viewImportManifestPage.waitForManifestStatus(brokerManifestRef, 'تم استلامها', {
        intervalMs: 5_000,
        timeoutMs: 150_000,
      });
      if (!received) {
        throw new Error(`Broker manifest ${brokerManifestRef} was not received in time`);
      }
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
        const received = await viewImportManifestPage.waitForManifestStatus(ref, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });
        if (!received) {
          throw new Error(`Express-mail manifest ${ref} was not received in time`);
        }
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

    await test.step('Attempting to select a 4th manifest is blocked by the portal\'s 3-manifest cap', async () => {
      await linkPage.search(fourthRef);
      const fourthCheckbox = page.locator(`#chk_${fourthRef}`);
      await expect(fourthCheckbox).toBeVisible({ timeout: 15_000 });

      //don't wait on the normal actionability chain here - a blocked/disabled checkbox never settles that check
      //(confirmed live: it times out entirely rather than resolving to "not clickable"), so force the click past
      //that and assert on the outcome (checkbox state) instead of the click itself succeeding or failing:
      await fourthCheckbox.click({ force: true, timeout: 5_000 }).catch(() => {});
      await expect(fourthCheckbox).not.toBeChecked();
    });

    await test.step('Confirm the link with only the 3 selected manifests', async () => {
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

    await test.step('Express-mail company: verify each of the 3 linked manifests now shows 0 bills', async () => {
      for (const ref of [firstRef, secondRef, thirdRef]) {
        await newImportManExpPage.clickAirServices();
        await newImportManExpPage.clickAirImportManifest();
        await viewImportManifestPage.searchByReferenceNumber(ref);
        await viewImportManifestPage.openManifestByReferenceNumber(ref);

        const billsCount = await viewImportManifestPage.getArrivedBillsCount();
        console.log(`Express-mail manifest ${ref} bills count:`, billsCount);
        expect(billsCount).toBe(0);
      }
    });

    await test.step('Express-mail company: verify the unselected 4th manifest still keeps its own 2 bills', async () => {
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(fourthRef);
      await viewImportManifestPage.openManifestByReferenceNumber(fourthRef);

      const billsCount = await viewImportManifestPage.getArrivedBillsCount();
      console.log(`Express-mail manifest ${fourthRef} (never selected) bills count:`, billsCount);
      expect(billsCount).toBe(2);
    });

    await test.step('Log back in as the broker and verify the original manifest shows 7 bills (only 3 linked)', async () => {
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

  //further confidence on the same 3-manifest cap, with 5 manifests available instead of 4 - proves the cap holds
  //regardless of how many extra manifests exist beyond it, and that it blocks every extra attempt (5th as well
  //as 4th), not just the immediate next one after 3:
  test('express-mail company still cannot exceed 3 manifests even with 5 available', async ({
    page,
    viewImportManifestPage,
    newImportManifestData,
    masterBillData,
    loginPage,
  }) => {
    test.setTimeout(2_400_000);

    const newImportManExpPage = new NewImportManExpPage(page);
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
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();

      const received = await viewImportManifestPage.waitForManifestStatus(brokerManifestRef, 'تم استلامها', {
        intervalMs: 5_000,
        timeoutMs: 150_000,
      });
      if (!received) {
        throw new Error(`Broker manifest ${brokerManifestRef} was not received in time`);
      }
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

    //--- express-mail company side: 5 manifests this time (2 extras past the cap) ---
    const expressManifestRefs: string[] = [];

    await test.step('Log in as the express-mail company and create 5 manifests, each with two master bills', async () => {
      await loginPage.logout();
      await loginPage.loginToApplication(expressMailUser.username, expressMailUser.password, '999999');

      for (let i = 0; i < 5; i++) {
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

    await test.step('Wait for all 5 express-mail manifests to be received', async () => {
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();

      for (const ref of expressManifestRefs) {
        const received = await viewImportManifestPage.waitForManifestStatus(ref, 'تم استلامها', {
          intervalMs: 5_000,
          timeoutMs: 150_000,
        });
        if (!received) {
          throw new Error(`Express-mail manifest ${ref} was not received in time`);
        }
      }
    });

    const [firstRef, secondRef, thirdRef, fourthRef, fifthRef] = expressManifestRefs;

    await test.step('Express-mail company: select the first 3 manifests successfully', async () => {
      await linkPage.openConnectMenu();
      await linkPage.openDetailsByRequestNumber(transferRequestNumber);
      await linkPage.clickConnectRequest();

      await linkPage.selectManifestInConnectPicker(firstRef);
      await linkPage.selectManifestInConnectPicker(secondRef);
      await linkPage.selectManifestInConnectPicker(thirdRef);
    });

    await test.step('Attempting to select a 4th manifest is blocked by the portal\'s 3-manifest cap', async () => {
      await linkPage.search(fourthRef);
      const fourthCheckbox = page.locator(`#chk_${fourthRef}`);
      await expect(fourthCheckbox).toBeVisible({ timeout: 15_000 });
      await fourthCheckbox.click({ force: true, timeout: 5_000 }).catch(() => {});
      await expect(fourthCheckbox).not.toBeChecked();
    });

    await test.step('Attempting to select a 5th manifest is blocked too - the cap holds for every extra, not just the 4th', async () => {
      await linkPage.search(fifthRef);
      const fifthCheckbox = page.locator(`#chk_${fifthRef}`);
      await expect(fifthCheckbox).toBeVisible({ timeout: 15_000 });
      await fifthCheckbox.click({ force: true, timeout: 5_000 }).catch(() => {});
      await expect(fifthCheckbox).not.toBeChecked();
    });

    await test.step('Confirm the link with only the 3 selected manifests', async () => {
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

    await test.step('Express-mail company: verify each of the 3 linked manifests now shows 0 bills', async () => {
      for (const ref of [firstRef, secondRef, thirdRef]) {
        await newImportManExpPage.clickAirServices();
        await newImportManExpPage.clickAirImportManifest();
        await viewImportManifestPage.searchByReferenceNumber(ref);
        await viewImportManifestPage.openManifestByReferenceNumber(ref);

        const billsCount = await viewImportManifestPage.getArrivedBillsCount();
        console.log(`Express-mail manifest ${ref} bills count:`, billsCount);
        expect(billsCount).toBe(0);
      }
    });

    await test.step('Express-mail company: verify the unselected 4th and 5th manifests still keep their own 2 bills', async () => {
      for (const ref of [fourthRef, fifthRef]) {
        await newImportManExpPage.clickAirServices();
        await newImportManExpPage.clickAirImportManifest();
        await viewImportManifestPage.searchByReferenceNumber(ref);
        await viewImportManifestPage.openManifestByReferenceNumber(ref);

        const billsCount = await viewImportManifestPage.getArrivedBillsCount();
        console.log(`Express-mail manifest ${ref} (never selected) bills count:`, billsCount);
        expect(billsCount).toBe(2);
      }
    });

    await test.step('Log back in as the broker and verify the original manifest shows 7 bills (only 3 linked)', async () => {
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

  //negative case: submit a "تحويل البوالص الرئيسية للبريد السريع" request for a bill number that was never
  //created - no import manifest needed here, just the request form itself against bogus data:
  test('broker submits a link request for a bill that does not exist - gets an error', async ({
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
