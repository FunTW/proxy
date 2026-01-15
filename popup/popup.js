import { MESSAGE_TYPES } from '../scripts/constants.js';
import { getProxyTypeDisplayName, formatProxyAddress } from '../scripts/proxy-manager.js';
import { initializeI18n, getMessage as t } from '../scripts/i18n.js';
import { logger } from '../scripts/logger.js';
import { LoadingManager, escapeHtml } from '../scripts/utils.js';

let statusDot, statusText, currentProxyName, currentProxyAddress;
let disconnectBtn, refreshBtn, settingsBtn, proxyList, emptyState, versionInfo;

let currentStatus = null;
let proxyConfigs = [];
let loadingManager = new LoadingManager();
let storageChangeListener = null;
let proxyListClickHandler = null;

/**
 * Initialize popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  logger.log('[Popup] DOMContentLoaded - Initializing popup');
  
  try {
    initializeI18n();

    statusDot = document.getElementById('statusDot');
    statusText = document.getElementById('statusText');
    currentProxyName = document.getElementById('currentProxyName');
    currentProxyAddress = document.getElementById('currentProxyAddress');
    disconnectBtn = document.getElementById('disconnectBtn');
    refreshBtn = document.getElementById('refreshBtn');
    settingsBtn = document.getElementById('settingsBtn');
    proxyList = document.getElementById('proxyList');
    emptyState = document.getElementById('emptyState');
    versionInfo = document.getElementById('versionInfo');

    logger.log('[Popup] DOM elements retrieved');

    displayVersion();

    disconnectBtn.addEventListener('click', handleDisconnect);
    refreshBtn.addEventListener('click', handleRefresh);
    settingsBtn.addEventListener('click', openSettings);
    
    proxyListClickHandler = (e) => {
      const item = e.target.closest('.proxy-item');
      if (!item) return;
      
      const configId = item.dataset.configId;
      if (!configId) return;
      
      const config = proxyConfigs.find(c => c.id === configId);
      if (config) {
        handleProxyClick(config);
      }
    };
    
    proxyList.addEventListener('click', proxyListClickHandler);

    logger.log('[Popup] Event listeners set up');

    storageChangeListener = handleStorageChange;
    chrome.storage.onChanged.addListener(storageChangeListener);

    logger.log('[Popup] Loading initial data');
    await loadData();
    logger.log('[Popup] Initialization complete');
  } catch (error) {
    logger.error('[Popup] Initialization error:', error);
    showError(t('errorFailedToLoad'));
  }
});

window.addEventListener('unload', () => {
  if (storageChangeListener) {
    chrome.storage.onChanged.removeListener(storageChangeListener);
  }
  if (proxyListClickHandler && proxyList) {
    proxyList.removeEventListener('click', proxyListClickHandler);
  }
  loadingManager.clear();
});

/**
 * Load proxy status and configurations
 */
async function loadData() {
  try {
    await Promise.all([
      loadProxyStatus(),
      loadProxyList()
    ]);
  } catch (error) {
    logger.error('Error loading data:', error);
    showError(t('errorFailedToLoad'));
  }
}

/**
 * Load current proxy status
 */
async function loadProxyStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_STATUS
    });

    if (response.success) {
      currentStatus = response.data;
      updateStatusUI(currentStatus);
    } else {
      showError(t('errorFailedToLoad'));
    }
  } catch (error) {
    logger.error('Error loading proxy status:', error);
    showError(t('errorFailedToConnect'));
  }
}

/**
 * Load proxy configurations
 */
async function loadProxyList() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_CONFIGS
    });

    if (response.success) {
      proxyConfigs = response.data;
      renderProxyList();
    } else {
      showError(t('errorFailedToLoad'));
    }
  } catch (error) {
    logger.error('Error loading proxy list:', error);
  }
}

/**
 * Update status UI
 */
function updateStatusUI(status) {
  if (status?.isActive && status.proxy) {
    statusDot.className = 'status-dot active';
    statusText.textContent = t('statusConnected');
    currentProxyName.textContent = escapeHtml(status.proxy.name);
    currentProxyAddress.textContent = escapeHtml(status.proxy.address);
    disconnectBtn.disabled = false;
  } else {
    statusDot.className = 'status-dot';
    statusText.textContent = t('statusDisconnected');
    currentProxyName.textContent = t('currentProxyNone');
    currentProxyAddress.textContent = '';
    disconnectBtn.disabled = true;
  }
}

/**
 * Render proxy list
 */
