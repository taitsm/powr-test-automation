import type { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#sign_in_email');
    this.passwordInput = page.locator('#new_sign_in_password');
    this.submitButton = page.locator('#sign-in-submit');
  }

  async login(email: string | undefined, password: string | undefined): Promise<void> {
    if (!email || !password) {
      throw new Error('Email or password not provided. Set USER_EMAIL and USER_PASSWORD in .env file.');
    }

    console.log('Starting login process...');

    // Navigate directly to login page
    await this.page.goto('https://www.powr.io/signin');

    // Fill out login form
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    // Submit form and wait for navigation
    console.log('Submitting login...');
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'load' }),
      this.submitButton.click()
    ]);

    // Verify login was successful by checking for dashboard elements
    console.log('Verifying login success...');
    try {
      // Wait for any dashboard indicator
      await this.page.waitForSelector('div.dashboard-header__menu-wrapper, .user-profile__avatar', {
        state: 'visible',
        timeout: 10000
      });
      console.log('Login successful');
    } catch (error) {
      console.error('Login verification failed');
      // Screenshot for debugging
      await this.page.screenshot({ path: 'login-failed.png' });
      throw new Error('Login failed - could not verify successful login');
    }
  }
}