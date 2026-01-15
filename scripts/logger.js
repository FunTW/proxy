import { DEBUG_MODE } from './constants.js';

/**
 * Simple logger utility for conditional debug logging
 */
export const logger = {
  log: (...args) => {
    if (DEBUG_MODE) {
      console.log(...args);
    }
  },
  
  error: (...args) => {
    console.error(...args);
  },
  
  warn: (...args) => {
    if (DEBUG_MODE) {
      console.warn(...args);
    }
  },
  
  info: (...args) => {
    if (DEBUG_MODE) {
      console.info(...args);
    }
  }
};

/**
 * Unified error handler
 * @param {Error|string} error - Error object or error message
 * @param {string} context - Context where error occurred
 * @param {Function} callback - Optional callback to handle error
 * @returns {string} User-friendly error message
 */
export function handleError(error, context = 'Unknown', callback = null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const fullMessage = `[${context}] ${errorMessage}`;
  
  logger.error(fullMessage, error instanceof Error ? error : new Error(errorMessage));
  
  if (callback && typeof callback === 'function') {
    callback(errorMessage);
  }
  
  return errorMessage;
}

/**
 * Safe async wrapper that catches errors
 * @param {Function} asyncFn - Async function to wrap
 * @param {string} context - Context for error handling
 * @param {Function} onError - Optional error callback
 * @returns {Promise} Wrapped promise
 */
export async function safeAsync(asyncFn, context = 'Unknown', onError = null) {
  try {
    return await asyncFn();
  } catch (error) {
    handleError(error, context, onError);
    throw error;
  }
}
