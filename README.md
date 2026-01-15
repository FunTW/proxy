# Proxy Manager - Chrome Extension

A Chrome extension for managing and switching proxy configurations with support for HTTP/HTTPS, SOCKS4/SOCKS5, PAC scripts, and auto-detect modes.

## 最近更新 (Recent Updates)

### 2026-01-16

#### 全面優化 (Comprehensive Optimization)

1. **效能優化 (Performance Improvements)**
   - 在 service worker 中加入配置快取機制，減少重複的 storage 讀取
   - 使用 DocumentFragment 批量 DOM 操作，提升渲染效能
   - 加入 retry 機制處理暫時性網路錯誤
   - 優化事件監聽器管理，避免記憶體洩漏

2. **安全性增強 (Security Enhancements)**
   - 所有用戶輸入都經過 XSS 防護處理（使用 `escapeHtml`）
   - 加強輸入驗證：
     - Port 範圍驗證（1-65535）
     - Host 格式驗證（IP/域名）
     - PAC script 大小限制（1MB）
     - Proxy 名稱長度限制（100字元）
     - Bypass list 數量限制（100項）
   - 防止 PAC script 注入攻擊

3. **錯誤處理改善 (Error Handling)**
   - 統一的錯誤處理機制
   - 更詳細的錯誤訊息
   - 完整的 try-catch 覆蓋
   - 連線測試超時處理優化

4. **程式碼品質提升 (Code Quality)**
   - 新增 `utils.js` 共用工具模組
   - 移除 magic numbers，使用常數定義
   - 修復事件監聽器記憶體洩漏問題
   - 改善 loading 狀態管理
   - 統一的 Toast 通知管理

5. **新增工具函數 (New Utilities)**
   - `ToastManager`: 統一的通知管理
   - `LoadingManager`: 載入狀態管理
   - `PerformanceMonitor`: 效能監控
   - `debounce/throttle`: 函數節流
   - `retryOperation`: 重試機制
   - `escapeHtml`: XSS 防護

### 2026-01-15

#### 修復問題 (Bug Fixes)

1. **Omega 導入功能修復**: 修復了從 SwitchyOmega/ZeroOmega 導入配置時失敗的問題
   - **問題**：解析器嘗試從 `profile.host` 和 `profile.port` 讀取配置，但 Omega 格式將這些屬性存儲在 `profile.fallbackProxy` 對象中
   - **修復**：更新 `scripts/omega-parser.js` 中的 `convertFixedProfile` 函數，正確從 `fallbackProxy` 對象中提取代理設置
   - **結果**：現在可以成功導入所有 FixedProfile 類型的配置（36個配置全部成功導入）

2. **增強調試日誌**: 為快速切換功能添加了詳細的調試日誌
   - 在 `popup/popup.js` 的 `handleProxyClick` 函數中添加日誌
   - 在 `background/service-worker.js` 的 `applyProxyConfig` 函數中添加日誌
   - 幫助診斷代理切換過程中的問題

## 測試快速切換功能 (Testing Quick Switch)

### 1. 加載擴展

```bash
1. 打開 Chrome 瀏覽器
2. 進入 chrome://extensions/
3. 開啟「開發人員模式」
4. 點擊「載入未封裝項目」
5. 選擇此專案目錄
```

### 2. 導入配置

```bash
1. 點擊擴展圖標打開 popup
2. 點擊「Settings」按鈕
3. 在 Import/Export 區域點擊「Choose File」
4. 選擇 ZeroOmegaOptions-2026-01-15T15_36_19.017Z.bak 文件
5. 點擊「Import」按鈕
6. 確認配置已成功導入
```

### 3. 測試快速切換

```bash
1. 點擊擴展圖標打開 popup
2. 在「Quick Switch」列表中點擊任意代理配置
3. 觀察控制台日誌（按 F12 打開開發者工具）
4. 確認代理已成功應用
```

### 4. 查看調試日誌

打開 Chrome 開發者工具（F12），切換到「Console」標籤，查看以下日誌：

