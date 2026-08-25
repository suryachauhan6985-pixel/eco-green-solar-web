const fs = require('fs');
const execSync = require('child_process').execSync;
const original = execSync('git show a173b2f:js/app.js', { encoding: 'utf8' }).split('\n');

console.log('Original lines:', original.length);

// Let us inspect the exact line boundaries:
// 1. Core ERP Config & Debounce: lines 1-248 (index 0 to 248)
// 2. applyErpModeRules: lines 249-262 (index 248 to 262)
// 3. TopProgress & Loaders: lines 263-620 (index 262 to 620)
// 4. Permissions & PWA: lines 621-860 (index 620 to 860)
// 5. Network Sentinel & Fetch Interceptor: lines 861-970 (index 860 to 970)
// 6. Toast, Popups, Table Search & Filters: lines 972-1463 (index 971 to 1463)
// 7. Login, Auth, Biometrics, 2FA, Sessions: lines 1464-3219 (index 1463 to 3219)
// 8. Settings Panel, Themes, Profile, Shortcuts: lines 3220-6149 (index 3219 to 6149)
// 9. Shree Sava / Tally Navigation, Flyouts, Router, Hotkeys: lines 6150-7728 (index 6149 to 7728)
// 10. Scroll Lock & Modal Engine: lines 7729-8066 (index 7728 to 8066)
// 11. Date Picker: lines 8068-8278 (index 8067 to 8278)
// 12. Bootstrapper: lines 8279-8298 (index 8278 to 8298)

// 1. js/core/ui-feedback.js
const uiFeedback = `// js/core/ui-feedback.js
// Core UI Feedback Engine: Loaders, Toasts, Popups, Modals, Date Picker & Table Filters

(function () {
${original.slice(0, 248).join('\n')}
${original.slice(262, 620).join('\n')}
${original.slice(971, 1463).join('\n')}
${original.slice(7728, 8066).join('\n')}
})();

${original.slice(8067, 8278).join('\n')}
`;
fs.writeFileSync('js/core/ui-feedback.js', uiFeedback, 'utf8');

// 2. js/core/pwa-permissions.js
const pwaPermissions = `// js/core/pwa-permissions.js
// Hardware & Browser Permissions Engine (Camera, Mic, Storage, Notifications) & PWA Install Guide

(function () {
${original.slice(620, 860).join('\n')}
})();
`;
fs.writeFileSync('js/core/pwa-permissions.js', pwaPermissions, 'utf8');

// 3. js/core/auth-session.js
const authSession = `// js/core/auth-session.js
// Authentication State, JWT Interceptor, Login Modal, Biometrics, 2FA & Multi-Tenant Sessions

${original.slice(860, 970).join('\n')}

(function () {
${original.slice(1463, 3219).join('\n')}
})();
`;
fs.writeFileSync('js/core/auth-session.js', authSession, 'utf8');

// 4. js/core/settings-panel.js
const settingsPanel = `// js/core/settings-panel.js
// App Configuration Panel, Theme Switcher, Typography, Audio & Keyboard Shortcuts Guide

(function () {
${original.slice(3219, 6149).join('\n')}
})();
`;
fs.writeFileSync('js/core/settings-panel.js', settingsPanel, 'utf8');

// 5. js/core/navigation-engine.js
const navEngine = `// js/core/navigation-engine.js
// Shree Sava / Tally Navigation Engine, Flyouts, Ladder History & Keyboard Hotkeys Router

(function () {
${original.slice(248, 262).join('\n')}
${original.slice(6149, 7728).join('\n')}
})();
`;
fs.writeFileSync('js/core/navigation-engine.js', navEngine, 'utf8');

// 6. js/app.js
const appBootstrapper = `// js/app.js
// Main Application Entrypoint & Bootstrapper
// Wires up core modules, renders initial navigation, and starts routing lifecycle.

(function () {
${original.slice(8278, 8298).join('\n')}
})();
`;
fs.writeFileSync('js/app.js', appBootstrapper, 'utf8');

console.log('Rebuilt all 6 files cleanly!');
