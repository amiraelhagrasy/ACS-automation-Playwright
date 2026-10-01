import { expect, Locator, Page } from '@playwright/test';
import { ViewManifestPage, MasterBillData, AirwayBillData, BillItemData, WarehouseData } from './viewManifestPage';

export type NewImportManifestData = {
  transportCompany: string;
  flightNumber: string;
  loadingCountry: string;
  loadingPort: string;
  departureDate: string;
  arrivalDate: string;
  unloadingDate: string;
  totalNumberOfBills: string;
  shippingAgentType: string;
  finalAirportText: string;
};

//genuinely specific to creating/submitting a NEW Import air manifest - the manifest-type-agnostic view/search/
//status/master-bill/house-bill methods live in ViewManifestPage, which this extends:
export class NewImportManPage extends ViewManifestPage {

  private readonly airServicesMenu: Locator;
  private readonly airImportManifestMenu: Locator;
  private readonly createAirImportManifestButton: Locator;

  //form new import manifest locators step 1:
  private readonly transportCompanyInput: Locator;
  private readonly flightNumberInput: Locator;
  private readonly loadingCountryInput: Locator;
  private readonly loadingPortInput: Locator;

  protected readonly departureDateInput: Locator;
  protected readonly arrivalDateInput: Locator;
  protected readonly unloadingDateInput: Locator;

  protected readonly totalNumberOfBillsInput: Locator;
  protected readonly shippingAgentTypeSelect: Locator;
  private readonly finalAirportSelect: Locator;

  private readonly saveAndSubmitButton: Locator;
  private readonly submitConfirmationDialog: Locator;
  private readonly confirmYesButton: Locator;
  private readonly saveAndContinueButton: Locator;
  private readonly backButton: Locator;
  private readonly referenceNumberBack: Locator;
  //success message and reference number locators:
  private readonly successMessage: Locator;
  private readonly referenceNumber: Locator;
  private readonly messageId: Locator;

  constructor(page: Page) {
    super(page);
    this.airServicesMenu = page.getByText('خدمات الطيران')
    this.airImportManifestMenu = page.locator('[package="air_manifest_import"]');
    this.createAirImportManifestButton = page.getByRole('button', { name: 'إنشاء مانيفست الاستيراد الجوي', exact: true, });
    this.transportCompanyInput = page.locator('input[test-attr="shipping_agent_air_manifest_create_transport_company_no"]');
    this.flightNumberInput = page.locator('[test-attr="shipping_agent_air_manifest_create_flight_no"]');
    this.loadingCountryInput = page.locator('input[test-attr="shipping_agent_air_manifest_create_loading_country"]');
    this.loadingPortInput = page.locator('input[test-attr="shipping_agent_air_manifest_create_loading_port_no"]');
    this.departureDateInput = page.locator('input.f-datepicker-input[test-attr="shipping_agent_air_manifest_create_flight_take_off_date"]');
    this.arrivalDateInput = page.locator('input.f-datepicker-input[test-attr="shipping_agent_air_manifest_create_flight_arrival_date"]');
    this.unloadingDateInput = page.locator('input.f-datepicker-input[test-attr="shipping_agent_air_manifest_create_unloading_date"]');
    this.totalNumberOfBillsInput = page.locator('[test-attr="shipping_agent_air_manifest_create_total_number_of_bills"]');
    this.shippingAgentTypeSelect = page.locator('select[test-attr="shipping_agent_air_manifest_create_shipping_agent_type"]');
    this.finalAirportSelect = page.locator('select[test-attr="shipping_agent_final_port_name"]');
    this.saveAndSubmitButton = page.locator('#submitDraftManifest');
    this.saveAndContinueButton = page.getByRole('button', {name: 'حفظ واستمرار',exact: true});
    this.submitConfirmationDialog = page.getByRole('dialog').filter({ hasText: 'هل ترغب بتقديم المانيفست؟' });
    this.confirmYesButton = this.submitConfirmationDialog.getByRole('button',{name: 'نعم',exact: true,})
    this.successMessage = page.getByText('تم إرسال المانيفست');
    this.referenceNumber =this.successMessage.locator('strong').first();
    this.messageId =this.successMessage.locator('strong').nth(1);
    //the wizard renders a "prev-step" button per step (only one actually visible at a time), so matching by
    //role/accessible name alone can resolve to a hidden one from another step - same class of bug as
    //referenceNumberBack below. Scoping to the class + :visible pins it to the one actually on screen:
    this.backButton = page.locator('button.prev-step', { hasText: 'السابق' }).and(page.locator(':visible')).first();
    //plain .first() picked whichever div.text-gray came first in DOM order, which isn't reliably the one
    //holding the reference number - other div.text-gray elements on the page are empty/hidden placeholders.
    //Filtering to the one that actually contains digits gets the real one regardless of DOM order:
    this.referenceNumberBack = page.locator('div.text-gray').filter({ hasText: /\d/ }).first();
  }

