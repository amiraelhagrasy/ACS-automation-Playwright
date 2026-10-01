import { expect, Locator, Page } from '@playwright/test';
import { ModalComponent } from '../../components/ModalComponent';
import { AutocompleteInput } from '../../components/AutocompleteInput';

export type NewTransitManifestData = {
  finalCountry: string;
  finalPort: string;
  finalPortCodeType: string;
  transitType: string;
  transportCompany: string;
  flightNumber: string;
  departureDate: string;
  viaAirportText: string;
  remarks?: string;
};

//identifies an existing, already-received Transit-type master bill (e.g. created via
//NewImportManPage.submitImportManifestWithOneCompletedTransitBill()) to look up in step 2's "إضافة بوليصة شحن جوي
//للترانزيت" dialog. customsNo ("رقم الجمرك") only exists once that bill's import manifest has reached "تم
//استلامها" - read it via ViewImportManifestPage.getCustomsNumber(). Optional: leave unset to search via ZATCA
//lookup on transport company + via-port + bill number alone, without a local customs number:
export type TransitBillSearchData = {
  transportCompany: string;
  customsNo?: string;
  viaAirportText: string;
  billNo: string;
};

//the portion of the found bill's quantity/weight to attach to this transit manifest:
export type TransitBillAmountData = {
  transitQuantity: string;
  transitWeight: string;
  remarks?: string;
};

export class NewTransitManPage {

  private readonly page: Page;
  private readonly airServicesMenu: Locator;
  private readonly airTransitManifestMenu: Locator;
  private readonly createAirTransitManifestButton: Locator;

  //form new transit manifest locators step 1:
  private readonly finalCountryInput: Locator;
  private readonly finalPortInput: Locator;
  private readonly finalPortCodeTypeSelect: Locator;
  private readonly transitTypeSelect: Locator;
  private readonly transportCompanyInput: Locator;
  private readonly flightNumberInput: Locator;
  private readonly departureDateInput: Locator;
  private readonly viaAirportSelect: Locator;
  private readonly remarksTextarea: Locator;

  private readonly saveAndSubmitButton: Locator;
  private readonly saveAndContinueButton: Locator;
  private readonly backButton: Locator;
  private readonly referenceNumberBack: Locator;
  //shown after clickSaveAndSubmit() - same "هل ترغب بتقديم المانيفست؟" confirmation as import/export:
  private readonly submitConfirmationDialog: Locator;
  private readonly confirmYesButton: Locator;
  //success message and reference number locators (shown after clickSaveAndSubmit()):
  private readonly successMessage: Locator;
  private readonly referenceNumber: Locator;
  private readonly messageId: Locator;

  //step 2 - "إضافة بوليصة شحن جوي للترانزيت" (add transit bill) dialog:
  private readonly addTransitBillButton: Locator;
  private readonly searchTransportCompanyInput: Locator;
  private readonly searchCustomsNoInput: Locator;
  private readonly searchPortSelect: Locator;
  private readonly searchBillNoInput: Locator;
  private readonly searchButton: Locator;
  //shown when the search returns a list of candidate bills to pick from (e.g. a ZATCA lookup without a customs
  //number, which is a broader match than one narrowed by "رقم الجمرك") - not shown when the search already
  //narrows to exactly one bill and auto-fills the fields below directly:
  private readonly selectBillButton: Locator;
  //shown instead, in the same results area, when the search matches no bill at all:
  private readonly billNotFoundMessage: Locator;
  private readonly transitQuantityInput: Locator;
  private readonly transitWeightInput: Locator;
  private readonly billRemarksTextarea: Locator;
  //shown on clicking حفظ when the entered quantity/weight exceeds the found bill's own original totals - a
  //"تنبيه من فسح" danger alert (same "vx1 modal show" popup pattern as the submit-success one), blocking the save:
  private readonly amountExceededError: Locator;
  private readonly amountExceededErrorBody: Locator;
  private readonly saveBillButton: Locator;
  private readonly saveDraftManifestButton: Locator;
  //hidden until at least one bill has been added - submits the whole manifest from step 2:
  private readonly submitRequestButton: Locator;
  //"تعديل" on an existing bill's row (step 2's list) - reopens the same add-bill dialog, pre-filled, with
  //quantity/weight directly editable (no re-search needed):
  private readonly editTransitBillButton: Locator;
  //"حذف" on an existing bill's row - shows a "هل أنت متأكد من تنفيذ عملية حذف؟" confirmation dialog:
  private readonly deleteTransitBillButton: Locator;
  //submitting from step 2 shows a "تنبيه من فسح" success popup directly (same "vx1 modal show" popup pattern as
  //elsewhere in the app), not the "هل ترغب بتقديم المانيفست؟" confirmation dialog used by clickSaveAndSubmit():
  private readonly submitSuccessAlert: Locator;

