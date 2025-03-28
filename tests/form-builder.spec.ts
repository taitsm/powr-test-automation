import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import { getScreenshotPath } from '../utils/screenshot-utils';
import { ensureAuthenticated, login } from '../utils/auth-helper';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Auth file path
const authFile = path.join(process.cwd(), '.auth/user.json');

// Create a test that handles authentication
test('Form Builder End-to-End Test', async ({ page, context }) => {
  // Step 1: Try to use stored auth or perform login
  console.log('Setting up authentication...');

  // Create context with stored auth if available
  if (fs.existsSync(authFile)) {
    await context.storageState({ path: authFile });
  }

  // Ensure we are authenticated - with forced login fallback
  let isAuthenticated = await ensureAuthenticated(page, context);

  // If authentication fails through the helper, try one more direct login
  if (!isAuthenticated) {
    console.log('Authentication failed through helper. Attempting direct login...');
    isAuthenticated = await login(page);

    if (isAuthenticated) {
      await context.storageState({ path: authFile });
    } else {
      console.error('⚠️ All authentication attempts failed. Check credentials or try manually solving CAPTCHA.');
      throw new Error('Failed to authenticate after multiple attempts.');
    }
  }

  // Log the current user agent to verify it's set correctly
  const userAgent = await page.evaluate(() => navigator.userAgent);
  console.log('Current user agent:', userAgent);

  // Step 2: Navigate directly to the Form Builder standalone page
  const formBuilderUrl = 'https://www.powr.io/plugins/form-builder/standalone?redirected_from_templates=true&app_type=formBuilder';
  console.log(`Navigating directly to Form Builder editor... URL: ${formBuilderUrl}`);
  await page.goto(formBuilderUrl);
  await page.waitForLoadState('domcontentloaded');

  console.log('Current URL:', page.url());

  // Take screenshot of form editor page
  await page.screenshot({ path: getScreenshotPath('form-editor-initial.png') });

  // Step 3: Check if we need to re-authenticate
  if (page.url().includes('signin')) {
    console.log('Redirected to login page. Attempting login again...');
    isAuthenticated = await login(page);
    if (isAuthenticated) {
      console.log(`Navigating to Form Builder editor after login... URL: ${formBuilderUrl}`);
      await page.goto(formBuilderUrl);
      await page.waitForLoadState('domcontentloaded');
    } else {
      throw new Error('Failed to authenticate when redirected to login page.');
    }
  }

  // Step 4: Close welcome modal if present
  console.log('Checking for welcome modal...');
  const welcomeModalClose = page.locator('div.ReactModal__Content.welcome-screen-modal-content i.fal.fa-times.react-modal-close');
  await page.waitForTimeout(2000);

  try {
    const hasWelcomeModal = await welcomeModalClose.isVisible({ timeout: 5000 });
    if (hasWelcomeModal) {
      console.log('Welcome modal detected, closing it...');
      await welcomeModalClose.click();
      console.log('Welcome modal closed');
    } else {
      console.log('No welcome modal detected');
    }
  } catch (e) {
    console.log('Error checking for welcome modal:', e);
    const altModalClose = page.locator('i.fal.fa-times.react-modal-close');
    const hasAltModal = await altModalClose.isVisible().catch(() => false);
    if (hasAltModal) {
      console.log('Found modal with alternative selector, closing...');
      await altModalClose.click();
    } else {
      console.log('No modal found with alternative selector');
      await page.screenshot({ path: getScreenshotPath('no-modal-found.png') });
    }
  }

  await page.screenshot({ path: getScreenshotPath('after-modal-handling.png') });

  // Step 5: Navigate to Design tab
  console.log('Clicking Design tab...');
  const designTab = page.locator('div.tab[data-qa="tab-Design"]');
  try {
    await designTab.waitFor({ state: 'visible', timeout: 10000 });
    await designTab.click();
    console.log('Design tab clicked');
  } catch (e) {
    console.log('Error finding Design tab:', e);
    await page.screenshot({ path: getScreenshotPath('design-tab-not-found.png') });
    const altDesignTab = page.locator('.tab:has-text("Design")');
    const hasAltTab = await altDesignTab.isVisible().catch(() => false);
    if (hasAltTab) {
      console.log('Found Design tab with alternative selector, clicking...');
      await altDesignTab.click();
    } else {
      throw new Error('Could not find Design tab');
    }
  }

  // Step 6: Click on Background & Border
  console.log('Clicking Background & Border option...');
  const backgroundBorderOption = page.locator('div[data-qa="powrDrilldown-background"]');
  try {
    await backgroundBorderOption.waitFor({ state: 'visible', timeout: 10000 });
    await backgroundBorderOption.click();
    console.log('Background & Border option clicked');
  } catch (e) {
    console.log('Error finding Background & Border option:', e);
    await page.screenshot({ path: getScreenshotPath('background-option-not-found.png') });
    const altBackgroundOption = page.locator('.powrDrilldown:has-text("Background & Border")');
    const hasAltOption = await altBackgroundOption.isVisible().catch(() => false);
    if (hasAltOption) {
      console.log('Found Background & Border with alternative selector, clicking...');
      await altBackgroundOption.click();
    } else {
      throw new Error('Could not find Background & Border option');
    }
  }

  // Step 7: Click on Background Color picker
  console.log('Clicking Background Color picker...');
  const backgroundColorPicker = page.locator('div[data-qa="colorpicker-backgroundColor"]');
  try {
    await backgroundColorPicker.waitFor({ state: 'visible', timeout: 10000 });
    await backgroundColorPicker.click();
    console.log('Background Color picker clicked');
  } catch (e) {
    console.log('Error finding Background Color picker:', e);
    await page.screenshot({ path: getScreenshotPath('color-picker-not-found.png') });
    const altColorPicker = page.locator('label:has-text("Background Color")').first();
    const hasAltPicker = await altColorPicker.isVisible().catch(() => false);
    if (hasAltPicker) {
      console.log('Found Background Color picker with alternative selector, clicking...');
      await altColorPicker.click();
    } else {
      throw new Error('Could not find Background Color picker');
    }
  }

  await page.screenshot({ path: getScreenshotPath('color-picker.png') });

  // Step 8: Select a color from the color picker
  console.log('Selecting a color...');
  const blueColor = page.locator('div[title="#2196F3"]');
  try {
    await blueColor.waitFor({ state: 'visible', timeout: 10000 });
    await blueColor.click();
    console.log('Blue color selected');
  } catch (e) {
    console.log('Error finding blue color:', e);
    await page.screenshot({ path: getScreenshotPath('blue-color-not-found.png') });
    const anyColor = page.locator('.swatches-picker [title]:not([title="#FFFFFF"]):not([title="transparent"])').first();
    const hasAnyColor = await anyColor.isVisible().catch(() => false);
    if (hasAnyColor) {
      console.log('Found alternative color, clicking...');
      await anyColor.click();
    } else {
      throw new Error('Could not find any color to select');
    }
  }

  // Click OK button
  const okButton = page.locator('button:has-text("OK")');
  try {
    await okButton.waitFor({ state: 'visible', timeout: 10000 });
    await okButton.click();
    console.log('OK button clicked');
  } catch (e) {
    console.log('Error finding OK button:', e);
    await page.screenshot({ path: getScreenshotPath('ok-button-not-found.png') });
    console.log('Trying to press Enter key as alternative to OK button');
    await page.keyboard.press('Enter');
  }

  // Store the selected color for later verification
  const selectedColor = '#2196F3';
  console.log(`Selected color: ${selectedColor}`);
  await page.screenshot({ path: getScreenshotPath('after-color-change.png') });

  // Step 9: Publish the form
  console.log('Clicking Publish button...');
  const publishButton = page.locator('button[data-qa="button-publish"]');
  try {
    await publishButton.waitFor({ state: 'visible', timeout: 10000 });
    await publishButton.click();
    console.log('Publish button clicked');
  } catch (e) {
    console.log('Error finding Publish button:', e);
    await page.screenshot({ path: getScreenshotPath('publish-button-not-found.png') });
    const altPublishButton = page.locator('button:has-text("Publish")');
    const hasAltButton = await altPublishButton.isVisible().catch(() => false);
    if (hasAltButton) {
      console.log('Found Publish button with alternative selector, clicking...');
      await altPublishButton.click();
    } else {
      throw new Error('Could not find Publish button');
    }
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: getScreenshotPath('after-publish.png') });

  // Step 10: Click on Share App in the side navigation menu
  console.log('Looking for Share App menu item...');
  const shareAppMenuItem = page.locator('div.side-nav__item-row:has(p.side-nav__item-label:text("Share App"))');
  try {
    await shareAppMenuItem.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Share App menu item found, clicking...');
    await shareAppMenuItem.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: getScreenshotPath('after-share-app-click.png') });
  } catch (e) {
    console.log('Error finding Share App menu item:', e);
    await page.screenshot({ path: getScreenshotPath('share-app-not-found.png') });
    const altShareAppItem = page.locator('p:text("Share App")').first();
    const hasAltItem = await altShareAppItem.isVisible().catch(() => false);
    if (hasAltItem) {
      console.log('Found Share App with alternative selector, clicking...');
      await altShareAppItem.click();
    } else {
      console.log('Could not find Share App menu item. Trying to continue...');
    }
  }

    // Step 11: Retrieve the share URL from the selector value and navigate to it
    console.log('Retrieving share URL from input element...');
    const shareUrlInput = page.locator('input.non-editable--url');
    await shareUrlInput.waitFor({ state: 'attached', timeout: 15000 });
    const shareUrl = await shareUrlInput.getAttribute('value');
    console.log(`Form published at: ${shareUrl}`);

    if (shareUrl) {
    console.log(`Navigating to published form URL: ${shareUrl}`);
    const newPage = await context.newPage();
    await newPage.goto(shareUrl);
    await newPage.waitForLoadState('domcontentloaded');
    await newPage.screenshot({ path: getScreenshotPath('published-form.png') });

    // Use the full unique selector and wait for it to be visible
    const selector = "#appView > div.formBuilder.formBuilder-v2.formElementsModule.js-form-container.enter_ani_none.none";
    await newPage.waitForSelector(selector, { state: "visible", timeout: 15000 });
    const backgroundColor = await newPage.$eval(selector, (el) => window.getComputedStyle(el).backgroundColor);

    // Helper function to convert hex color to rgb
    const hexToRgb = (hex: string) => {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgb(${r}, ${g}, ${b})`;
    };

    const selectedColor = '#2196F3';
    const expectedRgbColor = hexToRgb(selectedColor);
    console.log(`Selected Color: ${selectedColor}`);
    console.log(`Expected RGB Color: ${expectedRgbColor}`);
    console.log(`Form background color: ${backgroundColor}`);

    // Assert that the computed background color matches the expected value
    expect(backgroundColor).toBe(expectedRgbColor);

    await newPage.close();
    } else {
    console.log('No share URL found');
    }

});
