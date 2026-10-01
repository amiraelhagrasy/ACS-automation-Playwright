import { expect, type Locator, type Page } from '@playwright/test';
import { ModalComponent } from '../../components/ModalComponent';

export type HouseAirwayBillData = {
    hawbNumber: string;
    totalWeight: string;
    totalQuantity: string;
    consigneeNameEn: string;
    consigneeNameAr: string;
    consigneeAddress: string;
    shipperNameEn: string;
    shipperNameAr: string;
    shipperAddress: string;
};

export type HouseBillItemData = {
    packageType: string;
    itemWeight: string;
    itemQuantity: string;
    itemDescAr: string;
    itemDescEn: string;
    itemMarks: string;
};

export type HouseBillWarehouseData = {
    warehouseCode: string;
    warehouseQuantity: string;
};

//"بوالص الشحن الجوية الداخلية" - the freight forwarder's internal (house) air waybill area. From a bill sitting
//in the "بوالص قيد الانتظار" tab, "إنشاء بوليصة شحن جوية داخلية" opens a 3-step wizard (header / items /
//warehouses) that reuses the same shipping_agent_bill_create_itemandwarehouse_* test-attrs and the same
//nextButtonText / submitButtonText wizard-nav buttons as the import manifest's house bill flow.
export class HouseAirwayBillPage {
    private readonly page: Page;
    private readonly houseBillsMenu: Locator;
    private readonly pendingBillsTab: Locator;
    private readonly splittingBillsTab: Locator;
    private readonly createHouseAirwayBillButton: Locator;
    private readonly modal: ModalComponent;

    constructor(page: Page) {
        this.page = page;
        this.modal = new ModalComponent(page);
        this.houseBillsMenu = page
            .getByRole('listitem', { name: 'بوالص الشحن الجوية الداخلية' })
            .or(page.getByText('بوالص الشحن الجوية الداخلية', { exact: true }))
            .first();
        this.pendingBillsTab = page.getByRole('tab', { name: 'بوالص قيد الانتظار' });
        this.splittingBillsTab = page.getByRole('tab', { name: 'بوالص قيد التقسيم' });
        this.createHouseAirwayBillButton = page.getByRole('button', {
            name: 'إنشاء بوليصة شحن جوية داخلية',
            exact: true,
        });
    }

    async waitForPageIdle(): Promise<void> {
        await this.page
            .waitForFunction(() => !document.documentElement.classList.contains('nprogress-busy'), undefined, {
                timeout: 15_000,
            })
            .catch(() => {});
    }

    async openHouseBillsList(): Promise<void> {
        await this.waitForPageIdle();
        await expect(this.houseBillsMenu).toBeVisible({ timeout: 20_000 });
        await this.houseBillsMenu.click();
    }

    //confirmed live, 2026-10-01: this click wasn't verified to actually take effect - caught via screenshot still
    //sitting on "البوالص المكتملة" (a leftover tab selection from a PRECEDING step, e.g. verifyBillInCompleted())
    //with aria-selected still on that tab, not this one. Not the same class of issue as the already-documented
    //Transit Manifest create-form flakiness (investigated separately, confirmed not fixable by waiting longer) -
    //this is a plain unverified-click bug, fixed the same way as the other tab-switch fixes elsewhere in this
    //codebase: retry until aria-selected actually confirms the switch:
    async openPendingBillsTab(): Promise<void> {
        await this.waitForPageIdle();
        await expect(this.pendingBillsTab).toBeVisible({ timeout: 15_000 });

        for (let attempt = 1; attempt <= 3; attempt++) {
            await this.pendingBillsTab.click();
            const selected = await this.pendingBillsTab
                .evaluate((el) => el.getAttribute('aria-selected') === 'true')
                .catch(() => false);
            if (selected) {
                return;
            }
            await this.page.waitForTimeout(500);
        }
    }

    //"بوالص قيد التقسيم" - where a bill moves once at least one house air waybill has been started against it
    //(it leaves "بوالص قيد الانتظار"). Used to add a further house bill to the same master bill. Same
    //unverified-click fix as openPendingBillsTab() above:
    async openSplittingBillsTab(): Promise<void> {
        await this.waitForPageIdle();
        await expect(this.splittingBillsTab).toBeVisible({ timeout: 15_000 });

        for (let attempt = 1; attempt <= 3; attempt++) {
            await this.splittingBillsTab.click();
            const selected = await this.splittingBillsTab
                .evaluate((el) => el.getAttribute('aria-selected') === 'true')
                .catch(() => false);
            if (selected) {
                return;
            }
            await this.page.waitForTimeout(500);
        }
    }

