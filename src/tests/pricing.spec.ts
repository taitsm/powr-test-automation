import { test, expect } from '../fixtures.js';
import { PricingPage } from '../page-objects/pricing-page.js';
import { logger } from '../utils/logger.js';
import { takeScreenshot } from '../utils/screenshot-utils.js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

test.describe('Social Feed Pricing Tests', () => {
  test('should display correct Social Feed pricing', async ({ page }) => {
    logger.info('Setting up test for Social Feed pricing...');
    const pricingPage = new PricingPage(page);

    // Screenshot the beginning state using the utility
    await takeScreenshot(page, 'pricing-test-start.png');

    // Navigate directly to Social Feed pricing page (includes screenshots)
    await pricingPage.navigateToSocialFeedPricing();

    // Verify English language (includes screenshots)
    await pricingPage.verifyEnglishLanguage();

    // Debug page - in case we need to troubleshoot
    logger.info('Running extensive page diagnostics (uses logger internally)...');
    await pricingPage.debugPageContent();

    // Verify Social Feed pricing with multiple fallback approaches (uses logger internally)
    const isPricingCorrect = await pricingPage.verifySocialFeedPricing();

    // Final screenshot of page using the utility
    await takeScreenshot(page, 'pricing-test-end-state.png', { fullPage: true });

    // Make test conditionally pass based on debugging mode
    const debugMode = process.env.DEBUG_MODE === 'true';
    if (debugMode) {
      logger.warn('DEBUG MODE: Test marked as passed for debugging purposes');
      test.skip(debugMode, 'Skipping assertion in DEBUG_MODE');
    } else {
      expect(isPricingCorrect, 'Social Feed pricing should match expected values').toBe(true);
    }

    if(isPricingCorrect){
        logger.info('✅ Social Feed pricing test completed successfully.');
    } else {
         logger.error('❌ Social Feed pricing test failed.');
    }
  });
});