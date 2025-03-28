import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import type { FullConfig, Page, BrowserContext, Browser } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { LoginPage } from '../src/page-objects/login-page.js';
import { FormBuilderPage } from '../src/page-objects/form-builder-page.js';
import { takeScreenshot } from '../src/utils/screenshot-utils.js';
import { logger } from '../src/utils/logger.js'; // Import the central logger

// Apply the stealth plugin to playwright-extra
chromium.use(stealth());

// Load environment variables
dotenv.config();

const authFile = path.join(process.cwd(), '.auth/user.json');
const CAPTCHA_WAIT_TIMEOUT = parseInt(process.env.CAPTCHA_WAIT_TIMEOUT || '60000', 10);

// Keep the init script for stealth
const initScript = `
  if (navigator.webdriver) { Object.defineProperty(navigator, 'webdriver', { get: () => false }); }
  function mockPluginsAndMimeTypes() { /* ... (script content remains the same) ... */ } mockPluginsAndMimeTypes();
  const originalQuery = navigator.permissions.query; navigator.permissions.query = (parameters) => ( parameters.name === 'notifications' ? Promise.resolve({ state: 'denied', onchange: null }) : originalQuery(parameters) );
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], });
  Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel', });
  try { const getParameter = WebGLRenderingContext.prototype.getParameter; WebGLRenderingContext.prototype.getParameter = function(parameter) { if (parameter === 37445) return 'Intel Open Source Technology Center'; if (parameter === 37446) return 'Mesa DRI Intel(R) Iris(R) Plus Graphics 655 (CFL GT3)'; return getParameter(parameter); }; } catch (e) { console.error('WebGL spoofing failed', e); }
`;

async function isCaptchaChallengeVisible(page: Page): Promise<boolean> {
    // More robust selector for CAPTCHA frames
    const captchaFrame = page.locator('iframe[src*="recaptcha"], iframe[src*="captcha"], iframe[title*="challenge"], iframe[title*="Captcha"], div[id*="captcha"] iframe');
    logger.debug('Checking for CAPTCHA challenge frame...');
    try {
        await captchaFrame.first().waitFor({ state: 'visible', timeout: 7000 });
        logger.warn('CAPTCHA challenge frame detected.');
        return true;
    } catch (e) {
         logger.debug('No CAPTCHA challenge frame detected within timeout.');
        return false;
    }
}

/**
 * Helper function to launch a stealthy browser instance.
 */
async function launchStealthBrowser(headless: boolean): Promise<Browser> {
    logger.info(`Launching ${headless ? 'headless' : 'headed'} stealth browser...`);
    // Note: chromium here is playwright-extra's chromium with stealth applied
    return await chromium.launch({
        headless,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process,Translate',
            '--disable-site-isolation-trials'
            // Consider adding '--window-size=1920,1080' if running headed
        ]
    });
}

/**
 * Attempts to verify if the saved authentication state is still valid (Strict Check).
 * Uses a stealthy browser.
 * @param config Playwright FullConfig
 * @returns boolean - True if the state is valid, false otherwise.
 */
async function verifyExistingAuthState(config: FullConfig): Promise<boolean> {
    logger.info('Verifying existing authentication state (Strict Check)...');
    let browser: Browser | null = null;
    let page: Page | null = null;
    const baseURL = config.projects[0].use?.baseURL || 'https://www.powr.io';

    try {
        browser = await launchStealthBrowser(true);
        const context = await browser.newContext({
            storageState: authFile,
            baseURL: baseURL,
            locale: 'en-US',
            extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
            viewport: { width: 1920, height: 1080 },
            userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36' // Use configured or a default UA
        });

        await context.addInitScript(initScript);
        page = await context.newPage();

        // Use LoginPage's isLoggedIn check for consistency
        const loginPage = new LoginPage(page);
        logger.info(`Navigating to ${baseURL}/users/me for strict verification...`);
        await page.goto(`${baseURL}/users/me`, { waitUntil: 'domcontentloaded', timeout: 20000 });

        if (await loginPage.isLoggedIn(15000)) {
            logger.info('✅ Existing authentication state is valid (Dashboard Check Passed).');
            await takeScreenshot(page, 'global-setup-auth-valid-strict.png');
            await context.close();
            return true;
        } else {
             logger.warn(`Existing authentication state is invalid (Strict Check Failed - isLoggedIn returned false). URL: ${page.url()}`);
             await takeScreenshot(page, 'global-setup-auth-invalid-strict.png', {}, true);
             await context.close();
             return false;
        }

    } catch (error) {
        const currentUrl = page ? page.url() : 'N/A';
        logger.error(`Error during existing auth state verification. URL: ${currentUrl}. Error: ${error}`);
        if (page) await takeScreenshot(page, 'global-setup-auth-verify-error.png', {}, true);
        return false;
    } finally {
        if (browser) {
            logger.debug('Closing browser used for auth verification.');
            await browser.close();
        }
    }
}