  private readonly modal: ModalComponent;
  private readonly autocomplete: AutocompleteInput;

  constructor(page: Page) {
    this.page = page;
    this.modal = new ModalComponent(page);
    this.autocomplete = new AutocompleteInput(page);

    this.airServicesMenu = page.getByText('خدمات الطيران');
    this.airTransitManifestMenu = page.locator('[package="air_manifest_transit"]');
    this.createAirTransitManifestButton = page.getByRole('button', {
      name: 'إنشاء مانيفست الترانزيت الجوي',
      exact: true,
    });

    //final country/port share their test-attr with the master bill's own "destination country/port" fields
    //(same widget reused across the app), and the port input is disabled until a country is selected:
    this.finalCountryInput = page.locator('input[test-attr="shipping_agent_master_bill_create_destination_country"]');
    this.finalPortInput = page.locator('input[test-attr="shipping_agent_master_bill_create_destination_port_no"]');
    this.finalPortCodeTypeSelect = page.locator('select[test-attr="shipping_agent_air_manifest_transit_final_port_code_type"]');
    this.transitTypeSelect = page.locator('select[test-attr="shipping_agent_air_manifest_transit_transit_type"]');
    this.transportCompanyInput = page.locator('input[test-attr="shipping_agent_air_manifest_create_transport_company_no"]');
    this.flightNumberInput = page.locator('[test-attr="shipping_agent_air_manifest_create_flight_no"]');
    //the departure date test-attr is shared with its "ميلادي" toggle checkbox, so scope to the actual date text input:
    this.departureDateInput = page.locator(
      'input.f-datepicker-input[test-attr="shipping_agent_air_manifest_create_export_flight_departure_date"]'
    );
    //via-airport options are bound to object values (not plain strings), so this must be selected by visible label:
    this.viaAirportSelect = page.locator('select[test-attr="shipping_agent_master_bill_create_via_port"]');
    this.remarksTextarea = page.locator('textarea[test-attr="shipping_agent_air_manifest_transit_remarks"]');

    this.saveAndSubmitButton = page.locator('#submitDraftManifest');
    this.saveAndContinueButton = page.getByRole('button', { name: 'حفظ واستمرار', exact: true });
    this.backButton = page.getByRole('button', { name: 'السابق', exact: true });
    this.referenceNumberBack = page.locator('div.text-gray').first();
    this.submitConfirmationDialog = page.getByRole('dialog').filter({ hasText: 'هل ترغب بتقديم المانيفست؟' });
    this.confirmYesButton = this.submitConfirmationDialog.getByRole('button', { name: 'نعم', exact: true });
    this.successMessage = page.getByText('تم إرسال المانيفست');
    this.referenceNumber = this.successMessage.locator('strong').first();
    this.messageId = this.successMessage.locator('strong').nth(1);

    this.addTransitBillButton = page.getByRole('button', { name: 'إضافة' }).first();
    //adding a second bill leaves the first one's now-closed dialog still in the DOM (hidden, not removed) - same
    //pattern noted in viewExportMan.ts - so every field inside the dialog is scoped to :visible.last() to always
    //target the currently-open instance, not a stale leftover:
    //scoped to the search section's exact test-attrs (the "_1"/no-suffix duplicates below them, populated after a
    //successful search, share similar names but aren't these):
    this.searchTransportCompanyInput = page
      .locator('input[test-attr="shipping_agent_air_manifest_create_transport_company_no_1"]')
      .and(page.locator(':visible'))
      .last();
    this.searchCustomsNoInput = page
      .locator('input[test-attr="shipping_agent_air_manifest_customs_no"]')
      .and(page.locator(':visible'))
      .last();
    //port options are bound to object values (not plain strings), so this must be selected by visible label, same
    //as the header's via-airport select:
    this.searchPortSelect = page
      .locator('select[test-attr="shipping_agent_air_manifest_transit_final_port"]')
      .and(page.locator(':visible'))
      .last();
    //the search field's test-attr has been observed to disappear from the DOM entirely on a repeat dialog open
    //(diagnosed 2026-08-18 - 0 matches for the exact test-attr on the 2nd bill, despite the field being on
    //screen), so this falls back to placeholder + not-disabled instead of the test-attr: the disabled duplicate
    //below (populated only after a search) shares the same placeholder but stays disabled:
    this.searchBillNoInput = page
      .locator('input[placeholder="رقم بوليصة الشحن"]:not([disabled])')
      .and(page.locator(':visible'))
      .last();
    this.searchButton = page.getByRole('button', { name: 'بحث' }).and(page.locator(':visible')).last();
    this.selectBillButton = page
      .locator('button[test-attr="shipping_agent_air_manifest_select_bill"]')
      .and(page.locator(':visible'));
    this.billNotFoundMessage = page.getByText('لا يوجد بيانات').and(page.locator(':visible'));
    //placeholder-based, not test-attr: the same test-attr-vanishing-on-repeat-dialog-open behavior seen on the
    //bill-number search field (2026-08-18) also hit this field on a second bill's dialog:
    this.transitQuantityInput = page
      .locator('input[placeholder="كمية الترانزيت"]')
      .and(page.locator(':visible'))
      .last();
    this.transitWeightInput = page
      .locator('input[placeholder="وزن الترانزيت"]')
      .and(page.locator(':visible'))
      .last();
    this.billRemarksTextarea = page
      .locator('textarea[test-attr="shipping_agent_air_manifest_transit_remarks_1"]')
      .and(page.locator(':visible'))
      .last();
    this.amountExceededError = page.locator('.fasah-alert-danger').and(page.locator(':visible'));
    this.amountExceededErrorBody = page.locator('.fasah-alert-body').and(page.locator(':visible'));
    this.saveBillButton = page
      .locator('.modal-footer')
      .getByRole('button', { name: 'حفظ' })
      .and(page.locator(':visible'))
      .last();
    //final "حفظ" on step 2 itself (outside the add-bill dialog), saving the whole manifest as a draft:
    this.saveDraftManifestButton = page.locator('#saveDraftManifest');
    //hidden until at least one bill has been added:
    this.submitRequestButton = page.getByRole('button', { name: 'تقديم الطلب', exact: true });
    this.submitSuccessAlert = page.locator('div.vx1.modal.show').filter({ hasText: 'تنبيه من فسح' });
    this.editTransitBillButton = page
      .getByRole('button', { name: 'تعديل', exact: true })
      .and(page.locator(':visible'))
      .last();
    this.deleteTransitBillButton = page
      .getByRole('button', { name: 'حذف', exact: true })
      .and(page.locator(':visible'))
      .last();
  }

