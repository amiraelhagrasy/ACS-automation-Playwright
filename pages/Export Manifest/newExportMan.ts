import { expect, Locator, Page } from '@playwright/test';
import { ViewManifestPage } from '../Import Manifest/viewManifestPage';

export type NewExportManifestData = {
    exportPort: string;
    transportCompany: string;
    flightNumber: string;
    departureDate: string;
    issueDate: string;
    shippingAgentType: string;
    shippingAgentNumber: string;
};

//genuinely specific to creating/submitting a NEW Export air manifest - the manifest-type-agnostic view/search/
//status/master-bill/house-bill methods (and waitForPageIdle()'s session-timeout handling) live in
//ViewManifestPage, which this extends, same as NewImportManPage:
export class NewExportManPage extends ViewManifestPage {
    private readonly airServicesMenu: Locator;
    private readonly airExportManifestMenu: Locator;
    private readonly createAirExportManifestButton: Locator;

    //form new export manifest locators step 1:
    private readonly exportPortInput: Locator;
    private readonly transportCompanyInput: Locator;
    private readonly flightNumberInput: Locator;
    private readonly departureDateInput: Locator;
    private readonly issueDateInput: Locator;
    private readonly shippingAgentTypeSelect: Locator;
    private readonly shippingAgentNumberInput: Locator;

    private readonly saveAndSubmitButton: Locator;
    private readonly saveAndContinueButton: Locator;
    private readonly backButton: Locator;
    private readonly referenceNumberBack: Locator;
    //shown after clickSaveAndSubmit() - unlike the ECL's own submit button, this direct no-bills submit does show
    //a confirmation dialog, same as import's:
    private readonly submitConfirmationDialog: Locator;
    private readonly confirmYesButton: Locator;
    //success message and reference number locators (shown after clickSaveAndSubmit()'s direct, no-bills submit):
    private readonly successMessage: Locator;
    private readonly referenceNumber: Locator;
    private readonly messageId: Locator;

    constructor(page: Page) {
        super(page);

        this.airServicesMenu = page.getByText('خدمات الطيران');
        this.airExportManifestMenu = page.locator('[package="air_manifest_export"]');
        this.createAirExportManifestButton = page.getByRole('button', {
            name: 'إنشاء مانيفست التصدير الجوي',
            exact: true,
        });

        //export port and shipping agent number share their test-attr between the search icon and the input itself,
        //so scope to the input tag to avoid matching the icon:
        this.exportPortInput = page.locator(
            'input[test-attr="shipping_agent_air_manifest_create_export_reg_port_code"]'
        );
        this.transportCompanyInput = page.locator(
            'input[test-attr="shipping_agent_air_manifest_create_transport_company_no"]'
        );
        this.flightNumberInput = page.locator('[test-attr="shipping_agent_air_manifest_create_flight_no"]');
        //the departure/issue date test-attrs are also shared with their "ميلادي" toggle checkbox, so scope to the
        //actual date text input:
        this.departureDateInput = page.locator(
            'input.f-datepicker-input[test-attr="shipping_agent_air_manifest_create_export_flight_departure_date"]'
        );
        this.issueDateInput = page.locator(
            'input.f-datepicker-input[test-attr="shipping_agent_air_manifest_create_export_manifest_issue_date"]'
        );
        this.shippingAgentTypeSelect = page.locator(
            'select[test-attr="shipping_agent_air_manifest_create_shipping_agent_type"]'
        );
        this.shippingAgentNumberInput = page.locator(
            'input[test-attr="shipping_agent_air_manifest_create_export_shipping_agent_number"]'
        );

        this.saveAndSubmitButton = page.locator('#submitDraftManifest');
        this.saveAndContinueButton = page.getByRole('button', { name: 'حفظ واستمرار', exact: true });
        this.backButton = page.getByRole('button', { name: 'السابق', exact: true });
        this.referenceNumberBack = page.locator('div.text-gray').first();
        this.submitConfirmationDialog = page.getByRole('dialog').filter({ hasText: 'هل ترغب بتقديم المانيفست؟' });
        this.confirmYesButton = this.submitConfirmationDialog.getByRole('button', { name: 'نعم', exact: true });
        this.successMessage = page.getByText('تم إرسال المانيفست');
        this.referenceNumber = this.successMessage.locator('strong').first();
        this.messageId = this.successMessage.locator('strong').nth(1);
    }

    //click on Air Services menu:
    async clickAirServices(): Promise<void> {
        await this.page.waitForLoadState('domcontentloaded');
        await this.waitForPageIdle();
        await this.closeBlockingModalIfPresent();

        await expect(this.airServicesMenu).toBeVisible({ timeout: 20_000 });
        await expect(this.airServicesMenu).toBeEnabled();

        const menuAlreadyOpen = await this.airExportManifestMenu.isVisible().catch(() => false);

        if (!menuAlreadyOpen) {
            //a popup (e.g. the license-expiry notice) can appear between the closeBlockingModalIfPresent() check
            //above and this click - re-check and close right before clicking, retrying the click itself if a
            //modal was still intercepting it (same pattern as NewImportManPage.clickAirServices()):
            for (let attempt = 1; attempt <= 3; attempt++) {
                await this.closeBlockingModalIfPresent();

                const clicked = await this.airServicesMenu
                    .click({ timeout: 15_000 })
                    .then(() => true)
                    .catch(() => false);

                if (clicked) {
                    break;
                }
            }
        }
    }

