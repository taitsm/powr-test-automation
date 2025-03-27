import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getScreenshotPath } from './utils/screenshot-utils';

// Load environment variables
dotenv.config();

const authFile = path.join(process.cwd(), '.auth/user.json');

// Define a realistic user agent
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

async function globalSetup() {
  // Ensure auth directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Always run in headed mode for global setup to allow manual CAPTCHA solving
  const headless = false;

  console.log('Global setup: Running in headed mode to allow manual CAPTCHA solving if needed');

  // Launch a browser with user agent
  const browser = await chromium.launch({ headless });

  // Create a new context with user agent and English language
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    locale: 'en-US', // Set English locale
    // Set Accept-Language header for English
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  const page = await context.newPage();

  try {
    // Make sure we have credentials
    const email = process.env.USER_EMAIL;
    const password = process.env.USER_PASSWORD;

    if (!email || !password) {
      throw new Error('Missing login credentials. Set USER_EMAIL and USER_PASSWORD in .env file');
    }

    console.log('Global setup: Performing login...');

    // Navigate to login page with language parameter
    await page.goto('https://www.powr.io/signin?lang=en');

    // Wait for login form to be visible
    await page.waitForSelector('#sign_in_email', { state: 'visible', timeout: 10000 });

    // Fill login form
    await page.fill('#sign_in_email', email);
    await page.fill('#new_sign_in_password', password);

    // Click the login button
    console.log('Submitting login form...');
    await page.click('#sign-in-submit');

    // Check for CAPTCHA
    console.log('Checking for CAPTCHA...');
    const captchaFrames = await page.locator('iframe[src*="recaptcha"], iframe[src*="captcha"]').count();

    if (captchaFrames > 0) {
      console.log('⚠️ CAPTCHA detected! Please solve it manually in the browser window.');
      await page.screenshot({ path: getScreenshotPath('captcha-detected.png') });
      console.log('Waiting for 30 seconds to allow manual CAPTCHA solving...');

      // Wait for manual solving
      await page.waitForTimeout(30000);
      console.log('Continuing after CAPTCHA wait period...');
    }

    // Wait for navigation to complete
    console.log('Waiting for login process to complete...');
    await page.waitForTimeout(5000);

    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL after login attempt: ${currentUrl}`);

    // Save authentication state regardless of outcome
    console.log('Saving authentication state...');
    await context.storageState({ path: authFile });

    // Take a screenshot for verification
    await page.screenshot({ path: getScreenshotPath('login-result.png') });

    console.log('Authentication setup complete. State saved to:', authFile);

  } catch (error) {
    console.error('Global setup error:', error);
    await page.screenshot({ path: getScreenshotPath('login-error.png') });
  } finally {
    // Clean up
    await browser.close();
  }
}

export default globalSetup;