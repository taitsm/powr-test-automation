import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type { Page, PageScreenshotOptions } from '@playwright/test';
// Assuming logger is in the same directory or adjust path
import { logger } from './logger.js';

// Load environment variables
dotenv.config();

/**
 * Constants defining possible screenshot modes
 */
export const ScreenshotMode = {
  DISABLED: 'disabled',
  ENABLED: 'enabled', // Take all screenshots requested
  FAILURES_ONLY: 'failures_only' // Take only screenshots marked as failures
} as const;

// Type for screenshot modes
export type ScreenshotModeType = typeof ScreenshotMode[keyof typeof ScreenshotMode];

// Cache the mode to avoid reading env var repeatedly
let currentScreenshotMode: ScreenshotModeType | null = null;

/**
 * Gets the current screenshot mode from environment variables.
 * @returns The current screenshot mode
 */
export function getScreenshotMode(): ScreenshotModeType {
  if (currentScreenshotMode !== null) {
    return currentScreenshotMode;
  }

  const modeFromEnv = process.env.SCREENSHOT_MODE?.toLowerCase();

  if (modeFromEnv === ScreenshotMode.DISABLED) {
    currentScreenshotMode = ScreenshotMode.DISABLED;
  } else if (modeFromEnv === ScreenshotMode.FAILURES_ONLY) {
    currentScreenshotMode = ScreenshotMode.FAILURES_ONLY;
  } else if (modeFromEnv === ScreenshotMode.ENABLED) {
    currentScreenshotMode = ScreenshotMode.ENABLED;
  } else {
    // Defaulting to ENABLED as a simple default if SCREENSHOT_MODE is not set.
    if (modeFromEnv !== undefined) { // Only warn if it was set but invalid
        logger.warn(`SCREENSHOT_MODE environment variable '${process.env.SCREENSHOT_MODE}' is invalid. Defaulting to '${ScreenshotMode.ENABLED}'. Valid options: enabled, disabled, failures_only.`);
    } else {
        logger.info(`SCREENSHOT_MODE not set, defaulting to '${ScreenshotMode.ENABLED}'.`);
    }
    currentScreenshotMode = ScreenshotMode.ENABLED;
  }
  return currentScreenshotMode;
}

/**
 * Determines if a screenshot should be taken based on the current mode and failure status.
 * @param isFailure Whether the screenshot is for a failure or error.
 * @returns True if screenshot should be taken, false otherwise.
 */
export function shouldTakeScreenshot(isFailure: boolean = false): boolean {
  const mode = getScreenshotMode();

  switch (mode) {
    case ScreenshotMode.DISABLED:
      return false;
    case ScreenshotMode.FAILURES_ONLY:
      return isFailure; // Only take if marked as failure
    case ScreenshotMode.ENABLED:
      return true; // Always take if enabled
    default:
       logger.warn(`Unknown screenshot mode '${mode}', defaulting to taking screenshot.`);
       return true; // Default to taking screenshots
  }
}

/**
 * Generates a unique and descriptive file path for saving a screenshot.
 * Creates the screenshots directory if it doesn't exist.
 * @param baseFileName The desired base name for the file (e.g., 'login-error.png').
 * @returns Full path including timestamp, or undefined if directory creation fails.
 */
function generateScreenshotPath(baseFileName: string): string | undefined {
  // Define screenshots directory relative to project root (where package.json is)
  const screenshotsDir = path.join(process.cwd(), 'screenshots'); // Always use process.cwd() for consistency

  if (!fs.existsSync(screenshotsDir)) {
    try {
      logger.info(`Creating screenshots directory at: ${screenshotsDir}`);
      fs.mkdirSync(screenshotsDir, { recursive: true });
    } catch (err) {
      logger.error(`Failed to create screenshots directory at ${screenshotsDir}:`, err);
      return undefined;
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = path.basename(baseFileName, path.extname(baseFileName))
                   .replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize
  const ext = path.extname(baseFileName) || '.png';

  const fullPath = path.join(screenshotsDir, `${name}-${timestamp}${ext}`);
  logger.debug(`Generated screenshot path: ${fullPath}`);
  return fullPath;
}


/**
 * Takes a screenshot if enabled by the current screenshot mode.
 * Handles path generation and logging.
 * @param page The Playwright page object.
 * @param baseFileName The base filename for the screenshot (e.g., 'login-success.png').
 * @param options Playwright screenshot options (e.g., { fullPage: true }).
 * @param isFailure Indicates if this screenshot is related to a test failure or error.
 * @returns The path to the screenshot if taken, undefined otherwise.
 */
export async function takeScreenshot(
  page: Page,
  baseFileName: string,
  // Use the corrected type PageScreenshotOptions
  options: Omit<PageScreenshotOptions, 'path'> = {},
  isFailure: boolean = false
): Promise<string | undefined> {

  if (!shouldTakeScreenshot(isFailure)) {
    logger.debug(`Screenshot '${baseFileName}' skipped due to mode '${getScreenshotMode()}' and failure status (${isFailure}).`);
    return undefined;
  }

  const screenshotPath = generateScreenshotPath(baseFileName);

  if (!screenshotPath) {
    logger.error(`Skipping screenshot '${baseFileName}' due to path generation error.`);
    return undefined;
  }

  try {
    await page.screenshot({ ...options, path: screenshotPath });
    // Use relative path for cleaner logs
    const relativePath = path.relative(process.cwd(), screenshotPath);
    logger.info(`📸 Screenshot saved: ${relativePath}`);
    return screenshotPath;
  } catch (error) {
    logger.error(`Failed to take screenshot '${baseFileName}' to path '${screenshotPath}':`, error);
    return undefined;
  }
}

/**
 * Helper specifically for getting a screenshot path without taking it.
 * Useful for playwright configuration or direct use.
 * @param fileName The base name for the screenshot
 * @param isFailure Whether the screenshot is for a failure or error
 * @returns Full path to the screenshot, or undefined if screenshots are disabled/error.
 */
export function getScreenshotPath(fileName: string, isFailure: boolean = false): string | undefined {
    if (!shouldTakeScreenshot(isFailure)) {
        logger.debug(`Screenshot path generation for '${fileName}' skipped due to mode '${getScreenshotMode()}' and failure status (${isFailure}).`);
        return undefined;
    }
    return generateScreenshotPath(fileName);
}