function renderProxyList() {
  logger.log('[Popup] Rendering proxy list, count:', proxyConfigs.length);
  
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  if (proxyConfigs.length === 0) {
    logger.log('[Popup] No proxy configs, showing empty state');
    emptyState.classList.add('visible');
    proxyList.innerHTML = '';
    return;
  }

  emptyState.classList.remove('visible');

  // Create proxy items using fragment
  proxyConfigs.forEach(config => {
    logger.log('[Popup] Creating item for:', config.name, config.id);
    const item = createProxyItem(config);
    fragment.appendChild(item);
  });
  
  // Clear and append all at once for better performance
  proxyList.innerHTML = '';
  proxyList.appendChild(fragment);
  
  logger.log('[Popup] Proxy list rendered successfully');
}

/**
 * Create proxy list item
 */
function createProxyItem(config) {
  const item = document.createElement('div');
  item.className = 'proxy-item';
  item.dataset.configId = config.id;

  const isActive = currentStatus?.isActive && currentStatus?.proxy?.id === config.id;
  if (isActive) {
    item.classList.add('active');
  }

  const colorBar = document.createElement('div');
  colorBar.className = 'proxy-item-color';
  colorBar.style.backgroundColor = config.color || '#2196F3';

  const info = document.createElement('div');
  info.className = 'proxy-item-info';

  const name = document.createElement('div');
  name.className = 'proxy-item-name';
  name.textContent = escapeHtml(config.name);

  const details = document.createElement('div');
  details.className = 'proxy-item-details';
  details.textContent = `${getProxyTypeDisplayName(config.type)} - ${formatProxyAddress(config)}`;

  info.appendChild(name);
  info.appendChild(details);

  if (isActive) {
    const badge = document.createElement('div');
    badge.className = 'proxy-item-badge';
    badge.textContent = t('badgeActive');
    item.appendChild(colorBar);
    item.appendChild(info);
    item.appendChild(badge);
  } else {
    item.appendChild(colorBar);
    item.appendChild(info);
  }

  return item;
}

/**
 * Handle proxy item click
 */
async function handleProxyClick(config) {
  logger.log('[Popup] Proxy item clicked:', config.name, config.id);
  
  if (currentStatus?.isActive && currentStatus?.proxy?.id === config.id) {
    logger.log('[Popup] Proxy already active, ignoring click');
    return;
  }

  if (loadingManager.isLoading('applyProxy')) {
    logger.log('[Popup] Already applying proxy, ignoring click');
    return;
  }

  try {
    loadingManager.start('applyProxy');
    statusText.textContent = t('statusConnecting');
    logger.log('[Popup] Sending APPLY_PROXY message');

    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.APPLY_PROXY,
      data: { configId: config.id }
    });

    logger.log('[Popup] APPLY_PROXY response:', response);

    if (response?.success) {
      logger.log('[Popup] Proxy applied successfully');
      await loadProxyStatus();
      renderProxyList();
    } else {
      logger.error('[Popup] Failed to apply proxy:', response?.error);
      showError(response?.error || t('errorFailedToApply'));
      await loadProxyStatus();
    }
  } catch (error) {
    logger.error('[Popup] Error applying proxy:', error);
    showError(t('errorFailedToApply'));
    await loadProxyStatus();
  } finally {
    loadingManager.stop('applyProxy');
  }
}

/**
 * Handle disconnect button click
 */
async function handleDisconnect() {
  try {
    disconnectBtn.disabled = true;
    statusText.textContent = t('statusDisconnecting');

    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.DISABLE_PROXY
    });

    if (response.success) {
      await loadProxyStatus();
      renderProxyList();
    } else {
      showError(response.error || t('errorFailedToDisconnect'));
      await loadProxyStatus();
      disconnectBtn.disabled = false;
    }
  } catch (error) {
    logger.error('Error disconnecting:', error);
    showError(t('errorFailedToDisconnect'));
    disconnectBtn.disabled = false;
  }
}

/**
 * Handle refresh button click
 */
async function handleRefresh() {
  refreshBtn.classList.add('spinning');
  await loadData();
  setTimeout(() => {
    refreshBtn.classList.remove('spinning');
  }, 500);
}

/**
 * Open settings page
 */
function openSettings() {
  chrome.runtime.openOptionsPage();
}

/**
 * Handle storage changes
 */
function handleStorageChange(changes, area) {
  if (area === 'local') {
    // Reload data if proxy configs or current proxy changed
    if (changes.proxyConfigs || changes.currentProxyId) {
      loadData();
    }
  }
}

/**
 * Show error message
 */
function showError(message) {
  logger.error(message);
  statusDot.className = 'status-dot error';
  // Could add a toast notification here in the future
}

/**
 * Display extension version
 */
function displayVersion() {
  const manifest = chrome.runtime.getManifest();
  versionInfo.textContent = `${t('version')} ${manifest.version}`;
}

logger.log('Popup loaded');
