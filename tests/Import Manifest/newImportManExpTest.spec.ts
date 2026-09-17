import { test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { NewImportManExpPage } from '../../pages/Import Manifest/newImportManExpPage';
import { ViewImportManifestPage } from '../../pages/Import Manifest/viewImportManByRefPage';
import { acsBrokerUser } from '../../test-data/users';
import { newImportManifestData } from '../../test-data/newImportManifestData';
import { masterBillData, airwayBillData, billItemData, warehouseData } from '../../test-data/masterBillData';
import { saveExpressReferenceNumber } from '../../test-data/expressReferenceStore';

test.describe('Create New Import Manifest Express Test', () => {
  let loginPage: LoginPage;
  let newImportManExpPage: NewImportManExpPage;
  let viewImportManifestPage: ViewImportManifestPage;

  test.beforeEach(async ({ page }) => {
    //NO_PAUSE=1 neutralises page.pause() (used in a finally block below for interactive debugging) so an
    //unattended headed run doesn't hang forever waiting for a manual resume - same guard as fixtures/testFixtures.ts.
    if (process.env.NO_PAUSE) {
      page.pause = async () => {};
    }

    loginPage = new LoginPage(page);
    newImportManExpPage = new NewImportManExpPage(page);
    viewImportManifestPage = new ViewImportManifestPage(page);
    await loginPage.navigateTo(
      'https://soga.fasah.sa/ar/login/1.0/'
    );
    await loginPage.loginToApplication(
        acsBrokerUser.username,
        acsBrokerUser.password,
        '999999'
    );
  });

  //13- Submit Import Manifest with one Completed Express mail  Import Bill
  test('create new import manifest full with express mail agent', async ({ page }) => {
    try {
    await newImportManExpPage.clickAirServices();
    await newImportManExpPage.clickAirImportManifest();
    await newImportManExpPage.clickCreateAirImportManifest();

    await test.step('Fill manifest information with Express Mail agent', async () => {
      await newImportManExpPage.fillManifestFormWithExpressMailAgent(newImportManifestData);
    });

    await test.step('Click save and continue button', async () => {
      await newImportManExpPage.clickSaveAndConitnue();
    });

    let referenceNo = '';

    await test.step('Add master bill with house bill', async () => {
      const { submittedReferenceNumber } = await viewImportManifestPage.addMasterBillWithHouseBill(
        masterBillData,
        airwayBillData,
        billItemData,
        warehouseData
      );
      referenceNo = submittedReferenceNumber;
      console.log('Import Manifest Reference Number:', referenceNo);
      console.log('Master Bill Number:', masterBillData.billNo);
      console.log('Master Bill Date:', masterBillData.billDate);
      console.log('Port (المنفذ):', newImportManifestData.finalAirportText);
      console.log('Carrier (شركة النقل):', masterBillData.transportCompany);
    });

    await test.step('View created import manifest', async () => {
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNo);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
      await viewImportManifestPage.openAllArrivedBillsDetails();
      await viewImportManifestPage.clickHistoryTab();
      await viewImportManifestPage.clickEclHistoryTab();
    });
    } finally {
      await page.pause();
    }
  });

  //14-Submit Import Manifest with one Express mail  Waiting  Import Bill
  test('Submit Import Manifest with one Express mail Waiting Import Bill', async ({ page }) => {
    try {
    await newImportManExpPage.clickAirServices();
    await newImportManExpPage.clickAirImportManifest();
    await newImportManExpPage.clickCreateAirImportManifest();

    await test.step('Fill manifest information with Express Mail agent', async () => {
      await newImportManExpPage.fillManifestFormWithExpressMailAgent(newImportManifestData);
    });

    await test.step('Click save and continue button', async () => {
      await newImportManExpPage.clickSaveAndConitnue();
    });

    let referenceNo = '';

    await test.step('Add master bill with partial arrival', async () => {
      const { submittedReferenceNumber } = await newImportManExpPage.addMasterBillWithPartialArrival(
        viewImportManifestPage,
        masterBillData,
        billItemData,
        warehouseData
      );
      referenceNo = submittedReferenceNumber;
    });

    await test.step('View created import manifest', async () => {
      await newImportManExpPage.clickAirServices();
      await newImportManExpPage.clickAirImportManifest();
      await viewImportManifestPage.searchByReferenceNumber(referenceNo);
      await viewImportManifestPage.verifyReferenceNumberDisplayed(referenceNo);
      await viewImportManifestPage.openManifestByReferenceNumber(referenceNo);
      await viewImportManifestPage.openAllArrivedBillsDetails();
      await viewImportManifestPage.clickHistoryTab();
      await viewImportManifestPage.clickEclHistoryTab();
    });
    } finally {
      await page.pause();
    }
  });

  //10 - Save Import Manifest Express (creates the draft only; viewing/editing is done separately in viewImportManExp.spec.ts):
  test('save import manifest express', async ({ page }) => {
    const referenceNoDraft = await newImportManExpPage.createManifestExpressDraft(newImportManifestData);
    console.log('Reference Number Draft:', referenceNoDraft);
    saveExpressReferenceNumber(referenceNoDraft);
    await page.pause();
  });

});
