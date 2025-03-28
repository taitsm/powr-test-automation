import { expect, type Page, type Locator } from '@playwright/test';
import { BasePage } from './base-page.js';
// Adjust path to utils
import { logger } from '../utils/logger.js';
import { takeScreenshot as takeScreenshotUtil } from '../utils/screenshot-utils.js';

export class PricingPage extends BasePage {
  // Multiple selectors for pricing cards to increase chances of finding them
  readonly pricingCardSelectors: string[] = [
    '.pricing-page__tablet-card',
    '.pricing-card',
    '.price-card',
    '.plan-card',
    '[class*="pricing"][class*="card"]',
    '[class*="plan"][class*="card"]',
    '.pricing-section',
    '[data-pricing]',
    '[data-plan]'
  ];

  constructor(page: Page) {
    super(page, '/pricing?lang=en');
  }

  /**
   * Navigates directly to Social Feed pricing page using URL parameter
   * with extended waits and debugging
   */
  async navigateToSocialFeedPricing(): Promise<void> {
    logger.info('Navigating directly to Social Feed pricing...');
    const url = '/pricing?app_type=socialFeed&lang=en';

    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Extended wait to ensure the page has time to load fully
    await this.page.waitForTimeout(5000);

    // Wait for any potential loading indicators to disappear
    try {
      await this.page.waitForSelector('.loading, .loader, .spinner', {
        state: 'detached',
        timeout: 10000
      }).catch(() => logger.info('No loading indicators found'));
    } catch (e) {
      logger.warn('Error waiting for loading indicators:', e);
    }

    await takeScreenshotUtil(this.page, 'social-feed-pricing-page.png');

    // Confirm we landed on the right page
    const currentUrl = this.page.url();
    logger.info(`Current URL: ${currentUrl}`);
    expect(currentUrl).toContain('app_type=socialFeed');

    logger.info('Successfully loaded Social Feed pricing page');
  }

