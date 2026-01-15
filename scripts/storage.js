import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';
import { logger } from './logger.js';

/**
 * Storage abstraction layer for chrome.storage API
 */

// Simple in-memory cache to reduce storage reads
let configsCache = null;
let cacheValid = false;

/**
 * Invalidate cache (call after any write operation)
 */
function invalidateCache() {
  cacheValid = false;
  configsCache = null;
}

/**
 * Get all proxy configurations
 * @returns {Promise<Array>} Array of proxy configurations
 */
export async function getProxyConfigs() {
  if (cacheValid && configsCache !== null) {
    return configsCache;
  }
  
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROXY_CONFIGS);
  const configs = result[STORAGE_KEYS.PROXY_CONFIGS] || [];
  configsCache = configs;
  cacheValid = true;
  return configs;
}

/**
 * Save a new proxy configuration
 * @param {Object} config - Proxy configuration object
 * @returns {Promise<void>}
 */
export async function saveProxyConfig(config) {
  const configs = await getProxyConfigs();
  configs.push(config);
  await chrome.storage.local.set({ [STORAGE_KEYS.PROXY_CONFIGS]: configs });
  configsCache = configs;
  cacheValid = true;
}

/**
 * Update an existing proxy configuration
 * @param {string} id - Config ID
 * @param {Object} updatedConfig - Updated configuration
 * @returns {Promise<boolean>} True if updated, false if not found
 */
export async function updateProxyConfig(id, updatedConfig) {
  const configs = await getProxyConfigs();
  const index = configs.findIndex(c => c.id === id);

  if (index === -1) {
    return false;
  }

  configs[index] = { ...configs[index], ...updatedConfig };
  await chrome.storage.local.set({ [STORAGE_KEYS.PROXY_CONFIGS]: configs });
  configsCache = configs;
  cacheValid = true;
  return true;
}

/**
 * Delete a proxy configuration
 * @param {string} id - Config ID to delete
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteProxyConfig(id) {
  const configs = await getProxyConfigs();
  const filteredConfigs = configs.filter(c => c.id !== id);

  if (filteredConfigs.length === configs.length) {
    return false;
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.PROXY_CONFIGS]: filteredConfigs });
  configsCache = filteredConfigs;
  cacheValid = true;

  // If the deleted config was active, clear current proxy
  const currentProxyId = await getCurrentProxyId();
  if (currentProxyId === id) {
    await setCurrentProxyId(null);
  }

  return true;
}

/**
 * Get a specific proxy configuration by ID
 * @param {string} id - Config ID
 * @returns {Promise<Object|null>} Config object or null if not found
 */
export async function getProxyConfigById(id) {
  const configs = await getProxyConfigs();
  return configs.find(c => c.id === id) || null;
}

/**
 * Get the current active proxy ID
 * @returns {Promise<string|null>} Current proxy ID or null
 */
export async function getCurrentProxyId() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_PROXY_ID);
  return result[STORAGE_KEYS.CURRENT_PROXY_ID] || null;
}

/**
 * Set the current active proxy ID
 * @param {string|null} id - Proxy ID to set as active
 * @returns {Promise<void>}
 */
export async function setCurrentProxyId(id) {
  await chrome.storage.local.set({ [STORAGE_KEYS.CURRENT_PROXY_ID]: id });
}

/**
 * Get application settings
 * @returns {Promise<Object>} Settings object
 */
export async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
}

/**
 * Save application settings
 * @param {Object} settings - Settings object
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

/**
 * Get usage statistics
 * @returns {Promise<Object>} Statistics object
 */
export async function getStatistics() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.STATISTICS);
  return result[STORAGE_KEYS.STATISTICS] || { byProxy: {} };
}

/**
 * Update statistics for a proxy
 * @param {string} proxyId - Proxy ID
 * @returns {Promise<void>}
 */