  //closes any blocking popup/dialog (e.g. license expiration warning) if present. Delegates to closeAllIfPresent()
  //rather than a single closeIfPresent(): confirmed live (2026-09-28) that the license-expiry warning and the
  //newer "الشروط والأحكام" terms popup can be stacked together right after a fresh login, and a single-shot close
  //leaves one of them still blocking:
  async closeBlockingModalIfPresent(): Promise<void> {
    return this.modal.closeAllIfPresent();
  }

  //click on Air Services menu:
  async clickAirServices(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');

    await this.page
      .waitForFunction(
        () => !(globalThis as any).document?.documentElement?.classList.contains('nprogress-busy'),
        undefined,
        { timeout: 10_000 }
      )
      .catch(() => {
        console.log('NProgress did not finish, continuing with locator checks');
      });

    await this.closeBlockingModalIfPresent();

    await expect(this.airServicesMenu).toBeVisible({ timeout: 20_000 });
    await expect(this.airServicesMenu).toBeEnabled();

    const menuAlreadyOpen = await this.airTransitManifestMenu.isVisible().catch(() => false);

    if (!menuAlreadyOpen) {
      //a popup (e.g. a welcome/license notice right after a fresh login) can appear between the
      //closeBlockingModalIfPresent() check above and this click, intercepting it indefinitely (confirmed live,
      //2026-09-26: 188 retries over 2 minutes before the whole test timed out). Re-check and close right before
      //clicking, retrying the click itself if a modal was still intercepting it - same fix already applied to
      //NewImportManPage.clickAirServices():
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

  //click on Air Transit Manifest menu:
  async clickAirTransitManifest(): Promise<void> {
    await expect(this.airTransitManifestMenu).toBeVisible();
    await expect(this.airTransitManifestMenu).toBeEnabled();

    //same modal-intercept risk as clickAirServices() above - retry the click after closing any stray modal:
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.closeBlockingModalIfPresent();

      const clicked = await this.airTransitManifestMenu
        .click({ timeout: 15_000 })
        .then(() => true)
        .catch(() => false);

      if (clicked) {
        break;
      }
    }
  }

  //click on Create Air Transit Manifest button:
  //
  //KNOWN FLAKY SPOT (as of 2026-09-27): this app stacks each "page" as its own <div class="Layer"> rather than
  //replacing the previous one, and the create form's whole Layer (confirmed via a live DOM dump the user captured
  //mid-run: correct structure, correct test-attr, no iframe involved) is appended to the DOM with a highly
  //variable delay after this click - sometimes near-instant (confirmed live by the user watching it appear right
  //away), sometimes it never completes within any reasonable wait at all. The form renders in STAGES, confirmed
  //via live element counts: the outer #manifest-form container can exist while the destination-country <input>
  //inside it still doesn't (0 matches for its test-attr even once #manifest-form's own count was 1) - so waiting
  //on the outer container's presence wouldn't help either; the inner field's own delay is independent and is what
  //actually needs to be waited on, and its delay is the unpredictable part.
  //
  //Ruled out as fixes - do not re-attempt without new evidence:
  //  - Waiting longer for the field to attach: tried 40s and even 90s (on top of AutocompleteInput.select()'s own
  //    25s afterward, so 115s+ total) - still failed outright on some attempts, meaning this isn't just "slow and
  //    would eventually succeed with enough patience" - some attempts are a genuine dead end within that page
  //    load, not a slow-but-recoverable one, so no wait duration can be relied on to fix it.
  //  - Waiting for window.fasah.air_manifest_transit.createNewManifest to exist before clicking (it already did).
  //  - Clicking the button a second time, or reloading + re-navigating and retrying up to 3 times.
  //  - English UI instead of Arabic (a manual English-UI click worked fine either way).
  //  - Headless vs. headed, and a larger (1920x1080) viewport in headless - no consistent effect either way.
  //  - Dispatching the click via native JS (element.click() through evaluate()) instead of Playwright's synthetic
  //    mouse click - failed identically every time, ruling out the click mechanism itself as the cause.
  //
  //Since no wait duration reliably works, the mitigation is a whole-test retry (fresh login + fresh page load,
  //not a retry inside this one page load) via test.describe.configure({ retries: 1 }) in the test file:
  async clickCreateAirTransitManifest(): Promise<void> {
    await expect(this.createAirTransitManifestButton).toBeVisible({ timeout: 15_000 });
    await expect(this.createAirTransitManifestButton).toBeEnabled();

    await this.createAirTransitManifestButton.click();
  }

  protected async fillDate(input: Locator, date: string): Promise<void> {
    await expect(input).toBeVisible();

    await input.click();
    await input.fill(date);
    await input.press('Tab');
  }

  async fillFinalCountry(country: string): Promise<void> {
    await this.autocomplete.select(this.finalCountryInput, country);
  }

  //only enabled once a final country has been picked:
  async fillFinalPort(port: string): Promise<void> {
    await expect(this.finalPortInput).toBeEnabled({ timeout: 10_000 });

    await this.autocomplete.select(this.finalPortInput, port);
  }

  async selectFinalPortCodeType(value: string): Promise<void> {
    await this.finalPortCodeTypeSelect.selectOption(value);
  }

  //auto-locked (disabled) by the app once the final country is chosen - e.g. a foreign country forces "دولي"
  //(international) - so only select it when it's actually enabled, same pattern as master bill's destination port
  //type field:
  async selectTransitType(value: string): Promise<void> {
    const enabled = await this.transitTypeSelect.isEnabled().catch(() => false);

    if (enabled) {
      await this.transitTypeSelect.selectOption(value);
    }
  }

  async fillTransportCompany(transportCompany: string): Promise<void> {
    await this.autocomplete.select(this.transportCompanyInput, transportCompany);
  }

  async fillFlightNumber(flightNumber: string): Promise<void> {
    await expect(this.flightNumberInput).toBeEditable();

    await this.flightNumberInput.fill(flightNumber);
  }

  async selectViaAirport(airportText: string): Promise<void> {
    await this.viaAirportSelect.selectOption({ label: airportText });
  }

  async fillRemarks(remarks: string): Promise<void> {
    await this.remarksTextarea.fill(remarks);
  }

  async fillManifestForm(data: NewTransitManifestData): Promise<void> {
    await this.fillFinalCountry(data.finalCountry);
    await this.fillFinalPort(data.finalPort);
    await this.selectFinalPortCodeType(data.finalPortCodeType);
    await this.selectTransitType(data.transitType);
    await this.fillTransportCompany(data.transportCompany);
    await this.fillFlightNumber(data.flightNumber);
    await this.fillDate(this.departureDateInput, data.departureDate);
    await this.selectViaAirport(data.viaAirportText);

    if (data.remarks) {
      await this.fillRemarks(data.remarks);
    }
  }

  async clickBackButton(): Promise<void> {
    await expect(this.backButton).toBeVisible();
    await expect(this.backButton).toBeEnabled();

    await this.backButton.click();
  }

  //saves the manifest as a draft ("حفظ واستمرار") without submitting it, moving on to the bills step:
  async clickSaveAndContinue(): Promise<void> {
    await expect(this.saveAndContinueButton).toBeVisible();
    await expect(this.saveAndContinueButton).toBeEnabled();

    await this.saveAndContinueButton.click();
  }

  //save & submit directly from step 1, without adding any bills:
  async clickSaveAndSubmit(): Promise<void> {
    await expect(this.saveAndSubmitButton).toBeVisible();
    await expect(this.saveAndSubmitButton).toBeEnabled();

    await this.saveAndSubmitButton.click();
    await this.confirmManifestSubmission();
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
  //saved - only populated after clickSaveAndContinue() + clickBackButton(), same pattern as import/export:
  async getReferenceNumberDraft(): Promise<string> {
    return (await this.referenceNumberBack.textContent())?.trim() ?? '';
  }

  //opens the "إضافة بوليصة شحن جوي للترانزيت" dialog from step 2 - only available after clickSaveAndContinue():
  async clickAddTransitBillButton(): Promise<void> {
    await expect(this.addTransitBillButton).toBeVisible({ timeout: 15_000 });
    await expect(this.addTransitBillButton).toBeEnabled();

    await this.addTransitBillButton.click();
  }

  //fills the dialog's search section and looks up the existing transit bill. A search narrowed by customs number
  //matches exactly one bill and auto-fills the "رمز شركة الشحن" / "رقم بوليصة الشحن" / "رقم جمرك الاستيراد" fields
  //below directly. Without it (ZATCA lookup), the search instead returns a list of candidate bills, each with its
  //own "اختيار البوليصة" button, which must be clicked to pick one before those fields get filled:
  async searchTransitBill(data: TransitBillSearchData): Promise<void> {
    await this.autocomplete.select(this.searchTransportCompanyInput, data.transportCompany);

    if (data.customsNo) {
      await this.searchCustomsNoInput.fill(data.customsNo);
    }

    await this.searchPortSelect.selectOption({ label: data.viaAirportText });

    //explicit editable check (rather than relying on fill()'s own auto-wait) surfaces a clear diagnostic if this
    //field is genuinely stuck disabled on a repeat search, instead of an ambiguous downstream timeout:
    await expect(this.searchBillNoInput).toBeEditable({ timeout: 15_000 });
    await this.searchBillNoInput.fill(data.billNo);

    await this.searchButton.click();

    const selectButtonShown = await this.selectBillButton
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(() => true)
      .catch(() => false);

    if (selectButtonShown) {
      //the click has intermittently not registered (button stays put, amount fields stay disabled) - likely a
      //momentary re-render/overlay under load - so verify it actually took effect (button disappears once a bill
      //is selected) and retry a couple of times if not:
      for (let attempt = 0; attempt < 3; attempt++) {
        await this.selectBillButton.first().click();

        const stillShown = await this.selectBillButton
          .first()
          .waitFor({ state: 'visible', timeout: 5_000 })
          .then(() => true)
          .catch(() => false);

        if (!stillShown) {
          break;
        }
      }
    }
  }

  //asserts the search above matched no bill at all - the modal shows a "لا يوجد بيانات" (No data) empty state,
  //with an inbox icon, in the same results area that would otherwise list candidate bills to pick from:
  async verifyTransitBillNotFound(): Promise<void> {
    await expect(this.billNotFoundMessage.first()).toBeVisible({ timeout: 15_000 });
  }

  //fills the quantity/weight portion to attach, once the search above has populated the bill's details:
  async fillTransitBillAmount(data: TransitBillAmountData): Promise<void> {
    await expect(this.transitQuantityInput).toBeEditable({ timeout: 10_000 });

    await this.transitQuantityInput.fill(data.transitQuantity);
    await this.transitWeightInput.fill(data.transitWeight);

    if (data.remarks) {
      await this.billRemarksTextarea.fill(data.remarks);
    }
  }

  //saves the bill within the dialog, closing it and adding the bill to step 2's list:
  async clickSaveBillButton(): Promise<void> {
    await expect(this.saveBillButton).toBeVisible();
    await expect(this.saveBillButton).toBeEnabled();

    await this.saveBillButton.click();
  }

  //asserts the "تنبيه من فسح" danger alert shown when the entered quantity/weight exceeds the found bill's own
  //original totals (e.g. "كمية الترانزيت لا يمكن أن تكون أكبر من مجموع الكمية الأصلي لبوليصة الشحن الجوي"),
  //returns its message text, then closes it. Blocks the save - the bill is never added to step 2's list:
  async verifyAmountExceededError(): Promise<string> {
    await expect(this.amountExceededError.first()).toBeVisible({ timeout: 15_000 });

    const message = (await this.amountExceededErrorBody.first().textContent())?.trim() ?? '';

    await this.closeBlockingModalIfPresent();

    return message;
  }

  //opens the dialog, searches for an existing transit bill, fills the amount to attach, and saves it:
  async addTransitBill(searchData: TransitBillSearchData, amountData: TransitBillAmountData): Promise<void> {
    await this.clickAddTransitBillButton();
    await this.searchTransitBill(searchData);
    await this.fillTransitBillAmount(amountData);
    await this.clickSaveBillButton();
  }

  //saves the whole manifest as a draft from step 2, after at least one bill has been added:
  async clickSaveDraftManifestButton(): Promise<void> {
    await expect(this.saveDraftManifestButton).toBeVisible();
    await expect(this.saveDraftManifestButton).toBeEnabled();

    await this.saveDraftManifestButton.click();
  }

  //submits the whole manifest from step 2 ("تقديم الطلب") - only becomes visible/enabled once at least one bill
  //has been added. Unlike clickSaveAndSubmit(), this shows the "تنبيه من فسح" success popup directly rather than
  //a "هل ترغب بتقديم المانيفست؟" confirmation dialog first:
  async clickSubmitRequestButton(): Promise<void> {
    await expect(this.submitRequestButton).toBeVisible({ timeout: 10_000 });
    await expect(this.submitRequestButton).toBeEnabled();

    await this.submitRequestButton.click();

    await expect(this.submitSuccessAlert).toBeVisible({ timeout: 15_000 });
  }

  //reads the reference number and message id from the "تنبيه من فسح" success popup shown after
  //clickSubmitRequestButton(), then closes it:
  async getSubmittedReferenceNumberAndClose(): Promise<{ referenceNumber: string; messageId: string }> {
    const referenceNumber = (await this.submitSuccessAlert.locator('strong').first().textContent())?.trim() ?? '';
    const messageId = (await this.submitSuccessAlert.locator('strong').nth(1).textContent())?.trim() ?? '';

    await this.closeBlockingModalIfPresent();

    return { referenceNumber, messageId };
  }

  //clicks "تعديل" on the last (or only) bill row in step 2's list, reopening the add-bill dialog pre-filled with
  //that bill's data - quantity/weight are directly editable here without needing to re-search:
  async clickEditTransitBillButton(): Promise<void> {
    await expect(this.editTransitBillButton).toBeVisible({ timeout: 15_000 });
    await expect(this.editTransitBillButton).toBeEnabled();

    await this.editTransitBillButton.click();
  }

  //clicks "حذف" on the last (or only) bill row in step 2's list, and confirms the "هل أنت متأكد من تنفيذ عملية
  //حذف؟" dialog the app shows before actually deleting - same modal pattern used everywhere else in this codebase
  //(e.g. ViewExportManifestPage.clickDeleteOnExportBillIfPresent()):
  async clickDeleteTransitBillButton(): Promise<void> {
    await expect(this.deleteTransitBillButton).toBeVisible({ timeout: 15_000 });
    await expect(this.deleteTransitBillButton).toBeEnabled();

    await this.deleteTransitBillButton.click();
    await this.modal.confirmIfPresent('نعم');
  }

  //scopes to step 2's bill row whose "رقم بوليصة الشحن" cell matches billNo - needed once more than one bill is
  //attached, where clickEditTransitBillButton()/clickDeleteTransitBillButton()'s .last() would target the wrong
  //row:
  private transitBillRowByNumber(billNo: string): Locator {
    return this.page.locator('tbody tr').filter({
      has: this.page.locator('td[test-attr^="shipping_agent_master_bill_create_bill_no"]', { hasText: billNo }),
    });
  }

  //same as clickEditTransitBillButton(), but scoped to the row for a specific bill number:
  async clickEditTransitBillButtonForBillNo(billNo: string): Promise<void> {
    const editButton = this.transitBillRowByNumber(billNo).getByRole('button', { name: 'تعديل', exact: true });

    await expect(editButton).toBeVisible({ timeout: 15_000 });
    await expect(editButton).toBeEnabled();

    await editButton.click();
  }

  //same as clickDeleteTransitBillButton(), but scoped to the row for a specific bill number:
  async clickDeleteTransitBillButtonForBillNo(billNo: string): Promise<void> {
    const deleteButton = this.transitBillRowByNumber(billNo).getByRole('button', { name: 'حذف', exact: true });

    await expect(deleteButton).toBeVisible({ timeout: 15_000 });
    await expect(deleteButton).toBeEnabled();

    await deleteButton.click();
    await this.modal.confirmIfPresent('نعم');
  }
}
