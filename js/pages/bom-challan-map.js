// js/pages/bom-challan-map.js
// -----------------------------------------------------------------------------
// Split out of js/pages/bom.js (pure code-organization refactor, no logic
// changes) per refactor-bom-prompt.md, purely to keep bom.js under the
// 800-line cap once its HTML shell + init() were combined. Contains the
// "Convert into Challan" modal open/close (openChallanModal,
// closeChallanModal) and the Challan Category Mapping admin screen
// (bomCollectItemGroupsForMapping, bomRenderChallanMapModalHtml,
// bomOpenChallanMapModal). Must load AFTER bom-kit-helpers.js/
// bom-challan.js and BEFORE bom.js, which calls
// createBomChallanMapModule(ctx) from inside init().
// -----------------------------------------------------------------------------
function createBomChallanMapModule(ctx) {
    // Open/close for the dedicated Challan modal — mirrors the
    // lockPageScroll/unlockPageScroll + .show/.no-scroll pattern Party
    // Ledger's own modal-fullscreen dialogs already use, so this behaves
    // identically to those (background locked while open, unlocked on close).
    function openChallanModal(bodyHtml) {
      if (!ctx.challanOverlay || !ctx.challanModalBody) return;
      ctx.challanModalBody.innerHTML = bodyHtml;
      ctx.challanOverlay.classList.add('show');
      document.body.classList.add('no-scroll');
    }
    function closeChallanModal() {
      if (!ctx.challanOverlay) return;
      ctx.challanOverlay.classList.remove('show');
      document.body.classList.remove('no-scroll');
    }
    // NOTE: bind the bare local function, not ctx.closeChallanModal — at
    // this point (factory executing, before Object.assign(ctx, ...) below
    // in bom.js has run) ctx.closeChallanModal doesn't exist yet, so
    // addEventListener would have permanently bound this click to
    // `undefined` instead of the real handler.
    if (ctx.challanCloseBtn) ctx.challanCloseBtn.addEventListener('click', closeChallanModal);
    if (ctx.challanOverlay) {
      ctx.challanOverlay.addEventListener('click', (e) => {
        if (e.target === ctx.challanOverlay) ctx.closeChallanModal(); // backdrop click only
      });
    }

    // ---------- Challan Category Mapping — admin editor (Goal 5) ----------
    // Reuses the same fullscreen Challan overlay/body (ctx.openChallanModal
    // above) — it's already a generic "big scrollable panel" host, no need
    // for a second modal shell. Lists EVERY item registered in Masters >
    // Item Registration (GET /api/masters/items — same source
    // bomLoadItemMasterNames() uses for the BOM Kit dropdowns), not just
    // items that have already gone out under a real BOM order: a fresh
    // item can only ever get used in a BOM/Kit Template AFTER it's mapped
    // here, so gating this list on "already used in a BOM" made it
    // impossible to map a brand-new item before its first use.
    //
    // Display grouping: items.name in the DB is a concatenated
    // "<Brand> <Model/Watt>" string (see masters.routes.js item
    // create/update), which reads badly in a mapping list (e.g. "DC
    // Earthing Wire - Yellow - Polycab 4 SQ.MM"). Split it based on
    // whether the item's effective rule (its own override, or its
    // Category's default — watt_mandatory_effective / serial_mandatory_effective,
    // same fields Masters > Categories sets) actually needs the Model to
    // tell two rows apart:
    //   - Serial/Watt-mandatory items (Solar Panel, Inverter, ...) — each
    //     Model IS effectively its own product, so one mapping row per
    //     distinct Model, labelled by Model alone.
    //   - Everything else (wires, clamps, cement, bags, ...) — the Model
    //     suffix (e.g. "4 SQ.MM", "19mm DIA") makes no difference to which
    //     Challan line the item folds into, so every Model under the same
    //     Brand collapses into ONE row, labelled by Brand alone.
    // Either way this is purely a DISPLAY + bulk-save convenience — saving
    // one row still writes a mapping for every real items.name it
    // represents, because Convert-into-Challan's compress logic
    // (bomComputeChallanAutoQty) matches strictly on the real per-item
    // name (bomChallanCategoryMap[it.name]).
    // "Save Mapping" bulk-PUTs the whole set. This is the ONLY place
    // bomChallanCategoryMap changes.
    async function bomCollectItemGroupsForMapping() {
      try {
        const rows = await window.Api.get('/masters/items');
        const list = Array.isArray(rows) ? rows : [];
        const byBrand = {}; // brand -> { label, itemNames: [] }
        const variantGroups = []; // one per distinct Model, itemNames: [fullName]
        list.forEach((r) => {
          const fullName = (r.name || '').trim();
          if (!fullName) return;
          const brand = (r.brand_name || fullName).trim();
          const model = (r.model || '').trim();
          const isMandatory = !!(r.watt_mandatory_effective || r.serial_mandatory_effective);
          if (isMandatory) {
            variantGroups.push({ label: model || fullName, itemNames: [fullName] });
          } else {
            if (!byBrand[brand]) byBrand[brand] = { label: brand, itemNames: [] };
            byBrand[brand].itemNames.push(fullName);
          }
        });
        const groups = Object.values(byBrand).concat(variantGroups);
        groups.sort((a, b) =>
          String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base', numeric: true })
        );
        return groups;
      } catch (e) {
        console.warn('bom: could not load item master rows for Challan mapping', e);
        return [];
      }
    }

    // Set fresh every time the modal (re)renders — index -> { label,
    // itemNames }. The rendered <select>'s data-row-index looks this up on
    // Save, so the bulk-write below can expand one visible row back out to
    // every real item name it represents.
    ctx.bomChallanMapGroups = [];

    function bomRenderChallanMapModalHtml(groups) {
      ctx.bomChallanMapGroups = groups;
      const categoryOptions = (selected) =>
        `<option value="">-- Unmapped --</option>` +
        bomChallanCategoryList.map((c) => `<option value="${bomEscAttr(c)}" ${c === selected ? 'selected' : ''}>${bomEsc(c)}</option>`).join('');
      const rows = groups.map((g, gi) => {
        // If every real item this row represents already shares the same
        // saved category, pre-select it; otherwise (mixed/none) start on
        // "-- Unmapped --" rather than guessing.
        const savedCats = Array.from(new Set(g.itemNames.map((n) => bomChallanCategoryMap[n] || '')));
        const selected = savedCats.length === 1 ? savedCats[0] : '';
        return `
        <tr>
          <td>${bomEsc(g.label)}</td>
          <td><select class="bom-field-input bom-challanmap-select" data-row-index="${gi}">${categoryOptions(selected)}</select></td>
        </tr>`;
      }).join('');
      return `
        <div id="bomChallanMapModalRoot">
          <p class="note" style="margin-bottom:12px;">
            <i class="fa-solid fa-circle-info"></i> Decide which Challan line each item's quantity folds into.
            "GI Pipe" items are handled automatically (feet &rarr; 20/15/10/5-Feet pieces) &mdash; you only need to tag
            them "GI Pipe" here so they're excluded from every other category's count. Every item registered in
            Item Master is listed below (${bomChallanCategoryList.length} Challan categories available).
          </p>
          <div class="table-wrap" style="max-height:60vh;overflow:auto;">
            <table class="bom-items-form-table">
              <thead><tr><th>Item Name</th><th>Challan Category</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="2">No items registered in Item Master yet.</td></tr>'}</tbody>
            </table>
          </div>
          <div class="actions-row" style="margin-top:14px;">
            <button type="button" class="btn btn-blue" id="bomChallanMapSaveBtn"><i class="fa-solid fa-floppy-disk"></i> Save Mapping</button>
          </div>
        </div>
      `;
    }

    async function bomOpenChallanMapModal() {
      ctx.openChallanModal('<p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Loading items from Item Master...</p>');
      const modalTitleEl = document.getElementById('bomChallanModalTitle');
      if (modalTitleEl) modalTitleEl.innerHTML = '<i class="fa-solid fa-sitemap"></i> Challan Category Mapping';
      // Re-fetch BOTH the category list and the item list fresh every time
      // this opens — never rely solely on init()'s one-time load having
      // succeeded (a slow/failed first-load fetch used to leave
      // bomChallanCategoryList permanently empty for the rest of the
      // session, which is why every dropdown only ever showed
      // "-- Unmapped --" with no real categories to pick from).
      const [, groups] = await Promise.all([bomLoadChallanCategoryMap(), ctx.bomCollectItemGroupsForMapping()]);
      ctx.openChallanModal(ctx.bomRenderChallanMapModalHtml(groups));
      if (modalTitleEl) modalTitleEl.innerHTML = '<i class="fa-solid fa-sitemap"></i> Challan Category Mapping';
      const saveBtn = document.getElementById('bomChallanMapSaveBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          // Expand each visible row back out to every real item name it
          // represents — a brand-collapsed row (e.g. "Polycab") writes the
          // same category for every model under that brand in one go.
          const mappings = [];
          document.querySelectorAll('.bom-challanmap-select').forEach((sel) => {
            const group = ctx.bomChallanMapGroups[Number(sel.dataset.rowIndex)];
            if (!group) return;
            group.itemNames.forEach((itemName) => mappings.push({ itemName, category: sel.value }));
          });
          saveBtn.disabled = true;
          try {
            await window.Api.put('/challan/category-map', { mappings });
            await bomLoadChallanCategoryMap(); // refresh the in-memory map the compress logic reads
            if (window.showToast) window.showToast('Challan category mapping saved.');
            ctx.closeChallanModal();
          } catch (e) {
            window.openModal('Save Failed', `<p>${bomEsc((e && e.message) || 'Could not save the mapping. Please try again.')}</p>`);
          } finally {
            saveBtn.disabled = false;
          }
        });
      }
    }

    // Step 4: Pending BOM Register modal — same open/close pattern as the
    // Challan modal above, kept as its own overlay/functions so neither
    // modal's state ever leaks into the other.
    ctx.registerOverlay = ctx.$('bomRegisterOverlay');
    ctx.registerModalBody = ctx.$('bomRegisterModalBody');
    ctx.registerCloseBtn = ctx.$('bomRegisterCloseBtn');

  return { openChallanModal, closeChallanModal, bomCollectItemGroupsForMapping, bomRenderChallanMapModalHtml, bomOpenChallanMapModal };
}
