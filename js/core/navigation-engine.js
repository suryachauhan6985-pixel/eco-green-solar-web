// js/core/navigation-engine.js
// Shree Sava / Tally Navigation Engine, Flyouts, Ladder History & Keyboard Hotkeys Router

(function () {
function applyErpModeRules() {
  const mode = window.ERP.getMode();
  if (document.body) {
    document.body.setAttribute('data-erp-mode', mode);
    document.body.classList.toggle('erp-mode-quantity-only', window.ERP.isQuantityOnly());
    document.body.classList.toggle('erp-mode-financial-only', window.ERP.isAccountsOnly());
    document.body.classList.toggle('erp-mode-full-accounting', window.ERP.isAccountingMode());
  }
  if (typeof window.renderNavButtons === 'function') {
    window.renderNavButtons();
  }
}
window.applyErpModeRules = applyErpModeRules;

  // =====================================================================
  // SHREE SAVA / TALLY STYLE SIDEBAR NAVIGATION & FLOATING FLYOUT SYSTEM
  // =====================================================================

  function formatHkLabel(text, char) {
    if (!char) return text;
    const idx = text.toLowerCase().indexOf(char.toLowerCase());
    if (idx === -1) return text;
    const match = text.substr(idx, 1);
    return text.substring(0, idx) + `<span class="erp-hk-char">${match}</span>` + text.substring(idx + 1);
  }

  function getErpNavSections() {
    const curRole = (window.currentUserRole || window.CURRENT_USER_ROLE || (window.CURRENT_USER && window.CURRENT_USER.role) || localStorage.getItem('user_role') || 'User').toLowerCase();
    const isSuperAdmin = curRole === 'superadmin' || curRole === 'super_admin';
    const isAdmin = isSuperAdmin || curRole === 'admin';
    const isAcc = window.ERP && window.ERP.isAccountingMode();
    const isFinOnly = window.ERP && window.ERP.isFinancialOnly();
    const isQtyOnly = window.ERP && window.ERP.isQuantityOnly();

    const sections = [];

    // 1. OVERVIEW
    sections.push({
      title: 'OVERVIEW',
      items: [
        {
          id: 'dashboard',
          name: 'Dashboard',
          hotkey: 'G',
          icon: 'fa-house-chimney',
          page: 'dashboard',
          color: '#38bdf8',
          bg: 'rgba(56, 189, 248, 0.12)'
        }
      ]
    });

    // 2. MASTERS & ACCOUNTS
    const masterItems = [
      {
        id: 'partyledger_disp',
        name: 'Party Ledger & Statements',
        hotkey: 'L',
        icon: 'fa-address-book',
        page: 'partyledger',
        action: 'display',
        color: '#34d399',
        bg: 'rgba(52, 211, 153, 0.12)'
      },
      {
        id: 'partyledger_create',
        name: 'Create Account / Ledger',
        hotkey: 'C',
        icon: 'fa-user-plus',
        page: 'partyledger',
        action: 'create',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)'
      }
    ];

    if (!isFinOnly) {
      masterItems.push(
        {
          id: 'item_master',
          name: 'Item & Product Master',
          hotkey: 'I',
          icon: 'fa-boxes-stacked',
          page: 'masters',
          sub: 'item-reg',
          action: 'display',
          color: '#fbbf24',
          bg: 'rgba(251, 191, 36, 0.12)'
        },
        {
          id: 'item_create',
          name: 'Create Item / Product',
          hotkey: 'J',
          icon: 'fa-box-open',
          page: 'masters',
          sub: 'item-reg',
          action: 'create',
          color: '#f97316',
          bg: 'rgba(249, 115, 22, 0.12)'
        },
        {
          id: 'categories',
          name: 'Group / Category Master',
          hotkey: 'M',
          icon: 'fa-layer-group',
          page: 'masters',
          sub: 'category',
          color: '#f43f5e',
          bg: 'rgba(251, 113, 133, 0.12)'
        },
        {
          id: 'uom',
          name: 'Unit of Measure (UOM)',
          hotkey: 'U',
          icon: 'fa-ruler-combined',
          page: 'masters',
          sub: 'uom',
          color: '#38bdf8',
          bg: 'rgba(56, 189, 248, 0.12)'
        }
      );

      if (window.ERP && window.ERP.isWarehouseEnabled()) {
        masterItems.push({
          id: 'warehouses',
          name: 'Warehouse & Godown Master',
          hotkey: 'W',
          icon: 'fa-warehouse',
          page: 'masters',
          sub: 'warehouse',
          color: '#c084fc',
          bg: 'rgba(192, 132, 252, 0.12)'
        });
      }

      masterItems.push({
        id: 'brands',
        name: 'Brand Directory',
        hotkey: 'B',
        icon: 'fa-tags',
        page: 'masters',
        sub: 'brand',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.12)'
      });
    }

    sections.push({
      title: 'MASTERS & ACCOUNTS',
      items: masterItems
    });

    // 3. OPERATIONS & INVENTORY
    const opItems = [];
    if (!isFinOnly) {
      opItems.push(
        {
          id: 'purchase',
          name: 'Purchase Inward (Stock In)',
          hotkey: 'P',
          icon: 'fa-truck-ramp-box',
          page: 'purchase',
          color: '#818cf8',
          bg: 'rgba(129, 140, 248, 0.12)'
        },
        {
          id: 'sales',
          name: 'Project Sales & Dispatch',
          hotkey: 'S',
          icon: 'fa-handshake',
          page: 'sales',
          color: '#60a5fa',
          bg: 'rgba(96, 165, 250, 0.12)'
        }
      );

      if (window.ERP && window.ERP.isBomEnabled()) {
        opItems.push({
          id: 'bom',
          name: 'Solar BOM & Kit Challans',
          hotkey: 'O',
          icon: 'fa-solar-panel',
          page: 'bom',
          action: 'dispatch',
          badge: 'Solar',
          color: '#fb923c',
          bg: 'rgba(251, 146, 60, 0.12)'
        });
      }

      opItems.push(
        {
          id: 'stockassign',
          name: 'Stock Allocation & Journal',
          hotkey: 'A',
          icon: 'fa-tag',
          page: 'stockassign',
          color: '#f472b6',
          bg: 'rgba(244, 114, 182, 0.12)'
        },
        {
          id: 'returns',
          name: 'Sales Return & Damage',
          hotkey: 'R',
          icon: 'fa-arrow-rotate-left',
          page: 'returns',
          color: '#f87171',
          bg: 'rgba(248, 113, 113, 0.12)'
        }
      );

      if (!isQtyOnly) {
        opItems.push({
          id: 'scansheet',
          name: 'Serial Number Scan Sheet',
          hotkey: 'N',
          icon: 'fa-barcode',
          page: 'scansheet',
          color: '#38bdf8',
          bg: 'rgba(56, 189, 248, 0.12)'
        });
      }
    }

    if (isAcc) {
      opItems.push({
        id: 'vouchers',
        name: 'Accounting Vouchers',
        hotkey: 'V',
        icon: 'fa-receipt',
        page: 'vouchers',
        action: 'Payment',
        color: '#2dd4bf',
        bg: 'rgba(45, 212, 191, 0.12)'
      });
    }

    sections.push({
      title: 'OPERATIONS & INVENTORY',
      items: opItems
    });

    // 4. REGISTERS & REPORTS
    const reportItems = [
      {
        id: 'purchaseregister',
        name: 'Purchase Register',
        hotkey: 'E',
        icon: 'fa-cart-shopping',
        page: 'purchaseregister',
        color: '#facc15',
        bg: 'rgba(250, 204, 21, 0.12)'
      },
      {
        id: 'saleregister',
        name: 'Sale Register',
        hotkey: 'Y',
        icon: 'fa-money-bill-transfer',
        page: 'saleregister',
        color: '#fbbf24',
        bg: 'rgba(251, 191, 36, 0.12)'
      }
    ];

    if (!isFinOnly) {
      reportItems.push(
        {
          id: 'reports',
          name: 'Master Inventory Report',
          hotkey: 'H',
          icon: 'fa-chart-pie',
          page: 'reports',
          color: '#a3e635',
          bg: 'rgba(163, 230, 53, 0.12)'
        },
        {
          id: 'lowstock',
          name: 'Low Stock Alert',
          hotkey: 'Q',
          icon: 'fa-triangle-exclamation',
          page: 'lowstock',
          color: '#fb923c',
          bg: 'rgba(251, 146, 60, 0.12)'
        }
      );

      if (window.ERP && window.ERP.isBomEnabled()) {
        reportItems.push(
          {
            id: 'bom_register',
            name: 'BOM Dispatch Register',
            hotkey: 'B',
            icon: 'fa-clipboard-list',
            page: 'bom',
            action: 'register',
            color: '#38bdf8',
            bg: 'rgba(56, 189, 248, 0.12)'
          },
          {
            id: 'bom_challan',
            name: 'Delivery Challans Register',
            hotkey: 'C',
            icon: 'fa-file-invoice',
            page: 'bom',
            action: 'challan',
            color: '#06b6d4',
            bg: 'rgba(6, 182, 212, 0.12)'
          }
        );
      }
    }

    if (isAcc) {
      reportItems.push({
        id: 'financialreports',
        name: 'Financial Statements',
        hotkey: 'F',
        icon: 'fa-scale-balanced',
        page: 'financialreports',
        tab: 'trial-balance',
        color: '#34d399',
        bg: 'rgba(52, 211, 153, 0.12)'
      });
    }

    sections.push({
      title: 'REGISTERS & REPORTS',
      items: reportItems
    });

    // 5. UTILITIES & SETUP
    const utilityItems = [
      {
        id: 'erp_settings',
        name: 'ERP Mode & Features',
        hotkey: 'T',
        icon: 'fa-sliders',
        action: 'openSettings',
        sub: 'tab-erp-mode',
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.12)'
      },
      {
        id: 'users',
        name: 'User Accounts & Roles',
        hotkey: 'K',
        icon: 'fa-users-gear',
        action: 'openSettings',
        sub: 'tab-users',
        color: '#a78bfa',
        bg: 'rgba(167, 139, 250, 0.12)'
      },
      {
        id: 'backup',
        name: 'Backup & Restore',
        hotkey: 'Z',
        icon: 'fa-cloud-arrow-up',
        page: 'backup',
        color: '#60a5fa',
        bg: 'rgba(96, 165, 250, 0.12)'
      },
      {
        id: 'template_designer',
        name: 'Print Template Designer',
        hotkey: 'D',
        icon: 'fa-compass-drafting',
        page: 'template_designer',
        color: '#e879f9',
        bg: 'rgba(232, 121, 249, 0.12)'
      }
    ];

    if (isSuperAdmin) {
      utilityItems.push({
        id: 'saas_tenants',
        name: 'SaaS White-Label Studio',
        hotkey: 'X',
        icon: 'fa-building-shield',
        page: 'saas_tenants',
        color: '#22d3ee',
        bg: 'rgba(34, 211, 238, 0.12)'
      });
    }

    sections.push({
      title: 'UTILITIES & SETUP',
      items: utilityItems
    });

    return sections;
  }

  // Compatibility stubs
  function closeAllFlyouts() {}
  function openSidebarFlyout() {}
  function clearFlyoutTrail() {}
  function recordFlyoutTrail() {}
  function stepBackFromFlyoutTrail() {
    if (typeof go === 'function') go('dashboard');
  }

  window.closeSidebarFlyout = closeAllFlyouts;
  window.closeAllFlyouts = closeAllFlyouts;
  window.openSidebarFlyout = openSidebarFlyout;
  window.clearFlyoutTrail = clearFlyoutTrail;
  window.recordFlyoutTrail = recordFlyoutTrail;
  window.stepBackFromFlyoutTrail = stepBackFromFlyoutTrail;

  function renderNavButtons() {
    const navEl = document.getElementById('navScroll') || document.querySelector('.nav-scroll');
    if (!navEl) return;
    navEl.innerHTML = '';

    const sections = getErpNavSections();

    sections.forEach((sec) => {
      if (!sec.items || sec.items.length === 0) return;

      const secHeader = document.createElement('div');
      secHeader.className = 'erp-nav-section-title';
      secHeader.innerHTML = `
        <span>${sec.title}</span>
        <span class="section-divider-line"></span>
      `;
      navEl.appendChild(secHeader);

      sec.items.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'erp-nav-item';
        btn.id = 'btnNav_' + item.id;
        btn.dataset.tab = item.id;
        btn.dataset.page = item.page || '';
        btn.dataset.sub = item.sub || item.tab || '';
        btn.dataset.action = item.action || '';
        btn.dataset.filter = item.filter || '';
        btn.dataset.hotkey = item.hotkey || '';

        const badgeStyle = `color:${item.color || '#38bdf8'}; background:${item.bg || 'rgba(56,189,248,0.12)'}; border: 1px solid ${item.color ? item.color + '33' : 'rgba(56,189,248,0.2)'};`;

        btn.innerHTML = `
          <span class="nav-icon-badge" style="${badgeStyle}">
            <i class="fa-solid ${item.icon || 'fa-circle-dot'}"></i>
          </span>
          <span class="nav-text">${formatHkLabel(item.name, item.hotkey)}</span>
          ${item.badge ? `<span class="nav-pill-badge">${item.badge}</span>` : ''}
          ${item.hotkey ? `<span class="nav-hk-keycap">${item.hotkey}</span>` : ''}
          <span class="nav-active-glow"></span>
        `;

        btn.onclick = (e) => {
          e.stopPropagation();
          if (window.innerWidth <= 900 && typeof window.closeSidebar === 'function') {
            window.closeSidebar();
          }
          if (item.action === 'openSettings' && typeof window.openSystemSettingsModal === 'function') {
            window.openSystemSettingsModal(item.sub || 'tab-erp-mode');
          } else if (item.page) {
            go(item.page, { sub: item.sub || item.tab, action: item.action, filter: item.filter });
          }
        };

        navEl.appendChild(btn);
      });
    });

    // Sync active state with currently open page
    updateSidebarActiveState(window.CURRENT_PAGE_ID || 'dashboard', window.CURRENT_PAGE_OPTS || {});

    // Wire Brand Logo for direct Dashboard Teleportation
    document.querySelectorAll('.brand, .brand-inner, .brand-card, .mobile-topbar .brand').forEach((el) => {
      el.style.cursor = 'pointer';
      el.onclick = (e) => {
        e.stopPropagation();
        if (window.innerWidth <= 900 && typeof window.closeSidebar === 'function') {
          window.closeSidebar();
        }
        go('dashboard');
      };
    });
  }
  window.renderNavButtons = renderNavButtons;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNavButtons);
  } else {
    renderNavButtons();
  }

  // =========================================================================
  // ERP WORKSPACE METADATA & SCREEN LIFECYCLE ROUTER
  // =========================================================================
  const WORKSPACE_METADATA = {
    'dashboard': { name: 'Dashboard', sub: 'Live overview of stock & operations', icon: 'fa-house-chimney' },
    'masters:item-create': { name: 'Item Master Registration', sub: 'Create new product profile and parameters', icon: 'fa-box-open' },
    'masters:item-reg': { name: 'Item & Product Master', sub: 'Registered product catalog & specifications', icon: 'fa-boxes-stacked' },
    'masters:item-catalog': { name: 'Item Catalog Directory', sub: 'View, search & manage registered products', icon: 'fa-table-list' },
    'masters:category': { name: 'Group & Category Master', sub: 'Manage categories, wattage & serial rules', icon: 'fa-layer-group' },
    'masters:warehouse': { name: 'Warehouse & Godown Master', sub: 'Manage inventory storage locations', icon: 'fa-warehouse' },
    'masters:uom': { name: 'Units of Measure (UOM)', sub: 'Configure standard measurement units', icon: 'fa-ruler-combined' },
    'masters:brand': { name: 'Brand Directory', sub: 'Registered solar and electrical equipment brands', icon: 'fa-tags' },
    'masters:users': { name: 'User Accounts & Access', sub: 'Manage ERP system operators and security', icon: 'fa-user-shield' },
    'partyledger': { name: 'Party Ledger Statement', sub: 'Account statements, debit/credit ledger & transactions', icon: 'fa-money-check-dollar' },
    'partyledger:create': { name: 'Create Account / Ledger', sub: 'Add new customer, supplier, bank or expense account', icon: 'fa-user-plus' },
    'partyledger:display': { name: 'Party Ledger Directory', sub: 'Search ledgers, view statements & balances', icon: 'fa-address-book' },
    'partyledger:alter': { name: 'Alter Account Profile', sub: 'Modify party details, GSTIN & contact info', icon: 'fa-user-pen' },
    'partyledger:customers': { name: 'Customer Accounts Directory', sub: 'Filter and manage customer ledgers & receivables', icon: 'fa-hand-holding-dollar' },
    'partyledger:suppliers': { name: 'Supplier Accounts Directory', sub: 'Filter and manage supplier ledgers & payables', icon: 'fa-truck-ramp-box' },
    'vouchers': { name: 'Accounting Vouchers', sub: 'Double-entry financial voucher system', icon: 'fa-money-bill-transfer' },
    'vouchers:Payment': { name: 'Payment Voucher (F5)', sub: 'Record supplier payments & bank transfers', icon: 'fa-arrow-up-from-bracket' },
    'vouchers:Receipt': { name: 'Receipt Voucher (F6)', sub: 'Record customer receipts & incoming payments', icon: 'fa-arrow-down-to-bracket' },
    'vouchers:Journal': { name: 'Journal Voucher (F7)', sub: 'Record double-entry ledger adjustments', icon: 'fa-scale-balanced' },
    'vouchers:DebitNote': { name: 'Debit Note (Alt+F5)', sub: 'Record purchase returns and debit adjustments', icon: 'fa-file-circle-minus' },
    'vouchers:CreditNote': { name: 'Credit Note (Alt+F6)', sub: 'Record sales returns and credit adjustments', icon: 'fa-file-circle-plus' },
    'financialreports': { name: 'Financial Statements', sub: 'Trial Balance, Profit & Loss, Balance Sheet & Day Book', icon: 'fa-scale-balanced' },
    'financialreports:trial-balance': { name: 'Trial Balance Statement', sub: 'Trial balance ledger closing balances', icon: 'fa-list-ol' },
    'financialreports:profit-loss': { name: 'Profit & Loss Account', sub: 'Statement of income, expenses & gross profit', icon: 'fa-chart-line' },
    'financialreports:balance-sheet': { name: 'Balance Sheet Statement', sub: 'Statement of capital, assets & liabilities', icon: 'fa-building-columns' },
    'financialreports:day-book': { name: 'Day Book Journal', sub: 'Chronological daily financial journal & vouchers', icon: 'fa-calendar-day' },
    'purchase': { name: 'Purchase Inward', sub: 'Inward stock receipt, batch & invoice entry', icon: 'fa-truck-ramp-box' },
    'purchaseregister': { name: 'Purchase Register', sub: 'Inward purchase records & tax invoice archive', icon: 'fa-cart-shopping' },
    'sales': { name: 'Project Sales & Dispatch', sub: 'Sales outward, serial assignment & delivery', icon: 'fa-handshake' },
    'saleregister': { name: 'Sale Register', sub: 'Project sales records & dispatch log archive', icon: 'fa-money-bill-transfer' },
    'bom': { name: 'Bill of Material (BOM)', sub: 'Kit assembly, serial allocation & delivery challans', icon: 'fa-list-check' },
    'bom:create': { name: 'BOM Kit Assembly & Creation', sub: 'Assemble kits, verify components & configure BOM', icon: 'fa-boxes-packing' },
    'bom:dispatch': { name: 'BOM Order Dispatch & Processing', sub: 'Process pending dispatches, scan serials & continue orders', icon: 'fa-truck-fast' },
    'bom:register': { name: 'BOM Dispatch Register', sub: 'Saved BOM orders and dispatch history', icon: 'fa-clipboard-list' },
    'bom:challan': { name: 'Delivery Challans Register', sub: 'Saved delivery challans and reprint center', icon: 'fa-file-invoice' },
    'bom:custom-challan': { name: 'Custom Delivery Challan', sub: 'Direct custom delivery challan entry form', icon: 'fa-pen-nib' },
    'bom:track': { name: 'Track BOM Order Progress', sub: 'Real-time BOM order telemetry & delivery status', icon: 'fa-route' },
    'stockassign': { name: 'Stock Allocation & Journal', sub: 'Godown reservation & release to firm/customer', icon: 'fa-warehouse' },
    'returns': { name: 'Sales Return & Damage', sub: 'Process sales returns, damaged & scrapped stock', icon: 'fa-arrow-rotate-left' },
    'scansheet': { name: 'Serial Number Scan Sheet', sub: 'Barcode scanner & serial sheets manager', icon: 'fa-barcode' },
    'reports': { name: 'Master Inventory Report', sub: 'Real-time godown stock summary & inventory explorer', icon: 'fa-clipboard-list' },
    'lowstock': { name: 'Low Stock Alert', sub: 'Items at or below reorder safety threshold', icon: 'fa-triangle-exclamation' },
    'backup': { name: 'Backup & Restore Hub', sub: 'Cloud & local database archives & point-in-time recovery', icon: 'fa-cloud-arrow-up' },
    'saas_tenants': { name: 'SaaS Tenant & White-Label Studio', sub: 'Multi-tenant organization management & dynamic theming', icon: 'fa-building-shield' },
    'template_designer': { name: 'Print Template Designer Studio', sub: 'Visual Excel-style document layout builder & 1-page fit scaling', icon: 'fa-compass-drafting' }
  };

  window.__activeScreenCleanup = null;
  function cleanupActiveScreen() {
    if (typeof window.__activeScreenCleanup === 'function') {
      try {
        window.__activeScreenCleanup();
      } catch (e) {
        console.warn('Screen cleanup error:', e);
      }
      window.__activeScreenCleanup = null;
    }
  }
  window.cleanupActiveScreen = cleanupActiveScreen;

  function parseRouteHash(rawHash) {
    const clean = String(rawHash || '').replace(/^#\/?/, '').trim();
    if (!clean) return { id: 'dashboard', opts: {} };
    const parts = clean.split(':');
    const id = parts[0] || 'dashboard';
    const sub = parts[1] || '';
    const action = parts[2] || parts[1] || '';
    const filter = parts[3] || '';
    return { id, opts: { sub, action, filter, tab: sub } };
  }
  window.parseRouteHash = parseRouteHash;

  function updateSidebarActiveState(pageId, opts = {}) {
    const navItems = document.querySelectorAll('.erp-nav-item');
    if (!navItems.length) return;

    navItems.forEach((b) => b.classList.remove('active'));

    const action = opts.action || opts.tab || opts.sub || '';
    const sub = opts.sub || opts.tab || '';

    // Handle dashboard directly
    if (pageId === 'dashboard') {
      const dashBtn = document.querySelector('.erp-nav-item[data-tab="dashboard"]') || document.getElementById('btnNav_dashboard');
      if (dashBtn) dashBtn.classList.add('active');
      return;
    }

    let bestMatch = null;
    let fallbackMatch = null;

    navItems.forEach((btn) => {
      if (btn.dataset.page === pageId) {
        if (!fallbackMatch) fallbackMatch = btn;
        const itemAction = btn.dataset.action || '';
        const itemSub = btn.dataset.sub || '';
        const itemTab = btn.dataset.tab || '';

        if (action && (itemAction === action || itemSub === sub || itemSub === action || itemTab === action)) {
          bestMatch = btn;
        } else if (sub && (itemSub === sub || itemAction === sub || itemTab === sub)) {
          bestMatch = btn;
        }
      }
    });

    const activeItem = bestMatch || fallbackMatch;
    if (activeItem) {
      activeItem.classList.add('active');
    }
  }
  window.updateSidebarActiveState = updateSidebarActiveState;

  function go(id, opts = {}, pushHistory = true) {
    if (typeof id === 'string' && id.includes(':')) {
      const parsed = parseRouteHash(id);
      id = parsed.id;
      opts = Object.assign({}, parsed.opts, opts);
    }

    const page = window.PAGES[id];
    if (!page) return;

    // Clean up previous active workspace
    cleanupActiveScreen();

    closeAllFlyouts(true);
    if (window.innerWidth <= 900 && typeof window.closeSidebar === 'function') {
      window.closeSidebar();
    }

    window.CURRENT_PAGE_ID = id;
    window.CURRENT_PAGE_OPTS = Object.assign({}, opts);

    const contentEl = document.getElementById('content') || content;
    const pageTitleEl = document.getElementById('pageTitle') || pageTitle;
    const pageSubEl = document.getElementById('pageSub') || pageSub;

    // Resolve workspace key and metadata
    const subKey = opts.sub || opts.tab || opts.action || '';
    const workspaceKey = subKey ? `${id}:${subKey}` : id;
    const meta = WORKSPACE_METADATA[workspaceKey] || WORKSPACE_METADATA[id] || { name: page.name, sub: page.sub, icon: page.icon };

    if (contentEl) {
      contentEl.innerHTML = (typeof page.render === 'function' ? page.render(opts) : page.html) || '';
      requestAnimationFrame(() => {
        contentEl.classList.add('page-entering');
      });
      if (typeof window.egsInitDatePickers === 'function') window.egsInitDatePickers(contentEl);
      if (typeof window.egsInitAutocompletes === 'function') window.egsInitAutocompletes(contentEl);
    }

    if (pageTitleEl) pageTitleEl.textContent = meta.name || page.name || 'Dashboard';
    if (pageSubEl) pageSubEl.textContent = meta.sub || page.sub || '';
    if (window.topbarExtra) window.topbarExtra.innerHTML = '';

    // Mark active sidebar parent group or single item strictly
    updateSidebarActiveState(id, opts);

    if (typeof page.init === 'function') {
      try {
        page.init(opts);
      } catch (err) {
        console.error(`Error initializing page "${id}":`, err);
      }
    }

    if (opts.tab || opts.sub || opts.action || opts.filter) {
      setTimeout(() => {
        const subKey = opts.sub || opts.tab;
        if (subKey) {
          const subTabBtn = document.querySelector(
            `#mastersSubtabs [data-sub="${subKey}"], .subtabs [data-sub="${subKey}"], [data-tab="${subKey}"], #${subKey}`
          );
          if (subTabBtn) {
            subTabBtn.click();
          }
        }

        // BOM specific view switching
        if (id === 'bom') {
          if (opts.action === 'create' || opts.tab === 'create') {
            const btn = document.getElementById('bomHomeBtnCreate');
            if (btn) btn.click();
          } else if (opts.action === 'track' || opts.tab === 'track') {
            const btn = document.getElementById('bomHomeBtnTrack');
            if (btn) btn.click();
          } else if (opts.action === 'register' || opts.tab === 'register') {
            const btn = document.getElementById('bomHomeBtnRegister');
            if (btn) btn.click();
          } else if (opts.action === 'challan' || opts.tab === 'challan') {
            const btn = document.getElementById('bomHomeBtnChallanReg');
            if (btn) btn.click();
          } else if (opts.action === 'custom-challan' || opts.tab === 'custom-challan') {
            const btn = document.getElementById('bomHomeBtnCustomChallan');
            if (btn) btn.click();
          }
        }

        // Party Ledger filter & action switching
        if (id === 'partyledger') {
          if (opts.filter) {
            const typeFilter = document.getElementById('plTypeFilter');
            if (typeFilter) {
              typeFilter.value = opts.filter;
              typeFilter.dispatchEvent(new Event('change'));
            }
          }
          if (typeof window.setPartyLedgerMode === 'function') {
            window.setPartyLedgerMode(opts.action || 'display');
          }
        }

        // Masters actions switching
        if (id === 'masters') {
          if (opts.action && typeof window.setMasterViewMode === 'function') {
            window.setMasterViewMode(opts.action);
          }
          if (opts.action === 'create') {
            if (subKey === 'category') {
              const catInp = document.getElementById('mInputCatName');
              if (catInp) catInp.focus();
            } else if (subKey === 'uom') {
              const uomInp = document.getElementById('mInputUomName');
              if (uomInp) uomInp.focus();
            } else if (subKey === 'warehouse') {
              const whInp = document.getElementById('mInputWhName');
              if (whInp) whInp.focus();
            }
          }
        }

        // Vouchers Fast-switch
        if (id === 'vouchers') {
          if (opts.action && typeof window.setVoucherTypeMode === 'function') {
            window.setVoucherTypeMode(opts.action);
          }
        }

        // Financial Reports Fast-switch
        if (id === 'financialreports') {
          if (opts.tab) {
            const tabBtn = document.querySelector(`#finReportTabs .subtab[data-tab="${opts.tab}"]`);
            if (tabBtn) tabBtn.click();
          }
        }
      }, 70);
    }

    const searchVal = (typeof window.getCurrentTableSearchQuery === 'function')
      ? window.getCurrentTableSearchQuery()
      : (typeof currentSearchQuery !== 'undefined' ? currentSearchQuery : '');
    if (typeof window.applyGlobalTableSearch === 'function') {
      window.applyGlobalTableSearch(searchVal);
    } else if (typeof applyGlobalTableSearch === 'function') {
      applyGlobalTableSearch(searchVal);
    }

    if (typeof closeSidebar === 'function') closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      if (contentEl) contentEl.classList.remove('page-entering');
    }, 400);

    try {
      const newHash = workspaceKey ? `#${workspaceKey}` : `#${id}`;
      if (window.location.hash !== newHash) {
        if (pushHistory) {
          history.pushState({ id, opts }, '', newHash);
        } else {
          history.replaceState({ id, opts }, '', newHash);
        }
      }
    } catch (e) {}
  }

  window.goPage = go;
  window.navigateToPage = go;
  window.renderNavButtons = renderNavButtons;

  // =========================================================================
  // SHREE SAVA / TALLY KEYBOARD HOTKEY & ARROW ROUTER
  // =========================================================================
  function handleAccountingKeyboard(e) {
    if (e.repeat) return false;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);

    // ESCAPE KEY: UNIVERSAL STEP-BY-STEP EXIT & BACK ENGINE (Tally / Shree Sava Standard)
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();

      // Step 1: If typing in any input/textarea/select, blur it immediately so focus returns to the page root!
      if (isTyping && document.activeElement) {
        document.activeElement.blur();
        if (e.target && (e.target.id === 'egsQuickSearch' || e.target.id === 'egsQuickSearchMobile')) {
          e.target.value = '';
          applyGlobalTableSearch('');
        }
      }

      // Step 2: If any Modal / Overlay / Statement / Popup is open, close it FIRST!
      const modalOverlay = document.getElementById('modalOverlay');
      if (modalOverlay && modalOverlay.classList.contains('show')) {
        window.closeModal();
        return true;
      }
      const popupOverlay = document.getElementById('egsPopupOverlay');
      if (popupOverlay && popupOverlay.classList.contains('show')) {
        popupOverlay.classList.remove('show');
        return true;
      }
      const stOverlay = document.getElementById('statementOverlay');
      if (stOverlay && stOverlay.classList.contains('show')) {
        const stmtBack = document.getElementById('stmtBack');
        if (stmtBack && stmtBack.style.display !== 'none') {
          stmtBack.click();
        } else {
          const closeStmt = document.getElementById('closeStatement');
          if (closeStmt) closeStmt.click();
        }
        return true;
      }
      const lfOverlay = document.getElementById('ledgerFormOverlay');
      if (lfOverlay && lfOverlay.classList.contains('show')) {
        const closeLf = document.getElementById('closeLedgerForm') || document.getElementById('lfCancel');
        if (closeLf) closeLf.click();
        return true;
      }
      const bomChallanOverlay = document.getElementById('bomChallanOverlay');
      if (bomChallanOverlay && bomChallanOverlay.classList.contains('show')) {
        const closeBtn = document.getElementById('bomChallanCloseBtn');
        if (closeBtn) closeBtn.click();
        return true;
      }
      const bomRegisterOverlay = document.getElementById('bomRegisterOverlay');
      if (bomRegisterOverlay && bomRegisterOverlay.classList.contains('show')) {
        const closeBtn = document.getElementById('bomRegisterCloseBtn');
        if (closeBtn) closeBtn.click();
        return true;
      }
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        window.closeSidebar();
        return true;
      }
      const filterMenu = document.querySelector('.th-filter-menu');
      if (filterMenu) {
        filterMenu.remove();
        return true;
      }

      // Step 3: If in inline continue dispatch order, step back to BOM pending list
      const bomContinuePanel = document.getElementById('bomContinuePanel');
      if (bomContinuePanel && bomContinuePanel.style.display !== 'none') {
        const bomBtnBackHome = document.getElementById('bomBtnBackHome');
        if (bomBtnBackHome) {
          bomBtnBackHome.click();
          return true;
        }
      }

      // Step 4: If any flyout menu is open on screen, step down flyout tiers
      const activeFlyout = document.getElementById('egsActiveSidebarFlyout');
      if (activeFlyout) {
        const nestedOpenEl = activeFlyout.querySelector('.egs-flyout-item.has-nested.nested-open');
        if (nestedOpenEl) {
          suppressHoverUntilMouseMove = true;
          setNestedSubmenuOpen(null, false);
          navState.focusTier = 'flyout_tier1';
          navState.tier2Index = -1;
          if (navState.tier1Index >= 0) {
            updateTier1Selection(navState.tier1Index, false);
          }
          return true;
        }

        closeAllFlyouts(false); // Cleanly closes Tier 1 and returns focus to Sidebar / Dashboard
        return true;
      }

      // Step 5: If on ANY non-dashboard page, step back via ladder history to originating flyout / dashboard!
      if (window.CURRENT_PAGE_ID && window.CURRENT_PAGE_ID !== 'dashboard') {
        stepBackFromFlyoutTrail();
        return true;
      }

      return true;
    }

    if (isTyping) return false;

    const modalOpen = document.querySelector('#modalOverlay.show, #confirmOverlay.show, #statementOverlay.show, #ledgerFormOverlay.show, #egsPopupOverlay.show, #bomChallanOverlay.show, #bomRegisterOverlay.show');
    if (modalOpen) return false;

    const key = e.key;

    // 1. Tier 2 (Nested Submenu) is Active
    if (navState.focusTier === 'flyout_tier2' && navState.activeNestedParentEl) {
      const subItems = Array.from(navState.activeNestedParentEl.querySelectorAll('.tier2-item'));

      if (key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        navState.tier2Index = (navState.tier2Index + 1) % subItems.length;
        updateTier2Selection(navState.tier2Index);
        return true;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        navState.tier2Index = (navState.tier2Index - 1 + subItems.length) % subItems.length;
        updateTier2Selection(navState.tier2Index);
        return true;
      }
      if (key === 'ArrowLeft' || key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        // Step-by-step back to Tier 1!
        suppressHoverUntilMouseMove = true;
        setNestedSubmenuOpen(null, false);
        navState.focusTier = 'flyout_tier1';
        navState.tier2Index = -1;
        updateTier1Selection(navState.tier1Index, false);
        return true;
      }
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (subItems[navState.tier2Index]) {
          recordFlyoutTrail(navState.activeFlyoutGroup ? navState.activeFlyoutGroup.id : 'grp-accounts', navState.tier1Index, navState.tier2Index, true);
          subItems[navState.tier2Index].click();
        }
        return true;
      }
      if (/^[a-zA-Z]$/.test(key)) {
        const uKey = key.toUpperCase();
        const matched = subItems.find((it) => it.dataset.hotkey && it.dataset.hotkey.toUpperCase() === uKey);
        if (matched) {
          e.preventDefault();
          e.stopPropagation();
          const sIdx = subItems.indexOf(matched);
          recordFlyoutTrail(navState.activeFlyoutGroup ? navState.activeFlyoutGroup.id : 'grp-accounts', navState.tier1Index, sIdx, true);
          matched.click();
          return true;
        }

        // Sibling Tier 1 Item Hotkey Fallthrough (e.g. from LEDGER INFO pressing 'I' for Item Info, 'G' for Group, 'U' for UOM)
        const flyout = document.getElementById('egsActiveSidebarFlyout');
        const tier1Items = flyout ? Array.from(flyout.querySelectorAll('.egs-flyout-list > .tier1-item')) : [];
        const t1Matched = tier1Items.find((it) => it.dataset.hotkey && it.dataset.hotkey.toUpperCase() === uKey);
        if (t1Matched) {
          e.preventDefault();
          e.stopPropagation();
          const t1Idx = tier1Items.indexOf(t1Matched);
          suppressHoverUntilMouseMove = true;
          if (t1Matched.classList.contains('has-nested')) {
            updateTier1Selection(t1Idx, true);
            navState.focusTier = 'flyout_tier2';
            navState.tier2Index = 0;
            updateTier2Selection(0);
          } else {
            setNestedSubmenuOpen(null, false);
            updateTier1Selection(t1Idx, false);
            recordFlyoutTrail(navState.activeFlyoutGroup ? navState.activeFlyoutGroup.id : 'grp-accounts', t1Idx, -1, false);
            t1Matched.click();
          }
          return true;
        }
      }
    }

    // 2. Tier 1 (Flyout Menu) is Active
    if (navState.focusTier === 'flyout_tier1' && navState.activeFlyoutGroup) {
      const flyout = document.getElementById('egsActiveSidebarFlyout');
      const tier1Items = flyout ? Array.from(flyout.querySelectorAll('.egs-flyout-list > .tier1-item')) : [];

      if (key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        navState.tier1Index = (navState.tier1Index + 1) % tier1Items.length;
        updateTier1Selection(navState.tier1Index, false);
        return true;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        navState.tier1Index = (navState.tier1Index - 1 + tier1Items.length) % tier1Items.length;
        updateTier1Selection(navState.tier1Index, false);
        return true;
      }
      if (key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        const curItem = tier1Items[navState.tier1Index];
        if (curItem && curItem.classList.contains('has-nested')) {
          setNestedSubmenuOpen(curItem, true);
          navState.focusTier = 'flyout_tier2';
          navState.tier2Index = 0;
          updateTier2Selection(0);
        }
        return true;
      }
      if (key === 'ArrowLeft' || key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        // Step-by-step back to Sidebar!
        closeAllFlyouts();
        return true;
      }
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const curItem = tier1Items[navState.tier1Index];
        if (curItem) {
          if (curItem.classList.contains('has-nested')) {
            setNestedSubmenuOpen(curItem, true);
            navState.focusTier = 'flyout_tier2';
            navState.tier2Index = 0;
            updateTier2Selection(0);
          } else {
            recordFlyoutTrail(navState.activeFlyoutGroup ? navState.activeFlyoutGroup.id : 'grp-accounts', navState.tier1Index, -1, false);
            curItem.click();
          }
        }
        return true;
      }
      if (/^[a-zA-Z]$/.test(key)) {
        const uKey = key.toUpperCase();
        const matched = tier1Items.find((it) => it.dataset.hotkey && it.dataset.hotkey.toUpperCase() === uKey);
        if (matched) {
          e.preventDefault();
          e.stopPropagation();
          if (matched.classList.contains('has-nested')) {
            const idx = tier1Items.indexOf(matched);
            navState.tier1Index = idx;
            setNestedSubmenuOpen(matched, true);
            navState.focusTier = 'flyout_tier2';
            navState.tier2Index = 0;
            updateTier2Selection(0);
          } else {
            const idx = tier1Items.indexOf(matched);
            recordFlyoutTrail(navState.activeFlyoutGroup ? navState.activeFlyoutGroup.id : 'grp-accounts', idx, -1, false);
            matched.click();
          }
          return true;
        }
      }
    }

    // 3. No Flyout Open — Root Navigation & Global Hotkeys
    if (navState.focusTier === 'none') {
      // ONLY handle Arrow keys / Enter on root sidebar if currently on Dashboard
      if (window.CURRENT_PAGE_ID === 'dashboard') {
        const sidebarBtns = Array.from(document.querySelectorAll('.erp-sidebar-btn'));

        if (key === 'ArrowDown' || key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          const curIdx = sidebarBtns.findIndex((b) => b.classList.contains('selected'));
          let nextIdx = (curIdx === -1) ? 0 : (key === 'ArrowDown' ? curIdx + 1 : curIdx - 1 + sidebarBtns.length) % sidebarBtns.length;
          sidebarBtns.forEach((b, i) => b.classList.toggle('selected', i === nextIdx));
          return true;
        }
        if (key === 'ArrowRight' || key === 'Enter') {
          const selBtn = sidebarBtns.find((b) => b.classList.contains('selected'));
          if (selBtn) {
            e.preventDefault();
            e.stopPropagation();
            selBtn.click();
            return true;
          }
        }
      }

      if (/^[a-zA-Z]$/.test(key) && !e.ctrlKey && !e.altKey && !e.metaKey && key !== '/') {
        const uKey = key.toUpperCase();
        if (uKey === 'G') {
          e.preventDefault();
          e.stopPropagation();
          go('dashboard');
          return true;
        }
        const navItems = Array.from(document.querySelectorAll('.erp-nav-item'));
        const matched = navItems.find((b) => b.dataset.hotkey && b.dataset.hotkey.toUpperCase() === uKey);
        if (matched) {
          e.preventDefault();
          e.stopPropagation();
          matched.click();
          return true;
        }
      }
    }

    return false;
  }

  // =====================================================================
  // ENTERPRISE ERP KEYBOARD ENGINE (All 14 Modules + Universal Shortcuts)
  // =====================================================================
  const TAB_KEY_MAP = {
    // Number keys (1 to 9, 0)
    '1': 'dashboard',
    '2': 'scansheet',
    '3': 'masters',
    '4': 'purchase',
    '5': 'sales',
    '6': 'stockassign',
    '7': 'purchaseregister',
    '8': 'saleregister',
    '9': 'partyledger',
    '0': 'bom',

    // Direct Letter keys (with Alt or Alt+Shift)
    'r': 'reports',
    'R': 'reports',
    'd': 'returns',
    'D': 'returns',
    'p': 'partyledger',
    'P': 'partyledger',
    'l': 'lowstock',
    'L': 'lowstock',
    'b': 'backup',
    'B': 'backup',
    'm': 'bom',
    'M': 'bom',
    's': 'sales',
    'S': 'sales',
    'u': 'purchaseregister',
    'U': 'purchaseregister',
    'k': 'bom',
    'K': 'bom'
  };

  window.showKeyboardShortcutsModal = function () {
    const html = `
      <div style="max-height:calc(85vh - 120px); overflow-y:auto; padding-right:4px;">
        ${getKeyboardShortcutsContentHtml()}
      </div>
    `;
    window.openModal('⌨️ Keyboard Shortcuts & Quick Navigation Guide', html, { size: 'large' });
  };

  // Dedicated F1 interceptor: Runs in CAPTURE phase to unconditionally block Chrome Help redirect on Windows
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F1' || e.code === 'F1' || e.keyCode === 112) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.showKeyboardShortcutsModal();
    }
  }, true);

  // Dedicated Universal Top-Modal Escape Interceptor: Runs in CAPTURE phase so top modal closes cleanly without affecting background windows
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const topModal = document.querySelector('#modalOverlay.show, #confirmOverlay.show, #egsPopupOverlay.show');
      if (topModal) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (topModal.id === 'modalOverlay') {
          window.closeModal();
        } else if (topModal.id === 'confirmOverlay') {
          const btn = document.getElementById('confirmCancel');
          if (btn) btn.click();
          else topModal.classList.remove('show');
        } else if (topModal.id === 'egsPopupOverlay') {
          topModal.classList.remove('show');
        }
      }
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);

    // 0. Universal Help / Shortcuts: F1 or Shift + ?
    if (e.key === 'F1' || e.code === 'F1' || e.keyCode === 112 || (!isTyping && e.shiftKey && e.key === '?')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.showKeyboardShortcutsModal();
      return;
    }

    // 1. Universal Quick Search: Ctrl + K (or Cmd + K) -> Always focus top global search bar
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      e.stopPropagation();
      const topSearch = document.getElementById('egsQuickSearch') || document.getElementById('egsQuickSearchMobile') || document.querySelector('.search-mini input');
      if (topSearch) {
        topSearch.removeAttribute('readonly');
        topSearch.focus();
        if (typeof topSearch.select === 'function') topSearch.select();
        const parentMini = topSearch.closest('.search-mini');
        if (parentMini) {
          parentMini.classList.add('search-mini-highlight');
          setTimeout(() => parentMini.classList.remove('search-mini-highlight'), 1200);
        }
      }
      return;
    }

    // 2. Accounting ERP Keyboard Navigation & Flyout Engine (Arrows, Enter, Esc, Underlined Hotkeys)
    if (typeof handleAccountingKeyboard === 'function') {
      const wasHandled = handleAccountingKeyboard(e);
      if (wasHandled) return;
    }

    // 3. Universal Escape Key: Closes any active modal, dialog, popup, drawer, or quick search
    if (e.key === 'Escape') {
      if (e.target && (e.target.id === 'egsQuickSearch' || e.target.id === 'egsQuickSearchMobile')) {
        e.preventDefault();
        e.target.value = '';
        applyGlobalTableSearch('');
        e.target.blur();
        return;
      }

      let handled = false;
      if (typeof closeAllFlyouts === 'function') {
        closeAllFlyouts();
      }
      const modalOverlay = document.getElementById('modalOverlay');
      if (modalOverlay && modalOverlay.classList.contains('show')) {
        window.closeModal();
        handled = true;
      }
      const popupOverlay = document.getElementById('egsPopupOverlay');
      if (popupOverlay && popupOverlay.classList.contains('show')) {
        popupOverlay.classList.remove('show');
        handled = true;
      }
      const stOverlay = document.getElementById('statementOverlay');
      if (stOverlay && stOverlay.classList.contains('show')) {
        const stmtBack = document.getElementById('stmtBack');
        if (stmtBack && stmtBack.style.display !== 'none') {
          stmtBack.click();
        } else {
          const closeStmt = document.getElementById('closeStatement');
          if (closeStmt) closeStmt.click();
        }
        handled = true;
      }
      const lfOverlay = document.getElementById('ledgerFormOverlay');
      if (lfOverlay && lfOverlay.classList.contains('show')) {
        const closeLf = document.getElementById('closeLedgerForm') || document.getElementById('lfCancel');
        if (closeLf) closeLf.click();
        handled = true;
      }
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        window.closeSidebar();
        handled = true;
      }
      const filterMenu = document.querySelector('.th-filter-menu');
      if (filterMenu) {
        filterMenu.remove();
        handled = true;
      }
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }

    // 4. Active Page Search: Global '/' outside typing inputs
    if (!isTyping && e.key === '/') {
      e.preventDefault();
      e.stopPropagation();
      const pageSearch = document.querySelector('#plSearch, #ssSearchInput, #mrSearch, #srSearch, #prSearch, #purSearchInv');
      const topSearch = document.getElementById('egsQuickSearch') || document.getElementById('egsQuickSearchMobile') || document.querySelector('.search-mini input');
      const target = pageSearch || topSearch;
      if (target) {
        target.removeAttribute('readonly');
        target.focus();
        if (typeof target.select === 'function') target.select();
      }
      return;
    }

    // 5. Module & Tab Navigation: Alt + [Key] or Ctrl + [Number]
    if (e.altKey && !e.ctrlKey && !e.metaKey && TAB_KEY_MAP[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      go(TAB_KEY_MAP[e.key]);
      return;
    }
    if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && !isTyping && /^[0-9]$/.test(e.key) && TAB_KEY_MAP[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      go(TAB_KEY_MAP[e.key]);
      return;
    }

    // 6. Enter as field progression inside forms
    if (e.key === 'Enter' && isTyping && tag !== 'textarea' && e.target.type !== 'submit' && e.target.type !== 'button') {
      const form = e.target.closest('form, .form-grid, .field-wrap, .auth-card, .modal-box');
      if (form) {
        const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled])'))
          .filter((el) => el.offsetParent !== null);
        const idx = inputs.indexOf(e.target);
        if (idx !== -1) {
          if (e.shiftKey) {
            // Shift + Enter: previous field
            e.preventDefault();
            if (idx > 0) {
              inputs[idx - 1].focus();
              if (typeof inputs[idx - 1].select === 'function') inputs[idx - 1].select();
            }
          } else if (idx < inputs.length - 1) {
            // Enter: next field
            e.preventDefault();
            inputs[idx + 1].focus();
            if (typeof inputs[idx + 1].select === 'function') inputs[idx + 1].select();
          }
        }
      }
    }
  });

  // =====================================================================

  window.go = go;

  // Proactive Navigation Link Hover & Touch Prefetching for 0ms Perceived Response
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest && e.target.closest('[onclick*="go("], .egs-flyout-item, .erp-sidebar-btn');
    if (!target) return;
    const onclick = target.getAttribute('onclick') || '';
    if (onclick.includes("'reports'")) window.Api.prefetch('/reports/master');
    else if (onclick.includes("'masters'")) window.Api.prefetch('/masters/categories');
    else if (onclick.includes("'partyledger'")) window.Api.prefetch('/ledgers');
    else if (onclick.includes("'dashboard'")) window.Api.prefetch('/dashboard/summary');
  }, { passive: true });

  document.addEventListener('touchstart', (e) => {
    const target = e.target.closest && e.target.closest('[onclick*="go("], .egs-flyout-item, .erp-sidebar-btn');
    if (!target) return;
    const onclick = target.getAttribute('onclick') || '';
    if (onclick.includes("'reports'")) window.Api.prefetch('/reports/master');
    else if (onclick.includes("'masters'")) window.Api.prefetch('/masters/categories');
    else if (onclick.includes("'partyledger'")) window.Api.prefetch('/ledgers');
    else if (onclick.includes("'dashboard'")) window.Api.prefetch('/dashboard/summary');
  }, { passive: true });
})();
