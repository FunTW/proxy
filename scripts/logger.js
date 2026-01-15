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
