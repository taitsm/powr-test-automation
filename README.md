# POWR.io Test Automation

This repository contains automated tests for the POWR.io platform using Playwright.

## Overview

The test suite is built with Playwright in TypeScript and includes:

- E2E tests for the Form Builder
- Pricing page validation tests
- Authentication utilities
- Flexible screenshot management
- Detailed logging

## Prerequisites

- Node.js (v18.18.0 or later)
- npm

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/taitsm/powr-test-automation.git
   cd powr-test-automation
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript files:
   ```bash
   npm run build
   ```

## Environment Setup

Create a `.env` file in the project root with the following variables:

```
# Authentication
USER_EMAIL=your-email@example.com
USER_PASSWORD=your-password

# Logging
LOG_LEVEL=debug  # Options: silly, trace, debug, info, warn, error, fatal

# Screenshots
SCREENSHOT_MODE=enabled  # Options: enabled, disabled, failures_only

# Testing Configuration
GLOBAL_SETUP_HEADLESS=false  # Set to true for headless mode during authentication
CAPTCHA_WAIT_TIMEOUT=60000   # Time in ms to wait for manual CAPTCHA solving if needed
DEBUG_MODE=false             # Set to true to skip assertions for debugging
```

## Project Structure

```
powr-test-automation/
├── src/
│   ├── page-objects/         # Page object models
│   ├── tests/                # Test files
│   ├── utils/                # Utility functions
│   ├── fixtures.ts           # Test fixtures
│   └── global-setup.ts       # Authentication setup
├── dist/                     # Compiled JavaScript files
├── screenshots/              # Generated screenshots
├── .auth/                    # Authentication state storage
├── playwright-report/        # Test reports
└── test-results/             # Test artifacts
```

## Test Structure

The tests are organized into:

- **Page Objects**: Represent the UI components of the application (FormBuilderPage, PricingPage, LoginPage)
- **Test Files**: Contain the actual test cases
- **Fixtures**: Provide common test setup and state management
- **Utils**: Helper functions for logging, screenshots, etc.

## Running Tests

### Run all tests:

```bash
npm test
```

### Run tests with a specific browser:

```bash
npm run test:chrome
```

### Run in headed mode (visible browser):

```bash
npm run test:headed
```

### Run tests with UI mode (Playwright's interactive UI):

```bash
npm run test:ui
```

### Debug tests:

```bash
npm run test:debug
```

## Authentication

The test suite uses Playwright's authentication state persistence. On the first run, the test runner will:

1. Launch a browser (headed or headless based on `GLOBAL_SETUP_HEADLESS`)
2. Navigate to the login page
3. Authenticate using credentials from the `.env` file
4. If a CAPTCHA is encountered, it will wait for manual intervention (configured by `CAPTCHA_WAIT_TIMEOUT`)
5. Save the authentication state for future test runs

## Screenshots

The screenshot utility supports three modes:

- `enabled`: Take all screenshots
- `disabled`: Don't take any screenshots
- `failures_only`: Only take screenshots on test failures

Screenshots are saved in the `screenshots/` directory with timestamps.

## Logging

The test suite uses `tslog` for logging. Configure the log level in the `.env` file:

- `silly`: Most verbose
- `trace`: Detailed tracing
- `debug`: Debug information
- `info`: Standard information (default)
- `warn`: Warnings only
- `error`: Errors only
- `fatal`: Critical errors only

## Linting and Formatting

- Run linter:
  ```bash
  npm run lint
  ```

- Fix linting issues:
  ```bash
  npm run lint:fix
  ```

- Format code:
  ```bash
  npm run format
  ```

- Check formatting:
  ```bash
  npm run check-format
  ```

## Viewing Test Reports

After test runs, view the HTML report:

```bash
npm run report
```

## Troubleshooting

### Authentication Issues

- Check that your credentials in `.env` are correct
- If CAPTCHA appears, make sure `GLOBAL_SETUP_HEADLESS` is set to `false`
- Try deleting the `.auth/user.json` file and rerunning tests
- Set `LOG_LEVEL=debug` for more detailed logs

### Test Failures

- Check the screenshots in the `screenshots/` directory
- Review the logs for detailed error information
- Try running in headed mode to visually observe the issue
- Ensure you have stable internet connection

### Browser Issues

- Make sure you have the correct browser versions installed
- Try running with a different browser (chrome, firefox, webkit)
- Check for any adblockers or privacy extensions that might interfere

## Contributing

1. Follow the project's code style and conventions
2. Add tests for new features
3. Update documentation as needed
4. Make sure all tests pass before submitting a PR