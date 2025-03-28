import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

test('Login and save authentication state', async ({ page, context }) => {
  // Get credentials from environment variables
  const email = process.env.USER_EMAIL;
  const password = process.env.USER_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing login credentials. Set USER_EMAIL and USER_PASSWORD in .env file');
  }

  console.log('Starting focused authentication test');

  // Navigate to the main site first
  console.log('Navigating to main site');
  await page.goto('https://www.powr.io');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/main-site.png' });

  // Click on the login button from the main site
  console.log('Clicking login button');
  const loginButton = page.locator('a[href*="signin"], a:has-text("Log In")').first();

  if (await loginButton.isVisible()) {
    await loginButton.click();
  } else {
    // If no login button, navigate directly
    console.log('Login button not found, navigating directly to login page');
    await page.goto('https://www.powr.io/signin');
  }

  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/login-page.png' });

  // Wait for the form to be visible
  console.log('Waiting for login form to be visible');
  await page.waitForSelector('#sign_in_email', { state: 'visible', timeout: 10000 })
    .catch(() => console.log('Email field not visible after waiting'));

  // Try to fill the form with JavaScript as a fallback
  console.log('Attempting to fill login form with JavaScript');
  await page.evaluate(({ email, password }) => {
    const emailInput = document.querySelector('#sign_in_email');
    const passwordInput = document.querySelector('#new_sign_in_password');

    if (emailInput) {
      (emailInput as HTMLInputElement).value = email;
    }

    if (passwordInput) {
      (passwordInput as HTMLInputElement).value = password;
    }
  }, { email, password });

  await page.screenshot({ path: 'screenshots/after-js-fill.png' });

  // Try regular fill as well
  console.log('Trying standard form fill as well');
  try {
    await page.fill('#sign_in_email', email);
    await page.fill('#new_sign_in_password', password);
  } catch (e) {
    console.log('Standard fill failed, continuing with JS values');
  }

  await page.screenshot({ path: 'screenshots/before-submit.png' });

  // Click the login button
  console.log('Clicking submit button');
  try {
    await page.click('#sign-in-submit');
  } catch (e) {
    // Try JavaScript click as fallback
    console.log('Standard click failed, trying JS click');
    await page.evaluate(() => {
      const button = document.querySelector('#sign-in-submit');
      if (button) (button as HTMLElement).click();
    });
  }

  // Wait for navigation to complete
  console.log('Waiting for navigation after login');
  try {
    await page.waitForNavigation({ timeout: 30000 });
  } catch (e) {
    console.log('Navigation timeout, checking URL');
  }

  // Take a screenshot and check URL
  const currentUrl = page.url();
  console.log(`Current URL after login attempt: ${currentUrl}`);
  await page.screenshot({ path: 'screenshots/after-login.png' });

  // Check if login was successful
  const isLoggedIn = !currentUrl.includes('signin') && !currentUrl.includes('sign_in');
  console.log(`Login successful: ${isLoggedIn}`);

  if (isLoggedIn) {
    // Save authentication state
    console.log('Saving authentication state');
    const authDir = path.join(process.cwd(), '.auth');

    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const authFilePath = path.join(authDir, 'user.json');
    await context.storageState({ path: authFilePath });
    console.log(`Authentication state saved to: ${authFilePath}`);

    // Verify we can access a protected page
    console.log('Verifying access to dashboard');
    await page.goto('https://www.powr.io/users/me');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/dashboard-verification.png' });

    // Look for elements that should be on the dashboard
    const hasCreateButton = await page.locator('button:has-text("Create New App")').isVisible()
      || await page.locator('button:has(i.fa-plus)').isVisible();

    console.log(`Dashboard has Create New App button: ${hasCreateButton}`);

    // If we can see dashboard elements, we're authenticated
    expect(hasCreateButton).toBeTruthy();
  } else {
    throw new Error('Login failed - not redirected to dashboard');
  }
});