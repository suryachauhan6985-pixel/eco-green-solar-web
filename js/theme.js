// Theme controller — Dark / Gray / Light
// localStorage for instant paint; server preferences for cross-device sync.
(function () {
  const KEY = 'egs-theme';
  const ALLOWED = ['dark', 'gray', 'light'];

  function currentTheme() {
    const t = document.documentElement.getAttribute('data-theme') || 'dark';
    return ALLOWED.includes(t) ? t : 'dark';
  }

  function applyTheme(name, opts) {
    const t = ALLOWED.includes(name) ? name : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch (e) {}

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#111111';
      meta.setAttribute('content', bg);
    }

    document.querySelectorAll('[data-theme-set]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-theme-set') === t);
    });

    // Persist to server when logged in (cross-device)
    if (!opts || !opts.skipServer) {
      try {
        if (window.currentAuthToken && window.Api && window.Api.put) {
          window.Api.put('/auth/preferences', { preferences: { theme: t } }).catch(function () {});
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
  }

  async function loadThemeFromServer() {
    try {
      if (!window.currentAuthToken || !window.Api) return;
      const data = await window.Api.get('/auth/preferences', { silent: true });
      const theme = data && data.preferences && data.preferences.theme;
      if (theme && ALLOWED.includes(theme)) applyTheme(theme, { skipServer: true });
    } catch (e) {}
  }

  function boot() {
    wireButtons(document);
    applyTheme(currentTheme(), { skipServer: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.setAppTheme = applyTheme;
  window.getAppTheme = currentTheme;
  window.wireThemeButtons = wireButtons;
  window.loadThemeFromServer = loadThemeFromServer;
})();
