import type { Page, Locator, PageScreenshotOptions } from '@playwright/test';
import { takeScreenshot as takeScreenshotUtil } from '../utils/screenshot-utils.js';
import { logger } from '../utils/logger.js';

/**
 * Base Page Object class that all other page objects extend
 */
export class BasePage {
  readonly page: Page;
  readonly url: string;

  constructor(page: Page, pathOrUrl: string = '') {
    this.page = page;
    // Ensure URL is absolute if it doesn't start with http
    if (pathOrUrl.startsWith('/') && process.env.BASE_URL) {
        this.url = new URL(pathOrUrl, process.env.BASE_URL).toString();
    } else if (pathOrUrl.startsWith('http')) {
        this.url = pathOrUrl;
    } else if (pathOrUrl) {
        this.url = pathOrUrl;
    } else {
        this.url = '';
    }
  }

  async navigate(options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit', timeout?: number } = {}): Promise<void> {
    const defaultOptions = { waitUntil: 'domcontentloaded' as const, timeout: 30000 };
    const navigationOptions = { ...defaultOptions, ...options };
    const targetUrl = this.url;
    if (!targetUrl) {
        logger.error("Navigation skipped: No URL defined for this page object.");
        return;
    }
    logger.info(`Navigating to: ${targetUrl}`);
    await this.page.goto(targetUrl, navigationOptions);
  }

  async waitForPageLoad(state: 'load' | 'domcontentloaded' | 'networkidle' = 'domcontentloaded', timeout: number = 30000): Promise<void> {
    logger.debug(`Waiting for page load state: ${state} (Timeout: ${timeout}ms)`);
    try {
      await this.page.waitForLoadState(state, { timeout });
      logger.debug(`Page reached load state: ${state}`);
    } catch (error) {
      const err = error as Error;
      logger.warn(`Warning: Wait for page load state '${state}' timed out: ${err.message}`);
      // Optionally take a screenshot on timeout
      await this.takeScreenshot(`pageload-${state}-timeout`, true);
    }
  }

  async getTitle(): Promise<string> {
    logger.debug('Getting page title');
    const title = await this.page.title();
    logger.debug(`Page title: ${title}`);
    return title;
  }

  async isVisible(locator: Locator, timeout?: number): Promise<boolean> {
    const effectiveTimeout = timeout ?? 5000;
    logger.debug(`Checking visibility of locator: ${locator} (Timeout: ${effectiveTimeout}ms)`);
    try {
      await locator.waitFor({ state: 'visible', timeout: effectiveTimeout });
      logger.debug(`Locator ${locator} is visible.`);
      return true;
    } catch (e) {
      logger.debug(`Locator ${locator} is NOT visible within timeout.`);
      return false;
    }
  }

  async waitForVisible(locator: Locator, timeout?: number): Promise<void> {
    const effectiveTimeout = timeout ?? 10000;
    const selector = locator.toString();
    logger.debug(`Waiting for locator to be visible: ${selector} (Timeout: ${effectiveTimeout}ms)`);
    try {
      await locator.waitFor({ state: 'visible', timeout: effectiveTimeout });
      logger.debug(`Locator ${selector} became visible.`);
    } catch (error) {
      const err = error as Error;
      logger.error(`Error: Element with selector '${selector}' not visible within ${effectiveTimeout}ms timeout: ${err.message}`);
      // Use the takeScreenshot method which calls the utility
      await this.takeScreenshot(`element-not-visible-${selector.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}`, true);
      throw error;
    }
  }

  async getComputedStyle(locator: Locator, property: string): Promise<string> {
     const selector = locator.toString();
     logger.debug(`Getting computed style property '${property}' for locator: ${selector}`);
    try {
      await this.waitForVisible(locator, 5000);
      const style = await locator.evaluate(
        (element, prop) => window.getComputedStyle(element).getPropertyValue(prop),
        property
      );
      logger.debug(`Computed style '${property}' for ${selector} is: ${style}`);
      return style;
    } catch (error) {
        const err = error as Error;
        logger.error(`Error getting computed style '${property}' for selector '${selector}': ${err.message}`);
        await this.takeScreenshot(`computed-style-error-${selector.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}`, true);
        throw error;
    }
  }

  /**
   * Takes a screenshot using the centralized utility function.
   * @param baseName Base name for the screenshot file.
   * @param isFailure Indicates if this screenshot is related to a failure.
   * @param options Additional Playwright screenshot options.
   * @returns The path to the saved screenshot or undefined.
   */
  async takeScreenshot(baseName: string, isFailure: boolean = false, options: Omit<PageScreenshotOptions, 'path'> = {}): Promise<string | undefined> {
    // Ensure baseName ends with .png for consistency
    const fileName = baseName.endsWith('.png') ? baseName : `${baseName}.png`;
    logger.debug(`Requesting screenshot: ${fileName} (Failure: ${isFailure})`);
    // Call the imported utility function
    return await takeScreenshotUtil(this.page, fileName, options, isFailure);
  }

  async reload(options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit', timeout?: number } = {}): Promise<void> {
    const defaultOptions = { waitUntil: 'domcontentloaded' as const, timeout: 30000 };
    const reloadOptions = { ...defaultOptions, ...options };
    logger.info(`Reloading page. Waiting for: ${reloadOptions.waitUntil}`);
    await this.page.reload(reloadOptions);
    logger.info('Page reloaded.');
  }
}