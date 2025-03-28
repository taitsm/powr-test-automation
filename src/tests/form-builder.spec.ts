import { test, expect, type Page } from '../fixtures.js';
import { FormBuilderPage } from '../page-objects/form-builder-page.js';
import { LoginPage } from '../page-objects/login-page.js';
import * as dotenv from 'dotenv';
import { takeScreenshot } from '../utils/screenshot-utils.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Path to check for auth file
const authFile = path.join(process.cwd(), '.auth/user.json');

test.describe('Form Builder E2E - Direct Editor Flow', () => {
  let formBuilderPage: FormBuilderPage;
  let loginPage: LoginPage;
  const testColorHex = '#2196F3'; // Example blue color from old spec

  // Use test.use for page objects to ensure fresh instances per worker/test
  test.use({
    page: async ({ page }, use) => {
        loginPage = new LoginPage(page);
        formBuilderPage = new FormBuilderPage(page);
        await use(page);
    },
  });

  test.beforeEach(async ({ page, authCheck }: { page: Page, authCheck: (page: Page) => Promise<boolean> }) => {
    logger.info(`[BeforeEach] Setting up for test: ${test.info().title}`);

    // --- Auth Verification ---
    logger.info(`[BeforeEach] Verifying authentication state...`);

    // Check if our session is valid
    const isAuthenticated = await authCheck(page);

    // If not authenticated and there's an auth file, it might be stale
    if (!isAuthenticated && fs.existsSync(authFile)) {
      logger.warn('[BeforeEach] Auth state exists but appears invalid. It might be stale.');
      // Consider clearing auth here if needed: clearStoredAuth();
    }

    // Fallback login only if absolutely necessary
    if (!isAuthenticated) {
      logger.warn('[BeforeEach] Not authenticated. Attempting fallback login...');
      await takeScreenshot(page, 'beforeEach-auth-check-failed.png', {}, true);

      const email = process.env.USER_EMAIL;
      const password = process.env.USER_PASSWORD;

      if (!email || !password) {
        logger.error("[BeforeEach] Missing login credentials (USER_EMAIL or USER_PASSWORD) in .env file.");
        throw new Error("[BeforeEach] Missing login credentials (USER_EMAIL or USER_PASSWORD) in .env file.");
      }

      // Only perform login if authentication verification failed
      try {
        const loginSuccess = await loginPage.login(email, password);
        if (!loginSuccess) {
            logger.error('[BeforeEach] Fallback login attempt failed.');
            await takeScreenshot(page, 'beforeEach-fallback-login-failure.png', {}, true);
            throw new Error('[BeforeEach] Fallback login failed');
        }
        logger.info(`[BeforeEach] Fallback login successful.`);
        // Screenshot managed within loginPage.login success path
      } catch (error) {
        logger.error(`[BeforeEach] Fallback login process error: ${(error as Error).message}`);
        await takeScreenshot(page, 'beforeEach-fallback-login-error.png', {}, true);
        throw new Error(`[BeforeEach] Authentication failed, cannot proceed with test.`);
      }
    } else {
      logger.info('[BeforeEach] Successfully verified authentication.');
      await takeScreenshot(page, 'beforeEach-auth-check-passed.png');
    }

    // --- Navigate Directly to Editor ---
    logger.info(`[BeforeEach] Navigating directly to Form Builder editor...`);
    try {
      await formBuilderPage.navigateDirectlyToEditor(); // This method includes waitForEditorLoad and screenshots
    } catch (error) {
        logger.error(`[BeforeEach] Failed to navigate directly to editor: ${(error as Error).message}`);
        // Screenshot is taken within navigateDirectlyToEditor on failure
        throw error; // Fail fast if editor cannot be reached
    }

    // --- Close Welcome Modal ---
    logger.info(`[BeforeEach] Closing welcome modal if present...`);
    await formBuilderPage.closeWelcomeModalIfNeeded(); // Handles if modal doesn't appear and takes screenshots

    logger.info(`[BeforeEach] Setup complete. Starting test.`);
    await takeScreenshot(page, 'beforeEach-setup-complete.png');
  });

  test('should allow changing form background color and verify on published page', async ({ page }) => {
    logger.info('Starting test: Change background color and verify.');

    // Test logic starts here - assumes beforeEach successfully navigated to the editor
    await formBuilderPage.navigateToDesignTab(); // Includes screenshots
    await formBuilderPage.selectBackgroundColor(testColorHex); // Includes screenshots

    // Publish and get the link
    const shareUrl = await formBuilderPage.publishAndGetShareLink(); // Includes screenshots
    expect(shareUrl, 'Share URL should be retrieved after publishing').toBeTruthy();
    logger.info(`Published form URL: ${shareUrl}`);

    // Verify the color on the published page
    await formBuilderPage.verifyPublishedFormColor(shareUrl, testColorHex); // Includes screenshots

    logger.info('✅ Test completed: Form Builder background color changed and verified successfully.');
    await takeScreenshot(page, 'test-formbuilder-color-success.png');
  });

  // Add more tests using the same setup if needed
});