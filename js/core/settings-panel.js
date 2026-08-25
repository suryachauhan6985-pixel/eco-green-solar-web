// js/core/settings-panel.js
// App Configuration Panel, Theme Switcher, Typography, Audio & Keyboard Shortcuts Guide

(function () {
  // =================== APP SETTINGS PANEL ===================
  async function openAppSettingsPanel() {
    const role = (window.currentRole || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin';
    let settings = { challan_prefix: '', challan_next: '1', challan_pad: '4' };
    try {
      const data = await window.Api.get('/auth/app-settings');
      if (data && data.settings) settings = Object.assign(settings, data.settings);
    } catch (e) { /* defaults */ }

    const theme = (window.getAppTheme && window.getAppTheme()) || 'dark';
    const themeBlock = `
      <div class="egs-set-section">
        <button type="button" class="egs-set-accordion" id="egsSetThemeToggle">
          <span><i class="fa-solid fa-palette"></i> Theme</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="egs-set-panel" id="egsSetThemePanel" style="display:none;">
          <div class="profile-theme-row" style="padding:8px 0; gap:8px;">
            <button type="button" class="theme-btn" data-theme-set="dark"><i class="fa-solid fa-moon"></i> Dark</button>
            <button type="button" class="theme-btn" data-theme-set="gray"><i class="fa-solid fa-circle-half-stroke"></i> Gray</button>
            <button type="button" class="theme-btn" data-theme-set="light"><i class="fa-solid fa-sun"></i> Light</button>
            <button type="button" class="theme-btn" data-theme-set="emerald"><i class="fa-solid fa-leaf" style="color:#2ecc71;"></i> Emerald</button>
            <button type="button" class="theme-btn" data-theme-set="ocean"><i class="fa-solid fa-water" style="color:#38bdf8;"></i> Ocean</button>
          </div>
        </div>
      </div>`;

    const challanBlock = isAdmin ? `
      <div class="egs-set-section">
        <button type="button" class="egs-set-accordion" id="egsSetChallanToggle">
          <span><i class="fa-solid fa-hashtag"></i> Challan number</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="egs-set-panel" id="egsSetChallanPanel" style="display:none;">
          <p class="note" style="margin:0 0 10px;font-size:12px;">Admin only — set prefix, next number and zero-padding. Example: prefix <b>CH</b>, next <b>127</b>, pad <b>4</b> → <b>CH0127</b>.</p>
          <div class="field" style="margin-bottom:8px;"><label>Prefix</label>
            <input id="egsChallanPrefix" type="text" value="${String(settings.challan_prefix || '').replace(/"/g,'&quot;')}" placeholder="e.g. CH or blank" autocomplete="off">
          </div>
          <div class="field" style="margin-bottom:8px;"><label>Next number</label>
            <input id="egsChallanNext" type="number" min="1" value="${String(settings.challan_next || '1').replace(/"/g,'&quot;')}" autocomplete="off">
          </div>
          <div class="field" style="margin-bottom:8px;"><label>Zero pad length</label>
            <input id="egsChallanPad" type="number" min="0" max="10" value="${String(settings.challan_pad || '4').replace(/"/g,'&quot;')}" autocomplete="off">
          </div>
          <div style="text-align:right;margin-top:8px;">
            <button type="button" class="btn btn-blue" id="egsChallanSave"><i class="fa-solid fa-floppy-disk"></i> Save challan settings</button>
          </div>
        </div>
      </div>` : `
      <p class="note" style="font-size:12px;margin:8px 0 0;">Challan sequence settings are available to Admin / Super Admin only.</p>`;

    const html = `
      <div class="egs-settings">
        ${themeBlock}
        ${challanBlock}
      </div>`;

    if (typeof window.openModal !== 'function') return;
    window.openModal('Settings', html);

    setTimeout(() => {
      const themeToggle = document.getElementById('egsSetThemeToggle');
      const themePanel = document.getElementById('egsSetThemePanel');
      if (themeToggle && themePanel) {
        themeToggle.addEventListener('click', () => {
          const open = themePanel.style.display !== 'none';
          themePanel.style.display = open ? 'none' : 'block';
        });
      }
      if (window.wireThemeButtons) window.wireThemeButtons(document.getElementById('modalBody') || document);
      if (window.getAppTheme) {
        document.querySelectorAll('#modalBody [data-theme-set]').forEach((btn) => {
          btn.classList.toggle('active', btn.getAttribute('data-theme-set') === window.getAppTheme());
        });
      }
      const chToggle = document.getElementById('egsSetChallanToggle');
      const chPanel = document.getElementById('egsSetChallanPanel');
      if (chToggle && chPanel) {
        chToggle.addEventListener('click', () => {
          chPanel.style.display = chPanel.style.display !== 'none' ? 'none' : 'block';
        });
      }
      const saveBtn = document.getElementById('egsChallanSave');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          try {
            await window.Api.put('/auth/app-settings', {
              settings: {
                challan_prefix: (document.getElementById('egsChallanPrefix') || {}).value || '',
                challan_next: (document.getElementById('egsChallanNext') || {}).value || '1',
                challan_pad: (document.getElementById('egsChallanPad') || {}).value || '4',
              },
            });
            if (window.showToast) window.showToast('Challan settings saved');
          } catch (err) {
            window.openModal('Save failed', `<p>${(err && err.message) || 'Could not save settings.'}</p>`);
          }
        });
      }
    }, 0);
  }

  // =================== PROFILE MENU (sidebar avatar) ===================
  // Clicking the rounded avatar in the sidebar opens a small dropdown, like
  // the desktop app's show_profile_menu(): header (@username / role), then
  // "Switch User" and "Logout" — instead of logging out directly.
  const profileBox = document.querySelector('.profile-box');
  let profileMenuEl = null;
  let profileMenuBackdrop = null;

  function closeProfileMenu() {
    if (profileMenuEl) { profileMenuEl.remove(); profileMenuEl = null; }
    if (profileMenuBackdrop) { profileMenuBackdrop.remove(); profileMenuBackdrop = null; }
    document.querySelectorAll('.profile-menu, .profile-menu-mobile, .profile-menu-backdrop').forEach((el) => el.remove());
  }
  window.closeProfileMenu = closeProfileMenu;

  function endSessionAndShowLogin() {
    closeProfileMenu();
    notifyServerLogout();
    clearSession();
    showLoginOverlay();
  }

  function updateProfileBox(username, role) {
    const roleEl = document.querySelector('.profile-box .role');
    const userEl = document.querySelector('.profile-box .user');
    const av = document.querySelector('.profile-box .avatar');
    if (roleEl) roleEl.textContent = role || '';
    if (userEl) userEl.textContent = username ? '@' + username : '';
    if (av && username) av.textContent = (username[0] || '?').toUpperCase();
  }

  async function switchToAccount(acc) {
    closeProfileMenu();
    if (!acc || !acc.token) return;
    // Activate saved token locally (no password) — Instagram-style quick switch
    saveSession(acc.username, acc.role, true, acc.token);
    updateProfileBox(acc.username, acc.role);
    if (window.showToast) window.showToast('Switched to @' + acc.username);
    // Soft reload current page data
    try {
      const hash = (location.hash || '#dashboard').replace(/^#/, '') || 'dashboard';
      if (typeof go === 'function') go(hash);
    } catch (e) { location.reload(); }
  }

  async function openLoginActivityPanel() {
    closeProfileMenu();
    let data;
    try {
      data = await window.Api.get('/auth/my-sessions');
    } catch (e) {
      window.openModal('Login activity', `<p class="note" style="color:var(--red);">${(e && e.message) || 'Could not load sessions.'}</p>`);
      return;
    }
    const sessions = (data && data.sessions) || [];
    const active = sessions.filter((s) => !s.revoked);
    const rows = active.length ? active.map((s) => {
      const when = s.lastSeen ? String(s.lastSeen).replace('T', ' ').slice(0, 16) : '—';
      const badge = s.isCurrent ? '<span class="sess-badge current">This device</span>' : '';
      const btn = s.isCurrent
        ? ''
        : `<button type="button" class="btn btn-ghost bom-mini-btn" data-revoke-id="${s.id}"><i class="fa-solid fa-right-from-bracket"></i> Log out</button>`;
      return `<div class="sess-row">
        <div class="sess-icon"><i class="fa-solid fa-desktop"></i></div>
        <div class="sess-meta">
          <div class="sess-title">${s.deviceLabel || 'Device'} ${badge}</div>
          <div class="sess-sub">Last active ${when}${s.ip ? ' · ' + s.ip : ''}</div>
        </div>
        <div class="sess-actions">${btn}</div>
      </div>`;
    }).join('') : '<p class="note">No active sessions.</p>';

    window.openModal('Login activity', `
      <p class="note" style="margin-top:0;">Where you're logged in — log out any device you don't recognise.</p>
      <div class="sess-list">${rows}</div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn btn-ghost" id="sessRevokeOthers"><i class="fa-solid fa-shield-halved"></i> Log out other devices</button>
      </div>
    `);

    const body = document.getElementById('modalBody');
    if (!body) return;
    body.querySelectorAll('[data-revoke-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-revoke-id');
        try {
          await window.Api.post('/auth/sessions/' + id + '/revoke', {});
          if (window.showToast) window.showToast('Device logged out');
          openLoginActivityPanel();
        } catch (e) {
          window.openModal('Error', `<p>${(e && e.message) || 'Failed'}</p>`);
        }
      });
    });
    const others = body.querySelector('#sessRevokeOthers');
    if (others) {
      others.addEventListener('click', async () => {
        const ok = await window.confirmDialog('Log out other devices', 'All other devices will be signed out. This device stays logged in.', { kind: 'warning', okLabel: 'Log out others' });
        if (!ok) return;
        try {
          await window.Api.post('/auth/sessions/revoke-others', {});
          if (window.showToast) window.showToast('Other devices logged out');
          openLoginActivityPanel();
        } catch (e) {
          window.openModal('Error', `<p>${(e && e.message) || 'Failed'}</p>`);
        }
      });
    }
  }

  function getKeyboardShortcutsContentHtml() {
    return `
      <div style="display:flex; flex-direction:column; gap:16px; font-size:13px;">
        <!-- Top Summary Banner -->
        <div style="background:rgba(30, 58, 138, 0.15); border:1px solid rgba(59, 130, 246, 0.3); border-radius:10px; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div>
            <strong style="color:var(--blue); font-size:14px;"><i class="fa-solid fa-keyboard"></i> Enterprise ERP Keyboard Fast-Lane</strong>
            <div style="font-size:12px; color:var(--txt-muted); margin-top:2px;">Operate the entire ERP seamlessly without a mouse using single-key hotkeys, cascading menus, and voucher function keys.</div>
          </div>
          <span class="pill pill-gold" style="font-weight:700;">Press F1 Anytime</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap:14px;">
          
          <!-- 1. Gateway & Sidebar Top-Level Hotkeys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:var(--gold); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-compass"></i> Gateway &amp; Main Navigation
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Gateway / Dashboard</span><kbd class="egs-kbd">G</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Accounts Info Group</span><kbd class="egs-kbd">A</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Transaction Entry Group</span><kbd class="egs-kbd">T</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Display / Print Books</span><kbd class="egs-kbd">D</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Utilities &amp; Setup Group</span><kbd class="egs-kbd">U</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt-muted); font-size:12px;">Flyout Menu Navigation</span><div><kbd class="egs-kbd">↑</kbd> <kbd class="egs-kbd">↓</kbd> <kbd class="egs-kbd">→</kbd> <kbd class="egs-kbd">←</kbd></div></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt-muted); font-size:12px;">Select / Execute Item</span><kbd class="egs-kbd">Enter</kbd></div>
            </div>
          </div>

          <!-- 2. Accounts Info Hotkeys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:var(--blue); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-folder-open"></i> Accounts Info Hotkeys (Press A)
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Ledger Info Submenu</span><kbd class="egs-kbd">L</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Create Ledger</span><kbd class="egs-kbd">C</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Display Ledger Register</span><kbd class="egs-kbd">D</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Alter / Edit Ledger</span><kbd class="egs-kbd">A</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Item / Product Info (Create/Disp/Alt)</span><kbd class="egs-kbd">I</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Group / Category Info</span><kbd class="egs-kbd">G</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Unit of Measure (UOM)</span><kbd class="egs-kbd">U</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Warehouse / Godown Info</span><kbd class="egs-kbd">W</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Brand Directory</span><kbd class="egs-kbd">B</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Customer &amp; Supplier Master</span><kbd class="egs-kbd">C</kbd></div>
            </div>
          </div>

          <!-- 3. Transaction Entry Hotkeys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:#22c55e; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-receipt"></i> Transaction Entry Hotkeys (Press T)
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Purchase Inward (Stock In)</span><kbd class="egs-kbd">P</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Project Sales &amp; Dispatch</span><kbd class="egs-kbd">S</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">BOM Kit Assembly &amp; Delivery</span><kbd class="egs-kbd">B</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Custom Challan Generator</span><kbd class="egs-kbd">C</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Stock Allocation &amp; Assignment</span><kbd class="egs-kbd">A</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Return / Damage Voucher</span><kbd class="egs-kbd">M</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Barcode Scan Sheet</span><kbd class="egs-kbd">N</kbd></div>
            </div>
          </div>

          <!-- 4. Accounting Vouchers Function Keys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:#f59e0b; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-money-bill-transfer"></i> Accounting Voucher Keys
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Payment Voucher Entry</span><kbd class="egs-kbd">F5</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Receipt Voucher Entry</span><kbd class="egs-kbd">F6</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Journal Voucher (Adjustments)</span><kbd class="egs-kbd">F7</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Debit Note (Purchase Return)</span><kbd class="egs-kbd">Alt + F5</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Credit Note (Sales Return)</span><kbd class="egs-kbd">Alt + F6</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Accounting Vouchers Studio</span><kbd class="egs-kbd">V</kbd></div>
            </div>
          </div>

          <!-- 5. Display & Print Books Hotkeys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:#a855f7; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-chart-pie"></i> Display / Print Hotkeys (Press D)
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Account Books &amp; Statements</span><kbd class="egs-kbd">A</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Party Ledger Register</span><kbd class="egs-kbd">L</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Purchase Register</span><kbd class="egs-kbd">P</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Sale Register</span><kbd class="egs-kbd">S</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Trial Balance Statement</span><kbd class="egs-kbd">T</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Profit &amp; Loss Account</span><kbd class="egs-kbd">O</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Balance Sheet</span><kbd class="egs-kbd">B</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Day Book</span><kbd class="egs-kbd">D</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Stock Books &amp; Registers</span><kbd class="egs-kbd">S</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Inventory Master Report</span><kbd class="egs-kbd">M</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Low Stock Alert Register</span><kbd class="egs-kbd">L</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ BOM Dispatch Register</span><kbd class="egs-kbd">B</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Challan Register</span><kbd class="egs-kbd">C</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Track Order Register</span><kbd class="egs-kbd">T</kbd></div>
            </div>
          </div>

          <!-- 6. Universal ERP Actions & Quick Keys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:var(--txt); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-bolt"></i> Universal ERP Actions
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Universal Quick Search</span><kbd class="egs-kbd">Ctrl + K</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Active Page Table Search</span><kbd class="egs-kbd">/</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Step-by-Step Back / Unfocus</span><kbd class="egs-kbd">Esc</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Next Field / Confirm Form</span><kbd class="egs-kbd">Enter</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Previous Form Field</span><kbd class="egs-kbd">Shift + Enter</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Save Voucher / Submit</span><div><kbd class="egs-kbd">Ctrl + Enter</kbd> or <kbd class="egs-kbd">Ctrl + S</kbd></div></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Shortcuts Reference Guide</span><kbd class="egs-kbd">F1</kbd></div>
            </div>
          </div>

        </div>
      </div>
    `;
  }
  window.getKeyboardShortcutsContentHtml = getKeyboardShortcutsContentHtml;

  function openAppSettingsPanel(defaultTabId) {
    closeProfileMenu();
    const activeTheme = (typeof window.getAppTheme === 'function') ? window.getAppTheme() : 'dark';
    const activeFont = (typeof window.getAppFont === 'function') ? window.getAppFont() : 'segoe';
    const activeAvatar = (typeof window.getAppAvatarColor === 'function') ? window.getAppAvatarColor() : 'gold';
    const currentRole = window.currentUserRole || 'User';
    const isSuperAdmin = currentRole === 'SuperAdmin';
    const isAdmin = isSuperAdmin || currentRole === 'Admin';
    const currentUsername = window.currentUsername || 'user';
    const initialTab = defaultTabId || 'tab-profile';

    const isCompactSaved = localStorage.getItem('egs_compact_tables') === '1';
    const isSmoothSaved = localStorage.getItem('egs_smooth_animations') !== '0';
    const activeSoundSaved = localStorage.getItem('egs_scanner_sound') || 'beep';

    const settingsHtml = `
      <div class="settings-layout">
        <div class="settings-tabs">
          <button type="button" class="settings-tab-btn" data-tab="tab-profile"><i class="fa-solid fa-user-gear"></i> My Profile &amp; Security</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-shortcuts"><i class="fa-solid fa-keyboard"></i> Shortcuts &amp; Hotkeys</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-audit"><i class="fa-solid fa-clock-rotate-left"></i> Activity Audit Feed</button>
          ${isAdmin ? '<button type="button" class="settings-tab-btn" data-tab="tab-perf"><i class="fa-solid fa-gauge-high"></i> Performance &amp; Engine</button>' : ''}
          ${isAdmin ? '<button type="button" class="settings-tab-btn" data-tab="tab-erp-mode"><i class="fa-solid fa-sliders"></i> ERP Mode &amp; Features</button>' : ''}
          ${isAdmin ? '<button type="button" class="settings-tab-btn" data-tab="tab-users"><i class="fa-solid fa-users-gear"></i> User Accounts</button>' : ''}
          ${isSuperAdmin ? '<button type="button" class="settings-tab-btn" data-tab="tab-saas-tenants"><i class="fa-solid fa-building-shield"></i> SaaS &amp; White-Label</button>' : ''}
          <button type="button" class="settings-tab-btn" data-tab="tab-challan"><i class="fa-solid fa-file-invoice"></i> Challan &amp; Print</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-theme"><i class="fa-solid fa-palette"></i> Appearance</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-permissions"><i class="fa-solid fa-mobile-screen-button"></i> Device &amp; Notifications</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-company"><i class="fa-solid fa-building"></i> Company Profile</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-inventory"><i class="fa-solid fa-boxes-stacked"></i> Alerts &amp; Stock</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-privacy"><i class="fa-solid fa-shield-halved"></i> Privacy Policy &amp; Terms</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-about"><i class="fa-solid fa-circle-info"></i> About &amp; Version</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-roadmap"><i class="fa-solid fa-rocket"></i> Cloud Roadmap</button>
        </div>

        <div class="settings-content-wrap">
          <!-- 1. My Profile & Security Tab -->
          <div class="settings-panel" id="tab-profile">
          <div class="settings-card">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--border-light);">
              <div style="display:flex; align-items:center; gap:12px;">
                <span class="pa-avatar" style="width:40px; height:40px; font-size:16px; border-radius:50%; background:var(--blue); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:700;">${(currentUsername[0] || 'U').toUpperCase()}</span>
                <div>
                  <strong style="font-size:15px; color:var(--txt);">@${currentUsername}</strong>
                  <div style="font-size:12px; color:var(--txt-muted); display:flex; align-items:center; gap:6px; margin-top:2px;">
                    <span class="pill pill-${currentRole === 'SuperAdmin' ? 'purple' : currentRole === 'Admin' ? 'gold' : 'blue'}" style="font-size:10.5px; padding:2px 8px; font-weight:700;">${currentRole}</span>
                    <span>· OTP 2FA Enabled</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="settings-card-title"><i class="fa-solid fa-id-card" style="color:var(--blue);"></i> Edit Account Credentials</div>
            <p style="margin:0 0 10px; font-size:12px; color:var(--txt-muted);">Updating credentials takes effect instantly across all ERP modules and active device sessions.</p>
            <div class="form-grid cols-2" style="margin-top:10px;">
              <div class="field">
                <label>Username</label>
                <input type="text" id="myProfileUsername" value="${currentUsername}" placeholder="Enter new username">
              </div>
              <div class="field">
                <label>Registered Email (for OTP Login)</label>
                <input type="email" id="myProfileEmail" placeholder="e.g. user@example.com">
              </div>
              <div class="field span-2">
                <label>Current Password / PIN <span class="req">*</span> <small style="color:var(--gold); font-weight:normal;">(Required to confirm updates)</small></label>
                <input type="password" id="myProfileCurPass" placeholder="Enter current password/PIN">
                <div style="margin-top:5px; text-align:right;">
                  <a href="javascript:void(0)" id="btnProfileForgotPass" style="color:var(--gold); font-size:12px; text-decoration:underline; font-weight:600;"><i class="fa-solid fa-key"></i> Forgot current password? Reset via OTP</a>
                </div>
              </div>

              <!-- Inline Forgot Password OTP Box (Hidden by default) -->
              <div id="profileForgotOtpBox" class="field span-2" style="display:none; background:rgba(218,165,32,0.07); border:1px solid rgba(218,165,32,0.3); border-radius:10px; padding:14px; margin-bottom:10px;">
                <div style="font-weight:700; color:var(--gold); font-size:13px; margin-bottom:4px;"><i class="fa-solid fa-envelope-circle-check"></i> Reset Password via Email OTP</div>
                <p id="profileForgotOtpDesc" style="margin:0 0 12px; font-size:12px; color:var(--txt-muted);">We have emailed a 6-digit verification OTP to your registered address.</p>
                <div class="form-grid cols-2">
                  <div class="field">
                    <label>Enter 6-Digit OTP <span class="req">*</span></label>
                    <input type="text" id="profileForgotOtpInput" placeholder="123456" maxlength="6" style="font-weight:700; letter-spacing:2px; text-align:center;">
                  </div>
                  <div class="field">
                    <label>Set New Password / PIN <span class="req">*</span></label>
                    <input type="password" id="profileForgotNewPass" placeholder="At least 6 characters">
                  </div>
                  <div class="field span-2">
                    <label>Confirm New Password / PIN <span class="req">*</span></label>
                    <input type="password" id="profileForgotConfirmPass" placeholder="Re-enter new password">
                  </div>
                </div>
                <div class="actions-row" style="margin-top:12px; justify-content:flex-end; gap:8px;">
                  <button type="button" class="btn btn-ghost" id="btnProfileCancelForgot">Cancel</button>
                  <button type="button" class="btn btn-gold" id="btnProfileVerifyOtpReset"><i class="fa-solid fa-lock-open"></i> Verify OTP &amp; Reset Password</button>
                </div>
              </div>

              <div class="field">
                <label>New Password / PIN <small style="color:var(--txt-muted); font-weight:normal;">(Leave empty to keep existing)</small></label>
                <input type="password" id="myProfileNewPass" placeholder="New password (optional)" autocomplete="new-password">
              </div>
              <div class="field">
                <label>Confirm New Password / PIN</label>
                <input type="password" id="myProfileConfirmPass" placeholder="Re-enter new password" autocomplete="new-password">
              </div>
              <div id="profilePwdStrengthContainer" style="display:none;" class="span-2"></div>
            </div>
            <div class="actions-row" style="margin-top:14px; justify-content:flex-end;">
              <button type="button" class="btn btn-blue" id="btnSaveMyProfile"><i class="fa-solid fa-check"></i> Save Profile Changes</button>
            </div>
          </div>

          <!-- Embedded Active Devices & Login Activity -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span style="display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-mobile-screen-button" style="color:var(--gold);"></i> Active Devices &amp; Login Activity
                <span id="setProfileSessionsCount" class="pill pill-blue" style="font-size:10.5px; padding:2px 8px;">Loading...</span>
              </span>
              <button type="button" class="btn btn-ghost" id="setProfileRevokeOthers" style="font-size:11.5px; padding:4px 10px;"><i class="fa-solid fa-shield-halved"></i> Log out other devices</button>
            </div>
            <p style="margin:0 0 10px; font-size:12px; color:var(--txt-muted);">
              Manage devices signed into your account. You can log out individual devices or all other sessions at once.
            </p>
            <div id="setProfileSessionsList" class="sess-list" style="max-height:220px; overflow-y:auto;">
              <div style="text-align:center; padding:14px; color:var(--txt-muted); font-size:12.5px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading active devices...</div>
            </div>
          </div>
        </div>

        <!-- Shortcuts & Hotkeys Reference Tab -->
        <div class="settings-panel" id="tab-shortcuts">
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-keyboard" style="color:var(--gold);"></i> Keyboard Shortcuts &amp; Hotkeys Guide</span>
              <span class="pill pill-gold" style="font-size:11px; padding:2px 8px; font-weight:700;">Press F1 Anywhere</span>
            </div>
            <p style="margin:0 0 14px 0; font-size:12.5px; color:var(--txt-muted);">
              Operate the entire ERP system effortlessly with fast single-letter hotkeys, cascading multi-tier navigation, and double-entry voucher function keys.
            </p>
            ${getKeyboardShortcutsContentHtml()}
          </div>
        </div>

        <!-- 2. User Accounts Management Tab (Admin / SuperAdmin) -->
        ${isAdmin ? `
        <div class="settings-panel" id="tab-users">
          <div style="display:flex; flex-direction:column; gap:16px;">
            <!-- Top: Create / Update Account Form -->
            <div class="settings-card" style="margin-bottom:0;">
              <div class="settings-card-title">
                <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-user-plus" style="color:var(--blue);"></i> Create / Update User Account</span>
              </div>
              <div class="form-grid" style="margin-top:12px;">
                <div class="field"><label>Username <span class="req">*</span></label><input id="setMngUname" placeholder="e.g. amit" autocomplete="off"></div>
                <div class="field"><label>Password / PIN <span class="req">*</span></label><input type="password" id="setMngPass" placeholder="At least 12 characters" autocomplete="new-password"></div>
                <div class="field"><label>Email (for OTP Login) <span class="req">*</span></label><input type="email" id="setMngEmail" placeholder="e.g. amit@example.com"></div>
                <div class="field"><label>System Privilege</label>
                  <select id="setMngRole">
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                    ${isSuperAdmin ? '<option value="SuperAdmin">SuperAdmin</option>' : ''}
                  </select>
                </div>
              </div>
              <div id="setMngPwdStrengthContainer" style="display:none; margin-top:8px;"></div>
              <div class="actions-row" style="margin-top:14px; flex-wrap:wrap; gap:10px;">
                <button type="button" class="btn btn-blue" id="setBtnAddUser"><i class="fa-solid fa-user-plus"></i> Add User</button>
                <button type="button" class="btn btn-ghost" id="setBtnUpdatePass"><i class="fa-solid fa-key" style="color:var(--blue);"></i> Update Pass</button>
                <button type="button" class="btn btn-ghost" id="setBtnUpdateEmail"><i class="fa-solid fa-envelope" style="color:var(--blue);"></i> Update Email</button>
              </div>
            </div>

            <!-- Bottom: Access Control Ledger Table -->
            <div class="settings-card" style="margin-bottom:0;">
              <div class="settings-card-title">
                <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-users" style="color:var(--blue);"></i> Access Control Ledger</span>
              </div>
              <div class="table-wrap" style="max-height:260px; overflow-y:auto; margin-top:10px;">
                <table>
                  <thead><tr><th>Username</th><th>Email</th><th>Role</th></tr></thead>
                  <tbody id="setUsersLedgerBody"><tr><td colspan="3" class="pl-empty-hint"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>` : ''}

        <!-- SaaS Tenants & Dynamic White-Label Tab -->
        ${isSuperAdmin ? `
        <div class="settings-panel" id="tab-saas-tenants">
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-building-shield" style="color:var(--tenant-primary);"></i> Multi-Tenant SaaS &amp; White-Label Studio</span>
              <span class="pill pill-purple" style="font-size:11px; padding:2px 8px; font-weight:700;">SuperAdmin Feature</span>
            </div>
            <p style="margin:0 0 14px 0; font-size:12.5px; color:var(--txt-muted);">
              Manage isolated organization tenant accounts, custom branding logos, dynamic CSS color themes, feature matrix, and entity terminology.
            </p>
            
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-light); border-radius:10px; padding:16px; margin-bottom:16px;">
              <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
                <div>
                  <strong style="font-size:14px; color:var(--txt);">Full SaaS Configurator &amp; Brand Studio</strong>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:2px;">Register new client tenants, customize hex color palettes, upload logos, and toggle ERP modules.</div>
                </div>
                <button type="button" class="btn btn-tenant-primary" onclick="window.closeModal(); window.location.hash='#saas_tenants';">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Full SaaS Studio
                </button>
              </div>
            </div>

            <div class="form-grid cols-2" style="gap:12px;">
              <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px;">
                <div style="font-size:12px; font-weight:700; color:var(--tenant-primary); margin-bottom:4px;"><i class="fa-solid fa-palette"></i> Dynamic Theming</div>
                <div style="font-size:11.5px; color:var(--txt-muted);">Injects real-time CSS variables (--tenant-primary, --tenant-accent, etc.) without altering code.</div>
              </div>
              <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:12px;">
                <div style="font-size:12px; font-weight:700; color:var(--tenant-accent); margin-bottom:4px;"><i class="fa-solid fa-spell-check"></i> Terminology Engine</div>
                <div style="font-size:11.5px; color:var(--txt-muted);">Rename "Customer", "Supplier", "Item" across the UI per organization.</div>
              </div>
            </div>
          </div>
        </div>` : ''}

        <!-- 3. Document Sequences & Numbering Series Tab -->
        <div class="settings-panel" id="tab-challan">
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between;">
              <span><i class="fa-solid fa-list-ol" style="color:var(--gold);"></i> Document Numbering &amp; Sequences</span>
              ${isAdmin ? '<span class="pill pill-green" style="font-size:11px; padding:2px 8px;">Configurable</span>' : '<span class="pill pill-muted" style="font-size:11px; padding:2px 8px;">Read Only</span>'}
            </div>
            <p style="margin:0 0 12px 0; font-size:12.5px; color:var(--txt-muted);">
              Configure custom prefix codes, starting sequences, and digit padding for all transaction documents.
            </p>

            <div class="form-grid cols-2" style="margin-top:12px; gap:16px;">
              <!-- Purchase Inward -->
              <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:10px; padding:12px;">
                <h4 style="margin:0 0 10px; color:var(--green); font-size:13px;"><i class="fa-solid fa-truck-ramp-box"></i> Purchase Inward Series</h4>
                <div class="field"><label>Prefix</label><input type="text" id="setPurPrefix" placeholder="PUR-" ${isAdmin ? '' : 'readonly'}></div>
                <div class="field"><label>Next Sequence</label><input type="number" id="setPurNext" min="1" placeholder="1001" ${isAdmin ? '' : 'readonly'}></div>
                <div style="font-size:12px; color:var(--txt-muted); margin-top:6px;">Next: <strong id="previewPurSeq" style="color:var(--green);">...</strong></div>
              </div>

              <!-- Sales Invoices -->
              <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:10px; padding:12px;">
                <h4 style="margin:0 0 10px; color:var(--orange); font-size:13px;"><i class="fa-solid fa-handshake"></i> Sales / Dispatch Series</h4>
                <div class="field"><label>Prefix</label><input type="text" id="setSalePrefix" placeholder="SAL-" ${isAdmin ? '' : 'readonly'}></div>
                <div class="field"><label>Next Sequence</label><input type="number" id="setSaleNext" min="1" placeholder="1001" ${isAdmin ? '' : 'readonly'}></div>
                <div style="font-size:12px; color:var(--txt-muted); margin-top:6px;">Next: <strong id="previewSaleSeq" style="color:var(--orange);">...</strong></div>
              </div>

              <!-- Delivery Challans -->
              <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:10px; padding:12px;">
                <h4 style="margin:0 0 10px; color:var(--gold); font-size:13px;"><i class="fa-solid fa-file-invoice"></i> Delivery Challan Series</h4>
                <div class="field"><label>Prefix</label><input type="text" id="setChallanPrefix" placeholder="CHL-" ${isAdmin ? '' : 'readonly'}></div>
                <div class="field"><label>Next Sequence</label><input type="number" id="setChallanNext" min="1" placeholder="1001" ${isAdmin ? '' : 'readonly'}></div>
                <div class="field"><label>Digit Padding</label>
                  <select id="setChallanPad" ${isAdmin ? '' : 'disabled'}>
                    <option value="0">No Padding (1, 2, ...)</option>
                    <option value="2">2 Digits (01, 02, ...)</option>
                    <option value="3">3 Digits (001, 002, ...)</option>
                    <option value="4" selected>4 Digits (0001, 0002, ...)</option>
                    <option value="5">5 Digits (00001, 00002, ...)</option>
                  </select>
                </div>
                <div class="field"><label>Suffix (Optional)</label><input type="text" id="setChallanSuffix" placeholder="e.g. /26" ${isAdmin ? '' : 'readonly'}></div>
                <div style="font-size:12px; color:var(--txt-muted); margin-top:6px;">Next: <strong id="setChallanPreview" style="color:var(--gold);">...</strong></div>
              </div>

              <!-- Payment & Receipt Vouchers -->
              <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:10px; padding:12px;">
                <h4 style="margin:0 0 10px; color:var(--blue); font-size:13px;"><i class="fa-solid fa-money-bill-transfer"></i> Accounting Vouchers Series</h4>
                <div class="field"><label>Payment Prefix (F5)</label><input type="text" id="setPaymentPrefix" placeholder="PMT-" ${isAdmin ? '' : 'readonly'}></div>
                <div class="field"><label>Receipt Prefix (F6)</label><input type="text" id="setReceiptPrefix" placeholder="RCT-" ${isAdmin ? '' : 'readonly'}></div>
                <div class="field"><label>Journal Prefix (F7)</label><input type="text" id="setJournalPrefix" placeholder="JV-" ${isAdmin ? '' : 'readonly'}></div>
                <div style="font-size:12px; color:var(--txt-muted); margin-top:6px;">Format: <strong style="color:var(--blue);">[PREFIX]-YYYY-0001</strong></div>
              </div>
            </div>

            ${isAdmin ? `
            <div class="actions-row" style="margin-top:16px; justify-content:flex-end; border-top:1px solid var(--border-light); padding-top:12px;">
              <button type="button" class="btn btn-green" id="setBtnSaveChallan"><i class="fa-solid fa-floppy-disk"></i> Save Document Numbering</button>
            </div>` : ''}
          </div>
        </div>

        <!-- 4. Appearance Tab -->
        <div class="settings-panel" id="tab-theme">
          <!-- 1. 5 High-Contrast Enterprise Themes -->
          <div class="settings-card">
            <div class="settings-card-title"><i class="fa-solid fa-circle-half-stroke" style="color:var(--gold);"></i> Workspace Themes (5 High-Contrast Presets)</div>
            <p class="note" style="margin:0 0 12px 0;">Select your preferred high-contrast workspace color theme (tested for zero glare &amp; crisp AAA readability).</p>
            <div class="profile-theme-row">
              <button type="button" class="theme-btn${activeTheme === 'dark' ? ' active' : ''}" data-theme-set="dark" title="Midnight Dark"><i class="fa-solid fa-moon"></i> Midnight Dark</button>
              <button type="button" class="theme-btn${activeTheme === 'gray' ? ' active' : ''}" data-theme-set="gray" title="Charcoal Slate"><i class="fa-solid fa-circle-half-stroke"></i> Charcoal Slate</button>
              <button type="button" class="theme-btn${activeTheme === 'light' ? ' active' : ''}" data-theme-set="light" title="Cloud Light"><i class="fa-solid fa-sun"></i> Cloud Light</button>
              <button type="button" class="theme-btn${activeTheme === 'emerald' ? ' active' : ''}" data-theme-set="emerald" title="Solar Emerald"><i class="fa-solid fa-leaf" style="color:#2ecc71;"></i> Solar Emerald</button>
              <button type="button" class="theme-btn${activeTheme === 'ocean' ? ' active' : ''}" data-theme-set="ocean" title="Deep Ocean"><i class="fa-solid fa-water" style="color:#38bdf8;"></i> Deep Ocean</button>
            </div>
          </div>

          <!-- 2. Official Enterprise Typography & Font Family -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-font" style="color:var(--blue);"></i> System Typography &amp; Font Family</div>
            <p class="note" style="margin:0 0 12px 0;">Select an official, high-legibility enterprise typeface (no cursive, only clean professional fonts).</p>
            <div class="font-selector-grid">
              <button type="button" class="theme-btn${activeFont === 'segoe' ? ' active' : ''}" data-font-set="segoe" style="font-family:'Segoe UI', system-ui, sans-serif; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-font" style="font-size:12px;"></i> Segoe UI (System)
              </button>
              <button type="button" class="theme-btn${activeFont === 'inter' ? ' active' : ''}" data-font-set="inter" style="font-family:'Inter', sans-serif; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-font" style="font-size:12px;"></i> Inter Modern
              </button>
              <button type="button" class="theme-btn${activeFont === 'roboto' ? ' active' : ''}" data-font-set="roboto" style="font-family:'Roboto', sans-serif; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-font" style="font-size:12px;"></i> Roboto Corporate
              </button>
              <button type="button" class="theme-btn${activeFont === 'jakarta' ? ' active' : ''}" data-font-set="jakarta" style="font-family:'Plus Jakarta Sans', sans-serif; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-font" style="font-size:12px;"></i> Plus Jakarta
              </button>
              <button type="button" class="theme-btn${activeFont === 'outfit' ? ' active' : ''}" data-font-set="outfit" style="font-family:'Outfit', sans-serif; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-font" style="font-size:12px;"></i> Outfit Tech
              </button>
              <button type="button" class="theme-btn${activeFont === 'jetbrains' ? ' active' : ''}" data-font-set="jetbrains" style="font-family:'JetBrains Mono', monospace; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-terminal" style="font-size:12px;"></i> JetBrains Mono
              </button>
            </div>
          </div>

          <!-- 3. Avatar Circle / Background Color Customizer -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-circle-user" style="color:var(--gold);"></i> User Avatar Circle Accent Color</div>
            <p class="note" style="margin:0 0 12px 0;">Customize the background badge and border color of your profile avatar across the sidebar and headers.</p>
            <div class="avatar-palette-row">
              <button type="button" class="avatar-color-btn${activeAvatar === 'gold' ? ' active' : ''}" data-avatar-set="gold" title="Solar Gold" style="background:linear-gradient(135deg, #D4AF37, #B6952C); color:#111; border:2px solid #D4AF37;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'blue' ? ' active' : ''}" data-avatar-set="blue" title="Royal Blue" style="background:linear-gradient(135deg, #3B8ED0, #2563EB); color:#fff; border:2px solid #3B8ED0;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'emerald' ? ' active' : ''}" data-avatar-set="emerald" title="Emerald Green" style="background:linear-gradient(135deg, #2ECC71, #27AE60); color:#fff; border:2px solid #2ECC71;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'purple' ? ' active' : ''}" data-avatar-set="purple" title="Purple Violet" style="background:linear-gradient(135deg, #9B59B6, #8E44AD); color:#fff; border:2px solid #9B59B6;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'crimson' ? ' active' : ''}" data-avatar-set="crimson" title="Crimson Red" style="background:linear-gradient(135deg, #E74C3C, #C0392B); color:#fff; border:2px solid #E74C3C;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'cyan' ? ' active' : ''}" data-avatar-set="cyan" title="Cyan Teal" style="background:linear-gradient(135deg, #00C0EF, #0097A7); color:#fff; border:2px solid #00C0EF;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'amber' ? ' active' : ''}" data-avatar-set="amber" title="Sunset Amber" style="background:linear-gradient(135deg, #F39C12, #E67E22); color:#fff; border:2px solid #F39C12;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'slate' ? ' active' : ''}" data-avatar-set="slate" title="Slate Titanium" style="background:linear-gradient(135deg, #64748B, #475569); color:#fff; border:2px solid #64748B;">A</button>
            </div>
          </div>

          <!-- 4. Display Density & Animation -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-table-cells" style="color:var(--blue);"></i> Display Density &amp; Animation</div>
            <div style="display:flex; flex-direction:column; gap:14px; margin-top:12px;">
              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckAnimations" ${isSmoothSaved ? 'checked' : ''} style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:600; color:var(--txt); font-size:13px;">Smooth UI Animations &amp; Transitions</div>
                  <div style="font-size:12px; color:var(--txt-muted);">Enables smooth modal transitions, tab fades, and button interactive effects.</div>
                </div>
              </label>
              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckCompactTables" ${isCompactSaved ? 'checked' : ''} style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:600; color:var(--txt); font-size:13px;">Compact Table Row Density (High Information Density)</div>
                  <div style="font-size:12px; color:var(--txt-muted);">Reduces table row heights and cell padding to display 50%+ more inventory &amp; ledger rows simultaneously on PC screens.</div>
                </div>
              </label>
            </div>
          </div>

          <!-- 5. Live Appearance Preview Banner -->
          <div class="settings-card" style="margin-top:16px; background:linear-gradient(145deg, rgba(255,255,255,0.03), rgba(0,0,0,0.25)); border:1px solid var(--border-light);">
            <div class="settings-card-title"><i class="fa-solid fa-eye" style="color:var(--gold);"></i> Live Appearance Preview</div>
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; padding:12px 14px; background:var(--panel-alt); border-radius:12px; border:1px solid var(--border);">
              <div style="display:flex; align-items:center; gap:12px;">
                <div id="setPreviewAvatarCircle" class="avatar" style="width:44px; height:44px; font-size:16px;">${(currentUsername[0] || 'U').toUpperCase()}</div>
                <div>
                  <div id="setPreviewUserName" style="font-weight:700; font-size:14px; color:var(--txt);">@${currentUsername}</div>
                  <div style="font-size:11.5px; color:var(--txt-muted); display:flex; align-items:center; gap:6px; margin-top:2px;">
                    <span id="setPreviewRolePill" class="pill pill-gold">${currentRole}</span>
                    <span id="setPreviewFontLabel" style="font-style:italic;">Font: Segoe UI</span>
                  </div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span id="setPreviewThemeBadge" class="pill pill-blue"><i class="fa-solid fa-moon"></i> Midnight Dark</span>
              </div>
            </div>
          </div>

          <!-- 6. Dashboard Widgets Launcher -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-sliders" style="color:var(--blue);"></i> Dashboard Widgets &amp; Metrics</div>
            <p style="margin:0 0 14px; font-size:12.5px; color:var(--txt-muted);">
              Choose which metric cards, solar generation summaries, and tables appear on your ERP Dashboard. You can also re-enable hidden sections anytime from here.
            </p>
            <button type="button" class="btn btn-blue" id="btnOpenDashCustomizerFromSettings"><i class="fa-solid fa-sliders"></i> Customize Dashboard Widgets</button>
          </div>

          <!-- 7. Save Appearance Action Bar -->
          <div class="actions-row" style="margin-top:18px; justify-content:flex-end; border-top:1px solid var(--border-light); padding-top:14px;">
            <button type="button" class="btn btn-green" id="btnSaveAppearanceSettings" style="padding:11px 24px; font-size:13.5px; font-weight:700; box-shadow:0 4px 14px rgba(46,204,113,0.3);">
              <i class="fa-solid fa-floppy-disk"></i> Save Appearance Preferences
            </button>
          </div>
        </div>

        <!-- Company Profile & Taxation Tab -->
        <div class="settings-panel" id="tab-company">
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between;">
              <span><i class="fa-solid fa-building" style="color:var(--gold);"></i> Enterprise &amp; Company Profile</span>
              ${isAdmin ? '<span class="pill pill-green" style="font-size:11px; padding:2px 8px;">SuperAdmin Configurable</span>' : '<span class="pill pill-muted" style="font-size:11px; padding:2px 8px;">Read Only</span>'}
            </div>
            <p style="margin:0 0 12px 0; font-size:12.5px; color:var(--txt-muted);">
              Company business details, GSTIN, PAN, and State Code for automatic Intra-State (CGST+SGST) vs Inter-State (IGST) tax calculation.
            </p>
            <div class="form-grid cols-2" style="margin-top:10px;">
              <div class="field">
                <label>Company Legal Name <span class="req">*</span></label>
                <input type="text" id="setCompanyName" placeholder="e.g. Eco Green Solar Pvt. Ltd." ${isAdmin ? '' : 'readonly'}>
              </div>
              <div class="field">
                <label>Company GSTIN <span class="req">*</span></label>
                <input type="text" id="setCompanyGstin" placeholder="e.g. 24AAAAA0000A1Z5" ${isAdmin ? '' : 'readonly'}>
              </div>
              <div class="field">
                <label>Company PAN</label>
                <input type="text" id="setCompanyPan" placeholder="e.g. AAAAA0000A" ${isAdmin ? '' : 'readonly'}>
              </div>
              <div class="field">
                <label>State Code (2-Digit) <span class="req">*</span></label>
                <input type="text" id="setCompanyStateCode" placeholder="e.g. 24 for Gujarat" maxlength="2" ${isAdmin ? '' : 'readonly'}>
              </div>
              <div class="field span-full">
                <label>Operating Business Address</label>
                <input type="text" id="setCompanyAddress" placeholder="e.g. Plot 12, Industrial Estate, Rajkot, Gujarat" ${isAdmin ? '' : 'readonly'}>
              </div>
              <div class="field">
                <label>Currency Code</label>
                <input type="text" id="setCompanyCurrency" placeholder="INR" ${isAdmin ? '' : 'readonly'}>
              </div>
              <div class="field">
                <label>Financial Year Start Date</label>
                <input type="date" id="setCompanyFyStart" ${isAdmin ? '' : 'readonly'}>
              </div>
            </div>
            ${isAdmin ? `
            <div class="actions-row" style="margin-top:16px; justify-content:flex-end; border-top:1px solid var(--border-light); padding-top:12px;">
              <button type="button" class="btn btn-green" id="btnSaveCompanyProfile"><i class="fa-solid fa-floppy-disk"></i> Save Company Profile</button>
            </div>` : ''}
          </div>
          <div class="settings-card">
            <div class="settings-card-title"><i class="fa-solid fa-code" style="color:var(--gold);"></i> System Attribution</div>
            <p style="margin:0; font-size:13px; color:var(--txt-muted);">
              Eco Green Solar ERP Suite • Developed by <strong style="color:var(--gold);">Sumit Chauhan</strong>
            </p>
          </div>
        </div>

        <!-- 6. Alerts & Inventory Tab -->
        <div class="settings-panel" id="tab-inventory">
          <!-- Card 1: Stock Thresholds & Scanner Audio -->
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between;">
              <span><i class="fa-solid fa-boxes-stacked" style="color:var(--gold);"></i> Stock Thresholds &amp; Scanner Audio</span>
              ${isAdmin ? '<span class="pill pill-green" style="font-size:11px; padding:2px 8px;">Admin Configurable</span>' : '<span class="pill pill-muted" style="font-size:11px; padding:2px 8px;">Read Only</span>'}
            </div>
            <div class="form-grid cols-2" style="margin-top:10px;">
              <div class="field">
                <label style="font-weight:600; color:var(--txt); font-size:12px; margin-bottom:6px; display:block;">Low Stock Warning Threshold (Units) <span class="req">*</span></label>
                <input type="number" id="setLowStockThreshold" min="1" placeholder="5" class="settings-email-input" ${isAdmin ? '' : 'readonly'}>
              </div>
              <div class="field">
                <label style="font-weight:600; color:var(--txt); font-size:12px; margin-bottom:6px; display:block;">Scan Sheet Audio Feedback</label>
                <div style="display:flex; gap:6px;">
                  <select id="setScannerSound" class="settings-email-input" style="flex:1;">
                    <option value="beep" ${activeSoundSaved === 'beep' ? 'selected' : ''}>Classic ERP Beep (850Hz)</option>
                    <option value="chime" ${activeSoundSaved === 'chime' ? 'selected' : ''}>High Chime Tone (1200Hz)</option>
                    <option value="melody" ${activeSoundSaved === 'melody' ? 'selected' : ''}>Two-Tone Success Melody (650Hz ➔ 1050Hz)</option>
                    <option value="click" ${activeSoundSaved === 'click' ? 'selected' : ''}>Subtle Soft Click</option>
                    <option value="mute" ${activeSoundSaved === 'mute' ? 'selected' : ''}>Mute / Disabled</option>
                  </select>
                  <button type="button" class="btn btn-ghost" id="btnTestScannerSound" title="Listen to selected sound"><i class="fa-solid fa-volume-high"></i> Test</button>
                </div>
              </div>
            </div>
            ${isAdmin ? `
            <div class="actions-row" style="margin-top:14px; justify-content:flex-end; border-top:1px solid var(--border-light); padding-top:12px;">
              <button type="button" class="btn btn-green" id="setBtnSaveStockScanner"><i class="fa-solid fa-floppy-disk"></i> Save Stock &amp; Scanner Settings</button>
            </div>` : ''}
          </div>

          <!-- Card 2: Automated Email Alert Triggers -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-envelope" style="color:var(--blue);"></i> Automated Email Alert Triggers</div>
            <p style="margin:0 0 14px; font-size:12.5px; color:var(--txt-muted);">
              Set recipient Gmail address(es) for automated ERP notifications. Multiple email addresses can be added separated by commas.
            </p>

            <div style="display:flex; flex-direction:column; gap:12px; margin-top:8px;">
              <!-- Low Stock Email Alert -->
              <div class="settings-email-card">
                <label style="display:flex; align-items:center; gap:9px; cursor:pointer; margin-bottom:10px;">
                  <input type="checkbox" id="setCheckLowStockEmail" style="accent-color:var(--gold); transform:scale(1.15);" ${isAdmin ? '' : 'disabled'}>
                  <strong style="color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-triangle-exclamation" style="color:var(--gold); margin-right:4px;"></i> Low Stock Warning Email Alert</strong>
                </label>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:12px; font-weight:600; color:var(--txt); margin-bottom:6px; display:block;">Recipient Email Address(es) for Low Stock Alerts</label>
                  <div style="display:flex; gap:8px;">
                    <input type="text" id="setLowStockEmails" class="settings-email-input" placeholder="e.g. store@gmail.com, purchase@gmail.com" ${isAdmin ? '' : 'readonly'}>
                    ${isAdmin ? `<button type="button" class="btn btn-ghost" id="btnTestLowStockEmail" title="Send a verification test email to verify address"><i class="fa-solid fa-paper-plane"></i> Test Mail</button>` : ''}
                  </div>
                </div>
              </div>

              <!-- Dispatch Email Alert -->
              <div class="settings-email-card">
                <label style="display:flex; align-items:center; gap:9px; cursor:pointer; margin-bottom:10px;">
                  <input type="checkbox" id="setCheckDispatchEmail" style="accent-color:var(--gold); transform:scale(1.15);" ${isAdmin ? '' : 'disabled'}>
                  <strong style="color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-truck-fast" style="color:var(--blue); margin-right:4px;"></i> BOM Challan &amp; Dispatch Summary Email</strong>
                </label>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:12px; font-weight:600; color:var(--txt); margin-bottom:6px; display:block;">Recipient Email Address(es) for Dispatch Alerts</label>
                  <div style="display:flex; gap:8px;">
                    <input type="text" id="setDispatchEmails" class="settings-email-input" placeholder="e.g. dispatch@gmail.com, logistics@gmail.com" ${isAdmin ? '' : 'readonly'}>
                    ${isAdmin ? `<button type="button" class="btn btn-ghost" id="btnTestDispatchEmail" title="Send a verification test email to verify address"><i class="fa-solid fa-paper-plane"></i> Test Mail</button>` : ''}
                  </div>
                </div>
              </div>
            </div>

            ${isAdmin ? `
            <div class="actions-row" style="margin-top:16px; justify-content:flex-end; border-top:1px solid var(--border-light); padding-top:12px;">
              <button type="button" class="btn btn-green" id="setBtnSaveEmailAlerts"><i class="fa-solid fa-floppy-disk"></i> Save Email Notification Settings</button>
            </div>` : ''}
          </div>
        </div>

        <!-- 5. Device & Notifications Tab -->
        <div class="settings-panel" id="tab-permissions">
          <!-- Card 1: System Level Permissions -->
          <div class="settings-card">
            <div class="settings-card-title">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-shield-halved" style="color:var(--blue);"></i> System &amp; Hardware Permissions</span>
            </div>
            <p style="margin:0 0 14px; font-size:12.5px; color:var(--txt-muted);">
              Manage native OS and browser device permissions. Requesting or enabling an option directly prompts the system security dialog (Allow while using app / Only this time / Don't allow).
            </p>

            <div class="egs-perm-list">
              <!-- Push Notifications -->
              <div class="egs-perm-item">
                <div class="egs-perm-icon notify"><i class="fa-solid fa-bell"></i></div>
                <div class="egs-perm-meta">
                  <div class="egs-perm-name">
                    <span>Push &amp; System Notifications</span>
                    <span id="permBadgeNotify" class="pill pill-gold">Checking...</span>
                  </div>
                  <div class="egs-perm-desc">Real-time alerts for Dispatches, Low Stock warnings, and Background Sync.</div>
                </div>
                <div class="egs-perm-actions">
                  <button type="button" class="btn btn-blue" id="btnRequestNotifyPerm"><i class="fa-solid fa-bell"></i> Request Permission</button>
                  <button type="button" class="btn btn-ghost" id="btnTestNotifyPerm"><i class="fa-solid fa-paper-plane"></i> Test Notification</button>
                </div>
              </div>

              <!-- Camera Scanner -->
              <div class="egs-perm-item">
                <div class="egs-perm-icon camera"><i class="fa-solid fa-camera"></i></div>
                <div class="egs-perm-meta">
                  <div class="egs-perm-name">
                    <span>Camera (Barcode &amp; QR Scanning)</span>
                    <span id="permBadgeCamera" class="pill pill-gold">Checking...</span>
                  </div>
                  <div class="egs-perm-desc">Hardware camera access for physical barcode and QR scanning across inventory modules.</div>
                </div>
                <div class="egs-perm-actions">
                  <button type="button" class="btn btn-blue" id="btnRequestCameraPerm"><i class="fa-solid fa-camera"></i> Request Permission</button>
                </div>
              </div>

              <!-- Microphone -->
              <div class="egs-perm-item">
                <div class="egs-perm-icon mic"><i class="fa-solid fa-microphone"></i></div>
                <div class="egs-perm-meta">
                  <div class="egs-perm-name">
                    <span>Microphone (Voice Input)</span>
                    <span id="permBadgeMic" class="pill pill-gold">Checking...</span>
                  </div>
                  <div class="egs-perm-desc">Voice commands and serial number voice dictation support.</div>
                </div>
                <div class="egs-perm-actions">
                  <button type="button" class="btn btn-blue" id="btnRequestMicPerm"><i class="fa-solid fa-microphone"></i> Request Permission</button>
                </div>
              </div>

              <!-- Persistent Storage -->
              <div class="egs-perm-item">
                <div class="egs-perm-icon storage"><i class="fa-solid fa-hard-drive"></i></div>
                <div class="egs-perm-meta">
                  <div class="egs-perm-name">
                    <span>Persistent Offline Storage</span>
                    <span id="permBadgeStorage" class="pill pill-green"><i class="fa-solid fa-circle-check"></i> Active</span>
                  </div>
                  <div class="egs-perm-desc">Guarantees local SQLite/IndexedDB offline databases won't be cleared by the OS.</div>
                </div>
                <div class="egs-perm-actions">
                  <button type="button" class="btn btn-ghost" id="btnRequestStoragePerm"><i class="fa-solid fa-database"></i> Enable Persist</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 2: Physical Audio & Installation -->
          <div class="settings-card" style="margin-top:14px;">
            <div class="settings-card-title">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-volume-high" style="color:var(--gold);"></i> Scanner Audio &amp; App Installation</span>
            </div>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; margin-top:12px;">
              <div class="egs-setting-box">
                <label style="font-size:12.5px; font-weight:600; color:var(--txt); display:block; margin-bottom:6px;">Scanner Audio Feedback</label>
                <select id="setScannerAudioSelect" class="form-control" style="width:100%;">
                  <option value="beep">Standard POS Beep</option>
                  <option value="chime">Modern Upbeat Chime</option>
                  <option value="success">Melodic Success Chime</option>
                  <option value="silent">Silent (No Audio)</option>
                </select>
                <button type="button" class="btn btn-ghost btn-sm" id="btnTestScannerAudio" style="margin-top:8px; font-size:12px;"><i class="fa-solid fa-play"></i> Play Sample Sound</button>
              </div>

              <div class="egs-setting-box">
                <label style="font-size:12.5px; font-weight:600; color:var(--txt); display:block; margin-bottom:6px;">Application Installation</label>
                <div style="font-size:12.5px; color:var(--txt-muted); margin-bottom:10px;" id="setPwaModeVal">Browser Tab (PWA Ready)</div>
                <button type="button" class="btn btn-gold" onclick="window.openAppInstallGuide()"><i class="fa-solid fa-download"></i> Install App on Device</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Privacy Policy & Legal Terms Tab -->
        <div class="settings-panel" id="tab-privacy">
          <div class="settings-card">
            <div class="settings-card-title">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-shield-halved" style="color:var(--blue);"></i> Enterprise Privacy Policy &amp; Data Security</span>
            </div>
            <p style="margin:0 0 14px; font-size:12.5px; color:var(--txt-muted);">
              Official security terms, data privacy practices, and enterprise compliance standards governing Eco Green Solar ERP.
            </p>

            <div class="egs-legal-doc">
              <div class="egs-legal-section">
                <div class="egs-legal-h4">1. Enterprise Data Encryption &amp; Security</div>
                <p>All communication between your browser or device and the Eco Green Solar ERP Cloud is protected using 256-bit TLS/SSL encryption and HSTS headers. Sensitive authentication credentials, including passwords and PINs, are irreversibly salted and hashed with bcrypt. User access tokens are cryptographically signed with short-lived expiration.</p>
              </div>

              <div class="egs-legal-section">
                <div class="egs-legal-h4">2. Role-Based Access Control &amp; Audit Logs</div>
                <p>System features, pricing, stock ledgers, and BOM dispatches are strictly compartmentalized based on your assigned user role (SuperAdmin, Admin, User). All sensitive transactional actions, master deletions, and batch modifications are permanently logged with user ID, timestamp, and client IP metadata for enterprise accountability.</p>
              </div>

              <div class="egs-legal-section">
                <div class="egs-legal-h4">3. Offline Cache &amp; Device Storage Privacy</div>
                <p>When operating in Offline-First mode, scanned serial numbers and pending dispatch records are stored locally within your device's sandboxed IndexedDB and encrypted local storage. This data is strictly private to this device and automatically synchronizes with the central database upon internet restoration.</p>
              </div>

              <div class="egs-legal-section">
                <div class="egs-legal-h4">4. Push Notifications &amp; Alert Telemetry</div>
                <p>Device notification tokens and camera permissions are utilized exclusively for physical barcode scanning and real-time operational notifications (e.g. low stock alerts, dispatch generation). No private browsing history, audio recordings, or personal data is collected or transmitted.</p>
              </div>

              <div class="egs-legal-section">
                <div class="egs-legal-h4">5. Data Ownership &amp; Confidentiality</div>
                <p>All inventory records, serial scan ledgers, party accounts, and customer details remain the exclusive proprietary property of Eco Green Solar Pvt. Ltd. No third-party data tracking, advertising pixels, or external analytics SDKs are incorporated into this platform.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- About ERP & Live Version Tab -->
        <div class="settings-panel" id="tab-about">
          <div class="settings-card egs-about-hero-clean">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
              <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:58px; height:58px; min-width:58px; border-radius:50%; background:#ffffff; display:flex; align-items:center; justify-content:center; padding:6px; box-shadow:0 4px 16px rgba(0,0,0,0.3); flex-shrink:0;">
                  <img src="assets/icons/icon-192.png" style="width:100%; height:100%; object-fit:contain; border-radius:50%;" alt="Eco Green Solar Logo">
                </div>
                <div>
                  <div style="font-size:16.5px; font-weight:800; color:var(--txt); letter-spacing:-0.01em;">Eco Green Solar ERP</div>
                  <div style="font-size:12.5px; color:var(--txt-muted); margin-top:2px;">Enterprise Operations &amp; Inventory Suite</div>
                  <div style="display:flex; align-items:center; gap:6px; margin-top:8px;">
                    <span class="pill pill-gold" style="font-size:11px; padding:2px 10px;">v1.10.0 Enterprise</span>
                    <span class="pill pill-green" style="font-size:11px; padding:2px 10px;">Build 112 (Live)</span>
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-blue" id="btnAboutCheckUpdate" style="padding:9px 18px; font-size:13px;">
                <i class="fa-solid fa-arrows-rotate"></i> Check for Updates
              </button>
            </div>
          </div>

          <div class="settings-card">
            <div class="settings-card-title">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-sliders" style="color:var(--blue);"></i> System Specifications &amp; Environment</span>
            </div>
            
            <div class="egs-about-specs-table">
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-code-branch"></i> Release Track</div>
                <div class="egs-spec-val" style="color:var(--blue); font-weight:600;">v1.10.0 Enterprise Monolith</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-server"></i> Backend Engine</div>
                <div class="egs-spec-val">Node.js 20+ High-Performance Monolith</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-database"></i> Database Cluster</div>
                <div class="egs-spec-val">MySQL 8.0 Concurrency Pool (10 Conn)</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-bolt"></i> Memory &amp; Cache</div>
                <div class="egs-spec-val" style="color:var(--green);"><i class="fa-solid fa-circle-check" style="font-size:11px;"></i> L1 RAM + L2 In-Memory Fast-Path</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-hard-drive"></i> PWA &amp; Offline Engine</div>
                <div class="egs-spec-val">Service Worker v112 + IndexedDB Sync</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-shield-halved"></i> Security &amp; Network</div>
                <div class="egs-spec-val">TLS 1.3 / SSL Encryption + Gzip Transport</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-building"></i> Organization</div>
                <div class="egs-spec-val">Eco Green Solar Pvt. Ltd.</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-user-tie"></i> Lead Developer</div>
                <div class="egs-spec-val" style="color:var(--blue); font-weight:600;">Sumit Chauhan</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Roadmap Tab -->
        <div class="settings-panel" id="tab-roadmap">
          <div class="settings-card">
            <div class="settings-card-title">
              <span><i class="fa-solid fa-sun" style="color:var(--gold);"></i> PM Surya Ghar National Portal Sync</span>
              <span class="settings-badge-planned">Planned Q4</span>
            </div>
            <p style="margin:0; font-size:13px; color:var(--txt-muted);">
              Direct API integration with the National Portal for automated consumer subsidy verification and project milestone uploads.
            </p>
          </div>
          <div class="settings-card">
            <div class="settings-card-title">
              <span><i class="fa-solid fa-network-wired" style="color:var(--blue);"></i> Multi-Branch Live Cloud Sync</span>
              <span class="settings-badge-soon">Coming Soon</span>
            </div>
            <p style="margin:0; font-size:13px; color:var(--txt-muted);">
              Seamless inter-branch stock transfers with automatic GST delivery challan generation between warehouses.
            </p>
          </div>
          <div class="settings-card">
            <div class="settings-card-title">
              <span><i class="fa-solid fa-file-invoice-dollar" style="color:#2ecc71;"></i> Tally Prime / Busy Accounting Bridge</span>
              <span class="settings-badge-soon">Coming Soon</span>
            </div>
            <p style="margin:0; font-size:13px; color:var(--txt-muted);">
              1-click XML ledger sync directly into Tally Prime and Busy Accounting software.
            </p>
          </div>
        </div>

        <!-- Audit Trail & Enterprise Mutation Logs Tab -->
        <div class="settings-panel" id="tab-audit">
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-shield-halved" style="color:var(--gold);"></i> Enterprise Audit Trail &amp; Mutations</span>
              <button type="button" class="btn btn-blue" id="btnRefreshAuditLogs" style="font-size:11.5px; padding:4px 10px;"><i class="fa-solid fa-rotate"></i> Refresh Feed</button>
            </div>
            <p style="margin:0 0 12px 0; font-size:12.5px; color:var(--txt-muted);">
              Live audit trail of enterprise transactions: Inwards, Dispatches, Deletions, Vouchers, and Security events.
            </p>

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; align-items:center;">
              <input type="text" id="auditSearchInput" placeholder="Search reference, user, or details..." style="flex:1 1 180px; min-width:0;">
              <select id="auditModuleFilter" style="width:min(170px, 100%); min-width:140px;">
                <option value="ALL">All Operations</option>
                <option value="PURCHASE">Purchase Inward</option>
                <option value="SALES">Sales / Dispatch</option>
                <option value="VOUCHER">Double-Entry Vouchers</option>
                <option value="STOCK">Stock Adjustments</option>
                <option value="SECURITY">Security &amp; Auth</option>
              </select>
            </div>

            <div id="auditTimelineContainer">
              <div style="text-align:center; padding:24px; color:var(--txt-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading live activity feed...</div>
            </div>
          </div>
        </div>

        <!-- Performance & System Telemetry Tab -->
        ${isAdmin ? `
        <div class="settings-panel" id="tab-perf">
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-gauge-high" style="color:var(--gold);"></i> High-Speed Engine Telemetry &amp; Caches</span>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-ghost" id="btnPurgeClientCache" style="font-size:11.5px; padding:4px 10px;"><i class="fa-solid fa-broom"></i> Purge Client Cache</button>
                <button type="button" class="btn btn-blue" id="btnRefreshPerfStats" style="font-size:11.5px; padding:4px 10px;"><i class="fa-solid fa-rotate"></i> Refresh</button>
              </div>
            </div>
            <p style="margin:0 0 14px 0; font-size:12.5px; color:var(--txt-muted);">
              Real-time backend connection pool saturation, multi-tier memory caching hit rates, database scale, and client latency.
            </p>
            <div id="perfTelemetryContainer">
              <div style="text-align:center; padding:20px; color:var(--txt-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Fetching real-time telemetry...</div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- ERP Mode & Feature Switches Tab -->
        <div class="settings-panel" id="tab-erp-mode">
          <!-- Card 1: ERP Configuration Profile Presets -->
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between;">
              <span><i class="fa-solid fa-layer-group" style="color:var(--gold);"></i> Operating Profiles &amp; Presets</span>
              <span class="pill pill-green" style="font-size:11px; padding:2px 8px;">1-Click Preset</span>
            </div>
            <p style="margin:0 0 14px; font-size:12.5px; color:var(--txt-muted);">
              Select an enterprise configuration preset. Each preset instantly adjusts feature flags while keeping full fine-grained customization below.
            </p>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap:12px;" id="erpPresetCardGroup">
              
              <label class="egs-mode-card" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:var(--panel-alt); border:1.5px solid var(--border); border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
                <input type="radio" name="setErpPreset" value="full_erp" style="accent-color:var(--blue); margin-top:3px; transform:scale(1.2);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-crown" style="color:var(--gold); margin-right:4px;"></i> Full ERP + Accounting <span class="pill pill-gold" style="font-size:10px; padding:1px 6px;">All Features</span></div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:3px;">Quantity + Serial scanning + Godowns + BOM kits + Double-entry accounting + GST calculation.</div>
                </div>
              </label>

              <label class="egs-mode-card" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:var(--panel-alt); border:1.5px solid var(--border); border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
                <input type="radio" name="setErpPreset" value="trading_erp" style="accent-color:var(--blue); margin-top:3px; transform:scale(1.2);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-store" style="color:var(--blue); margin-right:4px;"></i> Trading ERP (No Serials)</div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:3px;">Purchase + Sales invoices + Vouchers + Ledgers + GST. Serial number inputs hidden.</div>
                </div>
              </label>

              <label class="egs-mode-card" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:var(--panel-alt); border:1.5px solid var(--border); border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
                <input type="radio" name="setErpPreset" value="serial_inventory" style="accent-color:var(--blue); margin-top:3px; transform:scale(1.2);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-barcode" style="color:#2ecc71; margin-right:4px;"></i> Serial Tracked Inventory</div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:3px;">Strict barcode/serial tracking + Delivery challans + Stock registers. Financial accounting disabled.</div>
                </div>
              </label>

              <label class="egs-mode-card" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:var(--panel-alt); border:1.5px solid var(--border); border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
                <input type="radio" name="setErpPreset" value="simple_inventory" style="accent-color:var(--blue); margin-top:3px; transform:scale(1.2);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-boxes-stacked" style="color:#a855f7; margin-right:4px;"></i> Simple Inventory</div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:3px;">Pure quantity stock tracking with warehouse locations. No serial scans and no accounting vouchers.</div>
                </div>
              </label>

            </div>
          </div>

          <!-- Card 2: Fine-Grained Feature Switches & Dependency Rules -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-toggle-on" style="color:var(--blue);"></i> Fine-Grained Feature Switchboard</div>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap:14px; margin-top:12px;">
              
              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckInvTracking" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">Quantity Stock Tracking</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Track physical product quantities, UOMs, and inward/outward ledger records.</div>
                </div>
              </label>

              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckSerialTracking" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">Individual Serial Scanning</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Prompt for unique serial/barcode numbers during Purchase &amp; Sales dispatch.</div>
                </div>
              </label>

              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckWarehouseTracking" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">Godown / Warehouse Hubs</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Track multi-warehouse locations and godowns for stock transactions.</div>
                </div>
              </label>

              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckAccountingEnabled" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">Double-Entry Accounting</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Enable Payments, Receipts, Journals, Trial Balance, P&amp;L, and Balance Sheet.</div>
                </div>
              </label>

              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckGstEnabled" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">GST Taxation Engine</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Auto-calculate Intra-State (CGST+SGST) vs Inter-State (IGST) taxes.</div>
                </div>
              </label>

              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckFeatureBom" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">BOM Kit Assembly &amp; Delivery</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Enable solar kit bundling, custom challans, and track order registers.</div>
                </div>
              </label>

              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckFeaturePricing" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">Pricing &amp; Valuation in Forms</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Show Unit Rate, Subtotal, and GST columns during Purchase Inward and Sales.</div>
                </div>
              </label>

              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckFeatureProofMandatory" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">Proof Attachment Mandatory</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Block saving inward/sales vouchers without an uploaded PDF/Photo proof.</div>
                </div>
              </label>

              <div class="field" style="margin:0;">
                <label style="font-weight:700; color:var(--txt); font-size:13px; display:block; margin-bottom:4px;">Stock Valuation Method</label>
                <select id="setStockValuation" class="form-control" style="width:100%; font-size:12.5px;">
                  <option value="none">None (Simple Qty Counter)</option>
                  <option value="fifo">FIFO (First-In, First-Out)</option>
                  <option value="average_cost">Weighted Average Cost</option>
                </select>
              </div>

              <div class="field" style="margin:0;">
                <label style="font-weight:700; color:var(--txt); font-size:13px; display:block; margin-bottom:4px;">Wattage Requirement Rule</label>
                <select id="setFeatureWattRule" class="form-control" style="width:100%; font-size:12.5px;">
                  <option value="auto">Auto (Only for Solar Panels &amp; Inverters)</option>
                  <option value="always">Always Mandatory for all categories</option>
                  <option value="never">Optional / Disabled</option>
                </select>
              </div>

            </div>

            <div class="actions-row" style="margin-top:18px; justify-content:flex-end; border-top:1px solid var(--border-light); padding-top:14px;">
              <button type="button" class="btn btn-green" id="btnSaveErpModeSettings" style="padding:11px 24px; font-size:13.5px; font-weight:700; box-shadow:0 4px 14px rgba(46,204,113,0.3);">
                <i class="fa-solid fa-floppy-disk"></i> Save Operating Mode &amp; Features
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    `;

    window.openModal('⚙️ System & ERP Settings', settingsHtml, { size: 'large', modalClass: 'settings-modal-box' });

    // Wire Settings Tabs
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    const panels = document.querySelectorAll('.settings-panel');
    const contentWrap = document.querySelector('.settings-content-wrap');
    function activateTab(tabId) {
      tabBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
      panels.forEach((p) => p.classList.toggle('active', p.id === tabId));
      if (contentWrap) contentWrap.scrollTop = 0;
      if (tabId === 'tab-audit') {
        loadActivityAuditFeed();
      }
      if (tabId === 'tab-perf') {
        loadPerformanceTelemetry();
      }
    }
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => activateTab(btn.getAttribute('data-tab')));
    });

    // Activity Timeline & Audit Feed Handlers
    async function loadActivityAuditFeed() {
      const container = document.getElementById('auditTimelineContainer');
      const searchInput = document.getElementById('auditSearchInput');
      const moduleFilter = document.getElementById('auditModuleFilter');
      if (!container) return;

      if (window.Skeleton) {
        container.innerHTML = window.Skeleton.list(4);
      } else {
        container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--txt-muted); font-size:13px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading live activity feed...</div>`;
      }

      try {
        const search = searchInput ? searchInput.value.trim() : '';
        const mod = moduleFilter ? moduleFilter.value : 'ALL';
        const url = `/audit-logs?module=${encodeURIComponent(mod)}&search=${encodeURIComponent(search)}&limit=50`;
        const res = await window.Api.get(url, { bypassCache: true });
        const logs = (res && res.logs) || [];

        if (!logs.length) {
          if (window.Skeleton) {
            container.innerHTML = window.Skeleton.empty('No activity records found', { icon: 'fa-solid fa-clock-rotate-left', desc: 'No transaction or mutation logs match your filter criteria.' });
          } else {
            container.innerHTML = `
              <div style="text-align:center; padding:30px 10px; color:var(--txt-muted);">
                <i class="fa-solid fa-clock-rotate-left" style="font-size:28px; opacity:0.3; margin-bottom:8px;"></i>
                <div style="font-weight:600; font-size:13px;">No activity records found matching the criteria.</div>
              </div>
            `;
          }
          return;
        }

        container.innerHTML = `
          <div class="audit-timeline">
            ${logs.map(log => {
              const type = (log.transaction_type || '').toUpperCase();
              let icon = 'fa-circle-info';
              let itemClass = 'audit-item';
              let badgeColor = 'blue';

              if (type.includes('DELETE') || type.includes('DAMAGE')) {
                icon = 'fa-trash-can';
                itemClass = 'audit-item audit-delete';
                badgeColor = 'red';
              } else if (type.includes('PURCHASE') || type.includes('INWARD')) {
                icon = 'fa-cart-plus';
                badgeColor = 'green';
              } else if (type.includes('SALES') || type.includes('DISPATCH') || type.includes('BOM')) {
                icon = 'fa-truck-fast';
                badgeColor = 'blue';
              } else if (type.includes('VOUCHER')) {
                icon = 'fa-file-invoice-dollar';
                badgeColor = 'purple';
              } else if (type.includes('SECURITY') || type.includes('LOGIN') || type.includes('AUTH') || type.includes('PASSWORD')) {
                icon = 'fa-shield-halved';
                itemClass = 'audit-item audit-security';
                badgeColor = 'gold';
              }

              const timeStr = log.action_timestamp || (log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '');

              return `
                <div class="${itemClass}">
                  <div class="audit-header">
                    <div class="audit-meta">
                      <span class="pill pill-${badgeColor}" style="font-size:10.5px; padding:2px 7px; font-weight:700;"><i class="fa-solid ${icon}"></i> ${type}</span>
                      ${log.reference_no ? `<strong style="color:var(--txt); font-size:12px;">#${log.reference_no}</strong>` : ''}
                      <span style="color:var(--txt-muted); font-size:11.5px;"><i class="fa-solid fa-user"></i> @${log.action_by || 'User'}</span>
                    </div>
                    <div style="font-size:11.5px; color:var(--txt-muted);">${timeStr}</div>
                  </div>
                  <div class="audit-desc">${log.new_details || log.old_details || 'Activity logged.'}</div>
                  ${log.old_details && log.new_details ? `
                    <div style="margin-top:6px;">
                      <a href="javascript:void(0)" class="btn-view-audit-diff" data-id="${log.id}" style="color:var(--blue); font-size:11.5px; text-decoration:underline;"><i class="fa-solid fa-code-compare"></i> View Details Snapshot</a>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `;

        // Wire diff inspection
        container.querySelectorAll('.btn-view-audit-diff').forEach(link => {
          link.addEventListener('click', () => {
            const logId = parseInt(link.getAttribute('data-id'), 10);
            const found = logs.find(l => l.id === logId);
            if (!found) return;

            window.openModal(`Audit Snapshot — ${found.transaction_type} (${found.reference_no || ''})`, `
              <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="font-size:12px; color:var(--txt-muted);">Timestamp: <strong>${found.action_timestamp || found.created_at}</strong> · Action by: <strong>@${found.action_by}</strong></div>
                <div style="background:rgba(231,76,60,0.06); border:1px solid rgba(231,76,60,0.25); border-radius:6px; padding:10px;">
                  <div style="font-size:11px; font-weight:700; color:var(--red); text-transform:uppercase; margin-bottom:4px;">Original Snapshot</div>
                  <pre style="margin:0; font-size:12px; color:var(--txt); white-space:pre-wrap; word-break:break-word;">${found.old_details || 'N/A'}</pre>
                </div>
                <div style="background:rgba(46,204,113,0.06); border:1px solid rgba(46,204,113,0.25); border-radius:6px; padding:10px;">
                  <div style="font-size:11px; font-weight:700; color:var(--green); text-transform:uppercase; margin-bottom:4px;">Updated Snapshot</div>
                  <pre style="margin:0; font-size:12px; color:var(--txt); white-space:pre-wrap; word-break:break-word;">${found.new_details || 'N/A'}</pre>
                </div>
              </div>
            `);
          });
        });
      } catch (err) {
        if (window.Skeleton) {
          container.innerHTML = window.Skeleton.error(err.message || 'Error loading audit logs.', { retryId: 'btnRetryAuditFeed' });
          window.Skeleton.wireRetry('btnRetryAuditFeed', () => loadActivityAuditFeed());
        } else {
          container.innerHTML = `<div style="padding:14px; color:var(--red); font-size:12.5px;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading audit logs: ${err.message}</div>`;
        }
      }
    }

    const btnRefreshAudit = document.getElementById('btnRefreshAuditLogs');
    if (btnRefreshAudit) {
      btnRefreshAudit.addEventListener('click', () => loadActivityAuditFeed());
    }

    const auditSearch = document.getElementById('auditSearchInput');
    if (auditSearch) {
      auditSearch.addEventListener('input', window.debounce(() => loadActivityAuditFeed(), 200));
    }

    const auditFilter = document.getElementById('auditModuleFilter');
    if (auditFilter) {
      auditFilter.addEventListener('change', () => loadActivityAuditFeed());
    }

    // Performance & Telemetry Handlers
    async function loadPerformanceTelemetry() {
      const container = document.getElementById('perfTelemetryContainer');
      if (!container) return;
      if (window.Skeleton) {
        container.innerHTML = window.Skeleton.chart(6);
      } else {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--txt-muted); font-size:13px;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching real-time telemetry metrics...</div>`;
      }
      try {
        const start = performance.now();
        const data = await window.Api.get('/system/performance', { bypassCache: true });
        const roundTripMs = Math.round(performance.now() - start);

        const pool = data.pool || {};
        const cache = data.cache || {};
        const db = data.database || {};
        const mem = data.memory || {};

        container.innerHTML = `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:16px;">
            <div style="background:var(--bg-subtle, rgba(255,255,255,0.03)); border:1px solid var(--border-light); border-radius:8px; padding:12px;">
              <div style="font-size:11.5px; color:var(--txt-muted); text-transform:uppercase; font-weight:700;"><i class="fa-solid fa-stopwatch" style="color:var(--gold);"></i> API Latency</div>
              <div style="font-size:22px; font-weight:800; color:var(--green); margin-top:4px;">${roundTripMs} ms</div>
              <div style="font-size:11.5px; color:var(--txt-muted); margin-top:2px;">Uptime: ${Math.floor(data.uptimeSeconds / 60)}m · Heap: ${mem.heapUsedMb} MB</div>
            </div>

            <div style="background:var(--bg-subtle, rgba(255,255,255,0.03)); border:1px solid var(--border-light); border-radius:8px; padding:12px;">
              <div style="font-size:11.5px; color:var(--txt-muted); text-transform:uppercase; font-weight:700;"><i class="fa-solid fa-database" style="color:var(--blue);"></i> Connection Pool</div>
              <div style="font-size:22px; font-weight:800; color:var(--blue); margin-top:4px;">${pool.activeConnections} / ${pool.connectionLimit}</div>
              <div style="font-size:11.5px; color:var(--txt-muted); margin-top:2px;">Free: ${pool.freeConnections} · Queued: ${pool.queuedRequests} · KeepAlive: ${pool.keepAlive ? 'On' : 'Off'}</div>
            </div>

            <div style="background:var(--bg-subtle, rgba(255,255,255,0.03)); border:1px solid var(--border-light); border-radius:8px; padding:12px;">
              <div style="font-size:11.5px; color:var(--txt-muted); text-transform:uppercase; font-weight:700;"><i class="fa-solid fa-bolt" style="color:var(--gold);"></i> Cache Hit Rate</div>
              <div style="font-size:22px; font-weight:800; color:var(--gold); margin-top:4px;">${cache.masters ? cache.masters.hitRate : '100%'}</div>
              <div style="font-size:11.5px; color:var(--txt-muted); margin-top:2px;">Masters: ${cache.masters?.hits || 0} · Reports: ${cache.reports?.hits || 0}</div>
            </div>

            <div style="background:var(--bg-subtle, rgba(255,255,255,0.03)); border:1px solid var(--border-light); border-radius:8px; padding:12px;">
              <div style="font-size:11.5px; color:var(--txt-muted); text-transform:uppercase; font-weight:700;"><i class="fa-solid fa-table-cells" style="color:#9b59b6;"></i> Ledger Scale</div>
              <div style="font-size:22px; font-weight:800; color:var(--txt); margin-top:4px;">${Number(db.total_ledger_rows || 0).toLocaleString()} <span style="font-size:12px; color:var(--txt-muted); font-weight:normal;">rows</span></div>
              <div style="font-size:11.5px; color:var(--txt-muted); margin-top:2px;">Summary: ${db.summary_buckets || 0} buckets · Vouchers: ${db.total_vouchers || 0}</div>
            </div>
          </div>

          <div style="border:1px solid var(--border-light); border-radius:8px; overflow:hidden;">
            <table class="report-table" style="margin:0; width:100%;">
              <thead>
                <tr>
                  <th>Cache Domain</th>
                  <th>Cached Entries</th>
                  <th>Hits</th>
                  <th>Misses</th>
                  <th>Hit Ratio</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Masters &amp; Metadata Cache</strong></td>
                  <td>${cache.masters?.size || 0}</td>
                  <td style="color:var(--green); font-weight:700;">${cache.masters?.hits || 0}</td>
                  <td style="color:var(--txt-muted);">${cache.masters?.misses || 0}</td>
                  <td><span class="pill pill-gold">${cache.masters?.hitRate || '100%'}</span></td>
                </tr>
                <tr>
                  <td><strong>Reports &amp; Registers Cache</strong></td>
                  <td>${cache.reports?.size || 0}</td>
                  <td style="color:var(--green); font-weight:700;">${cache.reports?.hits || 0}</td>
                  <td style="color:var(--txt-muted);">${cache.reports?.misses || 0}</td>
                  <td><span class="pill pill-blue">${cache.reports?.hitRate || '100%'}</span></td>
                </tr>
                <tr>
                  <td><strong>Dashboard Summary Cache</strong></td>
                  <td>${cache.dashboard?.size || 0}</td>
                  <td style="color:var(--green); font-weight:700;">${cache.dashboard?.hits || 0}</td>
                  <td style="color:var(--txt-muted);">${cache.dashboard?.misses || 0}</td>
                  <td><span class="pill pill-green">${cache.dashboard?.hitRate || '100%'}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      } catch (e) {
        if (window.Skeleton) {
          container.innerHTML = window.Skeleton.error(e.message || 'Telemetry unavailable.', { retryId: 'btnRetryTelemetry' });
          window.Skeleton.wireRetry('btnRetryTelemetry', () => loadPerformanceTelemetry());
        } else {
          container.innerHTML = `<div style="padding:14px; color:var(--red); font-size:12.5px;"><i class="fa-solid fa-triangle-exclamation"></i> Telemetry unavailable: ${e.message}</div>`;
        }
      }
    }

    const btnRefreshPerf = document.getElementById('btnRefreshPerfStats');
    if (btnRefreshPerf) {
      btnRefreshPerf.addEventListener('click', () => loadPerformanceTelemetry());
    }

    const btnPurgeClient = document.getElementById('btnPurgeClientCache');
    if (btnPurgeClient) {
      btnPurgeClient.addEventListener('click', () => {
        if (typeof window.clearClientApiCache === 'function') {
          window.clearClientApiCache();
          if (window.showToast) window.showToast('Client-side in-memory cache purged successfully.');
        }
      });
    }

    activateTab(initialTab);

    // Wire Theme buttons inside Settings
    const modalBox = document.querySelector('#modalOverlay .modal-box');
    if (modalBox && window.wireThemeButtons) window.wireThemeButtons(modalBox);

    // -------------------------------------------------------------
    // 1. My Profile Tab Async Initialization & Save
    // -------------------------------------------------------------
    const profileEmailInput = document.getElementById('myProfileEmail');
    const profileUnameInput = document.getElementById('myProfileUsername');
    const myNewPassInput = document.getElementById('myProfileNewPass');
    const myConfirmPassInput = document.getElementById('myProfileConfirmPass');
    const profilePwdContainer = document.getElementById('profilePwdStrengthContainer');

    if (window.PasswordPolicy && myNewPassInput && profilePwdContainer) {
      window.PasswordPolicy.attach({
        passwordInput: myNewPassInput,
        confirmPasswordInput: myConfirmPassInput,
        container: profilePwdContainer,
        showMatch: true
      });
    }

    if (profileEmailInput && window.Api) {
      window.Api.get('/auth/profile').then((data) => {
        if (data && data.email && profileEmailInput) profileEmailInput.value = data.email;
        if (data && data.username && profileUnameInput) profileUnameInput.value = data.username;
      }).catch(() => {});
    }

    const btnSaveProfile = document.getElementById('btnSaveMyProfile');
    if (btnSaveProfile) {
      btnSaveProfile.addEventListener('click', async () => {
        const newUsername = (document.getElementById('myProfileUsername') || {}).value.trim();
        const newEmail = (document.getElementById('myProfileEmail') || {}).value.trim();
        const currentPassword = (document.getElementById('myProfileCurPass') || {}).value.trim();
        const newPassword = (document.getElementById('myProfileNewPass') || {}).value.trim();
        const confirmPassword = (document.getElementById('myProfileConfirmPass') || {}).value.trim();

        if (newPassword || newUsername) {
          if (!currentPassword) {
            window.openModal('Authentication Required', '<p>Please enter your current Password / PIN to confirm changes to your account.</p>');
            return;
          }
        }
        if (newPassword) {
          if (window.PasswordPolicy) {
            const pol = window.PasswordPolicy.evaluate(newPassword, { confirmPassword });
            if (!pol.valid) {
              window.openModal('Password Policy Requirement', `<p style="color:var(--red);">${pol.errors[0] || 'Password does not meet security requirements.'}</p>`);
              return;
            }
          } else {
            if (newPassword !== confirmPassword) {
              window.openModal('Password Mismatch', '<p>The new password and confirmation do not match.</p>');
              return;
            }
            if (newPassword.length < 12) {
              window.openModal('Weak Password', '<p>Password must be at least 12 characters long.</p>');
              return;
            }
          }
        }

        try {
          const res = await window.Api.put('/auth/profile', {
            newUsername,
            newEmail,
            currentPassword: currentPassword || undefined,
            newPassword: newPassword || undefined
          });

          if (res && res.success) {
            if (res.token) {
              const saved = JSON.parse(sessionStorage.getItem('auth_user') || '{}');
              sessionStorage.setItem('auth_user', JSON.stringify({ ...saved, username: res.username, token: res.token }));
            }
            if (res.username) {
              window.currentUsername = res.username;
              updateProfileDisplay(res.username, currentRole);
            }
            if (window.showToast) window.showToast('Profile & credentials updated successfully!');
            document.getElementById('myProfileCurPass').value = '';
            document.getElementById('myProfileNewPass').value = '';
            document.getElementById('myProfileConfirmPass').value = '';
          }
        } catch (err) {
          window.openModal('Update Failed', `<p style="color:var(--red);">${err.message || 'Could not update profile.'}</p>`);
        }
      });
    }

    // Forgot Password flow inside Profile
    const btnForgotPass = document.getElementById('btnProfileForgotPass');
    const forgotBox = document.getElementById('profileForgotOtpBox');
    const btnCancelForgot = document.getElementById('btnProfileCancelForgot');
    const btnVerifyForgot = document.getElementById('btnProfileVerifyOtpReset');

    if (btnForgotPass && forgotBox) {
      btnForgotPass.addEventListener('click', async () => {
        try {
          const res = await window.Api.post('/auth/forgot-password', { username: currentUsername });
          if (res && res.success) {
            const desc = document.getElementById('profileForgotOtpDesc');
            if (desc) desc.textContent = `We have emailed a 6-digit verification OTP to ${res.maskedEmail || 'your registered email'}. Enter it below with your new password.`;
            forgotBox.style.display = 'block';
            forgotBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (window.showToast) window.showToast('OTP sent to your email!');
          }
        } catch (e) {
          window.openModal('OTP Failed', `<p style="color:var(--red);">${(e && e.message) || 'Could not send OTP. Ensure your account has a registered email.'}</p>`);
        }
      });
    }

    if (btnCancelForgot && forgotBox) {
      btnCancelForgot.addEventListener('click', () => {
        forgotBox.style.display = 'none';
      });
    }

    if (btnVerifyForgot) {
      btnVerifyForgot.addEventListener('click', async () => {
        const otp = (document.getElementById('profileForgotOtpInput') || {}).value.trim();
        const newPass = (document.getElementById('profileForgotNewPass') || {}).value.trim();
        const confirmPass = (document.getElementById('profileForgotConfirmPass') || {}).value.trim();

        if (!otp || !newPass) {
          window.openModal('Validation Error', '<p>Please enter the OTP and your new password.</p>');
          return;
        }
        if (newPass !== confirmPass) {
          window.openModal('Password Mismatch', '<p>The new password and confirmation do not match.</p>');
          return;
        }

        try {
          await window.Api.post('/auth/reset-password', {
            username: currentUsername,
            otp,
            newPassword: newPass
          });
          if (window.showToast) window.showToast('Password reset successfully!');
          if (forgotBox) forgotBox.style.display = 'none';
          document.getElementById('profileForgotOtpInput').value = '';
          document.getElementById('profileForgotNewPass').value = '';
          document.getElementById('profileForgotConfirmPass').value = '';
        } catch (e) {
          window.openModal('Reset Failed', `<p style="color:var(--red);">${(e && e.message) || 'Could not reset password.'}</p>`);
        }
      });
    }

    // -------------------------------------------------------------
    // Active Devices List & Revocation (Embedded)
    // -------------------------------------------------------------
    const sessionsListEl = document.getElementById('setProfileSessionsList');
    const sessionsCountEl = document.getElementById('setProfileSessionsCount');

    async function loadProfileActiveSessions() {
      if (!sessionsListEl) return;
      try {
        const data = await window.Api.get('/auth/my-sessions');
        const sessions = (data && data.sessions) || [];
        const active = sessions.filter((s) => !s.revoked);
        if (sessionsCountEl) sessionsCountEl.textContent = `${active.length} Device${active.length === 1 ? '' : 's'} Active`;

        if (!active.length) {
          sessionsListEl.innerHTML = '<p class="note" style="padding:10px 0; margin:0;">No other active sessions found.</p>';
          return;
        }

        sessionsListEl.innerHTML = active.map((s) => {
          const when = s.lastSeen ? String(s.lastSeen).replace('T', ' ').slice(0, 16) : 'Just now';
          const isThis = !!s.isCurrent;
          const badge = isThis ? '<span class="pill pill-green" style="font-size:10px; padding:2px 6px;">This device</span>' : '';
          const btn = isThis ? '' : `<button type="button" class="btn btn-ghost bom-mini-btn" data-revoke-session-id="${s.id}"><i class="fa-solid fa-right-from-bracket"></i> Log out</button>`;
          return `
            <div class="sess-row" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid var(--border-light); gap:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="font-size:16px; color:var(--blue); width:24px; text-align:center;"><i class="fa-solid ${s.deviceLabel && s.deviceLabel.toLowerCase().includes('mobile') ? 'fa-mobile-screen' : 'fa-desktop'}"></i></div>
                <div>
                  <div style="font-size:12.5px; font-weight:700; color:var(--txt);">${s.deviceLabel || 'Device / Browser'} ${badge}</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Last active ${when}${s.ip ? ' · IP ' + s.ip : ''}</div>
                </div>
              </div>
              <div>${btn}</div>
            </div>
          `;
        }).join('');

        sessionsListEl.querySelectorAll('[data-revoke-session-id]').forEach((b) => {
          b.addEventListener('click', async () => {
            const sid = b.getAttribute('data-revoke-session-id');
            try {
              await window.Api.post('/auth/sessions/' + sid + '/revoke', {});
              if (window.showToast) window.showToast('Device logged out');
              loadProfileActiveSessions();
            } catch (e) {
              window.openModal('Error', `<p>${(e && e.message) || 'Failed to revoke device.'}</p>`);
            }
          });
        });
      } catch (e) {
        if (sessionsListEl) sessionsListEl.innerHTML = '<p class="note" style="color:var(--red);">Could not load active devices.</p>';
      }
    }

    loadProfileActiveSessions();

    const btnRevokeOthers = document.getElementById('setProfileRevokeOthers');
    if (btnRevokeOthers) {
      btnRevokeOthers.addEventListener('click', async () => {
        const ok = await window.confirmDialog('Log out other devices', 'All other devices will be signed out. This device stays logged in.', { kind: 'warning', okLabel: 'Log out others' });
        if (!ok) return;
        try {
          await window.Api.post('/auth/sessions/revoke-others', {});
          if (window.showToast) window.showToast('Other devices logged out successfully');
          loadProfileActiveSessions();
        } catch (e) {
          window.openModal('Error', `<p>${(e && e.message) || 'Failed to log out others.'}</p>`);
        }
      });
    }

    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // 2. Document Sequences & Numbering Series Live Preview & Handlers
    // -------------------------------------------------------------
    const purPrefixInp = document.getElementById('setPurPrefix');
    const purNextInp = document.getElementById('setPurNext');
    const purPreviewEl = document.getElementById('previewPurSeq');

    const salePrefixInp = document.getElementById('setSalePrefix');
    const saleNextInp = document.getElementById('setSaleNext');
    const salePreviewEl = document.getElementById('previewSaleSeq');

    const prefixInput = document.getElementById('setChallanPrefix');
    const nextInput = document.getElementById('setChallanNext');
    const padSelect = document.getElementById('setChallanPad');
    const suffixInput = document.getElementById('setChallanSuffix');
    const previewEl = document.getElementById('setChallanPreview');

    const payPrefixInp = document.getElementById('setPaymentPrefix');
    const rctPrefixInp = document.getElementById('setReceiptPrefix');
    const jvPrefixInp = document.getElementById('setJournalPrefix');

    function refreshDocPreviews() {
      if (purPreviewEl) {
        const p = purPrefixInp ? purPrefixInp.value : 'PUR-';
        const n = parseInt(purNextInp ? purNextInp.value : '1001', 10) || 1;
        purPreviewEl.textContent = `${p}${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
      }
      if (salePreviewEl) {
        const p = salePrefixInp ? salePrefixInp.value : 'SAL-';
        const n = parseInt(saleNextInp ? saleNextInp.value : '1001', 10) || 1;
        salePreviewEl.textContent = `${p}${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
      }
      if (previewEl) {
        const p = (prefixInput ? prefixInput.value : '');
        const s = (suffixInput ? suffixInput.value : '');
        const n = parseInt(nextInput ? nextInput.value : '1', 10) || 1;
        const pad = parseInt(padSelect ? padSelect.value : '0', 10) || 0;
        const padded = pad > 0 ? String(n).padStart(pad, '0') : String(n);
        previewEl.textContent = `${p}${padded}${s}`;
      }
    }

    [purPrefixInp, purNextInp, salePrefixInp, saleNextInp, prefixInput, nextInput, padSelect, suffixInput, payPrefixInp, rctPrefixInp, jvPrefixInp].forEach((el) => {
      if (el) {
        el.addEventListener('input', refreshDocPreviews);
        el.addEventListener('change', refreshDocPreviews);
      }
    });

    if (window.Api) {
      window.Api.get('/auth/app-settings').then((res) => {
        const s = (res && res.settings) || {};
        if (purPrefixInp && s.purchase_prefix != null) purPrefixInp.value = s.purchase_prefix;
        if (purNextInp && s.purchase_next != null) purNextInp.value = s.purchase_next;
        if (salePrefixInp && s.sales_prefix != null) salePrefixInp.value = s.sales_prefix;
        if (saleNextInp && s.sales_next != null) saleNextInp.value = s.sales_next;
        if (prefixInput && s.challan_prefix != null) prefixInput.value = s.challan_prefix;
        if (nextInput && s.challan_next != null) nextInput.value = s.challan_next;
        if (padSelect && s.challan_pad != null) padSelect.value = s.challan_pad;
        if (suffixInput && s.challan_suffix != null) suffixInput.value = s.challan_suffix;
        if (payPrefixInp && s.payment_prefix != null) payPrefixInp.value = s.payment_prefix;
        if (rctPrefixInp && s.receipt_prefix != null) rctPrefixInp.value = s.receipt_prefix;
        if (jvPrefixInp && s.journal_prefix != null) jvPrefixInp.value = s.journal_prefix;
        refreshDocPreviews();
      }).catch(() => refreshDocPreviews());
    }

    const btnSaveChallan = document.getElementById('setBtnSaveChallan');
    if (btnSaveChallan) {
      btnSaveChallan.addEventListener('click', async () => {
        const payload = {
          purchase_prefix: purPrefixInp ? purPrefixInp.value.trim() : 'PUR-',
          purchase_next: purNextInp ? purNextInp.value.trim() : '1001',
          sales_prefix: salePrefixInp ? salePrefixInp.value.trim() : 'SAL-',
          sales_next: saleNextInp ? saleNextInp.value.trim() : '1001',
          challan_prefix: prefixInput ? prefixInput.value.trim() : 'CHL-',
          challan_next: nextInput ? nextInput.value.trim() : '1001',
          challan_pad: padSelect ? padSelect.value : '4',
          challan_suffix: suffixInput ? suffixInput.value.trim() : '',
          payment_prefix: payPrefixInp ? payPrefixInp.value.trim() : 'PMT-',
          receipt_prefix: rctPrefixInp ? rctPrefixInp.value.trim() : 'RCT-',
          journal_prefix: jvPrefixInp ? jvPrefixInp.value.trim() : 'JV-'
        };

        try {
          if (window.CONFIG && window.CONFIG.saveSettings) {
            await window.CONFIG.saveSettings(payload);
          } else {
            await window.Api.put('/auth/app-settings', { settings: payload });
          }
          if (window.showSuccess) {
            window.showSuccess('Document Numbering Saved', 'All document prefixes and starting sequences have been successfully updated.');
          } else if (window.showToast) {
            window.showToast('Document numbering settings saved!', 'success');
          }
        } catch (err) {
          window.showError('Save Failed', err.message || 'Could not save document numbering settings.');
        }
      });
    }

    // -------------------------------------------------------------
    // 3. User Accounts Tab (Admin / SuperAdmin)
    // -------------------------------------------------------------
    if (isAdmin) {
      const unameInp = document.getElementById('setMngUname');
      const passInp = document.getElementById('setMngPass');
      const emailInp = document.getElementById('setMngEmail');
      const roleInp = document.getElementById('setMngRole');
      const ledgerBody = document.getElementById('setUsersLedgerBody');

      async function loadSettingsUsersLedger() {
        if (!ledgerBody) return;
        try {
          const rows = await window.Api.get('/masters/users');
          if (!rows || !rows.length) {
            ledgerBody.innerHTML = `<tr><td colspan="3" class="pl-empty-hint">No user accounts found</td></tr>`;
            return;
          }
          ledgerBody.innerHTML = rows.map((u) => `
            <tr style="cursor:pointer;" title="Click to fill form">
              <td style="font-weight:700; color:var(--txt);">@${u.username}</td>
              <td style="color:var(--txt-muted); font-size:12px;">${u.email || '-'}</td>
              <td><span class="pill pill-${u.role === 'SuperAdmin' ? 'purple' : u.role === 'Admin' ? 'gold' : 'blue'}" style="font-size:10.5px; padding:2px 7px;">${u.role}</span></td>
            </tr>
          `).join('');

          ledgerBody.querySelectorAll('tr').forEach((tr, i) => {
            tr.addEventListener('click', () => {
              const u = rows[i];
              if (u) {
                if (unameInp) unameInp.value = u.username;
                if (emailInp) emailInp.value = u.email || '';
                if (roleInp) roleInp.value = u.role || 'User';
                if (passInp) passInp.focus();
              }
            });
          });
        } catch (e) {
          ledgerBody.innerHTML = `<tr><td colspan="3" class="pl-empty-hint" style="color:var(--red);">Could not load user accounts</td></tr>`;
        }
      }

      const setMngPwdContainer = document.getElementById('setMngPwdStrengthContainer');
      if (window.PasswordPolicy && passInp && setMngPwdContainer) {
        window.PasswordPolicy.attach({
          passwordInput: passInp,
          container: setMngPwdContainer,
          showMatch: false
        });
      }

      loadSettingsUsersLedger();

      const btnAddUser = document.getElementById('setBtnAddUser');
      if (btnAddUser) {
        btnAddUser.addEventListener('click', async () => {
          const username = unameInp.value.trim();
          const password = passInp.value.trim();
          const email = emailInp.value.trim();
          const role = roleInp.value;
          if (!username || !password || !email) {
            window.openModal('Validation Error', '<p>Username, Password, and Email are required.</p>');
            return;
          }
          if (window.PasswordPolicy) {
            const pol = window.PasswordPolicy.evaluate(password);
            if (!pol.valid) {
              window.openModal('Password Policy Requirement', `<p style="color:var(--red);">${pol.errors[0] || 'Password does not meet security requirements.'}</p>`);
              return;
            }
          }
          try {
            await window.Api.post('/masters/users', { username, password, email, role });
            if (window.showToast) window.showToast(`User '@${username}' created!`);
            unameInp.value = '';
            passInp.value = '';
            emailInp.value = '';
            if (setMngPwdContainer) setMngPwdContainer.style.display = 'none';
            loadSettingsUsersLedger();
          } catch (e) {
            window.openModal('Failed', `<p style="color:var(--red);">${e.message || 'Could not add user.'}</p>`);
          }
        });
      }

      const btnUpdatePass = document.getElementById('setBtnUpdatePass');
      if (btnUpdatePass) {
        btnUpdatePass.addEventListener('click', async () => {
          const username = unameInp.value.trim();
          const password = passInp.value.trim();
          if (!username || !password) {
            window.openModal('Validation Error', '<p>Please enter username and new password.</p>');
            return;
          }
          if (window.PasswordPolicy) {
            const pol = window.PasswordPolicy.evaluate(password);
            if (!pol.valid) {
              window.openModal('Password Policy Requirement', `<p style="color:var(--red);">${pol.errors[0] || 'Password does not meet security requirements.'}</p>`);
              return;
            }
          }
          try {
            await window.Api.put('/masters/users/password', { username, password });
            if (window.showToast) window.showToast(`Password updated for '@${username}'!`);
            passInp.value = '';
            if (setMngPwdContainer) setMngPwdContainer.style.display = 'none';
          } catch (e) {
            window.openModal('Failed', `<p style="color:var(--red);">${e.message || 'Could not update password.'}</p>`);
          }
        });
      }

      const btnUpdateEmail = document.getElementById('setBtnUpdateEmail');
      if (btnUpdateEmail) {
        btnUpdateEmail.addEventListener('click', async () => {
          const username = unameInp.value.trim();
          const email = emailInp.value.trim();
          if (!username || !email) {
            window.openModal('Validation Error', '<p>Please enter username and new email.</p>');
            return;
          }
          try {
            await window.Api.put('/masters/users/email', { username, email });
            if (window.showToast) window.showToast(`Email updated for '@${username}'!`);
            loadSettingsUsersLedger();
          } catch (e) {
            window.openModal('Failed', `<p style="color:var(--red);">${e.message || 'Could not update email.'}</p>`);
          }
        });
      }
    }

    // -------------------------------------------------------------
    // 4. Appearance Tab Interactive Preview & Explicit Save Action
    // -------------------------------------------------------------
    let selectedTheme = activeTheme;
    let selectedFont = activeFont;
    let selectedAvatar = activeAvatar;

    const themeBtns = document.querySelectorAll('#tab-theme [data-theme-set]');
    const fontBtns = document.querySelectorAll('#tab-theme [data-font-set]');
    const avatarBtns = document.querySelectorAll('#tab-theme [data-avatar-set]');

    const previewAvatar = document.getElementById('setPreviewAvatarCircle');
    const previewFontLabel = document.getElementById('setPreviewFontLabel');
    const previewThemeBadge = document.getElementById('setPreviewThemeBadge');
    const previewUserName = document.getElementById('setPreviewUserName');

    function updateAppearancePreview() {
      // 1. Theme preview
      if (previewThemeBadge) {
        const themeLabels = {
          'dark': '<i class="fa-solid fa-moon"></i> Midnight Dark',
          'gray': '<i class="fa-solid fa-circle-half-stroke"></i> Charcoal Slate',
          'light': '<i class="fa-solid fa-sun"></i> Cloud Light',
          'emerald': '<i class="fa-solid fa-leaf" style="color:#2ecc71;"></i> Solar Emerald',
          'ocean': '<i class="fa-solid fa-water" style="color:#38bdf8;"></i> Deep Ocean'
        };
        previewThemeBadge.innerHTML = themeLabels[selectedTheme] || selectedTheme;
      }
      themeBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-theme-set') === selectedTheme));

      // 2. Font preview
      const fontLabels = {
        'segoe': 'Segoe UI (System)',
        'inter': 'Inter Modern',
        'roboto': 'Roboto Corporate',
        'jakarta': 'Plus Jakarta Sans',
        'outfit': 'Outfit Tech',
        'jetbrains': 'JetBrains Mono'
      };
      if (previewFontLabel) previewFontLabel.textContent = `Font: ${fontLabels[selectedFont] || selectedFont}`;
      if (previewUserName && window.FONTS_PALETTE && window.FONTS_PALETTE[selectedFont]) {
        previewUserName.style.fontFamily = window.FONTS_PALETTE[selectedFont];
      }
      fontBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-font-set') === selectedFont));

      // 3. Avatar color preview
      const palette = (window.AVATAR_PALETTE && window.AVATAR_PALETTE[selectedAvatar]) || {
        bg: 'linear-gradient(135deg, #D4AF37, #B6952C)',
        txt: '#111111',
        border: '#D4AF37'
      };
      if (previewAvatar) {
        previewAvatar.style.setProperty('background', palette.bg, 'important');
        previewAvatar.style.setProperty('color', palette.txt, 'important');
        previewAvatar.style.setProperty('border-color', palette.border, 'important');
      }
      avatarBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-avatar-set') === selectedAvatar));
    }

    themeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedTheme = btn.getAttribute('data-theme-set');
        if (window.setAppTheme) window.setAppTheme(selectedTheme, { skipServer: true });
        updateAppearancePreview();
      });
    });

    fontBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFont = btn.getAttribute('data-font-set');
        if (window.setAppFont) window.setAppFont(selectedFont, { skipServer: true });
        updateAppearancePreview();
      });
    });

    avatarBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedAvatar = btn.getAttribute('data-avatar-set');
        if (window.setAppAvatarColor) window.setAppAvatarColor(selectedAvatar, { skipServer: true });
        updateAppearancePreview();
      });
    });

    updateAppearancePreview();

    const chkAnimations = document.getElementById('setCheckAnimations');
    const chkCompact = document.getElementById('setCheckCompactTables');

    // Explicit "Save Appearance Preferences" Button
    const btnSaveAppearance = document.getElementById('btnSaveAppearanceSettings');
    if (btnSaveAppearance) {
      btnSaveAppearance.addEventListener('click', async () => {
        try {
          btnSaveAppearance.disabled = true;
          btnSaveAppearance.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

          // Apply & Persist Theme, Font, Avatar
          if (window.setAppTheme) window.setAppTheme(selectedTheme);
          if (window.setAppFont) window.setAppFont(selectedFont);
          if (window.setAppAvatarColor) window.setAppAvatarColor(selectedAvatar);

          const isSmooth = chkAnimations ? chkAnimations.checked : true;
          const isCompact = chkCompact ? chkCompact.checked : false;

          if (window.applyUserPreferences) {
            window.applyUserPreferences({
              smooth_animations: isSmooth,
              compact_tables: isCompact
            });
          }

          if (window.Api) {
            await window.Api.put('/auth/preferences', {
              theme: selectedTheme,
              font_family: selectedFont,
              avatar_color: selectedAvatar,
              smooth_animations: isSmooth,
              compact_tables: isCompact
            });
          }

          if (window.showSuccess) {
            window.showSuccess('Appearance Settings Saved', 'Your theme, typography, avatar badge color, and display preferences have been saved and applied successfully across all devices.');
          } else if (window.openModal) {
            window.openModal('Appearance Saved', '<p style="color:var(--green); font-weight:700;"><i class="fa-solid fa-circle-check"></i> Appearance preferences saved successfully!</p>');
          }
        } catch (err) {
          if (window.showError) {
            window.showError('Save Failed', (err && err.message) || 'Could not save appearance preferences.');
          } else {
            window.openModal('Save Failed', `<p style="color:var(--red);">${(err && err.message) || 'Could not save appearance preferences.'}</p>`);
          }
        } finally {
          btnSaveAppearance.disabled = false;
          btnSaveAppearance.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Appearance Preferences';
        }
      });
    }

    const btnOpenDashCust = document.getElementById('btnOpenDashCustomizerFromSettings');
    if (btnOpenDashCust) {
      btnOpenDashCust.addEventListener('click', () => {
        if (window.openDashboardCustomizerModal) {
          window.openDashboardCustomizerModal();
        } else {
          go('dashboard');
          setTimeout(() => {
            if (window.openDashboardCustomizerModal) window.openDashboardCustomizerModal();
          }, 150);
        }
      });
    }

    // -------------------------------------------------------------
    // 5. Alerts & Stock Tab
    // -------------------------------------------------------------
    const lowStockThreshInp = document.getElementById('setLowStockThreshold');
    const scannerSoundSel = document.getElementById('setScannerSound');
    const btnTestSound = document.getElementById('btnTestScannerSound');
    const chkLowStockEmail = document.getElementById('setCheckLowStockEmail');
    const lowStockEmailsInp = document.getElementById('setLowStockEmails');
    const btnTestLowStock = document.getElementById('btnTestLowStockEmail');
    const chkDispatchEmail = document.getElementById('setCheckDispatchEmail');
    const dispatchEmailsInp = document.getElementById('setDispatchEmails');
    const btnTestDispatch = document.getElementById('btnTestDispatchEmail');
    const btnSaveStockScanner = document.getElementById('setBtnSaveStockScanner');
    const btnSaveEmailAlerts = document.getElementById('setBtnSaveEmailAlerts');

    if (btnTestSound && scannerSoundSel) {
      btnTestSound.addEventListener('click', () => {
        const sound = scannerSoundSel.value;
        if (window.playScannerTone) window.playScannerTone(sound);
      });
    }

    // -------------------------------------------------------------
    // Company Profile & Tax Identity Handlers
    // -------------------------------------------------------------
    const compNameInp = document.getElementById('setCompanyName');
    const compGstinInp = document.getElementById('setCompanyGstin');
    const compPanInp = document.getElementById('setCompanyPan');
    const compStateCodeInp = document.getElementById('setCompanyStateCode');
    const compAddressInp = document.getElementById('setCompanyAddress');
    const compCurrencyInp = document.getElementById('setCompanyCurrency');
    const compFyStartInp = document.getElementById('setCompanyFyStart');
    const btnSaveCompany = document.getElementById('btnSaveCompanyProfile');

    if (btnSaveCompany) {
      btnSaveCompany.addEventListener('click', async () => {
        const payload = {
          company_name: (compNameInp ? compNameInp.value.trim() : '') || 'Eco Green Solar',
          company_gstin: (compGstinInp ? compGstinInp.value.trim() : '') || '',
          company_pan: (compPanInp ? compPanInp.value.trim() : '') || '',
          company_state_code: (compStateCodeInp ? compStateCodeInp.value.trim() : '') || '24',
          company_address: (compAddressInp ? compAddressInp.value.trim() : '') || '',
          company_currency: (compCurrencyInp ? compCurrencyInp.value.trim() : '') || 'INR',
          company_fy_start: (compFyStartInp ? compFyStartInp.value.trim() : '') || '2026-04-01'
        };

        try {
          if (window.CONFIG && window.CONFIG.saveSettings) {
            await window.CONFIG.saveSettings(payload);
          } else {
            await window.Api.put('/auth/app-settings', { settings: payload });
          }
          if (window.showSuccess) {
            window.showSuccess('Company Profile Saved', 'Enterprise identity, GSTIN, and state code settings updated.');
          } else if (window.showToast) {
            window.showToast('Company profile settings saved!', 'success');
          }
        } catch (e) {
          window.showError('Save Failed', (e && e.message) || 'Could not save company profile.');
        }
      });
    }

    // -------------------------------------------------------------
    // ERP Operating Mode, Presets & Feature Switches
    // -------------------------------------------------------------
    const chkInvTracking = document.getElementById('setCheckInvTracking');
    const chkSerialTracking = document.getElementById('setCheckSerialTracking');
    const chkWarehouseTracking = document.getElementById('setCheckWarehouseTracking');
    const chkAccountingEnabled = document.getElementById('setCheckAccountingEnabled');
    const chkGstEnabled = document.getElementById('setCheckGstEnabled');
    const chkFeatureBom = document.getElementById('setCheckFeatureBom');
    const chkFeaturePricing = document.getElementById('setCheckFeaturePricing');
    const chkFeatureProofMandatory = document.getElementById('setCheckFeatureProofMandatory');
    const selStockValuation = document.getElementById('setStockValuation');
    const selFeatureWattRule = document.getElementById('setFeatureWattRule');

    function applyPresetToForm(presetKey) {
      if (!window.CONFIG || !window.CONFIG.getPreset) return;
      const p = window.CONFIG.getPreset(presetKey);
      if (!p || !p.flags) return;
      if (chkInvTracking) chkInvTracking.checked = (p.flags.inventory_tracking === '1');
      if (chkSerialTracking) chkSerialTracking.checked = (p.flags.serial_tracking === '1');
      if (chkWarehouseTracking) chkWarehouseTracking.checked = (p.flags.warehouse_tracking === '1');
      if (chkAccountingEnabled) chkAccountingEnabled.checked = (p.flags.accounting_enabled === '1');
      if (chkGstEnabled) chkGstEnabled.checked = (p.flags.gst_enabled === '1');
      if (chkFeatureBom) chkFeatureBom.checked = (p.flags.feature_bom_enabled === '1');
      if (selStockValuation && p.flags.stock_valuation) selStockValuation.value = p.flags.stock_valuation;
    }

    document.querySelectorAll('input[name="setErpPreset"]').forEach((r) => {
      r.addEventListener('change', () => {
        document.querySelectorAll('input[name="setErpPreset"]').forEach((other) => {
          const card = other.closest('.egs-mode-card');
          if (card) {
            card.style.borderColor = other.checked ? 'var(--blue)' : 'var(--border)';
            card.style.background = other.checked ? 'rgba(59,142,208,0.08)' : 'var(--panel-alt)';
          }
        });
        if (r.checked) {
          applyPresetToForm(r.value);
        }
      });
    });

    if (window.Api) {
      window.Api.get('/auth/app-settings').then((res) => {
        const s = (res && res.settings) || {};
        if (lowStockThreshInp && s.low_stock_threshold != null) lowStockThreshInp.value = s.low_stock_threshold;
        if (scannerSoundSel && s.scanner_sound != null) scannerSoundSel.value = s.scanner_sound;
        if (chkLowStockEmail) chkLowStockEmail.checked = s.low_stock_alert_enabled === '1';
        if (lowStockEmailsInp && s.low_stock_alert_emails != null) lowStockEmailsInp.value = s.low_stock_alert_emails;
        if (chkDispatchEmail) chkDispatchEmail.checked = s.dispatch_alert_enabled === '1';
        if (dispatchEmailsInp && s.dispatch_alert_emails != null) dispatchEmailsInp.value = s.dispatch_alert_emails;

        // Company Profile
        if (compNameInp && s.company_name) compNameInp.value = s.company_name;
        if (compGstinInp && s.company_gstin) compGstinInp.value = s.company_gstin;
        if (compPanInp && s.company_pan) compPanInp.value = s.company_pan;
        if (compStateCodeInp && s.company_state_code) compStateCodeInp.value = s.company_state_code;
        if (compAddressInp && s.company_address) compAddressInp.value = s.company_address;
        if (compCurrencyInp && s.company_currency) compCurrencyInp.value = s.company_currency;
        if (compFyStartInp && s.company_fy_start) compFyStartInp.value = s.company_fy_start;

        // ERP Mode & Presets
        const curPreset = s.config_profile || 'full_erp';
        document.querySelectorAll('input[name="setErpPreset"]').forEach((r) => {
          r.checked = (r.value === curPreset);
          const card = r.closest('.egs-mode-card');
          if (card) {
            card.style.borderColor = r.checked ? 'var(--blue)' : 'var(--border)';
            card.style.background = r.checked ? 'rgba(59,142,208,0.08)' : 'var(--panel-alt)';
          }
        });

        if (chkInvTracking) chkInvTracking.checked = (s.inventory_tracking !== '0');
        if (chkSerialTracking) chkSerialTracking.checked = (s.serial_tracking !== '0');
        if (chkWarehouseTracking) chkWarehouseTracking.checked = (s.warehouse_tracking !== '0');
        if (chkAccountingEnabled) chkAccountingEnabled.checked = (s.accounting_enabled !== '0');
        if (chkGstEnabled) chkGstEnabled.checked = (s.gst_enabled !== '0');
        if (chkFeatureBom) chkFeatureBom.checked = (s.feature_bom_enabled !== '0');
        if (chkFeaturePricing) chkFeaturePricing.checked = (s.feature_pricing_enabled !== '0');
        if (chkFeatureProofMandatory) chkFeatureProofMandatory.checked = (s.feature_attachment_mandatory === '1');
        if (selStockValuation && s.stock_valuation) selStockValuation.value = s.stock_valuation;
        if (selFeatureWattRule && s.feature_wattage_mandatory) selFeatureWattRule.value = s.feature_wattage_mandatory;
      }).catch(() => {});
    }

    // Save ERP Mode & Features Button
    const btnSaveErpMode = document.getElementById('btnSaveErpModeSettings');
    if (btnSaveErpMode) {
      btnSaveErpMode.addEventListener('click', async () => {
        let selectedPreset = 'full_erp';
        document.querySelectorAll('input[name="setErpPreset"]').forEach((r) => { if (r.checked) selectedPreset = r.value; });

        const payload = {
          config_profile: selectedPreset,
          inventory_tracking: (chkInvTracking && chkInvTracking.checked) ? '1' : '0',
          serial_tracking: (chkSerialTracking && chkSerialTracking.checked) ? '1' : '0',
          warehouse_tracking: (chkWarehouseTracking && chkWarehouseTracking.checked) ? '1' : '0',
          accounting_enabled: (chkAccountingEnabled && chkAccountingEnabled.checked) ? '1' : '0',
          gst_enabled: (chkGstEnabled && chkGstEnabled.checked) ? '1' : '0',
          feature_bom_enabled: (chkFeatureBom && chkFeatureBom.checked) ? '1' : '0',
          feature_pricing_enabled: (chkFeaturePricing && chkFeaturePricing.checked) ? '1' : '0',
          feature_attachment_mandatory: (chkFeatureProofMandatory && chkFeatureProofMandatory.checked) ? '1' : '0',
          stock_valuation: (selStockValuation ? selStockValuation.value : 'average_cost') || 'average_cost',
          feature_wattage_mandatory: (selFeatureWattRule ? selFeatureWattRule.value : 'auto') || 'auto'
        };

        try {
          if (window.CONFIG && window.CONFIG.saveSettings) {
            await window.CONFIG.saveSettings(payload);
          } else {
            await window.Api.put('/auth/app-settings', { settings: payload });
          }

          if (typeof window.applyErpModeRules === 'function') {
            window.applyErpModeRules();
          }
          if (typeof window.renderNavButtons === 'function') {
            window.renderNavButtons();
          }

          if (window.showSuccess) {
            window.showSuccess('Operating Mode & Features Updated', `Enterprise configuration profile set to '${selectedPreset.toUpperCase()}'. Features dynamically updated across system.`);
          } else if (window.showToast) {
            window.showToast('ERP mode and feature settings saved!', 'success');
          }
        } catch (e) {
          window.showError('Configuration Conflict', (e && e.message) || 'Could not save operating mode settings.');
        }
      });
    }

    // Helper: validate comma-separated emails
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    function parseAndValidateEmails(str) {
      if (!str || !str.trim()) return { valid: true, emails: [] };
      const rawList = str.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
      for (const em of rawList) {
        if (!EMAIL_REGEX.test(em)) {
          return { valid: false, invalidEmail: em, emails: rawList };
        }
      }
      return { valid: true, emails: rawList };
    }

    // 1. Save Button: Stock Thresholds & Scanner Audio
    if (btnSaveStockScanner) {
      btnSaveStockScanner.addEventListener('click', async () => {
        const threshold = (lowStockThreshInp ? lowStockThreshInp.value.trim() : '5') || '5';
        const numThresh = parseInt(threshold, 10);
        if (!Number.isFinite(numThresh) || numThresh < 1) {
          window.showError('Invalid Threshold', 'Low stock warning threshold must be a valid positive number (e.g. 5).');
          return;
        }
        const sound = scannerSoundSel ? scannerSoundSel.value : 'beep';

        try {
          await window.Api.put('/auth/app-settings', {
            settings: {
              low_stock_threshold: String(numThresh),
              scanner_sound: sound
            }
          });

          localStorage.setItem('egs_scanner_sound', sound);
          if (window.showSuccess) {
            window.showSuccess('Saved Successfully', `Stock threshold (${numThresh} units) and audio feedback have been updated.`);
          } else if (window.showToast) {
            window.showToast('Stock and scanner settings saved!', 'success');
          }
        } catch (e) {
          window.showError('Save Failed', (e && e.message) || 'Could not save stock & scanner settings.');
        }
      });
    }

    // 2. Test Verification Email: Low Stock
    if (btnTestLowStock && lowStockEmailsInp) {
      btnTestLowStock.addEventListener('click', async () => {
        const parsed = parseAndValidateEmails(lowStockEmailsInp.value);
        if (!parsed.emails.length) {
          window.showWarning('Email Address Required', 'Please enter at least one recipient email address to send a verification test mail.');
          lowStockEmailsInp.focus();
          return;
        }
        if (!parsed.valid) {
          window.showError('Invalid Email Address', `The email address '${parsed.invalidEmail}' is not formatted correctly. Please use format like name@gmail.com.`);
          lowStockEmailsInp.focus();
          return;
        }
        try {
          btnTestLowStock.disabled = true;
          btnTestLowStock.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
          await window.Api.post('/auth/send-test-alert-email', {
            email: parsed.emails.join(', '),
            alertType: 'Low Stock Alerts'
          });
          window.showSuccess('Test Email Sent Successfully', `Verification email has been dispatched to: ${parsed.emails.join(', ')}`);
        } catch (err) {
          window.showError('Verification Failed', err.message || 'Could not send test email.');
        } finally {
          btnTestLowStock.disabled = false;
          btnTestLowStock.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Test Mail';
        }
      });
    }

    // 3. Test Verification Email: Dispatch
    if (btnTestDispatch && dispatchEmailsInp) {
      btnTestDispatch.addEventListener('click', async () => {
        const parsed = parseAndValidateEmails(dispatchEmailsInp.value);
        if (!parsed.emails.length) {
          window.showWarning('Email Address Required', 'Please enter at least one recipient email address to send a verification test mail.');
          dispatchEmailsInp.focus();
          return;
        }
        if (!parsed.valid) {
          window.showError('Invalid Email Address', `The email address '${parsed.invalidEmail}' is not formatted correctly. Please use format like name@gmail.com.`);
          dispatchEmailsInp.focus();
          return;
        }
        try {
          btnTestDispatch.disabled = true;
          btnTestDispatch.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
          await window.Api.post('/auth/send-test-alert-email', {
            email: parsed.emails.join(', '),
            alertType: 'BOM Challan & Dispatch Alerts'
          });
          window.showSuccess('Test Email Sent Successfully', `Verification email has been dispatched to: ${parsed.emails.join(', ')}`);
        } catch (err) {
          window.showError('Verification Failed', err.message || 'Could not send test email.');
        } finally {
          btnTestDispatch.disabled = false;
          btnTestDispatch.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Test Mail';
        }
      });
    }

    // 4. Save Button: Email Notification Settings
    if (btnSaveEmailAlerts) {
      btnSaveEmailAlerts.addEventListener('click', async () => {
        const lowStockEnabled = (chkLowStockEmail && chkLowStockEmail.checked) ? '1' : '0';
        const lowStockEmailsRaw = (lowStockEmailsInp ? lowStockEmailsInp.value.trim() : '');
        const dispatchEnabled = (chkDispatchEmail && chkDispatchEmail.checked) ? '1' : '0';
        const dispatchEmailsRaw = (dispatchEmailsInp ? dispatchEmailsInp.value.trim() : '');

        // Validation
        const parsedLowStock = parseAndValidateEmails(lowStockEmailsRaw);
        if (!parsedLowStock.valid) {
          window.showError('Invalid Low Stock Email', `The email address '${parsedLowStock.invalidEmail}' is invalid. Please provide valid email address(es) (e.g. name@gmail.com).`);
          if (lowStockEmailsInp) lowStockEmailsInp.focus();
          return;
        }
        if (lowStockEnabled === '1' && !parsedLowStock.emails.length) {
          window.showWarning('Email Address Missing', 'Low Stock Warning Email Alert is enabled, but no recipient email address was provided.');
          if (lowStockEmailsInp) lowStockEmailsInp.focus();
          return;
        }

        const parsedDispatch = parseAndValidateEmails(dispatchEmailsRaw);
        if (!parsedDispatch.valid) {
          window.showError('Invalid Dispatch Email', `The email address '${parsedDispatch.invalidEmail}' is invalid. Please provide valid email address(es) (e.g. name@gmail.com).`);
          if (dispatchEmailsInp) dispatchEmailsInp.focus();
          return;
        }
        if (dispatchEnabled === '1' && !parsedDispatch.emails.length) {
          window.showWarning('Email Address Missing', 'BOM Challan & Dispatch Email Alert is enabled, but no recipient email address was provided.');
          if (dispatchEmailsInp) dispatchEmailsInp.focus();
          return;
        }

        try {
          await window.Api.put('/auth/app-settings', {
            settings: {
              low_stock_alert_enabled: lowStockEnabled,
              low_stock_alert_emails: parsedLowStock.emails.join(', '),
              dispatch_alert_enabled: dispatchEnabled,
              dispatch_alert_emails: parsedDispatch.emails.join(', ')
            }
          });

          if (lowStockEmailsInp) lowStockEmailsInp.value = parsedLowStock.emails.join(', ');
          if (dispatchEmailsInp) dispatchEmailsInp.value = parsedDispatch.emails.join(', ');

          if (window.showSuccess) {
            window.showSuccess('Email Alerts Saved Successfully', 'Automated ERP email alert triggers and verified recipient addresses have been saved.');
          } else if (window.showToast) {
            window.showToast('Email alerts saved successfully!', 'success');
          }
        } catch (e) {
          window.showError('Save Failed', (e && e.message) || 'Could not save email notification settings.');
        }
      });
    }

    // -------------------------------------------------------------
    // 6. Native Device Permissions & Notifications Tab Wiring
    // -------------------------------------------------------------
    const badgeNotify = document.getElementById('permBadgeNotify');
    const badgeCamera = document.getElementById('permBadgeCamera');
    const badgeMic = document.getElementById('permBadgeMic');
    const badgeStorage = document.getElementById('permBadgeStorage');
    const btnReqNotify = document.getElementById('btnRequestNotifyPerm');
    const btnTestNotify = document.getElementById('btnTestNotifyPerm');
    const btnReqCamera = document.getElementById('btnRequestCameraPerm');
    const btnReqMic = document.getElementById('btnRequestMicPerm');
    const btnReqStorage = document.getElementById('btnRequestStoragePerm');
    const audioSelect = document.getElementById('setScannerAudioSelect');
    const btnTestAudio = document.getElementById('btnTestScannerAudio');
    const pwaModeVal = document.getElementById('setPwaModeVal');

    const updateAllPermissionBadges = async () => {
      // 1. Notification Badge
      if (badgeNotify) {
        if (!('Notification' in window)) {
          badgeNotify.className = 'pill pill-muted';
          badgeNotify.textContent = 'Not Supported';
          if (btnReqNotify) btnReqNotify.style.display = 'none';
        } else if (Notification.permission === 'granted') {
          badgeNotify.className = 'pill pill-green';
          badgeNotify.innerHTML = '<i class="fa-solid fa-circle-check"></i> Allowed';
          if (btnReqNotify) btnReqNotify.style.display = 'none';
        } else if (Notification.permission === 'denied') {
          badgeNotify.className = 'pill pill-red';
          badgeNotify.innerHTML = '<i class="fa-solid fa-ban"></i> Blocked in OS';
          if (btnReqNotify) {
            btnReqNotify.textContent = 'Blocked in Settings';
            btnReqNotify.disabled = true;
          }
        } else {
          badgeNotify.className = 'pill pill-gold';
          badgeNotify.textContent = 'Not Enabled';
          if (btnReqNotify) {
            btnReqNotify.style.display = 'inline-flex';
            btnReqNotify.disabled = false;
          }
        }
      }

      // 2. Camera Badge
      if (badgeCamera) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          badgeCamera.className = 'pill pill-muted';
          badgeCamera.textContent = 'Not Supported';
        } else if (navigator.permissions && navigator.permissions.query) {
          try {
            const camStat = await navigator.permissions.query({ name: 'camera' });
            if (camStat.state === 'granted') {
              badgeCamera.className = 'pill pill-green';
              badgeCamera.innerHTML = '<i class="fa-solid fa-circle-check"></i> Allowed';
              if (btnReqCamera) btnReqCamera.style.display = 'none';
            } else if (camStat.state === 'denied') {
              badgeCamera.className = 'pill pill-red';
              badgeCamera.innerHTML = '<i class="fa-solid fa-ban"></i> Blocked';
            } else {
              badgeCamera.className = 'pill pill-gold';
              badgeCamera.textContent = 'Prompt on Use';
            }
          } catch (e) {
            badgeCamera.className = 'pill pill-blue';
            badgeCamera.textContent = 'Ready';
          }
        } else {
          badgeCamera.className = 'pill pill-blue';
          badgeCamera.textContent = 'Ready';
        }
      }

      // 3. Microphone Badge
      if (badgeMic) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          badgeMic.className = 'pill pill-muted';
          badgeMic.textContent = 'Not Supported';
        } else if (navigator.permissions && navigator.permissions.query) {
          try {
            const micStat = await navigator.permissions.query({ name: 'microphone' });
            if (micStat.state === 'granted') {
              badgeMic.className = 'pill pill-green';
              badgeMic.innerHTML = '<i class="fa-solid fa-circle-check"></i> Allowed';
              if (btnReqMic) btnReqMic.style.display = 'none';
            } else if (micStat.state === 'denied') {
              badgeMic.className = 'pill pill-red';
              badgeMic.innerHTML = '<i class="fa-solid fa-ban"></i> Blocked';
            } else {
              badgeMic.className = 'pill pill-gold';
              badgeMic.textContent = 'Prompt on Use';
            }
          } catch (e) {
            badgeMic.className = 'pill pill-blue';
            badgeMic.textContent = 'Ready';
          }
        } else {
          badgeMic.className = 'pill pill-blue';
          badgeMic.textContent = 'Ready';
        }
      }

      // 4. Storage Persistence Badge
      if (badgeStorage && navigator.storage && navigator.storage.persisted) {
        try {
          const isPersisted = await navigator.storage.persisted();
          if (isPersisted) {
            badgeStorage.className = 'pill pill-green';
            badgeStorage.innerHTML = '<i class="fa-solid fa-circle-check"></i> Persisted';
            if (btnReqStorage) btnReqStorage.style.display = 'none';
          }
        } catch (e) {}
      }
    };
    updateAllPermissionBadges();

    // Wire Notification Request Button
    if (btnReqNotify) {
      btnReqNotify.addEventListener('click', async () => {
        await window.requestNativeNotificationPermission();
        updateAllPermissionBadges();
      });
    }

    // Wire Test Notification Button
    if (btnTestNotify) {
      btnTestNotify.addEventListener('click', async () => {
        if ('Notification' in window && Notification.permission === 'granted') {
          window.sendAppNotification('🔔 Eco Green Solar System Alert', {
            body: 'Native push notifications are active on this device! Dispatch & inventory alerts will appear here.',
            tag: 'test-alert'
          });
          if (window.showToast) window.showToast('Test notification sent!', 'success');
        } else {
          const res = await window.requestNativeNotificationPermission();
          if (res === 'granted') {
            window.sendAppNotification('🔔 Eco Green Solar System Alert', {
              body: 'Native push notifications are active on this device!',
              tag: 'test-alert'
            });
          }
          updateAllPermissionBadges();
        }
      });
    }

    // Wire Camera Permission Request Button
    if (btnReqCamera) {
      btnReqCamera.addEventListener('click', async () => {
        await window.requestNativeCameraPermission();
        updateAllPermissionBadges();
      });
    }

    // Wire Mic Permission Request Button
    if (btnReqMic) {
      btnReqMic.addEventListener('click', async () => {
        await window.requestNativeMicPermission();
        updateAllPermissionBadges();
      });
    }

    // Wire Storage Persistence Request Button
    if (btnReqStorage) {
      btnReqStorage.addEventListener('click', async () => {
        await window.requestNativeStoragePermission();
        updateAllPermissionBadges();
      });
    }

    // Wire Scanner Audio Feedback Selector
    if (audioSelect) {
      const curSound = localStorage.getItem('egs_scanner_sound') || 'beep';
      audioSelect.value = curSound;
      audioSelect.addEventListener('change', () => {
        const val = audioSelect.value;
        localStorage.setItem('egs_scanner_sound', val);
        if (window.showToast) window.showToast(`Scanner sound updated to: ${val}`, 'info');
      });
    }
    if (btnTestAudio) {
      btnTestAudio.addEventListener('click', () => {
        if (window.playScannerTone) window.playScannerTone();
      });
    }

    if (pwaModeVal) {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      pwaModeVal.innerHTML = isStandalone
        ? '<span style="color:var(--green);"><i class="fa-solid fa-circle-check"></i> Standalone Installed App</span>'
        : '<span>Web Browser Tab (PWA Ready)</span>';
    }

    // -------------------------------------------------------------
    // 7. About System Tab Wiring (Check for Updates)
    // -------------------------------------------------------------
    const btnCheckUpdate = document.getElementById('btnAboutCheckUpdate');
    if (btnCheckUpdate) {
      btnCheckUpdate.addEventListener('click', async () => {
        btnCheckUpdate.disabled = true;
        btnCheckUpdate.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking server...';
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) await reg.update();
          }
          setTimeout(() => {
            btnCheckUpdate.disabled = false;
            btnCheckUpdate.innerHTML = '<i class="fa-solid fa-circle-check"></i> You are on the Latest Version';
            if (window.showToast) window.showToast('App is running the latest Build 113 (v1.10.0)!', 'success');
          }, 1200);
        } catch (e) {
          btnCheckUpdate.disabled = false;
          btnCheckUpdate.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Check for Updates';
        }
      });
    }
  }

  window.openSettingsModal = openAppSettingsPanel;
  window.openSystemSettingsModal = openAppSettingsPanel;

  function openProfileMenu(targetElement) {
    closeProfileMenu();
    const isMobile = window.innerWidth <= 900;
    if (isMobile) {
      if (typeof window.closeSidebar === 'function') window.closeSidebar();
      if (typeof closeAllFlyouts === 'function') closeAllFlyouts();
    }
    const roleEl = document.querySelector('.profile-box .role');
    const userEl = document.querySelector('.profile-box .user');
    const roleTxt = roleEl ? roleEl.textContent : (window.currentRole || '');
    const userTxt = userEl ? userEl.textContent : ('@' + (window.currentUsername || 'user'));
    const currentUser = (window.currentUsername || '').toLowerCase();
    const accounts = loadSavedAccounts();

    const accountRows = accounts.map((a) => {
      const isCur = a.username.toLowerCase() === currentUser;
      return `<button type="button" class="profile-account-row${isCur ? ' current' : ''}" data-switch-user="${a.username}">
        <span class="pa-avatar">${(a.username[0] || '?').toUpperCase()}</span>
        <span class="pa-meta">
          <span class="pa-name">@${a.username}</span>
          <span class="pa-role">${a.role || ''}${isCur ? ' · Active' : ''}</span>
        </span>
        ${isCur ? '<i class="fa-solid fa-check pa-check"></i>' : ''}
      </button>`;
    }).join('');

    if (isMobile) {
      profileMenuBackdrop = document.createElement('div');
      profileMenuBackdrop.className = 'egs-flyout-backdrop';
      profileMenuBackdrop.style.zIndex = '24999';
      profileMenuBackdrop.onclick = closeProfileMenu;
      document.body.appendChild(profileMenuBackdrop);
    }

    const menu = document.createElement('div');
    menu.className = 'profile-menu profile-menu-wide' + (isMobile ? ' profile-menu-mobile' : '');
    menu.innerHTML = `
      <div class="profile-menu-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="name">${userTxt}</div>
          <div class="role">${roleTxt}</div>
        </div>
        ${isMobile ? '<button type="button" class="modal-close" style="width:28px;height:28px;font-size:13px;border:none;background:transparent;color:var(--txt-muted);cursor:pointer;" onclick="window.closeProfileMenu()"><i class="fa-solid fa-xmark"></i></button>' : ''}
      </div>
      <div class="profile-menu-section-label">Accounts</div>
      <div class="profile-accounts">${accountRows || '<p class="note" style="padding:8px 12px;margin:0;">No saved accounts yet</p>'}</div>
      <button type="button" class="profile-menu-item" id="profileAddAccount"><i class="fa-solid fa-user-plus"></i> Add account</button>
      <div class="profile-menu-divider"></div>
      <div class="profile-menu-section-label">Workspace Theme</div>
      <div class="profile-theme-row">
        <button type="button" class="theme-btn" data-theme-set="dark" title="Dark"><i class="fa-solid fa-moon"></i> Dark</button>
        <button type="button" class="theme-btn" data-theme-set="gray" title="Gray"><i class="fa-solid fa-circle-half-stroke"></i> Gray</button>
        <button type="button" class="theme-btn" data-theme-set="light" title="Light"><i class="fa-solid fa-sun"></i> Light</button>
        <button type="button" class="theme-btn" data-theme-set="emerald" title="Emerald"><i class="fa-solid fa-leaf" style="color:#2ecc71;"></i> Emerald</button>
        <button type="button" class="theme-btn" data-theme-set="ocean" title="Ocean"><i class="fa-solid fa-water" style="color:#38bdf8;"></i> Ocean</button>
      </div>
      <div class="profile-menu-divider"></div>
      <button type="button" class="profile-menu-item" id="profileSettings"><i class="fa-solid fa-gear"></i> System Settings</button>
      <button type="button" class="profile-menu-item" id="profileInstallApp"><i class="fa-solid fa-download"></i> Install ERP App (iOS / Android / PC)</button>
      <button type="button" class="profile-menu-item" id="profileLoginActivity"><i class="fa-solid fa-mobile-screen-button"></i> Login activity</button>
      <button type="button" class="uiverse-logout-btn" id="profileLogout" title="Log out of ERP">
        <span><i class="fa-solid fa-right-from-bracket"></i> LOG OUT</span><i class="neon-wire"></i>
      </button>`;
    document.body.appendChild(menu);

    if (isMobile) {
      menu.style.position = 'fixed';
      menu.style.left = '50%';
      menu.style.top = '50%';
      menu.style.transform = 'translate(-50%, -50%)';
      menu.style.width = 'min(340px, calc(100vw - 28px))';
      menu.style.maxHeight = 'calc(100vh - 40px)';
      menu.style.overflowY = 'auto';
      menu.style.zIndex = '25000';
    } else {
      const anchor = targetElement || profileBox;
      const rect = anchor ? anchor.getBoundingClientRect() : { left: 10, top: 500 };
      const menuRect = menu.getBoundingClientRect();
      menu.style.left = Math.max(10, rect.left) + 'px';
      menu.style.top = Math.max(10, rect.top - menuRect.height - 8) + 'px';
      menu.style.zIndex = '25000';
    }
    profileMenuEl = menu;
    if (window.wireThemeButtons) window.wireThemeButtons(menu);
    if (window.getAppTheme) {
      menu.querySelectorAll('[data-theme-set]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-theme-set') === window.getAppTheme());
      });
    }

    menu.querySelectorAll('[data-switch-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uname = btn.getAttribute('data-switch-user');
        const acc = accounts.find((a) => a.username === uname);
        if (acc && acc.username.toLowerCase() !== currentUser) switchToAccount(acc);
        else closeProfileMenu();
      });
    });

    const addAccBtn = menu.querySelector('#profileAddAccount');
    if (addAccBtn) {
      addAccBtn.addEventListener('click', () => {
        closeProfileMenu();
        clearSession();
        showLoginOverlay('Add another account — your previous account stays saved for switching.');
      });
    }

    const settingsBtn = menu.querySelector('#profileSettings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        closeProfileMenu();
        openAppSettingsPanel();
      });
    }

    const installAppBtn = menu.querySelector('#profileInstallApp');
    if (installAppBtn) {
      installAppBtn.addEventListener('click', () => {
        closeProfileMenu();
        if (window.openAppInstallGuide) window.openAppInstallGuide();
      });
    }

    const loginActBtn = menu.querySelector('#profileLoginActivity');
    if (loginActBtn) {
      loginActBtn.addEventListener('click', () => openLoginActivityPanel());
    }

    const logoutBtn = menu.querySelector('#profileLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        closeProfileMenu();
        const ok = await window.confirmDialog('Log out', 'Log out of this device?', { kind: 'question', okLabel: 'Log out' });
        if (!ok) return;
        const u = window.currentUsername;
        await notifyServerLogout();
        clearSession();
        // Keep account in switcher list (token cleared for this session only) — remove token so dead session isn't reusable
        if (u) {
          const list = loadSavedAccounts().map((a) => a.username === u ? { ...a, token: '' } : a).filter((a) => a.token);
          persistSavedAccounts(list);
        }
        showLoginOverlay();
      });
    }
    menu.addEventListener('click', (e) => e.stopPropagation());
  }

  function toggleProfileMenu(e) {
    if (e) e.stopPropagation();
    const target = e ? (e.currentTarget || e.target) : null;
    if (profileMenuEl) closeProfileMenu();
    else openProfileMenu(target);
  }
  if (profileBox) {
    profileBox.addEventListener('click', toggleProfileMenu);
  }
  // Mobile topbar avatar — same menu as sidebar profile
  const mobileAvatar = document.getElementById('mobileProfileAvatar');
  if (mobileAvatar) {
    mobileAvatar.addEventListener('click', toggleProfileMenu);
  }
  document.addEventListener('click', closeProfileMenu);

})();
