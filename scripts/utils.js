import { TOAST_TIMEOUT, MAX_RETRY_ATTEMPTS, RETRY_DELAY } from './constants.js';
import { logger } from './logger.js';

export function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export async function retryOperation(operation, maxAttempts = MAX_RETRY_ATTEMPTS, delay = RETRY_DELAY) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logger.warn(`Operation failed (attempt ${attempt}/${maxAttempts}):`, error.message);
      
      if (attempt < maxAttempts) {
        await sleep(delay * attempt);
      }
    }
  }
  
  throw lastError;
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  
  const clonedObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  return clonedObj;
}

export function createEventEmitter() {
  const listeners = {};
  
  return {
    on(event, callback) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
      
      return () => {
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      };
    },
    
    emit(event, ...args) {
      if (!listeners[event]) return;
      listeners[event].forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          logger.error(`Error in event listener for ${event}:`, error);
        }
      });
    },
    
    off(event, callback) {
      if (!listeners[event]) return;
      if (!callback) {
        delete listeners[event];
      } else {
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      }
    }
  };
}

export class ToastManager {
  constructor(toastElement, timeout = TOAST_TIMEOUT) {
    this.toast = toastElement;
    this.timeout = timeout;
    this.currentTimer = null;
  }
  
  show(message, type = 'success') {
    if (!this.toast) return;
    
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
    }
    
    this.toast.textContent = escapeHtml(message);
    this.toast.className = `toast ${type} show`;
    
    this.currentTimer = setTimeout(() => {
      this.hide();
    }, this.timeout);
  }
  
  hide() {
    if (!this.toast) return;
    this.toast.classList.remove('show');
    this.currentTimer = null;
  }
  
  destroy() {
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
    }
    this.currentTimer = null;
  }
}

export class LoadingManager {
  constructor() {
    this.loadingStates = new Map();
  }
  
  start(key) {
    this.loadingStates.set(key, true);
  }
  
  stop(key) {
    this.loadingStates.set(key, false);
  }
  
  isLoading(key) {
    return this.loadingStates.get(key) || false;
  }
  
  clear() {
    this.loadingStates.clear();
  }
}

export function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '');
}

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function generateId() {
  return crypto.randomUUID();
}

export function parseQueryString(queryString) {
  const params = {};
  const pairs = queryString.replace(/^\?/, '').split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  }
  
  return params;
}

export function buildQueryString(params) {
  return Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export class PerformanceMonitor {
  constructor(name) {
    this.name = name;
    this.marks = new Map();
  }
  
  start(label = 'default') {
    this.marks.set(label, performance.now());
  }
  
  end(label = 'default') {
    const startTime = this.marks.get(label);
    if (!startTime) {
      logger.warn(`No start mark found for ${label}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    logger.log(`[${this.name}] ${label}: ${formatDuration(duration)}`);
    this.marks.delete(label);
    return duration;
  }
  
  clear() {
    this.marks.clear();
  }
}
