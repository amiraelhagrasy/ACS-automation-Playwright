import { Page, Locator, expect } from '@playwright/test';
import { ModalComponent } from '../components/ModalComponent';

export class LoginPage {
  private page: Page;
  private usernameInput: Locator;
  private passwordInput: Locator;
  private loginButton: Locator;
  private otpField: Locator;
  private verifyOtpButton: Locator;
  private modal: ModalComponent;



  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.loginButton = page.locator('button.btn-primary.btn-rounded');
    this.otpField = page.locator('input[name="otp"]');
    this.verifyOtpButton = page.getByRole('button', {name: 'التحقق'});
    this.modal = new ModalComponent(page);

  }

  async navigateTo(url: string) {
    await this.page.goto(url);
  }

  async enterUsername(username: string) {
    await this.usernameInput.fill(username);
  }

  async enterPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async clickLoginButton(expectedUsername?: string, expectedPassword?: string) {
    //the login form's own submit handler references window.grecaptcha directly (login.js) - confirmed live,
    //2026-09-26: clicking before that script finishes loading/initializing throws "ReferenceError: grecaptcha is
    //not defined" inside the page, silently breaking the submit and leaving the OTP field never appearing.
    //Automation clicks far faster than a human would, so this race is much more likely to be hit here than in
    //real usage - wait for it to exist first, falling through if the timeout is hit rather than blocking forever:
    await this.page
      .waitForFunction(() => (window as any).grecaptcha !== undefined, undefined, { timeout: 10_000 })
      .catch(() => {});

    //confirmed live, 2026-09-27: right after logout() (a client-side redirect back to the login screen, not a
    //fresh page.goto()), username/password can get wiped by the page's own form reset sometime during the wait
    //above, even though they were filled correctly right before this method was called - re-check immediately
    //before the actual click and refill if either was cleared in the meantime:
    if (expectedUsername !== undefined && expectedPassword !== undefined) {
      const actualUsername = await this.usernameInput.inputValue().catch(() => '');
      const actualPassword = await this.passwordInput.inputValue().catch(() => '');

      if (actualUsername !== expectedUsername) {
        await this.usernameInput.fill(expectedUsername);
      }
      if (actualPassword !== expectedPassword) {
        await this.passwordInput.fill(expectedPassword);
      }
    }

    await this.loginButton.click();
  }

  async enterOTP(otp: string) {
    await this.otpField.fill(otp);
  }
  async clickVerifyOtpButton() {
    await this.verifyOtpButton.click();
  }

  async login(username: string, password: string) {
    await this.enterUsername(username);
    await this.enterPassword(password);
    //pass the expected values through so clickLoginButton() can catch a late wipe of either field - see its own
    //comment for why the wipe can happen after this point, not just before it:
    await this.clickLoginButton(username, password);
  }

   async verifyOtpFieldIsDisplayed() {
    await expect(this.otpField).toBeVisible({
      timeout: 30_000,
    });

    await expect(this.otpField).toBeEditable();
  }

//some accounts (e.g. ffw11) stack two vx1 popups on login (password-expiry notice + license-expiry warning),
//so this closes them one at a time via ModalComponent instead of assuming a single popup. Waits for the first
//one to actually render before handing off, since closeAllIfPresent() itself doesn't wait for appearance:
async closeLicensePopupIfDisplayed(): Promise<void> {
  await this.page
    .locator('div.vx1.modal.show')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 })
    .catch(() => {});

  await this.modal.closeAllIfPresent();
}
//a stray vx1 popup (e.g. a leftover success/info alert from the action just performed) can still be showing
//and blocks #WelcomeLink from receiving the click, so close anything up before trying. force:true on top of
//that since a just-dismissed .fasah-alert's backdrop/animation can still intercept pointer events for a beat
//even once nothing is visibly on screen (same "intercepts pointer events" class of issue ModalComponent hits).
//A ".fasah-alert" success toast (e.g. from قبول/رفض elsewhere) is a separate component from the vx1 modals and
//can still be sitting over the header at logout time - confirmed live to leave the sign-out link "not visible"
//for minutes - so this waits for any such toast to clear before trying either click:
async logout(): Promise<void> {
    await this.closeLicensePopupIfDisplayed();

    await this.page
        .locator('.fasah-alert')
        .first()
        .waitFor({ state: 'hidden', timeout: 15_000 })
        .catch(() => {});

    const signOutLink = this.page.locator('a[onclick="fasah.header.signOut();"]');

    //the #WelcomeLink click sometimes fails to actually open the dropdown (confirmed live: the sign-out link
    //stays absent, not just covered, even with force:true on the click itself) - a Bootstrap dropdown flakily
    //not opening/closing again on its own, not something specific to any one flow. Retry the toggle click
    //itself rather than just the final click, since re-clicking #WelcomeLink is what actually recovers it:
    for (let attempt = 1; attempt <= 4; attempt++) {
        await this.page.locator('#WelcomeLink').click({ force: true });

        const opened = await signOutLink
            .waitFor({ state: 'visible', timeout: 5_000 })
            .then(() => true)
            .catch(() => false);

        if (opened) {
            break;
        }
    }

    await signOutLink.click({ force: true });
}

async loginToApplication(
        username: string,
        password: string,
        otp: string
        ): Promise<void> {
        await this.login(username, password);
        await this.enterOTP(otp);
        await this.clickVerifyOtpButton();

        await this.closeLicensePopupIfDisplayed();
    }
}