    //the list table live-filters on the generic "بحث" search field, same as every other list page here.
    //Opens the row whose bill-number cell matches billNo by clicking it. Works on whichever tab is active.
    async openBillByNumber(billNo: string): Promise<void> {
        await this.waitForPageIdle();

        //confirmed live, 2026-09-30: the previous ".tab-pane.active, [role=\"tabpanel\"]:visible" OR-selector can
        //match a different, unrelated visible [role="tabpanel"] elsewhere on the page (or one still mid-transition
        //during a tab switch) instead of this tab's own pane - the click intercepted on the pane's own subtree,
        //then the field reported "not visible" shortly after. Same bug/fix already applied to
        //verifyBillInCompleted() above - scope strictly to ".tab-pane.active":
        const activePanel = this.page.locator('.tab-pane.active').last();
        const searchField = activePanel.getByPlaceholder('بحث').and(this.page.locator(':visible')).first();

        if (await searchField.count()) {
            //confirmed live, 2026-09-30: even with the correct element resolved (confirmed via screenshot showing
            //the right tab active with the field genuinely visible and populated), the click can still
            //intermittently fail right after a tab switch - a transient settle/render timing issue, not a wrong-
            //element match this time. Retry instead of failing on the first attempt:
            let clicked = false;
            for (let attempt = 1; attempt <= 3 && !clicked; attempt++) {
                clicked = await searchField
                    .click({ timeout: 15_000 })
                    .then(() => true)
                    .catch(() => false);
            }
            if (!clicked) {
                await searchField.click();
            }
            await searchField.fill('');
            await this.page.keyboard.type(billNo, { delay: 100 });
            await this.waitForPageIdle();
        }

        const row = activePanel.locator('tbody tr').filter({ hasText: billNo }).first();
        await expect(row).toBeVisible({ timeout: 15_000 });
        await row.click();
    }

    async clickCreateHouseAirwayBill(): Promise<void> {
        await this.waitForPageIdle();
        await expect(this.createHouseAirwayBillButton).toBeVisible({ timeout: 15_000 });

        //confirmed live, 2026-10-01: the click can report success with no error, yet the wizard's #bill-create-
        //form never actually opens - the button stays sitting there untouched on screen (confirmed via
        //screenshot). Retry the click itself (checking whether the form shows up) instead of assuming a single
        //click + fixed wait is enough, same pattern already proven elsewhere in this file:
        for (let attempt = 1; attempt <= 3; attempt++) {
            await this.createHouseAirwayBillButton.click({ timeout: 15_000 });
            //the wizard renders inside a modal that animates in - give its fields a beat to bind before checking,
            //same fixed-wait idiom used after other SPA navigations in this codebase.
            await this.page.waitForTimeout(1_500);

            const formAppeared = await this.page
                .locator('#bill-create-form')
                .waitFor({ state: 'visible', timeout: 8_000 })
                .then(() => true)
                .catch(() => false);

            if (formAppeared) {
                return;
            }
        }
    }

