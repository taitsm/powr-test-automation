import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page.js';
import { expect } from '@playwright/test';
import { takeScreenshot as takeScreenshotUtil } from '../utils/screenshot-utils.js';
import { logger } from '../utils/logger.js';

// Helper for color conversion
const hexToRgb = (hex: string): string => {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
  if (hex.length !== 6) {
    logger.warn(`Invalid hex color provided to hexToRgb: ${hex}. Returning black.`);
    return 'rgb(0, 0, 0)';
  }
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgb(${r}, ${g}, ${b})`;
};

export class FormBuilderPage extends BasePage {
  // === Dashboard Locators (Keep for potential other tests) ===
  readonly dashboardContainer: Locator;
  readonly createNewAppButton: Locator;
  readonly appSelectionModal: Locator;
  readonly formBuilderCardInModal: Locator;
  readonly getAppLinkOnCard: Locator;
  readonly templatesPageIdentifier: Locator;
  readonly startFromScratchButton: Locator;

  // === Editor Locators (Primary focus for this test) ===
  readonly editorContainer: Locator;
  readonly welcomeModalCloseButton: Locator;
  readonly designTab: Locator;
  readonly publishButton: Locator;
  readonly backgroundBorderOption: Locator;
  readonly backgroundColorPickerTrigger: Locator;
  readonly colorPickerContainer: Locator;
  readonly colorSwatchByTitle: (title: string) => Locator;
  readonly colorPickerOkButton: Locator;
  readonly shareAppMenuItem: Locator;
  readonly shareLinkInput: Locator;
  readonly publishedFormContainerSelector: string;

  constructor(page: Page) {
    // Base URL points to dashboard, but we'll often navigate directly elsewhere
    super(page, '/users/me');

    // === Dashboard Locators ===
    this.dashboardContainer = page.locator('div.dashboard-container, main#content, div.dashboard-header');
    this.createNewAppButton = page.locator('button:has-text("Create New App"), button.button-primary:has(i.fa-plus)');
    this.appSelectionModal = page.locator('.ReactModal__Content--after-open .modal__body, div[role="dialog"]:has-text("Create New App")');
    this.formBuilderCardInModal = this.appSelectionModal.locator('.app-card:has-text("Form Builder")');
    this.getAppLinkOnCard = this.formBuilderCardInModal.locator('a:has-text("Get App")');
    this.templatesPageIdentifier = page.locator('h1:has-text("Choose a template"), div.templates-header');
    this.startFromScratchButton = page.locator('button:has-text("Start from scratch")');

    // === Editor Locators (Aligned with old spec) ===
    this.editorContainer = page.locator('div.editor, #editor-container, div.app-builder-content');
    this.welcomeModalCloseButton = page.locator('div.ReactModal__Content.welcome-screen-modal-content i.fal.fa-times.react-modal-close');
    this.designTab = page.locator('div.tab[data-qa="tab-Design"]');
    this.publishButton = page.locator('button[data-qa="button-publish"]');
    this.backgroundBorderOption = page.locator('div[data-qa="powrDrilldown-background"]');
    this.backgroundColorPickerTrigger = page.locator('div[data-qa="colorpicker-backgroundColor"]');
    this.colorPickerContainer = page.locator('.colorpicker-container, .swatches-picker');
    this.colorSwatchByTitle = (title: string) => this.colorPickerContainer.locator(`div[title="${title}"]`);
    this.colorPickerOkButton = this.colorPickerContainer.locator('button:has-text("OK")');
    this.shareAppMenuItem = page.locator('div.side-nav__item-row:has(p.side-nav__item-label:text-is("Share App"))');
    this.shareLinkInput = page.locator('input.non-editable--url');
    this.publishedFormContainerSelector = "#appView > div.formBuilder.formBuilder-v2.formElementsModule.js-form-container.enter_ani_none.none";
  }

  /**
   * Waits for essential editor elements to be ready.
   */
  async waitForEditorLoad(timeout: number = 25000): Promise<void> {
    logger.info('Waiting for Form Builder editor UI elements...');
    try {
      await this.waitForPageLoad('domcontentloaded', timeout / 2);

      // Take an early screenshot using BasePage method
      await this.takeScreenshot('editor-page-initial-state');

      const possibleIndicators = [
        this.editorContainer,
        this.designTab,
        this.page.locator('.app-builder'),
        this.page.locator('div.side-nav'),
        this.page.locator('div.app-header'),
        this.page.locator('button:has-text("Publish")'),
        this.page.locator('div.welcome-screen-modal-content'),
      ];

      logger.info('Checking for any editor UI indicator...');
      // Use Promise.race for faster detection
      await Promise.race(
          possibleIndicators.map(indicator => indicator.waitFor({ state: 'visible', timeout: timeout - 2000 }))
      );

      logger.info('Found an editor UI indicator. Editor appears to be loaded.');
      await this.takeScreenshot('form-editor-indicator-found');

    } catch (error) {
      const currentUrl = this.page.url();
      logger.error(`Editor UI elements did not load correctly within ${timeout}ms. Current URL: ${currentUrl}`, error);
      await this.takeScreenshot('form-editor-load-error', true);
      throw new Error(`Editor UI failed to load. Current URL: ${currentUrl}. Error: ${(error as Error).message}`);
    }
  }

  /**
   * Navigate directly to the form builder editor standalone page.
   */
  async navigateDirectlyToEditor(): Promise<void> {
    const editorUrl = 'https://www.powr.io/plugins/form-builder/standalone?redirected_from_templates=true&app_type=formBuilder';
    logger.info(`Navigating directly to Form Builder editor: ${editorUrl}`);
    try {
        await this.page.goto(editorUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.page.waitForTimeout(5000);

        const currentUrl = this.page.url();
        logger.info(`Current URL after navigation attempt: ${currentUrl}`);

        if (currentUrl.includes('/signin') || currentUrl.includes('/sign_in')) {
          logger.error('Redirected to login page. Authentication is required *before* navigating directly to the editor.');
          await this.takeScreenshot('editor-direct-nav-auth-error', true);
          throw new Error('Authentication failed or missing. Cannot access editor directly.');
        }

        logger.info('Taking initial page snapshot before waiting for editor elements...');
        await this.takeScreenshot('form-editor-before-wait');

        await this.waitForEditorLoad();
        logger.info('Form Builder editor loaded successfully via direct navigation.');

    } catch(error) {
        logger.error(`Failed during direct navigation to editor or editor load: ${(error as Error).message}`);
        await this.takeScreenshot('editor-direct-nav-or-load-error', true);
        throw error;
    }
  }

  /**
   * Closes the welcome modal if it appears. More robust checking.
   */
  async closeWelcomeModalIfNeeded(timeout: number = 10000): Promise<void> {
    logger.info('Checking for welcome modal...');
    await this.page.waitForTimeout(1000);

    try {
      // Use isVisible from BasePage for check
      if (await this.isVisible(this.welcomeModalCloseButton, timeout)) {
        logger.info('Welcome modal found, attempting to close...');
        await this.welcomeModalCloseButton.click({ timeout: 5000 });
        // Confirm closure by waiting for it to be hidden
        await expect(this.welcomeModalCloseButton).not.toBeVisible({ timeout: 5000 });
        logger.info('Welcome modal closed.');
        await this.takeScreenshot('welcome-modal-closed');
      } else {
        logger.info('Welcome modal not detected or already closed.');
        await this.takeScreenshot('welcome-modal-not-found');
      }
    } catch (error) {
      logger.warn(`Could not close welcome modal (might be absent, timed out, or selector changed): ${(error as Error).message}`);
      await this.takeScreenshot('welcome-modal-close-error', true);
    }
  }

  /**
   * Navigates to the Design tab within the editor.
   */
  async navigateToDesignTab(): Promise<void> {
    logger.info('Navigating to Design tab...');
    await this.waitForVisible(this.designTab);
    await this.designTab.click();
    await this.waitForVisible(this.backgroundBorderOption);
    logger.info('Design tab selected.');
    await this.takeScreenshot('design-tab-selected');
  }

  /**
   * Changes the background color of the form.
   * @param colorHex The hex code of the color to select (e.g., '#2196F3')
   */
  async selectBackgroundColor(colorHex: string): Promise<void> {
    logger.info(`Selecting background color: ${colorHex}`);
    await this.takeScreenshot('before-background-selection');

    logger.debug('Clicking Background & Border option');
    await this.waitForVisible(this.backgroundBorderOption);
    await this.backgroundBorderOption.click();
    await this.page.waitForTimeout(1000);

    logger.debug('Clicking background color picker trigger');
    try {
      await this.waitForVisible(this.backgroundColorPickerTrigger);
      await this.backgroundColorPickerTrigger.click();
      await this.page.waitForTimeout(1000);
      await this.takeScreenshot('after-color-picker-trigger-click');
    } catch (error) {
      logger.warn(`Failed to click main color picker trigger: ${error}. Trying alternative.`);
      const altColorControl = this.page.locator('label:has-text("Background Color")').first();
      if (await this.isVisible(altColorControl, 5000)) {
        logger.info('Using alternative background color selector');
        await altColorControl.click();
        await this.page.waitForTimeout(1000);
      } else {
        await this.takeScreenshot('color-picker-trigger-fail', true);
        throw error;
      }
    }

    logger.debug('Checking if color picker container is visible');
    if (!await this.isVisible(this.colorPickerContainer, 5000)) {
        logger.warn('Color picker container not visible. Trying direct swatch click.');
        await this.takeScreenshot('color-picker-container-not-visible', true);
        const directColorSwatch = this.page.locator(`div[title="${colorHex}"]`);
        if(await this.isVisible(directColorSwatch, 5000)) {
            await directColorSwatch.click();
        } else {
            await this.takeScreenshot('color-picker-direct-swatch-fail', true);
            throw new Error('Could not find color picker container or direct color swatch');
        }
    } else {
        logger.debug(`Color picker container visible. Selecting swatch: ${colorHex}`);
         try {
            const colorSwatch = this.colorSwatchByTitle(colorHex);
            await this.waitForVisible(colorSwatch);
            await colorSwatch.click();
            await this.takeScreenshot('color-selected-in-picker');
        } catch (error) {
            logger.warn(`Failed to select exact color ${colorHex}: ${error}. Trying any color.`);
            const anyColor = this.page.locator('.swatches-picker [title]:not([title="#FFFFFF"]):not([title="transparent"])').first();
            if (await this.isVisible(anyColor, 5000)) {
                logger.info('Using alternative color swatch selection');
                await anyColor.click();
            } else {
                 await this.takeScreenshot('color-picker-any-swatch-fail', true);
                 throw error;
            }
        }
    }

    logger.debug('Confirming color selection (trying OK button or Enter)');
    await this.takeScreenshot('before-confirming-color');
    const okButton = this.page.locator('button:has-text("OK")');
    if (await this.isVisible(okButton, 3000)) {
      logger.info('OK button found, clicking...');
      await okButton.click();
    } else if (await this.isVisible(this.colorPickerOkButton, 3000)) {
      logger.info('Specific color picker OK button found, clicking...');
      await this.colorPickerOkButton.click();
    } else {
      logger.info('No OK button found, pressing Enter key as fallback');
      await this.page.keyboard.press('Enter');
    }

    await this.page.waitForTimeout(2000);

    if (await this.colorPickerContainer.isVisible({ timeout: 1000 })) {
      logger.warn('Color picker still visible after confirmation attempt, pressing Escape key');
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(1000);
    }

    logger.info(`Background color ${colorHex} selection process completed.`);
    await this.takeScreenshot(`background-color-${colorHex.substring(1)}-selected`);
  }

  /**
   * Publishes the form and retrieves the shareable link by clicking the Share App side menu.
   * @returns The URL of the published form.
   */
  async publishAndGetShareLink(): Promise<string> {
    logger.info('Publishing form...');
    await this.waitForVisible(this.publishButton);
    await this.publishButton.click();

    logger.info('Waiting for publish process (expecting Share App menu item)...');
    await this.waitForVisible(this.shareAppMenuItem, 20000);
    logger.info('Publish appears complete. Clicking Share App menu item.');

    await this.page.waitForTimeout(1000); // Small delay
    await this.shareAppMenuItem.click();

    await this.waitForVisible(this.shareLinkInput);
    logger.info('Waiting for share link input to contain a URL...');
    await expect(this.shareLinkInput).toHaveValue(/https?:\/\//, { timeout: 15000 });

    const shareUrl = await this.shareLinkInput.inputValue();
    logger.info(`Share URL retrieved: ${shareUrl}`);
    await this.takeScreenshot('share-link-retrieved');

    if (!shareUrl) {
      await this.takeScreenshot('share-link-empty-error', true);
      throw new Error('Failed to retrieve share URL after publishing.');
    }
    return shareUrl;
  }

  /**
   * Visits the published form URL and verifies its background color.
   * @param shareUrl The URL of the published form.
   * @param expectedColorHex The expected background color in hex format.
   */
  async verifyPublishedFormColor(shareUrl: string, expectedColorHex: string): Promise<void> {
    logger.info(`Verifying published form at: ${shareUrl}`);
    logger.info(`Expected background color: ${expectedColorHex}`);

    const newPage = await this.page.context().newPage();
    try {
      await newPage.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Use the utility function directly for the new page
      await takeScreenshotUtil(newPage, 'published-form-view.png');

      logger.debug(`Waiting for published form container: ${this.publishedFormContainerSelector}`);
      await newPage.waitForSelector(this.publishedFormContainerSelector, { state: "visible", timeout: 20000 });
      const formContainer = newPage.locator(this.publishedFormContainerSelector);

      // Use BasePage methods temporarily on the new page locator for consistency
      const tempBasePage = new BasePage(newPage);
      const actualColorRgb = await tempBasePage.getComputedStyle(formContainer, 'background-color');
      const expectedColorRgb = hexToRgb(expectedColorHex);

      logger.info(`Actual Form Background Color (RGB): ${actualColorRgb}`);
      logger.info(`Expected Form Background Color (RGB): ${expectedColorRgb}`);

      expect(actualColorRgb, `Background color mismatch. Expected ${expectedColorRgb} but found ${actualColorRgb}`).toBe(expectedColorRgb);
      logger.info('✅ Background color verified successfully on published page.');
      await takeScreenshotUtil(newPage, 'published-form-color-verified.png');

    } catch (error) {
      logger.error(`Error verifying published form color at ${shareUrl}:`, error);
      await takeScreenshotUtil(newPage, 'published-form-verification-error.png', {}, true);
      throw error;
    } finally {
      logger.debug('Closing temporary page used for verification.');
      await newPage.close();
    }
  }

  // --- Keep Dashboard methods for potential future use ---
  async navigateToDashboard(): Promise<void> {
    logger.info('[Dashboard Flow] Navigating to Dashboard (/users/me)...');
    await this.navigate({waitUntil: 'networkidle'});
    logger.info('[Dashboard Flow] Waiting for dashboard content to appear...');
    try {
       // Wait for either container or button, whichever appears first
      await expect(this.dashboardContainer.or(this.createNewAppButton)).toBeVisible({ timeout: 20000 });
      logger.info('[Dashboard Flow] Dashboard loaded.');
      await this.takeScreenshot('dashboard-loaded');
    } catch (error) {
      const currentUrl = this.page.url();
      logger.error(`[Dashboard Flow] Dashboard did not load correctly. Current URL: ${currentUrl}`, error);
      await this.takeScreenshot('dashboard-load-error', true);
      throw new Error(`Dashboard navigation failed. Current URL: ${currentUrl}. Error: ${(error as Error).message}`);
    }
    expect(this.page.url(), `[Dashboard Flow] Should not be on signin page. Current URL: ${this.page.url()}`).not.toContain('/signin');
  }

  async createNewFormFromDashboard(): Promise<void> {
    logger.info('[Dashboard Flow] Creating new Form Builder app from dashboard...');
    await this.waitForVisible(this.createNewAppButton);
    await this.createNewAppButton.click();
    await this.waitForVisible(this.appSelectionModal);
    await this.waitForVisible(this.formBuilderCardInModal);
    await this.waitForVisible(this.getAppLinkOnCard);
    await this.getAppLinkOnCard.click();
    await this.waitForVisible(this.templatesPageIdentifier, 20000);
    await this.page.waitForURL('**/templates?app_type=formBuilder*', { timeout: 20000 });
    await this.waitForVisible(this.startFromScratchButton);
    await this.startFromScratchButton.click();
    await this.waitForEditorLoad();
    logger.info('[Dashboard Flow] Form Builder Editor loaded via creation flow.');
    await this.takeScreenshot('editor-loaded-from-dashboard-flow');
  }
}