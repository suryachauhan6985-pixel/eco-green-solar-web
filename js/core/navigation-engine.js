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

// ---------------------------------------------------------------------------
// GLOBAL LOADING INDICATORS — Smooth Unidirectional Top Progress Bar + Action Loader
// Batches cascading API calls into a SINGLE smooth sweep (0 -> 100% -> fade).
// ---------------------------------------------------------------------------
let __egsLoaderCount = 0;
let __egsLoaderTimer = null;
let __egsLoaderEndTimer = null;

const topProgress = {
  el: null,
  percent: 0,
  trickleTimer: null,
  resetTimer: null,
  isRunning: false,

  init() {
    if (this.el) return this.el;
    this.el = document.getElementById('egsTopProgressBar');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'egsTopProgressBar';
      this.el.className = 'egs-top-progress';
      document.body.appendChild(this.el);
    }
    return this.el;
  },

  start() {
    this.init();
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    if (!this.isRunning || this.percent === 0 || this.percent >= 100) {
      this.isRunning = true;
      this.percent = 0;
      this.el.style.transition = 'none';
      this.el.style.width = '0%';
      this.el.style.opacity = '1';
      void this.el.offsetWidth; // flush layout
      this.set(35);
    }

    if (!this.trickleTimer) {
      this.trickleTimer = setInterval(() => {
        if (this.percent < 90) {
          const step = (90 - this.percent) * 0.16;
          this.set(this.percent + step);
        }
      }, 140);
    }
  },

  set(pct) {
    this.init();
    // Strictly unidirectional forward progression
    if (pct < this.percent && this.percent < 100) return;
    this.percent = Math.min(100, Math.max(0, pct));
    this.el.style.transition = 'width 0.26s cubic-bezier(0.1, 0.85, 0.25, 1), opacity 0.2s ease';
    this.el.style.width = `${this.percent}%`;
    this.el.style.opacity = '1';
  },

  done() {
    if (!this.el) return;
    if (this.trickleTimer) {
      clearInterval(this.trickleTimer);
      this.trickleTimer = null;
    }
    this.set(100);
    this.isRunning = false;

    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      if (this.el) {
        this.el.style.transition = 'opacity 0.22s ease';
        this.el.style.opacity = '0';
        setTimeout(() => {
          if (this.el && !this.isRunning) {
            this.percent = 0;
            this.el.style.transition = 'none';
            this.el.style.width = '0%';
          }
        }, 240);
      }
      this.resetTimer = null;
    }, 150);
  }
};

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

  function getErpNavGroups() {
    const curRole = (window.currentUserRole || window.CURRENT_USER_ROLE || (window.CURRENT_USER && window.CURRENT_USER.role) || localStorage.getItem('user_role') || 'User').toLowerCase();
    const isSuperAdmin = curRole === 'superadmin' || curRole === 'super_admin';
    const isAdmin = isSuperAdmin || curRole === 'admin';
    const isAcc = window.ERP && window.ERP.isAccountingMode();
    const isFinOnly = window.ERP && window.ERP.isFinancialOnly();
    const isQtyOnly = window.ERP && window.ERP.isQuantityOnly();

    const accountsItems = [
      {
        name: 'Ledger Info',
        hotkey: 'L',
        icon: 'fa-address-book',
        hasNested: true,
        nestedTitle: 'Ledger Info',
        nestedItems: [
          { name: 'Create', hotkey: 'C', icon: 'fa-plus', page: 'partyledger', action: 'create' },
          { name: 'Display', hotkey: 'D', icon: 'fa-eye', page: 'partyledger', action: 'display' },
          { name: 'Alter', hotkey: 'A', icon: 'fa-pen-to-square', page: 'partyledger', action: 'alter' }
        ]
      }
    ];

    if (!isFinOnly) {
      accountsItems.push(
        {
          name: 'Item / Product Info',
          hotkey: 'I',
          icon: 'fa-cubes',
          hasNested: true,
          nestedTitle: 'Item / Product Info',
          nestedItems: [
            { name: 'Create', hotkey: 'C', icon: 'fa-plus', page: 'masters', sub: 'item-reg', action: 'create' },
            { name: 'Display', hotkey: 'D', icon: 'fa-eye', page: 'masters', sub: 'item-reg', action: 'display' },
            { name: 'Alter', hotkey: 'A', icon: 'fa-pen-to-square', page: 'masters', sub: 'item-reg', action: 'alter' }
          ]
        },
        {
          name: 'Group / Category Info',
          hotkey: 'G',
          icon: 'fa-layer-group',
          page: 'masters',
          sub: 'category'
        },
        {
          name: 'Unit of Measure (UOM)',
          hotkey: 'U',
          icon: 'fa-ruler-combined',
          page: 'masters',
          sub: 'uom'
        }
      );

      if (window.ERP && window.ERP.isWarehouseEnabled()) {
        accountsItems.push({
          name: 'Warehouse / Godown Info',
          hotkey: 'W',
          icon: 'fa-warehouse',
          requires: 'warehouse',
          page: 'masters',
          sub: 'warehouse'
        });
      }

      accountsItems.push({
        name: 'Brand Directory',
        hotkey: 'B',
        icon: 'fa-tags',
        page: 'masters',
        sub: 'brand'
      });
    }

    const transactionItems = [];
    if (isAcc) {
      transactionItems.push(
        { name: 'Payment Voucher (F5)', hotkey: 'V', icon: 'fa-arrow-up-from-bracket', page: 'vouchers', action: 'Payment' },
        { name: 'Receipt Voucher (F6)', hotkey: 'R', icon: 'fa-arrow-down-to-bracket', page: 'vouchers', action: 'Receipt' },
        { name: 'Journal Voucher (F7)', hotkey: 'J', icon: 'fa-scale-balanced', page: 'vouchers', action: 'Journal' },
        { name: 'Debit Note (Alt+F5)', hotkey: 'E', icon: 'fa-file-circle-minus', page: 'vouchers', action: 'DebitNote' },
        { name: 'Credit Note (Alt+F6)', hotkey: 'O', icon: 'fa-file-circle-plus', page: 'vouchers', action: 'CreditNote' }
      );
    }

    if (!isFinOnly) {
      transactionItems.push(
        { name: 'Purchase Inward (Stock In)', hotkey: 'P', icon: 'fa-truck-ramp-box', page: 'purchase' },
        { name: 'Project Sales & Dispatch', hotkey: 'S', icon: 'fa-handshake', page: 'sales' }
      );
      if (window.ERP && window.ERP.isBomEnabled()) {
        if (isAdmin) {
          transactionItems.push(
            { name: 'BOM Kit Assembly & Creation', hotkey: 'B', icon: 'fa-boxes-packing', page: 'bom', action: 'create', requires: 'bom' },
            { name: 'BOM Order Dispatch & Processing', hotkey: 'O', icon: 'fa-truck-fast', page: 'bom', action: 'dispatch', requires: 'bom' },
            { name: 'Custom Delivery Challan', hotkey: 'C', icon: 'fa-pen-nib', page: 'bom', action: 'custom-challan', requires: 'bom' }
          );
        } else {
          transactionItems.push(
            { name: 'BOM Order Dispatch & Processing', hotkey: 'B', icon: 'fa-truck-fast', page: 'bom', action: 'dispatch', requires: 'bom' },
            { name: 'Custom Delivery Challan', hotkey: 'C', icon: 'fa-pen-nib', page: 'bom', action: 'custom-challan', requires: 'bom' }
          );
        }
      }
      transactionItems.push(
        { name: 'Stock Allocation & Journal', hotkey: 'A', icon: 'fa-tag', page: 'stockassign', requires: 'stock' },
        { name: 'Sales Return & Damage', hotkey: 'M', icon: 'fa-arrow-rotate-left', page: 'returns' }
      );
      if (!isQtyOnly) {
        transactionItems.push(
          { name: 'Serial Number Scan Sheet', hotkey: 'N', icon: 'fa-barcode', page: 'scansheet', requires: 'serial' }
        );
      }
    }

    const accountBookItems = [
      { name: 'Party Ledger Statement', hotkey: 'L', icon: 'fa-money-check-dollar', page: 'partyledger', action: 'display' },
      { name: 'Purchase Register', hotkey: 'P', icon: 'fa-cart-shopping', page: 'purchaseregister' },
      { name: 'Sale Register', hotkey: 'S', icon: 'fa-money-bill-transfer', page: 'saleregister' }
    ];

    if (isAcc) {
      accountBookItems.push(
        { name: 'Trial Balance', hotkey: 'T', icon: 'fa-list-ol', page: 'financialreports', tab: 'trial-balance' },
        { name: 'Profit & Loss Statement', hotkey: 'O', icon: 'fa-chart-line', page: 'financialreports', tab: 'profit-loss' },
        { name: 'Balance Sheet', hotkey: 'B', icon: 'fa-building-columns', page: 'financialreports', tab: 'balance-sheet' },
        { name: 'Day Book Journal', hotkey: 'D', icon: 'fa-calendar-day', page: 'financialreports', tab: 'day-book' }
      );
    }

    const displayItems = [
      {
        name: 'Account Books',
        hotkey: 'A',
        icon: 'fa-book',
        hasNested: true,
        nestedTitle: 'Account Books',
        nestedItems: accountBookItems
      }
    ];

    if (!isFinOnly) {
      const stockBookItems = [
        { name: 'Master Inventory Report', hotkey: 'M', icon: 'fa-clipboard-list', page: 'reports', requires: 'stock' },
        { name: 'Low Stock Alert', hotkey: 'L', icon: 'fa-triangle-exclamation', page: 'lowstock', requires: 'stock' }
      ];
      if (window.ERP && window.ERP.isBomEnabled()) {
        stockBookItems.push(
          { name: 'BOM Dispatch Register', hotkey: 'B', icon: 'fa-clipboard-list', page: 'bom', action: 'register', requires: 'bom' },
          { name: 'Delivery Challans Register', hotkey: 'C', icon: 'fa-file-invoice', page: 'bom', action: 'challan', requires: 'bom' },
          { name: 'Track BOM Order Progress', hotkey: 'T', icon: 'fa-route', page: 'bom', action: 'track', requires: 'bom' }
        );
      }
      displayItems.push({
        name: 'Stock Books',
        hotkey: 'S',
        icon: 'fa-boxes-stacked',
        requires: 'stock',
        hasNested: true,
        nestedTitle: 'Stock Books',
        nestedItems: stockBookItems
      });
    }

    const utilityItems = [
      { name: 'ERP Mode & Feature Controls', hotkey: 'E', icon: 'fa-sliders', action: 'openSettings', sub: 'tab-erp-mode' },
      { name: 'User Accounts & Roles', hotkey: 'U', icon: 'fa-users-gear', action: 'openSettings', sub: 'tab-users' }
    ];

    if (isSuperAdmin) {
      utilityItems.push({
        name: 'SaaS Tenants & White-Label',
        hotkey: 'T',
        icon: 'fa-building-shield',
        page: 'saas_tenants'
      });
    }

    utilityItems.push({
      name: 'Backup & Restore',
      hotkey: 'B',
      icon: 'fa-cloud-arrow-up',
      page: 'backup'
    });

    utilityItems.push({
      name: 'Print Template Designer',
      hotkey: 'P',
      icon: 'fa-compass-drafting',
      page: 'template_designer'
    });

    return [
      {
        type: 'single',
        id: 'dashboard',
        name: 'Gateway / Dashboard',
        hotkey: 'G',
        icon: 'fa-house-chimney',
        page: 'dashboard'
      },
      {
        type: 'group',
        id: 'grp-accounts',
        name: 'Accounts Info',
        flyoutTitle: 'A/c Info',
        hotkey: 'A',
        icon: 'fa-folder-open',
        items: accountsItems
      },
      {
        type: 'group',
        id: 'grp-transactions',
        name: 'Transaction Entry',
        flyoutTitle: 'Transaction Entry',
        hotkey: 'T',
        icon: 'fa-receipt',
        items: transactionItems
      },
      {
        type: 'group',
        id: 'grp-display',
        name: 'Display / Print',
        flyoutTitle: 'Display / Print',
        hotkey: 'D',
        icon: 'fa-chart-pie',
        items: displayItems
      },
      {
        type: 'group',
        id: 'grp-utilities',
        name: 'Utilities & Setup',
        flyoutTitle: 'Utilities & Setup',
        hotkey: 'U',
        icon: 'fa-gear',
        items: utilityItems
      }
    ];
  }

  let ERP_NAV_GROUPS = getErpNavGroups();

  function shouldShowNavItem(item) {
    if (!item.requires) return true;
    if (item.requires === 'bom') return window.ERP ? window.ERP.isBomEnabled() : true;
    if (item.requires === 'serial') return window.ERP ? window.ERP.isSerialEnabled() : true;
    if (item.requires === 'warehouse') return window.ERP ? window.ERP.isWarehouseEnabled() : true;
    if (item.requires === 'stock') return window.ERP ? !window.ERP.isAccountsOnly() : true;
    return true;
  }

  // Navigation State Engine
  const navState = {
    focusTier: 'none', // 'none' | 'sidebar' | 'flyout_tier1' | 'flyout_tier2'
    sidebarIndex: 0,
    tier1Index: 0,
    tier2Index: -1,
    activeFlyoutGroup: null,
    activeNestedParentEl: null
  };

  function closeAllFlyouts(keepTrail = false) {
    navState.focusTier = 'none';
    navState.tier1Index = -1;
    navState.tier2Index = -1;
    navState.activeFlyoutGroup = null;
    navState.activeNestedParentEl = null;
    if (!keepTrail) {
      lastFlyoutTrail = null;
    }

    const existing = document.getElementById('egsActiveSidebarFlyout');
    if (existing) existing.remove();
    const backdrop = document.getElementById('egsActiveFlyoutBackdrop');
    if (backdrop) backdrop.remove();
    document.querySelectorAll('.erp-sidebar-btn').forEach((b) => {
      b.classList.remove('flyout-open');
    });
  }

  // Ladder Navigation History & Step-by-Step StepBack Engine (Tally / Shree Sava Standard)
  let lastFlyoutTrail = null;

  function recordFlyoutTrail(groupId, tier1Index, tier2Index, wasNested) {
    lastFlyoutTrail = {
      groupId,
      tier1Index: typeof tier1Index === 'number' ? tier1Index : 0,
      tier2Index: typeof tier2Index === 'number' ? tier2Index : -1,
      wasNested: !!wasNested
    };
  }

  function clearFlyoutTrail() {
    lastFlyoutTrail = null;
  }

  function resolveFlyoutTrail(pageId, opts = {}) {
    if (lastFlyoutTrail) return lastFlyoutTrail;
    if (!pageId || pageId === 'dashboard') return null;

    const action = opts.action || opts.tab || opts.sub || '';
    const sub = opts.sub || opts.tab || '';

    const navGroups = typeof getErpNavGroups === 'function' ? getErpNavGroups() : (ERP_NAV_GROUPS || []);
    for (const grp of navGroups) {
      if (!grp.items) continue;
      for (let t1Idx = 0; t1Idx < grp.items.length; t1Idx++) {
        const item = grp.items[t1Idx];
        if (item.hasNested && item.nestedItems) {
          for (let t2Idx = 0; t2Idx < item.nestedItems.length; t2Idx++) {
            const nItem = item.nestedItems[t2Idx];
            if (nItem.page === pageId) {
              if (action && (nItem.action || nItem.sub || nItem.tab)) {
                if (nItem.action === action || nItem.sub === sub || nItem.tab === sub) {
                  return { groupId: grp.id, tier1Index: t1Idx, tier2Index: t2Idx, wasNested: true };
                }
              } else {
                return { groupId: grp.id, tier1Index: t1Idx, tier2Index: t2Idx, wasNested: true };
              }
            }
          }
        } else if (item.page === pageId) {
          if (action && (item.action || item.sub || item.tab)) {
            if (item.action === action || item.sub === sub || item.tab === sub) {
              return { groupId: grp.id, tier1Index: t1Idx, tier2Index: -1, wasNested: false };
            }
          } else {
            return { groupId: grp.id, tier1Index: t1Idx, tier2Index: -1, wasNested: false };
          }
        }
      }
    }
    return null;
  }

  function stepBackFromFlyoutTrail() {
    const trail = resolveFlyoutTrail(window.CURRENT_PAGE_ID, window.CURRENT_PAGE_OPTS);
    lastFlyoutTrail = null; // Consume the current trail

    if (!trail) {
      go('dashboard');
      return;
    }

    const navGroups = typeof getErpNavGroups === 'function' ? getErpNavGroups() : (ERP_NAV_GROUPS || []);
    const grp = navGroups.find((g) => g.id === trail.groupId);
    if (!grp) {
      go('dashboard');
      return;
    }
    const anchorBtn = document.getElementById('btnNav_' + grp.id);
    if (window.CURRENT_PAGE_ID !== 'dashboard') {
      go('dashboard', {}, false);
    }
    openSidebarFlyout(grp, anchorBtn, false);

    setTimeout(() => {
      const flyout = document.getElementById('egsActiveSidebarFlyout');
      if (!flyout) return;
      const tier1Items = Array.from(flyout.querySelectorAll('.egs-flyout-list > .tier1-item'));
      const t1Idx = Math.max(0, Math.min(trail.tier1Index, tier1Items.length - 1));
      
      suppressHoverUntilMouseMove = true;
      if (trail.wasNested && trail.tier2Index >= 0) {
        updateTier1Selection(t1Idx, true);
        navState.focusTier = 'flyout_tier2';
        updateTier2Selection(trail.tier2Index);
      } else {
        updateTier1Selection(t1Idx, false);
        navState.focusTier = 'flyout_tier1';
        navState.tier2Index = -1;
        setNestedSubmenuOpen(null, false);
      }
    }, 40);
  }

  window.stepBackFromFlyoutTrail = stepBackFromFlyoutTrail;
  window.recordFlyoutTrail = recordFlyoutTrail;
  window.clearFlyoutTrail = clearFlyoutTrail;
  window.resolveFlyoutTrail = resolveFlyoutTrail;

  let suppressHoverUntilMouseMove = false;
  window.addEventListener('mousemove', () => {
    suppressHoverUntilMouseMove = false;
  }, { passive: true });

  function setNestedSubmenuOpen(parentRowEl, open = true) {
    const flyout = document.getElementById('egsActiveSidebarFlyout');
    if (!flyout) return;

    flyout.querySelectorAll('.egs-flyout-item.has-nested').forEach((row) => {
      if (row !== parentRowEl || !open) {
        row.classList.remove('nested-open');
        row.querySelectorAll('.egs-flyout-item').forEach((sub) => sub.classList.remove('selected'));
      }
    });

    if (open && parentRowEl) {
      parentRowEl.classList.add('nested-open');
      navState.activeNestedParentEl = parentRowEl;
    } else if (!open) {
      navState.activeNestedParentEl = null;
    }
  }

  function updateTier1Selection(index, openNested = false) {
    const flyout = document.getElementById('egsActiveSidebarFlyout');
    if (!flyout) return;
    const items = Array.from(flyout.querySelectorAll('.egs-flyout-list > .tier1-item'));
    if (!items.length) return;

    if (index < 0) index = 0;
    if (index >= items.length) index = items.length - 1;
    navState.tier1Index = index;

    items.forEach((it, idx) => {
      const isSel = (idx === index);
      it.classList.toggle('selected', isSel);
      if (isSel && it.classList.contains('has-nested') && openNested) {
        setNestedSubmenuOpen(it, true);
      }
    });

    if (!openNested) {
      setNestedSubmenuOpen(null, false);
    }
  }

  function updateTier2Selection(index) {
    if (!navState.activeNestedParentEl) return;
    const subItems = Array.from(navState.activeNestedParentEl.querySelectorAll('.egs-nested-flyout-box .tier2-item'));
    if (!subItems.length) return;

    if (index < 0) index = 0;
    if (index >= subItems.length) index = subItems.length - 1;
    navState.tier2Index = index;

    subItems.forEach((it, idx) => {
      it.classList.toggle('selected', idx === index);
    });
  }

  function openSidebarFlyout(grp, anchorEl, selectFirst = true) {
    closeAllFlyouts(true);
    if (!grp) return;
    navState.activeFlyoutGroup = grp;
    navState.focusTier = 'flyout_tier1';
    navState.tier1Index = selectFirst ? 0 : -1;
    navState.tier2Index = -1;
    suppressHoverUntilMouseMove = true;

    if (anchorEl) anchorEl.classList.add('flyout-open');

    // Create Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'egsActiveFlyoutBackdrop';
    backdrop.className = 'egs-flyout-backdrop';
    backdrop.onclick = () => closeAllFlyouts(false);
    document.body.appendChild(backdrop);

    // Create Flyout Box
    const flyout = document.createElement('div');
    flyout.id = 'egsActiveSidebarFlyout';
    flyout.className = 'egs-flyout-box';

    const rect = anchorEl ? anchorEl.getBoundingClientRect() : { top: 120, right: 260, bottom: 160 };
    const isMobile = window.innerWidth <= 900;
    if (isMobile) {
      if (typeof window.closeSidebar === 'function') window.closeSidebar();
      flyout.style.left = '50%';
      flyout.style.top = '50%';
      flyout.style.transform = 'translate(-50%, -50%)';
      flyout.style.width = 'min(340px, calc(100vw - 28px))';
      flyout.style.maxWidth = 'calc(100vw - 28px)';
      flyout.style.maxHeight = 'calc(100vh - 60px)';
      flyout.style.overflowY = 'auto';
      flyout.style.zIndex = '20000';
      backdrop.style.zIndex = '19999';
    } else {
      flyout.style.left = (rect.right + 10) + 'px';
      flyout.style.top = Math.min(Math.max(rect.top, 60), window.innerHeight - 380) + 'px';
      flyout.style.zIndex = '10005';
    }

    let itemsHtml = '';
    grp.items.forEach((item) => {
      if (!shouldShowNavItem(item)) return;

      const itemLabelHtml = formatHkLabel(item.name, item.hotkey);

      if (item.hasNested) {
        let nestedRows = '';
        item.nestedItems.forEach((sub) => {
          if (!shouldShowNavItem(sub)) return;
          const subLabelHtml = formatHkLabel(sub.name, sub.hotkey);
          nestedRows += `
            <div class="egs-flyout-item tier2-item" data-page="${sub.page || ''}" data-sub="${sub.sub || sub.tab || ''}" data-action="${sub.action || ''}" data-filter="${sub.filter || ''}" data-group-id="${grp.id}" data-hotkey="${sub.hotkey || ''}">
              <span class="item-text"><i class="fa-solid ${sub.icon}" style="color:var(--blue); font-size:12px;"></i> <span>${subLabelHtml}</span></span>
            </div>
          `;
        });

        itemsHtml += `
          <div class="egs-flyout-item tier1-item has-nested" data-hotkey="${item.hotkey || ''}">
            <span class="item-text"><i class="fa-solid ${item.icon}" style="color:var(--blue); font-size:12px;"></i> <span>${itemLabelHtml}</span></span>
            <i class="fa-solid fa-chevron-right item-arrow"></i>
            <div class="egs-nested-flyout-box">
              <div class="egs-flyout-header"><span>${item.nestedTitle || item.name}</span></div>
              <div class="egs-flyout-list">${nestedRows}</div>
            </div>
          </div>
        `;
      } else {
        itemsHtml += `
          <div class="egs-flyout-item tier1-item" data-page="${item.page || ''}" data-sub="${item.sub || item.tab || ''}" data-action="${item.action || ''}" data-filter="${item.filter || ''}" data-group-id="${grp.id}" data-hotkey="${item.hotkey || ''}">
            <span class="item-text"><i class="fa-solid ${item.icon}" style="color:var(--blue); font-size:12px;"></i> <span>${itemLabelHtml}</span></span>
          </div>
        `;
      }
    });

    flyout.innerHTML = `
      <div class="egs-flyout-header">
        <span>${grp.flyoutTitle || grp.name}</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="egs-flyout-esc-hint" style="cursor:pointer;"><kbd>Esc</kbd></span>
          <button type="button" class="btn-flyout-close" style="background:transparent; border:none; color:var(--txt-muted); font-size:14px; cursor:pointer; padding:2px 6px; display:inline-flex; align-items:center;" aria-label="Close menu"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      <div class="egs-flyout-list">${itemsHtml}</div>
    `;

    document.body.appendChild(flyout);

    const escHint = flyout.querySelector('.egs-flyout-esc-hint');
    if (escHint) {
      escHint.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllFlyouts(false);
      });
    }

    const closeBtn = flyout.querySelector('.btn-flyout-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllFlyouts(false);
      });
    }

    function dismissMobileSidebar() {
      if (window.innerWidth <= 900) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.remove('open');
        const overlay = document.getElementById('sidebarOverlay') || document.querySelector('.overlay');
        if (overlay) overlay.classList.remove('show');
      }
    }

    // Wire mouseenter and clicks on flyout items
    const tier1Els = Array.from(flyout.querySelectorAll('.egs-flyout-list > .tier1-item'));
    tier1Els.forEach((row, idx) => {
      row.addEventListener('mouseenter', () => {
        if (suppressHoverUntilMouseMove) return;
        if (window.innerWidth <= 768) return; // Ignore hover on mobile/touch
        navState.focusTier = 'flyout_tier1';
        navState.tier1Index = idx;
        tier1Els.forEach((r, i) => r.classList.toggle('selected', i === idx));
        if (row.classList.contains('has-nested')) {
          setNestedSubmenuOpen(row, true);
        } else {
          setNestedSubmenuOpen(null, false);
        }
      });

      row.addEventListener('click', (e) => {
        if (row.classList.contains('has-nested') && !e.target.closest('.egs-nested-flyout-box .tier2-item')) {
          e.stopPropagation();
          const isOpen = row.classList.contains('nested-open');
          setNestedSubmenuOpen(row, !isOpen);
          if (!isOpen) {
            navState.focusTier = 'flyout_tier2';
            navState.tier2Index = 0;
            updateTier2Selection(0);
          }
          return;
        }
        e.stopPropagation();
        const page = row.dataset.page;
        const sub = row.dataset.sub;
        const action = row.dataset.action;
        const filter = row.dataset.filter;
        const groupId = row.dataset.groupId;

        recordFlyoutTrail(grp.id, idx, -1, false);
        closeAllFlyouts(true);
        dismissMobileSidebar();
        if (action === 'openSettings' && typeof window.openSystemSettingsModal === 'function') {
          window.openSystemSettingsModal(sub || 'tab-erp-mode');
        } else if (page) {
          go(page, { sub, action, filter, groupId });
        }
      });
    });

    // Wire mouseenter and clicks on Tier 2 items
    flyout.querySelectorAll('.tier2-item').forEach((subRow) => {
      subRow.addEventListener('mouseenter', () => {
        if (suppressHoverUntilMouseMove) return;
        navState.focusTier = 'flyout_tier2';
        const parentBox = subRow.closest('.egs-nested-flyout-box');
        if (parentBox) {
          const allSubs = Array.from(parentBox.querySelectorAll('.tier2-item'));
          const sIdx = allSubs.indexOf(subRow);
          navState.tier2Index = sIdx;
          allSubs.forEach((sr, i) => sr.classList.toggle('selected', i === sIdx));
        }
      });

      subRow.addEventListener('click', (e) => {
        e.stopPropagation();
        const page = subRow.dataset.page;
        const sub = subRow.dataset.sub;
        const action = subRow.dataset.action;
        const filter = subRow.dataset.filter;
        const groupId = subRow.dataset.groupId;
        const parentBox = subRow.closest('.egs-nested-flyout-box');
        const allSubs = parentBox ? Array.from(parentBox.querySelectorAll('.tier2-item')) : [];
        const sIdx = allSubs.indexOf(subRow);
        recordFlyoutTrail(grp.id, navState.tier1Index, sIdx, true);
        closeAllFlyouts(true);
        dismissMobileSidebar();
        if (page) go(page, { sub, action, filter, groupId });
      });
    });

    if (selectFirst && tier1Els.length > 0) {
      updateTier1Selection(0, false);
    }
  }

  window.openSidebarFlyout = openSidebarFlyout;
  window.closeSidebarFlyout = closeAllFlyouts;

  function renderNavButtons() {
    const navEl = document.getElementById('navScroll') || document.querySelector('.nav-scroll');
    if (!navEl) return;
    navEl.innerHTML = '';

    ERP_NAV_GROUPS = getErpNavGroups();

    ERP_NAV_GROUPS.forEach((grp, gIdx) => {
      const labelHtml = formatHkLabel(grp.name, grp.hotkey);

      if (grp.type === 'single') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'erp-sidebar-btn';
        btn.id = 'btnNav_' + grp.id;
        btn.dataset.tab = grp.id;
        btn.dataset.index = gIdx;
        btn.innerHTML = `
          <span class="btn-label"><i class="fa-solid ${grp.icon}" style="color:var(--blue);"></i> <span>${labelHtml}</span></span>
        `;
        btn.onclick = () => {
          clearFlyoutTrail();
          closeAllFlyouts();
          if (typeof window.closeSidebar === 'function') window.closeSidebar();
          go(grp.page);
        };
        navEl.appendChild(btn);
        return;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'erp-sidebar-btn';
      btn.id = 'btnNav_' + grp.id;
      btn.dataset.groupId = grp.id;
      btn.dataset.index = gIdx;
      btn.innerHTML = `
        <span class="btn-label"><i class="fa-solid ${grp.icon}" style="color:var(--blue);"></i> <span>${labelHtml}</span></span>
        <i class="fa-solid fa-chevron-right btn-arrow"></i>
      `;

      btn.onclick = (e) => {
        e.stopPropagation();
        if (navState.activeFlyoutGroup === grp) {
          closeAllFlyouts();
        } else {
          openSidebarFlyout(grp, btn, true);
        }
      };

      navEl.appendChild(btn);
    });

    // Sync active state with currently open page
    updateSidebarActiveState(window.CURRENT_PAGE_ID || 'dashboard', window.CURRENT_PAGE_OPTS || {});

    // Wire Brand Logo for direct Dashboard Teleportation
    document.querySelectorAll('.brand, .brand-inner, .brand-card, .mobile-topbar .brand').forEach((el) => {
      el.style.cursor = 'pointer';
      el.onclick = (e) => {
        e.stopPropagation();
        clearFlyoutTrail();
        closeAllFlyouts();
        if (typeof window.closeSidebar === 'function') window.closeSidebar();
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
    const navButtons = document.querySelectorAll('.erp-sidebar-btn');
    if (!navButtons.length) return;

    const action = opts.action || opts.tab || opts.sub || '';
    const sub = opts.sub || opts.tab || '';

    // Find the correct group ID for this route
    let matchedGroupId = opts.groupId || null;

    if (!matchedGroupId && typeof ERP_NAV_GROUPS !== 'undefined' && ERP_NAV_GROUPS) {
      for (const grp of ERP_NAV_GROUPS) {
        if (grp.id === pageId) {
          matchedGroupId = pageId;
          break;
        }
        if (grp.items) {
          const directMatch = grp.items.some((item) => {
            if (item.page !== pageId) return false;
            if (action && (item.action || item.sub || item.tab)) {
              return (item.action === action || item.sub === sub || item.tab === sub);
            }
            return true;
          });
          if (directMatch) {
            matchedGroupId = grp.id;
            break;
          }
          const nestedMatch = grp.items.some((item) => {
            if (!item.nestedItems) return false;
            return item.nestedItems.some((nItem) => {
              if (nItem.page !== pageId) return false;
              if (action && (nItem.action || nItem.sub || nItem.tab)) {
                return (nItem.action === action || nItem.sub === sub || nItem.tab === sub);
              }
              return true;
            });
          });
          if (nestedMatch) {
            matchedGroupId = grp.id;
            break;
          }
        }
      }
    }

    navButtons.forEach((b) => {
      let isMatch = false;
      if (pageId === 'dashboard') {
        isMatch = (b.dataset.tab === 'dashboard' || b.dataset.groupId === 'dashboard');
      } else {
        if (b.dataset.tab === 'dashboard') {
          isMatch = false;
        } else if (matchedGroupId && b.dataset.groupId === matchedGroupId) {
          isMatch = true;
        } else if (b.dataset.tab === pageId) {
          isMatch = true;
        }
      }
      b.classList.toggle('active', isMatch);
      b.classList.remove('selected');
    });
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

    if (typeof applyGlobalTableSearch === 'function') {
      applyGlobalTableSearch(currentSearchQuery);
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
      const nestedOpenEl = activeFlyout ? activeFlyout.querySelector('.egs-flyout-item.has-nested.nested-open') : null;
      if (nestedOpenEl || navState.focusTier === 'flyout_tier2') {
        suppressHoverUntilMouseMove = true;
        setNestedSubmenuOpen(null, false);
        navState.focusTier = 'flyout_tier1';
        navState.tier2Index = -1;
        if (navState.tier1Index >= 0) {
          updateTier1Selection(navState.tier1Index, false);
        }
        return true;
      }

      if (activeFlyout || navState.focusTier === 'flyout_tier1') {
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
        if (uKey === 'A') {
          e.preventDefault();
          e.stopPropagation();
          const grp = ERP_NAV_GROUPS.find((g) => g.id === 'grp-accounts');
          const anchor = document.getElementById('btnNav_grp-accounts');
          openSidebarFlyout(grp, anchor, true);
          return true;
        }
        if (uKey === 'T' || uKey === 'V') {
          e.preventDefault();
          e.stopPropagation();
          const grp = ERP_NAV_GROUPS.find((g) => g.id === 'grp-transactions');
          const anchor = document.getElementById('btnNav_grp-transactions');
          openSidebarFlyout(grp, anchor, true);
          return true;
        }
        if (uKey === 'D') {
          e.preventDefault();
          e.stopPropagation();
          const grp = ERP_NAV_GROUPS.find((g) => g.id === 'grp-display');
          const anchor = document.getElementById('btnNav_grp-display');
          openSidebarFlyout(grp, anchor, true);
          return true;
        }
        if (uKey === 'U') {
          e.preventDefault();
          e.stopPropagation();
          const grp = ERP_NAV_GROUPS.find((g) => g.id === 'grp-utilities');
          const anchor = document.getElementById('btnNav_grp-utilities');
          openSidebarFlyout(grp, anchor, true);
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
})();
