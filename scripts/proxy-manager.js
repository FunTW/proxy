import { 
  PROXY_TYPES, 
  PROXY_MODES, 
  DEFAULT_BYPASS_LIST, 
  DEFAULT_PROXY_COLOR,
  MAX_PROXY_NAME_LENGTH,
  PORT_MIN,
  PORT_MAX,
  MAX_PAC_SCRIPT_SIZE
} from './constants.js';
import { sanitizeInput } from './utils.js';
import { logger } from './logger.js';

/**
 * Create a new proxy configuration object
 * @param {Object} data - Input data
 * @returns {Object} Complete proxy configuration
 */
export function createProxyConfig(data) {
  const name = sanitizeInput(data.name || 'Untitled Proxy', MAX_PROXY_NAME_LENGTH);
  const host = sanitizeInput(data.host || '', 255);
  
  return {
    id: crypto.randomUUID(),
    name: name.trim() || 'Untitled Proxy',
    type: data.type || PROXY_TYPES.HTTP,
    host: host.trim(),
    port: parseInt(data.port) || 8080,
    bypassList: Array.isArray(data.bypassList) 
      ? data.bypassList.map(d => sanitizeInput(d, 255).trim()).filter(d => d)
      : [...DEFAULT_BYPASS_LIST],
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
  try {
    if (!config || typeof config !== 'object') {
      return { valid: false, error: 'Invalid configuration object' };
    }
    
    if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
      return { valid: false, error: 'Proxy name is required' };
    }
    
    if (config.name.trim().length > MAX_PROXY_NAME_LENGTH) {
      return { valid: false, error: `Proxy name must be ${MAX_PROXY_NAME_LENGTH} characters or less` };
    }

    if (!config.type || typeof config.type !== 'string') {
      return { valid: false, error: 'Proxy type is required' };
    }
    
    const validTypes = Object.values(PROXY_TYPES);
    if (!validTypes.includes(config.type)) {
      return { valid: false, error: 'Invalid proxy type' };
    }

    if (config.type === PROXY_TYPES.PAC) {
      if (!config.pacScript || config.pacScript.trim() === '') {
        return { valid: false, error: 'PAC script is required for PAC type' };
      }
      
      const script = config.pacScript.trim();
      
      if (script.length > MAX_PAC_SCRIPT_SIZE) {
        return { valid: false, error: `PAC script exceeds maximum size of ${MAX_PAC_SCRIPT_SIZE} bytes` };
      }
      
      if (!script.includes('FindProxyForURL')) {
        return { valid: false, error: 'PAC script must contain FindProxyForURL function' };
      }
      
      const functionPattern = /function\s+FindProxyForURL\s*\(/;
      if (!functionPattern.test(script)) {
        return { valid: false, error: 'PAC script must have function FindProxyForURL(url, host)' };
      }
      
      const openBraces = (script.match(/\{/g) || []).length;
      const closeBraces = (script.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        return { valid: false, error: 'PAC script has unmatched braces' };
      }
      
      if (script.includes('<script>') || script.includes('</script>')) {
        return { valid: false, error: 'PAC script contains invalid HTML tags' };
      }
      
    } else if (config.type === PROXY_TYPES.AUTO_DETECT || config.type === PROXY_TYPES.DIRECT) {
      return { valid: true, error: null };
    } else {
      if (!config.host || config.host.trim() === '') {
        return { valid: false, error: 'Proxy host is required' };
      }

      const host = config.host.trim();
      
      if (host.length > 255) {
        return { valid: false, error: 'Host name is too long (max 255 characters)' };
      }
      
      const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      
      const isValidIP = ipPattern.test(host);
      if (isValidIP) {
        const parts = host.split('.');
        const allValid = parts.every(part => {
          const num = parseInt(part, 10);
          return num >= 0 && num <= 255;
        });
        if (!allValid) {
          return { valid: false, error: 'Invalid IP address format' };
        }
      }
      
      const isValidDomain = domainPattern.test(host);
      const isValidHostname = hostnamePattern.test(host);
      
      if (!isValidIP && !isValidDomain && !isValidHostname) {
        return { valid: false, error: 'Invalid host format. Use a valid domain name or IP address' };
      }

      const port = parseInt(config.port, 10);
      if (isNaN(port) || port < PORT_MIN || port > PORT_MAX) {
        return { valid: false, error: `Port must be between ${PORT_MIN} and ${PORT_MAX}` };
      }
      
      if (config.host && typeof config.host === 'string') {
        config.host = config.host.trim();
      }
    }

    if (config.bypassList && Array.isArray(config.bypassList)) {
      if (config.bypassList.length > 100) {
        return { valid: false, error: 'Bypass list is too long (max 100 entries)' };
      }
    }

    return { valid: true, error: null };
  } catch (error) {
    logger.error('Error validating proxy config:', error);
    return { valid: false, error: 'Validation error: ' + error.message };
  }
}

/**
 * Format proxy configuration for chrome.proxy API
 * @param {Object} config - Proxy configuration
 * @returns {Object} Formatted configuration for chrome.proxy.settings.set
 */
export function formatProxyRules(config) {
  try {
    if (!config || !config.type) {
      throw new Error('Invalid proxy configuration');
    }

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
      if (!config.pacScript) {
        throw new Error('PAC script is required');
      }
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

    if (!config.host || !config.port) {
      throw new Error('Host and port are required');
    }

    const proxyConfig = {
      value: {
        mode: PROXY_MODES.FIXED_SERVERS,
        rules: {
          singleProxy: {
            scheme: config.type,
            host: config.host.trim(),
            port: parseInt(config.port)
          },
          bypassList: generateBypassList(config.bypassList)
        }
      },
      scope: 'regular'
    };

    return proxyConfig;
  } catch (error) {
    logger.error('Error formatting proxy rules:', error);
    throw error;
  }
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
