import { expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import { getScreenshotPath } from '../utils/screenshot-utils';

export class PricingPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(): Promise<void> {
    console.log('Navigating to pricing page in English...');
    await this.page.goto('https://www.powr.io/pricing?lang=en', {
      waitUntil: 'load',
      timeout: 30000
    });
    console.log('Waiting for page to load...');
    await this.page.waitForTimeout(2000);

    // Take a screenshot for verification
    await this.page.screenshot({ path: getScreenshotPath('pricing-page-loaded.png') });
    console.log('Pricing page loaded, URL:', this.page.url());
  }

  // Get the full price (dollar + cents) for a specific plan
  async getFullPrice(planName: string): Promise<string> {
    console.log(`Looking for ${planName} plan full price...`);

    try {
      // Get all plan cards on the page
      const planCards = await this.page.locator('.pricing-page__plan-card').all();

      // Look for the card that contains the plan name
      for (const card of planCards) {
        const cardTitle = await card.locator('h3').textContent();
        if (cardTitle?.includes(planName)) {
          // Found the right card, now get the dollar price
          const dollarPrice = await card.locator('.pricing-page__dollar-price').first().textContent() || '';

          // Special handling for Free plan which may not have cents
          if (planName === 'Free') {
            return dollarPrice; // Return just the dollar price for Free plan
          }

          // For other plans, try to get cents part
          try {
            const centsPrice = await card.locator('.pricing-page__cent-price').first().textContent({ timeout: 5000 }) || '';
            // Combine them to get the full price
            const fullPrice = dollarPrice + centsPrice.split(' ')[0]; // Get just the cents part before any space
            console.log(`${planName} full price:`, fullPrice);
            return fullPrice;
          } catch (e) {
            // If cents part isn't found, just return dollar price
            console.log(`No cents part found for ${planName}, returning dollar price:`, dollarPrice);
            return dollarPrice;
          }
        }
      }

      // If we get here, we didn't find the plan
      console.log(`Could not find ${planName} plan card`);
      await this.page.screenshot({ path: getScreenshotPath(`${planName}-plan-not-found.png`) });
      return '';
    } catch (error) {
      console.warn(`Error getting ${planName} full price:`, error);
      await this.page.screenshot({ path: getScreenshotPath(`${planName}-price-error.png`) });
      return '';
    }
  }

  // Get just the dollar part of the price (for backward compatibility)
  async getDollarPrice(planName: string): Promise<string> {
    console.log(`Looking for ${planName} plan dollar price...`);

    try {
      // Get all plan cards on the page
      const planCards = await this.page.locator('.pricing-page__plan-card').all();

      // Look for the card that contains the plan name
      for (const card of planCards) {
        const cardTitle = await card.locator('h3').textContent();
        if (cardTitle?.includes(planName)) {
          // Found the right card, now get the dollar price
          const dollarPrice = await card.locator('.pricing-page__dollar-price').first().textContent() || '';
          console.log(`${planName} dollar price:`, dollarPrice);
          return dollarPrice;
        }
      }

      // If we get here, we didn't find the plan
      console.log(`Could not find ${planName} plan card`);
      await this.page.screenshot({ path: getScreenshotPath(`${planName}-plan-not-found.png`) });
      return '';
    } catch (error) {
      console.warn(`Error getting ${planName} dollar price:`, error);
      await this.page.screenshot({ path: getScreenshotPath(`${planName}-dollar-price-error.png`) });
      return '';
    }
  }

  // Log all prices on the page including full prices
  async logAllPrices(): Promise<void> {
    try {
      console.log('Logging all prices found on page:');

      // Take a screenshot of the page
      await this.page.screenshot({ path: getScreenshotPath('pricing-plans-overview.png'), fullPage: true });

      // Get all plan titles
      const planTitles = await this.page.locator('.pricing-page__plan-card h3').allTextContents();
      console.log('All plan titles:', planTitles);

      // Try to associate each title with a full price
      for (let i = 0; i < planTitles.length; i++) {
        const title = planTitles[i];

        try {
          // Get the card for this title
          const card = this.page.locator('.pricing-page__plan-card').nth(i);

          // Get dollar price
          const dollarPrice = await card.locator('.pricing-page__dollar-price').first().textContent() || '';

          // Get cents price if it exists (with shorter timeout)
          let fullPrice = dollarPrice;
          try {
            const centsPrice = await card.locator('.pricing-page__cent-price').first().textContent({ timeout: 5000 }) || '';
            fullPrice = dollarPrice + centsPrice.split(' ')[0];
          } catch (e) {
            // If cents part times out, just use dollar price
            console.log(`No cents part found for ${title}`);
          }

          console.log(`${title} plan full price: ${fullPrice}`);

          // Also log billing cycle text if available
          try {
            const billingCycle = await card.locator('.pricing-page__billing-cycle').textContent({ timeout: 5000 });
            console.log(`${title} billing cycle: ${billingCycle}`);
          } catch (e) {
            // Ignore if no billing cycle text
          }
        } catch (e) {
          console.log(`Error getting price for ${title} plan:`, e);
        }
      }
    } catch (error) {
      console.warn('Error logging all prices:', error);
      await this.page.screenshot({ path: getScreenshotPath('pricing-log-error.png') });
    }
  }
}