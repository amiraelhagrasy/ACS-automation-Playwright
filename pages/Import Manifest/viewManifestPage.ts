import { expect, Locator, Page } from '@playwright/test';
import { ModalComponent } from '../../components/ModalComponent';
import { AutocompleteInput } from '../../components/AutocompleteInput';

export type MasterBillData = {
    transportCompany: string;
    billNo: string;
    billDate: string;
    billType: string;
    billCategory: string;
    totalOriginalWeight: string;
    totalOriginalQuantity: string;
    ownerNameEn: string;
    ownerNameAr: string;
    calculationMethod: string;
    currency: string;
    transferFees: string;
    paymentMethod: string;
};

export type AirwayBillData = {
    deliveredWeight: string;
    deliveredQuantity: string;
    manifestType: string;
};

export type BillItemData = {
    packageType: string;
    itemWeight: string;
    itemQuantity: string;
    itemDescAr: string;
    itemDescEn: string;
};

export type WarehouseData = {
    warehouseCode: string;
    warehouseQuantity: string;
};

//manifest-type-agnostic base: everything Export, Transit, and Import ECL/create flows all legitimately need
//(view/search/status-polling, editing, master-bill CRUD, house-bill CRUD). Import-only manifest-creation
//specifics (header form, nav into "مانيفست الاستيراد الجوي", composite scenario helpers) live in NewImportManPage,
//which extends this:
export class ViewManifestPage {

  protected readonly page: Page;

  private readonly modal: ModalComponent;
  private readonly autocomplete: AutocompleteInput;

  constructor(page: Page) {
    this.page = page;
    this.modal = new ModalComponent(page);
    this.autocomplete = new AutocompleteInput(page);
  }

  //closes any blocking popup/dialog (e.g. license expiration warning) if present. Delegates to closeAllIfPresent()
  //rather than a single closeIfPresent(): confirmed live (2026-09-28) that the license-expiry warning and the
  //newer "الشروط والأحكام" terms popup can be stacked together right after a fresh login, and a single-shot close
  //either leaves the other one blocking the next click or - if it's the terms popup left on top - the accept
  //click keeps re-triggering it, since closeIfPresent() only ever acts on whichever modal is topmost at that one
  //instant:
  async closeBlockingModalIfPresent(): Promise<void> {
    return this.modal.closeAllIfPresent();
  }

  //closes every stacked "vx1 modal show" popup, one at a time. Some flows (e.g. the owner-info ECL edit form,
  //which is itself a modal) stack a second popup (e.g. a "تنبيه من فسح" success alert) on top of the first, and
  //closeBlockingModalIfPresent() alone can't cleanly handle that. See ModalComponent.closeAllIfPresent():
  async closeAllBlockingModals(): Promise<void> {
    return this.modal.closeAllIfPresent();
  }

  protected async selectAutocompleteOption(
    input: Locator,
    value: string
  ): Promise<void> {
    return this.autocomplete.select(input, value);
  }

