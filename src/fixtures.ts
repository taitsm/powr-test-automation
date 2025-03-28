import { test as base, expect as baseExpect, type Page, type Browser, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './utils/logger.js';
import { takeScreenshot } from './utils/screenshot-utils.js';

// Define the init script (keep it consistent with global setup)
const initScript = `
  if (navigator.webdriver) { Object.defineProperty(navigator, 'webdriver', { get: () => false }); }
  function mockPluginsAndMimeTypes() { /* ... (script content remains the same) ... */ } mockPluginsAndMimeTypes();
  const originalQuery = navigator.permissions.query; navigator.permissions.query = (parameters) => ( parameters.name === 'notifications' ? Promise.resolve({ state: 'denied', onchange: null }) : originalQuery(parameters) );
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], });
  Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel', });
  try { const getParameter = WebGLRenderingContext.prototype.getParameter; WebGLRenderingContext.prototype.getParameter = function(parameter) { if (parameter === 37445) return 'Intel Open Source Technology Center'; if (parameter === 37446) return 'Mesa DRI Intel(R) Iris(R) Plus Graphics 655 (CFL GT3)'; return getParameter(parameter); }; } catch (e) { console.error('WebGL spoofing failed', e); }
`;

const authFile = path.join(process.cwd(), '.auth/user.json');

// Extend the base test fixture
type MyFixtures = {
  page: Page;
  context: BrowserContext;
  authCheck: (page: Page) => Promise<boolean>;
};

export const test = base.extend<MyFixtures>({
  // Extend the context fixture to ensure authentication state is loaded AND init script applied
  context: async ({ browser, browserName }, use) => {
    logger.debug(`Creating new browser context for test (Browser: ${browserName})`);
    let contextOptions: any = { // Use 'any' for flexibility with storageState
       // Apply standard options from config if needed, or rely on global 'use'
       locale: 'en-US',
       extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
       viewport: { width: 1920, height: 1080 },
       userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
    };

    // Load storageState *only if* the file exists
    if (fs.existsSync(authFile)) {
      logger.debug(`Loading storage state from: ${authFile}`);
      contextOptions.storageState = authFile;
    } else {
      logger.warn(`Auth file not found at ${authFile}. Context will be created without stored state.`);
    }

    // Create the context
    const context = await browser.newContext(contextOptions);

    // Apply the anti-detection init script to every page in this context
    logger.debug('Adding init script to the context.');
    await context.addInitScript(initScript);

    // Use the prepared context for the test
    await use(context);

    // Cleanup after the test
    logger.debug('Closing browser context.');
    await context.close();
  },

  // The page fixture automatically uses the modified context
  page: async ({ context }, use) => {
    logger.debug('Creating new page within the test context.');
    const page = await context.newPage();
    // Optional: Add error listener for uncaught exceptions on the page
    page.on('pageerror', exception => {
        logger.error(`Uncaught exception on page: "${exception.message}"`, exception);
    });
    await use(page);
    // page is closed automatically when context closes
     logger.debug('Page fixture cleanup (usually automatic with context close).');
  },

  // Add a helper utility fixture to quickly verify authentication status within a test
  authCheck: async ({}, use) => {
    const checkAuth = async (page: Page): Promise<boolean> => {
       logger.debug('Executing authCheck fixture...');
      // Use a known protected URL
      const protectedUrl = 'https://www.powr.io/users/me';
      try {
        logger.debug(`Navigating to ${protectedUrl} for auth check.`);
        const response = await page.goto(protectedUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 10000
        });

        const currentUrl = page.url();
        const status = response?.status();
        const isOnLoginPage = currentUrl.includes('/signin') || currentUrl.includes('/sign_in');

        if (status && status < 400 && !isOnLoginPage) {
             logger.debug(`AuthCheck Passed: Status ${status}, URL ${currentUrl}`);
             return true;
        } else {
             logger.warn(`AuthCheck Failed: Status ${status}, URL ${currentUrl}, OnLoginPage: ${isOnLoginPage}`);
             await takeScreenshot(page, 'authcheck-fixture-failed.png', {}, true);
             return false;
        }
      } catch (error) {
        logger.error('AuthCheck navigation/verification error:', error);
        await takeScreenshot(page, 'authcheck-fixture-error.png', {}, true);
        return false;
      }
    };
    // Provide the checkAuth function to the test
    await use(checkAuth);
  }
});

// Re-export expect and other types if needed
export const expect = baseExpect;
export type { Page, Browser, BrowserContext };