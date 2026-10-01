import { expect, type Locator, type Page } from '@playwright/test';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { ModalComponent } from '../../components/ModalComponent';

export class ShippingAgentAssignmentsPage {
    private readonly page: Page;
    private readonly assignmentsListMenu: Locator;
    //"البوالص المرسلة والمعينة" renders 4 separate tables (sent/assigned bills + their withdrawal-request
    //variants), each with its own identically-attributed search field and tbody, so every locator here is
    //scoped to the "البوالص المرسلة" (Sent Bills) section specifically - the default active tab, and the one
    //with the accept/reject actions:
    private readonly sentBillsSection: Locator;
    private readonly searchField: Locator;
    //"طلبات سحب البوالص المرسلة" - the sibling tab to sentBillsSection, where the freight forwarder sees
    //withdrawal requests the broker filed against assignments this freight forwarder already accepted. Its
    //rows carry no manifest-reference column at all (confirmed from a real row's data-obj: no
    //docRefNo/deoDocRefNo, only assignmentid + remark), so rows there are matched by "رقم طلب التعيين" (the
    //assignment number) instead:
    private readonly withdrawRequestTab: Locator;
    private readonly withdrawRequestSection: Locator;
    //"البوالص المعينة" - bills reserved directly to this freight forwarder (not via a broker's delivery-order
    //referral), where "انشاء طلب تعيين بوالص" starts a new bill reservation request:
    private readonly reservedBillsTab: Locator;
    private readonly reservedBillsSection: Locator;
    private readonly createReservationRequestButton: Locator;
    //"انشاء طلب تعيين بوالص" form fields - search side (the form's own #createRequest form id, distinguishing
    //it from the receiver-info form below it on the same page):
    private readonly billDateFromInput: Locator;
    private readonly billDateToInput: Locator;
    private readonly billNumberInput: Locator;
    private readonly airportInput: Locator;
    private readonly reservationFlightNumberInput: Locator;
    private readonly reservationTransportCompanyInput: Locator;
    private readonly reservationSearchButton: Locator;
    //"انشاء طلب تعيين بوالص" form fields - receiver-info side (#receiverInfo, below the search results):
    private readonly receiverNameInput: Locator;
    private readonly receiverIdInput: Locator;
    private readonly saveReservationRequestButton: Locator;
    private readonly reservedBillsSearchField: Locator;
    private readonly autocomplete: AutocompleteInput;
    private readonly modal: ModalComponent;

    constructor(page: Page) {
        this.page = page;
        this.autocomplete = new AutocompleteInput(page);
        this.modal = new ModalComponent(page);
        this.assignmentsListMenu = page.locator('[package="shipping_agent_assignments_list"]');
        this.sentBillsSection = page.getByLabel('البوالص المرسلة', { exact: true });
        this.searchField = this.sentBillsSection.getByPlaceholder('بحث');
        this.withdrawRequestTab = page.locator('#withdrawRequest-tab');
        this.withdrawRequestSection = page.getByLabel('طلبات سحب البوالص المرسلة', { exact: true });
        this.reservedBillsTab = page.locator('#reservedBills-tab');
        this.reservedBillsSection = page.getByLabel('البوالص المعينة', { exact: true });
        this.createReservationRequestButton = this.reservedBillsSection.locator(
            'button[onclick="fasah.shipping_agent_assignments_list.createRequest()"]'
        );

        //the same test-attr is reused on both the hijri/gregorian toggle checkbox and the actual date text
        //input, so these are scoped to the .f-datepicker-input class specifically to avoid a strict-mode clash:
        const createRequestForm = page.locator('#createRequest');
        this.billDateFromInput = createRequestForm.locator(
            'input.f-datepicker-input[test-attr="shipping_agent_freight_forwarder_bill_date_from"]'
        );
        this.billDateToInput = createRequestForm.locator(
            'input.f-datepicker-input[test-attr="shipping_agent_freight_forwarder_bill_date_to"]'
        );
        this.billNumberInput = createRequestForm.locator('input[test-attr="shipping_agent_link_express_mail_billno"]');
        this.airportInput = createRequestForm.locator('input[test-attr="shipping_agent_freight_forwarder_airport"]');
        this.reservationFlightNumberInput = createRequestForm.locator(
            'input[test-attr="shipping_agent_air_manifest_create_flight_no"]'
        );
        this.reservationTransportCompanyInput = createRequestForm.locator(
            'input[test-attr="shipping_agent_link_express_mail_carrier"]'
        );
        //the "بحث" button carries a leading <i class="icon-search"> whose icon-font pseudo-element glyph gets
        //prepended to the button's accessible name, so { exact: true } on "بحث" matches 0 elements and click()
        //then hangs forever (no action timeout). Substring name + :visible + .last() is the same shape the
        //working Transit "بحث" button uses - the 4 list-table search buttons sit in hidden tabs once the
        //create-request form is open, so only this one is :visible.
        this.reservationSearchButton = page
            .getByRole('button', { name: 'بحث' })
            .and(page.locator(':visible'))
            .last();

        const receiverInfoForm = page.locator('#receiverInfo').last();
        this.receiverNameInput = receiverInfoForm.locator(
            'input[test-attr="shipping_agent_manifest_labels_receivername"]'
        );
        this.receiverIdInput = receiverInfoForm.locator('input[test-attr="shipping_agent_manifest_labels_receiverid"]');
        this.saveReservationRequestButton = page.getByRole('button', { name: 'حفظ', exact: true });
        this.reservedBillsSearchField = this.reservedBillsSection.getByPlaceholder('بحث');
    }

