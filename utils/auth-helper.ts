import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getScreenshotPath } from './screenshot-utils';

// Load environment variables
dotenv.config();

// Path to store authentication state
const authFile = path.join(process.cwd(), '.auth/user.json');

// Define user agent - same as in playwright.config.ts
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

/**
 * Check if we're already authenticated
 * @returns true if authentication file exists
 */
export function hasStoredAuth(): boolean {
  return fs.existsSync(authFile);
}

/**
 * Save authentication state to file
 * @param context Browser context from playwright test
 */
export async function saveAuthState(context: any): Promise<void> {
  // Ensure directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Save auth state
  await context.storageState({ path: authFile });
  console.log('Authentication state saved to:', authFile);
}

/**
 * Verify authentication by checking if we can access a protected page
 * @param page Playwright page
 * @returns Whether authentication is valid
 */
export async function verifyAuthentication(page: any): Promise<boolean> {
    try {
      // Try to navigate to a page that requires authentication - use domcontentloaded
      console.log('Verifying authentication...');
      await page.goto('https://www.powr.io/users/me', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // Wait a moment for redirects
      await page.waitForTimeout(3000);

      // Take a screenshot to see where we are
      await page.screenshot({ path: getScreenshotPath('auth-verification.png') });

      // Get the current URL
      const url = page.url();
      console.log(`Current URL during auth verification: ${url}`);

      // Check if we're still on a page that's accessible only to authenticated users
      const isAuthenticated = !url.includes('/signin') && !url.includes('/sign_in');

      console.log(`Authentication verification: ${isAuthenticated ? 'Succeeded' : 'Failed'}`);
      return isAuthenticated;
    } catch (error) {
      console.log('Error verifying authentication:', error);
      return false;
    }
  }

/**
 * Perform login procedure
 * @param page Playwright page
 * @returns Whether login was successful
 */
export async function login(page: any): Promise<boolean> {
    try {
      console.log('Performing login process...');

      // Get credentials
      const email = process.env.USER_EMAIL;
      const password = process.env.USER_PASSWORD;

      if (!email || !password) {
        throw new Error('Missing login credentials. Set USER_EMAIL and USER_PASSWORD in .env file');
      }

      // Navigate to login page - use domcontentloaded instead of load
      await page.goto('https://www.powr.io/signin?lang=en', {
        waitUntil: 'domcontentloaded'
      });

      // Wait for page to stabilize
      await page.waitForTimeout(3000);

      // Take a screenshot before trying to find elements
      await page.screenshot({ path: getScreenshotPath('login-page-before-fill.png') });

      // Use JavaScript to fill the form instead of waiting for visibility
      await page.evaluate((credentials: { email: string; password: string }) => {
        const emailInput = document.querySelector('#sign_in_email');
        const passwordInput = document.querySelector('#new_sign_in_password');

        if (emailInput) {
          (emailInput as HTMLInputElement).value = credentials.email;
        }

        if (passwordInput) {
          (passwordInput as HTMLInputElement).value = credentials.password;
        }
      }, { email, password });

      // Take screenshot after filling form
      await page.screenshot({ path: getScreenshotPath('login-filled.png') });

      // Submit form using JavaScript
      await page.evaluate(() => {
        const submitButton = document.querySelector('#sign-in-submit');
        if (submitButton) {
          (submitButton as HTMLElement).click();
        }
      });

      // Wait for navigation to complete
      await page.waitForTimeout(5000);

      // Verify login success by checking URL
      const currentUrl = page.url();
      const isLoggedIn = !currentUrl.includes('/signin') && !currentUrl.includes('/sign_in');

      if (isLoggedIn) {
        console.log('✅ Login successful!');
        return true;
      } else {
        console.log('❌ Login failed - still on login page');
        await page.screenshot({ path: getScreenshotPath('login-failed.png') });
        return false;
      }
    } catch (error) {
      console.error('Error during login:', error);
      await page.screenshot({ path: getScreenshotPath('login-error.png') });
      return false;
    }
  }

/**
 * Ensure the page is authenticated, performing login if necessary
 * @param page Playwright page
 * @param context Browser context to save successful auth state
 * @returns Whether authentication was successful
 */
export async function ensureAuthenticated(page: any, context: any): Promise<boolean> {
  // First try using stored auth if available
  if (hasStoredAuth()) {
    console.log('Using stored authentication state...');

    try {
      // Verify if the current page access works
      if (await verifyAuthentication(page)) {
        return true;
      }
    } catch (e) {
      console.log('Error using stored auth:', e);
    }

    console.log('Stored authentication expired or invalid.');
  }

  // If we reach here, we need to log in manually
  const loginSuccess = await login(page);

  if (loginSuccess) {
    // Save successful auth state for future tests
    await saveAuthState(context);

    // Double-check authentication
    const isAuthenticated = await verifyAuthentication(page);

    if (!isAuthenticated) {
      console.warn('Warning: Login appeared successful but verification failed. Continuing anyway...');
    }

    // Return success from login, regardless of verification
    return loginSuccess;
  }

  return false;
}