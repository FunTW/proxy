import { PROXY_TYPES, PROXY_MODES, DEFAULT_BYPASS_LIST, DEFAULT_PROXY_COLOR } from './constants.js';

/**
 * Proxy management logic and utilities
 */

/**
 * Create a new proxy configuration object
 * @param {Object} data - Input data
 * @returns {Object} Complete proxy configuration
 */
export function createProxyConfig(data) {
  return {
    id: crypto.randomUUID(),
    name: data.name || 'Untitled Proxy',
    type: data.type || PROXY_TYPES.HTTP,
    host: data.host || '',
    port: data.port || 8080,
    bypassList: data.bypassList || [...DEFAULT_BYPASS_LIST],
    pacScript: data.pacScript || '',
    isActive: false,
    createdAt: new Date().toISOString(),
    lastUsed: null,
    color: data.color || DEFAULT_PROXY_COLOR
  };
}

/**
 * Validate proxy configuration
 * @param {Object} config - Proxy configuration
 * @returns {Object} Validation result { valid: boolean, error: string }
 */
export function validateProxyConfig(config) {
  // Check required fields
  if (!config.name || config.name.trim() === '') {
    return { valid: false, error: 'Proxy name is required' };
  }

  if (!config.type) {
    return { valid: false, error: 'Proxy type is required' };
  }

  // Validate based on proxy type
  if (config.type === PROXY_TYPES.PAC) {
    if (!config.pacScript || config.pacScript.trim() === '') {
      return { valid: false, error: 'PAC script is required for PAC type' };
    }
    // Basic PAC script validation
    if (!config.pacScript.includes('FindProxyForURL')) {
      return { valid: false, error: 'PAC script must contain FindProxyForURL function' };
    }
  } else if (config.type === PROXY_TYPES.AUTO_DETECT || config.type === PROXY_TYPES.DIRECT) {
    // No host/port validation needed for auto-detect or direct
    return { valid: true, error: null };
  } else {
    // For HTTP, HTTPS, SOCKS4, SOCKS5
    if (!config.host || config.host.trim() === '') {
      return { valid: false, error: 'Proxy host is required' };
    }

    // Validate host format (basic check)
    const hostPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;

    if (!hostPattern.test(config.host) && !ipPattern.test(config.host)) {
      return { valid: false, error: 'Invalid host format' };
    }

    // Validate port
    const port = parseInt(config.port);
    if (isNaN(port) || port < 1 || port > 65535) {
      return { valid: false, error: 'Port must be between 1 and 65535' };
    }
  }

  return { valid: true, error: null };
}

/**
 * Format proxy configuration for chrome.proxy API
 * @param {Object} config - Proxy configuration
 * @returns {Object} Formatted configuration for chrome.proxy.settings.set
 */
export function formatProxyRules(config) {
  if (config.type === PROXY_TYPES.DIRECT) {
    return {
      value: {
        mode: PROXY_MODES.DIRECT
      },
      scope: 'regular'
    };
  }

  if (config.type === PROXY_TYPES.AUTO_DETECT) {
    return {
      value: {
        mode: PROXY_MODES.AUTO_DETECT
      },
      scope: 'regular'
    };
  }

  if (config.type === PROXY_TYPES.PAC) {
    return {
      value: {
        mode: PROXY_MODES.PAC_SCRIPT,
        pacScript: {
          data: config.pacScript
        }
      },
      scope: 'regular'
    };
  }

  // For HTTP, HTTPS, SOCKS4, SOCKS5
  const proxyConfig = {
    value: {
      mode: PROXY_MODES.FIXED_SERVERS,
      rules: {
        singleProxy: {
          scheme: config.type,
          host: config.host,
          port: parseInt(config.port)
        },
        bypassList: generateBypassList(config.bypassList)
      }
    },
    scope: 'regular'
  };

  return proxyConfig;
}

/**
 * Generate bypass list for chrome.proxy API
 * @param {Array|string} domains - Array of domains or comma-separated string
 * @returns {Array} Formatted bypass list
 */
export function generateBypassList(domains) {
  if (!domains) {
    return [...DEFAULT_BYPASS_LIST];
  }

  if (typeof domains === 'string') {
    // Split by comma and trim whitespace
    domains = domains.split(',').map(d => d.trim()).filter(d => d.length > 0);
  }

  if (!Array.isArray(domains)) {
    return [...DEFAULT_BYPASS_LIST];
  }

  // Remove empty strings and return
  return domains.filter(d => d && d.trim().length > 0);
}

/**
 * Parse and validate PAC script
 * @param {string} script - PAC script content
 * @returns {Object} Validation result { valid: boolean, error: string }
 */
export function parsePACScript(script) {
  if (!script || script.trim() === '') {
    return { valid: false, error: 'PAC script cannot be empty' };
  }

  // Check for required FindProxyForURL function
  if (!script.includes('FindProxyForURL')) {
    return { valid: false, error: 'PAC script must contain FindProxyForURL function' };
  }

  // Basic syntax check - try to detect obvious errors
  const openBraces = (script.match(/\{/g) || []).length;
  const closeBraces = (script.match(/\}/g) || []).length;

  if (openBraces !== closeBraces) {
    return { valid: false, error: 'Unmatched braces in PAC script' };
  }

  // Check for function signature
  const functionPattern = /function\s+FindProxyForURL\s*\(\s*url\s*,\s*host\s*\)/;
  if (!functionPattern.test(script)) {
    return {
      valid: false,
      error: 'PAC script must have function signature: function FindProxyForURL(url, host)'
    };
  }

  return { valid: true, error: null };
}

/**
 * Get proxy scheme display name
 * @param {string} type - Proxy type
 * @returns {string} Display name
 */
export function getProxyTypeDisplayName(type) {
  const displayNames = {
    [PROXY_TYPES.HTTP]: 'HTTP',
    [PROXY_TYPES.HTTPS]: 'HTTPS',
    [PROXY_TYPES.SOCKS4]: 'SOCKS4',
    [PROXY_TYPES.SOCKS5]: 'SOCKS5',
    [PROXY_TYPES.PAC]: 'PAC Script',
    [PROXY_TYPES.AUTO_DETECT]: 'Auto Detect',
    [PROXY_TYPES.DIRECT]: 'Direct Connection'
  };

  return displayNames[type] || type.toUpperCase();
}

/**
 * Format proxy address for display
 * @param {Object} config - Proxy configuration
 * @returns {string} Formatted address
 */
export function formatProxyAddress(config) {
  if (config.type === PROXY_TYPES.PAC) {
    return 'PAC Script';
  }

  if (config.type === PROXY_TYPES.AUTO_DETECT) {
    return 'Auto Detect';
  }

  if (config.type === PROXY_TYPES.DIRECT) {
    return 'Direct Connection';
  }

  return `${config.host}:${config.port}`;
}

/**
 * Create a sample PAC script template
 * @returns {string} PAC script template
 */
export function createPACScriptTemplate() {
  return `function FindProxyForURL(url, host) {
  // Direct connection for local addresses
  if (isPlainHostName(host) ||
      shExpMatch(host, "*.local") ||
      isInNet(dnsResolve(host), "10.0.0.0", "255.0.0.0") ||
      isInNet(dnsResolve(host), "172.16.0.0", "255.240.0.0") ||
      isInNet(dnsResolve(host), "192.168.0.0", "255.255.0.0") ||
      isInNet(dnsResolve(host), "127.0.0.0", "255.255.255.0")) {
    return "DIRECT";
  }

  // Use proxy for all other addresses
  return "PROXY proxy.example.com:8080";
}`;
}
