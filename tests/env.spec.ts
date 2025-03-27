import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Force load environment variables
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

test('environment variables should be loaded', async () => {
  // Check that environment variables are loaded
  console.log('Environment test - Variables loaded:', {
    hasEmail: !!process.env.USER_EMAIL,
    hasPassword: !!process.env.USER_PASSWORD,
    email: process.env.USER_EMAIL?.substring(0, 3) + '***', // Show only first 3 chars for security
  });

  // Assert that the environment variables exist
  expect(process.env.USER_EMAIL).toBeDefined();
  expect(process.env.USER_PASSWORD).toBeDefined();

  // Verify they're not empty
  expect(process.env.USER_EMAIL?.length).toBeGreaterThan(0);
  expect(process.env.USER_PASSWORD?.length).toBeGreaterThan(0);
});