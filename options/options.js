import { MESSAGE_TYPES } from '../scripts/constants.js';
import {
  getProxyTypeDisplayName,
  formatProxyAddress,
  createPACScriptTemplate
} from '../scripts/proxy-manager.js';
import { exportAllData, importData } from '../scripts/storage.js';
import { initializeI18n, getMessage as t } from '../scripts/i18n.js';
import { logger } from '../scripts/logger.js';
import { ToastManager, escapeHtml } from '../scripts/utils.js';

let proxyListSidebar, emptyState, formSection, proxyForm, statisticsSection;
let configIdField, proxyNameField, proxyTypeField, proxyHostField, proxyPortField;
let bypassListField, pacScriptField, proxyColorField;
let serverFields, pacScriptFieldContainer;
let addProxyBtn, cancelFormBtn, cancelBtn, testBtn, deleteBtn, exportBtn, importBtn, importFile;
let formTitle, statisticsContainer, toast, loadTemplateBtn, versionInfo, clearStatisticsBtn;
let confirmModal, confirmModalTitle, confirmModalMessage, confirmModalCancel, confirmModalConfirm;

let proxyConfigs = [];
let currentStatus = null;
let statistics = null;
let editingConfigId = null;
let selectedConfigId = null;
let toastManager = null;
let storageChangeListener = null;
let proxyListClickHandler = null;
let confirmModalClickHandler = null;

/**
 * Initialize options page
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    initializeI18n();

    proxyListSidebar = document.getElementById('proxyListSidebar');
    emptyState = document.getElementById('emptyState');
    formSection = document.getElementById('formSection');
    statisticsSection = document.getElementById('statisticsSection');
    proxyForm = document.getElementById('proxyForm');
    formTitle = document.getElementById('formTitle');

    configIdField = document.getElementById('configId');
    proxyNameField = document.getElementById('proxyName');
    proxyTypeField = document.getElementById('proxyType');
    proxyHostField = document.getElementById('proxyHost');
    proxyPortField = document.getElementById('proxyPort');
    bypassListField = document.getElementById('bypassList');
    pacScriptField = document.getElementById('pacScript');
    proxyColorField = document.getElementById('proxyColor');

    serverFields = document.getElementById('serverFields');
    pacScriptFieldContainer = document.getElementById('pacScriptField');

    addProxyBtn = document.getElementById('addProxyBtn');
    cancelFormBtn = document.getElementById('cancelFormBtn');
    cancelBtn = document.getElementById('cancelBtn');
    testBtn = document.getElementById('testBtn');
    deleteBtn = document.getElementById('deleteBtn');
    exportBtn = document.getElementById('exportBtn');
    importBtn = document.getElementById('importBtn');
    importFile = document.getElementById('importFile');
    statisticsContainer = document.getElementById('statisticsContainer');
    toast = document.getElementById('toast');
    loadTemplateBtn = document.getElementById('loadTemplateBtn');
    versionInfo = document.getElementById('versionInfo');
    clearStatisticsBtn = document.getElementById('clearStatisticsBtn');
    confirmModal = document.getElementById('confirmModal');
    confirmModalTitle = document.getElementById('confirmModalTitle');
    confirmModalMessage = document.getElementById('confirmModalMessage');
    confirmModalCancel = document.getElementById('confirmModalCancel');
    confirmModalConfirm = document.getElementById('confirmModalConfirm');

    toastManager = new ToastManager(toast);

    displayVersion();

    addProxyBtn.addEventListener('click', showAddForm);
    cancelFormBtn.addEventListener('click', hideForm);
    cancelBtn.addEventListener('click', hideForm);
    testBtn.addEventListener('click', handleTestCurrent);
    deleteBtn.addEventListener('click', handleDeleteCurrent);
    proxyForm.addEventListener('submit', handleFormSubmit);
    proxyTypeField.addEventListener('change', handleTypeChange);
    exportBtn.addEventListener('click', handleExport);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleImport);
    loadTemplateBtn.addEventListener('click', loadPACTemplate);
    clearStatisticsBtn.addEventListener('click', handleClearStatistics);
    confirmModalCancel.addEventListener('click', hideConfirmModal);

    confirmModalClickHandler = (e) => {
      if (e.target === confirmModal) {
        hideConfirmModal();
      }
    };
    confirmModal.addEventListener('click', confirmModalClickHandler);

    storageChangeListener = handleStorageChange;
    chrome.storage.onChanged.addListener(storageChangeListener);

    proxyListClickHandler = (e) => {
      const item = e.target.closest('.proxy-list-item');
      if (!item) return;

      const configId = item.dataset.configId;
      if (!configId) return;

      const config = proxyConfigs.find(c => c.id === configId);
      if (config) {
        showProxyDetail(config);
      }
    };
    proxyListSidebar.addEventListener('click', proxyListClickHandler);

    await loadData();
  } catch (error) {
    logger.error('[Options] Initialization error:', error);
    if (toastManager) {
      toastManager.show(t('errorFailedToLoad'), 'error');
    }
  }
});

window.addEventListener('unload', () => {
  if (storageChangeListener) {
    chrome.storage.onChanged.removeListener(storageChangeListener);
  }
  if (proxyListClickHandler && proxyListSidebar) {
    proxyListSidebar.removeEventListener('click', proxyListClickHandler);
  }
  if (confirmModalClickHandler && confirmModal) {
    confirmModal.removeEventListener('click', confirmModalClickHandler);
  }
  if (toastManager) {
    toastManager.destroy();
  }
});

/**
 * Load all data
 */
