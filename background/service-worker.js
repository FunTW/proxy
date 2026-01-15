import {
  MESSAGE_TYPES,
  BADGE_COLORS,
  BADGE_TEXT,
  CONNECTION_TEST_TIMEOUT,
  TEST_URL,
  CACHE_TIMEOUT
} from '../scripts/constants.js';
import { logger } from '../scripts/logger.js';
import { retryOperation } from '../scripts/utils.js';

import {
  getProxyConfigs,
  getProxyConfigById,
  saveProxyConfig,
  updateProxyConfig,
  deleteProxyConfig,
  getCurrentProxyId,
  setCurrentProxyId,
  getStatistics,
  updateStatistics,
  clearStatistics,
  initializeStorage,
  exportAllData,
  importData
} from '../scripts/storage.js';

import {
  createProxyConfig,
  validateProxyConfig,
  formatProxyRules,
  formatProxyAddress
} from '../scripts/proxy-manager.js';

const proxyConfigCache = new Map();
const cacheTimestamps = new Map();

function getCachedConfig(configId) {
  const timestamp = cacheTimestamps.get(configId);
  if (!timestamp || Date.now() - timestamp > CACHE_TIMEOUT) {
    proxyConfigCache.delete(configId);
    cacheTimestamps.delete(configId);
    return null;
  }
  return proxyConfigCache.get(configId);
}

function setCachedConfig(configId, config) {
  proxyConfigCache.set(configId, config);
  cacheTimestamps.set(configId, Date.now());
}

function clearConfigCache() {
  proxyConfigCache.clear();
  cacheTimestamps.clear();
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  logger.log('Proxy Manager installed');
  await initializeStorage();
  await updateBadge(null);
});

// Load current proxy on startup
chrome.runtime.onStartup.addListener(async () => {
  logger.log('Proxy Manager starting up');
  const currentProxyId = await getCurrentProxyId();
  if (currentProxyId) {
    const config = await getProxyConfigById(currentProxyId);
    if (config) {
      await applyProxyConfig(currentProxyId);
    }
  } else {
    await updateBadge(null);
  }
});

/**
 * Apply proxy configuration
 * @param {string} configId - Configuration ID
 * @returns {Promise<Object>} Result object
 */
async function applyProxyConfig(configId) {
  logger.log('[Service Worker] applyProxyConfig called with ID:', configId);
  
  try {
    let config = getCachedConfig(configId);
    
    if (!config) {
      config = await getProxyConfigById(configId);
      if (config) {
        setCachedConfig(configId, config);
      }
    }
    
    logger.log('[Service Worker] Config retrieved:', config);

    if (!config) {
      logger.error('[Service Worker] Configuration not found for ID:', configId);
      return { success: false, error: 'Configuration not found' };
    }

    const validation = validateProxyConfig(config);
    logger.log('[Service Worker] Validation result:', validation);
    
    if (!validation.valid) {
      logger.error('[Service Worker] Invalid configuration:', validation.error);
      return { success: false, error: validation.error };
    }

    const proxySettings = formatProxyRules(config);
    logger.log('[Service Worker] Proxy settings formatted:', proxySettings);

    await retryOperation(async () => {
      await chrome.proxy.settings.set(proxySettings);
    });
    
    logger.log('[Service Worker] Proxy settings applied to Chrome');

    await Promise.all([
      setCurrentProxyId(configId),
      updateStatistics(configId),
      updateBadge(config)
    ]);

    logger.log('[Service Worker] Proxy applied successfully:', config.name);

    return {
      success: true,
      data: {
        id: config.id,
        name: config.name,
        address: formatProxyAddress(config)
      }
    };
  } catch (error) {
    logger.error('[Service Worker] Error applying proxy:', error);
    await updateBadge(null, true);
    return { success: false, error: error.message || 'Failed to apply proxy configuration' };
  }
}

/**
 * Clear proxy (direct connection)
 * @returns {Promise<Object>} Result object
 */
