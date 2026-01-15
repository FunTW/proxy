import {
  MESSAGE_TYPES,
  BADGE_COLORS,
  BADGE_TEXT,
  CONNECTION_TEST_TIMEOUT,
  TEST_URL
} from '../scripts/constants.js';

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

/**
 * Background service worker for proxy management
 */

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Proxy Manager installed');
  await initializeStorage();
  await updateBadge(null);
});

// Load current proxy on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Proxy Manager starting up');
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
  console.log('[Service Worker] applyProxyConfig called with ID:', configId);
  
  try {
    const config = await getProxyConfigById(configId);
    console.log('[Service Worker] Config retrieved:', config);

    if (!config) {
      console.error('[Service Worker] Configuration not found for ID:', configId);
      return { success: false, error: 'Configuration not found' };
    }

    // Validate configuration
    const validation = validateProxyConfig(config);
    console.log('[Service Worker] Validation result:', validation);
    
    if (!validation.valid) {
      console.error('[Service Worker] Invalid configuration:', validation.error);
      return { success: false, error: validation.error };
    }

    // Format for chrome.proxy API
    const proxySettings = formatProxyRules(config);
    console.log('[Service Worker] Proxy settings formatted:', proxySettings);

    // Apply proxy settings
    await chrome.proxy.settings.set(proxySettings);
    console.log('[Service Worker] Proxy settings applied to Chrome');

    // Update storage
    await setCurrentProxyId(configId);
    await updateStatistics(configId);

    // Update badge
    await updateBadge(config);

    console.log('[Service Worker] Proxy applied successfully:', config.name);

    return {
      success: true,
      data: {
        id: config.id,
        name: config.name,
        address: formatProxyAddress(config)
      }
    };
  } catch (error) {
    console.error('[Service Worker] Error applying proxy:', error);
    await updateBadge(null, true);
    return { success: false, error: error.message };
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

    console.log('Proxy cleared - direct connection');

    return { success: true, data: { message: 'Direct connection enabled' } };
  } catch (error) {
    console.error('Error clearing proxy:', error);
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
    console.error('Error getting current proxy:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Test proxy connection
 * @param {string} configId - Configuration ID
 * @returns {Promise<Object>} Test result
 */
async function testProxyConnection(configId) {
  try {
    const config = await getProxyConfigById(configId);

    if (!config) {
      return { success: false, error: 'Configuration not found' };
    }

    // Validate configuration
    const validation = validateProxyConfig(config);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const startTime = Date.now();

    // Create a test fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TEST_TIMEOUT);

    try {
      const response = await fetch(TEST_URL, {
        signal: controller.signal,
        method: 'HEAD',
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      if (response.ok) {
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
      clearTimeout(timeoutId);

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
    console.error('Error testing connection:', error);
    return { success: false, error: error.message };
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
    console.error('Error updating badge:', error);
  }
}

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type);

  // Handle different message types
  switch (message.type) {
    case MESSAGE_TYPES.GET_STATUS:
      getCurrentProxy().then(sendResponse);
      return true; // Async response

    case MESSAGE_TYPES.APPLY_PROXY:
      if (!message.data || !message.data.configId) {
        sendResponse({ success: false, error: 'Config ID required' });
        return false;
      }
      applyProxyConfig(message.data.configId).then(sendResponse);
      return true;

    case MESSAGE_TYPES.DISABLE_PROXY:
      clearProxy().then(sendResponse);
      return true;

    case MESSAGE_TYPES.GET_CONFIGS:
      getProxyConfigs()
        .then(configs => sendResponse({ success: true, data: configs }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case MESSAGE_TYPES.SAVE_CONFIG:
      if (!message.data) {
        sendResponse({ success: false, error: 'Configuration data required' });
        return false;
      }

      (async () => {
        try {
          const config = createProxyConfig(message.data);
          const validation = validateProxyConfig(config);

          if (!validation.valid) {
            sendResponse({ success: false, error: validation.error });
            return;
          }

          await saveProxyConfig(config);
          sendResponse({ success: true, data: config });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case MESSAGE_TYPES.UPDATE_CONFIG:
      if (!message.data || !message.data.id) {
        sendResponse({ success: false, error: 'Config ID required' });
        return false;
      }

      (async () => {
        try {
          const validation = validateProxyConfig(message.data);

          if (!validation.valid) {
            sendResponse({ success: false, error: validation.error });
            return;
          }

          const success = await updateProxyConfig(message.data.id, message.data);

          if (success) {
            // If updating the currently active proxy, reapply it
            const currentId = await getCurrentProxyId();
            if (currentId === message.data.id) {
              await applyProxyConfig(currentId);
            }
            sendResponse({ success: true, data: message.data });
          } else {
            sendResponse({ success: false, error: 'Configuration not found' });
          }
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case MESSAGE_TYPES.DELETE_CONFIG:
      if (!message.data || !message.data.configId) {
        sendResponse({ success: false, error: 'Config ID required' });
        return false;
      }

      deleteProxyConfig(message.data.configId)
        .then(success => {
          if (success) {
            sendResponse({ success: true, data: { message: 'Configuration deleted' } });
          } else {
            sendResponse({ success: false, error: 'Configuration not found' });
          }
        })
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case MESSAGE_TYPES.TEST_CONNECTION:
      if (!message.data || !message.data.configId) {
        sendResponse({ success: false, error: 'Config ID required' });
        return false;
      }
      testProxyConnection(message.data.configId).then(sendResponse);
      return true;

    case MESSAGE_TYPES.GET_STATISTICS:
      getStatistics()
        .then(stats => sendResponse({ success: true, data: stats }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case MESSAGE_TYPES.CLEAR_STATISTICS:
      clearStatistics()
        .then(() => sendResponse({ success: true, data: { message: 'Statistics cleared' } }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
});

console.log('Proxy Manager service worker loaded');
