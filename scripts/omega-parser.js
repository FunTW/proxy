/**
 * Parser for SwitchyOmega / ZeroOmega backup format
 */

import { PROXY_TYPES } from './constants.js';
import { createProxyConfig } from './proxy-manager.js';

/**
 * Detect if data is in Omega format
 * @param {Object} data - Parsed JSON data
 * @returns {boolean} True if Omega format
 */
export function isOmegaFormat(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check if it's our native format (has 'configs' array)
  if (data.configs && Array.isArray(data.configs)) {
    return false;
  }

  // Omega format characteristics:
  // 1. Has keys starting with '+' (profiles)
  // 2. Has 'schemaVersion' field
  // 3. Has keys starting with '-' (settings)

  let hasProfileKeys = false;
  let hasSchemaVersion = false;
  let hasSettingKeys = false;

  for (const key in data) {
    if (key.startsWith('+')) {
      hasProfileKeys = true;
    }
    if (key.startsWith('-')) {
      hasSettingKeys = true;
    }
    if (key === 'schemaVersion') {
      hasSchemaVersion = true;
    }
  }

  // If has profile keys with '+', it's likely Omega format
  if (hasProfileKeys) {
    return true;
  }

  // If has schemaVersion and setting keys, it's Omega format
  if (hasSchemaVersion && hasSettingKeys) {
    return true;
  }

  return false;
}

/**
 * Parse Omega backup and convert to our format
 * @param {Object} omegaData - Omega backup data
 * @returns {Array} Array of proxy configurations
 */
export function parseOmegaBackup(omegaData) {
  console.log('[Omega Parser] Starting parse, data keys:', Object.keys(omegaData));

  const configs = [];

  // Get all profiles from Omega backup
  const profiles = {};

  // Extract profiles (keys that start with '+')
  for (const key in omegaData) {
    if (key.startsWith('+') && typeof omegaData[key] === 'object') {
      const profileName = key.substring(1); // Remove '+' prefix
      profiles[profileName] = omegaData[key];
      console.log(`[Omega Parser] Found profile: ${profileName}`, omegaData[key]);
    }
  }

  console.log(`[Omega Parser] Total profiles found: ${Object.keys(profiles).length}`);

  // Convert each profile to our format
  for (const [name, profile] of Object.entries(profiles)) {
    // Skip special profiles
    if (name === 'ZeroOmega Conditions' || name === 'Proxy SwitchyOmega Conditions') {
      console.log(`[Omega Parser] Skipping special profile: ${name}`);
      continue;
    }

    const config = convertOmegaProfile(name, profile);
    if (config) {
      configs.push(config);
      console.log(`[Omega Parser] Converted profile: ${name}`, config);
    } else {
      console.log(`[Omega Parser] Failed to convert profile: ${name}`);
    }
  }

  console.log(`[Omega Parser] Total configs converted: ${configs.length}`);
  return configs;
}

/**
 * Convert a single Omega profile to our config format
 * @param {string} name - Profile name
 * @param {Object} profile - Omega profile object
 * @returns {Object|null} Our proxy config or null if unsupported
 */
function convertOmegaProfile(name, profile) {
  if (!profile || typeof profile !== 'object') {
    console.warn(`[Omega Parser] Invalid profile object for: ${name}`);
    return null;
  }

  const profileType = profile.profileType;
  console.log(`[Omega Parser] Converting profile: ${name}, type: ${profileType}`);

  switch (profileType) {
    case 'FixedProfile':
      return convertFixedProfile(name, profile);

    case 'PacProfile':
      return convertPacProfile(name, profile);

    case 'DirectProfile':
      return convertDirectProfile(name, profile);

    case 'SystemProfile':
      return convertSystemProfile(name, profile);

    case 'SwitchProfile':
      // SwitchProfile contains rules, we skip it for now
      // Could potentially be converted to multiple profiles
      console.log(`[Omega Parser] Skipping SwitchProfile: ${name}`);
      return null;

    case 'VirtualProfile':
      // Virtual profiles reference other profiles, skip
      console.log(`[Omega Parser] Skipping VirtualProfile: ${name}`);
      return null;

    default:
      console.warn(`[Omega Parser] Unknown Omega profile type: ${profileType} for profile: ${name}`);
      return null;
  }
}

