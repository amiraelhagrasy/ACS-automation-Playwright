import type { Page } from '@playwright/test';
import { ViewImportManifestPage } from '../Import Manifest/viewImportManByRefPage';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { ModalComponent } from '../../components/ModalComponent';

export type ExportBillData = {
    transportCompany: string;
    billNo: string;
    billDate: string;
    totalWeight: string;
    totalQuantity: string;
    destinationCountry: string;
    destinationPort: string;
    ownerNameAr: string;
    ownerNameEn: string;
};

export type ExportBillItemData = {
    packageType: string;
    itemWeight: string;
    itemQuantity: string;
    itemDescAr: string;
    itemDescEn: string;
    itemMarks: string;
};

//the manifest list/search/edit flow is identical to the import manifest (same test-attrs), so this extends
//ViewImportManifestPage to reuse it - only the export-specific "add bill" sub-wizard is implemented here, using its
//own AutocompleteInput instance rather than reaching into the parent's private one:
export class ViewExportManifestPage extends ViewImportManifestPage {
    private readonly exportAutocomplete: AutocompleteInput;
    private readonly exportModal: ModalComponent;

    constructor(page: Page) {
        super(page);
        this.exportAutocomplete = new AutocompleteInput(page);
        this.exportModal = new ModalComponent(page);
    }

    async fillExportBillHeaderForm(data: ExportBillData) {
        //scoped to :visible on every field here - adding a second bill leaves the first one's now-closed dialog
        //still in the DOM (hidden, not removed), so an unscoped .last() risks resolving to a stale leftover field:
        const transportCompanyInput = this.page
            .locator('input[test-attr^="shipping_agent_air_manifest_create_transport_company_no"]')
            .and(this.page.locator(':visible'))
            .last();
        await this.exportAutocomplete.select(transportCompanyInput, data.transportCompany);

        const billNoInput = this.page
            .locator('input[test-attr^="shipping_agent_bill_create_bill_no"]')
            .and(this.page.locator(':visible'))
            .last();
        await billNoInput.fill(data.billNo);

        const billDateInput = this.page
            .locator('input.f-datepicker-input[test-attr^="shipping_agent_bill_create_bill_date"]')
            .and(this.page.locator(':visible'))
            .last();
        await billDateInput.click();
        await billDateInput.fill(data.billDate);
        await billDateInput.press('Tab');

        const totalWeightInput = this.page
            .locator('input[test-attr^="shipping_agent_bill_create_total_weight"]')
            .and(this.page.locator(':visible'))
            .last();
        await totalWeightInput.fill(data.totalWeight);

        const totalQuantityInput = this.page
            .locator('input[test-attr^="shipping_agent_bill_create_total_quantity"]')
            .and(this.page.locator(':visible'))
            .last();
        await totalQuantityInput.fill(data.totalQuantity);

        const destinationCountryInput = this.page
            .locator('input[test-attr^="shipping_agent_master_bill_create_destination_country"]')
            .and(this.page.locator(':visible'))
            .last();
        await this.exportAutocomplete.select(destinationCountryInput, data.destinationCountry);

        const destinationPortInput = this.page
            .locator('input[test-attr^="shipping_agent_master_bill_create_destination_port_no"]')
            .and(this.page.locator(':visible'))
            .last();
        await this.exportAutocomplete.select(destinationPortInput, data.destinationPort);

        const ownerNameArInput = this.page
            .locator('input[test-attr^="shipping_agent_master_bill_create_owner_name_ar"]')
            .and(this.page.locator(':visible'))
            .last();
        await ownerNameArInput.fill(data.ownerNameAr);

        const ownerNameEnInput = this.page
            .locator('input[test-attr^="shipping_agent_master_bill_create_owner_name_en"]')
            .and(this.page.locator(':visible'))
            .last();
        await ownerNameEnInput.fill(data.ownerNameEn);
    }

    //fills only "اسم المالك بالعربي" - used when editing an existing bill via ECL, where some of the other header
    //fields (e.g. bill number) may be disabled, unlike this one:
    async fillExportBillOwnerNameArabic(ownerNameAr: string) {
        const ownerNameArInput = this.page
            .locator('input[test-attr^="shipping_agent_master_bill_create_owner_name_ar"]')
            .and(this.page.locator(':visible'))
            .last();
        await ownerNameArInput.fill(ownerNameAr);
    }

