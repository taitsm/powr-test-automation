import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page.js';
import { logger } from '../utils/logger.js';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly dashboardIndicator: Locator;

  private static LOGIN_PATH = '/signin?lang=en';

  constructor(page: Page) {
    // Pass the relative path to BasePage constructor
    super(page, LoginPage.LOGIN_PATH);
    this.emailInput = page.locator('#sign_in_email');
    this.passwordInput = page.locator('#new_sign_in_password');
    this.submitButton = page.locator('#sign-in-submit');
    this.dashboardIndicator = page.locator('div.dashboard-header, [data-testid="dashboard-container"], button:has-text("Create New App"), #user-nav-dropdown').first();
  }

  /**
   * Performs login action.
   * @param email User email
   * @param password User password
   * @returns Promise<boolean> - True if login appears successful, false otherwise.
   */
  async login(email: string | undefined, password: string | undefined): Promise<boolean> {
    if (!email || !password) {
      logger.error('Login Error: Email or password not provided.');
      throw new Error('Email or password not provided.');
    }
    logger.info('Attempting login...');

    // Navigate only if not already on login or dashboard page
    const currentUrl = this.page.url();
    const isLoginPage = currentUrl.includes(LoginPage.LOGIN_PATH.split('?')[0]);
    const isDashboard = currentUrl.includes('/users/me');

    if (!isLoginPage && !isDashboard) {
        logger.info(`Current URL ${currentUrl} is not login/dashboard, navigating to login page.`);
        await this.navigate({ waitUntil: 'domcontentloaded' });
    } else {
        logger.info(`Already on ${isLoginPage ? 'login' : 'dashboard'} page, ensuring load state.`);
        await this.waitForPageLoad('domcontentloaded');
    }

    // If somehow landed on dashboard during check, maybe already logged in?
    if (this.page.url().includes('/users/me')) {
        logger.warn("Detected dashboard URL before filling form, attempting to verify if already logged in.");
        if (await this.isLoggedIn(5000)) {
            logger.info("Already logged in based on dashboard indicator check.");
            await this.takeScreenshot('login-skipped-already-logged-in');
            return true;
        } else {
             logger.warn("Dashboard URL detected but login check failed, proceeding with login attempt.");
             // If verification failed, navigate to login page for sure
             await this.navigate({ waitUntil: 'domcontentloaded' });
        }
    }

    await this.takeScreenshot('login-page-before-fill');

    try {
      logger.info('Waiting for email input to be attached.');
      await this.emailInput.waitFor({ state: 'attached', timeout: 10000 });

      logger.info('Filling login credentials...');
      await this.emailInput.fill(email, { timeout: 5000 });
      await this.passwordInput.fill(password, { timeout: 5000 });
      await this.takeScreenshot('login-page-filled');

      logger.info('Submitting login form...');
      await this.submitButton.click({ timeout: 5000 });

      // Wait for potential navigation OR dashboard indicator appearance
      logger.info('Waiting for login result (Navigation or Dashboard Indicator)...');
      try {
          await Promise.race([
              this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }),
              this.dashboardIndicator.waitFor({ state: 'visible', timeout: 25000 })
          ]);
          logger.info('Login navigation/indicator detected.');
      } catch (error) {
          logger.warn(`Navigation or dashboard indicator wait timed out/failed during login submit: ${(error as Error).message}`);
          await this.takeScreenshot('login-navigation-or-indicator-issue', true);
      }

      // Final verification step
      logger.info('Verifying login success post-submit...');
      const loggedIn = await this.isLoggedIn();
      if (loggedIn) {
          logger.info('Login verification successful (Dashboard indicator found).');
          await this.takeScreenshot('login-success-dashboard-found');
          return true;
      } else {
          const finalUrl = this.page.url();
          logger.error(`Login verification failed post-submit (Dashboard indicator not found). Final URL: ${finalUrl}`);
          await this.takeScreenshot('login-failed-no-dashboard-final', true);
          if (finalUrl.includes(LoginPage.LOGIN_PATH.split('?')[0])) {
              logger.error('Still on login page. Check credentials, CAPTCHA, or other login errors.');
          }
          return false;
      }

    } catch (error) {
      logger.error('Error during login process:', error);
      await this.takeScreenshot('login-process-error', true);
      return false;
    }
  }

  /**
   * Checks if the user is currently logged in by looking for a dashboard indicator.
   * @param timeout Max time to wait for the indicator.
   * @returns Promise<boolean>
   */
  async isLoggedIn(timeout: number = 15000): Promise<boolean> {
    logger.debug(`Checking if logged in by looking for dashboard indicator (Timeout: ${timeout}ms)`);
    try {
      await this.dashboardIndicator.waitFor({ state: 'visible', timeout });
      const currentUrl = this.page.url();
      if (!currentUrl.includes(LoginPage.LOGIN_PATH.split('?')[0])) {
        logger.debug('Dashboard indicator visible and not on login page. Logged in: true');
        return true;
      } else {
        logger.warn("Dashboard indicator found, but URL still contains login path? Potential issue.");
        await this.takeScreenshot('login-check-indicator-vs-url-mismatch', true);
        return false;
      }
    } catch (error) {
      logger.debug(`Dashboard indicator not found within ${timeout}ms. Assuming not logged in.`);
      return false;
    }
  }
}