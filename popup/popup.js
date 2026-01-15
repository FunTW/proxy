import { MESSAGE_TYPES } from '../scripts/constants.js';
import { getProxyTypeDisplayName, formatProxyAddress } from '../scripts/proxy-manager.js';
import { initializeI18n, getMessage as t } from '../scripts/i18n.js';

/**
 * Popup UI controller
 */

// DOM elements
let statusDot, statusText, currentProxyName, currentProxyAddress;
let disconnectBtn, refreshBtn, settingsBtn, proxyList, emptyState, versionInfo;

// State
let currentStatus = null;
let proxyConfigs = [];

/**
 * Initialize popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Popup] DOMContentLoaded - Initializing popup');
  
  // Initialize i18n
  initializeI18n();

  // Get DOM elements
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

  console.log('[Popup] DOM elements retrieved');

  // Display version
  displayVersion();

  // Set up event listeners
  disconnectBtn.addEventListener('click', handleDisconnect);
  refreshBtn.addEventListener('click', handleRefresh);
  settingsBtn.addEventListener('click', openSettings);

  console.log('[Popup] Event listeners set up');

  // Listen for storage changes
  chrome.storage.onChanged.addListener(handleStorageChange);

  // Load initial data
  console.log('[Popup] Loading initial data');
  await loadData();
  console.log('[Popup] Initialization complete');
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
    console.error('Error loading data:', error);
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
    console.error('Error loading proxy status:', error);
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
    console.error('Error loading proxy list:', error);
  }
}

/**
 * Update status UI
 */
function updateStatusUI(status) {
  if (status.isActive && status.proxy) {
    // Proxy is active
    statusDot.className = 'status-dot active';
    statusText.textContent = t('statusConnected');
    currentProxyName.textContent = status.proxy.name;
    currentProxyAddress.textContent = status.proxy.address;
    disconnectBtn.disabled = false;
  } else {
    // No proxy active
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
  console.log('[Popup] Rendering proxy list, count:', proxyConfigs.length);
  
  // Clear existing list
  proxyList.innerHTML = '';

  if (proxyConfigs.length === 0) {
    console.log('[Popup] No proxy configs, showing empty state');
    emptyState.classList.add('visible');
    return;
  }

  emptyState.classList.remove('visible');

  // Create proxy items
  proxyConfigs.forEach(config => {
    console.log('[Popup] Creating item for:', config.name, config.id);
    const item = createProxyItem(config);
    proxyList.appendChild(item);
  });
  
  console.log('[Popup] Proxy list rendered successfully');
}

/**
 * Create proxy list item
 */
function createProxyItem(config) {
  const item = document.createElement('div');
  item.className = 'proxy-item';

  // Check if this is the active proxy
  const isActive = currentStatus?.isActive && currentStatus?.proxy?.id === config.id;
  if (isActive) {
    item.classList.add('active');
  }

  // Color bar
  const colorBar = document.createElement('div');
  colorBar.className = 'proxy-item-color';
  colorBar.style.backgroundColor = config.color;

  // Info container
  const info = document.createElement('div');
  info.className = 'proxy-item-info';

  const name = document.createElement('div');
  name.className = 'proxy-item-name';
  name.textContent = config.name;

  const details = document.createElement('div');
  details.className = 'proxy-item-details';
  details.textContent = `${getProxyTypeDisplayName(config.type)} - ${formatProxyAddress(config)}`;

  info.appendChild(name);
  info.appendChild(details);

  // Active badge
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

  // Click handler
  console.log('[Popup] Adding click handler for:', config.name, config.id, 'isActive:', isActive);
  item.addEventListener('click', (e) => {
    console.log('[Popup] Click event fired on item:', config.name);
    e.preventDefault();
    e.stopPropagation();
    handleProxyClick(config);
  });

  return item;
}

/**
 * Handle proxy item click
 */
async function handleProxyClick(config) {
  console.log('[Popup] Proxy item clicked:', config.name, config.id);
  
  // If already active, do nothing
  if (currentStatus?.isActive && currentStatus?.proxy?.id === config.id) {
    console.log('[Popup] Proxy already active, ignoring click');
    return;
  }

  try {
    // Show loading state
    statusText.textContent = t('statusConnecting');
    console.log('[Popup] Sending APPLY_PROXY message');

    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.APPLY_PROXY,
      data: { configId: config.id }
    });

    console.log('[Popup] APPLY_PROXY response:', response);

    if (response.success) {
      console.log('[Popup] Proxy applied successfully');
      // Reload status
      await loadProxyStatus();
      renderProxyList();
    } else {
      console.error('[Popup] Failed to apply proxy:', response.error);
      showError(response.error || t('errorFailedToApply'));
      await loadProxyStatus();
    }
  } catch (error) {
    console.error('[Popup] Error applying proxy:', error);
    showError(t('errorFailedToApply'));
    await loadProxyStatus();
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
    console.error('Error disconnecting:', error);
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
  console.error(message);
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

console.log('Popup loaded');
