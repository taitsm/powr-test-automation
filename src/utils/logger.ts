// src/utils/logger.ts
import { Logger } from "tslog"; // Only import Logger directly
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// tslog levels: silly=0, trace=1, debug=2, info=3, warn=4, error=5, fatal=6
type LogLevelString = "silly" | "trace" | "debug" | "info" | "warn" | "error" | "fatal";
type LogLevelNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Mapping from string level name to numeric level
const levelMapping: Record<LogLevelString, LogLevelNumber> = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
};

const DEFAULT_LOG_LEVEL_STRING: LogLevelString = "info";
const DEFAULT_LOG_LEVEL_NUMBER: LogLevelNumber = levelMapping[DEFAULT_LOG_LEVEL_STRING]; // 3

/**
 * Determines the numeric log level from environment variables.
 * @returns The numeric log level (0-6).
 */
const getLogLevelNumber = (): LogLevelNumber => {
  const levelFromEnv = process.env.LOG_LEVEL?.toLowerCase() as LogLevelString;

  if (levelFromEnv && levelMapping.hasOwnProperty(levelFromEnv)) {
    const numericLevel = levelMapping[levelFromEnv];
    return numericLevel;
  } else if (levelFromEnv) {
    // Use console.warn only during this initial setup phase if logger isn't ready
    // console.warn(`[Logger Setup] Invalid LOG_LEVEL '${process.env.LOG_LEVEL}'. Defaulting to '${DEFAULT_LOG_LEVEL_STRING}' (${DEFAULT_LOG_LEVEL_NUMBER}).`);
  }
  return DEFAULT_LOG_LEVEL_NUMBER;
};

// Define logger settings without explicit ISettingsParam type
const loggerSettings = {
    name: "PlaywrightTests",
    minLevel: getLogLevelNumber(), // Use the function that returns the number
    // Keep other settings commented or uncommented as needed
    // displayInstanceName: false,
    // displayLoggerName: true,
    // displayFilePath: "hidden",
    // displayFunctionName: false,
};


// Create the logger instance - TypeScript will infer the type
const logger = new Logger(loggerSettings);

// Initial log message using the configured logger
// Find the string name corresponding to the numeric level for the log message
const currentLevelName = Object.keys(levelMapping).find(key => levelMapping[key as LogLevelString] === loggerSettings.minLevel) || 'unknown';
logger.info(`Logger initialized with minimum level: ${currentLevelName} (${loggerSettings.minLevel})`);

export { logger };