  /**
   * Very extensive debugging to diagnose what's on the page
   */
  async debugPageContent(): Promise<void> {
    logger.debug('--- EXTENSIVE PAGE DEBUGGING ---');

    // Get page title
    const title = await this.page.title();
    logger.debug(`Page Title: ${title}`);

    // Body classes
    const bodyClasses = await this.page.evaluate(() => document.body.className);
    logger.debug(`Body Classes: ${bodyClasses}`);

    // Try all potential card selectors
    for (const selector of this.pricingCardSelectors) {
      const count = await this.page.locator(selector).count();
      logger.debug(`Selector "${selector}": found ${count} elements`);

      if (count > 0) {
        // If we found elements, log more details
        const firstElementHtml = await this.page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? el.outerHTML.substring(0, 200) + '...' : 'null';
        }, selector);
        logger.debug(`First ${selector} HTML: ${firstElementHtml}`);
      }
    }

    // Look for any price-like elements
    logger.debug('Looking for price-related elements:');
    const priceSelectors = [
      '[class*="price"]',
      '[class*="dollar"]',
      '[class*="cost"]',
      '[data-price]'
    ];

    for (const selector of priceSelectors) {
      try {
        const count = await this.page.locator(selector).count();
        logger.debug(`Price selector "${selector}": found ${count} elements`);

        if (count > 0) {
          const texts = await this.page.locator(selector).allTextContents();
          logger.debug(`  Text content: ${texts.slice(0, 5).join(', ')}${texts.length > 5 ? '...' : ''}`);
        }
      } catch (e) {
        logger.warn(`Error with selector "${selector}":`, e);
      }
    }

    // Add a special check for dollar sign in h3 elements using Playwright's method
    try {
      const dollarH3 = this.page.locator('h3:has-text("$")');
      const dollarH3Count = await dollarH3.count();
      logger.debug(`Found ${dollarH3Count} h3 elements with dollar signs`);
      if (dollarH3Count > 0) {
        const texts = await dollarH3.allTextContents();
        logger.debug(`  Text content: ${texts.slice(0, 5).join(', ')}${texts.length > 5 ? '...' : ''}`);
      }
    } catch (e) {
      logger.warn('Error finding h3 elements with dollar signs:', e);
    }

    // Dump a section of the page HTML
    const pageContent = await this.page.content();
    logger.debug('Page content sample:');
    logger.debug(pageContent.substring(0, 1000) + '...');

    logger.debug('--- END DEBUGGING ---');
  }

  /**
   * Get pricing data using a very robust approach that doesn't rely
   * on specific selectors but looks for patterns in the HTML
   */
  async getSocialFeedPricingWithFallbacks(): Promise<Array<{name: string, price: string}>> {
    logger.info('Getting Social Feed pricing with multiple fallback approaches...');

    // Try multiple approaches and aggregate the results
    const results: Array<{name: string, price: string}> = [];

    // Approach 1: Try to find structured pricing cards
    const structuredPricing = await this.getStructuredPricingData();
    if (structuredPricing.length > 0) {
      logger.info('Found pricing through structured approach');
      results.push(...structuredPricing);
    }

    // Approach 2: Try to find pricing in sections
    if (results.length === 0) {
      logger.info('Trying section-based pricing approach...');
      const sectionPricing = await this.getSectionBasedPricing();
      if (sectionPricing.length > 0) {
        logger.info('Found pricing through section-based approach');
        results.push(...sectionPricing);
      }
    }

    // Approach 3: Text-based extraction as absolute last resort
    if (results.length === 0) {
      logger.info('Trying text pattern extraction as last resort...');
      const textPricing = await this.getTextBasedPricing();
      if (textPricing.length > 0) {
        logger.info('Found pricing through text pattern extraction');
        results.push(...textPricing);
      }
    }

    logger.info(`Found ${results.length} pricing entries with all approaches combined:`);
    results.forEach((item, i) => {
      logger.info(`  ${i+1}. ${item.name}: ${item.price}`);
    });

    return results;
  }

  /**
   * Structured approach - look for specific card structures
   */
  private async getStructuredPricingData(): Promise<Array<{name: string, price: string}>> {
    const results: Array<{name: string, price: string}> = [];

    // Try each card selector
    for (const cardSelector of this.pricingCardSelectors) {
      const cards = this.page.locator(cardSelector);
      const count = await cards.count();

      if (count > 0) {
        logger.debug(`Found ${count} cards using selector "${cardSelector}"`);

        // Extract pricing from each card
        for (let i = 0; i < count; i++) {
          const card = cards.nth(i);

          // Try various selectors for plan name
          const nameSelectors = [
            '.pricing-page__header-tablet',
            '[class*="header"]',
            '[class*="title"]',
            'h2, h3, h4'
          ];

          let name = '';
          for (const selector of nameSelectors) {
            const nameElement = card.locator(selector).first();
            if (await nameElement.count() > 0) {
              name = (await nameElement.textContent() || '').trim();
              if (name) break;
            }
          }

          // Try various selectors for price
          const priceSelectors = [
            '.pricing-page__dollar-price',
            '[class*="price"]',
            '[class*="dollar"]',
            'h3:has-text("$")'
          ];

          let price = '';
          for (const selector of priceSelectors) {
            const priceElement = card.locator(selector).first();
            if (await priceElement.count() > 0) {
              price = (await priceElement.textContent() || '').trim();
              if (price) break;
            }
          }

          // If we have both name and price, add to results
          if (name && price) {
            // Check for cents
            const centSelectors = [
              '.pricing-page__cent-price',
              '[class*="cent"]'
            ];

            for (const selector of centSelectors) {
              const centElement = card.locator(selector).first();
              if (await centElement.count() > 0) {
                const cent = (await centElement.textContent() || '').trim();
                if (cent) {
                  price += cent;
                  break;
                }
              }
            }

            results.push({ name, price });
          }
        }

        // If we found results with this selector, no need to try others
        if (results.length > 0) break;
      }
    }

    return results;
  }

  /**
   * Section-based approach - look for pricing in sections
   */
  private async getSectionBasedPricing(): Promise<Array<{name: string, price: string}>> {
    const results: Array<{name: string, price: string}> = [];

    // Look for sections that might contain pricing
    const sectionSelectors = [
      '.pricing-section',
      '[class*="pricing-section"]',
      '[id*="pricing"]',
      'section'
    ];

    for (const sectionSelector of sectionSelectors) {
      const sections = this.page.locator(sectionSelector);
      const count = await sections.count();

      if (count > 0) {
        logger.debug(`Found ${count} sections using selector "${sectionSelector}"`);

        // Look for plan names and prices in each section
        const knownPlans = ['Free', 'Starter', 'Pro', 'Business', 'Enterprise'];

        // For each known plan, try to find its price in the sections
        for (const planName of knownPlans) {
          // First try to find a section with the plan name
          const planSections = this.page.locator(`${sectionSelector}:has-text("${planName}")`);
          const planCount = await planSections.count();

          if (planCount > 0) {
            // Look for prices in this section
            const priceElements = planSections.locator(':has-text("$")');
            const priceCount = await priceElements.count();

            if (priceCount > 0) {
              const priceTexts = await priceElements.allTextContents();
              // Find the first text that has a dollar sign
              const priceText = priceTexts.find(text => text.includes('$')) || '';

              if (priceText) {
                // Extract just the price part
                const price = priceText.match(/\$[\d.,]+(\.\d+)?(\s*\/\s*mo)?/)
                  ? priceText.match(/\$[\d.,]+(\.\d+)?(\s*\/\s*mo)?/)![0]
                  : priceText;

                results.push({ name: planName, price });
              }
            }
          }
        }

        // If we found results, no need to try other section selectors
        if (results.length > 0) break;
      }
    }

    return results;
  }

  /**
   * Text-based approach - look for patterns in the page text as last resort
   */
  private async getTextBasedPricing(): Promise<Array<{name: string, price: string}>> {
    const results: Array<{name: string, price: string}> = [];

    // Get all text from the page
    const bodyText = await this.page.locator('body').textContent() || '';

    // Look for known plan names and try to find prices near them
    const knownPlans = ['Free', 'Starter', 'Pro', 'Business', 'Enterprise'];

    for (const planName of knownPlans) {
      // Look for the plan name followed by price pattern
      const pattern = new RegExp(`${planName}[\\s\\S]{1,100}\\$(\\d+(\\.\\d+)?)`, 'i');
      const match = bodyText.match(pattern);

      if (match) {
        const price = '$' + match[1];
        results.push({ name: planName, price });
      }
    }

    return results;
  }

  /**
   * Verifies Social Feed pricing in a flexible way
   */
  async verifySocialFeedPricing(): Promise<boolean> {
    logger.info('Verifying Social Feed pricing...');

    // Run extensive debugging to see what's on the page
    await this.debugPageContent();

    // Get pricing with all fallback approaches
    const pricingData = await this.getSocialFeedPricingWithFallbacks();

    // Expected pricing patterns for Social Feed
    const expectedPrices = [
      { name: 'Free', pattern: /^\$0/ },
      { name: 'Starter', pattern: /^\$4\.94/ },
      { name: 'Pro', pattern: /^\$12\.14/ },
      { name: 'Business', pattern: /^\$80\.99/ }
    ];

    // Check each expected price
    let allPricesFound = true;

    for (const expected of expectedPrices) {
      // Find the plan
      const plans = pricingData.filter(p =>
        p.name.toLowerCase() === expected.name.toLowerCase());

      // Check if any matching plan has the right price
      const correctPricePlan = plans.find(p => expected.pattern.test(p.price));

      if (correctPricePlan) {
        logger.info(`✅ ${expected.name} plan pricing matches expected pattern: ${correctPricePlan.price}`);
      } else if (plans.length > 0) {
        logger.error(`❌ ${expected.name} plan found, but price doesn't match expected pattern. Found: ${plans[0].price}`);
        allPricesFound = false;
      } else {
        logger.error(`❌ ${expected.name} plan not found`);
        allPricesFound = false;
      }
    }

    if (!allPricesFound) {
      await takeScreenshotUtil(this.page, 'pricing-verification-failed.png', {}, true);
    }

    return allPricesFound;
  }

  /**
   * Verifies page language is English
   */
  async verifyEnglishLanguage(): Promise<void> {
    logger.info('Verifying page language is English...');
    try {
      const bodyText = await this.page.locator('body').textContent({ timeout: 10000 });

      // Look for common English pricing terms
      const englishTerms = ['Free', 'Plan', 'Pricing', 'Monthly', 'Annually', 'Starter', 'Pro'];
      const foundTerms = englishTerms.filter(term => bodyText?.includes(term));

      if (foundTerms.length >= 3) {
        logger.info(`Found ${foundTerms.length} English terms: ${foundTerms.join(', ')}`);
        logger.info('Language verification passed - page is in English');
        await takeScreenshotUtil(this.page, 'english-language-confirmed.png');
        return;
      }

      logger.error('Page does not appear to be in English');
      await takeScreenshotUtil(this.page, 'english-language-error.png', {}, true);
      throw new Error('Page language verification failed - not in English');

    } catch (error) {
      logger.error('Error verifying page language:', error);
      await takeScreenshotUtil(this.page, 'language-verification-error.png', {}, true);
      throw error;
    }
  }
}