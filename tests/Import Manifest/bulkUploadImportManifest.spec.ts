import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { NewImportManPage } from '../../pages/Import Manifest/NewImportManPage';
import { UploadImportManifestPage } from '../../pages/Import Manifest/UploadImportManifestPage';
import { generateBulkImportManifestXlsx } from '../../test-data/bulkImportManifestFile';
import { expressMailUser } from '../../test-data/users';

//bulk-uploads a 999-bill import manifest via the "تحميل مانيفست استيراد جديد" .xlsx upload flow, instead of
//filling the manifest + bill forms by hand. The .xlsx is generated fresh for "today" each run (see
//test-data/bulkImportManifestFile.ts for the BILL_NO/date/cell-type rules confirmed live against the portal's
//own downloaded template). Scope is deliberately just "the upload itself succeeds and returns a reference
//number" - the uploaded manifest lands in "مسودة" (draft) rather than progressing on its own like a manually
//built manifest does, and whatever additional submit step that needs is a separate, not-yet-investigated task.
//Uses the plain (non-fixtures) test/page - the shared testFixtures.ts "page" fixture auto-logs in as the broker
//first, which this test doesn't need since it only ever acts as the express-mail company (blqur002):
test('express-mail company bulk-uploads a 999-bill import manifest from an xlsx file', async ({ page }) => {
  test.setTimeout(300_000);

  const loginPage = new LoginPage(page);
  const newImportManPage = new NewImportManPage(page);
  const uploadPage = new UploadImportManifestPage(page);

  await test.step('Log in as the express-mail company', async () => {
    await loginPage.navigateTo('https://soga.fasah.sa/ar/login/1.0/');
    await loginPage.loginToApplication(expressMailUser.username, expressMailUser.password, '999999');
  });

  const { filePath, billNos } = generateBulkImportManifestXlsx(999);
  console.log('Generated bulk import file:', filePath);
  console.log('First bill:', billNos[0], '- Last bill:', billNos[billNos.length - 1]);

  let referenceNumber = '';

  try {
    await test.step('Upload the 999-bill manifest file', async () => {
      await newImportManPage.clickAirServices();
      await newImportManPage.clickAirImportManifest();
      await uploadPage.clickUploadNewManifest();
      await uploadPage.uploadFile(filePath);
      await uploadPage.clickUpload();

      const result = await uploadPage.readAndCloseSuccessAlert();
      referenceNumber = result.referenceNumber;
      console.log('Uploaded manifest reference number:', referenceNumber);
      expect(referenceNumber).not.toBe('');
    });
  } finally {
    if (!referenceNumber) {
      //leaves the browser open on failure for live inspection - same pattern used across this suite:
      await page.pause();
    }
  }
});