- `[Popup] Proxy item clicked:` - 確認點擊事件被觸發
- `[Popup] Sending APPLY_PROXY message` - 確認消息已發送
- `[Service Worker] applyProxyConfig called` - 確認 service worker 收到消息
- `[Service Worker] Proxy applied successfully` - 確認代理已成功應用

### 5. 檢查 Service Worker 日誌

```bash
1. 進入 chrome://extensions/
2. 找到 Proxy Manager 擴展
3. 點擊「Service Worker」鏈接
4. 在打開的開發者工具中查看日誌
```

## Features

- Quick proxy switching from popup interface
- Support for multiple proxy types:
  - HTTP
  - HTTPS
  - SOCKS4
  - SOCKS5
  - PAC Script
  - Auto Detect
- Proxy configuration management (Add, Edit, Delete)
- Connection testing
- Import/Export configurations
  - Native format support
  - **SwitchyOmega/ZeroOmega format support** (automatic conversion)
- Usage statistics tracking
- Visual status indicators
- Bypass list support
- **Multi-language support**:
  - English (en)
  - Traditional Chinese / 繁體中文 (zh_TW)
  - Simplified Chinese / 简体中文 (zh_CN)
  - Japanese / 日本語 (ja)
  - Korean / 한국어 (ko)
  - Spanish / Español (es)
  - French / Français (fr)
  - German / Deutsch (de)
  - Russian / Русский (ru)
  - Portuguese / Português (pt)
  - Italian / Italiano (it)

## Installation

### Load Unpacked Extension (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" using the toggle in the top-right corner
3. Click "Load unpacked"
4. Select the `proxy` directory containing this extension
5. The Proxy Manager extension should now appear in your extensions list

### Usage

#### Quick Switch (Popup)

1. Click the extension icon in the Chrome toolbar
2. View your current proxy status
3. Click any proxy from the list to activate it
4. Click "Disconnect" to disable the proxy
5. Click "Settings" to manage configurations

#### Managing Proxies (Options Page)

1. Right-click the extension icon and select "Options"
   - Or click "Settings" from the popup
2. Click "Add Proxy" to create a new configuration
3. Fill in the proxy details:
   - **Name**: A friendly name for the proxy
   - **Type**: Select the proxy type
   - **Host**: Proxy server address (for HTTP/HTTPS/SOCKS)
   - **Port**: Proxy port number
   - **Bypass List**: Domains that should bypass the proxy (comma-separated)
   - **PAC Script**: JavaScript PAC script (for PAC type only)
   - **Color**: A color tag for visual identification
4. Click "Save Configuration"

#### Testing Proxies

1. Go to the Options page
2. Click "Test" on any proxy card
3. The extension will attempt to connect through the proxy
4. Results will be shown in a notification

#### Import/Export

**Export:**
1. Go to the Options page
2. Click "Export"
3. A JSON file will be downloaded with all your configurations

**Import:**
1. Go to the Options page
2. Click "Import"
3. Select a backup file:
   - **Proxy Manager backup** (`.json`) - Native format
   - **SwitchyOmega/ZeroOmega backup** (`.bak`) - Automatically converted
4. Configurations will be merged with existing ones

**Supported Import Formats:**
- Native Proxy Manager backup files (`.json`)
- SwitchyOmega backup files (`.bak`)
- ZeroOmega backup files (`.bak`)

The extension automatically detects the format and converts proxy configurations accordingly. When importing from Omega format:
- FixedProfile → HTTP/HTTPS/SOCKS proxy
- PacProfile → PAC Script proxy
- DirectProfile → Direct connection
- SystemProfile → Auto Detect
- SwitchProfile (rules) are skipped

## File Structure

