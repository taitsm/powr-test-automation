import type { Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Base Page Object class that all other page objects extend
 * Contains common methods and properties used across all pages
 */
export class BasePage {
  readonly page: Page;
  readonly url: string;

  /**
   * Constructor for the base page object
   * @param page - Playwright Page object
   * @param path - Path to the page (appended to baseURL)
   */
  constructor(page: Page, path: string = '') {
    this.page = page;
    this.url = path;
  }

  /**
   * Navigate to the page
   * @returns Promise that resolves when navigation is complete
   */
  async navigate(): Promise<void> {
    await this.page.goto(this.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
  }

  /**
   * Wait for page to be fully loaded
   * @returns Promise that resolves when page is loaded
   */
  async waitForPageLoad(): Promise<void> {
    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
      await this.page.waitForLoadState('load', { timeout: 30000 });
    } catch (error) {
      // Properly type the error
      const err = error as Error;
      console.log('Wait for page load timed out:', err.message);
    }
  }

  /**
   * Get the title of the page
   * @returns Promise that resolves to the page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Check if an element is visible
   * @param locator - Playwright Locator for the element
   * @returns Promise that resolves to a boolean indicating visibility
   */
  async isVisible(locator: Locator): Promise<boolean> {
    return await locator.isVisible();
  }

  /**
   * Wait for an element to be visible
   * @param locator - Playwright Locator for the element
   * @param timeout - Optional timeout in milliseconds
   * @returns Promise that resolves when element is visible
   */
  async waitForVisible(locator: Locator, timeout?: number): Promise<void> {
    try {
      await locator.waitFor({ state: 'visible', timeout });
    } catch (error) {
      // Properly type the error
      const err = error as Error;
      console.log(`Element not visible within timeout: ${err.message}`);
      throw error;
    }
  }

  /**
   * Get the computed style property of an element
   * @param locator - Playwright Locator for the element
   * @param property - CSS property to get
   * @returns Promise that resolves to the computed style value
   */
  async getComputedStyle(locator: Locator, property: string): Promise<string> {
    return await locator.evaluate(
      (element, prop) => window.getComputedStyle(element).getPropertyValue(prop),
      property
    );
  }

  /**
   * Take a screenshot and save it to a file
   * @param name - Optional name for the screenshot
   * @returns Promise that resolves to the path where the screenshot was saved
   */
  async takeScreenshot(name?: string): Promise<string> {
    // Make sure the screenshots directory exists
    const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const screenshotPath = path.join(screenshotsDir, `${name || 'screenshot'}-${Date.now()}.png`);
    await this.page.screenshot({ path: screenshotPath });
    return screenshotPath;
  }

  /**
   * Take a screenshot and return it as a buffer
   * @returns Promise that resolves to a buffer containing the screenshot
   */
  async captureScreenshot(): Promise<Buffer> {
    return await this.page.screenshot();
  }

  /**
   * Reload the current page
   * @returns Promise that resolves when page is reloaded
   */
  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }
}