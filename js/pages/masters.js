// js/pages/masters.js
window.PAGES = window.PAGES || {};

window.PAGES.masters = {
  name: "Masters",
  icon: "fa-database",
  sub: "Manage items registration, warehouses & property restrictions",
  html: `
    <div class="page-head" id="mastersPageHead">
      <i class="fa-solid fa-boxes-stacked" style="color:var(--blue);" id="mastersPageHeadIcon"></i>
      <h2 id="mastersPageHeadTitle">Item &amp; Product Master</h2>
    </div>

    <div class="subtabs" id="mastersSubtabs" style="display:none;">
      <button class="subtab active" data-sub="item-reg"><i class="fa-solid fa-boxes-stacked"></i> Item Master</button>
      <button class="subtab" data-sub="category"><i class="fa-solid fa-tags"></i> Category & Subtypes</button>
      <button class="subtab" data-sub="brand"><i class="fa-solid fa-trademark"></i> Brand Directory</button>
      <button class="subtab" data-sub="warehouse"><i class="fa-solid fa-warehouse"></i> Warehouse Master</button>
      <button class="subtab" data-sub="uom"><i class="fa-solid fa-ruler-combined"></i> UOM Master</button>
      <button class="subtab" data-sub="users"><i class="fa-solid fa-user-shield"></i> User Accounts</button>
    </div>

    <div class="subtab-panel active" data-panel="item-reg">

      <!-- TOP PANEL: 3-STEP ITEM PROFILER -->
      <div class="panel" id="mItemCreatePanel" style="margin-bottom:18px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:10px; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <h3 id="mItemFormHeading" style="margin:0;"><i class="fa-solid fa-box-open" style="color:var(--gold);"></i> Item Profiler &amp; Registration</h3>
            <button type="button" class="info-btn" data-info="Create product master templates. Subtypes (DCR, Non-DCR, Hybrid, etc.) are selected dynamically during Purchase Inward."><i class="fa-solid fa-circle-info"></i></button>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-ghost" id="mBtnImportItems" style="background:#1F7A4D; padding:6px 14px; font-size:12px; border-radius:20px;"><i class="fa-solid fa-file-import"></i> Upload Excel</button>
            <button class="btn btn-ghost" id="mBtnDownloadItemTemplate" style="background:#4B6584; padding:6px 14px; font-size:12px; border-radius:20px;"><i class="fa-solid fa-download"></i> Download Template</button>
            <input type="file" id="mItemImportFile" accept=".csv,.xlsx,.xls" style="display:none;">
          </div>
        </div>

        <div class="masters-step-grid">
          <!-- STEP 1: CATEGORY SELECTION & LIVE SMART STATUS -->
          <div class="master-step-block">
            <div class="master-step-title"><span class="step-num">1</span> Product Classification</div>
            <div class="field">
              <label>Select Category <span class="req">*</span></label>
              <select id="mItemCatDropdown"></select>
            </div>
            <div class="category-meta-chips" id="mCategoryMetaChips" style="margin-top:10px;">
              <span class="chip chip-gold active" id="chipWattStatus"><i class="fa-solid fa-bolt"></i> Wattage Tracked</span>
              <span class="chip chip-blue active" id="chipSerialStatus"><i class="fa-solid fa-barcode"></i> Serial No. Required</span>
              <span class="chip active" id="chipSubtypesStatus"><i class="fa-solid fa-tags"></i> Subtypes: Loading...</span>
            </div>
            <input type="checkbox" id="cfgWattMandatory" style="display:none;">
            <input type="checkbox" id="cfgSerialMandatory" style="display:none;">
          </div>

          <!-- STEP 2: BRAND & SPECIFICATION -->
          <div class="master-step-block">
            <div class="master-step-title"><span class="step-num">2</span> Brand &amp; Specifications</div>
            <div class="field">
              <label>Brand Name <span class="req">*</span></label>
              <input id="mItemBrandInput" placeholder="e.g. Adani, Vikram, Waree..." list="mExistingBrandsList" autocomplete="off">
              <datalist id="mExistingBrandsList"></datalist>
            </div>
            <div class="field" id="mItemWattField" style="margin-top:10px;">
              <label>Wattage / Capacity <span class="req" id="mItemWattReq">*</span></label>
              <div style="display:flex; gap:6px;">
                <input id="mItemWattInput" placeholder="e.g. 545" style="flex:1;">
                <select id="mItemWattUnitDropdown" style="width:82px;">
                  <option value="W" selected>W</option>
                  <option value="kW">kW</option>
                </select>
              </div>
            </div>
            <div class="field" id="mItemModelField" style="display:none; margin-top:10px;">
              <label>Model / Specification <span class="req" id="mItemModelReq">*</span></label>
              <input id="mItemModelInput" placeholder="e.g. 1.5 X 1.5, 4Pole / 3Phase">
            </div>
          </div>

          <!-- STEP 3: INVENTORY PARAMETERS & ALERT THRESHOLD -->
          <div class="master-step-block">
            <div class="master-step-title"><span class="step-num">3</span> Inventory &amp; Stock Controls</div>
            <div class="field">
              <label>Unit of Measure (UOM) <span class="req">*</span></label>
              <select id="mItemUomDropdown"></select>
            </div>
            <div class="field" style="margin-top:10px;">
              <label>Low Stock Alert Level</label>
              <input type="number" min="0" id="mItemMinStockInput" value="0" placeholder="Minimum stock warning">
            </div>
          </div>
        </div>

        <div class="actions-row" style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-red" id="mBtnCancelItemEdit" style="display:none;"><i class="fa-solid fa-xmark"></i> Cancel</button>
          <button class="btn btn-blue" id="mBtnSaveItem"><i class="fa-solid fa-floppy-disk"></i> Save Product Profile</button>
        </div>
      </div>

      <!-- BOTTOM PANEL: REGISTERED CATALOG & QUICK SEARCH -->
      <div class="panel" id="mItemCatalogPanel">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
          <h3 style="margin:0;"><i class="fa-solid fa-table-list" style="color:var(--gold);"></i> Registered Inventory Catalog</h3>
        </div>

        <!-- Stats Bar -->
        <div class="masters-stats-row" id="mastersItemStatsRow" style="margin-bottom:14px;">
          <div class="masters-stat-item"><i class="fa-solid fa-cubes"></i> Total Products: <strong id="mStatTotalItems">0</strong></div>
          <div class="masters-stat-item"><i class="fa-solid fa-bolt" style="color:#f39c12;"></i> Watt-Tracked: <strong id="mStatWattItems">0</strong></div>
          <div class="masters-stat-item"><i class="fa-solid fa-barcode" style="color:#3b8ed0;"></i> Serial-Tracked: <strong id="mStatSerialItems">0</strong></div>
        </div>

        <!-- Search & Filter Bar with modern rounded glass look -->
        <div class="masters-filter-bar" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <div class="search-mini" style="flex:1 1 200px; min-width:0; max-width:540px;">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" id="mItemSearchInput" placeholder="Quick search by Brand, Category, Wattage, Model..." autocomplete="off">
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <label style="font-size:12.5px; color:var(--txt-muted); white-space:nowrap;"><i class="fa-solid fa-filter"></i> Category:</label>
            <select id="mItemFilterCatDropdown" style="border-radius:20px; min-width:min(180px, 100%); padding:7px 14px; font-size:12.5px;">
              <option value="">All Categories</option>
            </select>
          </div>
        </div>

        <div class="table-wrap" style="overflow-x:auto;"><table>
          <thead><tr><th>Category</th><th>Brand</th><th>Watt / Model</th><th>Subtype</th><th>Alert Stock</th><th>UOM</th><th>Actions</th></tr></thead>
          <tbody id="mastersItemBody">
            ${window.Skeleton ? window.Skeleton.tableRows(7, 6, { pillCols: [0, 3] }) : ''}
          </tbody>
        </table></div>
      </div>

    </div>

    <div class="subtab-panel" data-panel="category">
      <div class="grid-2" style="align-items:start; gap:18px;">
        
        <!-- LEFT COLUMN: Category Form & Subtype Management -->
        <div style="display:flex; flex-direction:column; gap:18px;">
          <!-- Category Form Panel -->
          <div class="panel">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:10px;">
              <h3 id="mCatFormHeading" style="margin:0;"><i class="fa-solid fa-plus" style="color:var(--green);"></i> Add New Category</h3>
            </div>
            <div class="form-grid">
              <div class="field span-2"><label>Category Name <span class="req">*</span></label><input id="mInputCatName" placeholder="e.g. Structure, Battery, Solar Panel..." autocomplete="off"></div>
              <div class="field span-2">
                <div style="display:flex; flex-direction:column; gap:10px; margin:6px 0 10px;">
                  <label class="master-toggle-pill" id="mToggleWattLabel" style="display:flex; align-items:center; gap:12px; padding:12px 14px; background:var(--input-bg); border:1px solid var(--border-light); border-radius:10px; cursor:pointer; transition:all .2s ease;">
                    <input type="checkbox" id="mInputCatWattMandatory" style="accent-color:var(--gold); width:18px; height:18px; cursor:pointer;">
                    <div style="flex:1;">
                      <div style="font-weight:700; font-size:13px; color:var(--txt);"><i class="fa-solid fa-bolt" style="color:var(--gold); margin-right:6px;"></i> Wattage / Capacity Tracking</div>
                      <div style="font-size:11.5px; color:var(--txt-muted);">Make Wattage/Capacity mandatory for items in this category</div>
                    </div>
                  </label>
                  <label class="master-toggle-pill" id="mToggleSerialLabel" style="display:flex; align-items:center; gap:12px; padding:12px 14px; background:var(--input-bg); border:1px solid var(--border-light); border-radius:10px; cursor:pointer; transition:all .2s ease;">
                    <input type="checkbox" id="mInputCatSerialMandatory" style="accent-color:var(--blue); width:18px; height:18px; cursor:pointer;">
                    <div style="flex:1;">
                      <div style="font-weight:700; font-size:13px; color:var(--txt);"><i class="fa-solid fa-barcode" style="color:var(--blue); margin-right:6px;"></i> Serial Number Tracking</div>
                      <div style="font-size:11.5px; color:var(--txt-muted);">Make unique Serial Number scanning mandatory on inward &amp; dispatch</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div class="actions-row" style="margin-top:14px; display:flex; gap:8px;">
              <button class="btn btn-blue" id="mBtnSaveCat" style="flex:1; justify-content:center;"><i class="fa-solid fa-floppy-disk"></i> Save Category</button>
              <button type="button" class="btn btn-ghost" id="mBtnCancelCatEdit" style="display:none; justify-content:center;"><i class="fa-solid fa-xmark"></i> Cancel</button>
            </div>
          </div>

          <!-- Subtype / Variant Management Panel -->
          <div class="panel">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:10px;">
              <h3 id="mSubFormHeading" style="margin:0;"><i class="fa-solid fa-tags" style="color:var(--blue);"></i> Subtype / Variant Management</h3>
            </div>
            <div class="form-grid cols-2">
              <div class="field"><label>Target Category <span class="req">*</span></label><select id="mSubTargetCat"></select></div>
              <div class="field"><label>Subtype Name <span class="req">*</span></label><input id="mInputSubName" placeholder="e.g. DCR, Non-DCR, Hybrid..." autocomplete="off"></div>
            </div>
            <div class="actions-row" style="margin-top:12px; display:flex; gap:8px;">
              <button class="btn btn-green" id="mBtnSaveSub" style="flex:1; justify-content:center;"><i class="fa-solid fa-plus"></i> Add Subtype</button>
              <button type="button" class="btn btn-ghost" id="mBtnCancelSubEdit" style="display:none; justify-content:center;"><i class="fa-solid fa-xmark"></i> Cancel</button>
            </div>
            <div class="table-wrap" style="margin-top:14px; max-height:250px; overflow-y:auto;">
              <table>
                <thead><tr><th>Subtype / Type</th><th style="width:90px; text-align:right;">Actions</th></tr></thead>
                <tbody id="mastersSubtypeBody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: Category List Table -->
        <div class="panel" style="display:flex; flex-direction:column;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:10px;">
            <h3 style="margin:0;"><i class="fa-solid fa-list" style="color:var(--gold);"></i> Category List</h3>
          </div>
          <div class="table-wrap" style="flex:1; max-height:calc(100vh - 230px); overflow-y:auto;">
            <table>
              <thead><tr><th>Category Name</th><th>Linked Products</th><th>Watt Rule</th><th>Serial Rule</th><th>Actions</th></tr></thead>
              <tbody id="mastersCategoryBody"></tbody>
            </table>
          </div>
        </div>

      </div>
    </div>

    <div class="subtab-panel" data-panel="brand">
      <div class="panel">
        <h3><i class="fa-solid fa-trademark"></i> Registered Brand Directory
          <button type="button" class="info-btn" data-info="Brands are dynamically updated from Item Master and Purchase Inward records."><i class="fa-solid fa-circle-info"></i></button>
        </h3>
        <div class="table-wrap"><table><thead><tr><th>Brand Identifier</th><th>Items Registered</th></tr></thead><tbody id="mastersBrandBody"></tbody></table></div>
      </div>
    </div>

    <div class="subtab-panel" data-panel="warehouse">
      <div class="grid-2">
        <div class="panel">
          <h3 id="mWhFormHeading"><i class="fa-solid fa-warehouse"></i> Add New Storage Warehouse</h3>
          <div class="form-grid">
            <div class="field span-2"><label>Warehouse Name *</label><input id="mInputWhName" placeholder="e.g. Main Hub - Surat" autocomplete="off"></div>
            <div class="field span-2"><label>Location Address</label><input id="mInputWhLoc" placeholder="e.g. GIDC Industrial Area" autocomplete="off"></div>
          </div>
          <div class="actions-row">
            <button class="btn btn-blue" id="mBtnSaveWh"><i class="fa-solid fa-save"></i> Save Warehouse</button>
            <button class="btn btn-red" id="mBtnCancelWhEdit" style="display:none;"><i class="fa-solid fa-xmark"></i> Cancel</button>
          </div>
        </div>
        <div class="panel">
          <h3><i class="fa-solid fa-list"></i> Warehouses Configured</h3>
          <div class="table-wrap"><table><thead><tr><th>Warehouse Name</th><th>Active Stock Sourced</th><th>Actions</th></tr></thead><tbody id="mastersWarehouseBody"></tbody></table></div>
        </div>
      </div>
    </div>

    <div class="subtab-panel" data-panel="uom">
      <div class="grid-2">
        <div class="panel">
          <h3 id="mUomFormHeading"><i class="fa-solid fa-ruler-combined"></i> Add Unit of Measure</h3>
          <div class="form-grid"><div class="field span-2"><label>Unit Name *</label><input id="mInputUomName" placeholder="e.g. Nos, Meters, Kg, Box, Bori, Set" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></div></div>
          <div class="actions-row">
            <button class="btn btn-blue" id="mBtnSaveUom"><i class="fa-solid fa-save"></i> Save Unit</button>
            <button class="btn btn-red" id="mBtnCancelUomEdit" style="display:none;"><i class="fa-solid fa-xmark"></i> Cancel</button>
          </div>
        </div>
        <div class="panel">
          <h3><i class="fa-solid fa-list"></i> Units Configured</h3>
          <div class="table-wrap"><table><thead><tr><th>Unit Name</th><th>Actions</th></tr></thead><tbody id="mastersUomBody"></tbody></table></div>
        </div>
      </div>
    </div>

    <div class="subtab-panel" data-panel="users">
      <div class="banner" style="background:rgba(59,142,208,0.12); border:1px solid rgba(59,142,208,0.3); border-radius:10px; padding:12px 18px; margin-bottom:18px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <i class="fa-solid fa-shield-halved" style="color:var(--blue); font-size:20px;"></i>
          <div>
            <strong style="color:#fff; font-size:13.5px;">User Accounts & Role Authorization Control</strong>
            <div style="font-size:12px; color:var(--txt-muted); margin-top:2px;">User management and security can also be accessed anytime via <strong>Avatar Menu ➔ System Settings ➔ Security & 2FA</strong>.</div>
          </div>
        </div>
        <button type="button" class="btn btn-ghost" id="mBtnOpenSettingsUsers" style="font-size:12px; padding:6px 14px;"><i class="fa-solid fa-gear"></i> Open System Settings</button>
      </div>

      <div class="grid-2">
        <div class="panel">
          <h3><i class="fa-solid fa-user-lock"></i> Create / Update Authorization Account
            <button type="button" class="info-btn" data-info="To change a password: click the user's row in the Access Control Ledger to safely fill in their exact username, enter the new password, then click Update Password."><i class="fa-solid fa-circle-info"></i></button>
          </h3>
          <div class="form-grid">
            <div class="field"><label>Username *</label><input id="mUserNameInput" placeholder="e.g. amit" list="mExistingUsers" autocomplete="off"><datalist id="mExistingUsers"></datalist></div>
            <div class="field"><label>Password / PIN *</label><input type="password" id="mUserPassInput" placeholder="At least 12 characters" autocomplete="new-password"></div>
            <div class="field"><label>System Privilege</label>
              <select id="mUserRoleDropdown"><option value="User">User</option><option value="Admin">Admin</option></select></div>
            <div id="mUserPwdStrengthContainer" style="display:none;" class="span-2"></div>
          </div>
          <div style="color:var(--txt-muted); font-size:12px; margin-top:6px;">Every user needs an email on file for OTP verification during login.</div>
          <div class="actions-row" style="margin-top:10px;">
            <button class="btn btn-blue" id="mBtnAddUser"><i class="fa-solid fa-user-plus"></i> Add New User</button>
            <button class="btn btn-gold" id="mBtnUpdatePass"><i class="fa-solid fa-key"></i> Update Password</button>
            <button class="btn btn-ghost" id="mBtnUpdateEmail"><i class="fa-solid fa-envelope"></i> Update Email</button>
          </div>
        </div>
        <div class="panel">
          <h3><i class="fa-solid fa-users"></i> Access Control Ledger</h3>
          <div class="table-wrap"><table><thead><tr><th>User Profile</th><th>Email</th><th>Role Authorization</th></tr></thead><tbody id="mastersUsersBody"></tbody></table></div>
        </div>
      </div>
    </div>
  `,

  init(opts = {}) {
    const $ = (id) => document.getElementById(id);

    // Register active workspace cleanup
    window.__activeScreenCleanup = () => {
      window.setMasterViewMode = null;
    };

    function scrollList(items) {
      return `<div style="max-height:260px; overflow-y:auto; margin-top:8px; padding:8px 10px; border:1px solid rgba(255,255,255,0.12); border-radius:6px; font-size:12.5px; line-height:1.6;">${items.join('<br>')}</div>`;
    }

    function mFormatWatt(v) {
      if (v === null || v === undefined || v === '') return '';
      const n = Number(v);
      return Number.isFinite(n) ? String(n) : String(v);
    }
    const API_BASE = window.API_BASE || "http://192.168.0.123:5000/api";

    let cachedItems = [];
    let editingItemId = null;
    let editingItemSolarType = null;
    let cachedCategories = [];
    let editingCatOldName = null;
    let editingWhOldName = null;
    let editingUomOldName = null;
    let editingSubOldName = null;

    const currentRole = window.currentUserRole || 'User';
    const isSuperAdmin = currentRole === 'SuperAdmin';
    const isAdmin = isSuperAdmin || currentRole === 'Admin';

    const roleDropdown = $('mUserRoleDropdown');
    if (roleDropdown && isSuperAdmin && !roleDropdown.querySelector('option[value="SuperAdmin"]')) {
      const opt = document.createElement('option');
      opt.value = 'SuperAdmin';
      opt.textContent = 'SuperAdmin';
      roleDropdown.appendChild(opt);
    }

    if (!isAdmin) {
      const usersTabBtn = document.querySelector('#mastersSubtabs .subtab[data-sub="users"]');
      const usersPanel = document.querySelector('.subtab-panel[data-panel="users"]');
      if (usersTabBtn) usersTabBtn.style.display = 'none';
      if (usersPanel) usersPanel.classList.remove('active');
    }

    // Responsive Subtabs routing engine
    const MASTER_SUB_INFO = {
      'item-reg': { title: 'Item & Product Master', sub: 'Item classification, specifications & inventory rules', icon: 'fa-boxes-stacked' },
      'item-create': { title: 'Create Product Profile', sub: 'New product registration & specifications', icon: 'fa-box-open' },
      'item-catalog': { title: 'Registered Product Catalog', sub: 'View, search & manage registered products', icon: 'fa-table-list' },
      'category': { title: 'Category & Subtypes Master', sub: 'Manage product categories, wattage & serial rules', icon: 'fa-tags' },
      'brand': { title: 'Brand Directory Master', sub: 'Registered manufacturer and supplier brand names', icon: 'fa-trademark' },
      'warehouse': { title: 'Warehouse & Godown Master', sub: 'Storage godowns and dispatch hubs', icon: 'fa-warehouse' },
      'uom': { title: 'Units of Measure (UOM) Master', sub: 'Standard measurement units (Nos, Kg, Meters, Tagara, etc.)', icon: 'fa-ruler-combined' },
      'users': { title: 'User Authorization Master', sub: 'System access privileges and credentials', icon: 'fa-user-shield' }
    };

    function activateSubtab(subKey) {
      const targetSub = (subKey === 'item-create' || subKey === 'item-catalog') ? 'item-reg' : subKey;
      const tabs = document.querySelectorAll("#mastersSubtabs .subtab");
      const panels = document.querySelectorAll(".subtab-panel");
      tabs.forEach((t) => t.classList.toggle("active", t.dataset.sub === targetSub));
      panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === targetSub));

      const info = MASTER_SUB_INFO[subKey] || MASTER_SUB_INFO[targetSub];
      if (info) {
        const pt = document.getElementById('pageTitle');
        const ps = document.getElementById('pageSub');
        const mpt = document.getElementById('mastersPageHeadTitle');
        const mpi = document.getElementById('mastersPageHeadIcon');
        if (pt) pt.textContent = info.title;
        if (ps) ps.textContent = info.sub;
        if (mpt) mpt.textContent = info.title;
        if (mpi && info.icon) mpi.className = `fa-solid ${info.icon}`;
      }
    }

    const tabs = document.querySelectorAll("#mastersSubtabs .subtab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        activateSubtab(tab.dataset.sub);
        loadMastersSystemEngine(tab.dataset.sub);
        try {
          history.replaceState(null, '', `#masters:${tab.dataset.sub}`);
        } catch (e) {}
      });
    });

    // Scoped Data Loading System
    async function loadMastersSystemEngine(targetSub = 'item-reg') {
      subtypeInfoCache = {};
      try {
        if (targetSub === 'category') {
          const cats = await window.Api.get('/masters/categories').catch(() => []);
          cachedCategories = Array.isArray(cats) ? cats : [];
          $('mSubTargetCat').innerHTML = cachedCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
          $('mastersCategoryBody').innerHTML = cachedCategories.map(c => `
            <tr class="m-cat-row" data-cat="${c.name}" data-watt="${c.watt_mandatory ? 1 : 0}" data-serial="${c.serial_mandatory ? 1 : 0}" style="cursor:pointer;" title="Double-click to edit Category">
              <td class="gold-txt" style="font-weight:600;"><i class="fa-solid fa-folder-tree" style="color:var(--gold); margin-right:6px;"></i> ${c.name}</td>
              <td>${c.item_count} items</td>
              <td>
                <button type="button" class="btn-toggle-badge ${c.watt_mandatory ? 'active-gold' : 'inactive'}" data-action="toggle-watt" data-cat="${c.name}" title="Click to toggle Wattage Rule">
                  <i class="fa-solid ${c.watt_mandatory ? 'fa-bolt' : 'fa-circle-dot'}"></i>
                  <span>${c.watt_mandatory ? 'Mandatory' : 'Optional'}</span>
                </button>
              </td>
              <td>
                <button type="button" class="btn-toggle-badge ${c.serial_mandatory ? 'active-blue' : 'inactive'}" data-action="toggle-serial" data-cat="${c.name}" title="Click to toggle Serial Rule">
                  <i class="fa-solid ${c.serial_mandatory ? 'fa-barcode' : 'fa-circle-dot'}"></i>
                  <span>${c.serial_mandatory ? 'Mandatory' : 'Optional'}</span>
                </button>
              </td>
              <td>
                <div style="display:flex; gap:6px; align-items:center;">
                  <button type="button" class="btn btn-ghost m-cat-edit" data-cat="${c.name}" data-watt="${c.watt_mandatory ? 1 : 0}" data-serial="${c.serial_mandatory ? 1 : 0}" style="color:var(--gold); padding:6px 10px; font-size:11px;" title="Edit Category"><i class="fa-solid fa-pen-to-square"></i></button>
                  <button type="button" class="btn btn-red m-cat-delete" data-cat="${c.name}" style="padding:6px 10px; font-size:11px;" title="Delete Category"><i class="fa-solid fa-trash"></i></button>
                </div>
              </td>
            </tr>
          `).join('') || `<tr><td colspan="5" style="text-align:center;color:var(--txt-muted);">No categories yet.</td></tr>`;
          loadSubtypesForCategory($('mSubTargetCat').value);
          const catTable = $('mastersCategoryBody') && $('mastersCategoryBody').closest('table');
          if (catTable && window.attachColumnFilters) window.attachColumnFilters(catTable);
          return;
        }

        if (targetSub === 'warehouse') {
          const whs = await window.Api.get('/masters/warehouses').catch(() => []);
          $('mastersWarehouseBody').innerHTML = (Array.isArray(whs) ? whs : []).map(w => `
            <tr>
              <td style="font-weight:600;">${w.name}</td>
              <td class="gold-txt">${w.items_stored}</td>
              <td>
                <button class="btn btn-blue m-wh-edit" data-name="${w.name}" style="padding:6px 10px; font-size:11px;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-red m-wh-delete" data-name="${w.name}" style="padding:6px 10px; font-size:11px;"><i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>
          `).join('') || `<tr><td colspan="3" style="text-align:center;color:var(--txt-muted);">No warehouses yet.</td></tr>`;
          const whTable = $('mastersWarehouseBody') && $('mastersWarehouseBody').closest('table');
          if (whTable && window.attachColumnFilters) window.attachColumnFilters(whTable);
          return;
        }

        if (targetSub === 'uom') {
          const units = await window.Api.get('/masters/units').catch(() => []);
          $('mastersUomBody').innerHTML = (Array.isArray(units) ? units : []).map(u => `
            <tr>
              <td style="font-weight:600;">${u}</td>
              <td>
                <button class="btn btn-blue m-uom-edit" data-name="${u}" style="padding:6px 10px; font-size:11px;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-red m-uom-delete" data-name="${u}" style="padding:6px 10px; font-size:11px;"><i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>
          `).join('') || `<tr><td colspan="2" style="text-align:center;color:var(--txt-muted);">No units yet.</td></tr>`;
          const uomTable = $('mastersUomBody') && $('mastersUomBody').closest('table');
          if (uomTable && window.attachColumnFilters) window.attachColumnFilters(uomTable);
          return;
        }

        if (targetSub === 'brand') {
          const brands = await window.Api.get('/masters/brands').catch(() => []);
          const brandList = Array.isArray(brands) ? brands : [];
          $('mastersBrandBody').innerHTML = brandList.map(b => `<tr><td class="gold-txt" style="font-weight:600;">${b.brand_name}</td><td>${b.item_count} items</td></tr>`).join('') || `<tr><td colspan="2" style="text-align:center;color:var(--txt-muted);">No brands registered yet.</td></tr>`;
          const existingBrandsList = $('mExistingBrandsList');
          if (existingBrandsList) existingBrandsList.innerHTML = brandList.map(b => `<option value="${b.brand_name}">`).join('');
          const brandTable = $('mastersBrandBody') && $('mastersBrandBody').closest('table');
          if (brandTable && window.attachColumnFilters) window.attachColumnFilters(brandTable);
          return;
        }

        if (targetSub === 'users') {
          const users = await window.Api.get('/masters/users').catch(() => []);
          const userList = Array.isArray(users) ? users : [];
          $('mastersUsersBody').innerHTML = userList.map(u => `<tr class="m-user-row" data-username="${u.username}" style="cursor:pointer;" title="Click to select this username for password/email update"><td><span class="badge" style="background:rgba(255,255,255,0.06); font-weight:600;">${u.username}</span></td><td>${u.email || '<span style="color:var(--txt-muted); font-style:italic;">Not set</span>'}</td><td><span class="badge" style="background:rgba(212,175,55,0.12); color:var(--gold); font-weight:700;">${u.role}</span></td></tr>`).join('') || `<tr><td colspan="3" style="text-align:center;color:var(--txt-muted);">No users yet.</td></tr>`;
          const existingUsersList = $('mExistingUsers');
          if (existingUsersList) existingUsersList.innerHTML = userList.map(u => `<option value="${u.username}">`).join('');
          const usersTable = $('mastersUsersBody') && $('mastersUsersBody').closest('table');
          if (usersTable && window.attachColumnFilters) window.attachColumnFilters(usersTable);
          return;
        }

        // Full Items Workspace (Item creation + Catalog directory)
        const [catsRes, itemsRes, unitsRes, brandsRes] = await Promise.all([
          window.Api.get('/masters/categories').catch(() => []),
          window.Api.get('/masters/items').catch(() => []),
          window.Api.get('/masters/units').catch(() => []),
          window.Api.get('/masters/brands').catch(() => [])
        ]);

        const cats = Array.isArray(catsRes) ? catsRes : [];
        const items = Array.isArray(itemsRes) ? itemsRes : [];
        const units = Array.isArray(unitsRes) ? unitsRes : [];
        const brands = Array.isArray(brandsRes) ? brandsRes : [];

        cachedCategories = cats;
        $('mItemCatDropdown').innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        if ($('mItemFilterCatDropdown')) {
          $('mItemFilterCatDropdown').innerHTML = `<option value="">All Categories</option>` + cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        }
        $('mItemUomDropdown').innerHTML = units.map(u => `<option>${u}</option>`).join('');

        const existingBrandsList = $('mExistingBrandsList');
        if (existingBrandsList) existingBrandsList.innerHTML = brands.map(b => `<option value="${b.brand_name}">`).join('');

        cachedItems = items;
        renderItemsCatalog();
        syncWattMandatoryUI();
      } catch (err) {
        console.error('Error synchronizing core fields dataset:', err);
        const itemBody = $('mastersItemBody');
        if (itemBody && window.Skeleton) {
          itemBody.innerHTML = window.Skeleton.tableError(7, err.message || 'Could not synchronize product masters.', { retryId: 'btnRetryMastersCatalog' });
          window.Skeleton.wireRetry('btnRetryMastersCatalog', () => loadMastersSystemEngine(targetSub));
        }
      }
    }

    function renderItemsCatalog() {
      const q = ($('mItemSearchInput') ? $('mItemSearchInput').value.trim().toLowerCase() : '');
      const filterCat = ($('mItemFilterCatDropdown') ? $('mItemFilterCatDropdown').value : '');

      const filtered = cachedItems.filter(it => {
        if (filterCat && it.category !== filterCat) return false;
        if (!q) return true;
        const brand = (it.brand_name || '').toLowerCase();
        const cat = (it.category || '').toLowerCase();
        const watt = mFormatWatt(it.watt).toLowerCase();
        const model = (it.model || '').toLowerCase();
        const subtype = (it.solar_type || '').toLowerCase();
        return brand.includes(q) || cat.includes(q) || watt.includes(q) || model.includes(q) || subtype.includes(q);
      });

      // Update quick stats counters
      const totalCount = cachedItems.length;
      const wattCount = cachedItems.filter(it => Number(it.watt) > 0).length;
      const serialCount = cachedItems.filter(it => {
        const catInfo = cachedCategories.find(c => c.name === it.category);
        return catInfo && catInfo.serial_mandatory;
      }).length;

      if ($('mStatTotalItems')) $('mStatTotalItems').textContent = totalCount;
      if ($('mStatWattItems')) $('mStatWattItems').textContent = wattCount;
      if ($('mStatSerialItems')) $('mStatSerialItems').textContent = serialCount;

      const body = $('mastersItemBody');
      if (!body) return;

      if (!filtered.length) {
        if (window.Skeleton) {
          body.innerHTML = window.Skeleton.tableEmpty(7, q || filterCat ? 'No matching products found.' : 'No recorded product profiles found.', { icon: 'fa-solid fa-boxes-stacked', desc: 'Try adjusting your search query or category filter.' });
        } else {
          body.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--txt-muted); padding:16px;">${q || filterCat ? 'No matching products found.' : 'No recorded profiles found.'}</td></tr>`;
        }
      } else {
        body.innerHTML = filtered.map(it => `
          <tr class="m-item-row" data-id="${it.id}" style="cursor:pointer;" title="Double-click to edit this product profile">
            <td><span class="badge" style="background:rgba(59,142,208,0.12); color:#66a6ff; font-weight:600; font-size:11.5px; padding:3px 8px; border-radius:6px;">${it.category}</span></td>
            <td class="gold-txt" style="font-weight:700;">${it.brand_name}</td>
            <td>${Number(it.watt) > 0 ? `<strong style="color:var(--txt);">${mFormatWatt(it.watt)} ${it.watt_unit || 'W'}</strong>` : (it.model ? it.model : '-')}</td>
            <td>${it.solar_type && it.solar_type !== '-' ? `<span class="badge" style="background:rgba(212,175,55,0.14); color:var(--gold); font-size:11px; padding:2px 6px; border-radius:4px;">${it.solar_type}</span>` : '-'}</td>
            <td style="color:var(--orange); font-weight:600;">${it.minimum_stock || 0} ${it.uom || 'Nos'}</td>
            <td>${it.uom || 'Nos'}</td>
            <td>
              <button class="btn btn-red m-item-delete" data-id="${it.id}" data-label="${it.brand_name}${Number(it.watt) > 0 ? ' ' + mFormatWatt(it.watt) + (it.watt_unit || 'W') : (it.model ? ' ' + it.model : '')}" style="padding:5px 9px; font-size:11px;" title="Delete item"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `).join('');
      }

      const table = body.closest('table');
      if (table && window.attachColumnFilters) window.attachColumnFilters(table);
    }

    if ($('mItemSearchInput')) $('mItemSearchInput').addEventListener('input', renderItemsCatalog);
    if ($('mItemFilterCatDropdown')) $('mItemFilterCatDropdown').addEventListener('change', renderItemsCatalog);

    if ($('mBtnOpenSettingsUsers')) {
      $('mBtnOpenSettingsUsers').addEventListener('click', () => {
        if (window.openSystemSettingsModal) {
          window.openSystemSettingsModal('security');
        } else {
          const profileBtn = document.getElementById('userProfileMenuBtn');
          if (profileBtn) profileBtn.click();
        }
      });
    }

    function syncWattMandatoryUI(clearIfHidden) {
      const cat = cachedCategories.find(c => c.name === $('mItemCatDropdown').value);
      const wattMandatory = !!(cat && cat.watt_mandatory);
      const serialMandatory = !!(cat && cat.serial_mandatory);

      if ($('cfgWattMandatory')) {
        $('cfgWattMandatory').checked = wattMandatory;
        $('cfgWattMandatory').disabled = true;
      }
      if ($('cfgSerialMandatory')) {
        $('cfgSerialMandatory').checked = serialMandatory;
        $('cfgSerialMandatory').disabled = true;
      }

      // Update Chip Badges
      const chipWatt = $('chipWattStatus');
      if (chipWatt) {
        if (wattMandatory) {
          chipWatt.className = 'chip chip-gold active';
          chipWatt.innerHTML = '<i class="fa-solid fa-bolt"></i> Wattage Tracked';
        } else {
          chipWatt.className = 'chip inactive';
          chipWatt.innerHTML = '<i class="fa-solid fa-bolt"></i> Wattage N/A';
        }
      }

      const chipSerial = $('chipSerialStatus');
      if (chipSerial) {
        if (serialMandatory) {
          chipSerial.className = 'chip chip-blue active';
          chipSerial.innerHTML = '<i class="fa-solid fa-barcode"></i> Serial No. Required';
        } else {
          chipSerial.className = 'chip inactive';
          chipSerial.innerHTML = '<i class="fa-solid fa-boxes-stacked"></i> Qty Tracked (No Serial)';
        }
      }

      const wattField = $('mItemWattField');
      const wattReq = $('mItemWattReq');
      if (wattField) wattField.style.display = wattMandatory ? '' : 'none';
      if (wattReq) wattReq.style.display = wattMandatory ? '' : 'none';
      if (!wattMandatory && clearIfHidden) {
        $('mItemWattInput').value = '';
        $('mItemWattUnitDropdown').value = 'W';
      }

      const showModel = !wattMandatory && !serialMandatory;
      const modelField = $('mItemModelField');
      if (modelField) modelField.style.display = showModel ? '' : 'none';
      if (!showModel && clearIfHidden) $('mItemModelInput').value = '';

      // Update Brand suggestions dynamically for this category
      const catName = cat ? cat.name : '';
      const catBrands = Array.from(
        new Set(
          cachedItems
            .filter((it) => it.category === catName && it.brand_name && it.brand_name.trim())
            .map((it) => it.brand_name.trim())
        )
      ).sort();

      const existingBrandsList = $('mExistingBrandsList');
      if (existingBrandsList) {
        existingBrandsList.innerHTML = catBrands.map((b) => `<option value="${b}">`).join('');
      }

      renderSubtypeInfo(catName);
    }
    $('mItemCatDropdown').addEventListener('change', () => syncWattMandatoryUI(true));

    let subtypeInfoCache = {};
    async function renderSubtypeInfo(catName) {
      const chip = $('chipSubtypesStatus');
      if (!chip) return;
      if (!catName) {
        chip.className = 'chip inactive';
        chip.innerHTML = '<i class="fa-solid fa-tags"></i> No Subtypes';
        return;
      }
      try {
        let subs = subtypeInfoCache[catName];
        if (!subs) {
          subs = await fetch(`${API_BASE}/masters/subtypes/${encodeURIComponent(catName)}`).then(r => r.json());
          subtypeInfoCache[catName] = subs;
        }
        if (subs && subs.length) {
          chip.className = 'chip active';
          chip.innerHTML = `<i class="fa-solid fa-tags"></i> Subtypes: ${subs.join(', ')}`;
        } else {
          chip.className = 'chip inactive';
          chip.innerHTML = '<i class="fa-solid fa-tags"></i> Standard (No Subtypes)';
        }
      } catch (e) {
        chip.className = 'chip inactive';
        chip.innerHTML = '<i class="fa-solid fa-tags"></i> Subtypes N/A';
      }
    }

    function resetItemFormState() {
      editingItemId = null;
      editingItemSolarType = null;
      $("mItemBrandInput").value = "";
      $("mItemWattInput").value = "";
      $("mItemWattUnitDropdown").value = "W";
      $("mItemModelInput").value = "";
      $("mItemMinStockInput").value = "0";
      $("mItemFormHeading").innerHTML =
        `<i class="fa-solid fa-square-plus"></i> Item Profiler & Registration`;
      $("mBtnSaveItem").innerHTML =
        `<i class="fa-solid fa-save"></i> Save Product Profile`;
      $("mBtnCancelItemEdit").style.display = "none";

      if (window.CURRENT_MASTER_MODE === 'alter' || window.CURRENT_MASTER_MODE === 'display') {
        const createPanel = $("mItemCreatePanel");
        if (createPanel) createPanel.style.display = "none";
        const catalogPanel = $("mItemCatalogPanel");
        if (catalogPanel) catalogPanel.style.display = "";
      }
    }
    $("mBtnCancelItemEdit").addEventListener("click", resetItemFormState);

    // Save/Modify Commit Execution with Mandatory Constraints Checks (Python style verification)
    $("mBtnSaveItem").addEventListener("click", async () => {
      const category = $("mItemCatDropdown").value;
      const brand = $("mItemBrandInput").value.trim();
      const watt = parseFloat($("mItemWattInput").value.trim()) || 0;
      const wattUnit = ($("mItemWattUnitDropdown") && $("mItemWattUnitDropdown").value) || "W";
      const model = $("mItemModelInput").value.trim();
      const uom = $("mItemUomDropdown").value;
      const minStock = parseInt($("mItemMinStockInput").value.trim()) || 0;

      if (!brand) {
        window.openModal(
          "Validation Warning",
          "<p>Brand Name field cannot be left blank.</p>",
        );
        return;
      }

      // Wattage/Serial mandatory-ness is driven by the Category Master rule
      // (this form has no per-item override — that's Excel-bulk-import only).
      const catInfo = cachedCategories.find((c) => c.name === category);
      const wattMandatory = !!(catInfo && catInfo.watt_mandatory);
      const serialMandatory = !!(catInfo && catInfo.serial_mandatory);
      if (wattMandatory && watt <= 0) {
        window.openModal(
          "Property Restraint Rule",
          `<p style="color:var(--orange);">Wattage/Capacity is mandatory for category '${category}'. Please provide a numeric value.</p>`,
        );
        return;
      }
      // Goal: when neither Wattage nor Serial No. applies, Model is the
      // mandatory differentiator instead.
      if (!wattMandatory && !serialMandatory && !model) {
        window.openModal(
          "Property Restraint Rule",
          `<p style="color:var(--orange);">Model is mandatory for category '${category}' since Wattage/Serial No. rule does not apply here.</p>`,
        );
        return;
      }

      // Subtype is decided at Purchase Inward time, not here.
      // New registration always starts as '-'; editing keeps whatever real
      // subtype (DCR/Non-DCR/etc.) the item already carries, untouched.
      const finalSolarType = editingItemId ? (editingItemSolarType || "-") : "-";

      const payload = {
        category,
        brand_name: brand,
        watt,
        watt_unit: wattUnit,
        model: model || null,
        solar_type: finalSolarType,
        uom,
        minimum_stock: minStock,
      };
      const url = editingItemId
        ? `${API_BASE}/masters/items/${editingItemId}`
        : `${API_BASE}/masters/items`;
      const method = editingItemId ? "PUT" : "POST";

      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          // Read the backend's real error reason instead of showing a
          // generic message — previously this always said "Database
          // transaction validation execution rejected." no matter what
          // actually went wrong server-side.
          let realMessage = "Could not save this item. Please try again.";
          try {
            const errBody = await res.json();
            if (errBody && errBody.error) realMessage = errBody.error;
          } catch (parseErr) { /* response wasn't JSON — keep the fallback */ }
          throw new Error(realMessage);
        }

        window.showToast(
          editingItemId
            ? "Item attributes configuration updated successfully!"
            : "New inventory unit profile added into table records!",
        );
        resetItemFormState();
        loadMastersSystemEngine();
      } catch (err) {
        window.openModal(
          "Database Error",
          `<p style="color:var(--red);">${err.message}</p>`,
        );
      }
    });

    // ---------------------------------------------------------------------
    // Goal 11 — Excel Upload -> Bulk Item Creation
    // Mirrors partyledger.js's Import/Template pattern (same UX language:
    // Download Template -> fill -> Upload -> per-row summary), but reads
    // real .xlsx/.xls via the SheetJS library already loaded globally in
    // index.html (window.XLSX, used elsewhere for the Scan Sheet feature),
    // with a plain-CSV fallback so a Save-As-CSV export also works.
    // Columns intentionally EXCLUDE Subtype — per the Category Master
    // design, subtype is chosen per purchase invoice line in Purchase
    // Inward, not at item registration.
    // `wattage_mandatory` / `serial_mandatory` columns are OPTIONAL
    // per-row overrides of the Category Master rule (Yes/No — blank means
    // "inherit the category's rule as-is"). `model` is required only for
    // rows where the effective rule needs neither Wattage nor Serial No.
    // ---------------------------------------------------------------------

    function downloadCsvGeneric(filename, rows) {
      const csv = rows.map((r) => r.map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    $('mBtnDownloadItemTemplate').addEventListener('click', () => {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadCsvGeneric(`Item_Registration_Template_${stamp}.csv`, [
        ['category', 'brand_name', 'watt', 'watt_unit', 'model', 'wattage_mandatory', 'serial_mandatory', 'uom', 'minimum_stock'],
        ['Solar Panel', 'Adani', '545', 'W', '', 'Yes', 'No', 'Nos', '5'],
        ['Cable', 'Polycab', '', '', '', 'No', 'No', 'Meters', '20'],
        ['Pipe', 'Astral', '', '', '2 Inch', 'No', 'No', 'Nos', '10'],
        ['Inverter', 'Deye', '5.5', 'kW', '', 'Yes', 'No', 'Nos', '10'],
      ]);
      window.showToast('Item import template downloaded.');
    });

    function normalizeHeaderRow(header) {
      return header.map((h) => String(h || '').trim().toLowerCase().replace(/\s+/g, '_'));
    }

    // Same quoted-CSV splitter used by partyledger.js's import.
    function parseItemsCsv(text) {
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
      if (!lines.length) return [];
      const splitLine = (line) => {
        const out = []; let cur = ''; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (inQuotes) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') { inQuotes = false; }
            else cur += c;
          } else if (c === '"') { inQuotes = true; }
          else if (c === ',') { out.push(cur); cur = ''; }
          else cur += c;
        }
        out.push(cur);
        return out;
      };
      const header = normalizeHeaderRow(splitLine(lines[0]));
      return lines.slice(1).map((line) => {
        const cells = splitLine(line);
        const row = {};
        header.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
        return row;
      });
    }

    // Real .xlsx/.xls parsing via SheetJS (window.XLSX) — first sheet only.
    function parseItemsWorkbook(arrayBuffer) {
      if (typeof window.XLSX === 'undefined') {
        throw new Error('Excel parser library did not load. Please hard-refresh the page (Ctrl+Shift+R) and try again, or upload a .csv file instead.');
      }
      const wb = window.XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const grid = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
      const dataRows = grid.filter((r) => r.some((cell) => String(cell || '').trim().length));
      if (!dataRows.length) return [];
      const header = normalizeHeaderRow(dataRows[0]);
      return dataRows.slice(1).map((cells) => {
        const row = {};
        header.forEach((h, i) => { row[h] = String(cells[i] != null ? cells[i] : '').trim(); });
        return row;
      });
    }

    function valueFromRow(row, keys, def = '') {
      for (const k of keys) { if (row[k] !== undefined && row[k] !== '') return row[k]; }
      return def;
    }

    $('mBtnImportItems').addEventListener('click', () => $('mItemImportFile').click());

    $('mItemImportFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;

      let rawRows;
      try {
        if (/\.(xlsx|xls)$/i.test(file.name)) {
          const buf = await file.arrayBuffer();
          rawRows = parseItemsWorkbook(buf);
        } else if (/\.csv$/i.test(file.name)) {
          rawRows = parseItemsCsv(await file.text());
        } else {
          window.openModal('Unsupported File', '<p>Please select a .xlsx, .xls, or .csv file.</p>');
          return;
        }
      } catch (err) {
        window.openModal('Could Not Read File', `<p style="color:var(--red);">${err.message}</p>`);
        return;
      }

      if (!rawRows.length) {
        window.openModal('No Data', '<p>Selected file has no rows to import.</p>');
        return;
      }

      // Validate every row up-front (category exists + its watt-mandatory
      // rule, brand required, duplicate against already-registered items
      // AND against earlier valid rows in this same file) before creating
      // anything — so the user gets one clear row-by-row report instead of
      // a half-imported mess.
      const existingKeys = new Set(
        cachedItems.map((it) => `${(it.category || '').toLowerCase()}|${(it.brand_name || '').toLowerCase()}|${it.watt || 0}`),
      );
      const catByName = {};
      cachedCategories.forEach((c) => { catByName[c.name.toLowerCase()] = c; });

      // Optional per-row overrides of the Category Master rule — blank/absent
      // means "no override, inherit the category's rule" (see
      // normalizeOverrideFlag() server-side, mirrored here client-side so
      // bad rows are reported before anything is sent to the API).
      function parseOverrideFlag(raw) {
        if (raw === undefined || raw === null || String(raw).trim() === '') return null;
        const s = String(raw).trim().toLowerCase();
        if (['1', 'true', 'yes', 'y', 'mandatory', 'required'].includes(s)) return true;
        if (['0', 'false', 'no', 'n', 'optional', 'not mandatory', 'not required'].includes(s)) return false;
        return null; // unrecognized value -> treat as "not specified"
      }

      const existingModelKeys = new Set(
        cachedItems.filter((it) => !it.watt).map((it) => `${(it.category || '').toLowerCase()}|${(it.brand_name || '').toLowerCase()}|${(it.model || '').toLowerCase()}`),
      );

      const valid = [];
      const rowErrors = [];
      rawRows.forEach((row, idx) => {
        const rowNum = idx + 2; // +1 header, +1 for 1-based row numbering
        const categoryInput = valueFromRow(row, ['category', 'category_name']);
        const brand = valueFromRow(row, ['brand_name', 'brand', 'name']);
        const wattRaw = valueFromRow(row, ['watt', 'wattage', 'capacity']);
        const wattUnitRaw = valueFromRow(row, ['watt_unit', 'wattage_unit', 'unit'], 'W');
        const wattUnit = String(wattUnitRaw || 'W').trim().toLowerCase() === 'kw' ? 'kW' : 'W';
        const model = valueFromRow(row, ['model', 'model_no', 'model_number', 'size']);
        const uom = valueFromRow(row, ['uom', 'unit'], 'Nos');
        const minStock = parseInt(valueFromRow(row, ['minimum_stock', 'min_stock', 'alert_stock']), 10) || 0;
        const watt = parseFloat(wattRaw) || 0;
        const wattOverride = parseOverrideFlag(valueFromRow(row, ['wattage_mandatory', 'watt_mandatory']));
        const serialOverride = parseOverrideFlag(valueFromRow(row, ['serial_mandatory', 'serial_no_mandatory']));

        if (!categoryInput) { rowErrors.push(`Row ${rowNum}: Category is blank.`); return; }
        const catMatch = catByName[categoryInput.toLowerCase()];
        if (!catMatch) { rowErrors.push(`Row ${rowNum}: Unknown category '${categoryInput}'. Create it first in Category Master.`); return; }
        if (!brand) { rowErrors.push(`Row ${rowNum}: Brand Name is blank.`); return; }

        // Effective rule = this row's override if given, else the category's
        // own default from Category Master.
        const effWatt = wattOverride === null ? !!catMatch.watt_mandatory : wattOverride;
        const effSerial = serialOverride === null ? !!catMatch.serial_mandatory : serialOverride;

        if (effWatt && watt <= 0) {
          rowErrors.push(`Row ${rowNum}: Wattage is mandatory for '${brand}' but is blank/zero.`);
          return;
        }
        if (!effWatt && !effSerial && !model) {
          rowErrors.push(`Row ${rowNum}: Model is mandatory for '${brand}' (no Wattage/Serial No. rule applies here).`);
          return;
        }

        const hasWatt = watt > 0;
        const key = hasWatt
          ? `${catMatch.name.toLowerCase()}|${brand.toLowerCase()}|${watt}`
          : `${catMatch.name.toLowerCase()}|${brand.toLowerCase()}|${model.toLowerCase()}`;
        const dupSet = hasWatt ? existingKeys : existingModelKeys;
        if (dupSet.has(key)) {
          rowErrors.push(hasWatt
            ? `Row ${rowNum}: '${brand}' (${watt}W) already exists under '${catMatch.name}' — skipped.`
            : `Row ${rowNum}: '${brand}' (model '${model}') already exists under '${catMatch.name}' — skipped.`);
          return;
        }
        dupSet.add(key);
        valid.push({
          rowNum,
          payload: {
            category: catMatch.name,
            brand_name: brand,
            watt,
            watt_unit: wattUnit,
            model: model || null,
            watt_mandatory: wattOverride,
            serial_mandatory: serialOverride,
            solar_type: '-',
            uom: uom || 'Nos',
            minimum_stock: minStock,
          },
        });
      });

      if (!valid.length) {
        window.openModal('Nothing To Import', `<p>No valid rows found.</p>${rowErrors.length ? `<div style="color:var(--red);">${scrollList(rowErrors)}</div>` : ''}`);
        return;
      }

      if (rowErrors.length) {
        const proceed = await window.confirmDialog(
          'Some Rows Have Issues',
          `<p>${valid.length} row(s) are valid and ready to import. ${rowErrors.length} row(s) will be skipped:</p>${scrollList(rowErrors)}`,
          { kind: 'warning', okLabel: `Import ${valid.length} Valid Row(s)` },
        );
        if (!proceed) return;
      }

      let created = 0;
      const createFailed = [];
      for (const { rowNum, payload } of valid) {
        try {
          const res = await fetch(`${API_BASE}/masters/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (res.ok) created++;
          else createFailed.push(`Row ${rowNum}: ${data.error || 'failed'}`);
        } catch (err) {
          createFailed.push(`Row ${rowNum}: ${err.message}`);
        }
      }

      await loadMastersSystemEngine();
      window.showToast(`${created} item(s) imported successfully.`);
      const reportParts = [];
      if (rowErrors.length) reportParts.push(`<strong style="color:var(--orange);">Skipped before import (${rowErrors.length}):</strong>${scrollList(rowErrors)}`);
      if (createFailed.length) reportParts.push(`<strong style="color:var(--orange);">Failed during import (${createFailed.length}):</strong>${scrollList(createFailed)}`);
      if (reportParts.length) {
        window.openModal('Import Summary', `<div style="font-size:12.5px;">${reportParts.join('<div style="height:10px;"></div>')}</div>`);
      }
    });

    function loadCategoryIntoForm(catName, wattMandatory, serialMandatory) {
      editingCatOldName = catName;
      $("mInputCatName").value = catName;
      $("mInputCatWattMandatory").checked = !!Number(wattMandatory);
      $("mInputCatSerialMandatory").checked = !!Number(serialMandatory);
      $("mCatFormHeading").innerHTML = `<i class="fa-solid fa-pen-to-square" style="color:var(--gold);"></i> Edit Category: ${catName}`;
      $("mBtnSaveCat").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Category';
      $("mBtnCancelCatEdit").style.display = 'inline-flex';
      if ($("mSubTargetCat")) {
        $("mSubTargetCat").value = catName;
        loadSubtypesForCategory(catName);
      }
      $("mInputCatName").focus();
      $("mInputCatName").scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function resetCatForm() {
      editingCatOldName = null;
      $("mInputCatName").value = "";
      $("mInputCatWattMandatory").checked = false;
      $("mInputCatSerialMandatory").checked = false;
      $("mCatFormHeading").innerHTML = '<i class="fa-solid fa-plus" style="color:var(--green);"></i> Add New Category';
      $("mBtnSaveCat").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Category';
      $("mBtnCancelCatEdit").style.display = 'none';
    }

    // Save Category handler click event (create + edit)
    $("mBtnSaveCat").addEventListener("click", async () => {
      const name = $("mInputCatName").value.trim();
      if (!name) {
        window.openModal("Validation Error", "<p>Category name cannot be blank.</p>");
        return;
      }
      try {
        if (editingCatOldName) {
          const res = await fetch(`${API_BASE}/masters/categories/${encodeURIComponent(editingCatOldName)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              watt_mandatory: $('mInputCatWattMandatory').checked,
              serial_mandatory: $('mInputCatSerialMandatory').checked
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not update this category.");
          window.showToast(`Category '${name}' updated.`);
        } else {
          const res = await fetch(`${API_BASE}/masters/categories`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              watt_mandatory: $('mInputCatWattMandatory').checked,
              serial_mandatory: $('mInputCatSerialMandatory').checked
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not save this category.");
          window.showToast(`Category '${name}' added.`);
        }
        resetCatForm();
        loadMastersSystemEngine();
      } catch (err) {
        window.openModal("Database Error", `<p style="color:var(--red);">${err.message}</p>`);
      }
    });

    // Cancel category edit
    $("mBtnCancelCatEdit").addEventListener("click", () => {
      resetCatForm();
    });

    // Save Warehouse click event (create + edit)
    $("mBtnSaveWh").addEventListener("click", async () => {
      const name = $("mInputWhName").value.trim();
      const location = $("mInputWhLoc").value.trim();
      if (!name) return;
      try {
        if (editingWhOldName) {
          const res = await fetch(`${API_BASE}/masters/warehouses`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ old_name: editingWhOldName, new_name: name }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          window.showToast(`Warehouse renamed to '${name}'.`);
        } else {
          await fetch(`${API_BASE}/masters/warehouses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, location }),
          });
          window.showToast("Warehouse cluster committed.");
        }
        resetWhForm();
        loadMastersSystemEngine();
      } catch (err) {
        window.openModal(
          "Database Error",
          `<p style="color:var(--red);">${err.message}</p>`,
        );
      }
    });

    // --- Item Registration: DOUBLE-click row to load into edit form ---
    // (matches the info-icon tooltip above the table, and keeps a single
    // click free for the row's own Delete button below).
    $("mastersItemBody").addEventListener("dblclick", (e) => {
      if (e.target.closest(".m-item-delete")) return;
      const row = e.target.closest(".m-item-row");
      if (!row) return;
      const match = cachedItems.find((i) => String(i.id) === String(row.dataset.id));
      if (!match) return;
      editingItemId = match.id;
      editingItemSolarType = match.solar_type || "-";
      $("mItemCatDropdown").value = match.category;
      $("mItemBrandInput").value = match.brand_name;
      $("mItemWattInput").value = Number(match.watt) > 0 ? mFormatWatt(match.watt) : "";
      $("mItemWattUnitDropdown").value = match.watt_unit || "W";
      $("mItemModelInput").value = match.model || "";
      $("mItemUomDropdown").value = match.uom || "Nos";
      $("mItemMinStockInput").value = match.minimum_stock || 0;
      syncWattMandatoryUI();
      $("mItemFormHeading").innerHTML =
        '<i class="fa-solid fa-pen-to-square" style="color:var(--gold);"></i> Update Product Master';
      $("mBtnSaveItem").innerHTML =
        '<i class="fa-solid fa-floppy-disk"></i> Update Product Profile';
      $("mBtnCancelItemEdit").style.display = "inline-block";

      const createPanel = $("mItemCreatePanel");
      if (createPanel) {
        createPanel.style.display = "";
        createPanel.scrollIntoView({ behavior: 'smooth' });
      }
    });

    // --- Item Registration: single-click Delete button (per row) ---
    $("mastersItemBody").addEventListener("click", async (e) => {
      const btn = e.target.closest(".m-item-delete");
      if (!btn) return;
      const id = btn.dataset.id;
      const label = btn.dataset.label || "this item";
      if (!(await window.confirmDanger("Delete Item", `Delete item '${label}' permanently? This cannot be undone.`))) return;
      try {
        const res = await fetch(`${API_BASE}/masters/items/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not delete this item.");
        window.showToast(`Item '${label}' deleted.`);
        if (editingItemId && String(editingItemId) === String(id)) resetItemFormState();
        loadMastersSystemEngine();
      } catch (err) {
        window.openModal(
          "Cannot Delete Item",
          `<p style="color:var(--red);">${err.message}</p>`,
        );
      }
    });

    // --- Category: watt-mandatory toggle badge ---
    $("mastersCategoryBody").addEventListener("click", async (e) => {
      const btn = e.target.closest('[data-action="toggle-watt"]');
      if (!btn) return;
      const catName = btn.dataset.cat;
      const cat = (cachedCategories || []).find(c => c.name === catName);
      const newState = cat ? !cat.watt_mandatory : true;
      const action = newState ? "mandatory" : "optional";
      const confirmed = await window.confirmDialog(
        "Change Wattage Rule",
        `Set Wattage / Capacity as <b>${action.toUpperCase()}</b> for category '${catName}'?`,
        { kind: "warning", okLabel: "Yes, Change" },
      );
      if (!confirmed) return;
      try {
        await fetch(
          `${API_BASE}/masters/categories/${encodeURIComponent(catName)}/watt-rule`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ watt_mandatory: newState }),
          },
        );
        window.showToast(`Wattage rule updated to ${action} for '${catName}'.`);
        loadMastersSystemEngine();
      } catch (e2) {
        window.openModal(
          "Database Error",
          '<p style="color:var(--red);">Could not update wattage rule.</p>',
        );
      }
    });

    // --- Category: serial-no-mandatory toggle badge ---
    $("mastersCategoryBody").addEventListener("click", async (e) => {
      const btn = e.target.closest('[data-action="toggle-serial"]');
      if (!btn) return;
      const catName = btn.dataset.cat;
      const cat = (cachedCategories || []).find(c => c.name === catName);
      const newState = cat ? !cat.serial_mandatory : true;
      const action = newState ? "mandatory" : "optional";
      const confirmed = await window.confirmDialog(
        "Change Serial No. Rule",
        `Set Serial No. as <b>${action.toUpperCase()}</b> for category '${catName}'?`,
        { kind: "warning", okLabel: "Yes, Change" },
      );
      if (!confirmed) return;
      try {
        await fetch(
          `${API_BASE}/masters/categories/${encodeURIComponent(catName)}/serial-rule`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serial_mandatory: newState }),
          },
        );
        window.showToast(`Serial No. rule updated to ${action} for '${catName}'.`);
        loadMastersSystemEngine();
      } catch (e2) {
        window.openModal(
          "Database Error",
          '<p style="color:var(--red);">Could not update serial no. rule.</p>',
        );
      }
    });

    // --- Category: click Edit button ---
    $("mastersCategoryBody").addEventListener("click", (e) => {
      const editBtn = e.target.closest(".m-cat-edit");
      if (!editBtn) return;
      const catName = editBtn.dataset.cat;
      const watt = editBtn.dataset.watt;
      const serial = editBtn.dataset.serial;
      loadCategoryIntoForm(catName, watt, serial);
    });

    // --- Category: DOUBLE-click row to edit ---
    $("mastersCategoryBody").addEventListener("dblclick", (e) => {
      if (e.target.closest(".m-cat-delete") || e.target.closest('[data-action]')) return;
      const row = e.target.closest(".m-cat-row");
      if (!row) return;
      const catName = row.dataset.cat;
      const watt = row.dataset.watt;
      const serial = row.dataset.serial;
      loadCategoryIntoForm(catName, watt, serial);
    });

    // --- Category: delete ---
    $("mastersCategoryBody").addEventListener("click", async (e) => {
      const btn = e.target.closest(".m-cat-delete");
      if (!btn) return;
      const cat = btn.dataset.cat;
      if (!(await window.confirmDanger('Delete Category', `Delete category '${cat}' permanently? This will also delete every item registered under it and its subtypes.`))) return;
      try {
        const res = await fetch(`${API_BASE}/masters/categories/${encodeURIComponent(cat)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not delete this category.");
        window.showToast(`Category '${cat}' deleted.`);
        loadMastersSystemEngine();
      } catch (err) {
        window.openModal(
          "Cannot Delete Category",
          `<p style="color:var(--red);">${err.message}</p>`,
        );
      }
    });

    // --- Subtype Management ---
    async function loadSubtypesForCategory(cat) {
      if (!cat) {
        $("mastersSubtypeBody").innerHTML = "";
        return;
      }
      try {
        const subs = await fetch(`${API_BASE}/masters/subtypes/${encodeURIComponent(cat)}`).then((r) => r.json());
        $("mastersSubtypeBody").innerHTML =
          subs
            .map(
              (s) => `
          <tr>
            <td>${s}</td>
            <td>
              <button class="btn btn-blue m-sub-edit" data-name="${s}" style="padding:6px 10px; font-size:11px;"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-red m-sub-delete" data-name="${s}" style="padding:6px 10px; font-size:11px;"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `,
            )
            .join("") ||
          `<tr><td colspan="2" style="text-align:center;color:var(--txt-muted);">No subtypes yet.</td></tr>`;
        const subTable = $("mastersSubtypeBody").closest("table");
        if (subTable) window.attachColumnFilters(subTable);
      } catch (e) {
        console.error(e);
      }
    }
    $("mSubTargetCat").addEventListener("change", () =>
      loadSubtypesForCategory($("mSubTargetCat").value),
    );

    function resetSubForm() {
      editingSubOldName = null;
      $("mInputSubName").value = "";
      $("mBtnSaveSub").innerHTML = '<i class="fa-solid fa-save"></i> Add Subtype';
      $("mBtnCancelSubEdit").style.display = "none";
    }
    $("mBtnCancelSubEdit").addEventListener("click", resetSubForm);

    $("mastersSubtypeBody").addEventListener("click", async (e) => {
      const editBtn = e.target.closest(".m-sub-edit");
      if (editBtn) {
        editingSubOldName = editBtn.dataset.name;
        $("mInputSubName").value = editBtn.dataset.name;
        $("mBtnSaveSub").innerHTML = '<i class="fa-solid fa-save"></i> Update Subtype';
        $("mBtnCancelSubEdit").style.display = "inline-block";
        return;
      }
      const delBtn = e.target.closest(".m-sub-delete");
      if (delBtn) {
        const name = delBtn.dataset.name;
        const cat = $("mSubTargetCat").value;
        if (!(await window.confirmDanger('Delete Subtype', `Delete subtype '${name}' under '${cat}'?`))) return;
        fetch(`${API_BASE}/masters/subtypes`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category_name: cat, subtype_name: name }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            window.showToast("Subtype deleted.");
            if (editingSubOldName === name) resetSubForm();
            loadSubtypesForCategory(cat);
          })
          .catch((err) =>
            window.openModal("Error", `<p style="color:var(--red);">${err.message}</p>`),
          );
      }
    });

    $("mBtnSaveSub").addEventListener("click", async () => {
      const cat = $("mSubTargetCat").value;
      const name = $("mInputSubName").value.trim();
      if (!cat || !name) {
        window.openModal("Validation Error", "<p>Category and subtype name are required.</p>");
        return;
      }
      try {
        if (editingSubOldName) {
          const res = await fetch(`${API_BASE}/masters/subtypes`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_name: cat, old_name: editingSubOldName, new_name: name }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          window.showToast(`Subtype renamed to '${name}'.`);
        } else {
          const res = await fetch(`${API_BASE}/masters/subtypes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_name: cat, subtype_name: name }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          window.showToast(`Subtype '${name}' added.`);
        }
        resetSubForm();
        loadSubtypesForCategory(cat);
      } catch (err) {
        window.openModal("Error", `<p style="color:var(--red);">${err.message}</p>`);
      }
    });

    // --- UOM (Units) Management ---
    function resetUomForm() {
      editingUomOldName = null;
      $("mInputUomName").value = "";
      $("mUomFormHeading").innerHTML =
        '<i class="fa-solid fa-plus"></i> Add New Unit of Measure';
      $("mBtnSaveUom").innerHTML = '<i class="fa-solid fa-save"></i> Save Unit';
      $("mBtnCancelUomEdit").style.display = "none";
    }
    $("mBtnCancelUomEdit").addEventListener("click", resetUomForm);

    $("mastersUomBody").addEventListener("click", async (e) => {
      const editBtn = e.target.closest(".m-uom-edit");
      if (editBtn) {
        editingUomOldName = editBtn.dataset.name;
        $("mInputUomName").value = editBtn.dataset.name;
        $("mUomFormHeading").innerHTML =
          '<i class="fa-solid fa-pen-to-square"></i> Update Unit of Measure';
        $("mBtnSaveUom").innerHTML = '<i class="fa-solid fa-save"></i> Update Unit';
        $("mBtnCancelUomEdit").style.display = "inline-block";
        return;
      }
      const delBtn = e.target.closest(".m-uom-delete");
      if (delBtn) {
        const name = delBtn.dataset.name;
        if (!(await window.confirmDanger('Delete Unit', `Delete unit '${name}'?`))) return;
        fetch(`${API_BASE}/masters/units`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            window.showToast("Unit deleted.");
            if (editingUomOldName === name) resetUomForm();
            loadMastersSystemEngine();
          })
          .catch((err) =>
            window.openModal("Cannot Delete Unit", `<p style="color:var(--red);">${err.message}</p>`),
          );
      }
    });

    $("mBtnSaveUom").addEventListener("click", async () => {
      const name = $("mInputUomName").value.trim();
      if (!name) {
        window.openModal("Validation Error", "<p>Unit name cannot be blank.</p>");
        return;
      }
      try {
        if (editingUomOldName) {
          const res = await fetch(`${API_BASE}/masters/units`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ old_name: editingUomOldName, new_name: name }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          window.showToast(`Unit renamed to '${name}'.`);
        } else {
          const res = await fetch(`${API_BASE}/masters/units`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          window.showToast(`Unit '${name}' added.`);
        }
        resetUomForm();
        loadMastersSystemEngine();
      } catch (err) {
        window.openModal("Error", `<p style="color:var(--red);">${err.message}</p>`);
      }
    });

    // --- Warehouse: edit/delete ---
    function resetWhForm() {
      editingWhOldName = null;
      $("mInputWhName").value = "";
      $("mInputWhLoc").value = "";
      $("mWhFormHeading").innerHTML =
        '<i class="fa-solid fa-plus"></i> Add New Storage Warehouse';
      $("mBtnSaveWh").innerHTML = '<i class="fa-solid fa-save"></i> Save Warehouse';
      $("mBtnCancelWhEdit").style.display = "none";
    }
    $("mBtnCancelWhEdit").addEventListener("click", resetWhForm);

    $("mastersWarehouseBody").addEventListener("click", async (e) => {
      const editBtn = e.target.closest(".m-wh-edit");
      if (editBtn) {
        editingWhOldName = editBtn.dataset.name;
        $("mInputWhName").value = editBtn.dataset.name;
        $("mWhFormHeading").innerHTML =
          '<i class="fa-solid fa-pen-to-square"></i> Update Warehouse';
        $("mBtnSaveWh").innerHTML = '<i class="fa-solid fa-save"></i> Update Warehouse';
        $("mBtnCancelWhEdit").style.display = "inline-block";
        return;
      }
      const delBtn = e.target.closest(".m-wh-delete");
      if (delBtn) {
        const name = delBtn.dataset.name;
        if (!(await window.confirmDanger('Delete Warehouse', `Delete warehouse '${name}'?`))) return;
        fetch(`${API_BASE}/masters/warehouses`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            window.showToast("Warehouse deleted.");
            if (editingWhOldName === name) resetWhForm();
            loadMastersSystemEngine();
          })
          .catch((err) =>
            window.openModal("Cannot Delete Warehouse", `<p style="color:var(--red);">${err.message}</p>`),
          );
      }
    });

    $('mastersUsersBody').addEventListener('click', (e) => {
      const row = e.target.closest('.m-user-row');
      if (!row) return;
      $('mUserNameInput').value = row.dataset.username;
      window.showToast(`Selected user: ${row.dataset.username}`);
    });

    const mUserPass = $("mUserPassInput");
    const mUserPwdBox = $("mUserPwdStrengthContainer");
    if (window.PasswordPolicy && mUserPass && mUserPwdBox) {
      window.PasswordPolicy.attach({
        passwordInput: mUserPass,
        container: mUserPwdBox,
        showMatch: false
      });
    }

    $("mBtnAddUser").addEventListener("click", async () => {
      const username = $("mUserNameInput").value.trim();
      const password = $("mUserPassInput").value.trim();
      const email = $("mUserEmailInput").value.trim();
      const role = $("mUserRoleDropdown").value;
      if (!username || !password || !email) {
        window.openModal("Validation Error", "<p>Username, Password and Email are mandatory.</p>");
        return;
      }
      if (window.PasswordPolicy) {
        const pol = window.PasswordPolicy.evaluate(password);
        if (!pol.valid) {
          window.openModal("Password Policy Requirement", `<p style="color:var(--red);">${pol.errors[0] || "Password does not satisfy security policy."}</p>`);
          return;
        }
      }
      try {
        const res = await fetch(`${API_BASE}/masters/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, role, email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Username already taken.");
        window.showToast(`User '${username.toUpperCase()}' registered successfully!`);
        $("mUserNameInput").value = "";
        $("mUserPassInput").value = "";
        $("mUserEmailInput").value = "";
        if (mUserPwdBox) mUserPwdBox.style.display = "none";
        loadMastersSystemEngine();
      } catch (err) {
        window.openModal("Failed", `<p style="color:var(--red);">${err.message}</p>`);
      }
    });

    $("mBtnUpdatePass").addEventListener("click", async () => {
      const username = $("mUserNameInput").value.trim();
      const password = $("mUserPassInput").value.trim();
      if (!username || !password) {
        window.openModal("Validation Error", "<p>Provide username and new password.</p>");
        return;
      }
      if (window.PasswordPolicy) {
        const pol = window.PasswordPolicy.evaluate(password);
        if (!pol.valid) {
          window.openModal("Password Policy Requirement", `<p style="color:var(--red);">${pol.errors[0] || "Password does not satisfy security policy."}</p>`);
          return;
        }
      }
      const ok = await window.confirmDialog(
        "Confirm Password Update",
        `Update the password for user "${username}"? Double-check this is the right account before continuing.`,
        { kind: "warning", okLabel: "Yes, Update" }
      );
      if (!ok) return;
      try {
        const res = await fetch(`${API_BASE}/masters/users/password`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "User configuration profile not found.");
        window.showToast(`Password updated for '${username}'.`);
        $("mUserNameInput").value = "";
        $("mUserPassInput").value = "";
        if (mUserPwdBox) mUserPwdBox.style.display = "none";
      } catch (err) {
        window.openModal("Failed", `<p style="color:var(--red);">${err.message}</p>`);
      }
    });

    $("mBtnUpdateEmail").addEventListener("click", async () => {
      const username = $("mUserNameInput").value.trim();
      const email = $("mUserEmailInput").value.trim();
      if (!username || !email) {
        window.openModal("Validation Error", "<p>Provide username and the new email.</p>");
        return;
      }
      const ok = await window.confirmDialog(
        "Confirm Email Update",
        `Update the OTP-login email for user "${username}" to "${email}"?`,
        { kind: "warning", okLabel: "Yes, Update" }
      );
      if (!ok) return;
      try {
        const res = await fetch(`${API_BASE}/masters/users/email`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "User configuration profile not found.");
        window.showToast(`Email updated for '${username}'.`);
        $("mUserEmailInput").value = "";
        loadMastersSystemEngine();
      } catch (err) {
        window.openModal("Failed", `<p style="color:var(--red);">${err.message}</p>`);
      }
    });

    const btnOpenSettings = $("mBtnOpenSettingsUsers");
    if (btnOpenSettings) {
      btnOpenSettings.addEventListener("click", () => {
        if (typeof window.openSettingsModal === 'function') {
          window.openSettingsModal('tab-users');
        }
      });
    }

    window.setMasterViewMode = function(mode) {
      window.CURRENT_MASTER_MODE = mode;
      const createPanel = $("mItemCreatePanel");
      const catalogPanel = $("mItemCatalogPanel");
      const headTitle = document.getElementById("mastersPageHeadTitle");
      const headIcon = document.getElementById("mastersPageHeadIcon");

      if (mode === "create") {
        if (createPanel) createPanel.style.display = "";
        if (catalogPanel) catalogPanel.style.display = "none";
        if (headTitle) headTitle.innerHTML = "Create Product Profile";
        if (headIcon) headIcon.className = "fa-solid fa-plus-circle";
        resetItemFormState();
      } else if (mode === "display") {
        if (createPanel) createPanel.style.display = "none";
        if (catalogPanel) catalogPanel.style.display = "";
        if (headTitle) headTitle.innerHTML = "Registered Inventory Catalog";
        if (headIcon) headIcon.className = "fa-solid fa-boxes-stacked";
      } else if (mode === "alter") {
        if (createPanel) createPanel.style.display = "none";
        if (catalogPanel) catalogPanel.style.display = "";
        if (headTitle) headTitle.innerHTML = "Alter &amp; Modify Product Master";
        if (headIcon) headIcon.className = "fa-solid fa-pen-to-square";
      } else {
        if (createPanel) createPanel.style.display = "";
        if (catalogPanel) catalogPanel.style.display = "";
      }
    };

    const initialSub = opts.sub || 'item-reg';
    activateSubtab(initialSub);
    if (opts.action && typeof window.setMasterViewMode === 'function') {
      window.setMasterViewMode(opts.action);
    } else if (opts.sub === 'item-create') {
      window.setMasterViewMode('create');
    } else if (opts.sub === 'item-catalog') {
      window.setMasterViewMode('display');
    }
    loadMastersSystemEngine(initialSub);
  },
};