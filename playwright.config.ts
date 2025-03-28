import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { logger } from './dist/utils/logger.js';

// Define a consistent user agent to use throughout tests
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

// Define the path for the compiled global setup script
const globalSetupPath = path.resolve(process.cwd(), 'dist/global-setup.js');
const authFile = path.join(process.cwd(), '.auth/user.json');

logger.info(`Using global setup script: ${globalSetupPath}`);
logger.info(`Using auth file: ${authFile}`);

export default defineConfig({
  testDir: './src/tests',
  outputDir: 'test-results/',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],

  // Global setup script runs once before all tests
  globalSetup: globalSetupPath,

  // Default settings applied to all test runs
  use: {
    // --- Core settings ---
    baseURL: 'https://www.powr.io',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'off',

    // --- Browser/Context settings ---
    viewport: { width: 1920, height: 1080 },
    userAgent: USER_AGENT,
    locale: 'en-US',
    timezoneId: 'UTC',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    },
    headless: undefined,
    serviceWorkers: 'block',
    launchOptions: {
        // slowMo: process.env.CI ? undefined : 50,
    },
    contextOptions: {
        javaScriptEnabled: true,
    },
    bypassCSP: false,

    // Load auth state from global setup
    storageState: authFile,
  },

  // Define projects
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Default timeout for each test
  timeout: 90000,

  // Timeout for the expect() assertion checks
  expect: {
    timeout: 10000,
  },
});