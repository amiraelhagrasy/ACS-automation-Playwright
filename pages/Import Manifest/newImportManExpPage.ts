import { NewImportManPage, type NewImportManifestData } from './NewImportManPage';
import type {
  ViewImportManifestPage,
  MasterBillData,
  AirwayBillData,
  BillItemData,
  WarehouseData,
} from './viewImportManByRefPage';

//page object for scenarios specific to "البريد السريع" (Express Mail) manifests:
export class NewImportManExpPage extends NewImportManPage {

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
  //mirrors NewImportManPage.submitManifestWithMoreThanOneBill() but with "البريد السريع" as the shipping agent
  //type instead of the default.
  async submitExpressManifestWithTwoBills(
    viewImportManifestPage: ViewImportManifestPage,
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
    await viewImportManifestPage.createTwoMasterBill(masterBillData);
    await viewImportManifestPage.createMasterBill(secondMasterBillData);

    //then add a house bill for each master bill:
    await viewImportManifestPage.addHouseBill(airwayBillData, billItemData, warehouseData, masterBillData.billNo);
    await viewImportManifestPage.addHouseBill(
      airwayBillData,
      billItemData,
      warehouseData,
      secondMasterBillData.billNo
    );

    return viewImportManifestPage.submitManifest();
  }
}
