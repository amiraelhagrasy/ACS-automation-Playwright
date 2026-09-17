import { expect, Locator, Page } from '@playwright/test';

//bulk-uploads an import manifest from a prepared .xlsx file (see test-data/bulkImportManifestFile.ts) instead of
//filling the manifest form field-by-field - reachable from the same "مانيفست الاستيراد الجوي" list as
//NewImportManPage/ViewImportManifestPage, via a "تحميل مانيفست استيراد جديد" button that opens an upload modal:
export class UploadImportManifestPage {
  private readonly page: Page;

  private readonly uploadNewManifestButton: Locator;
  private readonly fileInput: Locator;
  private readonly uploadButton: Locator;
  private readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.uploadNewManifestButton = page.locator(
      'button[onclick="fasah.air_manifest_import.uploadNewManifest()"]'
    );
    //the real <input type="file"> is visually hidden behind a styled label ("رفع الملفات") whose `for` attribute
    //targets a per-page-load GUID id (e.g. "hidden_oga_input_upload_file_ad639b0a-...") - not usable as a stable
    //locator. setInputFiles() works directly on the underlying input even while hidden, bypassing the native OS
    //file picker the label would otherwise open, so a plain type=file selector is enough:
    this.fileInput = page.locator('input[type="file"]');
    this.uploadButton = page.getByRole('button', { name: 'رفع', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'الغاء', exact: true });
  }

  async waitForPageIdle(): Promise<void> {
    await this.page
      .waitForFunction(() => !document.documentElement.classList.contains('nprogress-busy'), undefined, {
        timeout: 15_000,
      })
      .catch(() => {});
  }

  async clickUploadNewManifest(): Promise<void> {
    await this.waitForPageIdle();
    await expect(this.uploadNewManifestButton).toBeVisible({ timeout: 15_000 });
    await this.uploadNewManifestButton.click();
    await this.waitForPageIdle();
  }

  async uploadFile(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath);
  }

  async clickUpload(): Promise<void> {
    await expect(this.uploadButton).toBeVisible({ timeout: 15_000 });
    await this.uploadButton.click();
    await this.waitForPageIdle();
  }

  //reads the "تم انشاء المانيفست، الرقم المرجعي هو: <N>" success alert (same .fasah-alert-body pattern used
  //across this codebase) and closes it. Generous timeout: confirmed live that validating/committing a 999-bill
  //file server-side takes noticeably longer than nprogress-busy staying set for (the same "nprogress clears
  //before the real work is done" pattern already documented elsewhere in this codebase) - a plain screenshot at
  //the moment of an earlier 30s-timeout failure showed no error banner at all, just the still-open upload form,
  //meaning the server was still working, not rejecting the file:
  async readAndCloseSuccessAlert(): Promise<{ referenceNumber: string }> {
    const body = this.page.locator('.fasah-alert-body');
    await expect(body).toBeVisible({ timeout: 120_000 });

    const text = (await body.textContent()) ?? '';
    const [referenceNumber = ''] = text.match(/\d+/g) ?? [];

    const closeIcon = this.page.locator('#modelcloseicon').and(this.page.locator(':visible')).last();
    const deadline = Date.now() + 30_000;
    while ((await body.isVisible().catch(() => false)) && Date.now() < deadline) {
      await closeIcon.click({ force: true, timeout: 5_000 }).catch(() => {});
      await this.page.waitForTimeout(1_000);
    }

    return { referenceNumber };
  }
}