export async function updateStatistics(proxyId) {
  const stats = await getStatistics();

  if (!stats.byProxy[proxyId]) {
    stats.byProxy[proxyId] = {
      connections: 0,
      lastUsed: null
    };
  }

  stats.byProxy[proxyId].connections++;
  stats.byProxy[proxyId].lastUsed = new Date().toISOString();

  await chrome.storage.local.set({ [STORAGE_KEYS.STATISTICS]: stats });
}

/**
 * Clear all usage statistics
 * @returns {Promise<void>}
 */
export async function clearStatistics() {
  await chrome.storage.local.set({ [STORAGE_KEYS.STATISTICS]: { byProxy: {} } });
}

/**
 * Initialize storage with default values on first install
 * @returns {Promise<void>}
 */
export async function initializeStorage() {
  const configs = await getProxyConfigs();

  // Only initialize if storage is empty
  if (configs.length === 0) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.PROXY_CONFIGS]: [],
      [STORAGE_KEYS.CURRENT_PROXY_ID]: null,
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
      [STORAGE_KEYS.STATISTICS]: { byProxy: {} }
    });
  }
}

/**
 * Clear all data (useful for reset)
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  await chrome.storage.local.clear();
  invalidateCache();
  await initializeStorage();
}

/**
 * Export all configurations and settings
 * @returns {Promise<Object>} All data for export
 */
export async function exportAllData() {
  const configs = await getProxyConfigs();
  const settings = await getSettings();
  const statistics = await getStatistics();

  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    configs,
    settings,
    statistics
  };
}

/**
 * Import configurations and settings
 * Supports both native format and Omega format
 * @param {Object} data - Imported data
 * @param {boolean} merge - If true, merge with existing; if false, replace
 * @returns {Promise<Object>} Result with success status and message
 */
export async function importData(data, merge = true) {
  try {
    // Detect and convert format if needed
    const { isOmega, configs } = await detectAndConvertFormat(data);

    if (!configs || configs.length === 0) {
      return { success: false, message: 'No valid proxy configurations found' };
    }

    if (merge) {
      const existingConfigs = await getProxyConfigs();
      const mergedConfigs = [...existingConfigs];

      // Add imported configs with new IDs to avoid conflicts
      for (const config of configs) {
        const newConfig = { ...config, id: crypto.randomUUID() };
        mergedConfigs.push(newConfig);
      }

      await chrome.storage.local.set({ [STORAGE_KEYS.PROXY_CONFIGS]: mergedConfigs });
      configsCache = mergedConfigs;
      cacheValid = true;
    } else {
      // Replace all configs
      await chrome.storage.local.set({ [STORAGE_KEYS.PROXY_CONFIGS]: configs });
      configsCache = configs;
      cacheValid = true;
    }

    // Import settings if provided (only for native format)
    if (!isOmega && data.settings) {
      await saveSettings(data.settings);
    }

    const message = isOmega
      ? `Imported ${configs.length} configurations from Omega format`
      : 'Import successful';

    return { success: true, message, count: configs.length, isOmega };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Detect format and convert if necessary
 * @param {Object} data - Raw imported data
 * @returns {Promise<Object>} { isOmega: boolean, configs: Array }
 */
async function detectAndConvertFormat(data) {
  logger.log('[Import] Detecting format, data keys:', Object.keys(data));

  // Dynamic import to avoid circular dependencies
  const { isOmegaFormat, parseOmegaBackup } = await import('./omega-parser.js');

  // Check if it's Omega format
  const isOmega = isOmegaFormat(data);
  logger.log('[Import] Is Omega format:', isOmega);

  if (isOmega) {
    logger.log('[Import] Parsing as Omega format');
    const configs = parseOmegaBackup(data);
    logger.log('[Import] Parsed configs count:', configs.length);
    return { isOmega: true, configs };
  }

  // Native format
  if (data.configs && Array.isArray(data.configs)) {
    logger.log('[Import] Detected native format');
    return { isOmega: false, configs: data.configs };
  }

  // Unknown format
  logger.error('[Import] Unknown format, data structure:', data);
  throw new Error('Invalid data format: Unable to detect format type');
}
