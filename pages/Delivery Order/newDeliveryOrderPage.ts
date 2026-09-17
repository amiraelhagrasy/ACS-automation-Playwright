import { expect, Locator, Page } from '@playwright/test';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { ModalComponent } from '../../components/ModalComponent';

export type DeliveryOrderData = {
  finalPort: string;
  receiverName: string;
  receiverId: string;
};

function getTodayDateIso(): string {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export class NewDeliveryOrderPage {
  private readonly page: Page;
  private readonly autocomplete: AutocompleteInput;
  private readonly modal: ModalComponent;

  private readonly airServicesMenu: Locator;
  private readonly deliveryOrderMenu: Locator;
  private readonly createDeliveryOrderButton: Locator;

  //"معلومات المانفيست" (manifest information) section - carrier selection unlocks the bill number field, filling
  //it and blurring populates تاريخ بوليصة الشحن with that bill's own date(s), and selecting a date from there is
  //what auto-fills رقم وثيقة المانفيست المرجعي with the matching manifest reference (confirmed live - none of this
  //is guessable from the DOM alone, each step only unlocks/populates the next once the previous one is done):
  private readonly finalPortSelect: Locator;
  private readonly carrierPrefixInput: Locator;
  private readonly billNumberInput: Locator;
  private readonly billDateSelect: Locator;
  private readonly manifestRefSelect: Locator;
  private readonly receiverNameInput: Locator;
  private readonly receiverIdInput: Locator;
  //optional - selecting an importer here overrides اسم المالك بالعربي with that importer's own registered name
  //(confirmed live: filling "2" replaced the master bill's owner name with the importer's):
  private readonly importerNoInput: Locator;
  //checking this unlocks the وسيط الشحن (freight forwarder) autocomplete below, otherwise disabled:
  private readonly referToFreightForwarderCheckbox: Locator;
  private readonly freightForwarderInput: Locator;

  private readonly saveButton: Locator;
  private readonly submitButton: Locator;
  //only present once an existing (draft) delivery order has been opened - reopens it as an editable form, which
  //is where تقديم الطلب actually becomes available for a previously-saved draft:
  private readonly editButton: Locator;
  //only present on an already-accepted (مقبول) delivery order's detail view - shows a "هل تريد الغاء اذن التسليم
  //الجوي؟" confirm dialog (same "vx1 modal show" pattern used elsewhere, so ModalComponent.confirmIfPresent()
  //handles it):
  private readonly cancelButton: Locator;
  //also only present on an accepted delivery order's detail view. Confirmed live: طباعة doesn't open a new tab or
  //block the page; تحميل fires a real Playwright "download" event with a PDF (e.g. "DEO-<refNo>.pdf"):
  private readonly printButton: Locator;
  private readonly downloadButton: Locator;

  //same live-filter search field the rest of the app's list pages use (see
  //ViewImportManifestPage.searchByReferenceNumber()):
  private readonly searchInput: Locator;

  //"تاريخ الوثائق" (Document History) tab on a delivery order's detail view - same #history-tab id/pattern as the
  //manifest detail views (see ViewImportManifestPage.clickHistoryTab()):
  private readonly historyTab: Locator;
  //shows a rejection's error/remarks in an "إستعراض تاريخ الوثائق" modal - same pattern as
  //ViewImportManifestPage.clickHistoryDetailsButton():
  private readonly historyDetailsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.autocomplete = new AutocompleteInput(page);
    this.modal = new ModalComponent(page);

    this.airServicesMenu = page.getByText('خدمات الطيران');
    this.deliveryOrderMenu = page.locator('[package="SHIPPING_AGENT_SearchDelevryOrder"]');
    this.createDeliveryOrderButton = page.getByRole('button', { name: 'إنشاء إذن تسليم جوي', exact: true });

    //the portal started suffixing this test-attr with a number (e.g. shipping_agent_final_port_name_10), so
    //match on the prefix. Scoped to :visible + .last() in case a stale copy lingers in the DOM.
    this.finalPortSelect = page
      .locator('select[test-attr^="shipping_agent_final_port_name"]')
      .and(page.locator(':visible'))
      .last();
    this.carrierPrefixInput = page.locator('input[test-attr="shipping_agent_manifest_labels_carrierprefixno"]');
    this.billNumberInput = page.locator('input[test-attr="shipping_agent_manifest_labels_billnumber"]');
    this.billDateSelect = page.locator('select[test-attr="shipping_agent_manifest_labels_bill_date"]');
    this.manifestRefSelect = page.locator('select[test-attr="shipping_agent_manifest_labels_mafdocrefno"]');
    this.receiverNameInput = page.locator('input[test-attr="shipping_agent_manifest_labels_receivername"]');
    this.receiverIdInput = page.locator('input[test-attr="shipping_agent_manifest_labels_receiverid"]');
    this.importerNoInput = page.locator('input[test-attr="shipping_agent_manifest_labels_importer_no"]');
    //matched by its <label for="..."> rather than a raw CSS id selector - the real id is a literal Arabic string
    //with spaces/"؟", which isn't valid unescaped in a CSS id selector:
    this.referToFreightForwarderCheckbox = page.getByLabel('إحالة إلى وسيط شحن معين؟', { exact: true });
    this.freightForwarderInput = page.locator('input[test-attr="shipping_agent_freight_forwarder_ff_name"]');

    //scoped to :visible().last(): a prior screen's buttons (e.g. the list's "تعديل"/detail view's own buttons)
    //can stay behind in the DOM hidden rather than removed when navigating between these SPA views (same pattern
    //documented in createNewTransit.ts), so an unscoped role locator risks resolving to a stale, disconnected
    //button instead of the one actually on screen - confirmed live: submitting a reopened draft silently landed
    //on such a stale "تقديم الطلب" and never actually submitted (status stayed "مسودة"):
    this.saveButton = page.getByRole('button', { name: 'حفظ', exact: true }).and(page.locator(':visible')).last();
    this.submitButton = page
      .getByRole('button', { name: 'تقديم الطلب', exact: true })
      .and(page.locator(':visible'))
      .last();
    this.editButton = page.getByRole('button', { name: 'تعديل', exact: true }).and(page.locator(':visible')).last();
    this.cancelButton = page
      .getByRole('button', { name: 'إلغاء إذن التسليم', exact: true })
      .and(page.locator(':visible'))
      .last();
    this.printButton = page.getByRole('button', { name: 'طباعة', exact: true }).and(page.locator(':visible')).last();
    this.downloadButton = page.getByRole('button', { name: 'تحميل', exact: true }).and(page.locator(':visible')).last();

    //scoped to :visible: a detail view's own "تاريخ الوثائق" tab has an identical search field, which stays in the
    //DOM (hidden) after navigating back to the main list, causing a strict-mode violation (2 matches) on the
    //unscoped locator - confirmed live:
    this.searchInput = page.locator('input[test-attr="data-table-search-field"]').and(page.locator(':visible')).last();

    this.historyTab = page.locator('#history-tab');
    this.historyDetailsButton = page.getByRole('button', { name: 'التفاصيل' }).and(page.locator(':visible')).last();
  }

  //closes any blocking popup (e.g. a leftover success toast from a prior حفظ/تقديم الطلب) if present:
  async closeBlockingModalIfPresent(): Promise<void> {
    return this.modal.closeIfPresent();
  }

  //waits for the "nprogress-busy" class (set while an XHR/route transition is in flight) to clear, same idiom
  //ViewImportManifestPage uses. Needed between these SPA views (list -> detail -> edit) - confirmed live that
  //acting immediately (relying on Playwright's own actionability wait alone) can land a click on a stale element
  //left over from the previous view before the new one has actually finished swapping in, e.g. a تقديم الطلب click
  //that visibly "succeeds" but never actually calls the submit API:
  async waitForPageIdle(): Promise<void> {
    await this.page
      .waitForFunction(() => !document.documentElement.classList.contains('nprogress-busy'), undefined, {
        timeout: 15_000,
      })
      .catch(() => {});
  }

  async clickAirServices(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.closeBlockingModalIfPresent();
    await expect(this.airServicesMenu).toBeVisible({ timeout: 20_000 });

    //the submenu is a toggle - clicking it unconditionally would collapse it if a prior step already left it open
    //(e.g. coming straight from the import manifest flow), hiding deliveryOrderMenu instead of revealing it:
    const menuAlreadyOpen = await this.deliveryOrderMenu.isVisible().catch(() => false);

    if (!menuAlreadyOpen) {
      await this.airServicesMenu.click();
    }
  }

  async clickAirDeliveryOrderMenu(): Promise<void> {
    await expect(this.deliveryOrderMenu).toBeVisible({ timeout: 15_000 });
    await this.deliveryOrderMenu.click();
  }

  async clickCreateDeliveryOrderButton(): Promise<void> {
    await expect(this.createDeliveryOrderButton).toBeVisible({ timeout: 15_000 });
    await this.createDeliveryOrderButton.click();
  }

  async selectFinalPort(finalPort: string): Promise<void> {
    //the create form renders a beat after clickCreateDeliveryOrderButton()'s navigation - wait for the page's
    //in-flight XHR/transition to settle first so this isn't racing the form's own render. Under load the select
    //can still take well over 15s to mount (same post-navigation render lag AutocompleteInput's wait was
    //widened to 25s for), so give it 30s.
    await this.waitForPageIdle();
    await expect(this.finalPortSelect).toBeVisible({ timeout: 30_000 });
    await this.finalPortSelect.selectOption({ label: finalPort });
  }

  async fillCarrierPrefix(transportCompany: string): Promise<void> {
    await this.autocomplete.select(this.carrierPrefixInput, transportCompany);
  }

  //only enabled once the carrier above has been selected - blurring (Tab) after filling is what triggers the site
  //to look the bill up and populate تاريخ بوليصة الشحن:
  async fillBillNumber(billNo: string): Promise<void> {
    await expect(this.billNumberInput).toBeEnabled({ timeout: 10_000 });
    await this.billNumberInput.fill(billNo);
    await this.billNumberInput.press('Tab');
  }

  //selects the bill's date from the dropdown fillBillNumber() populated - a freshly-created bill only ever has
  //today's date as an option. Selecting it is what auto-fills رقم وثيقة المانفيست المرجعي:
  async selectBillDate(): Promise<void> {
    const today = getTodayDateIso();

    await expect(this.billDateSelect.locator('option', { hasText: today })).toHaveCount(1, { timeout: 15_000 });
    await this.billDateSelect.selectOption({ label: today });
  }

  //confirms رقم وثيقة المانفيست المرجعي auto-filled with the expected import manifest's reference number, after
  //selectBillDate() above:
  async waitForManifestRefAutoFill(expectedReferenceNo: string): Promise<void> {
    await expect(this.manifestRefSelect.locator('option', { hasText: expectedReferenceNo })).toHaveCount(1, {
      timeout: 15_000,
    });
  }

  async fillReceiverName(receiverName: string): Promise<void> {
    await this.receiverNameInput.fill(receiverName);
  }

  async fillReceiverId(receiverId: string): Promise<void> {
    await this.receiverIdInput.fill(receiverId);
  }

  //optional - selecting an importer here overrides اسم المالك بالعربي with that importer's own registered name.
  //NOT called by fillDeliveryOrderForm() below: confirmed live that whichever option is clicked, the field's real
  //submitted value is always "2" regardless (the dropdown's other entries are cosmetic display text with no real
  //backing id), and "2" itself gets rejected once processed by customs ("IMPORTER NUMBER NOT FOUND: 2") - this
  //account has no importer number that actually works through this UI, so the field is better left untouched
  //(اسم المالك بالعربي then falls back to the master bill's own owner name, which does get accepted):
  async fillImporterNo(importerName: string): Promise<void> {
    await this.autocomplete.select(this.importerNoInput, importerName);
  }

  //checks "إحالة إلى وسيط شحن معين؟" - unlocks the وسيط الشحن (freight forwarder) autocomplete below, otherwise
  //disabled:
  async checkReferToFreightForwarder(): Promise<void> {
    await expect(this.referToFreightForwarderCheckbox).toBeVisible({ timeout: 10_000 });
    await this.referToFreightForwarderCheckbox.check();
  }

  //only enabled once the rest of the form (final port through receiver id) is filled AND
  //checkReferToFreightForwarder() above has been checked - confirmed live that checking the box alone, before the
  //bill lookup resolves, leaves this field disabled regardless of the checkbox's own checked state. Unlike
  //رقم المستورد, this field genuinely filters by what's typed, so select by name/number rather than picking
  //whatever's first:
  async fillFreightForwarder(nameOrNumber: string): Promise<void> {
    await expect(this.freightForwarderInput).toBeEnabled({ timeout: 10_000 });
    await this.autocomplete.select(this.freightForwarderInput, nameOrNumber);
  }

  //fills the whole form for the simple case - no referral to a specific freight forwarder ("إحالة إلى وسيط شحن
  //معين؟" left unchecked). billNo/expectedReferenceNo are the already-received import manifest's own master bill
  //number and submitted reference number:
  async fillDeliveryOrderForm(data: DeliveryOrderData, billNo: string, expectedReferenceNo: string, transportCompany: string): Promise<void> {
    await this.selectFinalPort(data.finalPort);
    await this.fillCarrierPrefix(transportCompany);
    await this.fillBillNumber(billNo);
    await this.selectBillDate();
    await this.waitForManifestRefAutoFill(expectedReferenceNo);
    await this.fillReceiverName(data.receiverName);
    await this.fillReceiverId(data.receiverId);
  }

  //saves as a draft ("مسودة") - does not submit to customs, no رقم إذن التسليم is generated yet. Leaves a "تم حفظ"
  //toast open (the "vx1 modal show" popup pattern used across the app) that blocks later clicks if not closed.
  //Returns the newly created draft's own reference number, read directly from the POST /api/air/v1/deo response -
  //NOT from the list afterward: the list's own docRefNo values are NOT strictly newest-first (confirmed live via
  //network capture - this account's document numbers don't increase monotonically across the whole day the way
  //the list's default sort assumes), so reading "the first row" after saving silently returned a stale, unrelated
  //draft from earlier in the session instead of the one just created:
  async clickSaveButton(): Promise<string> {
    await expect(this.saveButton).toBeVisible();
    await expect(this.saveButton).toBeEnabled();

    const responsePromise = this.page.waitForResponse(
      (response) => response.url().includes('/api/air/v1/deo') && response.request().method() === 'POST'
    );

    await this.saveButton.click();

    const response = await responsePromise;
    const body = await response.json();
    const deoDocRefNo: string = body?.result?.deoDocRefNo ?? '';

    await this.closeBlockingModalIfPresent();

    return deoDocRefNo;
  }

  //submits the delivery order to customs - available directly on the create form, and again on a reopened draft's
  //edit form (after clickEditButton()). Same leftover-toast behavior as clickSaveButton():
  async clickSubmitButton(): Promise<void> {
    await expect(this.submitButton).toBeVisible();
    await expect(this.submitButton).toBeEnabled();
    await this.submitButton.click();
    await this.closeBlockingModalIfPresent();
  }

  //reopens an already-saved draft as an editable form (from its "تفاصيل الاذن الجوي" detail view) - fields come
  //back pre-filled, so no need to refill anything before clickSubmitButton(). Waits for the edit form to actually
  //finish loading before returning - clicking تقديم الطلب too soon after this can silently land on a stale button
  //left over from the detail view (see waitForPageIdle()'s comment):
  async clickEditButton(): Promise<void> {
    await expect(this.editButton).toBeVisible({ timeout: 15_000 });
    await expect(this.editButton).toBeEnabled();
    await this.editButton.click();
    await this.waitForPageIdle();
    //nprogress-busy only tracks the XHR itself - the edit form's own client-side render/binding can still lag
    //slightly behind that (confirmed live: without this, تقديم الطلب's click "succeeds" but never actually calls
    //the submit API), same fixed-wait idiom used elsewhere in this codebase (e.g. clickHistoryTab()):
    await this.page.waitForTimeout(1_500);
  }

  //cancels an already-accepted (مقبول) delivery order - confirms the "هل تريد الغاء اذن التسليم الجوي؟" dialog via
  //"نعم", then closes the resulting "تم إلغاء إذن التسليم الجوي..." success toast:
  async clickCancelButton(): Promise<void> {
    await expect(this.cancelButton).toBeVisible({ timeout: 15_000 });
    await expect(this.cancelButton).toBeEnabled();
    await this.cancelButton.click();

    await this.modal.confirmIfPresent('نعم');
    await this.closeBlockingModalIfPresent();
  }

  //only present on an accepted delivery order's detail view - confirmed live it doesn't open a new tab or block
  //the page:
  async clickPrintButton(): Promise<void> {
    await expect(this.printButton).toBeVisible({ timeout: 15_000 });
    await expect(this.printButton).toBeEnabled();
    await this.printButton.click();
  }

  //only present on an accepted delivery order's detail view - waits for the resulting PDF download and returns its
  //suggested filename (e.g. "DEO-<refNo>.pdf"):
  async clickDownloadButton(): Promise<string> {
    await expect(this.downloadButton).toBeVisible({ timeout: 15_000 });
    await expect(this.downloadButton).toBeEnabled();

    const downloadPromise = this.page.waitForEvent('download', { timeout: 15_000 });
    await this.downloadButton.click();

    const download = await downloadPromise;
    return download.suggestedFilename();
  }

  //same live-filter search field used across the app's other list pages (see
  //ViewImportManifestPage.searchByReferenceNumber()) - the filter is itself a server round-trip (a GET to
  ///api/air/v1/deo?...&q=), so this waits for it to settle before returning:
  async searchByReferenceNumber(referenceNumber: string): Promise<void> {
    //a toast from whatever action preceded this search (e.g. the save that just happened) can still be showing
    //and blocks the search field from receiving the click - close it up before trying:
    await this.closeBlockingModalIfPresent();
    await this.searchInput.click();
    await this.searchInput.fill('');
    await this.page.keyboard.type(referenceNumber, { delay: 100 });
    await this.waitForPageIdle();
    await this.page.waitForTimeout(1_500);
  }

  private deliveryOrderRowByRefNo(referenceNumber: string): Locator {
    return this.page.locator('tbody tr').filter({
      has: this.page.locator('td[test-attr^="shipping_agent_deo_deodocrefno"]', { hasText: referenceNumber }),
    });
  }

  //opens a delivery order's "تفاصيل الاذن الجوي" detail view, given its رقم الوثيقة التسلسلي - call
  //searchByReferenceNumber() first to narrow the list down to it:
  async openDeliveryOrderByReferenceNumber(referenceNumber: string): Promise<void> {
    await this.deliveryOrderRowByRefNo(referenceNumber).click();
    await this.waitForPageIdle();
    await this.page.waitForTimeout(1_500);
  }

  //opens the "تاريخ الوثائق" tab on a delivery order's own detail view (call openDeliveryOrderByReferenceNumber()
  //first):
  async clickHistoryTab(): Promise<void> {
    await expect(this.historyTab).toBeVisible({ timeout: 15_000 });
    await this.historyTab.click();
    await this.page.waitForTimeout(2_000);
  }

  //clicks "التفاصيل" on the latest row of the "تاريخ الوثائق" tab - opens the "إستعراض تاريخ الوثائق" modal, which
  //for a rejected delivery order includes the rejection reason (e.g. "IMPORTER NUMBER NOT FOUND: 2") in its
  //remarks. Leaves the modal open:
  async clickHistoryDetailsButton(): Promise<void> {
    await expect(this.historyDetailsButton).toBeVisible({ timeout: 15_000 });
    await this.historyDetailsButton.click();

    const detailsModal = this.page.locator('.modal.show').last();
    await expect(detailsModal).toBeVisible({ timeout: 10_000 });
    await this.page.waitForTimeout(1_500);
  }

  //reads "حالة إذن التسليم" (status) for a delivery order row in the list, given its رقم الوثيقة التسلسلي:
  async getDeliveryOrderStatus(referenceNumber: string): Promise<string> {
    const statusCell = this.deliveryOrderRowByRefNo(referenceNumber).locator(
      'td[test-attr^="shipping_agent_deo_deo_status"]'
    );

    return (await statusCell.textContent())?.trim() ?? '';
  }

  //re-searches for the delivery order and checks its status every intervalMs, until it matches expectedStatus or
  //timeoutMs elapses - same polling pattern as ViewImportManifestPage.waitForManifestStatus():
  async waitForDeliveryOrderStatus(
    referenceNumber: string,
    expectedStatus: string,
    options: { intervalMs?: number; timeoutMs?: number } = {}
  ): Promise<boolean> {
    const intervalMs = options.intervalMs ?? 60_000;
    const timeoutMs = options.timeoutMs ?? 120_000;
    const deadline = Date.now() + timeoutMs;

    while (true) {
      await this.searchByReferenceNumber(referenceNumber);

      const currentStatus = await this.getDeliveryOrderStatus(referenceNumber);
      console.log(`Delivery order ${referenceNumber} status: ${currentStatus}`);

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
