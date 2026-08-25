/**
 * Eco Green Solar ERP - SuperAdmin Multi-Tenant SaaS Studio & White-Label Configurator
 * Full management interface for tenants, custom branding, live color studio, feature gating, and terminology mapping.
 */

window.PAGES = window.PAGES || {};

window.PAGES.saas_tenants = {
  name: 'SaaS Tenant & White-Label Studio',
  sub: 'Multi-tenant organization management, custom branding & feature matrix',
  icon: 'fa-building-shield',
  html: `
      <div class="saas-container" style="padding: 16px; max-width: 1400px; margin: 0 auto;">
        <!-- TOP HEADER & STATS -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--txt); margin: 0; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-building-shield" style="color: var(--tenant-primary);"></i>
              <span>Multi-Tenant SaaS &amp; White-Label Studio</span>
            </h2>
            <p style="font-size: 12.5px; color: var(--txt-muted); margin: 4px 0 0 0;">
              Manage isolated organization workspaces, dynamic CSS variables, feature gates, and custom terminology.
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary" id="btnRefreshTenants">
              <i class="fa-solid fa-arrows-rotate"></i> Refresh
            </button>
            <button type="button" class="btn btn-tenant-primary" id="btnCreateTenantModal">
              <i class="fa-solid fa-plus"></i> Register New Tenant
            </button>
          </div>
        </div>

        <!-- STATS CARDS -->
        <div class="stats-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <div class="card stat-card" style="padding: 14px; background: var(--bg-card); border-radius: var(--tenant-card-radius); border: 1px solid var(--border);">
            <div style="font-size: 11.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Total Organizations</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--txt); margin-top: 4px;" id="statTotalTenants">0</div>
          </div>
          <div class="card stat-card" style="padding: 14px; background: var(--bg-card); border-radius: var(--tenant-card-radius); border: 1px solid var(--border);">
            <div style="font-size: 11.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Active SaaS Workspaces</div>
            <div style="font-size: 24px; font-weight: 800; color: #2ecc71; margin-top: 4px;" id="statActiveTenants">0</div>
          </div>
          <div class="card stat-card" style="padding: 14px; background: var(--bg-card); border-radius: var(--tenant-card-radius); border: 1px solid var(--border);">
            <div style="font-size: 11.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Total Tenant Users</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--tenant-accent); margin-top: 4px;" id="statTotalUsers">0</div>
          </div>
          <div class="card stat-card" style="padding: 14px; background: var(--bg-card); border-radius: var(--tenant-card-radius); border: 1px solid var(--border);">
            <div style="font-size: 11.5px; color: var(--txt-muted); text-transform: uppercase; font-weight: 700;">Storage Allocation</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--tenant-primary); margin-top: 4px;" id="statStorageTotal">0 MB</div>
          </div>
        </div>

        <!-- SEARCH & TENANT DIRECTORY GRID -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px; flex-wrap: wrap;">
          <div class="search-mini" style="max-width: 380px; width: 100%;">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" id="saasSearchInput" placeholder="Filter by organization name, slug, or custom domain...">
          </div>
          <div style="font-size: 12px; color: var(--txt-muted);" id="saasTenantCountLabel">
            Showing all organizations
          </div>
        </div>

        <div id="saasTenantsGrid" class="saas-grid">
          <div style="text-align: center; padding: 40px; grid-column: 1 / -1; color: var(--txt-muted);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--tenant-primary); margin-bottom: 10px;"></i>
            <div>Loading SaaS organizations...</div>
          </div>
        </div>
      </div>
    `,

  async init() {
    let tenants = [];
    const gridEl = document.getElementById('saasTenantsGrid');
    const searchInput = document.getElementById('saasSearchInput');
    const btnRefresh = document.getElementById('btnRefreshTenants');
    const btnCreate = document.getElementById('btnCreateTenantModal');

    async function loadTenants() {
      try {
        if (gridEl) gridEl.innerHTML = `<div style="text-align:center; padding:40px; grid-column:1/-1; color:var(--txt-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:var(--tenant-primary);"></i></div>`;
        const res = await window.Api.get('/saas/tenants', { bypassCache: true });
        tenants = Array.isArray(res) ? res : [];
        updateStats();
        renderGrid();
      } catch (err) {
        if (gridEl) {
          gridEl.innerHTML = `
            <div style="grid-column:1/-1; padding:24px; text-align:center; color:var(--red); background:rgba(231,76,60,0.08); border-radius:8px;">
              <i class="fa-solid fa-triangle-exclamation"></i> ${err.message || 'Failed to load tenants. SuperAdmin privileges required.'}
            </div>
          `;
        }
      }
    }

    function updateStats() {
      const statTotal = document.getElementById('statTotalTenants');
      const statActive = document.getElementById('statActiveTenants');
      const statUsers = document.getElementById('statTotalUsers');
      const statStorage = document.getElementById('statStorageTotal');

      if (statTotal) statTotal.textContent = tenants.length;
      if (statActive) statActive.textContent = tenants.filter(t => t.status === 'active').length;
      if (statUsers) statUsers.textContent = tenants.reduce((acc, t) => acc + Number(t.users_count || 0), 0);
      if (statStorage) {
        const totalMb = tenants.reduce((acc, t) => acc + Number(t.storage_quota_mb || 5000), 0);
        statStorage.textContent = `${(totalMb / 1024).toFixed(1)} GB`;
      }
    }

    function renderGrid() {
      if (!gridEl) return;
      const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
      const filtered = tenants.filter(t => {
        return (
          t.name.toLowerCase().includes(query) ||
          t.slug.toLowerCase().includes(query) ||
          (t.custom_domain && t.custom_domain.toLowerCase().includes(query))
        );
      });

      if (!filtered.length) {
        gridEl.innerHTML = `
          <div style="grid-column:1/-1; padding:40px; text-align:center; color:var(--txt-muted); background:var(--bg-card); border-radius:12px; border:1px dashed var(--border);">
            <i class="fa-solid fa-building-circle-exclamation" style="font-size:32px; margin-bottom:8px; opacity:0.6;"></i>
            <div style="font-size:14px; font-weight:600;">No organizations found matching search criteria.</div>
          </div>
        `;
        return;
      }

      const activeSlug = localStorage.getItem('egs_tenant_slug') || 'default';

      gridEl.innerHTML = filtered.map(t => {
        const isCurrent = t.slug === activeSlug;
        const primary = t.primary_color || '#008080';
        const secondary = t.secondary_color || '#005a5a';
        const accent = t.accent_color || '#e5a93c';

        return `
          <div class="saas-tenant-card ${isCurrent ? 'active-tenant' : ''}">
            <div>
              <div class="saas-tenant-header">
                <div style="display:flex; align-items:center; gap:10px;">
                  <div class="tenant-avatar-slot" style="width:36px; height:36px; min-width:36px; background:${primary}; font-size:14px;">
                    ${t.logo_url ? `<img src="${t.logo_url}" alt="${t.name}">` : t.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <strong style="font-size:14.5px; color:var(--txt); display:block;">${t.name}</strong>
                    <span style="font-size:11.5px; color:var(--txt-muted); font-family:monospace;">${t.slug}</span>
                  </div>
                </div>
                <div>
                  <span class="pill pill-${t.status === 'active' ? 'green' : t.status === 'trial' ? 'gold' : 'red'}" style="font-size:10.5px; text-transform:uppercase;">
                    ${t.status}
                  </span>
                </div>
              </div>

              <div class="saas-color-preview-bar">
                <div style="flex:2; background:${primary};"></div>
                <div style="flex:1; background:${secondary};"></div>
                <div style="flex:1; background:${accent};"></div>
              </div>

              <div style="margin-top:12px; font-size:12px; color:var(--txt-muted); display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <div><i class="fa-solid fa-globe" style="width:14px;"></i> ${t.custom_domain || 'Subdomain only'}</div>
                <div><i class="fa-solid fa-users" style="width:14px;"></i> ${t.users_count || 0} Users</div>
                <div><i class="fa-solid fa-boxes-stacked" style="width:14px;"></i> ${t.items_count || 0} Items</div>
                <div><i class="fa-solid fa-database" style="width:14px;"></i> ${t.storage_quota_mb || 5000} MB</div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-light); padding-top:10px; margin-top:10px;">
              <button type="button" class="btn btn-ghost btn-sm" onclick="window.previewSwitchTenant('${t.slug}')" style="font-size:11.5px; ${isCurrent ? 'color:var(--tenant-primary); font-weight:700;' : ''}">
                <i class="fa-solid ${isCurrent ? 'fa-circle-check' : 'fa-eye'}"></i> ${isCurrent ? 'Active Workspace' : 'Switch & Preview'}
              </button>
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.openEditTenantModal('${t.id}')" title="Configure White-Label & Features">
                  <i class="fa-solid fa-sliders"></i> Edit
                </button>
                ${t.id !== '00000000-0000-0000-0000-000000000001' ? `
                  <button type="button" class="btn btn-ghost btn-sm" onclick="window.deleteTenantConfirm('${t.id}', '${t.name}')" style="color:var(--red);" title="Remove Tenant">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    if (searchInput) {
      searchInput.addEventListener('input', () => renderGrid());
    }

    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => loadTenants());
    }

    if (btnCreate) {
      btnCreate.addEventListener('click', () => window.openEditTenantModal(null));
    }

    window.previewSwitchTenant = function (slug) {
      localStorage.setItem('egs_tenant_slug', slug);
      if (window.TenantContext && typeof window.TenantContext.reload === 'function') {
        window.TenantContext.reload().then(() => {
          if (window.showToast) window.showToast(`Switched workspace context to: ${slug}`, 'success');
          renderGrid();
        });
      }
    };

    window.openEditTenantModal = async function (tenantId) {
      let tenantData = {
        name: '',
        slug: '',
        customDomain: '',
        status: 'active',
        plan: 'enterprise',
        theme: {
          primaryColor: '#008080',
          secondaryColor: '#005a5a',
          accentColor: '#e5a93c',
          bgColor: '#0b1320',
          sidebarBg: '#070d18',
          sidebarText: '#ffffff',
          cardRadius: '12px',
          cardShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          logoUrl: null,
          faviconUrl: null,
          loginBannerUrl: null,
          customCss: ''
        },
        features: {
          inventoryEnabled: true,
          gstInvoicing: true,
          multiBranch: false,
          exportReports: true,
          bomEnabled: true,
          serialTracking: true,
          vouchersEnabled: true
        },
        terminology: {
          client_alias: 'Customer',
          supplier_alias: 'Supplier',
          item_alias: 'Product / Item',
          invoice_alias: 'Delivery Challan / Invoice',
          warehouse_alias: 'Godown / Warehouse',
          tax_alias: 'GSTIN'
        }
      };

      if (tenantId) {
        try {
          tenantData = await window.Api.get(`/saas/tenants/${tenantId}`, { bypassCache: true });
        } catch (e) {
          if (window.showToast) window.showToast(e.message, 'error');
          return;
        }
      }

      const modalHtml = `
        <div class="saas-modal-layout" style="max-height: calc(85vh - 120px); overflow-y: auto; padding-right: 4px;">
          <!-- TABS -->
          <div class="subtabs" style="margin-bottom: 16px; border-bottom: 1px solid var(--border-light); display: flex; gap: 8px;">
            <button type="button" class="subtab active" data-tab="saasTabGeneral"><i class="fa-solid fa-id-card"></i> Organization</button>
            <button type="button" class="subtab" data-tab="saasTabBranding"><i class="fa-solid fa-palette"></i> White-Label Studio</button>
            <button type="button" class="subtab" data-tab="saasTabFeatures"><i class="fa-solid fa-toggle-on"></i> Feature Matrix</button>
            <button type="button" class="subtab" data-tab="saasTabTerminology"><i class="fa-solid fa-spell-check"></i> Terminology</button>
          </div>

          <!-- 1. GENERAL TAB -->
          <div class="saas-panel-tab" id="saasTabGeneral">
            <div class="form-grid cols-2">
              <div class="field">
                <label>Organization Name <span class="req">*</span></label>
                <input type="text" id="saasInputName" value="${tenantData.name || ''}" placeholder="e.g. Adani Solar Energy" required>
              </div>
              <div class="field">
                <label>Tenant Slug (Subdomain) <span class="req">*</span></label>
                <input type="text" id="saasInputSlug" value="${tenantData.slug || ''}" placeholder="e.g. adani" ${tenantId ? 'readonly style="opacity:0.7;"' : ''} required>
                <small style="color:var(--txt-muted); font-size:11px;">Access via: {slug}.yourapp.com or ?tenant={slug}</small>
              </div>
              <div class="field">
                <label>Custom Domain (CNAME / Reverse Proxy)</label>
                <input type="text" id="saasInputDomain" value="${tenantData.customDomain || ''}" placeholder="e.g. erp.adanisolar.com">
              </div>
              <div class="field">
                <label>Workspace Status</label>
                <select id="saasSelectStatus">
                  <option value="active" ${tenantData.status === 'active' ? 'selected' : ''}>Active</option>
                  <option value="trial" ${tenantData.status === 'trial' ? 'selected' : ''}>Trial</option>
                  <option value="suspended" ${tenantData.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 2. BRANDING & THEME STUDIO TAB -->
          <div class="saas-panel-tab" id="saasTabBranding" style="display: none;">
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-light); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
              <div style="font-weight: 700; font-size: 13px; color: var(--tenant-primary); margin-bottom: 10px;">
                <i class="fa-solid fa-eye"></i> Live Fixed-Boundary Logo Container Preview
              </div>
              <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                <div class="tenant-logo-slot" id="saasLogoPreviewBox" style="border: 1px dashed var(--border); padding: 6px; border-radius: 6px; background: rgba(0,0,0,0.2);">
                  ${tenantData.theme.logoUrl ? `<img src="${tenantData.theme.logoUrl}" id="saasLogoPreviewImg">` : '<span style="color:var(--txt-muted); font-size:12px;">No Logo Uploaded</span>'}
                </div>
                <div>
                  <label class="btn btn-secondary btn-sm" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-upload"></i> Upload Logo (PNG/SVG/WebP, max 2MB)
                    <input type="file" id="saasFileLogo" accept="image/png, image/jpeg, image/webp, image/svg+xml" style="display: none;">
                  </label>
                  <button type="button" class="btn btn-ghost btn-sm" id="saasBtnRemoveLogo" style="color: var(--red); margin-left: 6px;">Remove</button>
                </div>
              </div>
            </div>

            <div class="form-grid cols-3" style="gap: 12px;">
              <div class="field">
                <label>Primary Brand Color</label>
                <div style="display: flex; gap: 8px;">
                  <input type="color" id="saasColorPrimary" value="${tenantData.theme.primaryColor || '#008080'}" style="width: 44px; height: 38px; padding: 2px; border: none; border-radius: 6px; cursor: pointer;">
                  <input type="text" id="saasColorPrimaryText" value="${tenantData.theme.primaryColor || '#008080'}" style="flex: 1;">
                </div>
              </div>
              <div class="field">
                <label>Secondary Color</label>
                <div style="display: flex; gap: 8px;">
                  <input type="color" id="saasColorSecondary" value="${tenantData.theme.secondaryColor || '#005a5a'}" style="width: 44px; height: 38px; padding: 2px; border: none; border-radius: 6px; cursor: pointer;">
                  <input type="text" id="saasColorSecondaryText" value="${tenantData.theme.secondaryColor || '#005a5a'}" style="flex: 1;">
                </div>
              </div>
              <div class="field">
                <label>Accent / Highlight Color</label>
                <div style="display: flex; gap: 8px;">
                  <input type="color" id="saasColorAccent" value="${tenantData.theme.accentColor || '#e5a93c'}" style="width: 44px; height: 38px; padding: 2px; border: none; border-radius: 6px; cursor: pointer;">
                  <input type="text" id="saasColorAccentText" value="${tenantData.theme.accentColor || '#e5a93c'}" style="flex: 1;">
                </div>
              </div>
              <div class="field">
                <label>Card Corner Radius</label>
                <select id="saasSelectRadius">
                  <option value="0px" ${tenantData.theme.cardRadius === '0px' ? 'selected' : ''}>0px (Sharp)</option>
                  <option value="6px" ${tenantData.theme.cardRadius === '6px' ? 'selected' : ''}>6px (Subtle)</option>
                  <option value="12px" ${tenantData.theme.cardRadius === '12px' || !tenantData.theme.cardRadius ? 'selected' : ''}>12px (Standard)</option>
                  <option value="16px" ${tenantData.theme.cardRadius === '16px' ? 'selected' : ''}>16px (Modern)</option>
                  <option value="20px" ${tenantData.theme.cardRadius === '20px' ? 'selected' : ''}>20px (Pill)</option>
                </select>
              </div>
              <div class="field">
                <label>Card Elevation Shadow</label>
                <select id="saasSelectShadow">
                  <option value="none" ${tenantData.theme.cardShadow === 'none' ? 'selected' : ''}>None</option>
                  <option value="0 4px 12px rgba(0,0,0,0.2)" ${tenantData.theme.cardShadow === '0 4px 12px rgba(0,0,0,0.2)' ? 'selected' : ''}>Subtle</option>
                  <option value="0 8px 24px rgba(0, 0, 0, 0.35)" ${tenantData.theme.cardShadow === '0 8px 24px rgba(0, 0, 0, 0.35)' || !tenantData.theme.cardShadow ? 'selected' : ''}>Elevated</option>
                  <option value="0 12px 36px rgba(0,0,0,0.5)" ${tenantData.theme.cardShadow === '0 12px 36px rgba(0,0,0,0.5)' ? 'selected' : ''}>Deep Glow</option>
                </select>
              </div>
              <div class="field">
                <label>Typography Font Family</label>
                <select id="saasSelectFont">
                  <option value="'Segoe UI', system-ui, sans-serif" ${tenantData.theme.fontFamily && tenantData.theme.fontFamily.includes('Segoe') ? 'selected' : ''}>Segoe UI</option>
                  <option value="'Inter', system-ui, sans-serif" ${tenantData.theme.fontFamily && tenantData.theme.fontFamily.includes('Inter') ? 'selected' : ''}>Inter</option>
                  <option value="'Roboto', system-ui, sans-serif" ${tenantData.theme.fontFamily && tenantData.theme.fontFamily.includes('Roboto') ? 'selected' : ''}>Roboto</option>
                  <option value="'Poppins', system-ui, sans-serif" ${tenantData.theme.fontFamily && tenantData.theme.fontFamily.includes('Poppins') ? 'selected' : ''}>Poppins</option>
                </select>
              </div>
            </div>

            <div class="field" style="margin-top: 10px;">
              <label>Custom CSS Overrides</label>
              <textarea id="saasInputCustomCss" rows="3" placeholder=":root { --custom-var: #123; }">${tenantData.theme.customCss || ''}</textarea>
            </div>
          </div>

          <!-- 3. FEATURE MATRIX TAB -->
          <div class="saas-panel-tab" id="saasTabFeatures" style="display: none;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
              <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer;">
                <span><i class="fa-solid fa-boxes-stacked" style="color: var(--tenant-primary); margin-right: 6px;"></i> Inventory &amp; Stock Master</span>
                <input type="checkbox" id="saasFeatInventory" ${tenantData.features.inventoryEnabled ? 'checked' : ''} style="width: 18px; height: 18px;">
              </label>
              <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer;">
                <span><i class="fa-solid fa-file-invoice-dollar" style="color: var(--tenant-accent); margin-right: 6px;"></i> GST Invoicing &amp; Sales</span>
                <input type="checkbox" id="saasFeatGst" ${tenantData.features.gstInvoicing ? 'checked' : ''} style="width: 18px; height: 18px;">
              </label>
              <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer;">
                <span><i class="fa-solid fa-screwdriver-wrench" style="color: var(--purple); margin-right: 6px;"></i> BOM Assembly &amp; Challan</span>
                <input type="checkbox" id="saasFeatBom" ${tenantData.features.bomEnabled ? 'checked' : ''} style="width: 18px; height: 18px;">
              </label>
              <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer;">
                <span><i class="fa-solid fa-barcode" style="color: var(--blue); margin-right: 6px;"></i> Serial Number Tracking</span>
                <input type="checkbox" id="saasFeatSerial" ${tenantData.features.serialTracking ? 'checked' : ''} style="width: 18px; height: 18px;">
              </label>
              <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer;">
                <span><i class="fa-solid fa-receipt" style="color: #2ecc71; margin-right: 6px;"></i> Accounting Vouchers (F5-F7)</span>
                <input type="checkbox" id="saasFeatVouchers" ${tenantData.features.vouchersEnabled ? 'checked' : ''} style="width: 18px; height: 18px;">
              </label>
              <label style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer;">
                <span><i class="fa-solid fa-warehouse" style="color: var(--orange); margin-right: 6px;"></i> Multi-Branch Godown Sync</span>
                <input type="checkbox" id="saasFeatBranch" ${tenantData.features.multiBranch ? 'checked' : ''} style="width: 18px; height: 18px;">
              </label>
            </div>
          </div>

          <!-- 4. TERMINOLOGY CUSTOMIZATION TAB -->
          <div class="saas-panel-tab" id="saasTabTerminology" style="display: none;">
            <p style="font-size: 12px; color: var(--txt-muted); margin: 0 0 12px 0;">
              Customize domain entity terminology to adapt to client-specific business models (e.g. Channel Partners vs Customers).
            </p>
            <div class="form-grid cols-2">
              <div class="field">
                <label>Client Entity Alias</label>
                <input type="text" id="saasTermClient" value="${(tenantData.terminology && tenantData.terminology.client_alias) || 'Customer'}" placeholder="e.g. Dealer / Partner / Customer">
              </div>
              <div class="field">
                <label>Supplier Entity Alias</label>
                <input type="text" id="saasTermSupplier" value="${(tenantData.terminology && tenantData.terminology.supplier_alias) || 'Supplier'}" placeholder="e.g. Vendor / Distributor">
              </div>
              <div class="field">
                <label>Item / Product Alias</label>
                <input type="text" id="saasTermItem" value="${(tenantData.terminology && tenantData.terminology.item_alias) || 'Product / Item'}" placeholder="e.g. Solar Component / SKU">
              </div>
              <div class="field">
                <label>Dispatch / Invoice Alias</label>
                <input type="text" id="saasTermInvoice" value="${(tenantData.terminology && tenantData.terminology.invoice_alias) || 'Delivery Challan / Invoice'}" placeholder="e.g. Tax Invoice / Challan">
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; border-top: 1px solid var(--border-light); padding-top: 14px;">
            <button type="button" class="btn btn-ghost" onclick="window.closeModal()">Cancel</button>
            <button type="button" class="btn btn-tenant-primary" id="btnSaveTenantProfile">
              <i class="fa-solid fa-floppy-disk"></i> Save Tenant Configuration
            </button>
          </div>
        </div>
      `;

      window.openModal(tenantId ? `⚙️ White-Label Studio: ${tenantData.name}` : '✨ Register New Tenant Organization', modalHtml, { size: 'large' });

      // Tab switching
      const tabBtns = document.querySelectorAll('.saas-modal-layout .subtab');
      const tabPanels = document.querySelectorAll('.saas-panel-tab');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          tabPanels.forEach(p => p.style.display = 'none');
          btn.classList.add('active');
          const target = document.getElementById(btn.getAttribute('data-tab'));
          if (target) target.style.display = 'block';
        });
      });

      // Synchronize color inputs
      const colorPairs = [
        ['saasColorPrimary', 'saasColorPrimaryText'],
        ['saasColorSecondary', 'saasColorSecondaryText'],
        ['saasColorAccent', 'saasColorAccentText']
      ];
      colorPairs.forEach(([pickerId, textId]) => {
        const picker = document.getElementById(pickerId);
        const text = document.getElementById(textId);
        if (picker && text) {
          picker.addEventListener('input', () => text.value = picker.value);
          text.addEventListener('input', () => { if (/^#[0-9A-F]{6}$/i.test(text.value)) picker.value = text.value; });
        }
      });

      // Handle Logo Upload with client compression
      let uploadedLogoBase64 = tenantData.theme.logoUrl;
      const fileInp = document.getElementById('saasFileLogo');
      const previewBox = document.getElementById('saasLogoPreviewBox');
      const btnRemoveLogo = document.getElementById('saasBtnRemoveLogo');

      if (fileInp) {
        fileInp.addEventListener('change', async () => {
          const file = fileInp.files[0];
          if (!file) return;
          try {
            const dataUrl = await window.validateAndCompressTenantAsset(file, 2);
            uploadedLogoBase64 = dataUrl;
            if (previewBox) {
              previewBox.innerHTML = `<img src="${dataUrl}" style="max-height:100%; max-width:100%; object-fit:contain;">`;
            }
          } catch (err) {
            if (window.showToast) window.showToast(err.message, 'error');
          }
        });
      }

      if (btnRemoveLogo) {
        btnRemoveLogo.addEventListener('click', () => {
          uploadedLogoBase64 = null;
          if (previewBox) previewBox.innerHTML = '<span style="color:var(--txt-muted); font-size:12px;">No Logo Uploaded</span>';
        });
      }

      // Handle Save
      const btnSave = document.getElementById('btnSaveTenantProfile');
      if (btnSave) {
        btnSave.addEventListener('click', async () => {
          const name = (document.getElementById('saasInputName').value || '').trim();
          const slug = (document.getElementById('saasInputSlug').value || '').trim().toLowerCase();
          const customDomain = (document.getElementById('saasInputDomain').value || '').trim();
          const status = document.getElementById('saasSelectStatus').value;

          if (!name || !slug) {
            if (window.showToast) window.showToast('Name and Slug are required.', 'warning');
            return;
          }

          const payload = {
            name,
            slug,
            customDomain: customDomain || null,
            status,
            plan: 'enterprise',
            theme: {
              primaryColor: document.getElementById('saasColorPrimary').value,
              secondaryColor: document.getElementById('saasColorSecondary').value,
              accentColor: document.getElementById('saasColorAccent').value,
              cardRadius: document.getElementById('saasSelectRadius').value,
              cardShadow: document.getElementById('saasSelectShadow').value,
              fontFamily: document.getElementById('saasSelectFont').value,
              logoUrl: uploadedLogoBase64,
              customCss: document.getElementById('saasInputCustomCss').value
            },
            features: {
              inventoryEnabled: document.getElementById('saasFeatInventory').checked,
              gstInvoicing: document.getElementById('saasFeatGst').checked,
              bomEnabled: document.getElementById('saasFeatBom').checked,
              serialTracking: document.getElementById('saasFeatSerial').checked,
              vouchersEnabled: document.getElementById('saasFeatVouchers').checked,
              multiBranch: document.getElementById('saasFeatBranch').checked,
              exportReports: true
            },
            terminology: {
              client_alias: (document.getElementById('saasTermClient').value || '').trim() || 'Customer',
              supplier_alias: (document.getElementById('saasTermSupplier').value || '').trim() || 'Supplier',
              item_alias: (document.getElementById('saasTermItem').value || '').trim() || 'Product / Item',
              invoice_alias: (document.getElementById('saasTermInvoice').value || '').trim() || 'Delivery Challan / Invoice'
            }
          };

          try {
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

            if (tenantId) {
              await window.Api.put(`/saas/tenants/${tenantId}`, payload);
              if (window.showToast) window.showToast('Tenant configuration updated successfully.', 'success');
            } else {
              await window.Api.post('/saas/tenants', payload);
              if (window.showToast) window.showToast(`Tenant "${name}" created successfully.`, 'success');
            }

            window.closeModal();
            loadTenants();

            // Refresh current active theme if edited tenant is currently selected
            if (slug === localStorage.getItem('egs_tenant_slug')) {
              window.TenantContext.reload();
            }
          } catch (err) {
            btnSave.disabled = false;
            btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Tenant Configuration';
            if (window.showToast) window.showToast(err.message, 'error');
          }
        });
      }
    };

    window.deleteTenantConfirm = function (id, name) {
      if (window.confirmDanger) {
        window.confirmDanger(
          'Delete Organization Workspace?',
          `Are you sure you want to delete the tenant "<strong>${name}</strong>"? All associated isolated configuration will be removed.`
        ).then(async (confirmed) => {
          if (confirmed) {
            try {
              await window.Api.delete(`/saas/tenants/${id}`);
              if (window.showToast) window.showToast('Tenant removed successfully.', 'success');
              loadTenants();
            } catch (err) {
              if (window.showToast) window.showToast(err.message, 'error');
            }
          }
        });
      }
    };

    loadTenants();
  }
};