  //click on Air Services menu:
  async clickAirServices(): Promise<void> {
  await this.page.waitForLoadState('domcontentloaded');

  await this.page.waitForFunction(
    () => !document.documentElement.classList.contains('nprogress-busy'),
    undefined,
    { timeout: 10_000 }
  ).catch(() => {
    console.log('NProgress did not finish, continuing with locator checks');
  });

  await this.closeBlockingModalIfPresent();

  await expect(this.airServicesMenu).toBeVisible({
    timeout: 20_000,
  });

  await expect(this.airServicesMenu).toBeEnabled();

  const menuAlreadyOpen = await this.airImportManifestMenu
    .isVisible()
    .catch(() => false);

  if (!menuAlreadyOpen) {
    //a popup (e.g. the license-expiry notice) can appear between the closeBlockingModalIfPresent() check above
    //and this click - especially now that a failed attempt's retry reuses the same shared page instead of a
    //fresh one, so any modal left over from the failed attempt is still sitting there. Re-check and close right
    //before clicking, retrying the click itself if a modal was still intercepting it:
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
  //click on Air Import Manifest menu:
  async clickAirImportManifest(): Promise<void> {
    //unlike clickAirServices(), this had no modal-closing retry - a stray popup (e.g. a leftover success alert)
    //can appear while this runs repeatedly inside a status-polling loop (expectManifestStatus()'s navigate
    //callback calls it every few seconds) and block the click for the loop's entire duration (confirmed live,
    //2026-09-22: 443 retries over ~3.7 minutes before the whole test timed out):
    //
    //confirmed live, 2026-09-28: the OLD version of this fix only wrapped the final click in a retry loop, with
    //an unguarded toBeVisible()/toBeEnabled() check still running first - a popup (the "الشروط والأحكام" one in
    //particular) covering the menu right at that moment failed the whole method before the retry loop was ever
    //reached. Close modals BEFORE the visibility check too, and retry the whole sequence together:
    let clicked = false;
    for (let attempt = 1; attempt <= 3 && !clicked; attempt++) {
      await this.closeBlockingModalIfPresent();

      const visible = await this.airImportManifestMenu
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => true)
        .catch(() => false);

      if (!visible) {
        continue;
      }

      await this.closeBlockingModalIfPresent();

      clicked = await this.airImportManifestMenu
        .click({ timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
    }

    //surface a clear failure instead of silently moving on if every attempt failed:
    await expect(this.airImportManifestMenu).toBeVisible({ timeout: 5_000 });
  }
  //wraps ViewManifestPage.expectManifestStatus(), filling in the "navigate back to the manifest list" callback
  //with this manifest type's own menu clicks - every call site across the Import test files was repeating the
  //same clickAirServices()+clickAirImportManifest() callback inline, so this collapses it to one call. Named
  //distinctly from the base class's own waitForManifestStatus() (a different method - returns a boolean, no
  //navigate callback, used internally by expectManifestStatus()) to avoid silently overriding it, which would
  //have caused infinite recursion the moment expectManifestStatus() called it on a NewImportManPage instance:
  async waitForManifestToReachStatus(
    referenceNo: string,
    status: string,
    options: { intervalMs: number; timeoutMs: number } = { intervalMs: 5_000, timeoutMs: 120_000 }
  ): Promise<void> {
    await this.expectManifestStatus(
      async () => {
        await this.clickAirServices();
        await this.clickAirImportManifest();
      },
      referenceNo,
      status,
      options
    );

    //confirmed live, 2026-09-27: this status query itself flips to تم استلامها a beat before OTHER services that
    //depend on the same manifest catch up - same class of lag as the delivery-order "المانيفست غير موجود" issue,
    //just surfacing here as the manifest's own reference number being briefly unsearchable right after this
    //resolves (search returned "لا يوجد بيانات" within 15s of the status flip). A short buffer here, not a
    //raised timeout on whatever the caller does next, since it's this specific transition that's the trigger:
    await this.page.waitForTimeout(3_000);
  }

  //click on Create Air Import Manifest button:
  async clickCreateAirImportManifest(): Promise<void> {
    await expect(this.createAirImportManifestButton).toBeVisible({
      timeout: 15_000,
    });

    await expect(this.createAirImportManifestButton).toBeEnabled();

    //confirmed live, 2026-09-28: the license-expiry/"الشروط والأحكام" popups can re-appear at any point in a long
    //shared session (not just right after login), and this click has no guard against one being open - close
    //anything blocking before clicking, same as clickAirServices() already does:
    await this.closeBlockingModalIfPresent();

    await this.createAirImportManifestButton.click();

    //without this, a slow navigation to the create form leaves fillManifestForm() polling for the transport
    //company field while still on the manifest list page - it eventually fails there instead of here, which
    //hides the real cause (navigation never completed, not that the field itself is slow to render):
    await expect(this.transportCompanyInput).toBeVisible({ timeout: 25_000 });
  }
  //Fill the form of new import manifest step 1:

  async fillTransportCompany(
    transportCompany: string
  ): Promise<void> {
    await this.selectAutocompleteOption(
      this.transportCompanyInput,
      transportCompany
    );
  }

  async fillFlightNumber(
    flightNumber: string
  ): Promise<void> {
    await expect(this.flightNumberInput).toBeEditable();

    await this.flightNumberInput.fill(flightNumber);
  }

  //fills "مجموع بوالص الشحن الواصلة" (total number of bills) - editable both on initial manifest creation and on the
  //ECL header edit step:
  async fillTotalNumberOfBills(
    totalNumberOfBills: string
  ): Promise<void> {
    await expect(this.totalNumberOfBillsInput).toBeEditable();

    await this.totalNumberOfBillsInput.fill(totalNumberOfBills);
  }

  async fillLoadingCountry(
    country: string
  ): Promise<void> {
    await this.selectAutocompleteOption(
      this.loadingCountryInput,
      country
    );
  }

  async fillLoadingPort(port: string): Promise<void> {
  const currentValue =
    await this.loadingPortInput.inputValue();

    if (currentValue.trim() === port.trim()) {
      return;
    }

    await this.selectAutocompleteOption(
      this.loadingPortInput,
      port
    );
  }

  async selectShippingAgentType(
    value: string
  ): Promise<void> {
    await this.shippingAgentTypeSelect.selectOption(value);
  }

  async selectFinalAirport(
    airportText: string
  ): Promise<void> {
    await this.finalAirportSelect.selectOption({
      label: airportText,
    });
  }

  async fillManifestForm(
    data: NewImportManifestData
  ): Promise<void> {
    await this.fillTransportCompany(
      data.transportCompany
    );

    await this.fillFlightNumber(
      data.flightNumber
    );

    await this.fillLoadingCountry(
      data.loadingCountry
    );

    await this.fillLoadingPort(
      data.loadingPort
    );

    await this.fillDate(
      this.departureDateInput,
      data.departureDate
    );

    await this.fillDate(
      this.arrivalDateInput,
      data.arrivalDate
    );

    await this.fillDate(
      this.unloadingDateInput,
      data.unloadingDate
    );

    await this.totalNumberOfBillsInput.fill(
      data.totalNumberOfBills
    );

    await this.selectShippingAgentType(
      data.shippingAgentType
    );

    await this.selectFinalAirport(
      data.finalAirportText
    );


  }

 async clickBackButton(): Promise<void> {
  await expect(this.backButton).toBeVisible();
  await expect(this.backButton).toBeEnabled();
  await this.backButton.click();
 }

  //save manifest  draft:
  async clickSaveAndSubmitDraft(): Promise<void> {
    await expect(this.saveAndSubmitButton).toBeVisible();
    await expect(this.saveAndSubmitButton).toBeEnabled();

    await this.saveAndContinueButton.click();
    await this.clickBackButton();


  }
  //Save without AWBs:
  async clickSaveAndSubmit(): Promise<void> {
    await expect(this.saveAndSubmitButton).toBeVisible();
    await expect(this.saveAndSubmitButton).toBeEnabled();

    await this.saveAndSubmitButton.click();
    await this.confirmManifestSubmission();

  }
  //confirm manifest submission:
  async confirmManifestSubmission(): Promise<void> {
    await expect(this.submitConfirmationDialog).toBeVisible({
      timeout: 10_000,
    });

    await expect(this.confirmYesButton).toBeVisible();
    await expect(this.confirmYesButton).toBeEnabled();

    await this.confirmYesButton.click();

    await expect(this.submitConfirmationDialog).toBeHidden({
      timeout: 10_000,
    });
  }
 //
  async clickSaveAndConitnue(): Promise<void> {
    await expect(this.saveAndContinueButton).toBeVisible();
    await expect(this.saveAndContinueButton).toBeEnabled();

    await this.saveAndContinueButton.click();
  }
  //Get reference number and message id after saving the manifest:
  async getReferenceNumber(): Promise<string> {
    return (await this.referenceNumber.textContent())?.trim() ?? '';
  }
  //Get reference number after saving the manifest as draft:
  async getReferenceNumberDraft(): Promise<string> {
    //no wait here previously meant a read could land before the div's text actually populated, silently
    //returning '' instead of the real reference number (surfaced by Firefox's slightly different timing,
    //but not actually browser-specific - it was always a race, just narrower on Chrome):
    await expect(this.referenceNumberBack).toBeVisible({ timeout: 15_000 });
    await expect(this.referenceNumberBack).not.toHaveText('', { timeout: 15_000 });

    return (await this.referenceNumberBack.textContent())?.trim() ?? '';
  }
  //assertion for success message after saving the manifest:
  async verifyManifestSubmittedSuccessfully(): Promise<void> {

    await expect(this.successMessage).toBeVisible();

    await expect(this.successMessage).toContainText('تم إرسال المانيفست');
  }

  //adds a master bill whose arrived bill has a delivered weight less than the master bill's total original weight (valid partial-arrival scenario):
  async addMasterBillWithPartialArrival(
    viewPage: ViewManifestPage,
    masterBillData: MasterBillData,
    billItemData: BillItemData,
    warehouseData: WarehouseData
  ) {
    const partialWeight = (
      parseFloat(masterBillData.totalOriginalWeight) / 2).toString();

    //the portal rejects the house bill unless the item's own quantity sums to this delivered quantity - must
    //match billItemData.itemQuantity (confirmed live, 2026-09-22: hardcoded '1' against a 100-quantity item
    //triggered "مجموع الكميات للأصناف داخل البوليصة الواصلة يجب أن يساوي 1"):
    const partialArrivalAirwayBillData: AirwayBillData = {
      deliveredWeight: partialWeight,
      deliveredQuantity: billItemData.itemQuantity,
      manifestType: '1',
    };

    const partialArrivalBillItemData: BillItemData = {
      ...billItemData,
      itemWeight: partialWeight,
    };

    return viewPage.addMasterBillWithHouseBill(
      masterBillData,
      partialArrivalAirwayBillData,
      partialArrivalBillItemData,
      warehouseData
    );
  }

  //creates a full manifest whose master bill uses "ترانزيت" (Transit) as bill type:
  async submitImportManifestWithOneCompletedTransitBill(
    viewPage: ViewManifestPage,
    data: NewImportManifestData,
    masterBillData: MasterBillData,
    airwayBillData: AirwayBillData,
    billItemData: BillItemData,
    warehouseData: WarehouseData
  ) {
    await this.clickAirServices();
    await this.clickAirImportManifest();
    await this.clickCreateAirImportManifest();

    await this.fillManifestForm(data);

    await this.clickSaveAndConitnue();

    const transitMasterBillData: MasterBillData = {
      ...masterBillData,
      billType: '3',
    };

    return viewPage.addMasterBillWithHouseBill(
      transitMasterBillData,
      airwayBillData,
      billItemData,
      warehouseData
    );
  }

  //creates a manifest with one complete Transit master bill + house bill, then leaves it as a draft (not
  //submitted) - same shape as saveMasterBillWithHouseBill() above, just with billType forced to '3' (ترانزيت):
  async saveImportManifestWithOneCompletedTransitBill(
    viewPage: ViewManifestPage,
    data: NewImportManifestData,
    masterBillData: MasterBillData,
    airwayBillData: AirwayBillData,
    billItemData: BillItemData,
    warehouseData: WarehouseData
  ): Promise<string> {
    await this.clickAirServices();
    await this.clickAirImportManifest();
    await this.clickCreateAirImportManifest();

    await this.fillManifestForm(data);

    await this.clickSaveAndConitnue();

    const transitMasterBillData: MasterBillData = {
      ...masterBillData,
      billType: '3',
    };

    return this.saveMasterBillWithHouseBill(
      viewPage,
      transitMasterBillData,
      airwayBillData,
      billItemData,
      warehouseData
    );
  }

  //creates a manifest with one complete master bill + house bill (item + warehouse), then leaves it as a draft
  //(not submitted) - addMasterBillWithHouseBill() always submits at the end, which is wrong for a flow that
  //still needs to view/edit the draft before submitting it itself (confirmed live, 2026-09-22: submitting here
  //then trying to edit later hits an already-submitted manifest, which has no direct "تعديل" button - only ECL
  //applies past that point). Same "السابق" x2 mechanism saveManifestWithMoreThanOneBill() below uses to reveal
  //the reference number afterward:
  async saveMasterBillWithHouseBill(
    viewPage: ViewManifestPage,
    masterBillData: MasterBillData,
    airwayBillData: AirwayBillData,
    billItemData: BillItemData,
    warehouseData: WarehouseData
  ): Promise<string> {
    await viewPage.createMasterBill(masterBillData);
    await viewPage.addHouseBill(airwayBillData, billItemData, warehouseData);

    await this.clickBackButton();
    await this.clickBackButton();

    return this.getReferenceNumberDraft();
  }

  //creates a manifest with two master bills, each with its own complete house bill (item + warehouse), then
  //SAVES it (not submitted) - mirrors submitManifestWithMoreThanOneBill()'s bill-creation steps exactly, but
  //there is no standalone "Save" button once bills have been added. Without clicking "السابق" at all, the
  //reference div stays hidden (confirmed live, 2026-09-21 - 15s of polling never saw it become visible), so the
  //clicks ARE load-bearing even though the visible bills-list content doesn't appear to change when clicked -
  //they likely just toggle an accordion/header section back open rather than navigate anywhere:
  async saveManifestWithMoreThanOneBill(
    viewPage: ViewManifestPage,
    data: NewImportManifestData,
    masterBillData: MasterBillData,
    airwayBillData: AirwayBillData,
    billItemData: BillItemData,
    warehouseData: WarehouseData
  ): Promise<string> {
    const dataWithTwoBills: NewImportManifestData = {
      ...data,
      totalNumberOfBills: '2',
    };

    await this.clickAirServices();
    await this.clickAirImportManifest();
    await this.clickCreateAirImportManifest();

    await this.fillManifestForm(dataWithTwoBills);

    await this.clickSaveAndConitnue();

    const secondMasterBillData: MasterBillData = {
      ...masterBillData,
      billNo: (parseInt(masterBillData.billNo, 10) + 1).toString(),
    };

    //create both master bills first:
    await viewPage.createTwoMasterBill(masterBillData);
    await viewPage.createMasterBill(secondMasterBillData);

    //then add a complete house bill for each:
    await viewPage.addHouseBill(airwayBillData, billItemData, warehouseData, masterBillData.billNo);
    await viewPage.addHouseBill(airwayBillData, billItemData, warehouseData, secondMasterBillData.billNo);

    await this.clickBackButton();
    await this.clickBackButton();

    return this.getReferenceNumberDraft();
  }

  //24- Submit Manifest With More Than One Bill:
  async submitManifestWithMoreThanOneBill(
    viewPage: ViewManifestPage,
    data: NewImportManifestData,
    masterBillData: MasterBillData,
    airwayBillData: AirwayBillData,
    billItemData: BillItemData,
    warehouseData: WarehouseData
  ) {
    const dataWithTwoBills: NewImportManifestData = {
      ...data,
      totalNumberOfBills: '2',
    };

    await this.clickAirServices();
    await this.clickAirImportManifest();
    await this.clickCreateAirImportManifest();
    await this.fillManifestForm(dataWithTwoBills);
    await this.clickSaveAndConitnue();

    const secondMasterBillData: MasterBillData = {
      ...masterBillData,
      billNo: (parseInt(masterBillData.billNo, 10) + 1).toString(),
    };

    //create both master bills first:
    await viewPage.createTwoMasterBill(masterBillData);
    await viewPage.createMasterBill(secondMasterBillData);

    //then add a house bill for each master bill:
    await viewPage.addHouseBill(airwayBillData, billItemData, warehouseData, masterBillData.billNo);
    await viewPage.addHouseBill(airwayBillData, billItemData, warehouseData, secondMasterBillData.billNo);

    return viewPage.submitManifest();
  }

  //same as submitManifestWithMoreThanOneBill(), but with three master bills instead of two:
  async submitManifestWithThreeBills(
    viewPage: ViewManifestPage,
    data: NewImportManifestData,
    masterBillData: MasterBillData,
    airwayBillData: AirwayBillData,
    billItemData: BillItemData,
    warehouseData: WarehouseData
  ) {
    const dataWithThreeBills: NewImportManifestData = {
      ...data,
      totalNumberOfBills: '3',
    };

    await this.clickAirServices();
    await this.clickAirImportManifest();
    await this.clickCreateAirImportManifest();
    await this.fillManifestForm(dataWithThreeBills);
    await this.clickSaveAndConitnue();

    const secondMasterBillData: MasterBillData = {
      ...masterBillData,
      billNo: (parseInt(masterBillData.billNo, 10) + 1).toString(),
    };
    const thirdMasterBillData: MasterBillData = {
      ...masterBillData,
      billNo: (parseInt(masterBillData.billNo, 10) + 2).toString(),
    };

    //create all three master bills first:
    await viewPage.createTwoMasterBill(masterBillData);
    await viewPage.createMasterBill(secondMasterBillData);
    await viewPage.createMasterBill(thirdMasterBillData);

    //then add a house bill for each master bill:
    await viewPage.addHouseBill(airwayBillData, billItemData, warehouseData, masterBillData.billNo);
    await viewPage.addHouseBill(airwayBillData, billItemData, warehouseData, secondMasterBillData.billNo);
    await viewPage.addHouseBill(airwayBillData, billItemData, warehouseData, thirdMasterBillData.billNo);

    return viewPage.submitManifest();
  }

  //fills the manifest header form selecting "البريد السريع" (Express Mail) as the shipping agent type:
  async fillManifestFormWithExpressMailAgent(
    data: NewImportManifestData
  ): Promise<void> {
    await this.fillTransportCompany(
      data.transportCompany
    );

    await this.fillFlightNumber(
      data.flightNumber
    );

    await this.fillLoadingCountry(
      data.loadingCountry
    );

    await this.fillLoadingPort(
      data.loadingPort
    );

    await this.fillDate(
      this.departureDateInput,
      data.departureDate
    );

    await this.fillDate(
      this.arrivalDateInput,
      data.arrivalDate
    );

    await this.fillDate(
      this.unloadingDateInput,
      data.unloadingDate
    );

    await this.totalNumberOfBillsInput.fill(
      data.totalNumberOfBills
    );

    const expressMailOption = this.shippingAgentTypeSelect.locator(
      'option',
      { hasText: 'البريد السريع' }
    );
    await expressMailOption.waitFor({ state: 'attached', timeout: 10_000 });

    await this.shippingAgentTypeSelect.selectOption({
      label: 'البريد السريع',
    });

    await this.selectFinalAirport(
      data.finalAirportText
    );
  }

  //creates a manifest with "البريد السريع" (Express Mail) as shipping agent type, filling only the header screen, saved as draft:
  async createManifestExpressDraft(
    data: NewImportManifestData
  ): Promise<string> {
    await this.clickAirServices();
    await this.clickAirImportManifest();
    await this.clickCreateAirImportManifest();

    await this.fillManifestFormWithExpressMailAgent(data);

    await this.clickSaveAndSubmitDraft();

    return this.getReferenceNumberDraft();
  }

  //creates an express-mail manifest with two master bills (each with its own house bill added) and submits it -
  //mirrors submitManifestWithMoreThanOneBill() but with "البريد السريع" as the shipping agent type instead of
  //the default:
  async submitExpressManifestWithTwoBills(
    viewPage: ViewManifestPage,
    data: NewImportManifestData,
    masterBillData: MasterBillData,
    airwayBillData: AirwayBillData,
    billItemData: BillItemData,
    warehouseData: WarehouseData
  ): Promise<{ submittedReferenceNumber: string; submittedMessageId: string }> {
    const dataWithTwoBills: NewImportManifestData = {
      ...data,
      totalNumberOfBills: '2',
    };

    await this.clickAirServices();
    await this.clickAirImportManifest();
    await this.clickCreateAirImportManifest();
    await this.fillManifestFormWithExpressMailAgent(dataWithTwoBills);
    await this.clickSaveAndConitnue();

    const secondMasterBillData: MasterBillData = {
      ...masterBillData,
      billNo: (parseInt(masterBillData.billNo, 10) + 1).toString(),
    };

    //create both master bills first:
    await viewPage.createTwoMasterBill(masterBillData);
    await viewPage.createMasterBill(secondMasterBillData);

    //then add a house bill for each master bill:
    await viewPage.addHouseBill(airwayBillData, billItemData, warehouseData, masterBillData.billNo);
    await viewPage.addHouseBill(
      airwayBillData,
      billItemData,
      warehouseData,
      secondMasterBillData.billNo
    );

    return viewPage.submitManifest();
  }
}
