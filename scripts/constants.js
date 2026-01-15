// Proxy types
export const PROXY_TYPES = {
  HTTP: 'http',
  HTTPS: 'https',
  SOCKS4: 'socks4',
  SOCKS5: 'socks5',
  PAC: 'pac',
  AUTO_DETECT: 'auto_detect',
  DIRECT: 'direct'
};

// Proxy modes for chrome.proxy API
export const PROXY_MODES = {
  FIXED_SERVERS: 'fixed_servers',
  PAC_SCRIPT: 'pac_script',
  AUTO_DETECT: 'auto_detect',
  DIRECT: 'direct',
  SYSTEM: 'system'
};

// Message types for communication between components
export const MESSAGE_TYPES = {
  GET_STATUS: 'GET_STATUS',
  APPLY_PROXY: 'APPLY_PROXY',
  DISABLE_PROXY: 'DISABLE_PROXY',
  GET_CONFIGS: 'GET_CONFIGS',
  SAVE_CONFIG: 'SAVE_CONFIG',
  UPDATE_CONFIG: 'UPDATE_CONFIG',
  DELETE_CONFIG: 'DELETE_CONFIG',
  TEST_CONNECTION: 'TEST_CONNECTION',
  GET_STATISTICS: 'GET_STATISTICS',
  CLEAR_STATISTICS: 'CLEAR_STATISTICS'
};

// Storage keys
export const STORAGE_KEYS = {
  PROXY_CONFIGS: 'proxyConfigs',
  CURRENT_PROXY_ID: 'currentProxyId',
  SETTINGS: 'settings',
  STATISTICS: 'statistics'
};

// Default settings
export const DEFAULT_SETTINGS = {
  autoConnect: false,
  defaultProxyId: null,
  showNotifications: true,
  quickSwitchCount: 5
};

// Default bypass list
export const DEFAULT_BYPASS_LIST = ['localhost', '127.0.0.1', '<local>'];

// Badge colors
export const BADGE_COLORS = {
  ACTIVE: '#4CAF50',
  INACTIVE: '#9E9E9E',
  ERROR: '#F44336'
};

// Badge text
export const BADGE_TEXT = {
  ACTIVE: 'ON',
  INACTIVE: '',
  ERROR: '!'
};

// Connection test timeout (ms)
export const CONNECTION_TEST_TIMEOUT = 10000;

// Test URL for connection testing
export const TEST_URL = 'https://www.google.com';

// Default color for new proxy configs
export const DEFAULT_PROXY_COLOR = '#2196F3';

// Toast notification timeout (ms)
export const TOAST_TIMEOUT = 3000;

// Maximum proxy name length
export const MAX_PROXY_NAME_LENGTH = 100;

// Port number constraints
export const PORT_MIN = 1;
export const PORT_MAX = 65535;

// Cache timeout (ms)
export const CACHE_TIMEOUT = 5000;

// Maximum PAC script size (bytes)
export const MAX_PAC_SCRIPT_SIZE = 1048576; // 1MB

// Retry configuration
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY = 1000;

// Debug mode (set to false in production)
export const DEBUG_MODE = false;
