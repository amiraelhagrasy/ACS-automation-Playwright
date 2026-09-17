import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { acsBrokerUser } from '../../test-data/users';

test.describe('Login Tests', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);

    await loginPage.navigateTo(
      'https://soga.fasah.sa/ar/login/1.0/'
    );
  });

  test('should login with valid credentials', async ({ page }) => {
     await loginPage.loginToApplication(
        acsBrokerUser.username,
        acsBrokerUser.password,
        '999999'
    );
    
  }); 

});