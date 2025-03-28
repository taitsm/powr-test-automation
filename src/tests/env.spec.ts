import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { logger } from '../utils/logger.js';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

test('environment variables should be loaded', async () => {
  const emailDefined = !!process.env.USER_EMAIL;
  const passwordDefined = !!process.env.USER_PASSWORD;

  logger.info('Environment test - Variables loaded check:', {
    hasEmail: emailDefined,
    hasPassword: passwordDefined,
    // Log only presence/absence or first few chars for security
    emailPrefix: process.env.USER_EMAIL ? process.env.USER_EMAIL.substring(0, 3) + '***' : 'undefined',
  });

  expect(process.env.USER_EMAIL, '.env variable USER_EMAIL should be defined').toBeDefined();
  expect(process.env.USER_PASSWORD, '.env variable USER_PASSWORD should be defined').toBeDefined();
  expect(process.env.USER_EMAIL?.length, 'USER_EMAIL should not be empty').toBeGreaterThan(0);
  expect(process.env.USER_PASSWORD?.length, 'USER_PASSWORD should not be empty').toBeGreaterThan(0);
});