async function clearProxy() {
  try {
    await chrome.proxy.settings.clear({ scope: 'regular' });
    await setCurrentProxyId(null);
    await updateBadge(null);

    logger.log('Proxy cleared - direct connection');

    return { success: true, data: { message: 'Direct connection enabled' } };
  } catch (error) {
    logger.error('Error clearing proxy:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current proxy status
 * @returns {Promise<Object>} Status object
 */
async function getCurrentProxy() {
  try {
    const currentProxyId = await getCurrentProxyId();

    if (!currentProxyId) {
      return {
        success: true,
        data: {
          isActive: false,
          proxy: null
        }
      };
    }

    const config = await getProxyConfigById(currentProxyId);

    if (!config) {
      // Proxy ID exists but config not found - clear it
      await setCurrentProxyId(null);
      await updateBadge(null);
      return {
        success: true,
        data: {
          isActive: false,
          proxy: null
        }
      };
    }

    return {
      success: true,
      data: {
        isActive: true,
        proxy: {
          id: config.id,
          name: config.name,
          address: formatProxyAddress(config),
          type: config.type,
          color: config.color
        }
      }
    };
  } catch (error) {
    logger.error('Error getting current proxy:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test proxy connection
 * @param {string} configId - Configuration ID
 * @returns {Promise<Object>} Test result
 */
async function testProxyConnection(configId) {
  let controller;
  let timeoutId;
  
  try {
    const config = await getProxyConfigById(configId);

    if (!config) {
      return { success: false, error: 'Configuration not found' };
    }

    const validation = validateProxyConfig(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const startTime = Date.now();

    controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), CONNECTION_TEST_TIMEOUT);

    try {
      const response = await fetch(TEST_URL, {
        signal: controller.signal,
        method: 'HEAD',
        cache: 'no-cache',
        mode: 'no-cors'
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      if (response.ok || response.type === 'opaque') {
        return {
          success: true,
          data: {
            status: 'success',
            latency,
            message: `Connection successful (${latency}ms)`
          }
        };
      } else {
        return {
          success: false,
          error: `HTTP ${response.status} ${response.statusText}`
        };
      }
    } catch (fetchError) {
      if (timeoutId) clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        return {
          success: false,
          error: `Connection timeout (>${CONNECTION_TEST_TIMEOUT}ms)`
        };
      }

      return {
        success: false,
        error: `Connection failed: ${fetchError.message}`
      };
    }
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    logger.error('Error testing connection:', error);
    return { success: false, error: error.message || 'Connection test failed' };
  }
}

/**
 * Update badge based on proxy status
 * @param {Object|null} config - Active proxy config or null
 * @param {boolean} error - Whether there's an error
 * @returns {Promise<void>}
 */
async function updateBadge(config, error = false) {
  try {
    if (error) {
      await chrome.action.setBadgeText({ text: BADGE_TEXT.ERROR });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.ERROR });
    } else if (config) {
      await chrome.action.setBadgeText({ text: BADGE_TEXT.ACTIVE });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.ACTIVE });
    } else {
      await chrome.action.setBadgeText({ text: BADGE_TEXT.INACTIVE });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.INACTIVE });
    }
  } catch (error) {
    logger.error('Error updating badge:', error);
  }
}

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.log('Received message:', message.type);

  const handleAsync = async (handler) => {
    try {
      const result = await handler();
      sendResponse(result);
    } catch (error) {
      logger.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message || 'Internal error' });
    }
  };

  switch (message.type) {
    case MESSAGE_TYPES.GET_STATUS:
      handleAsync(() => getCurrentProxy());
      return true;

    case MESSAGE_TYPES.APPLY_PROXY:
      if (!message.data?.configId) {
        sendResponse({ success: false, error: 'Config ID required' });
        return false;
      }
      handleAsync(() => applyProxyConfig(message.data.configId));
      return true;

    case MESSAGE_TYPES.DISABLE_PROXY:
      handleAsync(() => clearProxy());
      return true;

    case MESSAGE_TYPES.GET_CONFIGS:
      handleAsync(async () => {
        const configs = await getProxyConfigs();
        return { success: true, data: configs };
      });
      return true;

    case MESSAGE_TYPES.SAVE_CONFIG:
      if (!message.data) {
        sendResponse({ success: false, error: 'Configuration data required' });
        return false;
      }
      handleAsync(async () => {
        const config = createProxyConfig(message.data);
        const validation = validateProxyConfig(config);

        if (!validation.valid) {
          return { success: false, error: validation.error };
        }

        await saveProxyConfig(config);
        clearConfigCache();
        return { success: true, data: config };
      });
      return true;

    case MESSAGE_TYPES.UPDATE_CONFIG:
      if (!message.data?.id) {
        sendResponse({ success: false, error: 'Config ID required' });
        return false;
      }
      handleAsync(async () => {
        const validation = validateProxyConfig(message.data);

        if (!validation.valid) {
          return { success: false, error: validation.error };
        }

        const success = await updateProxyConfig(message.data.id, message.data);

        if (success) {
          clearConfigCache();
          const currentId = await getCurrentProxyId();
          if (currentId === message.data.id) {
            await applyProxyConfig(currentId);
          }
          return { success: true, data: message.data };
        } else {
          return { success: false, error: 'Configuration not found' };
        }
      });
      return true;

    case MESSAGE_TYPES.DELETE_CONFIG:
      if (!message.data?.configId) {
        sendResponse({ success: false, error: 'Config ID required' });
        return false;
      }
      handleAsync(async () => {
        const success = await deleteProxyConfig(message.data.configId);
        clearConfigCache();
        if (success) {
          return { success: true, data: { message: 'Configuration deleted' } };
        } else {
          return { success: false, error: 'Configuration not found' };
        }
      });
      return true;

    case MESSAGE_TYPES.TEST_CONNECTION:
      if (!message.data?.configId) {
        sendResponse({ success: false, error: 'Config ID required' });
        return false;
      }
      handleAsync(() => testProxyConnection(message.data.configId));
      return true;

    case MESSAGE_TYPES.GET_STATISTICS:
      handleAsync(async () => {
        const stats = await getStatistics();
        return { success: true, data: stats };
      });
      return true;

    case MESSAGE_TYPES.CLEAR_STATISTICS:
      handleAsync(async () => {
        await clearStatistics();
        return { success: true, data: { message: 'Statistics cleared' } };
      });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

logger.log('Proxy Manager service worker loaded');