    async waitForPageIdle() {
        //best-effort, same as the other waitForPageIdle() implementations in this codebase: a slow-but-fine page
        //(nprogress-busy lingering under load) shouldn't hard-fail the caller.
        await this.page
            .waitForFunction(
                () => !document.documentElement.classList.contains('nprogress-busy'),
                undefined,
                { timeout: 15000 }
            )
            .catch(() => {});
    }

    //opens "البوالص المرسلة والمعينة". On the freight forwarder (ffw11) side it's already a top-level sidebar
    //item; on the broker (b3078) side it instead lives inside the collapsible "خدمات الطيران" menu, same as the
    //import manifest/delivery order links - so expand that first if it's present at all:
    async openAssignmentsList(): Promise<void> {
        await this.waitForPageIdle();

        const airServicesMenu = this.page.getByText('خدمات الطيران');

        //confirmed live, 2026-09-28: a popup (password/license expiry, a pending-assignment notice, or the
        //"الشروط والأحكام" popup) can appear or reappear at any point in this sequence - right at the start,
        //right after expanding "خدمات الطيران", or in the gap before the visibility check below - not just once
        //up front. Retry the WHOLE sequence (close modals, expand the menu if needed, wait visible, click)
        //together instead of only guarding the final click, so a modal reappearing mid-sequence doesn't fail the
        //visibility check before the old per-click-only retry loop ever got a chance to recover:
        let clicked = false;
        for (let attempt = 1; attempt <= 3 && !clicked; attempt++) {
            await this.modal.closeAllIfPresent();
            await this.page.locator('.modal-backdrop').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});

            const airServicesMenuPresent = await airServicesMenu.isVisible().catch(() => false);

            if (airServicesMenuPresent) {
                const alreadyOpen = await this.assignmentsListMenu.isVisible().catch(() => false);

                if (!alreadyOpen) {
                    await airServicesMenu.click().catch(() => {});
                }
            }

            const visible = await this.assignmentsListMenu
                .waitFor({ state: 'visible', timeout: 20_000 })
                .then(() => true)
                .catch(() => false);

            if (!visible) {
                continue;
            }