```
proxy/
├── manifest.json                    # Extension manifest
├── icons/                           # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── _locales/                        # Internationalization
│   ├── en/
│   │   └── messages.json            # English translations
│   └── zh_TW/
│       └── messages.json            # Traditional Chinese translations
├── popup/                           # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                         # Options page
│   ├── options.html
│   ├── options.css
│   └── options.js
├── background/                      # Service worker
│   └── service-worker.js
└── scripts/                         # Shared modules
    ├── storage.js                   # Storage abstraction layer
    ├── proxy-manager.js             # Proxy management logic
    ├── constants.js                 # Constants and configuration
    ├── i18n.js                      # i18n helper functions
    ├── logger.js                    # Logging utilities
    ├── utils.js                     # Common utility functions
    └── omega-parser.js              # Omega format parser
```

## Architecture

### Components

1. **Service Worker** (`background/service-worker.js`)
   - Manages proxy settings via Chrome Proxy API
   - Handles message passing between UI components
   - Tracks usage statistics

2. **Popup** (`popup/`)
   - Quick proxy switching interface
   - Status display
   - Minimal, fast UI for daily use

3. **Options Page** (`options/`)
   - Full configuration management
   - Import/Export functionality
   - Connection testing
   - Statistics display

4. **Shared Modules** (`scripts/`)
   - Storage abstraction layer
   - Proxy management utilities
   - Constants and types

### Communication Flow

```
Popup/Options → Runtime Messages → Service Worker → Chrome Proxy API
                                  ↓
                            Chrome Storage
```

## Proxy Types

### HTTP/HTTPS
Standard HTTP proxies. Most common type.

### SOCKS4/SOCKS5
More versatile proxies that work with any protocol.

### PAC Script
JavaScript-based auto-configuration. Example:

```javascript
function FindProxyForURL(url, host) {
  if (shExpMatch(host, "*.example.com")) {
    return "PROXY proxy.example.com:8080";
  }
  return "DIRECT";
}
```

### Auto Detect
Uses system proxy settings or WPAD (Web Proxy Auto-Discovery).

## Bypass List

Domains in the bypass list will connect directly without using the proxy. Examples:

- `localhost` - Bypass localhost
- `127.0.0.1` - Bypass loopback
- `*.local` - Bypass all .local domains
- `<local>` - Bypass all local addresses

## Troubleshooting

### Extension not loading
- Make sure Developer mode is enabled
- Check for errors in `chrome://extensions/`
- Verify all files are present

### Proxy not working
- Test the connection using the "Test" button
- Check proxy host and port are correct
- Verify the proxy server is accessible
- Check bypass list isn't blocking your target domain

### Badge not updating
- Refresh the extension
- Check service worker is running in `chrome://extensions/`

### Import fails
- Ensure JSON file is valid
- Check file was exported from this extension
- Verify file isn't corrupted

## Development

### Technologies Used
- Manifest V3
- Vanilla JavaScript (ES6 modules)
- Chrome Extensions API
- Chrome Proxy API
- Chrome Storage API

### Key APIs
- `chrome.proxy` - Proxy configuration
- `chrome.storage.local` - Data persistence
- `chrome.runtime` - Message passing
- `chrome.action` - Badge updates
- `chrome.i18n` - Internationalization

### Code Quality & Security

#### Performance Optimizations
- **Caching**: Config cache with 5-second TTL to reduce storage reads
- **Batch DOM Operations**: Using DocumentFragment for efficient rendering
- **Retry Mechanism**: Automatic retry for transient network errors
- **Memory Management**: Proper cleanup of event listeners on unload

#### Security Features
- **XSS Protection**: All user inputs are sanitized using `escapeHtml()`
- **Input Validation**:
  - Port range: 1-65535
  - Host format: Valid IP or domain name
  - PAC script size: Max 1MB
  - Proxy name length: Max 100 characters
  - Bypass list: Max 100 entries
- **Injection Prevention**: PAC scripts checked for malicious content

#### Error Handling
- Comprehensive try-catch blocks throughout
- Detailed error messages for debugging
- Graceful degradation on failures
- Connection timeout handling

#### Utility Functions
Located in `scripts/utils.js`:
- `ToastManager`: Unified notification system
- `LoadingManager`: Loading state management
- `PerformanceMonitor`: Performance tracking
- `debounce/throttle`: Function rate limiting
- `retryOperation`: Automatic retry logic
- `escapeHtml`: XSS protection
- `sanitizeInput`: Input sanitization

