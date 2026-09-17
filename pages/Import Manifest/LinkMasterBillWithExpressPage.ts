import { expect, type Locator, type Page } from '@playwright/test';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { ModalComponent } from '../../components/ModalComponent';

export type LinkExpressRequestData = {
    port: string;
    carrier: string;
    billNo: string;
    billDate: string; 
};

//"تحويل/ربط البوالص الرئيسية للبريد السريع" (package="Link_Master_Bill_with_Express") - the same menu/screens
//used by two different roles: the broker creates a request to transfer one of its own master bills to an express
//mail company, and that company then reviews the request and links it to manifest(s) it has already raised for
//the same bill.
export class LinkMasterBillWithExpressPage {
    private readonly page: Page;
    private readonly autocomplete: AutocompleteInput;
    private readonly modal: ModalComponent;

    private readonly transferMenu: Locator;
    private readonly connectMenu: Locator;
    private readonly newRequestButton: Locator;
    private readonly portInput: Locator;
    private readonly carrierInput: Locator;
    private readonly billNoInput: Locator;
    private readonly billDateInput: Locator;
    private readonly retrieveButton: Locator;
    private readonly transferToSelect: Locator;
    private readonly submitButton: Locator;
    private readonly searchField: Locator;
    private readonly connectRequestButton: Locator;
    private readonly confirmConnectButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.autocomplete = new AutocompleteInput(page);
        this.modal = new ModalComponent(page);

        //both roles see BOTH sidebar entries at once (same package attr, different label) - broker uses "تحويل
        //البوالص الرئيسية للبريد السريع", the express-mail company uses "ربط بوالص البريد السريع" - so the raw
        //package selector alone is a strict-mode violation (2 matches); disambiguate by label text.
        this.transferMenu = this.page
            .locator('[package="Link_Master_Bill_with_Express"]')
            .filter({ hasText: 'تحويل البوالص الرئيسية للبريد السريع' });
        this.connectMenu = this.page
            .locator('[package="Link_Master_Bill_with_Express"]')
            .filter({ hasText: 'ربط بوالص البريد السريع' });

        //broker side - "طلب جديد":
        this.newRequestButton = this.page
            .getByRole('button', { name: 'طلب جديد' })
            .and(this.page.locator(':visible'))
            .last();

        this.portInput = this.page
            .locator('input[test-attr="shipping_agent_link_express_mail_port"]')
            .and(this.page.locator(':visible'))
            .last();
        this.carrierInput = this.page
            .locator('input[test-attr="shipping_agent_link_express_mail_carrier"]')
            .and(this.page.locator(':visible'))
            .last();
        this.billNoInput = this.page
            .locator('input[test-attr="shipping_agent_link_express_mail_billno"]')
            .and(this.page.locator(':visible'))
            .last();
        //the same test-attr sits on both the "ميلادي" checkbox and the actual date text input - the field defaults
        //to Gregorian already (confirmed live: checking that toggle switches it TO Hijri instead, the opposite of
        //what its static caption suggests), so the checkbox is left untouched - only the text input is used:
        this.billDateInput = this.page
            .locator('input.f-datepicker-input[test-attr="shipping_agent_link_express_mail_billdate"]')
            .and(this.page.locator(':visible'))
            .last();
        this.retrieveButton = this.page
            .getByRole('button', { name: 'استرجاع' })
            .and(this.page.locator(':visible'))
            .last();
        //only present after a successful "استرجاع":
        this.transferToSelect = this.page
            .locator('select[test-attr="shipping_agent_link_express_mail_companytransferto"]')
            .and(this.page.locator(':visible'))
            .last();
        this.submitButton = this.page
            .getByRole('button', { name: 'تقديم', exact: true })
            .and(this.page.locator(':visible'))
            .last();

        //shared - both the request list and the connect-request manifest picker use the same generic search field:
        this.searchField = this.page
            .locator('input[test-attr="data-table-search-field"]')
            .and(this.page.locator(':visible'))
            .last();