    //navigates to the bill (on the given tab) and opens a fresh house bill wizard, retrying when the portal
    //blocks it with "لا يمكنك بدء عملية التقسيم، اذن التسليم الجوي المتعلق بهذا الطلب غير مقبول للآن." - the
    //referral's delivery order is accepted asynchronously and the assignment row can read "مقبول" before the
    //DEO itself is. (This is the "نستني طلب التسليم يتقبل" wait.)
    async openBillAndStartHouseBillWizard(
        billNo: string,
        tab: 'pending' | 'splitting',
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<void> {
        const intervalMs = options.intervalMs ?? 15_000;
        const timeoutMs = options.timeoutMs ?? 240_000;
        const deadline = Date.now() + timeoutMs;

        while (true) {
            await this.openHouseBillsList();
            if (tab === 'pending') {
                await this.openPendingBillsTab();
            } else {
                await this.openSplittingBillsTab();
            }
            await this.openBillByNumber(billNo);
            await this.clickCreateHouseAirwayBill();

            const blocked = await this.page
                .locator('.modal-content, .fasah-alert-modal')
                .filter({ hasText: 'غير مقبول للآن' })
                .first()
                .isVisible()
                .catch(() => false);

            if (!blocked) {
                return;
            }

            console.log(`البوليصة ${billNo}: اذن التسليم لسه غير مقبول - إعادة المحاولة بعد ${intervalMs / 1000}ث`);
            await this.modal.closeAllIfPresent();
            await this.page.keyboard.press('Escape').catch(() => {});
            await this.waitForPageIdle();

            if (Date.now() >= deadline) {
                throw new Error(
                    `Delivery order for bill ${billNo} was not accepted in time - cannot start splitting`
                );
            }
            await this.page.waitForTimeout(intervalMs);
        }
    }

    //a just-dismissed success alert (from قبول طلب التعيين / تقديم مع الموافقة التلقائية upstream) can leave a
    //.modal-backdrop behind that silently intercepts clicks on the wizard's nav buttons - clear it first.
    private async dismissLingeringBackdrop(): Promise<void> {
        await this.page
            .locator('.modal-backdrop')
            .last()
            .waitFor({ state: 'hidden', timeout: 5_000 })
            .catch(() => {});
    }

    //step 1 of the wizard - #bill-create-form
    async fillHouseBillHeader(data: HouseAirwayBillData): Promise<void> {
        const form = this.page.locator('#bill-create-form');
        await expect(form).toBeVisible({ timeout: 15_000 });

        await form
            .locator('input[test-attr^="shipping_agent_freight_forwarder_hawb_number"]')
            .fill(data.hawbNumber);
        await form
            .locator('input[test-attr^="shipping_agent_freight_forwarder_bill_create_total_weight"]')
            .fill(data.totalWeight);
        await form
            .locator('input[test-attr^="shipping_agent_freight_forwarder_bill_create_total_quantity"]')
            .fill(data.totalQuantity);

        await form.locator('input[name="shipping_agent:freight_forwarder.consignee_name"]').fill(data.consigneeNameEn);
        await form
            .locator('input[name="shipping_agent:freight_forwarder.consignee_name_ar"]')
            .fill(data.consigneeNameAr);
        await form
            .locator('input[name="shipping_agent:freight_forwarder.consignee_address"]')
            .fill(data.consigneeAddress);

        await form.locator('input[name="shipping_agent:freight_forwarder.shipper_name"]').fill(data.shipperNameEn);
        await form.locator('input[name="shipping_agent:freight_forwarder.shipper_name_ar"]').fill(data.shipperNameAr);
        await form.locator('input[name="shipping_agent:freight_forwarder.shipper_address"]').fill(data.shipperAddress);
    }

    //step 2 of the wizard - #bill-items-create-form
    async fillHouseBillItem(data: HouseBillItemData): Promise<void> {
        const form = this.page.locator('#bill-items-create-form');
        await expect(form).toBeVisible({ timeout: 15_000 });

        await form
            .locator('select[test-attr^="shipping_agent_bill_create_itemandwarehouse_package_type"]')
            .selectOption(data.packageType);
        await form
            .locator('input[test-attr^="shipping_agent_bill_create_itemandwarehouse_weight"]')
            .fill(data.itemWeight);
        await form
            .locator('input[test-attr^="shipping_agent_bill_create_itemandwarehouse_quantity"]')
            .fill(data.itemQuantity);
        await form
            .locator('textarea[test-attr^="shipping_agent_bill_create_itemandwarehouse_desc_ar"]')
            .fill(data.itemDescAr);
        await form
            .locator('textarea[test-attr^="shipping_agent_bill_create_itemandwarehouse_desc_en"]')
            .fill(data.itemDescEn);
        await form
            .locator('textarea[test-attr^="shipping_agent_bill_create_itemandwarehouse_marks"]')
            .fill(data.itemMarks);
    }

    //step 3 of the wizard - #bill-warehouses-create-form
    async fillHouseBillWarehouse(data: HouseBillWarehouseData): Promise<void> {
        const form = this.page.locator('#bill-warehouses-create-form');
        await expect(form).toBeVisible({ timeout: 15_000 });

        await form
            .locator('input[test-attr^="shipping_agent_bill_create_itemandwarehouse_warehouse_code"]')
            .fill(data.warehouseCode);
        await form
            .locator('input[test-attr^="shipping_agent_bill_create_itemandwarehouse_warehouse_quantity"]')
            .fill(data.warehouseQuantity);
    }

    //clicks the item/warehouse step's own "إضافة" button (commits the row into the grid below). This button is a
    //sibling of #bill-items-create-form / #bill-warehouses-create-form (both inside the step's <form>), NOT a
    //descendant of them - so it's scoped to the active wizard step instead. Only the active step's is visible.
    async clickAddRow(): Promise<void> {
        await this.waitForPageIdle();
        const addButton = this.page
            .locator('.tab-pane.wizard-step.active')
            .getByRole('button', { name: 'إضافة', exact: true })
            .and(this.page.locator(':visible'))
            .last();
        await expect(addButton).toBeVisible({ timeout: 15_000 });
        await addButton.click({ force: true, timeout: 15_000 });
        await this.page.waitForTimeout(800);
    }

    //wizard nav: "حفظ واستمرار" (the shared .wizard-action-buttons bar - only one is on screen at a time).
    //confirmed live, 2026-09-30: tried scoping this to .tab-pane.wizard-step.active (matching clickAddRow()'s own
    //pattern) on a theory that an unscoped query could click the wrong button - that broke it outright ("element
    //not found"), since this button is genuinely NOT inside .tab-pane.wizard-step.active at all: it lives in a
    //separate, shared action bar outside the step panes (confirmed via a live accessibility snapshot showing
    //"السابق"/"حفظ واستمرار" present on the page but not matched by the scoped locator). Reverted to the
    //original unscoped page query - the real bug behind the "next form never appears" failure was elsewhere, not
    //here:
    async clickSaveAndContinue(): Promise<void> {
        await this.waitForPageIdle();
        await this.dismissLingeringBackdrop();
        const button = this.page
            .locator('button[data-i18n="nextButtonText"]')
            .and(this.page.locator(':visible'))
            .last();
        await expect(button).toBeVisible({ timeout: 15_000 });
        await button.click({ force: true, timeout: 15_000 });
        await this.page.waitForTimeout(1_500);
    }

    //on the bill's house-bill details page (not the wizard) - "تقديم الطلب" submits all the house bills that have
    //been added to this master bill. It's an <a id="submitHouseBills" class="btn"> (link role), not a button.
    //Clicking it opens a "هل انت متأكد من تقديم طلب البوالص الفرعية؟" confirm modal that needs "نعم".
    //submits the house bills and returns the "رقم التعيين" from the "تم ارسال طلب تعيين البوالص الفرعية بنجاح،
    //رقم التعيين: <N>" success alert.
    async clickSubmitRequest(): Promise<string> {
        const successMessage = this.page
            .locator('.fasah-alert-body')
            .filter({ hasText: 'تم ارسال طلب تعيين البوالص الفرعية' });
        //portal-side "فشل في ارسال البوالص الفرعية للجمارك" (customs integration hiccup) is intermittent - retry.
        const failureMessage = this.page.locator('.fasah-alert, .modal-body').filter({ hasText: 'فشل في ارسال' });

        for (let attempt = 1; attempt <= 3; attempt++) {
            await this.waitForPageIdle();
            await this.dismissLingeringBackdrop();

            //#submitHouseBills sits at the very bottom of the details page, below the fold - scroll into view then
            //click (force would click blind at its off-screen coordinates and miss).
            const button = this.page.locator('#submitHouseBills').and(this.page.locator(':visible')).last();
            await expect(button).toBeVisible({ timeout: 15_000 });
            await button.scrollIntoViewIfNeeded();
            await button.click({ timeout: 15_000 });

            //confirm "هل انت متأكد من تقديم طلب البوالص الفرعية؟"
            const confirmYes = this.page
                .locator('.fasah-confirm-modal button[data-method="نعم"]')
                .and(this.page.locator(':visible'))
                .last();
            await expect(confirmYes).toBeVisible({ timeout: 15_000 });
            await confirmYes.click({ force: true, timeout: 15_000 });
            await this.page.waitForTimeout(1_500);
            if (await confirmYes.isVisible().catch(() => false)) {
                await confirmYes.click({ force: true, timeout: 10_000 }).catch(() => {});
            }

            const outcome = await Promise.race([
                successMessage.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'ok' as const).catch(() => 'timeout' as const),
                failureMessage.waitFor({ state: 'visible', timeout: 30_000 }).then(() => 'fail' as const).catch(() => 'timeout' as const),
            ]);

            if (outcome === 'ok') {
                const assignmentNumber = ((await successMessage.textContent()) ?? '').match(/\d+/)?.[0] ?? '';
                await this.modal.closeAllIfPresent();
                return assignmentNumber;
            }

            console.log(`تقديم البوالص الفرعية فشل (محاولة ${attempt}) - ${outcome} - إعادة المحاولة`);
            await this.modal.closeAllIfPresent();
            await this.page.waitForTimeout(10_000);
        }

        throw new Error('Submitting the house bills to customs kept failing ("فشل في ارسال البوالص الفرعية للجمارك")');
    }