// --- Main globalSetup Function ---
async function globalSetup(config: FullConfig) {
    logger.info('🚀 Starting Global Setup for Authentication...');

    const authDir = path.dirname(authFile);
    if (!fs.existsSync(authDir)) {
        logger.info(`Creating auth directory: ${authDir}`);
        fs.mkdirSync(authDir, { recursive: true });
    }

    // --- Check Existing Auth State ---
    if (fs.existsSync(authFile)) {
        logger.info(`Found existing auth file: ${authFile}`);
        if (await verifyExistingAuthState(config)) {
            logger.info('Skipping login process, using existing valid authentication state.');
            logger.info('🚀 Global Setup Complete (Used Existing Auth).');
            return;
        } else {
            logger.warn('Existing authentication state is invalid or verification failed. Proceeding with fresh login.');
            try {
                fs.unlinkSync(authFile);
                logger.info('Deleted invalid/stale auth file.');
            } catch (e) {
                logger.error('Failed to delete invalid auth file:', e);
            }
        }
    } else {
        logger.info('No existing authentication state file found. Proceeding with fresh login.');
    }

    // --- Proceed with Fresh Login if needed ---
    logger.info('Performing fresh login...');
    // Consider always running headed for initial login to handle CAPTCHAs easily
    const headless = process.env.GLOBAL_SETUP_HEADLESS === 'true';
    logger.info(`Global setup (Login): Running in ${headless ? 'headless' : 'headed'} mode.`);
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
        browser = await launchStealthBrowser(headless);
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
            extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
            baseURL: config.projects[0].use?.baseURL || 'https://www.powr.io',
             userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
        });

        await context.addInitScript(initScript);
        page = await context.newPage();

        try { // Inner try for login steps
            const email = process.env.USER_EMAIL;
            const password = process.env.USER_PASSWORD;
            if (!email || !password) {
                 logger.error('Missing login credentials in .env file for global setup.');
                 throw new Error('Missing login credentials.');
            }

            const loginPage = new LoginPage(page);
            // Use the login method from LoginPage for consistency
            const loginSuccess = await loginPage.login(email, password);

            if (!loginSuccess) {
                 logger.warn('Initial login attempt failed. Checking for CAPTCHA...');
                 await takeScreenshot(page, 'global-setup-initial-login-failed.png', {}, true);

                 if (await isCaptchaChallengeVisible(page)) {
                    logger.warn(`⚠️ CAPTCHA DETECTED! Please solve manually in the browser. Waiting ${CAPTCHA_WAIT_TIMEOUT / 1000}s...`);
                    await takeScreenshot(page, 'global-setup-captcha-detected.png', {}, true);
                    // Wait for manual intervention
                    await page.waitForTimeout(CAPTCHA_WAIT_TIMEOUT);

                    logger.info('Re-verifying login after CAPTCHA wait...');
                    if (!(await loginPage.isLoggedIn(15000))) {
                        await takeScreenshot(page, 'global-setup-captcha-solving-failed.png', {}, true);
                        throw new Error(`Login failed even after manual CAPTCHA intervention timeout. URL: ${page.url()}`);
                    }
                    logger.info('✅ Login successful after manual CAPTCHA solving.');
                 } else {
                     logger.error('Login failed and no CAPTCHA detected. Aborting setup.');
                     await takeScreenshot(page, 'global-setup-login-failed-no-captcha.png', {}, true);
                     throw new Error(`Login failed without obvious CAPTCHA. Check credentials or site status. URL: ${page.url()}`);
                 }
            } else {
                 logger.info('✅ Login successful on first attempt.');
            }

            // If login succeeded (either initially or after CAPTCHA)
            logger.info('Saving new authentication state...');
            await context.storageState({ path: authFile });
            logger.info(`✅ New authentication state saved to: ${authFile}`);
            await takeScreenshot(page, 'global-setup-new-auth-saved.png');

        } catch (loginError) {
            logger.error('❌ Global setup error during login steps:', loginError);
            if(page) await takeScreenshot(page, 'global-setup-login-inner-error.png', {}, true);
            throw loginError;
        } finally {
             if (page && !page.isClosed()) {
                 logger.debug('Closing page used for login.');
             }
        }

    } catch (outerError) {
         logger.error('❌ Global setup error (Browser/Context instantiation):', outerError);
         // No page or context might exist here for screenshot
         throw outerError;
    } finally {
        if (browser && browser.isConnected()) {
            logger.info('Closing browser used for global setup login.');
            await browser.close();
        }
        logger.info('🚀 Global Setup Complete (Login block finished).');
    }
}

export default globalSetup;