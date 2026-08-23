// Theme, Font & Avatar Customizer Controller
// Supports 5 High-Contrast Themes: Dark / Gray / Light / Emerald / Ocean
// Supports Official Enterprise Typography & Avatar Accent Colors
(function () {
  const THEME_KEY = 'egs-theme';
  const FONT_KEY = 'egs-font';
  const AVATAR_KEY = 'egs-avatar';

  const ALLOWED_THEMES = ['dark', 'gray', 'light', 'emerald', 'ocean'];

  const FONTS = {
    'segoe': "'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif",
    'inter': "'Inter', system-ui, -apple-system, sans-serif",
    'roboto': "'Roboto', system-ui, -apple-system, sans-serif",
    'jakarta': "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    'outfit': "'Outfit', system-ui, -apple-system, sans-serif",
    'jetbrains': "'JetBrains Mono', monospace"
  };

  const AVATAR_PALETTE = {
    'gold': { bg: 'linear-gradient(135deg, #D4AF37, #B6952C)', txt: '#111111', border: '#D4AF37', name: 'Solar Gold' },
    'blue': { bg: 'linear-gradient(135deg, #3B8ED0, #2563EB)', txt: '#FFFFFF', border: '#3B8ED0', name: 'Royal Blue' },
    'emerald': { bg: 'linear-gradient(135deg, #2ECC71, #27AE60)', txt: '#FFFFFF', border: '#2ECC71', name: 'Emerald Green' },
    'purple': { bg: 'linear-gradient(135deg, #9B59B6, #8E44AD)', txt: '#FFFFFF', border: '#9B59B6', name: 'Purple Violet' },
    'crimson': { bg: 'linear-gradient(135deg, #E74C3C, #C0392B)', txt: '#FFFFFF', border: '#E74C3C', name: 'Crimson Red' },
    'cyan': { bg: 'linear-gradient(135deg, #00C0EF, #0097A7)', txt: '#FFFFFF', border: '#00C0EF', name: 'Cyan Teal' },
    'amber': { bg: 'linear-gradient(135deg, #F39C12, #E67E22)', txt: '#FFFFFF', border: '#F39C12', name: 'Sunset Amber' },
    'slate': { bg: 'linear-gradient(135deg, #64748B, #475569)', txt: '#FFFFFF', border: '#64748B', name: 'Slate Titanium' }
  };

  function currentTheme() {
    const t = document.documentElement.getAttribute('data-theme') || 'dark';
    return ALLOWED_THEMES.includes(t) ? t : 'dark';
  }

  function currentFont() {
    const f = localStorage.getItem(FONT_KEY) || 'segoe';
    return FONTS[f] ? f : 'segoe';
  }

  function currentAvatarColor() {
    const a = localStorage.getItem(AVATAR_KEY) || 'blue';
    return AVATAR_PALETTE[a] ? a : 'blue';
  }

  function applyTheme(name, opts) {
    const t = ALLOWED_THEMES.includes(name) ? name : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#111111';
      meta.setAttribute('content', bg);
    }

    document.querySelectorAll('[data-theme-set]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-theme-set') === t);
    });

    if (!opts || !opts.skipServer) {
      try {
        if (window.currentAuthToken && window.Api && window.Api.put) {
          window.Api.put('/auth/preferences', { preferences: { theme: t } }).catch(function () {});
        }
      } catch (e) {}
    }
  }

  function applyFontFamily(fontKey, opts) {
    const key = FONTS[fontKey] ? fontKey : 'segoe';
    const fontVal = FONTS[key];
    document.documentElement.style.setProperty('--font-main', fontVal);
    try { localStorage.setItem(FONT_KEY, key); } catch (e) {}

    document.querySelectorAll('[data-font-set]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-font-set') === key);
    });

    if (!opts || !opts.skipServer) {
      try {
        if (window.currentAuthToken && window.Api && window.Api.put) {
          window.Api.put('/auth/preferences', { preferences: { font_family: key } }).catch(function () {});
        }
      } catch (e) {}
    }
  }

  function applyAvatarColor(colorKey, opts) {
    const key = AVATAR_PALETTE[colorKey] ? colorKey : 'blue';
    const pal = AVATAR_PALETTE[key];
    document.documentElement.style.setProperty('--avatar-bg', pal.bg);
    document.documentElement.style.setProperty('--avatar-txt', pal.txt);
    document.documentElement.style.setProperty('--avatar-border', pal.border);
    try { localStorage.setItem(AVATAR_KEY, key); } catch (e) {}

    document.querySelectorAll('[data-avatar-set]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-avatar-set') === key);
    });

    // Direct DOM element update for instant visual feedback on desktop & mobile
    document.querySelectorAll('.avatar, .pa-avatar, .mobile-profile-avatar').forEach((el) => {
      el.style.setProperty('background', pal.bg, 'important');
      el.style.setProperty('color', pal.txt, 'important');
      el.style.setProperty('border-color', pal.border, 'important');
    });

    if (!opts || !opts.skipServer) {
      try {
        if (window.currentAuthToken && window.Api && window.Api.put) {
          window.Api.put('/auth/preferences', { preferences: { avatar_color: key } }).catch(function () {});
        }
      } catch (e) {}
    }
  }

  function wireButtons(root) {
    (root || document).querySelectorAll('[data-theme-set]').forEach((btn) => {
      if (btn.dataset.themeWired) return;
      btn.dataset.themeWired = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyTheme(btn.getAttribute('data-theme-set'));
      });
    });

    (root || document).querySelectorAll('[data-font-set]').forEach((btn) => {
      if (btn.dataset.fontWired) return;
      btn.dataset.fontWired = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyFontFamily(btn.getAttribute('data-font-set'));
      });
    });

    (root || document).querySelectorAll('[data-avatar-set]').forEach((btn) => {
      if (btn.dataset.avatarWired) return;
      btn.dataset.avatarWired = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyAvatarColor(btn.getAttribute('data-avatar-set'));
      });
    });
  }

  async function loadPreferencesFromServer() {
    try {
      if (!window.currentAuthToken || !window.Api) return;
      const data = await window.Api.get('/auth/preferences', { silent: true });
      const prefs = (data && data.preferences) || {};
      if (prefs.theme && ALLOWED_THEMES.includes(prefs.theme)) applyTheme(prefs.theme, { skipServer: true });
      if (prefs.font_family && FONTS[prefs.font_family]) applyFontFamily(prefs.font_family, { skipServer: true });
      if (prefs.avatar_color && AVATAR_PALETTE[prefs.avatar_color]) applyAvatarColor(prefs.avatar_color, { skipServer: true });
    } catch (e) {}
  }

  function boot() {
    wireButtons(document);
    applyTheme(currentTheme(), { skipServer: true });
    applyFontFamily(currentFont(), { skipServer: true });
    applyAvatarColor(currentAvatarColor(), { skipServer: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.setAppTheme = applyTheme;
  window.getAppTheme = currentTheme;
  window.setAppFont = applyFontFamily;
  window.getAppFont = currentFont;
  window.setAppAvatarColor = applyAvatarColor;
  window.getAppAvatarColor = currentAvatarColor;
  window.AVATAR_PALETTE = AVATAR_PALETTE;
  window.FONTS_PALETTE = FONTS;
  window.wireThemeButtons = wireButtons;
  window.loadThemeFromServer = loadPreferencesFromServer;
})();
