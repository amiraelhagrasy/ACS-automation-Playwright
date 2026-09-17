import { expect, Locator, Page } from '@playwright/test';
import {
  ViewImportManifestPage,
  MasterBillData,
  AirwayBillData,
  BillItemData,
  WarehouseData,
} from './viewImportManByRefPage';
import { ModalComponent } from '../../components/ModalComponent';
import { AutocompleteInput } from '../../components/AutocompleteInput';

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

export class NewImportManPage {

  private readonly page: Page;
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

  private readonly modal: ModalComponent;
  private readonly autocomplete: AutocompleteInput;

  constructor(page: Page) {
    this.page = page;
    this.modal = new ModalComponent(page);
    this.autocomplete = new AutocompleteInput(page);
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
    this.backButton = page.getByRole('button', {name: 'السابق',exact: true});
    this.referenceNumberBack = page.locator('div.text-gray').first();
  }

  //closes any blocking popup/dialog (e.g. license expiration warning) if present:
  async closeBlockingModalIfPresent(): Promise<void> {
    return this.modal.closeIfPresent();
  }

  //closes every stacked "vx1 modal show" popup, one at a time. Some flows (e.g. the owner-info ECL edit form,
  //which is itself a modal) stack a second popup (e.g. a "تنبيه من فسح" success alert) on top of the first, and
  //closeBlockingModalIfPresent() alone can't cleanly handle that. See ModalComponent.closeAllIfPresent():
  async closeAllBlockingModals(): Promise<void> {
    return this.modal.closeAllIfPresent();
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
    await this.airServicesMenu.click();
  }
}
  //click on Air Import Manifest menu:
  async clickAirImportManifest(): Promise<void> {

    await expect(this.airImportManifestMenu).toBeVisible();

    await expect(this.airImportManifestMenu).toBeEnabled();

    await this.airImportManifestMenu.click();
  }
  //click on Create Air Import Manifest button:
  async clickCreateAirImportManifest(): Promise<void> {
    await expect(this.createAirImportManifestButton).toBeVisible({
      timeout: 15_000,
    });

    await expect(this.createAirImportManifestButton).toBeEnabled();

    await this.createAirImportManifestButton.click();
  }
  //Fill the form of new import manifest step 1:
  private async selectAutocompleteOption(
    input: Locator,
    value: string
  ): Promise<void> {
    return this.autocomplete.select(input, value);
  }

  protected async fillDate(
    input: Locator,
    date: string
  ): Promise<void> {
    await expect(input).toBeVisible();

    await input.click();
    await input.fill(date);
    await input.press('Tab');
  }

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
    return (await this.referenceNumberBack.textContent())?.trim() ?? '';
  }
  //assertion for success message after saving the manifest:
  async verifyManifestSubmittedSuccessfully(): Promise<void> {

    await expect(this.successMessage).toBeVisible();

    await expect(this.successMessage).toContainText('تم إرسال المانيفست');
  }

  //adds a master bill whose arrived bill has a delivered weight less than the master bill's total original weight (valid partial-arrival scenario):
  async addMasterBillWithPartialArrival(
    viewImportManifestPage: ViewImportManifestPage,
    masterBillData: MasterBillData,
    billItemData: BillItemData,
    warehouseData: WarehouseData
  ) {
    const partialWeight = (
      parseFloat(masterBillData.totalOriginalWeight) / 2
    ).toString();

    const partialArrivalAirwayBillData: AirwayBillData = {
      deliveredWeight: partialWeight,
      deliveredQuantity: '1',
      manifestType: '1',
    };

    const partialArrivalBillItemData: BillItemData = {
      ...billItemData,
      itemWeight: partialWeight,
    };

    return viewImportManifestPage.addMasterBillWithHouseBill(
      masterBillData,
      partialArrivalAirwayBillData,
      partialArrivalBillItemData,
      warehouseData
    );
  }

  //creates a full manifest whose master bill uses "ترانزيت" (Transit) as bill type:
  async submitImportManifestWithOneCompletedTransitBill(
    viewImportManifestPage: ViewImportManifestPage,
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

    return viewImportManifestPage.addMasterBillWithHouseBill(
      transitMasterBillData,
      airwayBillData,
      billItemData,
      warehouseData
    );
  }

  //creates a manifest and completes only its master bill (Transit bill type), without adding a house bill or submitting the manifest:
  async saveImportManifestWithOneCompletedTransitBill(
    viewImportManifestPage: ViewImportManifestPage,
    data: NewImportManifestData,
    masterBillData: MasterBillData
  ): Promise<string> {
    await this.clickAirServices();
    await this.clickAirImportManifest();
    await this.clickCreateAirImportManifest();

    await this.fillManifestForm(data);

    await this.clickSaveAndConitnue();

    const referenceNo = await this.getReferenceNumberDraft();

    const transitMasterBillData: MasterBillData = {
      ...masterBillData,
      billType: '3',
    };

    await viewImportManifestPage.clickAddButton();
    await viewImportManifestPage.clickCreateNewMasterBillTab();
    await viewImportManifestPage.fillMasterBillForm(transitMasterBillData);
    await viewImportManifestPage.clickSaveAndContinueButton();
    await viewImportManifestPage.fillMasterBillDetailsForm(transitMasterBillData);
    await viewImportManifestPage.clickSaveButton();
    await viewImportManifestPage.clickSaveAndContinueButton();

    return referenceNo;
  }

  //creates a manifest with two master bills, without adding house bills or submitting the manifest:
  async saveManifestWithMoreThanOneBill(
    viewImportManifestPage: ViewImportManifestPage,
    data: NewImportManifestData,
    masterBillData: MasterBillData
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

    const referenceNo = await this.getReferenceNumberDraft();

    const secondMasterBillData: MasterBillData = {
      ...masterBillData,
      billNo: (parseInt(masterBillData.billNo, 10) + 1).toString(),
    };

    await viewImportManifestPage.createTwoMasterBill(masterBillData);
    await viewImportManifestPage.createMasterBill(secondMasterBillData);

    return referenceNo;
  }

  //24- Submit Manifest With More Than One Bill:
  async submitManifestWithMoreThanOneBill(
    viewImportManifestPage: ViewImportManifestPage,
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
    await viewImportManifestPage.createTwoMasterBill(masterBillData);
    await viewImportManifestPage.createMasterBill(secondMasterBillData);

    //then add a house bill for each master bill:
    await viewImportManifestPage.addHouseBill(airwayBillData, billItemData, warehouseData, masterBillData.billNo);
    await viewImportManifestPage.addHouseBill(airwayBillData, billItemData, warehouseData, secondMasterBillData.billNo);

    return viewImportManifestPage.submitManifest();
  }

  //same as submitManifestWithMoreThanOneBill(), but with three master bills instead of two:
  async submitManifestWithThreeBills(
    viewImportManifestPage: ViewImportManifestPage,
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
    await viewImportManifestPage.createTwoMasterBill(masterBillData);
    await viewImportManifestPage.createMasterBill(secondMasterBillData);
    await viewImportManifestPage.createMasterBill(thirdMasterBillData);

    //then add a house bill for each master bill:
    await viewImportManifestPage.addHouseBill(airwayBillData, billItemData, warehouseData, masterBillData.billNo);
    await viewImportManifestPage.addHouseBill(airwayBillData, billItemData, warehouseData, secondMasterBillData.billNo);
    await viewImportManifestPage.addHouseBill(airwayBillData, billItemData, warehouseData, thirdMasterBillData.billNo);

    return viewImportManifestPage.submitManifest();
  }
}