async function loadData() {
  try {
    await Promise.all([
      loadProxyConfigs(),
      loadCurrentStatus(),
      loadStatistics()
    ]);
  } catch (error) {
    logger.error('Error loading data:', error);
    showToast(t('errorFailedToLoad'), 'error');
  }
}

/**
 * Load proxy configurations
 */
async function loadProxyConfigs() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_CONFIGS
    });

    if (response.success) {
      proxyConfigs = response.data;
      renderProxyList();
    } else {
      showToast(t('errorFailedToLoad'), 'error');
    }
  } catch (error) {
    logger.error('Error loading proxy configs:', error);
  }
}

/**
 * Load current proxy status
 */
async function loadCurrentStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_STATUS
    });

    if (response.success) {
      currentStatus = response.data;
    }
  } catch (error) {
    logger.error('Error loading status:', error);
  }
}

/**
 * Load statistics
 */
async function loadStatistics() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_STATISTICS
    });

    if (response.success) {
      statistics = response.data;
      renderStatistics();
    }
  } catch (error) {
    logger.error('Error loading statistics:', error);
  }
}

/**
 * Render proxy list in sidebar
 */
function renderProxyList() {
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();

  if (proxyConfigs.length === 0) {
    emptyState.classList.add('visible');
    statisticsSection.style.display = 'block';
    formSection.style.display = 'none';
    proxyListSidebar.innerHTML = '';
    return;
  }

  emptyState.classList.remove('visible');

  proxyConfigs.forEach(config => {
    const item = createProxyListItem(config);
    fragment.appendChild(item);
  });

  // Clear and append all at once for better performance
  proxyListSidebar.innerHTML = '';
  proxyListSidebar.appendChild(fragment);

  // Show statistics by default if no config is selected
  if (!selectedConfigId && proxyConfigs.length > 0) {
    statisticsSection.style.display = 'block';
    formSection.style.display = 'none';
  }
}

/**
 * Create proxy list item for sidebar
 */