    //click on Air Export Manifest menu:
    async clickAirExportManifest(): Promise<void> {
        await expect(this.airExportManifestMenu).toBeVisible();
        await expect(this.airExportManifestMenu).toBeEnabled();

        //a stray popup can appear while this runs repeatedly inside a status-polling loop - same pattern as
        //NewImportManPage.clickAirImportManifest():
        for (let attempt = 1; attempt <= 3; attempt++) {
            await this.closeBlockingModalIfPresent();

            const clicked = await this.airExportManifestMenu
                .click({ timeout: 15_000 })
                .then(() => true)
                .catch(() => false);

            if (clicked) {
                break;
            }
        }
    }

    //click on Create Air Export Manifest button:
    async clickCreateAirExportManifest(): Promise<void> {
        await expect(this.createAirExportManifestButton).toBeVisible({ timeout: 15_000 });
        await expect(this.createAirExportManifestButton).toBeEnabled();

        await this.createAirExportManifestButton.click();
    }

    async fillExportPort(exportPort: string): Promise<void> {
        await this.selectAutocompleteOption(this.exportPortInput, exportPort);
    }

    async fillTransportCompany(transportCompany: string): Promise<void> {
        await this.selectAutocompleteOption(this.transportCompanyInput, transportCompany);
    }

    async fillFlightNumber(flightNumber: string): Promise<void> {
        await expect(this.flightNumberInput).toBeEditable();

        await this.flightNumberInput.fill(flightNumber);
    }

    async selectShippingAgentType(value: string): Promise<void> {
        await this.shippingAgentTypeSelect.selectOption(value);
    }

    //the "رقم وكيل الشحن" list isn't filtered by the typed value - it always shows the full list of agents, so pick
    //the first visible result instead of matching on text:
    async fillShippingAgentNumber(shippingAgentNumber: string): Promise<void> {
        await this.selectFirstAutocompleteOption(this.shippingAgentNumberInput, shippingAgentNumber);
    }

    async fillManifestForm(data: NewExportManifestData): Promise<void> {
        await this.fillExportPort(data.exportPort);
        await this.fillTransportCompany(data.transportCompany);
        await this.fillFlightNumber(data.flightNumber);
        await this.fillDate(this.departureDateInput, data.departureDate);
        await this.fillDate(this.issueDateInput, data.issueDate);
        await this.selectShippingAgentType(data.shippingAgentType);
        await this.fillShippingAgentNumber(data.shippingAgentNumber);
    }

    //saves the manifest as a draft ("حفظ واستمرار") without submitting it, moving on to the bills step:
    async clickSaveAndContinue(): Promise<void> {
        await expect(this.saveAndContinueButton).toBeVisible();
        await expect(this.saveAndContinueButton).toBeEnabled();

        await this.saveAndContinueButton.click();
    }

    async clickBackButton(): Promise<void> {
        await expect(this.backButton).toBeVisible();
        await expect(this.backButton).toBeEnabled();

        await this.backButton.click();
    }

    //save & submit directly from step 1, without adding any bills:
    async clickSaveAndSubmit(): Promise<void> {
        await expect(this.saveAndSubmitButton).toBeVisible();
        await expect(this.saveAndSubmitButton).toBeEnabled();

        await this.saveAndSubmitButton.click();
    }

    //confirms the "هل ترغب بتقديم المانيفست؟" dialog shown after clickSaveAndSubmit():
    async confirmManifestSubmission(): Promise<void> {
        await expect(this.submitConfirmationDialog).toBeVisible({ timeout: 10_000 });

        await expect(this.confirmYesButton).toBeVisible();
        await expect(this.confirmYesButton).toBeEnabled();

        await this.confirmYesButton.click();

        await expect(this.submitConfirmationDialog).toBeHidden({ timeout: 10_000 });
    }

    //assertion for success message after clickSaveAndSubmit():
    async verifyManifestSubmittedSuccessfully(): Promise<void> {
        await expect(this.successMessage).toBeVisible();
        await expect(this.successMessage).toContainText('تم إرسال المانيفست');
    }

    //gets reference number and message id after clickSaveAndSubmit():
    async getReferenceNumber(): Promise<string> {
        return (await this.referenceNumber.textContent())?.trim() ?? '';
    }

    //reads the auto-generated reference number ("رقم الوثيقة التسلسلي") shown on step 1 once the manifest has been
    //saved - only populated after clickSaveAndContinue() + clickBackButton(), same pattern as the import manifest flow:
    async getReferenceNumberDraft(): Promise<string> {
        return (await this.referenceNumberBack.textContent())?.trim() ?? '';
    }
}