## Internationalization (i18n)

The extension supports multiple languages and will automatically use your browser's language settings.

### Supported Languages

- **English (en)** - Default language
- **Traditional Chinese (zh_TW)** - 繁體中文（台灣）
- **Simplified Chinese (zh_CN)** - 简体中文（中国）
- **Japanese (ja)** - 日本語
- **Korean (ko)** - 한국어
- **Spanish (es)** - Español
- **French (fr)** - Français
- **German (de)** - Deutsch
- **Russian (ru)** - Русский
- **Portuguese (pt)** - Português
- **Italian (it)** - Italiano

### How Language is Detected

The extension automatically detects your browser's language settings:
1. Chrome uses the system language or the language set in Chrome settings
2. The extension will use the matching translation if available
3. If no match is found, it defaults to English

### Changing Language

To change the language:
1. Open Chrome Settings
2. Go to "Languages"
3. Set your preferred language
4. Reload the extension

### Adding New Languages

To add support for a new language:

1. Create a new directory in `_locales/` with the language code (e.g., `_locales/ja/` for Japanese)
2. Copy `_locales/en/messages.json` to the new directory
3. Translate all message values in the JSON file
4. Reload the extension

Example language codes:
- `en` - English
- `zh_TW` - Traditional Chinese (Taiwan)
- `zh_CN` - Simplified Chinese (China)
- `ja` - Japanese
- `ko` - Korean
- `es` - Spanish
- `fr` - French
- `de` - German
- `ru` - Russian
- `pt` - Portuguese
- `it` - Italian

### Translation File Format

Each translation file (`messages.json`) follows this format:

```json
{
  "messageKey": {
    "message": "Translated text",
    "description": "Description of where this text is used"
  }
}
```

Example:
```json
{
  "extName": {
    "message": "Proxy Manager",
    "description": "Extension name"
  },
  "btnSave": {
    "message": "Save Configuration",
    "description": "Save button text"
  }
}
```

## Permissions

The extension requires these permissions:

- `proxy` - To manage proxy settings
- `storage` - To save configurations
- `unlimitedStorage` - For unlimited proxy configurations
- `<all_urls>` - For connection testing

## Future Enhancements

Possible features for future versions:

- Password authentication support
- Auto-switching rules based on URL patterns
- Proxy rotation
- Advanced statistics with charts
- Proxy profiles
- Dark mode
- Proxy speed testing
- Anonymity level checking

## License

This extension is provided as-is for personal use.

## Migrating from SwitchyOmega/ZeroOmega

If you're migrating from SwitchyOmega or ZeroOmega:

### Export from Omega

1. Open SwitchyOmega/ZeroOmega options page
2. Click on "Import/Export" in the left sidebar
3. Click "Generate Backup File"
4. Save the `.bak` file (e.g., `ZeroOmegaOptions-2026-01-15T15_36_19.017Z.bak`)

### Import to Proxy Manager

1. Open Proxy Manager options page
2. Click "Import" button
3. Select the `.bak` file from SwitchyOmega/ZeroOmega
4. The extension will automatically:
   - Detect the Omega format
   - Convert proxy profiles to our format
   - Import all compatible configurations

### What Gets Imported

✅ **Supported:**
- FixedProfile (HTTP, HTTPS, SOCKS4, SOCKS5)
- PacProfile (PAC Scripts)
- DirectProfile (Direct connection)
- SystemProfile (Auto-detect)
- Bypass rules/lists

❌ **Not Imported:**
- SwitchProfile (auto-switch rules) - These are complex rule sets specific to Omega
- VirtualProfile (profile references)
- Authentication credentials (for security)

### After Import

After importing, you can:
- Review all imported proxy configurations
- Edit names and colors
- Add new configurations
- Export in native format for backup

## Support

For issues or questions, please refer to the Chrome Extensions documentation:
https://developer.chrome.com/docs/extensions/
