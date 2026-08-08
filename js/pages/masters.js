// js/pages/masters.js
window.PAGES = window.PAGES || {};

window.PAGES.masters = {
  name: "Masters",
  icon: "fa-database",
  sub: "Manage items registration, warehouses & property restrictions",
  html: `
    <div class="page-head"><i class="fa-solid fa-database" style="color:var(--blue);"></i><h2>Masters Configuration Control</h2></div>

    <div class="subtabs" id="mastersSubtabs">
      <button class="subtab active" data-sub="item-reg">Item Registration Panel</button>
      <button class="subtab" data-sub="category">Category Master</button>
      <button class="subtab" data-sub="brand">Brand Master</button>
      <button class="subtab" data-sub="warehouse">Warehouse Master</button>
      <button class="subtab" data-sub="uom">UOM Master</button>
      <button class="subtab" data-sub="users">Users Accounts</button>
    </div>

  <div class="subtab-panel active" data-panel="item-reg">
      <div class="grid-2">

          <div class="panel">
            <h3 id="mItemFormHeading"><i class="fa-solid fa-square-plus"></i> Item Profiler & Registration
              <button type="button" class="info-btn" data-info="Subtype (DCR, Non-DCR, On-Grid, Off-Grid, Hybrid) is no longer set here. It is now selected per purchase invoice line in Purchase Inward, which automatically creates the matching item variant."><i class="fa-solid fa-circle-info"></i></button>
            </h3>

            <div style="background: rgba(212,175,55,0.08); padding: 10px; border-radius: 6px; margin-bottom: 15px; border: 1px solid rgba(212,175,55,0.2);">
  <strong style="color:var(--gold); font-size:12px; display:block; margin-bottom:6px;"><i class="fa-solid fa-sliders"></i> Wattage Rule (set from Category Master)</strong>
  <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
    <input type="checkbox" id="cfgWattMandatory" disabled> <span>Wattage / Capacity is mandatory for selected category</span>
  </label>
</div>

            <div style="background: rgba(102,153,255,0.08); padding: 10px; border-radius: 6px; margin-bottom: 15px; border: 1px solid rgba(102,153,255,0.2);">
  <strong style="color:var(--blue); font-size:12px; display:block; margin-bottom:6px;"><i class="fa-solid fa-barcode"></i> Serial No. Rule (set from Category Master)</strong>
  <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
    <input type="checkbox" id="cfgSerialMandatory" disabled> <span>Serial No. is required for products in selected category</span>
  </label>
</div>

            <div style="background: rgba(212,175,55,0.06); padding: 10px; border-radius: 6px; margin-bottom: 15px; border: 1px dashed rgba(212,175,55,0.25);" id="mItemSubtypeInfoBox">
  <strong style="color:var(--gold); font-size:12px; display:block; margin-bottom:6px;"><i class="fa-solid fa-tags"></i> Subtypes Available for this Category (info only)</strong>
  <div id="mItemSubtypeInfo" style="font-size:12px; color:var(--txt-muted);">Select a category above to view its subtypes.</div>
  <div style="font-size:11px; color:var(--txt-muted); margin-top:6px; font-style:italic;">Subtype is not set here — it is chosen per purchase invoice line in Purchase Inward, which auto-creates the matching item variant.</div>
</div>

            <div class="form-grid cols-1">
              <div class="field"><label>Category <span class="req">*</span></label>
                <select id="mItemCatDropdown"></select></div>
              <div class="field"><label>Brand Name <span class="req">*</span></label>
                <input id="mItemBrandInput" placeholder="e.g. Adani"></div>
              <div class="field" id="mItemWattField"><label>Wattage / Capacity <span class="req" id="mItemWattReq" style="display:none;">*</span></label>
                <input id="mItemWattInput" placeholder="e.g. 545"></div>
              <div class="field" id="mItemModelField" style="display:none;"><label>Model <span class="req" id="mItemModelReq">*</span></label>
                <input id="mItemModelInput" placeholder="e.g. 2 Inch"></div>
              <div class="field"><label>UOM (Unit of Measure)</label>
                <select id="mItemUomDropdown"></select></div>
              <div class="field"><label>Minimum Stock Alert level</label>
                <input type="number" id="mItemMinStockInput" value="0"></div>

              <div style="display:flex; gap:10px; margin-top:10px;">
                <button class="btn btn-blue" id="mBtnSaveItem" style="flex:1;"><i class="fa-solid fa-save"></i> Save Product Profile</button>
                <button class="btn btn-red" id="mBtnCancelItemEdit" style="display:none; background:#3a2222; color:var(--red);"><i class="fa-solid fa-xmark"></i> Cancel</button>
              </div>
            </div>
          </div>

          <div class="panel">
            <h3><i class="fa-solid fa-table-list"></i> Registered Inventory Items Sourced
              <button type="button" class="info-btn" data-info="Double-click any row to edit its properties in the form on the left."><i class="fa-solid fa-circle-info"></i></button>
            </h3>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
              <button class="btn btn-ghost" id="mBtnImportItems" style="background:#1F7A4D;"><i class="fa-solid fa-file-import"></i> Upload Excel (Bulk Create Items)</button>
              <button class="btn btn-ghost" id="mBtnDownloadItemTemplate" style="background:#4B6584;"><i class="fa-solid fa-download"></i> Download Excel Template</button>
              <input type="file" id="mItemImportFile" accept=".csv,.xlsx,.xls" style="display:none;">
            </div>
            <div class="table-wrap"><table>
              <thead><tr><th>Category</th><th>Brand</th><th>Watt / Model</th><th>Subtype</th><th>Alert Stock</th><th>UOM</th></tr></thead>
              <tbody id="mastersItemBody"></tbody>
            </table></div>
          </div>

      </div>
    </div>

    <div class="subtab-panel" data-panel="category">
  <div class="grid-2">
    <div class="panel">
      <h3><i class="fa-solid fa-plus"></i> Add New Category</h3>
      <div class="form-grid">
        <div class="field span-2"><label>Category Name *</label><input id="mInputCatName" placeholder="e.g. Structure"></div>
        <div class="field span-2">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12.5px;">
            <input type="checkbox" id="mInputCatWattMandatory"> <span>Wattage / Capacity is mandatory for this category</span>
          </label>
        </div>
        <div class="field span-2">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12.5px;">
            <input type="checkbox" id="mInputCatSerialMandatory"> <span>Serial No. is mandatory for this category</span>
          </label>
        </div>
      </div>
      <div class="actions-row"><button class="btn btn-blue" id="mBtnSaveCat"><i class="fa-solid fa-save"></i> Save Category</button></div>
    </div>
    <div class="panel">
      <h3><i class="fa-solid fa-list"></i> Category List</h3>
      <div class="table-wrap"><table><thead><tr><th>Category Name</th><th>Linked Products</th><th>Watt Rule</th><th>Serial Rule</th><th>Actions</th></tr></thead><tbody id="mastersCategoryBody"></tbody></table></div>
    </div>
  </div>

  <div class="panel" style="margin-top:20px;">
    <h3><i class="fa-solid fa-tags"></i> Subtype / Type Management (per Category)</h3>
    <div class="form-grid cols-2">
      <div class="field"><label>Target Category *</label><select id="mSubTargetCat"></select></div>
      <div class="field"><label>Subtype / Type Name *</label><input id="mInputSubName" placeholder="e.g. DCR, Hybrid, Mono PERC"></div>
    </div>
    <div class="actions-row">
      <button class="btn btn-green" id="mBtnSaveSub"><i class="fa-solid fa-save"></i> Add Subtype</button>
      <button class="btn btn-red" id="mBtnCancelSubEdit" style="display:none;"><i class="fa-solid fa-xmark"></i> Cancel</button>
    </div>
    <div class="table-wrap" style="margin-top:12px;"><table><thead><tr><th>Subtype / Type</th><th>Actions</th></tr></thead><tbody id="mastersSubtypeBody"></tbody></table></div>
  </div>
</div>

     <div class="subtab-panel" data-panel="brand">
      <div class="panel">
        <h3><i class="fa-solid fa-list"></i> Registered Brands
          <button type="button" class="info-btn" data-info="Brands are not created separately here. Any Brand Name entered while saving an item in the Item Registration Panel is listed automatically, sourced live from the database."><i class="fa-solid fa-circle-info"></i></button>
        </h3>
        <div class="table-wrap"><table><thead><tr><th>Brand Identifier</th><th>Items Registered</th></tr></thead><tbody id="mastersBrandBody"></tbody></table></div>
      </div>
    </div>

    <div class="subtab-panel" data-panel="warehouse">
  <div class="grid-2">
    <div class="panel">
      <h3 id="mWhFormHeading"><i class="fa-solid fa-plus"></i> Add New Storage Warehouse</h3>
      <div class="form-grid">
        <div class="field span-2"><label>Warehouse Name *</label><input id="mInputWhName" placeholder="e.g. Main Hub"></div>
        <div class="field span-2"><label>Location Address</label><input id="mInputWhLoc" placeholder="e.g. Industrial Area"></div>
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
      <h3 id="mUomFormHeading"><i class="fa-solid fa-plus"></i> Add New Unit of Measure</h3>
      <div class="form-grid"><div class="field span-2"><label>Unit Name *</label><input id="mInputUomName" placeholder="e.g. Nos, Meters, Kg"></div></div>
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
      <div class="grid-2">
         <div class="panel">
          <h3><i class="fa-solid fa-user-lock"></i> Create / Update Authorization Account
            <button type="button" class="info-btn" data-info="To change a password: enter the existing username with the new password, then click Update Password. The Role dropdown is only used when creating a new user."><i class="fa-solid fa-circle-info"></i></button>
          </h3>
          <div class="form-grid">
            <div class="field"><label>Username *</label><input id="mUserNameInput" placeholder="e.g. amit"></div>
            <div class="field"><label>Password / PIN *</label><input type="password" id="mUserPassInput" placeholder="••••••••"></div>
            <div class="field"><label>Email (for OTP Login) *</label><input type="email" id="mUserEmailInput" placeholder="e.g. amit@example.com"></div>
            <div class="field"><label>System Privilege</label>
              <select id="mUserRoleDropdown"><option value="User">User</option><option value="Admin">Admin</option><option value="SuperAdmin">SuperAdmin</option></select></div>
          </div>
          <div style="color:var(--txt-muted); font-size:12px; margin-top:6px;">Every user needs an email on file — login now sends a One-Time Password (OTP) to it as a second step after the password.</div>
          <div class="actions-row" style="margin-top:10px;">
            <button class="btn btn-blue" id="mBtnAddUser"><i class="fa-solid fa-user-plus"></i> Add New User</button>
            <button class="btn btn-gold" id="mBtnUpdatePass"><i class="fa-solid fa-key"></i> Update Existing Password</button>
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

  init() {
    const $ = (id) => document.getElementById(id);

    // Bulk-import row reports (Excel/CSV import validation errors, post-
    // import failure summary) can run to 30-40+ lines — without a cap the
    // modal (window.openModal/confirmDialog, shared across every page) just
    // grows to fit the content and blows past the viewport. Wraps a list of
    // already-HTML-escaped `<br>`-joined lines in a fixed-height box with
    // its own internal scrollbar, so the OUTER modal never has to resize
    // for this — same fixed footprint whether it's 3 rows or 300.
    function scrollList(items) {
      return `<div style="max-height:260px; overflow-y:auto; margin-top:8px; padding:8px 10px; border:1px solid rgba(255,255,255,0.12); border-radius:6px; font-size:12.5px; line-height:1.6;">${items.join('<br>')}</div>`;
    }
    const API_BASE = window.API_BASE || "http://192.168.0.123:5000/api";

    let cachedItems = [];
    let editingItemId = null;
    let editingItemSolarType = null;
    let cachedCategories = [];
    let editingWhOldName = null;
    let editingUomOldName = null;
    let editingSubOldName = null;

    // Role-based visibility: "Users Accounts" subtab is only for Admin/SuperAdmin.
    // Same role gate pattern used in purchase.js/sales.js/partyledger.js
    // (window.currentUserRole set by app.js after login).
    const currentRole = window.currentUserRole || 'User';
    const isAdmin = currentRole === 'SuperAdmin' || currentRole === 'Admin';
    if (!isAdmin) {
      const usersTabBtn = document.querySelector('#mastersSubtabs .subtab[data-sub="users"]');
      const usersPanel = document.querySelector('.subtab-panel[data-panel="users"]');
      if (usersTabBtn) usersTabBtn.style.display = 'none';
      if (usersPanel) usersPanel.classList.remove('active');
    }

    // Responsive Subtabs routing engine
    const tabs = document.querySelectorAll("#mastersSubtabs .subtab");
    const panels = document.querySelectorAll(".subtab-panel");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        const target = document.querySelector(
          `.subtab-panel[data-panel="${tab.dataset.sub}"]`,
        );
        if (target) target.classList.add("active");
      });
    });

    // Sync Live Dataset from database cache pool
    async function loadMastersSystemEngine() {
      subtypeInfoCache = {};
      try {
        const [cats, items, whs, units, users, brands] = await Promise.all([
          fetch(`${API_BASE}/masters/categories`).then(r => r.json()),
          fetch(`${API_BASE}/masters/items`).then(r => r.json()),
          fetch(`${API_BASE}/masters/warehouses`).then(r => r.json()),
          fetch(`${API_BASE}/masters/units`).then(r => r.json()),
          fetch(`${API_BASE}/masters/users`).then(r => r.json()).catch(() => []),
          fetch(`${API_BASE}/masters/brands`).then(r => r.json()).catch(() => [])
        ]);

        cachedCategories = cats;

        $('mItemCatDropdown').innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        $('mSubTargetCat').innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

        $('mastersCategoryBody').innerHTML = cats.map(c => `
      <tr>
        <td class="gold-txt">${c.name}</td>
        <td>${c.item_count} items</td>
        <td>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px;">
            <input type="checkbox" class="m-cat-watt-toggle" data-cat="${c.name}" ${c.watt_mandatory ? 'checked' : ''}> Mandatory
          </label>
        </td>
        <td>
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:12px;">
            <input type="checkbox" class="m-cat-serial-toggle" data-cat="${c.name}" ${c.serial_mandatory ? 'checked' : ''}> Mandatory
          </label>
        </td>
        <td><button class="btn btn-red m-cat-delete" data-cat="${c.name}" style="padding:6px 10px; font-size:11px;"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('') || `<tr><td colspan="5" style="text-align:center;color:var(--txt-muted);">No categories yet.</td></tr>`;

        $('mItemUomDropdown').innerHTML = units.map(u => `<option>${u}</option>`).join('');
        $('mastersUomBody').innerHTML = units.map(u => `
      <tr>
        <td>${u}</td>
        <td>
          <button class="btn btn-blue m-uom-edit" data-name="${u}" style="padding:6px 10px; font-size:11px;"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-red m-uom-delete" data-name="${u}" style="padding:6px 10px; font-size:11px;"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="2" style="text-align:center;color:var(--txt-muted);">No units yet.</td></tr>`;

        $('mastersWarehouseBody').innerHTML = whs.map(w => `
      <tr>
        <td>${w.name}</td>
        <td class="gold-txt">${w.items_stored}</td>
        <td>
          <button class="btn btn-blue m-wh-edit" data-name="${w.name}" style="padding:6px 10px; font-size:11px;"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-red m-wh-delete" data-name="${w.name}" style="padding:6px 10px; font-size:11px;"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="3" style="text-align:center;color:var(--txt-muted);">No warehouses yet.</td></tr>`;

        $('mastersUsersBody').innerHTML = users.map(u => `<tr><td>${u.username}</td><td>${u.email || '<span style="color:var(--txt-muted); font-style:italic;">Not set</span>'}</td><td>${u.role}</td></tr>`).join('') || `<tr><td colspan="3" style="text-align:center;color:var(--txt-muted);">No users yet.</td></tr>`;

        $('mastersBrandBody').innerHTML = brands.map(b => `<tr><td class="gold-txt">${b.brand_name}</td><td>${b.item_count}</td></tr>`).join('') || `<tr><td colspan="2" style="text-align:center;color:var(--txt-muted);">No brands registered yet.</td></tr>`;

        cachedItems = items;
        if (!items.length) {
          $('mastersItemBody').innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--txt-muted);">No recorded profiles found.</td></tr>`;
        } else {
          $('mastersItemBody').innerHTML = items.map(it => `
        <tr class="m-item-row" data-id="${it.id}" style="cursor:pointer;">
          <td>${it.category}</td>
          <td class="gold-txt" style="font-weight:600;">${it.brand_name}</td>
          <td>${it.watt ? it.watt + 'W' : (it.model ? it.model : '-')}</td>
          <td>${it.solar_type || '-'}</td>
          <td style="color:var(--orange); font-weight:600;">${it.minimum_stock || 0}</td>
          <td>${it.uom || 'Nos'}</td>
        </tr>
      `).join('');
        }

        syncWattMandatoryUI();
        loadSubtypesForCategory($('mSubTargetCat').value);

        // Excel-style column filters — Dashboard jaisa hi, ab har Masters
        // table pe (idempotent hai, dobara render pe duplicate nahi hoga).
        ['mastersCategoryBody', 'mastersItemBody', 'mastersWarehouseBody', 'mastersUomBody', 'mastersBrandBody', 'mastersUsersBody'].forEach((id) => {
          const body = $(id);
          const table = body && body.closest('table');
          if (table) window.attachColumnFilters(table);
        });
      } catch (err) {
        console.error('Error synchronizing core fields dataset:', err);
      }
    }

    function syncWattMandatoryUI(clearIfHidden) {
      const cat = cachedCategories.find(c => c.name === $('mItemCatDropdown').value);
      const wattMandatory = !!(cat && cat.watt_mandatory);
      $('cfgWattMandatory').checked = wattMandatory;
      $('cfgWattMandatory').disabled = true;
      const serialMandatory = !!(cat && cat.serial_mandatory);
      $('cfgSerialMandatory').checked = serialMandatory;
      $('cfgSerialMandatory').disabled = true;

      // Goal 1: actually hide the Wattage input (not just the info
      // checkbox) when the selected category doesn't require it, and show
      // the "required" asterisk when it does. clearIfHidden is only passed
      // true from the dropdown's own "change" handler below — NOT when this
      // runs while populating an existing item into the edit form, so we
      // never silently wipe an already-saved wattage value.
      const wattField = $('mItemWattField');
      const wattReq = $('mItemWattReq');
      if (wattField) wattField.style.display = wattMandatory ? '' : 'none';
      if (wattReq) wattReq.style.display = wattMandatory ? '' : 'none';
      if (!wattMandatory && clearIfHidden) $('mItemWattInput').value = '';

      // Goal: when NEITHER Wattage nor Serial No. applies to this category,
      // Wattage is replaced by a mandatory free-text Model field (e.g. PVC
      // Pipe "2 Inch") so the item can still be uniquely identified.
      const showModel = !wattMandatory && !serialMandatory;
      const modelField = $('mItemModelField');
      if (modelField) modelField.style.display = showModel ? '' : 'none';
      if (!showModel && clearIfHidden) $('mItemModelInput').value = '';

      renderSubtypeInfo(cat ? cat.name : '');
    }
    $('mItemCatDropdown').addEventListener('change', () => syncWattMandatoryUI(true));

    // Goal 1: read-only subtype info for the selected category — subtype is
    // intentionally NOT set here (see info-btn note above); it's chosen per
    // purchase invoice line in Purchase Inward. This just lets the user see
    // what subtypes already exist for the category while registering an item.
    let subtypeInfoCache = {};
    async function renderSubtypeInfo(catName) {
      const box = $('mItemSubtypeInfo');
      if (!box) return;
      if (!catName) { box.innerHTML = 'Select a category above to view its subtypes.'; return; }
      try {
        let subs = subtypeInfoCache[catName];
        if (!subs) {
          subs = await fetch(`${API_BASE}/masters/subtypes/${encodeURIComponent(catName)}`).then(r => r.json());
          subtypeInfoCache[catName] = subs;
        }
        box.innerHTML = subs.length
          ? subs.map(s => `<span style="display:inline-block; background:rgba(212,175,55,0.15); color:var(--gold); padding:2px 8px; border-radius:10px; margin:2px 4px 2px 0; font-size:11px;">${s}</span>`).join('')
          : `<span style="font-style:italic;">No subtypes defined yet for '${catName}' — add them in Category Master &rarr; Subtype Management.</span>`;
      } catch (e) {
        box.innerHTML = '<span style="color:var(--red);">Could not load subtypes.</span>';
      }
    }

    function resetItemFormState() {
      editingItemId = null;
      editingItemSolarType = null;
      $("mItemBrandInput").value = "";
      $("mItemWattInput").value = "";
      $("mItemModelInput").value = "";
      $("mItemMinStockInput").value = "0";
      $("mItemFormHeading").innerHTML =
        `<i class="fa-solid fa-square-plus"></i> Item Profiler & Registration`;
      $("mBtnSaveItem").innerHTML =
        `<i class="fa-solid fa-save"></i> Save Product Profile`;
      $("mBtnCancelItemEdit").style.display = "none";
    }
    $("mBtnCancelItemEdit").addEventListener("click", resetItemFormState);

    // Save/Modify Commit Execution with Mandatory Constraints Checks (Python style verification)
    $("mBtnSaveItem").addEventListener("click", async () => {
      const category = $("mItemCatDropdown").value;
      const brand = $("mItemBrandInput").value.trim();
      const watt = parseFloat($("mItemWattInput").value.trim()) || 0;
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
        ['category', 'brand_name', 'watt', 'model', 'wattage_mandatory', 'serial_mandatory', 'uom', 'minimum_stock'],
        ['Solar Panel', 'Adani', '545', '', 'Yes', 'No', 'Nos', '5'],
        ['Cable', 'Polycab', '', '', 'No', 'No', 'Meters', '20'],
        ['Pipe', 'Astral', '', '2 Inch', 'No', 'No', 'Nos', '10'],
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

    // Save Category handler click event
    $("mBtnSaveCat").addEventListener("click", async () => {
      const name = $("mInputCatName").value.trim();
      if (!name) {
        window.openModal("Validation Error", "<p>Category name cannot be blank.</p>");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/masters/categories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, watt_mandatory: $('mInputCatWattMandatory').checked, serial_mandatory: $('mInputCatSerialMandatory').checked })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not save this category.");
        window.showToast(`Category '${name}' added.`);
        $("mInputCatName").value = "";
        $('mInputCatWattMandatory').checked = false;
        $('mInputCatSerialMandatory').checked = false;
        loadMastersSystemEngine();
      } catch (err) {
        window.openModal("Database Error", `<p style="color:var(--red);">${err.message}</p>`);
      }
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

    // --- Item Registration: click row to load into edit form ---
    $("mastersItemBody").addEventListener("click", (e) => {
      const row = e.target.closest(".m-item-row");
      if (!row) return;
      const match = cachedItems.find((i) => String(i.id) === String(row.dataset.id));
      if (!match) return;
      editingItemId = match.id;
      editingItemSolarType = match.solar_type || "-";
      $("mItemCatDropdown").value = match.category;
      $("mItemBrandInput").value = match.brand_name;
      $("mItemWattInput").value = match.watt ? match.watt : "";
      $("mItemModelInput").value = match.model || "";
      $("mItemUomDropdown").value = match.uom || "Nos";
      $("mItemMinStockInput").value = match.minimum_stock || 0;
      syncWattMandatoryUI();
      $("mItemFormHeading").innerHTML =
        '<i class="fa-solid fa-pen-to-square"></i> Update Item Profile';
      $("mBtnSaveItem").innerHTML =
        '<i class="fa-solid fa-save"></i> Update Product Profile';
      $("mBtnCancelItemEdit").style.display = "inline-block";
    });

    // --- Category: watt-mandatory inline toggle ---
    $("mastersCategoryBody").addEventListener("change", async (e) => {
      const chk = e.target.closest(".m-cat-watt-toggle");
      if (!chk) return;
      const newState = chk.checked;
      const action = newState ? "mandatory" : "not mandatory";
      const confirmed = await window.confirmDialog(
        "Change Wattage Rule",
        `Set Wattage / Capacity as ${action} for category '${chk.dataset.cat}'?`,
        { kind: "warning", okLabel: "Yes, Change" },
      );
      if (!confirmed) {
        // Undo the click — checkbox already flipped before "change" fired.
        chk.checked = !newState;
        return;
      }
      try {
        await fetch(
          `${API_BASE}/masters/categories/${encodeURIComponent(chk.dataset.cat)}/watt-rule`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ watt_mandatory: chk.checked }),
          },
        );
        window.showToast(`Wattage rule updated for '${chk.dataset.cat}'.`);
        loadMastersSystemEngine();
      } catch (e2) {
        chk.checked = !newState;
        window.openModal(
          "Database Error",
          '<p style="color:var(--red);">Could not update wattage rule.</p>',
        );
      }
    });

    // --- Category: serial-no-mandatory inline toggle ---
    $("mastersCategoryBody").addEventListener("change", async (e) => {
      const chk = e.target.closest(".m-cat-serial-toggle");
      if (!chk) return;
      const newState = chk.checked;
      const action = newState ? "mandatory" : "not mandatory";
      const confirmed = await window.confirmDialog(
        "Change Serial No. Rule",
        `Set Serial No. as ${action} for category '${chk.dataset.cat}'?`,
        { kind: "warning", okLabel: "Yes, Change" },
      );
      if (!confirmed) {
        chk.checked = !newState;
        return;
      }
      try {
        await fetch(
          `${API_BASE}/masters/categories/${encodeURIComponent(chk.dataset.cat)}/serial-rule`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serial_mandatory: chk.checked }),
          },
        );
        window.showToast(`Serial No. rule updated for '${chk.dataset.cat}'.`);
        loadMastersSystemEngine();
      } catch (e2) {
        chk.checked = !newState;
        window.openModal(
          "Database Error",
          '<p style="color:var(--red);">Could not update serial no. rule.</p>',
        );
      }
    });

    // --- Category: delete ---
    $("mastersCategoryBody").addEventListener("click", async (e) => {
      const btn = e.target.closest(".m-cat-delete");
      if (!btn) return;
      const cat = btn.dataset.cat;
      if (!(await window.confirmDanger('Delete Category', `Delete category '${cat}' permanently? This will also remove its subtypes.`))) return;
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

    $("mBtnAddUser").addEventListener("click", async () => {
      const username = $("mUserNameInput").value.trim();
      const password = $("mUserPassInput").value.trim();
      const email = $("mUserEmailInput").value.trim();
      const role = $("mUserRoleDropdown").value;
      if (!username || !password || !email) {
        window.openModal("Validation Error", "<p>Username, Password and Email are mandatory.</p>");
        return;
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
      try {
        const res = await fetch(`${API_BASE}/masters/users/password`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "User configuration profile not found.");
        window.showToast("Password updated successfully!");
        $("mUserNameInput").value = "";
        $("mUserPassInput").value = "";
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
      try {
        const res = await fetch(`${API_BASE}/masters/users/email`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "User configuration profile not found.");
        window.showToast("Email updated successfully!");
        $("mUserEmailInput").value = "";
        loadMastersSystemEngine();
      } catch (err) {
        window.openModal("Failed", `<p style="color:var(--red);">${err.message}</p>`);
      }
    });

    loadMastersSystemEngine();
  },
};