    //"البوالص المكتملة" tab of بوالص الشحن الجوية الداخلية - searches by the submitted request's رقم التعيين
    //and asserts the matching bill row (identified by its bill-number cell) shows up. The bill moves here
    //asynchronously after "تقديم الطلب", so this re-searches until the row appears.
    async verifyBillInCompleted(
        requestNumber: string,
        billNo: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<void> {
        const intervalMs = options.intervalMs ?? 10_000;
        const timeoutMs = options.timeoutMs ?? 180_000;
        const deadline = Date.now() + timeoutMs;

        await this.openHouseBillsList();
        await this.waitForPageIdle();

        const tab = this.page.getByRole('tab', { name: 'البوالص المكتملة' });
        await expect(tab).toBeVisible({ timeout: 15_000 });
        await tab.click();
        await this.waitForPageIdle();

        //confirmed live, 2026-09-30: the previous ".tab-pane.active, [role=\"tabpanel\"]:visible" selector's OR
        //alternative could match a DIFFERENT, unrelated visible [role="tabpanel"] elsewhere on the page, and
        //.last() then grabbed that one instead of this tab's own pane (the screenshot showed the correct tab
        //active with a visible search box, yet the locator reported the field "not visible" - a wrong-element
        //match, not a rendering delay). Scope strictly to the Bootstrap ".tab-pane.active" marker this app
        //already uses consistently elsewhere instead of the ambiguous OR:
        const activePanel = this.page.locator('.tab-pane.active').last();
        const searchField = activePanel.getByPlaceholder('بحث').and(this.page.locator(':visible')).first();
        const row = activePanel.locator('tbody tr').filter({ hasText: billNo }).first();

        while (true) {
            if (await searchField.count()) {
                //confirmed live, 2026-10-01: same transient "not stable"/"not visible" click instability already
                //seen and fixed in openBillByNumber() above - retry instead of failing on the first attempt:
                let clicked = false;
                for (let attempt = 1; attempt <= 3 && !clicked; attempt++) {
                    clicked = await searchField
                        .click({ timeout: 15_000 })
                        .then(() => true)
                        .catch(() => false);
                }
                if (!clicked) {
                    await searchField.click();
                }
                await searchField.fill('');
                await this.page.keyboard.type(requestNumber, { delay: 100 });
                await this.waitForPageIdle();
            }

            const visible = await row
                .waitFor({ state: 'visible', timeout: 5_000 })
                .then(() => true)
                .catch(() => false);

            console.log(`البحث برقم الطلب ${requestNumber} - البوليصة ${billNo} في البوالص المكتملة: ${visible}`);

            if (visible) {
                return;
            }

            if (Date.now() >= deadline) {
                throw new Error(
                    `Bill ${billNo} (request ${requestNumber}) did not appear in البوالص المكتملة in time`
                );
            }

            await this.page.waitForTimeout(intervalMs);
        }
    }

    //wizard nav: the final "حفظ" (done). Same shared action-bar button as clickSaveAndContinue() above - see that
    //method's comment for why this stays unscoped rather than nested under .tab-pane.wizard-step.active:
    async clickSave(): Promise<void> {
        await this.waitForPageIdle();
        await this.dismissLingeringBackdrop();
        const button = this.page
            .locator('button[data-i18n="submitButtonText"]')
            .and(this.page.locator(':visible'))
            .last();
        await expect(button).toBeVisible({ timeout: 15_000 });
        await button.click({ force: true, timeout: 15_000 });
        await this.page.waitForTimeout(1_500);
    }
}