function createProxyListItem(config) {
  const item = document.createElement('div');
  item.className = 'proxy-list-item';
  item.dataset.configId = config.id;

  const isActive = currentStatus?.isActive && currentStatus?.proxy?.id === config.id;
  if (isActive) {
    item.classList.add('active');
  }

  if (selectedConfigId === config.id) {
    item.classList.add('selected');
  }

  const colorBar = document.createElement('div');
  colorBar.className = 'proxy-list-item-color';
  colorBar.style.backgroundColor = config.color || '#2196F3';

  const info = document.createElement('div');
  info.className = 'proxy-list-item-info';

  const name = document.createElement('div');
  name.className = 'proxy-list-item-name';
  name.textContent = escapeHtml(config.name);

  const type = document.createElement('div');
  type.className = 'proxy-list-item-type';
  type.textContent = getProxyTypeDisplayName(config.type);

  info.appendChild(name);
  info.appendChild(type);

  item.appendChild(colorBar);
  item.appendChild(info);

  if (isActive) {
    const badge = document.createElement('div');
    badge.className = 'proxy-list-item-badge';
    badge.textContent = t('badgeActive');
    item.appendChild(badge);
  }

  return item;
}

/**
 * Show proxy detail in right panel
 */
function showProxyDetail(config) {
  selectedConfigId = config.id;
  renderProxyList(); // Re-render to update selection

  // Hide statistics, show form for editing
  statisticsSection.style.display = 'none';
  formSection.style.display = 'block';

  // Populate form with config data
  showEditForm(config);
}

/**
 * Show add form
 */
function showAddForm() {
  editingConfigId = null;
  selectedConfigId = null;

  // Update sidebar selection first (this might reset view to statistics, so do it before showing form)
  renderProxyList();

  formTitle.textContent = t('formTitleAdd');
  proxyForm.reset();
  proxyColorField.value = '#2196F3';
  bypassListField.value = 'localhost, 127.0.0.1, <local>';

  // Hide test and delete buttons for new config
  testBtn.style.display = 'none';
  deleteBtn.style.display = 'none';

  // Show form, hide statistics
  statisticsSection.style.display = 'none';
  formSection.style.display = 'block';

  handleTypeChange();
}

/**
 * Show edit form
 */
function showEditForm(config) {
  editingConfigId = config.id;
  selectedConfigId = config.id;
  formTitle.textContent = t('formTitleEdit');

  configIdField.value = config.id;
  proxyNameField.value = config.name;
  proxyTypeField.value = config.type;
  proxyHostField.value = config.host || '';
  proxyPortField.value = config.port || '';
  bypassListField.value = Array.isArray(config.bypassList) ? config.bypassList.join(', ') : '';
  pacScriptField.value = config.pacScript || '';
  proxyColorField.value = config.color;

  // Show test and delete buttons for existing config
  testBtn.style.display = 'inline-block';
  deleteBtn.style.display = 'inline-block';

  // Show form, hide statistics
  statisticsSection.style.display = 'none';
  formSection.style.display = 'block';

  handleTypeChange();
}

/**
 * Hide form
 */
function hideForm() {
  formSection.style.display = 'none';
  statisticsSection.style.display = 'block';
  proxyForm.reset();
  editingConfigId = null;
  selectedConfigId = null;
  renderProxyList(); // Update sidebar selection
}

/**
 * Handle proxy type change
 */
function handleTypeChange() {
  const type = proxyTypeField.value;

  if (type === 'pac') {
    serverFields.style.display = 'none';
    pacScriptFieldContainer.style.display = 'block';
    proxyHostField.removeAttribute('required');
    proxyPortField.removeAttribute('required');
    pacScriptField.setAttribute('required', 'required');
  } else if (type === 'auto_detect' || type === 'direct') {
    serverFields.style.display = 'none';
    pacScriptFieldContainer.style.display = 'none';
    proxyHostField.removeAttribute('required');
    proxyPortField.removeAttribute('required');
    pacScriptField.removeAttribute('required');
  } else {
    serverFields.style.display = 'block';
    pacScriptFieldContainer.style.display = 'none';
    proxyHostField.setAttribute('required', 'required');
    proxyPortField.setAttribute('required', 'required');
    pacScriptField.removeAttribute('required');
  }
}

