import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { NewImportManPage } from '../pages/Import Manifest/NewImportManPage';
import { ViewImportManifestPage } from '../pages/Import Manifest/viewImportManByRefPage';
import { CreateNewEclPage } from '../pages/Import Manifest/createNewImportEClPage';
import { NewExportManPage } from '../pages/Export Manifest/newExportMan';
import { ViewExportManifestPage } from '../pages/Export Manifest/viewExportMan';
import { CreateNewExportEclPage } from '../pages/Export Manifest/createNewExportEclPage';
import { NewTransitManPage } from '../pages/Transit Manifest/createNewTransit';
import { ViewTransitManifestPage } from '../pages/Transit Manifest/viewTransit';
import { CreateNewTransitEclPage } from '../pages/Transit Manifest/createNewTransitEclPage';
import { NewDeliveryOrderPage } from '../pages/Delivery Order/newDeliveryOrderPage';
import { ShippingAgentAssignmentsPage } from '../pages/Freight Forwarder/ShippingAgentAssignmentsPage';
import { acsBrokerUser } from '../test-data/users';
import { createNewImportManifestData } from '../test-data/newImportManifestData';
import { createMasterBillData } from '../test-data/masterBillData';
import { createNewExportManifestData } from '../test-data/newExportManifestData';
import { createExportBillData, exportBillItemData } from '../test-data/exportBillData';
import { createNewTransitManifestData } from '../test-data/newTransitManifestData';

type Fixtures = {
    loginPage: LoginPage;
    newImportManPage: NewImportManPage;
    viewImportManifestPage: ViewImportManifestPage;
    createNewEclPage: CreateNewEclPage;
    newExportManPage: NewExportManPage;
    viewExportManifestPage: ViewExportManifestPage;
    createNewExportEclPage: CreateNewExportEclPage;
    newTransitManPage: NewTransitManPage;
    viewTransitManifestPage: ViewTransitManifestPage;
    createNewTransitEclPage: CreateNewTransitEclPage;
    newDeliveryOrderPage: NewDeliveryOrderPage;
    shippingAgentAssignmentsPage: ShippingAgentAssignmentsPage;
    //fresh per test (billNo/flightNumber are Date.now()-based), so a whole spec file running in one process
    //doesn't have every test collide on the same values. Only use these where each test creates its own
    //manifest/bill independently - some tests (e.g. viewImportManByRefTest.spec.ts) intentionally share a single
    //masterBillData/newImportManifestData across tests and should keep importing those directly instead:
    newImportManifestData: ReturnType<typeof createNewImportManifestData>;
    masterBillData: ReturnType<typeof createMasterBillData>;
    newExportManifestData: ReturnType<typeof createNewExportManifestData>;
    exportBillData: ReturnType<typeof createExportBillData>;
    exportBillItemData: typeof exportBillItemData;
    newTransitManifestData: ReturnType<typeof createNewTransitManifestData>;
};

//overrides the built-in "page" fixture to log in once before handing the page to the test, so every test using
//this file's `test` starts already authenticated - removes the need for a per-file beforeEach login block.
//(storageState-based session reuse was tried to avoid repeated automated logins, but this site relies on
//sessionStorage for auth state, which Playwright's storageState doesn't capture, so it never actually worked -
//space out rapid consecutive runs instead to avoid triggering the site's login throttling.)
export const test = base.extend<Fixtures>({
    page: async ({ page }, use) => {
        //NO_PAUSE=1 neutralises page.pause() (used in a finally block across the suite for interactive
        //debugging) so an unattended headed run doesn't hang forever on the first failure.
        if (process.env.NO_PAUSE) {
            page.pause = async () => {};
        }

        const loginPage = new LoginPage(page);

        await loginPage.navigateTo('https://soga.fasah.sa/ar/login/1.0/');
        await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');

        await use(page);
    },

    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },

    newImportManPage: async ({ page }, use) => {
        await use(new NewImportManPage(page));
    },

    viewImportManifestPage: async ({ page }, use) => {
        await use(new ViewImportManifestPage(page));
    },

    createNewEclPage: async ({ page }, use) => {
        await use(new CreateNewEclPage(page));
    },

    newExportManPage: async ({ page }, use) => {
        await use(new NewExportManPage(page));
    },

    viewExportManifestPage: async ({ page }, use) => {
        await use(new ViewExportManifestPage(page));
    },

    createNewExportEclPage: async ({ page }, use) => {
        await use(new CreateNewExportEclPage(page));
    },

    newTransitManPage: async ({ page }, use) => {
        await use(new NewTransitManPage(page));
    },

    viewTransitManifestPage: async ({ page }, use) => {
        await use(new ViewTransitManifestPage(page));
    },

    createNewTransitEclPage: async ({ page }, use) => {
        await use(new CreateNewTransitEclPage(page));
    },

    newDeliveryOrderPage: async ({ page }, use) => {
        await use(new NewDeliveryOrderPage(page));
    },

    shippingAgentAssignmentsPage: async ({ page }, use) => {
        await use(new ShippingAgentAssignmentsPage(page));
    },

    newImportManifestData: async ({}, use) => {
        await use(createNewImportManifestData());
    },

    masterBillData: async ({}, use) => {
        await use(createMasterBillData());
    },

    newExportManifestData: async ({}, use) => {
        await use(createNewExportManifestData());
    },

    exportBillData: async ({}, use) => {
        await use(createExportBillData());
    },

    exportBillItemData: async ({}, use) => {
        await use(exportBillItemData);
    },

    newTransitManifestData: async ({}, use) => {
        await use(createNewTransitManifestData());
    },
});

export { expect };
