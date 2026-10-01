import { expect, type Locator, type Page } from '@playwright/test';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { ModalComponent } from '../../components/ModalComponent';

export type InternalDeliveryOrderData = {
    finalPort: string;
    receiverName: string;
    receiverId: string;
};

//"إذن التسليم الجوي الداخلي" - the freight forwarder raises a delivery order against one of its own internal
//(house) air waybills. The create form is the same shape as the broker's "إذن التسليم الجوي" (newDeliveryOrderPage)
//- final port, carrier, then a bill-number field - except it searches by the HAWB number (رقم بوليصة) instead
//of a master bill number.
export class InternalDeliveryOrderPage {
    private readonly page: Page;
    private readonly autocomplete: AutocompleteInput;
    private readonly modal: ModalComponent;

    private readonly menu: Locator;
    private readonly createButton: Locator;
    private readonly finalPortSelect: Locator;
    private readonly carrierInput: Locator;
    private readonly hawbNumberInput: Locator;
    private readonly receiverNameInput: Locator;
    private readonly receiverIdInput: Locator;
    private readonly importerNoInput: Locator;
    private readonly saveButton: Locator;
    private readonly submitButton: Locator;
    private readonly searchField: Locator;

    constructor(page: Page) {
        this.page = page;
        this.autocomplete = new AutocompleteInput(page);
        this.modal = new ModalComponent(page);

        //same `package` attr as the broker's delivery-order menu
        this.menu = this.page.locator('[package="SHIPPING_AGENT_SearchDelevryOrder"]');
        this.createButton = this.page
            .getByRole('button', { name: /إنشاء إذن تسليم جوي/ })
            .and(this.page.locator(':visible'))
            .last();

        this.finalPortSelect = this.page
            .locator('select[test-attr^="shipping_agent_final_port_name"]')
            .and(this.page.locator(':visible'))
            .last();
        this.carrierInput = this.page
            .locator('input[test-attr="shipping_agent_manifest_labels_carrierprefixno"]')
            .and(this.page.locator(':visible'))
            .last();
        //disabled until the carrier is selected (same as the broker form's bill-number field)
        this.hawbNumberInput = this.page
            .locator('input[test-attr="shipping_agent_manifest_labels_hawb_number"]')
            .and(this.page.locator(':visible'))
            .last();
        this.receiverNameInput = this.page
            .locator('input[test-attr="shipping_agent_manifest_labels_receivername"]')
            .and(this.page.locator(':visible'))
            .last();
        this.receiverIdInput = this.page
            .locator('input[test-attr="shipping_agent_manifest_labels_receiverid"]')
            .and(this.page.locator(':visible'))
            .last();
        //optional - same field/behaviour as the broker form's رقم المستورد. The suggestion picked determines the
        //real submitted importer: 'مؤسسة قريطة للتجارة' always resolves to "194133", an importer this account has
        //no match for, so it reliably gets the request rejected - typing '4' and picking the first suggestion
        //resolves to a real, matching importer instead.
        this.importerNoInput = this.page
            .locator('input[test-attr="shipping_agent_manifest_labels_importer_no"]')
            .and(this.page.locator(':visible'))
            .last();
        this.saveButton = this.page
            .locator('button[data-i18n="shipping_agent:Manifest_labels:Save"]')
            .and(this.page.locator(':visible'))
            .last();
        this.submitButton = this.page
            .locator('button[data-i18n="shipping_agent:Manifest_labels:submit"]')
            .and(this.page.locator(':visible'))
            .last();
        this.searchField = this.page
            .locator('input[test-attr="data-table-search-field"]')
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

    async openMenu(): Promise<void> {
        await this.waitForPageIdle();
        await this.modal.closeAllIfPresent();
        await expect(this.menu).toBeVisible({ timeout: 20_000 });
        await this.menu.click();
        await this.waitForPageIdle();
    }

    async clickCreate(): Promise<void> {
        await this.waitForPageIdle();
        await expect(this.createButton).toBeVisible({ timeout: 15_000 });
        await this.createButton.click({ timeout: 15_000 });
        await this.page.waitForTimeout(1_500);
    }

    //fills the create form for a given HAWB (sub bill). Mirrors newDeliveryOrderPage.fillDeliveryOrderForm but
    //keys off the HAWB number field. The date / manifest-ref part auto-populates after the HAWB is entered and
    //blurred, same as the broker form - a "تاريخ بوليصة" select then needs today's date picked.
    async fillForm(data: InternalDeliveryOrderData, hawbNumber: string, carrierCode = '65'): Promise<void> {
        await this.waitForPageIdle();

        await expect(this.finalPortSelect).toBeVisible({ timeout: 30_000 });
        await this.finalPortSelect.selectOption({ label: data.finalPort });

        //إختصار شركة النقل - type the carrier code (65) and take the first suggestion
        await this.autocomplete.selectFirst(this.carrierInput, carrierCode);

        await expect(this.hawbNumberInput).toBeEnabled({ timeout: 15_000 });
        await this.hawbNumberInput.fill(hawbNumber);
        await this.hawbNumberInput.press('Tab');
        await this.waitForPageIdle();
        await this.page.waitForTimeout(2_500);

        //"تاريخ بوليصة" - a datepicker input that did not auto-populate; type today's date (dd-mm-yyyy).
        const today = new Date();
        const ddmmyyyy = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(
            2,
            '0'
        )}-${today.getFullYear()}`;
        const hawbDateInput = this.page
            .locator('input.f-datepicker-input[test-attr="shipping_agent_manifest_labels_hawb_date"]')
            .and(this.page.locator(':visible'))
            .last();
        if (await hawbDateInput.count().catch(() => 0)) {
            await hawbDateInput.click().catch(() => {});
            await hawbDateInput.fill(ddmmyyyy).catch(() => {});
            await hawbDateInput.press('Escape').catch(() => {});
            await this.waitForPageIdle();
        }

        //dismiss any datepicker overlay (it intercepts the save button click otherwise)
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page
            .locator('.f-datepicker-overlay.show')
            .waitFor({ state: 'hidden', timeout: 3_000 })
            .catch(() => {});

        await this.receiverNameInput.fill(data.receiverName);
        await this.receiverIdInput.fill(data.receiverId);
        await this.page.keyboard.press('Escape').catch(() => {});
    }

    //optional - which suggestion resolves to a valid vs. invalid importer depends on the search text (see the
    //constructor comment above). Uses selectFirst() rather than select(): the dropdown's entries are cosmetic
    //display text with no real backing id, same quirk as the broker form's رقم المستورد field.
    async fillImporterNo(triggerText: string): Promise<void> {
        await this.autocomplete.selectFirst(this.importerNoInput, triggerText);
    }

    //saves the form as a draft and returns the new إذن تسليم داخلي reference number from the POST /api/air/v1/deo
    //response (same endpoint the broker form uses).
    async clickSave(): Promise<string> {
        await this.waitForPageIdle();
        //clear any datepicker overlay / lingering backdrop that would intercept the click
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page
            .locator('.f-datepicker-overlay.show, .modal-backdrop')
            .last()
            .waitFor({ state: 'hidden', timeout: 3_000 })
            .catch(() => {});

        await expect(this.saveButton).toBeVisible({ timeout: 15_000 });
        await this.saveButton.scrollIntoViewIfNeeded();

        const responsePromise = this.page.waitForResponse(
            (r) => r.url().includes('/api/air/v1/deo') && r.request().method() === 'POST',
            { timeout: 30_000 }
        );
        await this.saveButton.click({ force: true });
        const body = await (await responsePromise).json().catch(() => ({}));
        const ref: string = body?.result?.deoDocRefNo ?? '';

        await this.modal.closeAllIfPresent();
        console.log('Internal delivery order reference:', ref);
        return ref;
    }

    //the internal-DEO list live-filters on the generic "بحث" field, same as the broker list.
    async searchByReference(ref: string): Promise<void> {
        await this.waitForPageIdle();
        await this.modal.closeAllIfPresent();
        const search = this.page
            .locator('input[test-attr="data-table-search-field"]')
            .and(this.page.locator(':visible'))
            .last();
        await search.click();
        await search.fill('');
        await this.page.keyboard.type(ref, { delay: 100 });
        await this.waitForPageIdle();
        await this.page.waitForTimeout(1_000);
    }

    async openByReference(ref: string): Promise<void> {
        const row = this.page
            .locator('tbody tr')
            .filter({ hasText: ref })
            .and(this.page.locator(':visible'))
            .first();
        await expect(row).toBeVisible({ timeout: 15_000 });
        await row.click();
        await this.waitForPageIdle();
        await this.page.waitForTimeout(1_000);
    }

    async clickEdit(): Promise<void> {
        await this.waitForPageIdle();
        await this.modal.closeAllIfPresent();
        const editButton = this.page
            .getByRole('button', { name: 'تعديل', exact: true })
            .and(this.page.locator(':visible'))
            .last();
        await expect(editButton).toBeVisible({ timeout: 15_000 });
        await editButton.click({ timeout: 15_000 });
        await this.waitForPageIdle();
        await this.page.waitForTimeout(1_500);
    }

    async clickSubmit(): Promise<void> {
        await this.waitForPageIdle();
        await this.modal.closeAllIfPresent();
        await expect(this.submitButton).toBeVisible({ timeout: 15_000 });
        await this.submitButton.scrollIntoViewIfNeeded();

        //a force:true click skips Playwright's "is this element enabled" check - if the button is still disabled
        //when clicked (e.g. the edit form's validation state hasn't caught up yet right after "تعديل"), force
        //reports a successful click but the browser silently drops it (disabled elements don't dispatch click),
        //leaving the request stuck at مسودة with no error anywhere. Wait for it to actually be enabled first, then
        //click normally so a genuinely-stuck button surfaces as a clear timeout instead of a silent no-op:
        await expect(this.submitButton).toBeEnabled({ timeout: 15_000 });
        await this.submitButton.click({ timeout: 15_000 });

        await this.modal.confirmIfPresent('نعم').catch(() => {});
        await this.waitForPageIdle();
        await this.page.waitForTimeout(2_000);
    }

    private rowByReference(ref: string): Locator {
        return this.page.locator('tbody tr').filter({ hasText: ref }).and(this.page.locator(':visible')).first();
    }

    //reads the status for an internal delivery order row in the list, given its reference number. Tries the same
    //test-attr the broker form's status cell uses; falls back to the whole row's text if that attr isn't present
    //on this list (waitForStatus() below does a substring check so either shape works).
    async getStatus(ref: string): Promise<string> {
        const row = this.rowByReference(ref);
        const statusCell = row.locator('td[test-attr^="shipping_agent_deo_deo_status"]');
        if (await statusCell.count().catch(() => 0)) {
            return (await statusCell.first().textContent())?.trim() ?? '';
        }
        return (await row.textContent().catch(() => ''))?.trim() ?? '';
    }

    //re-searches for the internal delivery order and checks its status every intervalMs, until it matches
    //expectedStatus or timeoutMs elapses - same polling pattern as newDeliveryOrderPage.waitForDeliveryOrderStatus().
    async waitForStatus(
        ref: string,
        expectedStatus: string,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<boolean> {
        const intervalMs = options.intervalMs ?? 15_000;
        const timeoutMs = options.timeoutMs ?? 180_000;
        const deadline = Date.now() + timeoutMs;

        while (true) {
            await this.searchByReference(ref);

            const currentStatus = await this.getStatus(ref);
            console.log(`Internal delivery order ${ref} status: ${currentStatus}`);

            if (currentStatus.includes(expectedStatus)) {
                return true;
            }

            if (Date.now() >= deadline) {
                return false;
            }

            await this.page.waitForTimeout(intervalMs);
        }
    }

    //DIAGNOSTIC: dumps every form field / select / button, plus any tab names.
    async dumpCreateForm(): Promise<void> {
        await this.page.waitForTimeout(2_000);
        const dump = await this.page.evaluate(() => {
            const out: string[] = [];
            document.querySelectorAll('select, [role="combobox"], input, textarea, button, a.btn').forEach((el) => {
                const attrs = Array.from(el.attributes)
                    .map((a) => `${a.name}="${a.value}"`)
                    .join(' ');
                const label =
                    (el as HTMLElement).closest('.form-group')?.querySelector('label')?.textContent?.trim() ??
                    (el.textContent ?? '').trim().slice(0, 40);
                out.push(`<${el.tagName.toLowerCase()} ${attrs}>  [${label}]`);
            });
            return out.join('\n');
        });
        const tabs = await this.page.getByRole('tab').allTextContents().catch(() => []);
        console.log('=== INTERNAL DEO CREATE FORM ===\n' + dump + '\n--- tabs: ' + JSON.stringify(tabs) + '\n=== END ===');
    }
}
