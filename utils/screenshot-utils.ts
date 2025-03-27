import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Constants defining possible screenshot modes
 */
export const ScreenshotMode = {
  DISABLED: 'disabled',
  ENABLED: 'enabled',
  FAILURES_ONLY: 'failures_only'
} as const;

// Type for screenshot modes
export type ScreenshotModeType = typeof ScreenshotMode[keyof typeof ScreenshotMode];

/**
 * Gets the current screenshot mode from environment variables
 * @returns The current screenshot mode
 */
export function getScreenshotMode(): ScreenshotModeType {
  const mode = process.env.SCREENSHOT_MODE?.toLowerCase();

  if (mode === ScreenshotMode.DISABLED) {
    return ScreenshotMode.DISABLED;
  } else if (mode === ScreenshotMode.FAILURES_ONLY) {
    return ScreenshotMode.FAILURES_ONLY;
  } else {
    return ScreenshotMode.ENABLED; // Default value
  }
}

/**
 * Determines if a screenshot should be taken based on the current mode and failure status
 * @param isFailure Whether the screenshot is for a failure or error
 * @returns True if screenshot should be taken, false otherwise
 */
export function shouldTakeScreenshot(isFailure: boolean = false): boolean {
  const mode = getScreenshotMode();

  if (mode === ScreenshotMode.DISABLED) {
    return false;
  } else if (mode === ScreenshotMode.FAILURES_ONLY) {
    return isFailure;
  } else {
    return true; // ENABLED mode
  }
}

/**
 * Gets a file path for saving a screenshot in the screenshots directory
 * @param fileName The base name for the screenshot
 * @param isFailure Whether the screenshot is for a failure or error
 * @returns Full path to the screenshot in the screenshots directory with timestamp,
 *          or undefined if screenshots are disabled for this situation
 */
export function getScreenshotPath(fileName: string, isFailure: boolean = false): string | undefined {
  // Check if screenshots should be taken
  if (!shouldTakeScreenshot(isFailure)) {
    console.log(`Screenshot '${fileName}' skipped - screenshots ${isFailure ? 'for non-failures ' : ''}are disabled`);
    return undefined;
  }

  const screenshotsDir = path.join(process.cwd(), 'screenshots');

  // Create directory if it doesn't exist
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Timestamp to filename to prevent overwriting
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = fileName.replace(/\.\w+$/, '');
  const ext = fileName.match(/\.\w+$/)?.[0] || '.png';

  return path.join(screenshotsDir, `${name}-${timestamp}${ext}`);
}

/**
 * Takes a screenshot if enabled by the current screenshot mode
 * @param page The Playwright page object
 * @param fileName The filename for the screenshot
 * @param options Screenshot options
 * @param isFailure Whether this is a failure screenshot
 * @returns The path to the screenshot if taken, undefined otherwise
 */
export async function takeScreenshot(
  page: any,
  fileName: string,
  options: any = {},
  isFailure: boolean = false
): Promise<string | undefined> {
  const path = getScreenshotPath(fileName, isFailure);

  if (path) {
    await page.screenshot({ ...options, path });
    console.log(`Screenshot saved: ${path}`);
    return path;
  }

  return undefined;
}