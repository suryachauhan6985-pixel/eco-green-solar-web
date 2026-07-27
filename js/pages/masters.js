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

            <div class="form-grid cols-1">
              <div class="field"><label>Category <span class="req">*</span></label>
                <select id="mItemCatDropdown"></select></div>
              <div class="field"><label>Brand Name <span class="req">*</span></label>
                <input id="mItemBrandInput" placeholder="e.g. Adani"></div>
              <div class="field"><label>Wattage / Capacity</label>
                <input id="mItemWattInput" placeholder="e.g. 545"></div>
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
            <div class="table-wrap"><table>
              <thead><tr><th>Category</th><th>Brand</th><th>Wattage</th><th>Subtype</th><th>Alert Stock</th><th>UOM</th></tr></thead>
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
          <td>${it.watt ? it.watt + 'W' : '-'}</td>
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

    function syncWattMandatoryUI() {
      const cat = cachedCategories.find(c => c.name === $('mItemCatDropdown').value);
      const wattMandatory = !!(cat && cat.watt_mandatory);
      $('cfgWattMandatory').checked = wattMandatory;
      $('cfgWattMandatory').disabled = true;
      const serialMandatory = !!(cat && cat.serial_mandatory);
      $('cfgSerialMandatory').checked = serialMandatory;
      $('cfgSerialMandatory').disabled = true;
    }
    $('mItemCatDropdown').addEventListener('change', syncWattMandatoryUI);

    function resetItemFormState() {
      editingItemId = null;
      editingItemSolarType = null;
      $("mItemBrandInput").value = "";
      $("mItemWattInput").value = "";
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
      const watt = parseInt($("mItemWattInput").value.trim()) || 0;
      const uom = $("mItemUomDropdown").value;
      const minStock = parseInt($("mItemMinStockInput").value.trim()) || 0;

      if (!brand) {
        window.openModal(
          "Validation Warning",
          "<p>Brand Name field cannot be left blank.</p>",
        );
        return;
      }

      // Wattage mandatory-ness is now driven by the Category Master rule
      const catInfo = cachedCategories.find((c) => c.name === category);
      if (catInfo && catInfo.watt_mandatory && watt <= 0) {
        window.openModal(
          "Property Restraint Rule",
          `<p style="color:var(--orange);">Wattage/Capacity is mandatory for category '${category}'. Please provide a numeric value.</p>`,
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
        if (!res.ok)
          throw new Error(
            "Database transaction validation execution rejected.",
          );

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