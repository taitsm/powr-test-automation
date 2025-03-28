import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';
import { getScreenshotPath } from '../utils/screenshot-utils';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class FormBuilderPage extends BasePage {
  // Auth-related locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;

  // Dashboard locators
  readonly createNewAppButton: Locator;
  readonly formBuilderCard: Locator;
  readonly getAppLink: Locator;
  readonly startFromScratchButton: Locator;

  // Welcome modal
  readonly welcomeModalCloseButton: Locator;

  // Navigation tabs
  readonly designTab: Locator;

  // Design options
  readonly backgroundBorderOption: Locator;
  readonly backgroundColorPicker: Locator;
  readonly colorSwatches: Locator;

  // Publish locators
  readonly publishButton: Locator;
  readonly shareAppButton: Locator;
  readonly copyLinkButton: Locator;
  readonly shareLinkInput: Locator;

  // Form container (for color verification)
  readonly formContainer: Locator;

  constructor(page: Page) {
    super(page, '/users/me');

    // Auth elements
    this.emailInput = page.locator('#sign_in_email');
    this.passwordInput = page.locator('#new_sign_in_password');
    this.signInButton = page.locator('#sign-in-submit');

    // Dashboard elements
    this.createNewAppButton = page.locator('button:has-text("Create New App"), button.button-primary:has(i.fa-plus)');
    this.formBuilderCard = page.locator('.app-card:has-text("Form Builder")');
    this.getAppLink = page.locator('a:has-text("Get App")').first();
    this.startFromScratchButton = page.locator('button:has-text("Start from scratch")');

    // Welcome modal close button
    this.welcomeModalCloseButton = page.locator('.welcome-screen-modal-content i.react-modal-close, .ReactModal__Content i.fa-times');

    // Navigation elements
    this.designTab = page.locator('.tab[data-qa="tab-Design"], div.tab:has-text("Design")');

    // Design elements
    this.backgroundBorderOption = page.locator('.powrDrilldown:has-text("Background & Border")');
    this.backgroundColorPicker = page.locator('div[data-qa="colorpicker-backgroundColor"], label:has-text("Background Color")').first();
    this.colorSwatches = page.locator('.swatches-picker [title]');

    // Publish elements
    this.publishButton = page.locator('button[data-qa="button-publish"]');
    this.shareAppButton = page.locator('button:has-text("Share App")');
    this.copyLinkButton = page.locator('button:has-text("Copy Link")');
    this.shareLinkInput = page.locator('input.share-link-input, .share-link-container input');

    // Form container for verification
    this.formContainer = page.locator('.formBuilder-v2, .js-form-container');
  }

    /**
     * Perform manual login if we're redirected to signin page
     */
    async ensureLoggedIn(): Promise<void> {
        console.log('Checking if we need to log in manually...');

        // Check if we're on the login page
        const isLoginPage = await this.page.url().includes('/signin');

        if (isLoginPage) {
            console.log('Detected login page, performing manual login');
            const email = process.env.USER_EMAIL;
            const password = process.env.USER_PASSWORD;

            if (!email || !password) {
            throw new Error('Missing login credentials. Set USER_EMAIL and USER_PASSWORD in .env file');
            }

            // Fill in login form
            await this.emailInput.fill(email);
            await this.passwordInput.fill(password);

            // Take screenshot before submitting
            await this.page.screenshot({ path: getScreenshotPath('before-login-submit.png') });

            // Click login button and wait for navigation
            await this.signInButton.click();

            // Wait for navigation to complete (either to dashboard or with error)
            await this.page.waitForNavigation({ timeout: 30000 });

            // Check if login was successful
            const currentUrl = this.page.url();
            console.log(`After login attempt, current URL: ${currentUrl}`);

            if (currentUrl.includes('/signin')) {
            // Still on signin page, login failed
            await this.page.screenshot({ path: getScreenshotPath('login-failed.png') });
            throw new Error('Login failed - still on signin page');
            }

            console.log('Manual login successful');
        } else {
            console.log('Already logged in, continuing with test');
        }
    }

  /**
   * Navigate to the dashboard
   */
  async navigateToDashboard(): Promise<void> {
    console.log('Navigating to dashboard...');
    await this.page.goto('https://www.powr.io/users/me');
    await this.page.waitForLoadState('domcontentloaded');

    // Make sure we're logged in
    await this.ensureLoggedIn();

    // Check if we're on the dashboard
    const currentUrl = this.page.url();
    console.log(`Current URL after navigation: ${currentUrl}`);

    // Take screenshot of current state
    await this.page.screenshot({ path: getScreenshotPath('dashboard-loaded.png') });

    // Wait for the create new app button to be visible
    try {
      await this.createNewAppButton.waitFor({ state: 'visible', timeout: 15000 });
      console.log('Create New App button is visible, we are on the dashboard');
    } catch (e) {
      console.error('Create New App button not found, we might not be on the dashboard');
      await this.page.screenshot({ path: getScreenshotPath('dashboard-error.png') });
      throw new Error('Failed to navigate to dashboard, Create New App button not found');
    }
  }

  /**
   * Create a new form builder app
   */
  async createNewFormBuilder(): Promise<void> {
    console.log('Creating new Form Builder app...');

    // Click the Create New App button
    await this.createNewAppButton.click();
    await this.page.screenshot({ path: getScreenshotPath('after-create-new-click.png') });

    // Wait for the app cards to appear in the modal
    try {
      await this.formBuilderCard.waitFor({ state: 'visible', timeout: 15000 });
    } catch (e) {
      console.error('Form Builder card not found in app selection modal');
      await this.page.screenshot({ path: getScreenshotPath('app-selection-error.png') });
      throw new Error('Form Builder card not found in app selection');
    }

    // Click on the Form Builder Get App link
    await this.getAppLink.click();

    // Wait for templates page to load
    try {
      await this.page.waitForURL('**/templates?app_type=formBuilder*', { timeout: 20000 });
    } catch (e) {
      console.error('Failed to navigate to templates page');
      await this.page.screenshot({ path: getScreenshotPath('templates-navigation-error.png') });
      throw new Error('Failed to navigate to templates page');
    }

    await this.page.screenshot({ path: getScreenshotPath('templates-page.png') });

    // Wait for and click Start from scratch
    try {
      await this.startFromScratchButton.waitFor({ state: 'visible', timeout: 15000 });
      await this.startFromScratchButton.click();
    } catch (e) {
      console.error('Start from scratch button not found on templates page');
      await this.page.screenshot({ path: getScreenshotPath('start-from-scratch-error.png') });
      throw new Error('Start from scratch button not found');
    }

    // Wait for editor to load
    try {
      await this.page.waitForURL('**/plugins/form-builder/standalone?*', { timeout: 20000 });
    } catch (e) {
      console.error('Failed to navigate to form builder editor');
      await this.page.screenshot({ path: getScreenshotPath('editor-navigation-error.png') });
      throw new Error('Failed to navigate to form builder editor');
    }

    // Close welcome modal if it appears
    try {
      await this.welcomeModalCloseButton.waitFor({ state: 'visible', timeout: 5000 });
      await this.welcomeModalCloseButton.click();
      console.log('Closed welcome modal');
    } catch (e) {
      console.log('No welcome modal detected or already closed');
    }

    await this.page.screenshot({ path: getScreenshotPath('form-builder-editor.png') });
    console.log('Form Builder editor loaded');
  }

  /**
   * Select a random color for the form background
   * @returns The selected color hex code
   */
  async changeBackgroundColor(): Promise<string> {
    console.log('Changing background color...');

    // Navigate to the Design tab
    await this.designTab.waitFor({ state: 'visible', timeout: 10000 });
    await this.designTab.click();
    await this.page.screenshot({ path: getScreenshotPath('design-tab.png') });

    // Click on Background & Border option
    await this.backgroundBorderOption.waitFor({ state: 'visible', timeout: 10000 });
    await this.backgroundBorderOption.click();

    // Click on Background Color picker
    await this.backgroundColorPicker.waitFor({ state: 'visible', timeout: 10000 });
    await this.backgroundColorPicker.click();

    // Wait for color swatches to appear
    await this.colorSwatches.first().waitFor({ state: 'visible', timeout: 10000 });

    // Get all available colors and select a random one (excluding transparent and white)
    const colors = await this.colorSwatches.all();
    console.log(`Found ${colors.length} color options`);

    // Pick a color that's not white or transparent
    let selectedColor;
    let colorTitle;

    for (let i = 0; i < 10; i++) { // Try up to 10 times to find a suitable color
      const randomIndex = Math.floor(Math.random() * colors.length);
      const colorElement = colors[randomIndex];
      colorTitle = await colorElement.getAttribute('title');

      if (colorTitle && colorTitle !== '#FFFFFF' && colorTitle !== 'transparent') {
        selectedColor = colorElement;
        break;
      }
    }

    // Use a fallback color if we couldn't find a suitable random one
    if (!selectedColor) {
      console.log('Could not find a suitable random color, using a fallback blue color');
      selectedColor = this.page.locator('[title="#2196F3"]').first();
      colorTitle = '#2196F3';
    }

    // Click the color
    await selectedColor.click();

    // Click OK button
    const okButton = this.page.locator('button:has-text("OK")');
    await okButton.waitFor({ state: 'visible', timeout: 5000 });
    await okButton.click();

    await this.page.screenshot({ path: getScreenshotPath('color-changed.png') });
    console.log(`Selected background color: ${colorTitle}`);

    return colorTitle || '';
  }

  /**
   * Publish the form and get the share link
   * @returns The URL of the published form
   */
  async publishForm(): Promise<string> {
    console.log('Publishing form...');

    // Click publish button
    await this.publishButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.page.screenshot({ path: getScreenshotPath('before-publish.png') });
    await this.publishButton.click();

    // Wait for publish to complete and Share App button to appear
    try {
      await this.shareAppButton.waitFor({ state: 'visible', timeout: 15000 });
      await this.shareAppButton.click();
    } catch (e) {
      console.log('No Share App button found, might already be on share screen');
    }

    // Wait for Copy Link button and get the share URL
    await this.copyLinkButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.page.screenshot({ path: getScreenshotPath('share-dialog.png') });

    // Get the shareable link
    const shareUrl = await this.shareLinkInput.inputValue();

    console.log('Form published at:', shareUrl);
    return shareUrl;
  }

  /**
   * Visit the published form and verify the background color
   * @param shareUrl The URL of the published form
   * @param expectedColor The expected background color
   */
  async verifyPublishedForm(shareUrl: string, expectedColor: string): Promise<boolean> {
    console.log(`Verifying published form at ${shareUrl}`);
    console.log(`Expected background color: ${expectedColor}`);

    // Open the shared URL in a new tab
    const newPage = await this.page.context().newPage();
    await newPage.goto(shareUrl, { timeout: 30000 });
    await newPage.waitForLoadState('domcontentloaded');
    await newPage.screenshot({ path: getScreenshotPath('published-form.png') });

    // Get the actual background color
    let actualColor = '';
    try {
      // Try different ways to get the background color
      actualColor = await newPage.evaluate(() => {
        // Try various selectors that might contain the background color
        const formContainer = document.querySelector('.formBuilder-v2, .js-form-container');
        if (formContainer) {
          return window.getComputedStyle(formContainer).backgroundColor;
        }

        // If that fails, try other selectors
        const formElement = document.querySelector('form');
        if (formElement) {
          return window.getComputedStyle(formElement).backgroundColor;
        }

        // If all else fails, return the body background
        return window.getComputedStyle(document.body).backgroundColor;
      });

      console.log('Actual background color:', actualColor);
    } catch (e) {
      console.error('Error getting background color:', e);
      actualColor = '';
    }

    // Close the new page
    await newPage.close();

    // Compare colors (very basic comparison)
    // Make sure colorsMatch is always a boolean with !! operator
    const colorsMatch = !!actualColor &&
                       (actualColor.includes(expectedColor) ||
                        expectedColor.includes(actualColor));

    console.log(`Color verification result: ${colorsMatch ? 'Matched' : 'Did not match'}`);
    return colorsMatch;
  }
}