            await this.modal.closeAllIfPresent();
            await this.page.locator('.modal-backdrop').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});

            clicked = await this.assignmentsListMenu
                .click({ timeout: 15_000 })
                .then(() => true)
                .catch(() => false);
        }

        //surface a clear failure instead of silently moving on if every attempt failed:
        await expect(this.assignmentsListMenu).toBeVisible({ timeout: 5_000 });
    }

    async searchByReferenceNumber(referenceNumber: string): Promise<void> {
        await this.waitForPageIdle();

        //a leftover ffw11 vx1 popup can sit over the البوالص المرسلة section and make this click hang forever
        //(no action timeout) until the test times out and the browser closes.
        //
        //confirmed live, 2026-09-29: an earlier fix here only wrapped the CLICK in a modal-close retry loop, with
        //an unguarded toBeVisible() check still running first - a popup covering the search field right at that
        //moment failed the whole method before the retry loop was ever reached (same class of bug already fixed
        //in openAssignmentsList()/clickAirImportManifest()). Close modals BEFORE the visibility check too, and
        //retry the whole sequence together:
        let clicked = false;
        for (let attempt = 1; attempt <= 3 && !clicked; attempt++) {
            await this.modal.closeAllIfPresent();

            const visible = await this.searchField
                .waitFor({ state: 'visible', timeout: 20_000 })
                .then(() => true)
                .catch(() => false);

            if (!visible) {
                continue;
            }

            await this.modal.closeAllIfPresent();

            clicked = await this.searchField
                .click({ timeout: 15_000 })
                .then(() => true)
                .catch(() => false);
        }

        //surface a clear failure instead of silently moving on if every attempt failed:
        await expect(this.searchField).toBeVisible({ timeout: 5_000 });

        await this.searchField.fill('');
        await this.page.keyboard.type(referenceNumber, { delay: 100 });
    }

    private rowByReferenceNumber(referenceNumber: string): Locator {
        return this.sentBillsSection.locator('tbody tr').filter({
            has: this.page.locator(
                'td[test-attr^="shipping_agent_manifest_labels_mafdocrefno_"]',
                { hasText: referenceNumber }
            ),
        });
    }

    //the referral doesn't show up in the freight forwarder's list the instant it's made on the broker side -
    //there's a backend propagation delay - so this re-searches every intervalMs until the row appears or
    //timeoutMs runs out, same polling shape as waitForManifestStatus()/waitForDeliveryOrderStatus() elsewhere:
    async waitForAssignmentToAppear(
        referenceNumber: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<boolean> {
        const intervalMs = options.intervalMs ?? 10_000;
        const timeoutMs = options.timeoutMs ?? 180_000;
        const deadline = Date.now() + timeoutMs;

        while (true) {
            await this.searchByReferenceNumber(referenceNumber);

            //the table re-filters asynchronously after typing, so poll for a few seconds instead of an
            //instant isVisible() check that can run before the filtered results have rendered:
            const visible = await this.rowByReferenceNumber(referenceNumber)
                .first()
                .waitFor({ state: 'visible', timeout: 5_000 })
                .then(() => true)
                .catch(() => false);

            console.log(`Assignment ${referenceNumber} visible in freight forwarder list: ${visible}`);

            if (visible) {
                return true;
            }

            if (Date.now() >= deadline) {
                return false;
            }

            await this.page.waitForTimeout(intervalMs);
        }
    }

    //clicks "قبول" on the matching row - no confirm dialog, it goes straight to a "تم قبول طلب التعيين..." success
    //alert. Some referrals land already "مقبول" (auto-accepted, row shows only "التفاصيل" and no "قبول") - in that
    //case there's nothing to do, so this returns quietly instead of hanging on a button that isn't there.
    async acceptManifest(
        referenceNumber: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<void> {
        const appeared = await this.waitForAssignmentToAppear(referenceNumber, options);

        if (!appeared) {
            throw new Error(`Assignment ${referenceNumber} did not appear in the freight forwarder's list in time`);
        }

        const row = this.rowByReferenceNumber(referenceNumber);
        const acceptButton = row.getByRole('button', { name: 'قبول' });

        const hasAcceptButton = await acceptButton.isVisible().catch(() => false);
        if (!hasAcceptButton) {
            console.log(`الإحالة ${referenceNumber} مقبولة بالفعل (مفيش زرار "قبول" على الصف)`);
            return;
        }

        await acceptButton.click({ timeout: 15_000 });

        const successMessage = this.page.locator('.fasah-alert-body').filter({
            hasText: 'تم قبول طلب التعيين',
        });
        await expect(successMessage).toBeVisible({ timeout: 15_000 });
        await this.modal.closeAllIfPresent();
    }

    //polls the assignment row until its status cell reads "مقبول" (the referral has finished being accepted).
    async waitForAssignmentAccepted(
        referenceNumber: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<boolean> {
        const intervalMs = options.intervalMs ?? 10_000;
        const timeoutMs = options.timeoutMs ?? 240_000;
        const deadline = Date.now() + timeoutMs;

        while (true) {
            await this.waitForAssignmentToAppear(referenceNumber, { intervalMs: 5_000, timeoutMs: 30_000 });

            const accepted = await this.rowByReferenceNumber(referenceNumber)
                .getByRole('cell', { name: 'مقبول', exact: true })
                .first()
                .isVisible()
                .catch(() => false);

            console.log(`Assignment ${referenceNumber} status is مقبول: ${accepted}`);

            if (accepted) {
                return true;
            }

            if (Date.now() >= deadline) {
                return false;
            }

            await this.page.waitForTimeout(intervalMs);
        }
    }

    //clicks "رفض" on the matching row, which opens a "رفض طلب إحالة البوليصة" modal requiring a reason before it
    //lets you confirm - the modal's own submit button carries the same "رفض" label as the row's trigger button,
    //so it's targeted by its distinguishing data-method="رفض" attribute instead of role/name:
    async rejectManifest(
        referenceNumber: string,
        reason: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<void> {
        const appeared = await this.waitForAssignmentToAppear(referenceNumber, options);

        if (!appeared) {
            throw new Error(`Assignment ${referenceNumber} did not appear in the freight forwarder's list in time`);
        }

        const row = this.rowByReferenceNumber(referenceNumber);
        await row.getByRole('button', { name: 'رفض' }).click();

        const reasonTextarea = this.page.locator('textarea[test-attr="سبب الرفض"]');
        await expect(reasonTextarea).toBeVisible({ timeout: 10_000 });
        await reasonTextarea.fill(reason);

        await this.page.locator('button[data-method="رفض"]').click();

        const successMessage = this.page.locator('.fasah-alert-body').filter({
            hasText: 'تم رفض طلب التعيين',
        });

        await expect(successMessage).toBeVisible({ timeout: 15_000 });
    }

    //withdraws a request the freight forwarder already accepted ("مقبول" - accept/reject swap for a single

    async withdrawManifest(
        referenceNumber: string,
        reason: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<string> {
        const appeared = await this.waitForAssignmentToAppear(referenceNumber, options);

        if (!appeared) {
            throw new Error(`Assignment ${referenceNumber} did not appear in the freight forwarder's list in time`);
        }

        const row = this.rowByReferenceNumber(referenceNumber);

        const assignmentNumber = (
            await row.locator('td[test-attr^="shipping_agent_freight_forwarder_assignment_number_"]').textContent()
        )?.trim() ?? '';

        await row.getByRole('button', { name: 'سحب الطلب' }).click();

        const reasonTextarea = this.page.locator('textarea[test-attr="سبب طلب سحب البوليصة"]');
        await expect(reasonTextarea).toBeVisible({ timeout: 10_000 });
        await reasonTextarea.fill(reason);

        await this.page.locator('button[data-method="إرسال"]').click();

        const successMessage = this.page.locator('.fasah-alert-body').filter({
            hasText: 'تم ارسال طلب سحب البوالص',
        });

        await expect(successMessage).toBeVisible({ timeout: 15_000 });

        return assignmentNumber;
    }

    //on the broker's own account (not the freight forwarder's), a rejected row's actions include "سبب الرفض"

    async getRejectionReason(
        referenceNumber: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<string> {
        const appeared = await this.waitForAssignmentToAppear(referenceNumber, options);

        if (!appeared) {
            throw new Error(`Assignment ${referenceNumber} did not appear in the list in time`);
        }

        const row = this.rowByReferenceNumber(referenceNumber);
        await row.getByRole('button', { name: 'سبب الرفض' }).click();

        const reasonModal = this.page.locator('.modal-content').filter({
            has: this.page.locator('.modal-title', { hasText: 'سبب الرفض' }),
        });
        await expect(reasonModal).toBeVisible({ timeout: 10_000 });

        const reason = (await reasonModal.locator('.modal-body').textContent())?.trim() ?? '';

        await reasonModal.getByRole('button', { name: 'إغلاق' }).click();

        return reason;
    }

    //opens "طلبات سحب البوالص المرسلة" from within an already-open assignments list:
    async openWithdrawRequestsTab(): Promise<void> {
        await this.waitForPageIdle();
        await this.withdrawRequestTab.click();

        //confirmed live, 2026-09-28: the tab's own content (including its search box) loads via a separate AJAX
        //call after the click and can still be entirely unrendered - no rows, no "no data" message, no search
        //box - well after the click itself resolves. Wait for the pane's search box specifically rather than
        //assuming waitForPageIdle() alone covers this async content load:
        await this.withdrawRequestSection
            .getByPlaceholder('بحث')
            .waitFor({ state: 'visible', timeout: 30_000 })
            .catch(() => {});
    }

    //opens "البوالص المعينة" from within an already-open assignments list. Confirmed live, 2026-09-30: a bare
    //click on the tab can silently not take effect (screenshot showed البوالص المرسلة still active afterward,
    //not this tab) - same class of unguarded-click bug already fixed elsewhere in this file. Retry the click
    //until the panel's own createRequest button actually becomes visible, rather than trusting the click alone:
    async openReservedBillsTab(): Promise<void> {
        await this.waitForPageIdle();

        //confirmed live, 2026-09-30: the tab itself can switch correctly (shown active/underlined) while its
        //content pane stays completely empty for longer than the original 10s-per-attempt budget - same class of
        //async content-load lag already seen in openWithdrawRequestsTab(). Give each attempt more room:
        for (let attempt = 1; attempt <= 3; attempt++) {
            await this.modal.closeAllIfPresent();
            await this.reservedBillsTab.click().catch(() => {});

            const visible = await this.createReservationRequestButton
                .waitFor({ state: 'visible', timeout: 20_000 })
                .then(() => true)
                .catch(() => false);

            if (visible) {
                return;
            }
        }
    }

    //starts a new bill reservation request ("انشاء طلب تعيين بوالص") from within البوالص المعينة:
    async clickCreateReservationRequest(): Promise<void> {
        //confirmed live, 2026-10-01: even right after openReservedBillsTab() itself confirmed this exact button
        //visible, the content pane can go back to completely empty by the time this runs (not a popup - the
        //whole tab content just resets/re-loads moments later). A passive wait alone doesn't recover from that,
        //so re-click the تاب itself to force a fresh content load, not just wait for the old one to come back:
        for (let attempt = 1; attempt <= 3; attempt++) {
            await this.modal.closeAllIfPresent();

            const visible = await this.createReservationRequestButton
                .waitFor({ state: 'visible', timeout: 15_000 })
                .then(() => true)
                .catch(() => false);

            if (visible) {
                await this.createReservationRequestButton.click();
                return;
            }

            await this.reservedBillsTab.click().catch(() => {});
        }

        //surface a clear failure instead of silently moving on if every attempt failed:
        await expect(this.createReservationRequestButton).toBeVisible({ timeout: 5_000 });
        await this.createReservationRequestButton.click();
    }

    //fills the "انشاء طلب تعيين بوالص" search form with the bill's own data (billDate/billNo from the master
    //bill, airport from the import manifest's final airport, transport company shared by both) - same
    //click/fill/Tab date pattern used elsewhere (NewImportManPage.fillDate()). flightNumber is optional on
    //this form, unlike the required fields:
    async fillReservationSearchForm(
        billDate: string,
        billNo: string,
        airport: string,
        transportCompany: string,
        flightNumber?: string
    ): Promise<void> {
        await expect(this.billDateFromInput).toBeVisible({ timeout: 15_000 });

        await this.billDateFromInput.click();
        await this.billDateFromInput.fill(billDate);
        await this.billDateFromInput.press('Tab');

        await this.billDateToInput.click();
        await this.billDateToInput.fill(billDate);
        await this.billDateToInput.press('Tab');

        await this.billNumberInput.fill(billNo);

        await this.autocomplete.select(this.airportInput, airport);

        if (flightNumber) {
            await this.reservationFlightNumberInput.fill(flightNumber);
        }

        await this.autocomplete.select(this.reservationTransportCompanyInput, transportCompany);
    }

    async clickReservationSearchButton(): Promise<void> {
        await this.waitForPageIdle();
        //bounded timeout: without one a broken locator hangs until the whole test times out (~10 min) instead
        //of failing here with a clear message.
        await expect(this.reservationSearchButton).toBeVisible({ timeout: 15_000 });
        await this.reservationSearchButton.click({ timeout: 15_000 });
    }

    //the bill only becomes searchable here once its master bill reaches "مكتملة" (masterStatus "CMP") -
    //confirmed live: a later status like "تم استلامها" on the manifest itself isn't enough yet, and there's no
    //visible status field for masterStatus elsewhere to poll directly, so this just re-runs the same search
    //(form fields stay filled from fillReservationSearchForm()) until the row appears:
    async waitForReservationBillResult(
        billNo: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<boolean> {
        const intervalMs = options.intervalMs ?? 15_000;
        const timeoutMs = options.timeoutMs ?? 180_000;
        const deadline = Date.now() + timeoutMs;

        while (true) {
            await this.clickReservationSearchButton();

            const visible = await this.page
                .locator(`#chk_${billNo}`)
                .waitFor({ state: 'visible', timeout: 5_000 })
                .then(() => true)
                .catch(() => false);

            console.log(`Bill ${billNo} visible in reservation search: ${visible}`);

            if (visible) {
                return true;
            }

            if (Date.now() >= deadline) {
                return false;
            }

            await this.page.waitForTimeout(intervalMs);
        }
    }

    //checks the matching bill's row checkbox in the search results (id="chk_<billNumber>"). A bill that's
    //already tied to another reservation request / already assigned comes back in the results with its checkbox
    //rendered but disabled="disabled" - detect that up front and fail with a clear message instead of letting
    //check() retry until the whole test times out (~10 min).
    async checkReservationBillCheckbox(billNo: string): Promise<void> {
        const checkbox = this.page.locator(`#chk_${billNo}`);
        await expect(checkbox).toBeVisible({ timeout: 15_000 });

        const selectable = await checkbox.isEnabled().catch(() => false);
        if (!selectable) {
            console.log(
                `البوليصة ${billNo} غير متاحة للاختيار (الـ checkbox معطّل) - على الأرجح استُخدمت في طلب تعيين سابق أو معيّنة بالفعل`
            );
            throw new Error(`Bill ${billNo} is not selectable - already used in a previous reservation request or already assigned`);
        }

        await checkbox.check({ timeout: 15_000 });
    }

    //negative-path assertion: the bill DOES show up in the reservation search results, but its checkbox is
    //disabled so it can't be picked here - the expected outcome when the bill is already tied to a delivery
    //order (إذن تسليم). Passes when the checkbox is present and disabled; fails if it's selectable.
    async verifyReservationBillNotSelectable(billNo: string): Promise<void> {
        const checkbox = this.page.locator(`#chk_${billNo}`);
        await expect(checkbox).toBeVisible({ timeout: 15_000 });
        await expect(checkbox).toBeDisabled({ timeout: 15_000 });
        console.log(
            `البوليصة ${billNo} ظهرت في نتائج البحث لكن الـ checkbox معطّل - لا يمكن اختيارها هنا لأنها مرتبطة بإذن تسليم (كما هو متوقع)`
        );
    }

    //fills just the required receiver fields (اسم المستلم / رقم بطاقة المستلم) - رقم المستورد and اسم المالك
    //بالعربي are left blank, both optional on this form:
    async fillReceiverInfo(receiverName: string, receiverId: string): Promise<void> {
        await expect(this.receiverNameInput).toBeVisible({ timeout: 15_000 });
        await this.receiverNameInput.fill(receiverName);
        await this.receiverIdInput.fill(receiverId);
    }

    async clickSaveReservationRequest(): Promise<void> {
        await this.saveReservationRequestButton.click();
    }

    //reads "رقم الطلب" out of the "تم حفظ الطلب كمسودة رقم <N> بنجاح" success alert - unlike the other success
    //alerts in this file, this one renders inside a modal's .modal-body rather than as a page-level toast, and
    //the number isn't wrapped in its own <strong> tag, so it's pulled out with a regex instead:
    async getReservationRequestNumber(): Promise<string> {
        const successMessage = this.page.locator('.modal-body .fasah-alert-body').filter({
            hasText: 'تم حفظ الطلب كمسودة',
        });
        await expect(successMessage).toBeVisible({ timeout: 15_000 });

        const text = (await successMessage.textContent()) ?? '';
        return text.match(/\d+/)?.[0] ?? '';
    }

    //closes the "تم حفظ الطلب كمسودة..." modal via its header close icon - same #modelcloseicon pattern used
    //site-wide for this style of alert modal. Closing it navigates back to البوالص المرسلة والمعينة on its own:
    async closeReservationRequestSuccessModal(): Promise<void> {
        await this.page.locator('#modelcloseicon').first().click();
    }

    //re-searches البوالص المعينة's own list (the draft request rows, not the create-request form's bill-search
    //results) by the draft's "رقم الطلب" - same generic search field pattern as every other tab here:
    async searchReservedBillsByRequestNumber(requestNumber: string): Promise<void> {
        await this.waitForPageIdle();
        await this.reservedBillsSearchField.click();
        await this.reservedBillsSearchField.fill('');
        await this.page.keyboard.type(requestNumber, { delay: 100 });
    }

    //matches the draft row by its "رقم طلب التعيين" cell. This table's cell does NOT carry the
    //shipping_agent_freight_forwarder_assignment_number_ test-attr that sentBillsSection/withdrawRequestSection
    //rows use (confirmed live: filtering on that prefix found 0 rows even though the row was rendered), so it's
    //matched by the exact cell text instead - the search field has already narrowed the table to this one row:
    private reservedBillRowByRequestNumber(requestNumber: string): Locator {
        return this.reservedBillsSection.locator('tbody tr').filter({
            has: this.page.getByRole('cell', { name: requestNumber, exact: true }),
        });
    }

    async openReservedBillRequest(requestNumber: string): Promise<void> {
        const row = this.reservedBillRowByRequestNumber(requestNumber);
        await expect(row).toBeVisible({ timeout: 15_000 });
        await row.click();
    }

    //scoped to :visible().last() like other edit/submit buttons across this codebase (e.g.
    //ViewImportManifestPage.clickEditButton()) - a prior screen's own buttons can stay behind in the DOM hidden
    //rather than removed when navigating between these SPA views:
    async clickEditReservationRequest(): Promise<void> {
        const editButton = this.page
            .getByRole('button', { name: 'تعديل', exact: true })
            .and(this.page.locator(':visible'))
            .last();

        await expect(editButton).toBeVisible({ timeout: 15_000 });
        await editButton.click();
    }

    async clickSubmitWithAutoAccept(): Promise<void> {
        await this.waitForPageIdle();
        await this.modal.closeAllIfPresent();

        const submitButton = this.page
            .getByRole('button', { name: 'تقديم مع الموافقة التلقائية', exact: true })
            .and(this.page.locator(':visible'))
            .last();

        await expect(submitButton).toBeVisible({ timeout: 15_000 });

        //confirmed live, 2026-09-30: scrollIntoViewIfNeeded() followed immediately by click() can still throw
        //"Element is outside of the viewport" on this specific long edit-request form - the scroll apparently
        //doesn't always finish settling (or the page's own layout is still shifting) before the click fires.
        //Retry the scroll+click together instead of failing on the first attempt:
        let clicked = false;
        for (let attempt = 1; attempt <= 3 && !clicked; attempt++) {
            await submitButton.scrollIntoViewIfNeeded();
            await this.page.waitForTimeout(500);
            clicked = await submitButton
                .click({ force: true, timeout: 15_000 })
                .then(() => true)
                .catch(() => false);
        }

        if (!clicked) {
            //surface a clear failure instead of silently proceeding as if the click succeeded:
            await submitButton.click({ force: true, timeout: 15_000 });
        }

        //the "تم تقديم الطلب رقم N بنجاح" success modal should follow; if it hasn't shown in a few seconds the
        //click likely didn't register - click once more.
        await this.page
            .locator('.fasah-alert-modal .fasah-alert-body')
            .filter({ hasText: 'تم تقديم الطلب' })
            .waitFor({ state: 'visible', timeout: 8_000 })
            .catch(async () => {
                await submitButton.click({ force: true, timeout: 10_000 }).catch(() => {});
            });
    }

    //after "تقديم مع الموافقة التلقائية" a "تنبيه من فسح" success modal shows "تم تقديم الطلب رقم <req> بنجاح"
    //plus the auto-generated إذن تسليم numbers for the master bill. Reads those out and closes the modal via its
    //footer "إغلاق" button so the next navigation isn't blocked by the backdrop.
    async readAndCloseAutoAcceptSuccessModal(): Promise<{
        requestNumber: string;
        deliveryOrderNumber: string;
        deliveryOrderSerial: string;
    }> {
        const body = this.page
            .locator('.fasah-alert-modal .fasah-alert-body')
            .filter({ hasText: 'تم تقديم الطلب' });
        await expect(body).toBeVisible({ timeout: 40_000 });

        const nums = ((await body.textContent()) ?? '').match(/\d+/g) ?? [];
        const [requestNumber = '', deliveryOrderNumber = '', deliveryOrderSerial = ''] = nums;

        //the modal's backdrop/animation can intercept pointer events, so a single close click intermittently
        //no-ops (confirmed live: the modal can stay open through several individual close attempts, not just
        //one) - close via the header X icon with force:true (same #modelcloseicon pattern the other success-modal
        //closers in this file use), falling back to the footer "إغلاق" button, and keep retrying both until the
        //modal actually closes rather than trying once and asserting.
        const closeIcon = this.page
            .locator('.fasah-alert-modal #modelcloseicon')
            .and(this.page.locator(':visible'))
            .last();
        const closeButton = this.page
            .locator('.fasah-alert-modal')
            .getByRole('button', { name: 'إغلاق' })
            .and(this.page.locator(':visible'))
            .last();

        const deadline = Date.now() + 45_000;
        while ((await body.isVisible().catch(() => false)) && Date.now() < deadline) {
            await closeIcon.click({ force: true, timeout: 5_000 }).catch(() => {});
            if (!(await body.isVisible().catch(() => false))) break;
            await closeButton.click({ force: true, timeout: 5_000 }).catch(() => {});
            if (!(await body.isVisible().catch(() => false))) break;
            await this.page.waitForTimeout(1_500);
        }

        await expect(body).toBeHidden({ timeout: 15_000 });

        return { requestNumber, deliveryOrderNumber, deliveryOrderSerial };
    }

    //same "رقم طلب التعيين" (assignment number) column exists here as in sentBillsSection's table, so rows are
    //matched by that instead of anything remark/reference-number-based - searching by the remark text directly
    //doesn't reliably match (confirmed live: the search field doesn't index it):
    private rowByAssignmentNumber(assignmentNumber: string): Locator {
        return this.withdrawRequestSection.locator('tbody tr').filter({
            has: this.page.locator(
                'td[test-attr^="shipping_agent_freight_forwarder_assignment_number_"]',
                { hasText: assignmentNumber }
            ),
        });
    }

    async waitForWithdrawalRequestToAppear(
        assignmentNumber: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<boolean> {
        const intervalMs = options.intervalMs ?? 10_000;
        const timeoutMs = options.timeoutMs ?? 180_000;
        const deadline = Date.now() + timeoutMs;

        const searchField = this.withdrawRequestSection.getByPlaceholder('بحث');

        while (true) {
            await this.waitForPageIdle();
            await searchField.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
            await searchField.click();
            await searchField.fill('');
            await this.page.keyboard.type(assignmentNumber, { delay: 50 });

            const visible = await this.rowByAssignmentNumber(assignmentNumber)
                .first()
                .waitFor({ state: 'visible', timeout: 5_000 })
                .then(() => true)
                .catch(() => false);

            console.log(`Withdrawal request ${assignmentNumber} visible: ${visible}`);

            if (visible) {
                return true;
            }

            if (Date.now() >= deadline) {
                return false;
            }

            await this.page.waitForTimeout(intervalMs);
        }
    }

    //opens the "سبب طلب سحب البوليصة" read-only modal on the matching row - leaves it open. Confirmed live,
    //2026-09-29 (twice, in separate test runs): the portal can mislabel this modal's own title bar as "سبب الرفض"
    //(the REJECTION-reason modal's title, reused by mistake) while its body correctly shows the withdrawal
    //reason text - a portal-side cosmetic bug, not a script issue. Match on either title instead of gating
    //strictly on the "correct" one, since the content (not the title) is what's actually reliable:
    async openWithdrawalReasonModal(assignmentNumber: string): Promise<void> {
        const row = this.rowByAssignmentNumber(assignmentNumber);
        await row.getByRole('button', { name: 'سبب طلب سحب البوليصة' }).click();

        const reasonModal = this.page.locator('.modal-content').filter({
            has: this.page.locator('.modal-title', { hasText: /سبب طلب سحب البوليصة|سبب الرفض/ }),
        });
        await expect(reasonModal).toBeVisible({ timeout: 10_000 });
    }

    async closeWithdrawalReasonModal(): Promise<void> {
        const reasonModal = this.page.locator('.modal-content').filter({
            has: this.page.locator('.modal-title', { hasText: /سبب طلب سحب البوليصة|سبب الرفض/ }),
        });
        await reasonModal.getByRole('button', { name: 'إغلاق' }).click();
        await expect(reasonModal).toBeHidden({ timeout: 10_000 });
    }

    //clicks "قبول" on the matching row - straight to a "تم إعادة البوليصة الرئيسية لوكيل الشحن" success alert,
    //no confirm dialog:
    async confirmWithdrawalRequest(assignmentNumber: string): Promise<void> {
        const row = this.rowByAssignmentNumber(assignmentNumber);
        await row.getByRole('button', { name: 'قبول' }).click();

        const successMessage = this.page.locator('.fasah-alert-body').filter({
            hasText: 'تم إعادة البوليصة الرئيسية لوكيل الشحن',
        });

        await expect(successMessage).toBeVisible({ timeout: 15_000 });
    }

    //clicks "رفض" on the matching row, which opens a "رفض طلب سحب البوليصة" confirm modal requiring a reason -
    //same test-attr ("سبب الرفض") and confirm-button pattern (data-method="رفض") as rejectManifest()'s modal,
    //so only one such modal is ever open at a time and the generic locators stay unambiguous:
    async rejectWithdrawalRequest(assignmentNumber: string, reason: string): Promise<void> {
        const row = this.rowByAssignmentNumber(assignmentNumber);
        await row.getByRole('button', { name: 'رفض' }).click();

        const reasonTextarea = this.page.locator('textarea[test-attr="سبب الرفض"]');
        await expect(reasonTextarea).toBeVisible({ timeout: 10_000 });
        await reasonTextarea.fill(reason);

        await this.page.locator('button[data-method="رفض"]').click();

        const successMessage = this.page.locator('.fasah-alert-body').filter({
            hasText: 'تم رفض طلب سحب البوليصة الرئيسية',
        });

        await expect(successMessage).toBeVisible({ timeout: 15_000 });
    }

    //on the broker's own account, a rejected withdrawal request's row shows "سبب الرفض" instead of
    //قبول/رفض, opening a read-only modal with the freight forwarder's reason in its body - same pattern as
    //getRejectionReason() on sentBillsSection:
    async getWithdrawalRejectionReason(assignmentNumber: string): Promise<string> {
        const row = this.rowByAssignmentNumber(assignmentNumber);
        await row.getByRole('button', { name: 'سبب الرفض' }).click();

        const reasonModal = this.page.locator('.modal-content').filter({
            has: this.page.locator('.modal-title', { hasText: 'سبب الرفض' }),
        });
        await expect(reasonModal).toBeVisible({ timeout: 10_000 });

        const reason = (await reasonModal.locator('.modal-body').textContent())?.trim() ?? '';

        await reasonModal.getByRole('button', { name: 'إغلاق' }).click();

        return reason;
    }

    async acceptWithdrawalRequest(
        assignmentNumber: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<void> {
        const appeared = await this.waitForWithdrawalRequestToAppear(assignmentNumber, options);

        if (!appeared) {
            throw new Error(`Withdrawal request ${assignmentNumber} did not appear in time`);
        }

        const row = this.rowByAssignmentNumber(assignmentNumber);
        await row.getByRole('button', { name: 'قبول' }).click();

        const successMessage = this.page.locator('.fasah-alert-body').filter({
            hasText: 'تم إعادة البوليصة الرئيسية لوكيل الشحن',
        });

        await expect(successMessage).toBeVisible({ timeout: 15_000 });
    }
}