/**
 * Convert FixedProfile (HTTP/HTTPS/SOCKS)
 */
function convertFixedProfile(name, profile) {
  console.log(`[Omega Parser] Converting FixedProfile: ${name}`, profile);

  // Extract proxy settings from fallbackProxy object
  const fallbackProxy = profile.fallbackProxy || {};
  const { host, port, scheme } = fallbackProxy;
  const { bypassList } = profile;

  if (!host || !port) {
    console.warn(`[Omega Parser] Invalid FixedProfile ${name}: missing host or port`, profile);
    return null;
  }

  // Map Omega scheme to our proxy type
  let proxyType;
  switch (scheme) {
    case 'http':
      proxyType = PROXY_TYPES.HTTP;
      break;
    case 'https':
      proxyType = PROXY_TYPES.HTTPS;
      break;
    case 'socks4':
      proxyType = PROXY_TYPES.SOCKS4;
      break;
    case 'socks5':
      proxyType = PROXY_TYPES.SOCKS5;
      break;
    default:
      console.warn(`[Omega Parser] Unknown scheme: ${scheme}, defaulting to HTTP`);
      proxyType = PROXY_TYPES.HTTP;
  }

  // Convert bypass list
  const bypass = convertBypassList(bypassList);

  const config = createProxyConfig({
    name: name,
    type: proxyType,
    host: host,
    port: port,
    bypassList: bypass,
    color: generateColorFromName(name)
  });

  console.log(`[Omega Parser] FixedProfile converted:`, config);
  return config;
}

/**
 * Convert PacProfile (PAC Script)
 */
function convertPacProfile(name, profile) {
  const { pacScript } = profile;

  if (!pacScript) {
    console.warn(`Invalid PacProfile ${name}: missing pacScript`);
    return null;
  }

  return createProxyConfig({
    name: name,
    type: PROXY_TYPES.PAC,
    pacScript: pacScript,
    color: generateColorFromName(name)
  });
}

/**
 * Convert DirectProfile (Direct connection)
 */
function convertDirectProfile(name, profile) {
  return createProxyConfig({
    name: name || 'Direct',
    type: PROXY_TYPES.DIRECT,
    color: '#9E9E9E'
  });
}

/**
 * Convert SystemProfile (Auto-detect)
 */
function convertSystemProfile(name, profile) {
  return createProxyConfig({
    name: name || 'System Proxy',
    type: PROXY_TYPES.AUTO_DETECT,
    color: '#FF9800'
  });
}

/**
 * Convert Omega bypass list to our format
 */
function convertBypassList(omegaBypassList) {
  if (!omegaBypassList || !Array.isArray(omegaBypassList)) {
    return ['localhost', '127.0.0.1', '<local>'];
  }

  // Omega bypass list format:
  // [{ conditionType: "BypassCondition", pattern: "localhost" }, ...]
  const bypassDomains = omegaBypassList
    .filter(item => item.conditionType === 'BypassCondition' && item.pattern)
    .map(item => item.pattern);

  // Add default bypass if empty
  if (bypassDomains.length === 0) {
    return ['localhost', '127.0.0.1', '<local>'];
  }

  return bypassDomains;
}

/**
 * Generate a color based on profile name
 */
function generateColorFromName(name) {
  const colors = [
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#F44336', // Red
    '#00BCD4', // Cyan
    '#FFEB3B', // Yellow
    '#795548'  // Brown
  ];

  // Simple hash function to pick color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Get statistics about Omega import
 * @param {Array} configs - Converted configs
 * @returns {Object} Import statistics
 */
export function getImportStats(configs) {
  const stats = {
    total: configs.length,
    byType: {}
  };

  configs.forEach(config => {
    const type = config.type;
    stats.byType[type] = (stats.byType[type] || 0) + 1;
  });

  return stats;
}
