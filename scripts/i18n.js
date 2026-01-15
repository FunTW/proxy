/**
 * i18n utility functions
 */

/**
 * Get translated message
 * @param {string} key - Message key
 * @param {string|Array} substitutions - Optional substitutions
 * @returns {string} Translated message
 */
export function getMessage(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

/**
 * Initialize i18n for HTML elements with data-i18n attribute
 * Usage: <div data-i18n="messageKey"></div>
 * For placeholders: <input data-i18n-placeholder="messageKey">
 * For titles: <button data-i18n-title="messageKey">
 */
export function initializeI18n() {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = getMessage(key);
  });

  // Placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    element.placeholder = getMessage(key);
  });

  // Titles
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    element.title = getMessage(key);
  });

  // Values (for buttons, etc.)
  document.querySelectorAll('[data-i18n-value]').forEach(element => {
    const key = element.getAttribute('data-i18n-value');
    element.value = getMessage(key);
  });
}

/**
 * Get current locale
 * @returns {string} Current locale (e.g., 'en', 'zh_TW')
 */
export function getCurrentLocale() {
  return chrome.i18n.getUILanguage();
}

/**
 * Check if current locale is Chinese
 * @returns {boolean} True if Chinese locale
 */
export function isChinese() {
  const locale = getCurrentLocale();
  return locale.startsWith('zh');
}

// Export shorthand alias
export const t = getMessage;