    async fillExportBillItemForm(data: ExportBillItemData) {
        const packageTypeSelect = this.page
            .locator('select[test-attr^="shipping_agent_bill_create_itemandwarehouse_package_type"]')
            .and(this.page.locator(':visible'))
            .last();
        await packageTypeSelect.selectOption(data.packageType);

        const itemWeightInput = this.page
            .locator('input[test-attr^="shipping_agent_bill_create_itemandwarehouse_weight"]')
            .and(this.page.locator(':visible'))
            .last();
        await itemWeightInput.fill(data.itemWeight);

        const itemQuantityInput = this.page
            .locator('input[test-attr^="shipping_agent_bill_create_itemandwarehouse_quantity"]')
            .and(this.page.locator(':visible'))
            .last();
        await itemQuantityInput.fill(data.itemQuantity);

        const itemDescArInput = this.page
            .locator('textarea[test-attr^="shipping_agent_bill_create_itemandwarehouse_desc_ar"]')
            .and(this.page.locator(':visible'))
            .last();
        await itemDescArInput.fill(data.itemDescAr);

        const itemDescEnInput = this.page
            .locator('textarea[test-attr^="shipping_agent_bill_create_itemandwarehouse_desc_en"]')
            .and(this.page.locator(':visible'))
            .last();
        await itemDescEnInput.fill(data.itemDescEn);

        const itemMarksInput = this.page
            .locator('textarea[test-attr^="shipping_agent_bill_create_itemandwarehouse_marks"]')
            .and(this.page.locator(':visible'))
            .last();
        await itemMarksInput.fill(data.itemMarks);
    }

    //adds the filled item to the items grid within the bill-items sub-step (distinct from clickAddButton(),
    //inherited from ViewImportManifestPage, which opens the top-level "add new bill" form):
    async clickAddItemButton() {
        const addItemButton = this.page
            .getByRole('button', { name: 'إضافة' })
            .and(this.page.locator(':visible'))
            .last();

        await this.waitForPageIdle();
        await addItemButton.click();
    }

    //adds one export bill (header step + one item), then saves the bill sub-wizard via its own "حفظ" done button -
    //this returns to the manifest's bills list, it does not submit the manifest itself:
    async addExportBill(billData: ExportBillData, billItemData: ExportBillItemData) {
        await this.clickAddButton();
        await this.fillExportBillHeaderForm(billData);
        await this.clickSaveAndContinueButton();

        await this.fillExportBillItemForm(billItemData);
        await this.clickAddItemButton();
        await this.clickSaveButton();
    }

    //clicks "تعديل" on the last visible export bill row (the flat bills list has no master/house bill hierarchy
    //like import, so no scoping needed) - opens the same header form used by addExportBill(), pre-filled with the
    //bill's existing values:
    async clickEditOnExportBillIfPresent() {
        await this.waitForPageIdle();

        const editButton = this.page
            .getByRole('button', { name: 'تعديل' })
            .and(this.page.locator(':visible'))
            .last();

        const isPresent = await editButton
            .waitFor({ state: 'visible', timeout: 10000 })
            .then(() => true)
            .catch(() => false);

        if (!isPresent) {
            return;
        }

        await editButton.click();
    }

    //clicks "حذف" on the last visible export bill row, if present, and confirms the "هل أنت متأكد من تنفيذ عملية
    //حذف؟" dialog the app shows before actually deleting - same modal pattern used everywhere else, but via its
    //own ModalComponent instance rather than the parent's private one:
    async clickDeleteOnExportBillIfPresent() {
        await this.waitForPageIdle();

        const deleteButton = this.page
            .getByRole('button', { name: 'حذف' })
            .and(this.page.locator(':visible'))
            .last();

        const isPresent = await deleteButton
            .waitFor({ state: 'visible', timeout: 10000 })
            .then(() => true)
            .catch(() => false);

        if (!isPresent) {
            return;
        }

        await deleteButton.click();
        await this.exportModal.confirmIfPresent('نعم');
        await this.exportModal.closeIfPresent();
        await this.page.waitForTimeout(2000);
    }
}