        //express-mail company side - "ربط الطلب" (opens the manifest picker) and its confirm button. BOTH buttons
        //carry the identical accessible name "ربط الطلب" (the details page's own action button, then the modal's
        //own confirm button once it's open) - a name-based getByRole() collides between them and .last() can
        //resolve to whichever most recently existed, so connectRequestButton is scoped by its distinguishing
        //onclick handler instead (confirmed live: a getByRole('ربط الطلب') retry after the modal was already open
        //landed on the modal's own confirm button, not the details page's, breaking the retry):
        this.connectRequestButton = this.page
            .locator('button[onclick="fasah.Link_Master_Bill_with_Express_View.connectMnf()"]')
            .and(this.page.locator(':visible'))
            .last();
        this.confirmConnectButton = this.page
            .locator('button[data-method="ربط الطلب"]')
            .and(this.page.locator(':visible'))
            .last();
    }

    async waitForPageIdle(): Promise<void> {
        await this.page
            .waitForFunction(() => !document.documentElement.classList.contains('nprogress-busy'), undefined, {
                timeout: 15_000,
            })
            .catch(() => {});
    }

    //both transferMenu/connectMenu live inside the collapsible "خدمات الطيران" sidebar group - present in the DOM
    //but hidden until that parent is expanded. Other pages get this for free by having already clicked into a
    //sibling item (e.g. مانيفست الاستيراد الجوي) first; a caller landing here directly (e.g. right after login)
    //needs it expanded explicitly. Guarded the same way NewImportManPage.clickAirServices() is, so clicking an
    //already-open group doesn't collapse it back.
    private async ensureAirServicesExpanded(): Promise<void> {
        const airServicesMenu = this.page.getByText('خدمات الطيران').first();
        await expect(airServicesMenu).toBeVisible({ timeout: 20_000 });

        //"is it already open" is read off "مانيفست الاستيراد الجوي" (a neutral sibling item, always the first in
        //the group) rather than transferMenu/connectMenu themselves - same check NewImportManPage.clickAirServices()
        //uses for the identical group, and safer here: a manifest-status polling loop calling
        //viewImportManifestPage.searchByReferenceNumber() between calls can re-navigate/collapse the sidebar, and
        //transferMenu/connectMenu (further down the list) were seen live to lag a beat behind this item on
        //(re-)expand, which made this check read "already open" when it wasn't yet, and skip the click entirely:
        const airImportManifestItem = this.page.getByText('مانيفست الاستيراد الجوي').first();
        const alreadyOpen = await airImportManifestItem.isVisible().catch(() => false);
        if (!alreadyOpen) {
            await airServicesMenu.click();
            await this.waitForPageIdle();
        }
    }

    //broker side - opens "تحويل البوالص الرئيسية للبريد السريع":
    async openTransferMenu(): Promise<void> {
        await this.waitForPageIdle();
        await this.modal.closeAllIfPresent();
        await this.ensureAirServicesExpanded();
        await expect(this.transferMenu).toBeVisible({ timeout: 20_000 });
        await this.transferMenu.click();
        await this.waitForPageIdle();
    }

    //express-mail company side - opens "ربط بوالص البريد السريع":
    async openConnectMenu(): Promise<void> {
        await this.waitForPageIdle();
        await this.modal.closeAllIfPresent();
        await this.ensureAirServicesExpanded();
        await expect(this.connectMenu).toBeVisible({ timeout: 20_000 });
        await this.connectMenu.click();
        await this.waitForPageIdle();
    }

    //broker side: starts a new "تحويل البوالص الرئيسية للبريد السريع" request:
    async clickNewRequest(): Promise<void> {
        await this.waitForPageIdle();
        await expect(this.newRequestButton).toBeVisible({ timeout: 15_000 });
        await this.newRequestButton.click();
        await this.waitForPageIdle();
        await this.page.waitForTimeout(1_000);

        //waitForPageIdle() only tracks the nprogress-busy class (network activity), not the client-side render of
        //the "اضافة طلب جديد" form itself - confirmed live: arriving here right after a manifest-status polling
        //loop (several rapid navigations in a row) can leave the ajax call finished (nprogress already cleared)
        //while the form's own fields are still a beat away from mounting, well past this method's 1s buffer. Wait
        //for the form to actually be ready here, with a message that pins the failure on the form render itself
        //rather than surfacing as a generic autocomplete timeout in fillAndRetrieve():
        await expect(this.portInput, '"اضافة طلب جديد" form did not finish rendering after clicking "طلب جديد"').toBeVisible({
            timeout: 45_000,
        });
    }

    //fills the port/carrier/bill number/bill date and retrieves the bill's details from the portal:
    async fillAndRetrieve(data: LinkExpressRequestData): Promise<void> {
        await this.waitForPageIdle();

        await this.autocomplete.select(this.portInput, data.port);
        await this.autocomplete.select(this.carrierInput, data.carrier);

        //billNoInput has a custom oninput="fasahUtility.numberOnly(this)" handler - pressSequentially() types
        //real keystrokes so it (and anything else listening per-key) runs the same way it would for a real user:
        await this.billNoInput.click();
        await this.billNoInput.pressSequentially(data.billNo, { delay: 50 });

        //the date field defaults to Gregorian ("ميلادي") already - confirmed live that CHECKING this toggle
        //switches it TO Hijri (هجري) instead, the opposite of what its static "ميلادي" caption suggests. Leave it
        //untouched so the field stays on its default Gregorian mode, matching our Gregorian billDate:
        await this.billDateInput.click();
        await this.billDateInput.pressSequentially(data.billDate, { delay: 50 });
        await this.page.keyboard.press('Escape');

        //this datepicker's overlay stays open through Escape, locator-based clicks elsewhere, and clicking the
        //highlighted day cell - none of those reliably close it. A locator click({force:true}) doesn't help
        //either: force only skips Playwright's own actionability checks, it still performs a real click at that
        //element's screen coordinates, which the browser then routes to whatever actually sits on top there (the
        //overlay), not the covered element - confirmed live: the popup was still open and "استرجاع" never
        //actually fired even with force. A real page.mouse click at an empty corner of the page reliably closes
        //it instead:
        const overlay = this.page.locator('.f-datepicker-overlay.show');
        if (await overlay.isVisible().catch(() => false)) {
            await this.page.mouse.click(10, 10);
            await overlay.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
        }

        await expect(this.retrieveButton).toBeVisible({ timeout: 15_000 });
        await this.retrieveButton.click();
        await this.waitForPageIdle();
        await this.page.waitForTimeout(1_500);
    }

    //selects the express-mail company the bill is transferred to (only present after a successful retrieve):
    async selectTransferToCompany(companyName: string): Promise<void> {
        await expect(this.transferToSelect).toBeVisible({ timeout: 15_000 });
        await this.transferToSelect.selectOption({ label: companyName });
    }

    //a force:true click here would skip the "is this element enabled" check and silently no-op on the disabled
    //button (see InternalDeliveryOrderPage.clickSubmit()'s fix, same portal pattern) - wait for real enabled state:
    async clickSubmit(): Promise<void> {
        await this.waitForPageIdle();
        await expect(this.submitButton).toBeEnabled({ timeout: 15_000 });
        await this.submitButton.click();
    }

    //reads a "تم تقديم الطلب رقم <N> بنجاح" / "تم ربط البوليصة بنجاح" fasah-alert success message and closes it.
    //Returns the request number when the message contains one (the transfer-submit message does; the
    //link-confirm message doesn't, so requestNumber comes back '' there).
    async readAndCloseSuccessAlert(): Promise<{ requestNumber: string }> {
        const body = this.page.locator('.fasah-alert-body');
        await expect(body).toBeVisible({ timeout: 20_000 });

        const text = (await body.textContent()) ?? '';
        const [requestNumber = ''] = text.match(/\d+/g) ?? [];

        const closeIcon = this.page.locator('#modelcloseicon').and(this.page.locator(':visible')).last();
        const deadline = Date.now() + 30_000;
        while ((await body.isVisible().catch(() => false)) && Date.now() < deadline) {
            await closeIcon.click({ force: true, timeout: 5_000 }).catch(() => {});
            await this.page.waitForTimeout(1_000);
        }

        return { requestNumber };
    }

    //generic search, reused for both the request list and the connect-request manifest picker (same test-attr):
    async search(text: string): Promise<void> {
        await this.waitForPageIdle();
        //no closeAllIfPresent() here: this method is also used to search inside the connect-request picker modal
        //(itself a vx1-style popup), and closing "stray popups" right before searching was closing that modal -
        //confirmed live as the same bug just fixed in clickConnectRequest(). Any stray popup unrelated to a modal
        //this method needs to search within should already be closed by the caller (openMenu/openTransferMenu do
        //that before ever reaching here):
        await this.searchField.click();
        await this.searchField.fill('');
        await this.page.keyboard.type(text, { delay: 100 });
        await this.waitForPageIdle();
        await this.page.waitForTimeout(1_000);
    }

    private rowByRequestNumber(requestNumber: string): Locator {
        return this.page.locator('tbody tr').filter({
            has: this.page.locator('td[test-attr^="shipping_agent_link_express_mail_requestnumber"]', {
                hasText: requestNumber,
            }),
        });
    }

    async getRequestStatus(requestNumber: string): Promise<string> {
        const statusCell = this.rowByRequestNumber(requestNumber).locator(
            'td[test-attr^="shipping_agent_link_express_mail_status"]'
        );
        return (await statusCell.textContent())?.trim() ?? '';
    }

    //re-searches for the request and checks its status every intervalMs, until it matches expectedStatus or
    //timeoutMs elapses - same polling pattern used across this codebase's other status waits:
    async waitForRequestStatus(
        requestNumber: string,
        expectedStatus: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<boolean> {
        const intervalMs = options.intervalMs ?? 15_000;
        const timeoutMs = options.timeoutMs ?? 120_000;
        const deadline = Date.now() + timeoutMs;

        while (true) {
            await this.search(requestNumber);

            const status = await this.getRequestStatus(requestNumber);
            console.log(`Link-express request ${requestNumber} status: ${status}`);

            if (status.includes(expectedStatus)) {
                return true;
            }

            if (Date.now() >= deadline) {
                return false;
            }

            await this.page.waitForTimeout(intervalMs);
        }
    }

    //opens a request row's "عرض التفاصيل" - works for both the broker's and the express company's list (the
    //button label is the same, only its class differs between the two views):
    async openDetailsByRequestNumber(requestNumber: string): Promise<void> {
        await this.search(requestNumber);
        const row = this.rowByRequestNumber(requestNumber);
        await row.getByRole('button', { name: 'عرض التفاصيل' }).click();
        await this.waitForPageIdle();
        await this.page.waitForTimeout(1_500);
    }

    //express-mail company side: opens the manifest picker to start linking the request to manifests it has
    //already created for this bill. Seen live: right after the manifests involved have just settled into "تم
    //استلامها", this click can no-op the first time (the modal never opens, no error either) - a backend-lag race
    //matching the pattern documented for the FFW house-bill flow (ShippingAgentAssignmentsPage). Retry the click
    //until the modal's own confirm button - confirmed live to always be present once the picker is genuinely
    //open, unlike #chk_all which the page snapshot showed missing even with the picker's table fully rendered
    //with rows and checkboxes - actually shows up:
    async clickConnectRequest(): Promise<void> {
        const modalMarker = this.confirmConnectButton;
        const deadline = Date.now() + 60_000;

        //a leftover vx1 popup (license/pending-assignment notice, same pattern documented across this codebase)
        //can sit on top of the button and intercept the click - close it once before the first attempt. This
        //must NOT run again inside the retry loop below: the "ربط الطلب" picker modal turned out to use the same
        //vx1 popup markup itself, so re-running closeAllIfPresent() on a retry was closing the picker right back
        //after a click that had actually already opened it successfully - confirmed live as the real cause of
        //the "did not open" retries, not a genuine backend-lag race:
        await this.modal.closeAllIfPresent();

        while (true) {
            await expect(this.connectRequestButton).toBeVisible({ timeout: 15_000 });
            await this.connectRequestButton.click();
            await this.waitForPageIdle();

            const opened = await modalMarker
                .waitFor({ state: 'visible', timeout: 15_000 })
                .then(() => true)
                .catch(() => false);

            if (opened) {
                break;
            }
            if (Date.now() >= deadline) {
                throw new Error('"ربط الطلب" click did not open the manifest picker modal within the retry window');
            }
            console.log('"ربط الطلب" click did not open the manifest picker - retrying');
        }

        await this.page.waitForTimeout(1_000);
    }

    //selects a manifest's checkbox in the connect-request picker (searches for it first, via the same shared
    //search field):
    async selectManifestInConnectPicker(manifestRefNo: string): Promise<void> {
        await this.search(manifestRefNo);
        const checkbox = this.page.locator(`#chk_${manifestRefNo}`);
        await expect(checkbox).toBeVisible({ timeout: 15_000 });
        await checkbox.check();
    }

    async clickConfirmConnect(): Promise<void> {
        await expect(this.confirmConnectButton).toBeVisible({ timeout: 15_000 });
        await this.confirmConnectButton.click();
    }
}
