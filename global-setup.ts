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

    // IMPORTANT: Verify login was successful by checking URL
    if (currentUrl.includes('/signin') || currentUrl.includes('sign_in')) {
      console.error('❌ Login failed - Still on login page. Authentication state will not be saved.');
      await page.screenshot({ path: getScreenshotPath('login-failed.png') });
      throw new Error('Login failed - still on login page after authentication attempt');
    }

    // If we got redirected to users/me, consider it successful
    if (currentUrl.includes('/users/me') || currentUrl.includes('/dashboard')) {
      console.log('✅ Login successful based on URL! Now waiting for page content to load...');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      // Check for specific dashboard elements from the HTML you shared
      const createAppButtonExists = await page.locator('button.button.button-primary.button-icon-animation:has(i.fal.fa-plus)').isVisible()
        .catch(() => false);

      console.log(`Create app button visible: ${createAppButtonExists}`);

      // Even if we can't find specific elements, if we're on the right URL, consider it a success
      console.log('✅ Login successful! Saving authentication state...');
      await context.storageState({ path: authFile });

      // Take a screenshot for verification
      await page.screenshot({ path: getScreenshotPath('login-success.png') });

      console.log('✅ Authentication setup complete. State saved to:', authFile);
      return; // End function successfully
    }

    // If we're not on signin and not on users/me, try navigating to dashboard explicitly
    console.log('⚠️ Login redirected to unexpected URL. Attempting to navigate to dashboard...');

    // Navigate to dashboard explicitly
    await page.goto('https://www.powr.io/users/me');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Check if we can access the dashboard after explicit navigation
    const dashboardUrl = page.url();
    if (dashboardUrl.includes('/users/me') || dashboardUrl.includes('/dashboard')) {
      console.log('✅ Successfully navigated to dashboard. Saving authentication state...');
      await page.screenshot({ path: getScreenshotPath('dashboard-navigation.png') });

      // Save authentication state
      await context.storageState({ path: authFile });

      console.log('✅ Authentication setup complete. State saved to:', authFile);
    } else {
      console.error('❌ Could not access dashboard after login. Current URL:', dashboardUrl);
      await page.screenshot({ path: getScreenshotPath('dashboard-access-failed.png') });
      throw new Error('Could not access dashboard after login');
    }

  } catch (error) {
    console.error('❌ Global setup error:', error);
    await page.screenshot({ path: getScreenshotPath('login-error.png') });

    // Re-throw the error to ensure the global setup fails when authentication fails
    throw error;
  } finally {
    // Clean up
    await browser.close();
  }
}

export default globalSetup;