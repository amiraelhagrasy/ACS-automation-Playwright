import { test as base, expect, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { NewImportManPage } from '../pages/Import Manifest/newImportManifest';
import { ViewManifestPage } from '../pages/Import Manifest/viewManifestPage';
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
    //base ViewManifestPage class (NewImportManPage's parent), instantiated as its own stateless instance -
    //kept as its own fixture name since hundreds of call sites across the test files still call
    //viewImportManifestPage.X() and newImportManPage.Y() as if they were two different page objects. Typed as the
    //base rather than NewImportManPage since every call site only ever uses the shared view/search/master-bill/
    //house-bill methods, never an Import-manifest-creation-specific one:
    viewImportManifestPage: ViewManifestPage;
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

type WorkerFixtures = {
    //logged-in once per worker process (see below) and handed out as "page" to every test that worker runs:
    workerPage: Page;
};

//storageState-based session reuse was tried to avoid repeated automated logins, but this site relies on
//sessionStorage for auth state, which Playwright's storageState doesn't capture, so it never actually worked.
//This instead keeps one real browser tab open and logged in for a worker's entire lifetime, handing that same
//tab to every test the worker runs as "page" - a worker running its tests serially (every regression bucket
//does) now logs in once instead of once per test, which is what was actually triggering the site's login
//throttling when several buckets hit the same account at once. Trade-off: Playwright's automatic video/trace
//capture is tied to the built-in per-test page/context lifecycle, so it doesn't apply to this shared page -
//only the on-failure screenshot (which is page-level, not context-lifecycle-based) still works.
export const test = base.extend<Fixtures, WorkerFixtures>({
    workerPage: [async ({ browser }, use) => {
        const page = await browser.newPage();
        const loginPage = new LoginPage(page);

        await loginPage.navigateTo('https://soga.fasah.sa/ar/login/1.0/');
        await loginPage.loginToApplication(acsBrokerUser.username, acsBrokerUser.password, '999999');

        await use(page);

        await page.close();
    }, { scope: 'worker' }],

    page: async ({ workerPage }, use) => {
        await use(workerPage);
    },

    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },

    newImportManPage: async ({ page }, use) => {
        await use(new NewImportManPage(page));
    },

    viewImportManifestPage: async ({ page }, use) => {
        await use(new ViewManifestPage(page));
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