/**
 * Handle form submit
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const formData = {
    name: proxyNameField.value.trim(),
    type: proxyTypeField.value,
    host: proxyHostField.value.trim(),
    port: parseInt(proxyPortField.value) || 8080,
    bypassList: bypassListField.value.split(',').map(d => d.trim()).filter(d => d),
    pacScript: pacScriptField.value.trim(),
    color: proxyColorField.value
  };

  try {
    if (editingConfigId) {
      // Update existing
      formData.id = editingConfigId;
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.UPDATE_CONFIG,
        data: formData
      });

      if (response.success) {
        showToast(t('msgConfigUpdated'), 'success');
        hideForm();
        await loadData();
      } else {
        showToast(response.error || t('errorFailedToSave'), 'error');
      }
    } else {
      // Save new
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SAVE_CONFIG,
        data: formData
      });

      if (response.success) {
        showToast(t('msgConfigSaved'), 'success');
        hideForm();
        await loadData();
      } else {
        showToast(response.error || t('errorFailedToSave'), 'error');
      }
    }
  } catch (error) {
    logger.error('Error saving config:', error);
    showToast(t('errorFailedToSave'), 'error');
  }
}

/**
 * Handle test connection
 */
async function handleTest(config) {
  showToast(t('msgTestingConnection'), 'success');

  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.TEST_CONNECTION,
      data: { configId: config.id }
    });

    if (response.success) {
      showToast(response.data.message, 'success');
    } else {
      showToast(response.error || t('errorFailedToTest'), 'error');
    }
  } catch (error) {
    logger.error('Error testing connection:', error);
    showToast(t('errorFailedToTest'), 'error');
  }
}

/**
 * Handle test current config
 */
async function handleTestCurrent() {
  if (!editingConfigId) return;

  const config = proxyConfigs.find(c => c.id === editingConfigId);
  if (config) {
    await handleTest(config);
  }
}

/**
 * Handle delete current config
 */
async function handleDeleteCurrent() {
  if (!editingConfigId) return;

  const config = proxyConfigs.find(c => c.id === editingConfigId);
  if (config) {
    await handleDelete(config);
  }
}

/**
 * Handle delete configuration
 */
async function handleDelete(config) {
  showConfirmModal(`${t('msgDeleteConfirm')} "${config.name}"?`, async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.DELETE_CONFIG,
        data: { configId: config.id }
      });

      if (response.success) {
        showToast(t('msgConfigDeleted'), 'success');

        // If deleted config was selected, clear selection
        if (selectedConfigId === config.id) {
          selectedConfigId = null;
          formSection.style.display = 'none';
          statisticsSection.style.display = 'block';
        }

        await loadData();
      } else {
        showToast(response.error || t('errorFailedToDelete'), 'error');
      }
    } catch (error) {
      logger.error('Error deleting config:', error);
      showToast(t('errorFailedToDelete'), 'error');
    }
  });
}

/**
 * Handle export
 */
async function handleExport() {
  try {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proxy-manager-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('msgExportSuccess'), 'success');
  } catch (error) {
    logger.error('Error exporting:', error);
    showToast(t('errorFailedToExport'), 'error');
  }
}

/**
 * Handle import
 */
async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  logger.log('[Import UI] File selected:', file.name, 'type:', file.type, 'size:', file.size);

  try {
    const text = await file.text();
    logger.log('[Import UI] File read, length:', text.length);

    const data = JSON.parse(text);
    logger.log('[Import UI] JSON parsed successfully');

    const result = await importData(data, true);
    logger.log('[Import UI] Import result:', result);

    if (result.success) {
      // Show detailed import message
      let message = t('msgImportSuccess');
      if (result.isOmega && result.count) {
        const configWord = t('statisticsConnections').includes('連線') ? '個配置' : 'configs';
        message = `${t('msgImportOmegaSuccess')} (${result.count} ${configWord})`;
      } else if (result.count) {
        const configWord = t('statisticsConnections').includes('連線') ? '個配置' : 'configs';
        message = `${t('msgImportSuccess')} (${result.count} ${configWord})`;
      }
      showToast(message, 'success');
      await loadData();
    } else {
      logger.error('[Import UI] Import failed:', result.message);
      showToast(result.message || t('errorFailedToImport'), 'error');
    }
  } catch (error) {
    logger.error('[Import UI] Error importing:', error);
    let errorMsg = t('errorFailedToImport');
    if (error instanceof SyntaxError) {
      errorMsg = 'Invalid JSON format';
    } else if (error.message) {
      errorMsg = error.message;
    }
    showToast(errorMsg, 'error');
  }

  // Reset file input
  importFile.value = '';
}

