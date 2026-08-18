// Theme controller — Dark / Gray / Light
// Preference stored in localStorage key "egs-theme".
(function () {
  const KEY = 'egs-theme';
  const ALLOWED = ['dark', 'gray', 'light'];

  function currentTheme() {
    const t = document.documentElement.getAttribute('data-theme') || 'dark';
    return ALLOWED.includes(t) ? t : 'dark';
  }

  function applyTheme(name) {
    const t = ALLOWED.includes(name) ? name : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch (e) { /* ignore */ }

    // Browser chrome (mobile address bar)
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#111111';
      meta.setAttribute('content', bg);
    }

    // Highlight active button(s)
    document.querySelectorAll('[data-theme-set]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-theme-set') === t);
    });
  }

  function wire() {
    document.querySelectorAll('[data-theme-set]').forEach((btn) => {
      btn.addEventListener('click', () => applyTheme(btn.getAttribute('data-theme-set')));
    });
    applyTheme(currentTheme());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  window.setAppTheme = applyTheme;
  window.getAppTheme = currentTheme;
})();
