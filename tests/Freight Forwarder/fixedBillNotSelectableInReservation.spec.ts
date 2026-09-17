import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { ShippingAgentAssignmentsPage } from '../../pages/Freight Forwarder/ShippingAgentAssignmentsPage';
import { masterBillData } from '../../test-data/masterBillData';
import { newImportManifestData } from '../../test-data/newImportManifestData';
import { ffwUser } from '../../test-data/users';

//Scenario variant: no manifest / no delivery order is created here, and there's no broker session either -
//this logs straight in as the freight forwarder (وسيط شحن). A fixed, pre-existing bill number (one that's
//already tied to a delivery order) is searched in the "انشاء طلب تعيين بوالص" form - it must show up in the
//results but with its checkbox disabled, so it can't be reserved. Override via env vars if needed.
const billNo = process.env.RES_BILL_NO ?? '108026008';
const billDate = process.env.RES_BILL_DATE ?? '17-08-2026';
const airport = process.env.RES_AIRPORT ?? newImportManifestData.finalAirportText;
const transportCompany = process.env.RES_CARRIER ?? masterBillData.transportCompany;
const flightNumber = process.env.RES_FLIGHT ?? '';

//local fixture: overrides the shared testFixtures `page` (which logs in as the broker) to log straight in as
//ffw11, since this scenario never needs a broker session.
const test = base.extend<{ shippingAgentAssignmentsPage: ShippingAgentAssignmentsPage }>({
  page: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigateTo('https://soga.fasah.sa/ar/login/1.0/');
    await loginPage.loginToApplication(ffwUser.username, ffwUser.password, '999999');
    await use(page);
  },
  shippingAgentAssignmentsPage: async ({ page }, use) => {
    await use(new ShippingAgentAssignmentsPage(page));
  },
});

test.describe('Fixed bill tied to a delivery order is not selectable in a reservation request', () => {
  test('the fixed bill appears in the reservation search but its checkbox is disabled', async ({
    page,
    shippingAgentAssignmentsPage,
  }) => {
    test.setTimeout(600_000);

    try {
      await test.step('Open البوالص المعينة and start a new reservation request', async () => {
        await shippingAgentAssignmentsPage.openAssignmentsList();
        await shippingAgentAssignmentsPage.openReservedBillsTab();
        await shippingAgentAssignmentsPage.clickCreateReservationRequest();
      });

      await test.step('Search for the fixed bill and confirm it is found but not selectable', async () => {
        await shippingAgentAssignmentsPage.fillReservationSearchForm(
          billDate,
          billNo,
          airport,
          transportCompany,
          flightNumber || undefined
        );

        const found = await shippingAgentAssignmentsPage.waitForReservationBillResult(billNo, {
          intervalMs: 15_000,
          timeoutMs: 180_000,
        });

        if (!found) {
          throw new Error(`Bill ${billNo} did not appear in the reservation search in time`);
        }

        await shippingAgentAssignmentsPage.verifyReservationBillNotSelectable(billNo);
      });
    } finally {
      await page.pause();
    }
  });
});

export { expect };