/**
 * Load PAC script template
 */
function loadPACTemplate() {
  pacScriptField.value = createPACScriptTemplate();
  showToast(t('msgTemplateLoaded'), 'success');
}

/**
 * Render statistics
 */
function renderStatistics() {
  if (!statistics || !statistics.byProxy || Object.keys(statistics.byProxy).length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state visible';
    const emptyP = document.createElement('p');
    emptyP.textContent = t('emptyStateNoUsage');
    emptyDiv.appendChild(emptyP);
    statisticsContainer.innerHTML = '';
    statisticsContainer.appendChild(emptyDiv);
    return;
  }

  const maxConnections = Math.max(...Object.values(statistics.byProxy).map(s => s.connections));

  const fragment = document.createDocumentFragment();

  Object.entries(statistics.byProxy).forEach(([proxyId, stat]) => {
    const config = proxyConfigs.find(c => c.id === proxyId);
    const proxyName = config ? escapeHtml(config.name) : 'Unknown Proxy';
    const percentage = maxConnections > 0 ? (stat.connections / maxConnections) * 100 : 0;

    const statItem = document.createElement('div');
    statItem.className = 'stat-item';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'stat-name';
    nameDiv.textContent = proxyName;

    const barDiv = document.createElement('div');
    barDiv.className = 'stat-bar';
    const fillDiv = document.createElement('div');
    fillDiv.className = 'stat-bar-fill';
    fillDiv.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    barDiv.appendChild(fillDiv);

    const valueDiv = document.createElement('div');
    valueDiv.className = 'stat-value';
    const connections = parseInt(stat.connections) || 0;
    valueDiv.textContent = `${connections} ${t('statisticsConnections')}`;

    statItem.appendChild(nameDiv);
    statItem.appendChild(barDiv);
    statItem.appendChild(valueDiv);

    fragment.appendChild(statItem);
  });

  statisticsContainer.innerHTML = '';
  statisticsContainer.appendChild(fragment);
}

function showConfirmModal(message, onConfirm) {
  confirmModalMessage.textContent = escapeHtml(message);
  confirmModal.style.display = 'flex';

  const handleConfirm = () => {
    hideConfirmModal();
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
  };

  if (confirmModalConfirm._currentHandler) {
    confirmModalConfirm.removeEventListener('click', confirmModalConfirm._currentHandler);
  }

  confirmModalConfirm._currentHandler = handleConfirm;
  confirmModalConfirm.addEventListener('click', handleConfirm);
}

function hideConfirmModal() {
  confirmModal.style.display = 'none';
  if (confirmModalConfirm._currentHandler) {
    confirmModalConfirm.removeEventListener('click', confirmModalConfirm._currentHandler);
    confirmModalConfirm._currentHandler = null;
  }
}

/**
 * Handle clear statistics
 */
async function handleClearStatistics() {
  showConfirmModal(t('msgClearStatisticsConfirm'), async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CLEAR_STATISTICS
      });

      if (response.success) {
        showToast(t('msgStatisticsCleared'), 'success');
        await loadStatistics();
      } else {
        showToast(response.error || t('errorFailedToClear'), 'error');
      }
    } catch (error) {
      logger.error('Error clearing statistics:', error);
      showToast(t('errorFailedToClear'), 'error');
    }
  });
}

/**
 * Handle storage changes
 */
function handleStorageChange(changes, area) {
  if (area === 'local') {
    if (changes.proxyConfigs || changes.currentProxyId || changes.statistics) {
      loadData();
    }
  }
}

function showToast(message, type = 'success') {
  if (toastManager) {
    toastManager.show(message, type);
  }
}

/**
 * Display extension version
 */
function displayVersion() {
  const manifest = chrome.runtime.getManifest();
  versionInfo.textContent = `${t('version')} ${manifest.version}`;
}

logger.log('Options page loaded');