  //for fields whose result list isn't filtered by the typed value (e.g. export manifest's "رقم وكيل الشحن"),
  //picking the first visible result instead of matching on text:
  protected async selectFirstAutocompleteOption(
    input: Locator,
    triggerText: string
  ): Promise<void> {
    return this.autocomplete.selectFirst(input, triggerText);
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

  async waitForPageIdle() {
      //best-effort: a slow-but-fine page (nprogress-busy lingering under load) shouldn't hard-fail the caller.
      await this.page
          .waitForFunction(
              () => !document.documentElement.classList.contains('nprogress-busy'),
              undefined,
              { timeout: 15000 }
          )
          .catch(() => {});

      await this.continueSessionIfPrompted();
  }

  //the portal's own session-timeout dialog ("انتهاء وقت الجلسة") can appear mid-test once the session's allotted
  //duration elapses, completely independent of any action the test just took - confirmed live, 2026-09-25: a
  //long-running test sat blocked behind it, retrying an unrelated click for the rest of its 20-minute budget,
  //until the test timeout force-closed the browser (which then cascade-failed every later test sharing that
  //same worker-scoped page). Checked from waitForPageIdle() (called before nearly every action) so it gets
  //dismissed as soon as it shows up, regardless of which step is running at the time:
  async continueSessionIfPrompted(): Promise<void> {
      const dialogVisible = await this.page
          .getByText('انتهاء وقت الجلسة')
          .isVisible()
          .catch(() => false);

      if (!dialogVisible) {
          return;
      }

      await this.page.getByRole('button', { name: 'نعم' }).click();
  }

  //types via page.keyboard rather than locator.pressSequentially(): this search field live-filters on every keystroke,
  //and pressSequentially() (which re-checks actionability on the same element handle between each character) hangs
  //indefinitely once the live filter's own re-render/network round-trip gets in its way. fill() avoids the hang but
  //only sets the value without firing the real keyup events the filter listens for, so it never actually filters.
  //page.keyboard.type() sends real per-character key events at the OS/CDP level without re-verifying a specific
  //locator between keystrokes, so it both triggers the filter and doesn't hang:
  async searchByReferenceNumber(referenceNumber: string) {
      const referenceInput = this.page.locator('input[test-attr="data-table-search-field"]');

      await this.waitForPageIdle();
      await referenceInput.click();
      await referenceInput.fill('');
      await this.page.keyboard.type(referenceNumber, { delay: 100 });
  }

  async verifyReferenceNumberDisplayed(referenceNumber: string) {
      await expect(this.page.locator(`text=${referenceNumber}`)).toBeVisible({ timeout: 15000 });
  }

  async openManifestByReferenceNumber(referenceNumber: string) {
      const row = this.page.locator('tbody tr').filter({
          has: this.page.locator(
              'td[test-attr^="shipping_agent_air_manifest_seq_no"]',
              { hasText: referenceNumber }
          ),
      });

      await this.waitForPageIdle();
      await row.click();
  }

  //reads the "الحالة" (Status) cell for a manifest row in the manifest list, given its reference number:
  async getManifestStatus(referenceNumber: string): Promise<string> {
      const row = this.page.locator('tbody tr').filter({
          has: this.page.locator(
              'td[test-attr^="shipping_agent_air_manifest_seq_no"]',
              { hasText: referenceNumber }
          ),
      });

      const statusCell = row.locator('td[test-attr^="shipping_agent_air_manifest_status"]');

      return (await statusCell.textContent())?.trim() ?? '';
  }

  //reads "رقم الجمرك" (customs number) from the manifest's own reference/summary view (the "مرجع" tab) - only
  //populated once the manifest has been processed by customs (e.g. reaches "تم استلامها"). Needed to look up a
  //completed transit bill from the Transit Manifest's "إضافة بوليصة شحن جوي للترانزيت" search dialog:
  async getCustomsNumber(): Promise<string> {
      const customsNoBlock = this.page.locator('div.col-md-3').filter({
          has: this.page.locator('label', { hasText: 'رقم الجمرك' }),
      });
      const customsNoValue = customsNoBlock.locator('span.lable-desc');

      //the block renders before its value does - wait for actual text rather than reading an empty span:
      await expect(customsNoValue).not.toHaveText('', { timeout: 15_000 });

      return (await customsNoValue.textContent())?.trim() ?? '';
  }

  //re-searches for the manifest and checks its status every intervalMs, until it matches expectedStatus or timeoutMs elapses.
  //returns true if the status was reached in time, false otherwise:
  async waitForManifestStatus(
      referenceNumber: string,
      expectedStatus: string,
      options: { intervalMs?: number; timeoutMs?: number } = {}
  ): Promise<boolean> {
      const intervalMs = options.intervalMs ?? 60_000;
      const timeoutMs = options.timeoutMs ?? 120_000;
      const deadline = Date.now() + timeoutMs;

      while (true) {
          await this.searchByReferenceNumber(referenceNumber);

          const currentStatus = await this.getManifestStatus(referenceNumber);
          console.log(`Manifest ${referenceNumber} status: ${currentStatus}`);

          if (currentStatus === expectedStatus) {
              return true;
          }

          if (Date.now() >= deadline) {
              return false;
          }

          await this.page.waitForTimeout(intervalMs);
      }
  }

  //wraps the common "navigate to the manifest list, poll until status, assert true" pattern repeated across
  //every spec file that waits for a manifest to reach a given status. navigate is whatever re-opens that list
  //for this flow - import/transit/export manifests each go through a different "New...ManPage" nav page object
  //and its own click...Manifest() method, so this takes a callback rather than a fixed method name, the same
  //way CreateNewEclPage.waitForEclStatus()'s refreshView callback does:
  async expectManifestStatus(
      navigate: () => Promise<void>,
      referenceNo: string,
      status: string,
      options: { intervalMs: number; timeoutMs: number }
  ): Promise<void> {
      await navigate();

      const reached = await this.waitForManifestStatus(referenceNo, status, options);

      expect(reached).toBe(true);
  }

  async clickEditButton() {
      const editButton = this.page.getByRole('button', { name: 'تعديل' });

      await this.waitForPageIdle();

      //same stray-modal-blocks-the-click issue clickAirImportManifest() had (confirmed live, 2026-09-22: this
      //hung the full test timeout waiting for a click that a leftover popup was intercepting):
      for (let attempt = 1; attempt <= 3; attempt++) {
          await this.closeBlockingModalIfPresent();

          const clicked = await editButton
              .click({ timeout: 15_000 })
              .then(() => true)
              .catch(() => false);

          if (clicked) {
              break;
          }
      }

      await this.page.waitForTimeout(3000);
  }

  //clicks "التفاصيل" on the last master bill row, to view its details (e.g. to visually confirm an ECL-driven
  //change like an owner-info update actually took effect):
  async clickMasterBillDetailsButton() {
      await this.waitForPageIdle();

      const masterBillRows = this.page
          .locator('tbody tr')
          .filter({
              has: this.page.locator('td[test-attr^="shipping_agent_master_bill_create_bill_no"]'),
          })
          .and(this.page.locator(':visible'));

      const detailsButton = masterBillRows.last().getByRole('button', { name: 'التفاصيل' });

      await detailsButton.click();
      await this.page.waitForTimeout(2000);
  }

  async clickEditOnMasterBillIfPresent() {
      await this.waitForPageIdle();

      const masterBillRows = this.page
          .locator('tbody tr')
          .filter({
              has: this.page.locator('td[test-attr^="shipping_agent_master_bill_create_bill_no"]'),
          })
          .and(this.page.locator(':visible'));

      const editButton = masterBillRows.last().getByRole('button', { name: 'تعديل' });

      const isPresent = await editButton
          .waitFor({ state: 'visible', timeout: 10000 })
          .then(() => true)
          .catch(() => false);

      if (!isPresent) {
          return;
      }

      await editButton.click();
      await this.page.waitForTimeout(2000);
  }

  //clicks "حذف" on the last master bill row, if present, and confirms the "هل أنت متأكد من تنفيذ عملية حذف؟"
  //dialog the app shows before actually deleting:
  async clickDeleteOnMasterBillIfPresent() {
      await this.waitForPageIdle();

      const masterBillRows = this.page
          .locator('tbody tr')
          .filter({
              has: this.page.locator('td[test-attr^="shipping_agent_master_bill_create_bill_no"]'),
          })
          .and(this.page.locator(':visible'));

      const deleteButton = masterBillRows.last().getByRole('button', { name: 'حذف' });

      const isPresent = await deleteButton
          .waitFor({ state: 'visible', timeout: 10000 })
          .then(() => true)
          .catch(() => false);

      if (!isPresent) {
          return;
      }

      await deleteButton.click();
      await this.confirmDeleteAlertIfPresent();
      //deleting shows a second, separate success alert that also needs closing:
      await this.closeVx1AlertIfPresent();
      await this.page.waitForTimeout(2000);
  }

  //confirms the "هل أنت متأكد من تنفيذ عملية حذف؟" dialog the app shows after clicking "حذف" (same "vx1" modal
  //styling used for other blocking popups like the license expiration warning) - the delete does not actually
  //happen until "نعم" is clicked:
  private async confirmDeleteAlertIfPresent() {
      return this.modal.confirmIfPresent('نعم');
  }

  //closes the follow-up "vx1" alert (e.g. a delete-success message) via its "إغلاق" button or close icon, if one appears:
  private async closeVx1AlertIfPresent() {
      return this.modal.closeIfPresent();
  }

  //clicks Edit on every master bill row and saves without changing any field:
  async editAndSaveAllMasterBills() {
      await this.waitForPageIdle();

      const masterBillRows = this.page
          .locator('tbody tr')
          .filter({
              has: this.page.locator('td[test-attr^="shipping_agent_master_bill_create_bill_no"]'),
          })
          .and(this.page.locator(':visible'));

      const masterBillRowsCount = await masterBillRows.count();

      for (let i = 0; i < masterBillRowsCount; i++) {
          const editButton = masterBillRows.nth(i).getByRole('button', { name: 'تعديل' });

          await editButton.click();
          await this.clickSaveAndContinueButton();
          await this.clickSubmitButton();
          await this.waitForPageIdle();
      }
  }

  async clickEditOnArrivedBill() {
      await this.waitForPageIdle();

      const editButton = this.page
          .locator('button[test-attr="shipping_agent_general_edit"], button:has-text("تعديل")')
          .and(this.page.locator(':visible'))
          .last();

      await editButton.scrollIntoViewIfNeeded();
      await editButton.click({ timeout: 15000 });
      await this.page.waitForTimeout(2000);
  }

  //clicks "حذف" on the last visible arrived/house bill row, if present, and confirms the same "هل أنت متأكد من
  //تنفيذ عملية حذف؟" dialog + follow-up success alert used for master bill deletion:
  async clickDeleteOnArrivedBillIfPresent() {
      await this.waitForPageIdle();

      const deleteButton = this.page
          .locator('button[test-attr="delete"], button:has-text("حذف")')
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
      await this.confirmDeleteAlertIfPresent();
      await this.closeVx1AlertIfPresent();
      await this.page.waitForTimeout(2000);
  }

  async getArrivedBillsCount(): Promise<number> {
      const totalArrivedBillsDiv = this.page.locator('[id^="totalMbills"]');
      const countText = await totalArrivedBillsDiv.locator('.count').textContent();

      return parseInt(countText?.trim() ?? '0', 10);
  }

  async openAllArrivedBillsDetails() {
      const arrivedBillsCount = await this.getArrivedBillsCount();

      if (arrivedBillsCount === 0) {
          return;
      }

      const detailsButtons = this.page.getByRole('button', { name: 'التفاصيل' });
      const detailsButtonsCount = await detailsButtons.count();

      for (let i = 0; i < detailsButtonsCount; i++) {
          await detailsButtons.nth(i).click();

          const detailsModal = this.page.locator('.modal.show');
          await expect(detailsModal).toBeVisible({ timeout: 10000 });
          await this.page.waitForTimeout(2000);

          await detailsModal.getByRole('button', { name: 'إغلاق' }).click();
          await expect(detailsModal).toBeHidden({ timeout: 10000 });
      }

      const billsTab = this.page.locator('#bills-tab');
      await this.waitForPageIdle();
      await billsTab.click();
      await this.page.waitForTimeout(2000);

      const billsViewDetailsButtons = this.page
          .locator('#bills-view')
          .getByRole('button', { name: 'التفاصيل' });
      const billsViewDetailsButtonsCount = await billsViewDetailsButtons.count();

      for (let i = 0; i < billsViewDetailsButtonsCount; i++) {
          await billsViewDetailsButtons.nth(i).click();

          const detailsModal = this.page.locator('.modal.show');
          await expect(detailsModal).toBeVisible({ timeout: 10000 });
          await this.page.waitForTimeout(2000);

          await detailsModal.getByRole('button', { name: 'إغلاق' }).click();
          await expect(detailsModal).toBeHidden({ timeout: 10000 });
      }
  }

  //clicks "بوالص الشحن للخط الجوي" (house/arrived bills) tab:
  async clickBillsTab() {
      const billsTab = this.page.locator('#bills-tab');
      await this.waitForPageIdle();
      await billsTab.click();
      await this.page.waitForTimeout(2000);
  }

  //opens the last house bill's "التفاصيل" modal (e.g. to verify a warehouse-code change took effect) and
  //leaves it open rather than auto-closing it, unlike openAllArrivedBillsDetails():
  async openHouseBillDetails() {
      await this.waitForPageIdle();

      const detailsButton = this.page
          .locator('#bills-view')
          .getByRole('button', { name: 'التفاصيل' })
          .last();

      await detailsButton.click();

      const detailsModal = this.page.locator('.modal.show').last();
      await expect(detailsModal).toBeVisible({ timeout: 10000 });
      await this.page.waitForTimeout(2000);
  }

  //clicks "المستودعات" (warehouses) tab within the currently open house bill details modal:
  async clickWarehouseTabInDetails() {
      const modal = this.page.locator('.modal.show').last();
      const warehouseTab = modal.locator('#warehouse-tab');

      await warehouseTab.click();
      await this.page.waitForTimeout(1500);
  }

  async clickHistoryTab() {
      const historyTab = this.page.locator('#history-tab');
      await this.waitForPageIdle();
      await historyTab.click();
      await this.page.waitForTimeout(2000);
  }

  async clickEclHistoryTab() {
      const eclHistoryTab = this.page.locator('#ecl-history-tab');
      await this.waitForPageIdle();
      await eclHistoryTab.click();
      await this.page.waitForTimeout(2000);
  }

  //clicks "التفاصيل" on the last (most recent) row of the "تاريخ الوثائق" (Document History) tab opened via
  //clickHistoryTab() - opens the "إستعراض تاريخ الوثائق" modal, which for a rejected submission includes the
  //rejection reason (e.g. "عدد الطرود المرسلة أكبر من عدد الطرود المتبقية للترانزيت") in its records table.
  //Leaves the modal open, same as openHouseBillDetails():
  async clickHistoryDetailsButton() {
      await this.waitForPageIdle();

      const detailsButton = this.page.getByRole('button', { name: 'التفاصيل' }).last();

      await expect(detailsButton).toBeVisible({ timeout: 15000 });
      await detailsButton.click();

      const detailsModal = this.page.locator('.modal.show').last();
      await expect(detailsModal).toBeVisible({ timeout: 10000 });
      await this.page.waitForTimeout(1500);
  }

  private async getActiveFormScope(): Promise<Locator> {
      const openModal = this.page.locator('.modal.show').last();

      if (await openModal.count() > 0) {
          return openModal;
      }

      return this.page.locator('body');
  }

  async clickSaveAndContinueButton() {
      const scope = await this.getActiveFormScope();

      const saveAndContinueButton = scope
          .locator('button[data-i18n="nextButtonText"]')
          .and(this.page.locator(':visible'))
          .last();

      await this.waitForPageIdle();
      await saveAndContinueButton.click();

      //the portal blocks the step transition with a ".fasah-alert-danger" popup (e.g. "الرجاء اضافة صنف واحد على
      //الأقل لهذه البوليصة الواصلة" when the item/warehouse grid feeding this step is still empty) instead of an
      //inline validation message - confirmed live, 2026-09-24. Left unchecked, callers then spend their whole
      //test timeout retrying fill()s on a step the wizard never actually reached. .fasah-alert-danger (not the
      //generic "تنبيه من فسح" modal title, which success popups share too) is the same marker
      //amountExceededError uses in createNewTransit.ts to distinguish a real error from a success alert:
      const blockingAlert = this.page.locator('.fasah-alert-danger').and(this.page.locator(':visible'));
      const alertAppeared = await blockingAlert
          .first()
          .waitFor({ state: 'visible', timeout: 3_000 })
          .then(() => true)
          .catch(() => false);

      if (alertAppeared) {
          const alertText = (await this.page.locator('.fasah-alert-body').first().textContent().catch(() => '')) ?? '';
          throw new Error(`clickSaveAndContinueButton(): step transition blocked by a Fasah alert: ${alertText.replace(/\s+/g, ' ').trim()}`);
      }
  }

  async clickAddButton() {
      const addButton = this.page
          .getByRole('button', { name: 'إضافة' })
          .and(this.page.locator(':visible'));

      await this.waitForPageIdle();
      await this.closeBlockingModalIfPresent();
      await addButton.scrollIntoViewIfNeeded();

      //confirmed live, 2026-09-30: this click didn't always register - caught via screenshot still sitting on the
      //unchanged list view right after, leaving the caller's next step (clickCreateNewMasterBillTab) looking for
      //a tab that was never created. force:true alone doesn't retry on a genuine missed click, so verify and
      //retry here instead of leaving that to downstream callers:
      await addButton.click({ force: true, timeout: 15_000 });
  }

  async clickCreateNewMasterBillTab() {
      const createNewTab = this.page.locator('#master-bill-create-tab');

      await this.waitForPageIdle();

      //confirmed live, 2026-09-30: clickAddButton() right before this uses force:true with no verification the
      //click actually navigated to the add-bill view - a screenshot caught this still sitting on the master
      //bills LIST view (empty table, "لا يوجد بيانات") instead, so #master-bill-create-tab didn't exist yet and
      //the click just timed out. Retry with a real wait instead of a single unguarded click:
      await expect(createNewTab).toBeVisible({ timeout: 20_000 });
      await createNewTab.click();
  }

  async fillMasterBillNo(billNo: string) {
      const billNoInput = this.page
          .locator('input[test-attr^="shipping_agent_master_bill_create_bill_no"]')
          .last();

      await expect(billNoInput).toBeVisible({ timeout: 10000 });
      await billNoInput.fill(billNo);
  }

  async fillMasterBillWeight(weight: string) {
      const totalWeightInput = this.page
          .locator('input[test-attr^="shipping_agent_master_bill_create_total_original_weight"]')
          .last();

      await expect(totalWeightInput).toBeVisible({ timeout: 10000 });
      await totalWeightInput.fill(weight);
  }

  async fillMasterBillForm(data: MasterBillData) {
      const transportCompanyInput = this.page
          .locator('input[test-attr^="shipping_agent_air_manifest_create_transport_company_no"]')
          .last();
      await this.selectAutocompleteOption(transportCompanyInput, data.transportCompany);

      const billNoInput = this.page
          .locator('input[test-attr^="shipping_agent_master_bill_create_bill_no"]')
          .last();
      await billNoInput.fill(data.billNo);

      const billDateInput = this.page
          .locator('input.f-datepicker-input[test-attr^="shipping_agent_master_bill_create_bill_date"]')
          .last();
      await billDateInput.click();
      await billDateInput.fill(data.billDate);
      await billDateInput.press('Tab');

      const billTypeSelect = this.page
          .locator('select[test-attr^="shipping_agent_master_bill_create_bill_type"]')
          .last();
      await billTypeSelect.selectOption(data.billType);

      //destination country/port fields only appear for "ترانزيت" (Transit) bill type:
      const destinationCountryInput = this.page
          .locator('input[test-attr="shipping_agent_master_bill_create_destination_country"]')
          .last();
      const destinationFieldsVisible = await destinationCountryInput.isVisible().catch(() => false);

      if (destinationFieldsVisible) {
          //unlike every other autocomplete field this codebase handles via selectAutocompleteOption()'s
          //fill()-based AutocompleteInput.select(), this specific field's dropdown never populated for a
          //programmatic fill() (confirmed live, 2026-09-22, reproduced 2/2) - same live-filter-needs-real-
          //keystrokes issue searchByReferenceNumber() already works around with page.keyboard.type():
          await expect(destinationCountryInput).toBeVisible({ timeout: 10_000 });

          const egyptOption = this.page
              .locator('.autocomplete-result')
              .filter({ hasText: 'مصر' })
              .and(this.page.locator(':visible'))
              .first();

          //selecting the autocomplete result is itself flaky under load - confirmed live, 2026-09-24: the field
          //was still empty (with the portal's own required-field marker) after this exact sequence ran once, so
          //retry the whole type+select once before giving up:
          const selectEgypt = async () => {
              await destinationCountryInput.click();
              await destinationCountryInput.fill('');
              await this.page.keyboard.type('مصر', { delay: 100 });

              const optionAppeared = await egyptOption
                  .waitFor({ state: 'visible', timeout: 10_000 })
                  .then(() => true)
                  .catch(() => false);

              if (!optionAppeared) {
                  return false;
              }

              await egyptOption.click();

              return (await destinationCountryInput.inputValue().catch(() => '')).trim().length > 0;
          };

          if (!(await selectEgypt()) && !(await selectEgypt())) {
              throw new Error('fillMasterBillForm(): destination country autocomplete field stayed empty after 2 attempts');
          }

          //disabled in some contexts (e.g. adding a bill via an ECL) - likely auto-locked to a single value once
          //the destination country is chosen, so only select it when it's actually enabled:
          const destinationPortTypeSelect = this.page
              .locator('select[test-attr="shipping_agent_master_bill_create_destination_port_type"]')
              .last();
          const destinationPortTypeEnabled = await destinationPortTypeSelect.isEnabled().catch(() => false);

          if (destinationPortTypeEnabled) {
              await destinationPortTypeSelect.selectOption({ label: 'منفذ جوي' });
          }

          const destinationPortNoInput = this.page
              .locator('input[test-attr="shipping_agent_master_bill_create_destination_port_no"]')
              .last();
          const destinationPortNoEnabled = await destinationPortNoInput.isEnabled().catch(() => false);

          if (destinationPortNoEnabled) {
              await this.selectAutocompleteOption(destinationPortNoInput, 'القاهره');
          }
      }

      const billCategorySelect = this.page
          .locator('select[test-attr^="shipping_agent_master_bill_create_bill_category"]')
          .last();
      await billCategorySelect.selectOption(data.billCategory);

      const totalWeightInput = this.page
          .locator('input[test-attr^="shipping_agent_master_bill_create_total_original_weight"]')
          .last();
      await totalWeightInput.fill(data.totalOriginalWeight);

      const totalQuantityInput = this.page
          .locator('input[test-attr^="shipping_agent_master_bill_create_total_original_quantity"]')
          .last();
      await totalQuantityInput.fill(data.totalOriginalQuantity);

      //bill value and currency only appear for some shipping agent types (e.g. Express Mail):
      const billValueInput = this.page
          .locator('input[test-attr="shipping_agent_master_bill_create_bill_value"]')
          .last();
      const billValueVisible = await billValueInput.isVisible().catch(() => false);

      if (billValueVisible) {
          await billValueInput.fill('100');

          const billCurrencyInput = this.page
              .locator('input[test-attr="shipping_agent_master_bill_create_bill_curr"]')
              .last();
          await this.selectAutocompleteOption(billCurrencyInput, data.currency);
      }
  }

  async fillMasterBillDetailsForm(data: MasterBillData) {
      const ownerNameEnInput = this.page
          .locator('input[test-attr^="shipping_agent_master_bill_create_owner_name_en"]')
          .last();
      await ownerNameEnInput.fill(data.ownerNameEn);

      //required when adding a new master bill (e.g. via an ECL) - not always required on initial manifest creation,
      //but always fill it since it doesn't hurt when it's optional. Field only accepts non-Latin characters (pattern
      //rejects A-Za-z), so it must be a real Arabic value:
      const ownerNameArInput = this.page
          .locator('input[test-attr^="shipping_agent_master_bill_create_owner_name_ar"]')
          .last();
      const ownerNameArVisible = await ownerNameArInput.isVisible().catch(() => false);

      if (ownerNameArVisible) {
          await ownerNameArInput.fill(data.ownerNameAr);
      }

      //calculation method, currency, transfer fees and payment method don't appear for every bill type (e.g. Transit):
      const calculationMethodSelect = this.page
          .locator('select[test-attr^="shipping_agent_master_bill_create_calculation_method"]')
          .last();
      const calculationMethodVisible = await calculationMethodSelect.isVisible().catch(() => false);

      if (calculationMethodVisible) {
          await calculationMethodSelect.selectOption(data.calculationMethod);

          const currencyInput = this.page
              .locator('input[test-attr^="shipping_agent_master_bill_create_currency_no"]')
              .last();
          await this.selectAutocompleteOption(currencyInput, data.currency);

          const transferFeesInput = this.page
              .locator('input[test-attr^="shipping_agent_master_bill_create_transfer_fees"]')
              .last();
          await transferFeesInput.fill(data.transferFees);

          const paymentMethodSelect = this.page
              .locator('select[test-attr^="shipping_agent_master_bill_create_payment_method"]')
              .last();
          await paymentMethodSelect.selectOption(data.paymentMethod);
      }
  }

  //fills only "طريقة الدفع" (Payment Method), for contexts (like the ECL edit flow) where the other owner/details fields are disabled:
  async fillMasterBillPaymentMethod(paymentMethod: string) {
      const paymentMethodSelect = this.page
          .locator('select[test-attr^="shipping_agent_master_bill_create_payment_method"]')
          .last();

      await paymentMethodSelect.selectOption(paymentMethod);
  }

  //despite the name, this clicks تقديم الطلب (the final submit button, data-i18n="submitButtonText") -
  //kept as clickSubmitButton to match what it actually does everywhere it's used:
  async clickSubmitButton() {
      const modal = this.page.locator('.modal.show').last();
      const isModalOpen = (await modal.count()) > 0;
      const scope = isModalOpen ? modal : this.page.locator('body');

      const saveButton = scope
          .locator('button[data-i18n="submitButtonText"]')
          .and(this.page.locator(':visible'))
          .last();

      await this.waitForPageIdle();
      await saveButton.click();

      if (isModalOpen) {
          //check for a real validation rejection first - confirmed live, 2026-09-24: submitting a house bill
          //whose warehouse-quantity total didn't match its master bill's declared quantity left the modal open
          //because the portal rejected it, not because it needed an extra "إغلاق" click. Surfacing that message
          //directly is far more useful than the generic "modal still visible" error the blind close-and-retry
          //below would otherwise produce:
          const blockingAlert = this.page.locator('.fasah-alert-danger').and(this.page.locator(':visible'));
          const alertAppeared = await blockingAlert
              .first()
              .waitFor({ state: 'visible', timeout: 3_000 })
              .then(() => true)
              .catch(() => false);

          if (alertAppeared) {
              const alertText = (await this.page.locator('.fasah-alert-body').first().textContent().catch(() => '')) ?? '';
              throw new Error(`clickSubmitButton(): submit was rejected by a Fasah alert: ${alertText.replace(/\s+/g, ' ').trim()}`);
          }

          const closedOnItsOwn = await expect(modal)
              .toBeHidden({ timeout: 10_000 })
              .then(() => true)
              .catch(() => false);

          if (!closedOnItsOwn) {
              //some flows (e.g. editing a master bill's weight via ECL) don't auto-close on submit - the modal
              //stays open with its own explicit "إغلاق" button instead (confirmed live, 2026-09-24: the DOM
              //snapshot on failure still showed the same "إنشاء بوليصة شحن رئيسية" dialog, with "إغلاق" among
              //its buttons). closeBlockingModalIfPresent() prefers exactly that button:
              await this.closeBlockingModalIfPresent();
              await expect(modal).toBeHidden({ timeout: 10_000 });
          }
      }
  }

  async fillAirwayBillForm(data: AirwayBillData) {
      const deliveredWeightInput = this.page
          .locator('input[test-attr^="shipping_agent_bill_create_delivered_weight"]')
          .last();
      await deliveredWeightInput.fill(data.deliveredWeight);

      const deliveredQuantityInput = this.page
          .locator('input[test-attr^="shipping_agent_bill_create_delivered_quantity"]')
          .last();
      await deliveredQuantityInput.fill(data.deliveredQuantity);

      const manifestTypeSelect = this.page
          .locator('select[test-attr^="shipping_agent_bill_create_manifest_type"]')
          .last();
      await manifestTypeSelect.selectOption(data.manifestType);
  }

  async fillBillItemForm(data: BillItemData) {
      const packageTypeSelect = this.page
          .locator('select[test-attr^="shipping_agent_bill_create_itemandwarehouse_package_type"]')
          .last();
      await packageTypeSelect.selectOption(data.packageType);

      const itemWeightInput = this.page
          .locator('input[test-attr^="shipping_agent_bill_create_itemandwarehouse_weight"]')
          .last();
      await itemWeightInput.fill(data.itemWeight);

      const itemQuantityInput = this.page
          .locator('input[test-attr^="shipping_agent_bill_create_itemandwarehouse_quantity"]')
          .last();
      await itemQuantityInput.fill(data.itemQuantity);

      const itemDescArInput = this.page
          .locator('textarea[test-attr^="shipping_agent_bill_create_itemandwarehouse_desc_ar"]')
          .last();
      await itemDescArInput.fill(data.itemDescAr);

      const itemDescEnInput = this.page
          .locator('textarea[test-attr^="shipping_agent_bill_create_itemandwarehouse_desc_en"]')
          .last();
      await itemDescEnInput.fill(data.itemDescEn);
  }

  async fillWarehouseForm(data: WarehouseData) {
      const warehouseCodeInput = this.page
          .locator('input[test-attr^="shipping_agent_bill_create_itemandwarehouse_warehouse_code"]')
          .last();
      await warehouseCodeInput.fill(data.warehouseCode);

      const warehouseQuantityInput = this.page
          .locator('input[test-attr^="shipping_agent_bill_create_itemandwarehouse_warehouse_quantity"]')
          .last();
      await warehouseQuantityInput.fill(data.warehouseQuantity);
  }

  //clicks the "إضافة" button scoped to the #addAirwayBill wizard - commits whatever's currently filled in the
  //item/warehouse form above the grid, whether that's a brand new row or (after clickEditItemButton()/
  //clickEditWarehouseGridButton() re-populated the form) an edit to an existing one. Only one of the item-step's
  //or warehouse-step's "إضافة" buttons is ever visible at a time (the other's wizard-step tab isn't active):
  async clickAddAirwayBillModalButton() {
      const modalAddButton = this.page
          .locator('#addAirwayBill')
          .getByRole('button', { name: 'إضافة' })
          .and(this.page.locator(':visible'));

      //each committed item/warehouse row renders a <td test-attr="..._package_type_N"> / <td test-attr="
      //..._warehouse_code_N"> cell (confirmed live, 2026-09-25, via DevTools) - the "td" tag disambiguates these
      //from the form's own <select>/<input> that share the same test-attr prefix, so counting them reliably
      //detects whether the click below actually appended a new row (it doesn't always - confirmed live,
      //2026-09-25: adding a 2nd item/warehouse to the same bill silently left the grid with only 1 row, and the
      //portal only surfaced this later as a confusing quantity-sum validation error once the wizard moved on):
      const rowCellSelector =
          'td[test-attr^="shipping_agent_bill_create_itemandwarehouse_package_type_"], ' +
          'td[test-attr^="shipping_agent_bill_create_itemandwarehouse_warehouse_code_"]';

      const attemptAdd = async () => {
          const before = await this.page.locator(rowCellSelector).count();

          await this.waitForPageIdle();
          await modalAddButton.click();

          return this.page
              .waitForFunction(
                  ({ selector, expectedMin }) => document.querySelectorAll(selector).length > expectedMin,
                  { selector: rowCellSelector, expectedMin: before },
                  { timeout: 5_000 }
              )
              .then(() => true)
              .catch(() => false);
      };

      if (await attemptAdd()) {
          return;
      }

      //retry once before surfacing a clear failure instead of silently continuing with a short grid:
      if (await attemptAdd()) {
          return;
      }

      throw new Error('clickAddAirwayBillModalButton(): row was not added to the items/warehouses grid after 2 attempts');
  }

  //clicks "تعديل" on the last row of the items grid (#bill-items-grid) within the #addAirwayBill wizard - the
  //item form above re-populates with that row's existing values, ready to be refilled via fillBillItemForm() and
  //re-committed via clickAddAirwayBillModalButton():
  async clickEditItemButton() {
      const editButton = this.page
          .locator('#bill-items-grid')
          .getByRole('button', { name: 'تعديل' })
          .and(this.page.locator(':visible'))
          .last();

      await this.waitForPageIdle();
      await editButton.click();
  }

  //clicks "حذف" on the last row of the items grid (#bill-items-grid), confirming the usual delete dialog +
  //follow-up success alert:
  async clickDeleteItemButton() {
      const deleteButton = this.page
          .locator('#bill-items-grid')
          .getByRole('button', { name: 'حذف' })
          .and(this.page.locator(':visible'))
          .last();

      await this.waitForPageIdle();
      await deleteButton.click();
      await this.confirmDeleteAlertIfPresent();
      await this.closeVx1AlertIfPresent();
  }

  //clicks "تعديل" on the last row of the warehouse grid (#bill-warehouses-grid) within the #addAirwayBill wizard -

  async clickEditWarehouseGridButton() {
      const editButton = this.page
          .locator('#bill-warehouses-grid')
          .getByRole('button', { name: 'تعديل' })
          .and(this.page.locator(':visible'))
          .last();

      await this.waitForPageIdle();
      await editButton.click();
  }

  //clicks "حذف" on the last row of the warehouse grid (#bill-warehouses-grid):
  async clickDeleteWarehouseButton() {
      const deleteButton = this.page
          .locator('#bill-warehouses-grid')
          .getByRole('button', { name: 'حذف' })
          .and(this.page.locator(':visible'))
          .last();

      await this.waitForPageIdle();
      await deleteButton.click();
      await this.confirmDeleteAlertIfPresent();
      await this.closeVx1AlertIfPresent();
  }

  async addMasterBillWithHouseBill(
      masterBillData: MasterBillData,
      airwayBillData: AirwayBillData,
      billItemData: BillItemData,
      warehouseData: WarehouseData
  ) {
      await this.createMasterBill(masterBillData);
      await this.addHouseBill(airwayBillData, billItemData, warehouseData);

      return this.submitManifest();
  }

  //creates a new master bill (from the master bills list, opens the "create new" tab):
  async createMasterBill(masterBillData: MasterBillData) {
      //add new master bill:
      await this.clickAddButton();
      await this.clickCreateNewMasterBillTab();
      //Step1 Bill details:
      await this.fillMasterBillForm(masterBillData);
      await this.clickSaveAndContinueButton();
      //step2 owners details:
      await this.fillMasterBillDetailsForm(masterBillData);
      await this.clickSubmitButton();
      await this.clickSaveAndContinueButton();
  }

  //Create more than one master bill and submit the manifest:
  async createTwoMasterBill(masterBillData: MasterBillData) {
      //add new master bill:
      await this.clickAddButton();
      await this.clickCreateNewMasterBillTab();
      //Step1 Bill details:
      await this.fillMasterBillForm(masterBillData);
      await this.clickSaveAndContinueButton();
      //step2 owners details:
      await this.fillMasterBillDetailsForm(masterBillData);
      await this.clickSubmitButton();

  }
  //adds an arrived/house bill to a master bill (does not submit the manifest).
  //pass masterBillNo when more than one master bill exists, to pick that bill's own "إضافة" button:
  async addHouseBill(
      airwayBillData: AirwayBillData,
      billItemData: BillItemData,
      warehouseData: WarehouseData,
      masterBillNo?: string
  ) {
      //add new arrived bill:
      if (masterBillNo) {
          const scopedAddButton = this.page
              .getByLabel(`بوليصة الشحن الرئيسية رقم ${masterBillNo}`)
              .getByRole('button', { name: 'إضافة' })
              .and(this.page.locator(':visible'));

          await this.waitForPageIdle();
          await scopedAddButton.click();
      } else {
          await this.clickAddButton();
      }
      //Arrived bill step1: fill airway bill form
      await this.fillAirwayBillForm(airwayBillData);
      await this.clickSaveAndContinueButton();
      //Fill bill item form:
      await this.fillBillItemForm(billItemData);
      await this.clickAddAirwayBillModalButton();
      await this.clickSaveAndContinueButton();
      //Fill warehouse details form:
      await this.fillWarehouseForm(warehouseData);
      await this.clickAddAirwayBillModalButton();
      await this.clickSubmitButton();
  }

  //same as addHouseBill(), but adds two warehouse entries to the same house bill instead of one - each fill+add

  async addHouseBillWithTwoWarehouses(
      airwayBillData: AirwayBillData,
      billItemData: BillItemData,
      warehouseData1: WarehouseData,
      warehouseData2: WarehouseData,
      masterBillNo?: string
  ) {
      if (masterBillNo) {
          const scopedAddButton = this.page
              .getByLabel(`بوليصة الشحن الرئيسية رقم ${masterBillNo}`)
              .getByRole('button', { name: 'إضافة' })
              .and(this.page.locator(':visible'));

          await this.waitForPageIdle();
          await scopedAddButton.click();
      } else {
          await this.clickAddButton();
      }

      await this.fillAirwayBillForm(airwayBillData);
      await this.clickSaveAndContinueButton();
      await this.fillBillItemForm(billItemData);
      await this.clickAddAirwayBillModalButton();
      await this.clickSaveAndContinueButton();

      await this.fillWarehouseForm(warehouseData1);
      await this.clickAddAirwayBillModalButton();
      await this.fillWarehouseForm(warehouseData2);
      await this.clickAddAirwayBillModalButton();

      await this.clickSubmitButton();
  }

  //same as addHouseBill(), but adds two item entries and two warehouse entries to the same house bill instead of
  //one

  async addHouseBillWithTwoItems(
      airwayBillData: AirwayBillData,
      billItemData1: BillItemData,
      billItemData2: BillItemData,
      warehouseData1: WarehouseData,
      warehouseData2: WarehouseData,
      masterBillNo?: string
  ) {
      if (masterBillNo) {
          const scopedAddButton = this.page
              .getByLabel(`بوليصة الشحن الرئيسية رقم ${masterBillNo}`)
              .getByRole('button', { name: 'إضافة' })
              .and(this.page.locator(':visible'));

          await this.waitForPageIdle();
          await scopedAddButton.click();
      } else {
          await this.clickAddButton();
      }

      await this.fillAirwayBillForm(airwayBillData);
      await this.clickSaveAndContinueButton();
      await this.fillBillItemForm(billItemData1);
      await this.clickAddAirwayBillModalButton();
      await this.fillBillItemForm(billItemData2);
      await this.clickAddAirwayBillModalButton();
      await this.clickSaveAndContinueButton();

      await this.fillWarehouseForm(warehouseData1);
      await this.clickAddAirwayBillModalButton();
      await this.fillWarehouseForm(warehouseData2);
      await this.clickAddAirwayBillModalButton();
      await this.clickSubmitButton();
  }

  //adds an arrived/house bill to an already-created master bill and submits the whole manifest:
  async addHouseBillAndSubmit(
      airwayBillData: AirwayBillData,
      billItemData: BillItemData,
      warehouseData: WarehouseData
  ) {
      await this.addHouseBill(airwayBillData, billItemData, warehouseData);

      return this.submitManifest();
  }

  //submits the whole manifest request (after all master/house bills have been added) and returns the submitted reference number/message id:
  async submitManifest() {
      //the house bill just added completes its own wizard step instantly from the UI's perspective, but the
      //backend's save can still be settling server-side (its message-queue integration) when automation clicks
      //"تقديم الطلب" immediately after - confirmed live, 2026-09-22: 3/3 automated attempts hit "تنبيه من فسح:
      //all.cannot_connect_to_MQ" right at this submit, while a manual (slower) attempt right after succeeded.
      //A brief settle pause before the final submit click, not a longer wait ON it, addresses the actual gap:
      await this.waitForPageIdle();
      await this.page.waitForTimeout(3_000);

      //submit the whole manifest request:
      await this.clickSubmitButton();

      //verify submission success and get reference number:
      await this.verifyManifestSubmittedWithBillsSuccessfully();

      const submittedReferenceNumber = await this.getSubmittedReferenceNumber();
      const submittedMessageId = await this.getSubmittedMessageId();

      console.log(`Submitted Reference Number: ${submittedReferenceNumber}`);
      console.log(`Submitted Message Id: ${submittedMessageId}`);

      return { submittedReferenceNumber, submittedMessageId };
  }

  //distinct from verifyManifestSubmittedSuccessfully() (NewImportManPage): that one checks the plain "تم إرسال
  //المانيفست" text shown right after clickSaveAndSubmit()'s immediate zero-bill submit flow, while this checks the
  //".fasah-alert-body" success alert shown after submitManifest()'s bills-already-added submit flow. Renamed on
  //merge (both classes originally had their own same-named method) to keep both call sites intact:
  async verifyManifestSubmittedWithBillsSuccessfully() {
      const successMessage = this.page.locator('.fasah-alert-body').filter({
          hasText: 'تم إرسال المانيفست',
      });

      await expect(successMessage).toBeVisible({ timeout: 15000 });
  }

  async getSubmittedReferenceNumber(): Promise<string> {
      const successMessage = this.page.locator('.fasah-alert-body').filter({
          hasText: 'تم إرسال المانيفست',
      });

      return (await successMessage.locator('strong').nth(0).textContent())?.trim() ?? '';
  }

  async getSubmittedMessageId(): Promise<string> {
      const successMessage = this.page.locator('.fasah-alert-body').filter({
          hasText: 'تم إرسال المانيفست',
      });

      return (await successMessage.locator('strong').nth(1).textContent())?.trim() ?? '';
  }
}
