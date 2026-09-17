import { expect } from '@playwright/test';
import { ViewImportManifestPage } from './viewImportManByRefPage';

//page object for the ECL (خطاب تعديل إلكتروني) flow on an accepted manifest:
//  1) create the ECL and edit its header
//  2) view the opened ECL letter (read its number)
//  3) save/submit it
//  4) poll its status until it becomes مقبول
//reuses all shared search/status/view methods from ViewImportManifestPage:
export class CreateNewEclPage extends ViewImportManifestPage {

    // ---- 1) create the ECL ----

    //clicks "إنشاء خطاب تعديل إلكتروني" on the manifest's header screen:
    async clickCreateElectronicAmendmentLetterButton(): Promise<void> {
        const button = this.page.getByRole('button', { name: 'إنشاء خطاب تعديل إلكتروني' });

        await this.waitForPageIdle();
        await button.click();
    }

    //selects "نوع خطاب التعديل الإلكتروني" (ECL type). value: '1' = تعديل جميع البيانات, '2' = تعديل معلومات المالك, '3' = تعديل معلومات المستودع.
    //prefix-matched and scoped to the last match: on a revisit (e.g. creating a second ECL on the same manifest in
    //the same session) the component can get re-numbered, e.g. test-attr="...ecl_type_1" instead of the plain
    //"...ecl_type" - same pattern as #reference-view/#reference-view1:
    async selectEclType(value: string): Promise<void> {
        const eclTypeSelect = this.page.locator('select[test-attr^="shipping_agent_air_manifest_ecl_type"]').last();

        await this.waitForPageIdle();
        await eclTypeSelect.selectOption(value);
    }

    //clicks "اختر نوع خطاب التعديل اللإلكتروني" to confirm the selected ECL type:
    async clickChooseEclTypeButton(): Promise<void> {
        const button = this.page.getByRole('button', { name: 'اختر نوع خطاب التعديل اللإلكتروني' });

        await this.waitForPageIdle();
        await button.click();
    }

    // ---- 1b) owner-info ECL type (نوع "تعديل معلومات المالك") ----
    //this type skips the header/master-bills/house-bill wizard entirely: choosing it lands directly on a page
    //listing the manifest's master bill(s), each with its own "تعديل" button to edit that bill's owner info:

    //clicks "تعديل" on the master bill row shown by the owner-info ECL type screen:
    async clickEditOwnerInfoButton(): Promise<void> {
        const button = this.page.getByRole('button', { name: 'تعديل' }).last();

        await this.waitForPageIdle();
        await button.click();
    }

    //fills "اسم المالك بالإنجليزي" (owner name in English) on the owner-info edit form:
    async fillOwnerNameEnglish(ownerNameEn: string): Promise<void> {
        const input = this.page
            .locator('input[test-attr^="shipping_agent_master_bill_create_owner_name_en"]')
            .last();

        await expect(input).toBeVisible({ timeout: 10000 });
        await input.fill(ownerNameEn);
    }

    //fills "اسم المالك بالعربي" (owner name in Arabic) on the owner-info edit form. Field only accepts non-Latin
    //characters (same pattern restriction seen on the master-bill-details form), so it must be a real Arabic value:
    async fillOwnerNameArabic(ownerNameAr: string): Promise<void> {
        const input = this.page
            .locator('input[test-attr^="shipping_agent_master_bill_create_owner_name_ar"]')
            .last();

        await expect(input).toBeVisible({ timeout: 10000 });
        await input.fill(ownerNameAr);
    }

    //clicks the plain "حفظ" button (distinct from "حفظ واستمرار"/"حفظ وتقديم") to save the owner-info edit:
    async clickSaveOnlyButton(): Promise<void> {
        const button = this.page.getByRole('button', { name: 'حفظ', exact: true });

        await this.waitForPageIdle();
        await button.click();
    }

    //clicks "تقديم الطلب" to actually submit the owner-info ECL (saving alone only keeps it as مسودة). Unlike the
    //"تقديم الطلب" button on the master-bill wizard's final step (which has data-i18n="submitButtonText", matched
    //by clickSaveButton()), this one has no data-i18n attribute at all, so it needs its own exact-text locator:
    async clickSubmitRequestButton(): Promise<void> {
        const button = this.page.getByRole('button', { name: 'تقديم الطلب', exact: true });

        await this.waitForPageIdle();
        await button.click();
    }

    // ---- 1c) warehouse-info ECL type (نوع "تعديل معلومات المستودع") ----
    //this type also skips the wizard, landing on a page listing the manifest's house bill(s), each with its own
    //"تعديل المستودعات" button. That opens a modal listing that bill's warehouse(s), each with its own "تعديل"
    //button opening a small form with the old (disabled) and new warehouse code fields. "تقديم الطلب" to submit
    //lives on the outer page, not inside either modal:

    //clicks "تعديل المستودعات" on the house bill row shown by the warehouse-info ECL type screen:
    async clickEditWarehousesButton(): Promise<void> {
        const button = this.page.getByRole('button', { name: 'تعديل المستودعات', exact: true });

        await this.waitForPageIdle();
        await button.click();
    }

    //clicks "تعديل" on the warehouse row within the "تعديل المستودعات" modal:
    async clickEditWarehouseRowButton(): Promise<void> {
        const modal = this.page.locator('.modal.show').last();
        //.first() rather than assuming a single row: once a row is edited its "تعديل" button disappears/changes
        //(matching the "تحديث" status pattern seen elsewhere), so calling this again for a manifest with multiple
        //warehouses correctly picks up the next still-unedited row each time:
        const button = modal.getByRole('button', { name: 'تعديل', exact: true }).first();

        await this.waitForPageIdle();
        await button.click();
    }

    //fills the new warehouse code on the warehouse row's edit form (the old code field is disabled/read-only):
    async fillNewWarehouseCode(warehouseCode: string): Promise<void> {
        const input = this.page.locator('input[test-attr="shipping_agent_warehouse_ecl_new_warehouse_code"]').last();

        await expect(input).toBeVisible({ timeout: 10000 });
        await input.fill(warehouseCode);
    }

    // ---- 2) view the opened ECL letter ----

    //opens the (draft) ECL letter row from the ECL History tab's table:
    async openEclLetterRow(): Promise<void> {
        const row = this.page.locator('tbody tr').filter({
            has: this.page.locator('td[test-attr="shipping_agent_ecl_ecl_seq_no"]'),
        }).first();

        await this.waitForPageIdle();
        await row.click();
    }

    //reads the ECL number ("رقم خطاب التعديل الإلكتروني") from the first row in the ECL History tab's table:
    async getEclSeqNo(): Promise<string> {
        const cell = this.page.locator('td[test-attr="shipping_agent_ecl_ecl_seq_no"]').first();

        return (await cell.textContent())?.trim() ?? '';
    }

    //reads the ECL number ("رقم خطاب التعديل الإلكتروني") from the reference view shown once the ECL letter itself is open.
    //the opened ECL letter reuses the same reference-view component as the underlying manifest, so the DOM ends up with
    //two elements sharing the base id: "reference-view" (the underlying manifest, left in the DOM but hidden) and
    //"reference-view1" (the ECL letter itself, the one actually visible) - scoped to the field's own wrapper div since
    //the panel has many identically-classed value spans (reference no., status, etc.):
    async getOpenedEclNumber(): Promise<string> {
        const field = this.page
            .locator('#reference-view1 div')
            .filter({ hasText: 'رقم خطاب التعديل الإلكتروني' })
            .filter({ has: this.page.locator('span.lable-desc') })
            .last();

        const value = field.locator('span.lable-desc').last();

        return (await value.textContent())?.trim() ?? '';
    }

    // ---- 3) save / submit the ECL ----

    //clicks "حفظ وتقديم" to save and submit the ECL:
    async clickSaveAndSubmitEcl(): Promise<void> {
        const button = this.page.locator('#submitDraftManifest');

        await this.waitForPageIdle();
        await button.click();
    }

    // ---- 4) poll ECL status until مقبول ----

    //reads the "الحالة" (Status) cell for an ECL row in the ECL History tab's table, given its ECL number.
    //no search needed: the ECL History tab only ever lists ECLs for this one manifest, so the row is already
    //there without filtering:
    async getEclStatus(eclNumber: string): Promise<string> {
        const row = this.page.locator('tbody tr').filter({
            has: this.page.locator(
                'td[test-attr="shipping_agent_ecl_ecl_seq_no"]',
                { hasText: eclNumber }
            ),
        });

        const statusCell = row.locator('td[test-attr^="shipping_agent_air_manifest_status"]');

        return (await statusCell.textContent())?.trim() ?? '';
    }

    //calls refreshView() (which should re-navigate back to the ECL History tab showing this ECL's row) and checks its
    //status every intervalMs, until it matches expectedStatus or timeoutMs elapses. Returns true if the status was
    //reached in time, false otherwise:
    async waitForEclStatus(
        eclNumber: string,
        expectedStatus: string,
        refreshView: () => Promise<void>,
        options: { intervalMs?: number; timeoutMs?: number } = {}
    ): Promise<boolean> {
        const intervalMs = options.intervalMs ?? 60_000;
        const timeoutMs = options.timeoutMs ?? 120_000;
        const deadline = Date.now() + timeoutMs;

        while (true) {
            await refreshView();

            const currentStatus = await this.getEclStatus(eclNumber);
            console.log(`ECL ${eclNumber} status: ${currentStatus}`);

            if (currentStatus === expectedStatus) {
                return true;
            }

            if (Date.now() >= deadline) {
                return false;
            }

            await this.page.waitForTimeout(intervalMs);
        }
    }
}
