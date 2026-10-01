import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { NewImportManPage } from '../../pages/Import Manifest/newImportManifest';
import { UploadImportManifestPage } from '../../pages/Import Manifest/UploadImportManifestPage';
import { generateBulkImportManifestXlsx } from '../../test-data/bulkImportManifestFile';
import { expressMailUser } from '../../test-data/users';


test('#23 - Upload Manifest with 999 Bills ', async ({ page }) => {
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

  await test.step('#23,24 - Upload and submit Manifest with 999 Bills', async () => {
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
});
