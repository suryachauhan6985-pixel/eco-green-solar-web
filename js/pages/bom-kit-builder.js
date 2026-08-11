// js/pages/bom-kit-builder.js
// -----------------------------------------------------------------------------
// Split out of js/pages/bom.js (pure code-organization refactor, no logic
// changes) per refactor-bom-prompt.md. Contains the Kit dropdown, New/Edit
// Kit builder, items preview and field-edit handlers (populateKitDropdown,
// refreshItemsPreview, setKitBuilderMode, renderKitBuilderSections,
// handleBuilderFieldEdit, handleItemFieldEdit, rerenderItemsPreview,
// bomRerenderItemRow, updateKitActionButtons, bomFindScrollParent). Must
// load AFTER bom-kit-helpers.js/bom-challan.js and BEFORE bom.js, which
// calls createBomKitBuilderModule(ctx) from inside init().
//
// createBomKitBuilderModule(ctx) is a factory: see bom-serial-scan.js's
// header comment for the full ctx explanation — same pattern here.
// -----------------------------------------------------------------------------
function createBomKitBuilderModule(ctx) {
    function updateKitActionButtons() {
      const showActions = ctx.bomIsAdmin && bomIsCustomKitKey(ctx.kitSelect.value);
      if (ctx.btnDeleteKit) ctx.btnDeleteKit.style.display = showActions ? '' : 'none';
      if (ctx.btnEditKit) ctx.btnEditKit.style.display = showActions ? '' : 'none';
    }

    // Populate the kW dropdown from BOM_KITS + any saved custom templates.
    // Pulled into its own function since saving/deleting a template needs
    // to rebuild this list without a full page reload.
    function populateKitDropdown(selectKey) {
      const previousValue = selectKey !== undefined ? selectKey : ctx.kitSelect.value;
      ctx.kitSelect.innerHTML = '<option value="">-- Select Kit --</option>';
      const allKits = bomGetAllKits();
      Object.keys(allKits).forEach((key) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = allKits[key].label;
        ctx.kitSelect.appendChild(opt);
      });
      const keys = Object.keys(allKits);
      if (previousValue && allKits[previousValue]) {
        ctx.kitSelect.value = previousValue;
      } else if (keys.length === 1) {
        // Only one kit exists right now — auto-select it so the preview isn't empty.
        ctx.kitSelect.value = keys[0];
      }
      ctx.updateKitActionButtons();
    }
    ctx.populateKitDropdown();

    function refreshItemsPreview() {
      const kit = bomGetAllKits()[ctx.kitSelect.value];
      // Deep clone so editing on-screen never mutates the kit catalogue itself.
      ctx.currentKitState = kit ? JSON.parse(JSON.stringify(kit.sections)) : null;
      bomNormalizeDispatchQty(ctx.currentKitState); // Dispatch Qty defaults to Quantity until User narrows it for a partial dispatch
      ctx.itemsPreview.innerHTML = bomRenderScreenItemsHtml(ctx.currentKitState, { isAdmin: ctx.bomIsAdmin, needsSerial: ctx.bomItemNeedsSerial });
      ctx.setVerified(false); // changing the kit invalidates any prior verification
      ctx.updateVerifyButtonState(); // fresh kit — nothing ticked yet, Verify stays disabled
      ctx.updateKitActionButtons();
    }
    ctx.kitSelect.addEventListener('change', ctx.refreshItemsPreview);
    ctx.refreshItemsPreview();

    if (ctx.btnDeleteKit) {
      ctx.btnDeleteKit.addEventListener('click', async () => {
        const key = ctx.kitSelect.value;
        if (!bomIsCustomKitKey(key)) return;
        const custom = bomLoadCustomKits();
        const kitLabel = custom[key] ? custom[key].label : 'this kit';
        const confirmed = await window.confirmDanger(
          'Delete Kit Template',
          `Delete the saved template "${kitLabel}"? This cannot be undone.`,
        );
        if (!confirmed) return;
        ctx.btnDeleteKit.disabled = true;
        try {
          await bomDeleteCustomKit(key); // server first — cache only updates once this succeeds
        } catch (e) {
          window.openModal('Delete Failed', `<p>${bomEsc((e && e.message) || 'Could not delete this kit template. Please try again.')}</p>`);
          return;
        } finally {
          ctx.btnDeleteKit.disabled = false;
        }
        ctx.populateKitDropdown('');
        ctx.refreshItemsPreview();
        if (window.showToast) window.showToast('Kit template deleted.');
      });
    }

    // ---------- Create / Save New Kit Template ----------
    ctx.kitBuilderPanel = ctx.$('bomKitBuilderPanel');
    ctx.btnNewKit = ctx.$('bomBtnNewKit');
    ctx.btnCancelKitBuilder = ctx.$('bomBtnCancelKitBuilder');
    ctx.btnAddKitSection = ctx.$('bomBtnAddKitSection');
    ctx.btnSaveKitTemplate = ctx.$('bomBtnSaveKitTemplate');
    ctx.kitBuilderSectionsEl = ctx.$('bomNewKitSections');
    ctx.newKitLabelInput = ctx.$('bomNewKitLabel');
    ctx.newKitKwInput = ctx.$('bomNewKitKw');

    // "New Kit" (creating/saving a BOM Kit template) is an Admin/SuperAdmin
    // action only — a plain User should not see the option at all, same
    // role gate used for the edit sections in sales.js/purchase.js. (role
    // computed once, near the top of init() — see ctx.bomIsAdmin above.)
    if (ctx.btnNewKit) ctx.btnNewKit.style.display = ctx.bomIsAdmin ? '' : 'none';

    // "Challan Category Mapping" — same Admin/SuperAdmin gate as New Kit:
    // this decides which BOM item's quantity feeds which Challan summary
    // line, same trust level as editing an Item Master rule. Lives ONLY on
    // the BOM Home launcher screen now (bomHomeBtnChallanMap) — the Entry
    // screen's own copy of this button was removed per instruction so the
    // action exists in exactly one place.
    ctx.homeBtnChallanMap = ctx.$('bomHomeBtnChallanMap');
    if (ctx.homeBtnChallanMap) {
      ctx.homeBtnChallanMap.style.display = ctx.bomIsAdmin ? '' : 'none';
      ctx.homeBtnChallanMap.addEventListener('click', ctx.bomOpenChallanMapModal);
    }

    // Live, mutable working copy of the kit being built — same
    // {title, items:[{sr,name,model,qty,remarks}]} shape as any real kit's
    // `sections`, so it saves straight into the same catalogue format.
    ctx.newKitSections = [];

    // Set to the kit's storage key (e.g. "custom_5-kw-commercial-550-wp")
    // while editing an EXISTING saved template via the pencil/"Edit Kit"
    // button, and back to null for a brand new kit ("New Kit"). This is
    // the only thing that tells Save whether to overwrite that same key
    // in place or mint a fresh one — see ctx.btnSaveKitTemplate below.
    ctx.editingKitKey = null;

    ctx.kitBuilderTitleEl = ctx.$('bomKitBuilderTitle');
    ctx.kitBuilderHintEl = ctx.$('bomKitBuilderHint');
    ctx.saveKitTemplateLabelEl = ctx.$('bomBtnSaveKitTemplateLabel');

    // Swaps the builder's heading/hint/save-button text between "creating
    // a brand new kit" and "editing an existing one" — purely cosmetic,
    // but stops someone editing "3.3 kW" from mistakenly thinking they're
    // about to create a whole new template.
    function setKitBuilderMode(isEdit) {
      if (ctx.kitBuilderTitleEl) {
        ctx.kitBuilderTitleEl.innerHTML = isEdit
          ? '<i class="fa-solid fa-pen"></i> Edit BOM Kit &amp; Template'
          : '<i class="fa-solid fa-layer-group"></i> Create / Save New BOM Kit &amp; Template';
      }
      if (ctx.kitBuilderHintEl) {
        ctx.kitBuilderHintEl.innerHTML = isEdit
          ? '<i class="fa-solid fa-circle-info"></i> Editing the saved template selected in the BOM Kit dropdown. Change anything below, then click Update — every BOM created from this kit AFTER saving will use the new list (BOMs already created keep their own frozen item list).'
          : '<i class="fa-solid fa-circle-info"></i> Starts pre-filled with the standard section/item format below — Model, Quantity &amp; Remarks are left blank for you to fill in. Add or remove sections/items freely, and item names can be renamed too.';
      }
      if (ctx.saveKitTemplateLabelEl) ctx.saveKitTemplateLabelEl.textContent = isEdit ? 'Update Kit Template' : 'Save Kit Template';
    }

    function renderKitBuilderSections() {
      bomRenumberAll(ctx.newKitSections);
      ctx.kitBuilderSectionsEl.innerHTML = ctx.newKitSections.map((sec, si) => {
        // Same "Category on top, real item under Model" rule as the live
        // Kit Items table (bomRenderScreenItemsHtml/bomResolveSectionCategory):
        // only the FIRST row of a section whose title matches a real
        // Masters > Category name (e.g. "Solar Panel", "Inverter") gets the
        // Category / Model-item dropdown pair. Every other row — including
        // every other row of that same section — gets the normal Item Name
        // dropdown + Model dropdown pair, both sourced from Masters > Item
        // Registration.
        const sectionCategory = bomResolveSectionCategory(sec.title);
        const itemRowsHtml = sec.items.map((it, ii) => {
          const isCategoryDrivenRow = !!sectionCategory && ii === 0;
          const effectiveCategory = it.category || sectionCategory;
          const rowBrand = bomRowBrand(it);
          const nameCell = isCategoryDrivenRow
            ? `<select class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="category">${bomBuildCategoryOptionsHtml(effectiveCategory)}</select>`
            : `<select class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="name">${bomBuildItemOptionsHtml(rowBrand)}</select>`;
          const modelCell = isCategoryDrivenRow
            ? `<select class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="name">${bomBuildCategoryItemOptionsHtml(effectiveCategory, it.name)}</select>`
            : `<select class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="model">${bomBuildModelOptionsHtml(it.model, rowBrand)}</select>`;
          return `
                  <tr>
                    <td><input type="text" class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="sr" value="${bomEscAttr(it.sr)}"></td>
                    <td>${nameCell}</td>
                    <td>${modelCell}</td>
                    <td><input type="text" class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="qty" placeholder="Quantity" value="${bomEscAttr(it.qty)}"></td>
                    <td><input type="text" class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="remarks" placeholder="Remarks" value="${bomEscAttr(it.remarks)}"></td>
                    <td style="white-space:nowrap;">
                      <button type="button" class="btn btn-ghost bom-mini-btn" data-binsert-sec="${si}" data-binsert-idx="${ii}" title="Insert item below"><i class="fa-solid fa-plus"></i></button>
                      <button type="button" class="btn btn-red bom-mini-btn" data-bremove-sec="${si}" data-bremove-idx="${ii}" title="Remove item"><i class="fa-solid fa-xmark"></i></button>
                    </td>
                  </tr>`;
        }).join('');
        return `
        <div class="panel" style="margin-bottom:14px; background:rgba(255,255,255,0.02);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
            <input type="text" class="bom-field-input" data-bsec="${si}" data-bfield="sectitle" value="${bomEscAttr(sec.title)}" style="max-width:280px; font-weight:700;">
            <button type="button" class="btn btn-red bom-mini-btn" data-bsec-remove="${si}" ${ctx.newKitSections.length <= 1 ? 'disabled' : ''}><i class="fa-solid fa-trash"></i> Remove Section</button>
          </div>
          <div class="table-wrap">
            <table class="bom-items-form-table">
              <thead><tr><th>Sr No.</th><th>Item Name</th><th>Model</th><th>Quantity</th><th>Remarks</th><th></th></tr></thead>
              <tbody>${itemRowsHtml}</tbody>
            </table>
          </div>
          <button type="button" class="btn btn-ghost bom-mini-btn" data-bsec-add-item="${si}" style="margin-top:8px;"><i class="fa-solid fa-plus"></i> Add Item to this Section</button>
        </div>`;
      }).join('');
    }

    // Field edits (section title, sr, name, model, qty, remarks) write
    // straight back into ctx.newKitSections — same delegated-listener pattern
    // used for the live Kit Items preview above.
    if (ctx.kitBuilderSectionsEl) {
      ctx.kitBuilderSectionsEl.addEventListener('input', ctx.handleBuilderFieldEdit);
      ctx.kitBuilderSectionsEl.addEventListener('change', ctx.handleBuilderFieldEdit);
    }
    function handleBuilderFieldEdit(e) {
      const el = e.target.closest('[data-bfield]');
      if (!el) return;
      const si = Number(el.dataset.bsec);
      const field = el.dataset.bfield;
      if (!ctx.newKitSections[si]) return;
      if (field === 'sectitle') {
        ctx.newKitSections[si].title = el.value;
        // A section title can change which real Category it matches (see
        // bomResolveSectionCategory) — re-render on 'change' (blur/Enter)
        // only, not on every keystroke, so the first row's Item Name/Model
        // cells switch to/from the Category dropdown pair as soon as the
        // person finishes typing, without the table jumping around mid-edit.
        if (e.type === 'change') ctx.renderKitBuilderSections();
        return;
      }
      const ii = Number(el.dataset.bidx);
      if (!ctx.newKitSections[si].items[ii]) return;
      const item = ctx.newKitSections[si].items[ii];

      // Category select on a category-driven row's first item (see
      // ctx.renderKitBuilderSections). Changing it invalidates whichever real
      // item (item.name) was picked under the old category — clear it and
      // refresh the Model dropdown's option list for the new category.
      if (field === 'category') {
        item.category = el.value;
        item.name = '';
        ctx.renderKitBuilderSections();
        return;
      }

      // field 'name' is shared by two different selects depending on the
      // row type (see ctx.renderKitBuilderSections):
      //  - category-driven lead row's Model-item select — its value IS
      //    already the real registered item name (bomBuildCategoryItemOptionsHtml).
      //  - normal row's Item Name select — now a deduped BRAND picker
      //    (bomBuildItemOptionsHtml), so its value must be resolved
      //    through bomResolveItemName before it becomes item.name.
      if (field === 'name') {
        const sectionCategory = bomResolveSectionCategory(ctx.newKitSections[si].title);
        const isCategoryDrivenRow = !!sectionCategory && ii === 0;
        if (isCategoryDrivenRow) {
          item.name = el.value;
          return;
        }
        item.brand = el.value;
        item.model = '';
        const resolved = bomResolveItemName(item.brand, item.model);
        item.name = resolved;
        if (resolved) {
          const meta = bomItemMasterMeta[resolved];
          if (meta && meta.model) item.model = meta.model; // brand had exactly one item — keep Model in sync
        }
        ctx.renderKitBuilderSections();
        return;
      }

      // Model select on a normal row — resolve the real item.name now
      // that both brand (item.brand) and model are known.
      if (field === 'model' && item.brand) {
        item.model = el.value;
        item.name = bomResolveItemName(item.brand, item.model);
        return;
      }

      item[field] = el.value;
    }

    // Structural changes (insert/remove item, add/remove section) — every
    // one re-renders and renumbers Sr No. across the whole builder.
    if (ctx.kitBuilderSectionsEl) {
      ctx.kitBuilderSectionsEl.addEventListener('click', (e) => {
        const insertBtn = e.target.closest('[data-binsert-sec]');
        const removeItemBtn = e.target.closest('[data-bremove-sec]');
        const addItemBtn = e.target.closest('[data-bsec-add-item]');
        const removeSectionBtn = e.target.closest('[data-bsec-remove]');
        const blankItem = () => ({ sr: '', name: '', model: '', qty: '', remarks: '' });

        if (insertBtn) {
          const si = Number(insertBtn.dataset.binsertSec);
          const idx = Number(insertBtn.dataset.binsertIdx);
          ctx.newKitSections[si].items.splice(idx + 1, 0, blankItem());
        } else if (removeItemBtn) {
          const si = Number(removeItemBtn.dataset.bremoveSec);
          const idx = Number(removeItemBtn.dataset.bremoveIdx);
          ctx.newKitSections[si].items.splice(idx, 1);
        } else if (addItemBtn) {
          const si = Number(addItemBtn.dataset.bsecAddItem);
          ctx.newKitSections[si].items.push(blankItem());
        } else if (removeSectionBtn) {
          if (ctx.newKitSections.length <= 1) return; // button is disabled at 1 section anyway
          const si = Number(removeSectionBtn.dataset.bsecRemove);
          ctx.newKitSections.splice(si, 1);
        } else {
          return;
        }
        ctx.renderKitBuilderSections();
      });
    }

    if (ctx.btnAddKitSection) {
      ctx.btnAddKitSection.addEventListener('click', () => {
        ctx.newKitSections.push({ title: 'New Section', items: [{ sr: '', name: '', model: '', qty: '', remarks: '' }] });
        ctx.renderKitBuilderSections();
      });
    }

    if (ctx.btnNewKit) {
      ctx.btnNewKit.addEventListener('click', () => {
        ctx.editingKitKey = null;
        ctx.setKitBuilderMode(false);
        // Pre-fill with the standard section/item format (names only,
        // Model/Quantity/Remarks blank) — the person only needs to fill in
        // values and add/remove items/sections where this kit differs.
        ctx.newKitSections = bomDefaultSectionsTemplate();
        ctx.newKitLabelInput.value = '';
        ctx.newKitKwInput.value = '';
        ctx.renderKitBuilderSections();
        ctx.kitBuilderPanel.style.display = '';
        // The "Kit Items" panel below always mirrors the currently-selected
        // kit (e.g. the default 3.3 kW list) — while building a brand new
        // kit that old list has nothing to do with what's being created, so
        // hide it for the duration of the builder to avoid the confusing
        // "two item lists on screen at once" look. Restored on Cancel/Save.
        if (ctx.kitItemsPanel) ctx.kitItemsPanel.style.display = 'none';
        ctx.kitBuilderPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        ctx.newKitLabelInput.focus();
      });
    }

    // ---------- Edit an existing saved Kit Template ----------
    // Opens the SAME builder panel as "New Kit", but pre-filled with the
    // currently-selected custom kit's real sections/items (deep-cloned, so
    // Cancel never mutates the saved template) instead of the blank
    // default — and Save (now "Update Kit Template") overwrites that same
    // saved key rather than minting a new one. Only ever visible for a
    // saved custom kit (see ctx.updateKitActionButtons), same Admin/SuperAdmin
    // gate as New Kit/Delete Kit.
    if (ctx.btnEditKit) {
      ctx.btnEditKit.addEventListener('click', () => {
        const key = ctx.kitSelect.value;
        if (!bomIsCustomKitKey(key)) return;
        const custom = bomLoadCustomKits();
        const kit = custom[key];
        if (!kit) return;

        ctx.editingKitKey = key;
        ctx.setKitBuilderMode(true);
        ctx.newKitSections = JSON.parse(JSON.stringify(kit.sections || []));
        if (!ctx.newKitSections.length) ctx.newKitSections = bomDefaultSectionsTemplate();
        ctx.newKitLabelInput.value = kit.label || '';
        ctx.newKitKwInput.value = kit.kw || '';
        ctx.renderKitBuilderSections();
        ctx.kitBuilderPanel.style.display = '';
        if (ctx.kitItemsPanel) ctx.kitItemsPanel.style.display = 'none';
        ctx.kitBuilderPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        ctx.newKitLabelInput.focus();
      });
    }

    if (ctx.btnCancelKitBuilder) {
      ctx.btnCancelKitBuilder.addEventListener('click', () => {
        ctx.editingKitKey = null;
        ctx.kitBuilderPanel.style.display = 'none';
        if (ctx.kitItemsPanel) ctx.kitItemsPanel.style.display = '';
      });
    }

    if (ctx.btnSaveKitTemplate) {
      ctx.btnSaveKitTemplate.addEventListener('click', async () => {
        const label = ctx.newKitLabelInput.value.trim();
        if (!label) {
          window.openModal('Validation Error', '<p>Kit Name is required.</p>');
          if (window.focusInvalidField) window.focusInvalidField(ctx.newKitLabelInput);
          return;
        }
        // Drop any item left with a blank name, and any section left with
        // no named items — everything else (Model/Qty/Remarks) can stay blank.
        const sectionsToSave = ctx.newKitSections
          .map((sec) => ({
            title: (sec.title || '').trim() || 'Items',
            items: sec.items
              .map((it) => ({
                sr: it.sr,
                name: (it.name || '').trim(),
                model: (it.model || '').trim(),
                qty: (it.qty || '').trim(),
                remarks: (it.remarks || '').trim(),
              }))
              .filter((it) => it.name),
          }))
          .filter((sec) => sec.items.length);
        if (!sectionsToSave.length) {
          window.openModal('Validation Error', '<p>Add at least one item with a name before saving the template.</p>');
          return;
        }
        bomRenumberAll(sectionsToSave);

        const custom = bomLoadCustomKits();
        let key;
        if (ctx.editingKitKey && custom[ctx.editingKitKey]) {
          // Editing an existing template — keep the SAME key regardless of
          // whether the label changed, so the dropdown selection, any
          // in-flight BOM's kit reference, and Delete/Edit all keep
          // pointing at the one saved entry instead of leaving behind an
          // orphaned old key + a brand new one.
          key = ctx.editingKitKey;
        } else {
          // Unique key: slugified name, de-duplicated if that slug is already taken.
          key = 'custom_' + bomSlugify(label);
          let n = 2;
          while (custom[key] && custom[key].label !== label) {
            key = 'custom_' + bomSlugify(label) + '-' + n;
            n += 1;
          }
        }
        const kitPayload = {
          label,
          kw: ctx.newKitKwInput.value.trim(),
          sections: sectionsToSave,
        };

        ctx.btnSaveKitTemplate.disabled = true;
        try {
          await bomUpsertCustomKit(key, kitPayload); // server first — cache (and every device/login) only updates once this succeeds
        } catch (e) {
          window.openModal('Save Failed', `<p>${bomEsc((e && e.message) || 'Could not save this kit template. Please try again.')}</p>`);
          return;
        } finally {
          ctx.btnSaveKitTemplate.disabled = false;
        }
        const wasEditing = !!ctx.editingKitKey;
        ctx.editingKitKey = null;

        ctx.kitBuilderPanel.style.display = 'none';
        if (ctx.kitItemsPanel) ctx.kitItemsPanel.style.display = '';
        ctx.populateKitDropdown(key); // auto-select the newly saved/updated kit
        ctx.refreshItemsPreview();
        if (window.showToast) window.showToast(wasEditing ? 'Kit template updated.' : 'Kit template saved — it now auto-fills from the dropdown, on every device.');
      });
    }

    // Delegated listener: every field (item dropdown, model/qty/remarks
    // inputs, sr, section title) carries data-sec(+data-idx)/data-field, so
    // one listener on the container catches edits to all rows across kit
    // re-renders and writes them straight into ctx.currentKitState — nothing
    // needs to be retyped for the parts that stay the same.
    ctx.itemsPreview.addEventListener('input', ctx.handleItemFieldEdit);
    ctx.itemsPreview.addEventListener('change', ctx.handleItemFieldEdit);
    function handleItemFieldEdit(e) {
      const el = e.target.closest('[data-field]');
      if (!el) return;
      const si = Number(el.dataset.sec);
      const field = el.dataset.field;
      if (!ctx.currentKitState || !ctx.currentKitState[si]) return;
      if (field === 'sectitle') {
        ctx.currentKitState[si].title = el.value;
        ctx.setVerified(false);
        // A section title can change which real Category it matches (see
        // bomResolveSectionCategory) — re-render on 'change' (blur/Enter)
        // only, not on every keystroke, so every item row in this section
        // switches to/from the Category+Model dropdown pair as soon as the
        // person finishes typing, without the table jumping around while
        // they're still mid-edit.
        if (e.type === 'change') ctx.rerenderItemsPreview();
        return;
      }
      const ii = Number(el.dataset.idx);
      const item = ctx.currentKitState[si].items[ii];
      if (!item) return;

      // Check column: the on-screen equivalent of the print sheet's blank
      // "Checked" box. Ticking a serial-mandatory item (e.g. a Panel) is
      // blocked until its Serial No. is filled in — Verify BOM only unlocks
      // once every item, including these, is genuinely ready.
      if (field === 'checked') {
        if (el.checked && ctx.bomItemNeedsSerial(item.name)) {
          const required = bomEffectiveQty(item);
          const entered = bomSplitSerials(item.serials).length;
          if (!entered) {
            el.checked = false;
            window.openModal('Serial No. Required', '<p>Please enter Serial No. first.</p>');
            if (window.focusInvalidField) window.focusInvalidField(document.querySelector(`.bom-serial-btn[data-sec="${si}"][data-idx="${ii}"]`));
            return;
          }
          if (required != null && entered !== required) {
            el.checked = false;
            window.openModal('Serial No. Required', `<p>Please enter Serial No. first — <strong>${bomEsc(item.name || 'this item')}</strong> needs exactly ${required} serial number(s), but ${entered} ${entered === 1 ? 'is' : 'are'} entered.</p>`);
            if (window.focusInvalidField) window.focusInvalidField(document.querySelector(`.bom-serial-btn[data-sec="${si}"][data-idx="${ii}"]`));
            return;
          }
        }
        item.checked = el.checked;
        ctx.updateVerifyButtonState();
        return;
      }

      // Category select on a category-driven row (any section whose title
      // matches a real Masters > Category name, e.g. "Solar Panel" or
      // "Inverter" — see bomResolveSectionCategory). Changing the category
      // invalidates whichever real item (it.name) was picked under the old
      // category — force a re-pick and refresh the Model dropdown's option
      // list for the new category.
      if (field === 'category') {
        item.category = el.value;
        item.name = '';
        item.checked = false;
        ctx.setVerified(false);
        ctx.updateVerifyButtonState();
        ctx.bomRerenderItemRow(si, ii);
        return;
      }

      // Quantity (Admin/SuperAdmin only — disabled for a plain User, see
      // bomRenderScreenItemRowHtml). By default this loads pre-filled from
      // the selected kit template, and Admin/SuperAdmin — the only roles
      // that can actually generate a BOM (see ctx.btnCreateBom's ctx.bomIsAdmin
      // gate) — can freely change it at generation time. Admin's own
      // Dispatch Qty column is disabled and always mirrors Quantity, so
      // keep it in sync here — a User doing a partial dispatch uses their
      // own separate Dispatch Qty column instead, Quantity itself stays
      // locked for them since it was already set by whoever generated
      // this BOM.
      if (field === 'qty') {
        item.qty = el.value;
        if (ctx.bomIsAdmin) {
          const n = bomParseQtyNumber(el.value);
          item.dispatchQty = n != null ? String(n) : '';
        }
        item.checked = false;
        ctx.setVerified(false);
        ctx.updateVerifyButtonState();
        return;
      }

      // Dispatch Qty — User-only editable field (disabled for Admin, see
      // bomRenderScreenItemsHtml). How many units of the allocated
      // Quantity are being sent right now (partial dispatch). Clamped so
      // it can never exceed the original allocation, and never negative.
      if (field === 'dispatchQty') {
        const full = bomParseQtyNumber(item.qty);
        let n = Number(el.value);
        if (Number.isNaN(n) || n < 0) n = 0;
        if (full != null && n > full) {
          n = full;
          el.value = n;
          if (window.showToast) window.showToast(`Cannot dispatch more than the allocated ${full}.`);
        }
        item.dispatchQty = String(n);
        item.checked = false;
        ctx.setVerified(false);
        ctx.updateVerifyButtonState();
        return;
      }

      // Model-item select on a category-driven row's lead item (Solar
      // Panel/Inverter's first row — see bomRenderScreenItemRowHtml). Its
      // value IS already the real registered item name
      // (bomBuildCategoryItemOptionsHtml), so it must be written straight
      // to item.name — routing it through the brand-resolution logic below
      // (meant for the normal Item Name select) is what was making a
      // freshly-picked item snap back to "-- Select Item --": that brand
      // lookup always failed for a full item name, silently clearing
      // item.name back to ''.
      if (field === 'modelitem') {
        item.name = el.value;
        item.checked = false;
        ctx.setVerified(false);
        ctx.updateVerifyButtonState();
        ctx.bomRerenderItemRow(si, ii); // item changed — refresh the Serial No. column for this row
        return;
      }

      // Category select (unchanged) is handled above and returns early.
      // Item Name select on a normal (non-category-driven) row now offers
      // one entry per BRAND (bomBuildItemOptionsHtml) — the value picked
      // here is a brand, not the final registered item name. Remember it
      // in item.brand, then resolve the real name via bomResolveItemName:
      // instantly for a brand with only one registered item, or as soon
      // as a matching Model is also picked for a brand with several (see
      // the 'model'-adjacent branch below).
      if (field === 'name') {
        item.brand = el.value;
        item.model = '';
        const resolved = bomResolveItemName(item.brand, item.model);
        item.name = resolved;
        if (resolved) {
          const meta = bomItemMasterMeta[resolved];
          if (meta && meta.model) item.model = meta.model; // keep Model in sync with the resolved item
        }
        item.checked = false;
        ctx.setVerified(false);
        ctx.updateVerifyButtonState();
        ctx.bomRerenderItemRow(si, ii); // item changed — refresh the Serial No. column for this row
        return;
      }

      // Model select on a normal (non-category-driven) row — now a
      // dropdown (bomBuildModelOptionsHtml) instead of free text, same as
      // the Kit Builder. Once a brand has already been picked (item.brand),
      // resolve item.name the moment a matching Model is selected (e.g.
      // brand "Lug" + model "16" resolves to the real "Lug_16"). Left
      // unresolved (name stays '') until it matches, so a half-picked row
      // never silently saves the wrong item.
      if (field === 'model' && item.brand) {
        item.model = el.value;
        item.name = bomResolveItemName(item.brand, item.model);
        item.checked = false;
        ctx.setVerified(false);
        ctx.updateVerifyButtonState();
        ctx.bomRerenderItemRow(si, ii); // item changed — refresh the Serial No. column for this row
        return;
      }

      item[field] = el.value;
      item.checked = false; // any content edit invalidates this row's tick
      ctx.setVerified(false); // any edit after verifying means it needs re-verifying
      ctx.updateVerifyButtonState();
    }

    // Re-renders the item table in place (after a dropdown/field edit,
    // add/remove row, etc.) WITHOUT jumping the page back to the top.
    // ctx.itemsPreview.innerHTML replaces the whole table with a fresh DOM
    // tree, so the browser loses whatever scroll position it had — this
    // finds whichever ancestor is actually scrolling (the page itself, or
    // a scrollable panel wrapping it) and restores its scrollTop right
    // after the swap, so editing row 25 keeps row 25 in view instead of
    // snapping back to row 1.
    function bomFindScrollParent(el) {
      let node = el && el.parentElement;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
          return node;
        }
        node = node.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    }

    function rerenderItemsPreview() {
      const scrollParent = ctx.bomFindScrollParent(ctx.itemsPreview);
      const scrollTop = scrollParent.scrollTop;
      ctx.itemsPreview.innerHTML = bomRenderScreenItemsHtml(ctx.currentKitState, { isAdmin: ctx.bomIsAdmin, needsSerial: ctx.bomItemNeedsSerial });
      scrollParent.scrollTop = scrollTop;
      ctx.setVerified(false);
      ctx.updateVerifyButtonState();
    }

    // Re-renders ONLY the one <tr> for (si, ii) — used for a Name/Category
    // dropdown pick or a Serial No. save, where only that single row's
    // markup actually changes. Swapping just that <tr> instead of the whole
    // table means the browser never touches anything else on the page, so
    // there is nothing to "jump" — editing item 25 keeps item 25 exactly
    // where it is, unlike the old full-table ctx.rerenderItemsPreview() call
    // this replaces (which relied on a scroll-restore hack that could land
    // back at the top, especially right after a modal like Serial No. closes).
    // Falls back to a full ctx.rerenderItemsPreview() if the row can't be found,
    // so this can never silently no-op.
    function bomRerenderItemRow(si, ii) {
      if (!ctx.currentKitState || !ctx.currentKitState[si] || !ctx.currentKitState[si].items[ii]) return;
      const rowEl = ctx.itemsPreview.querySelector(`tr[data-row-sec="${si}"][data-row-idx="${ii}"]`);
      if (!rowEl) { ctx.rerenderItemsPreview(); return; }
      const html = bomRenderScreenItemRowHtml(ctx.currentKitState[si], si, ctx.currentKitState[si].items[ii], ii, { isAdmin: ctx.bomIsAdmin, needsSerial: ctx.bomItemNeedsSerial });
      const tmp = document.createElement('tbody');
      tmp.innerHTML = html;
      rowEl.replaceWith(tmp.firstElementChild);
      ctx.setVerified(false);
      ctx.updateVerifyButtonState();
    }

    // ---------------- Serial scanner (camera) — Step 5 ----------------
    // Same "html5-qrcode" engine + .ss-scanner-* overlay markup/CSS already
    // used by Purchase Inward (js/pages/purchase.js's openPurchaseScanner)
    // and SCAN To Sheet (js/pages/scansheet.js) — loaded globally via CDN
    // in index.html, CSS ships site-wide via css/modules/scan-sheet.css.
    // Generic over `targetId` so ONE set of functions serves both:
    //   - the main screen's ctx.openBomSerialModal() box (#bomSerialModalBox)
    //   - every per-item serial <textarea> the Continue Dispatch form
    //     (Step 4's ctx.bomRenderContinueFormHtml) renders — one order can have
    //     several pending serial-mandatory items, each gets its own textarea
    //     id and its own scan button, all calling ctx.openBomScanner(thatId).
    // Flow mirrors Purchase's exactly: decode -> camera pauses -> result
    // card with Retry/Done -> Done appends one line to the target textarea
    // and resumes scanning for the next serial, duplicate scans are
    // blocked (Done hidden) until Retry'd.
    //
    // Deliberately NO separate "Bluetooth scanner mode" toggle: unlike
    // scansheet.js's single-line inputs (which need one because a BT
    // wedge-scanner's trailing Enter key would submit/blur a single-line
    // field), these are multi-line <textareas> that already auto-newline
    // on any delimiter (see bomSplitSerials + the keydown/paste handlers
    // below and in the Continue Dispatch form). A Bluetooth scanner just
    // needs the box focused — it types + Enter like a keyboard, which the
    // textarea turns into "one serial per line" on its own. Purchase
    // Inward's identical serial textarea uses this same reasoning and
    // likewise ships no BT toggle.
    ctx.bomScanState = {
      html5QrCode: null,
      cameras: [],
      cameraIndex: 0,
      torchOn: false,
      overlayEl: null,
      targetId: null,
      handledOnce: false,
      pendingText: null,
      pendingIsDup: false,
      pendingIsOverCap: false,
      addedCount: 0,
    };

    // "BT Scan" toggle for the Serial No. modal (ctx.openBomSerialModal below).
    // Chrome has no API to ask the OS "is a Bluetooth barcode scanner
    // paired right now" — same limitation SCAN To Sheet (scansheet.js)
    // already works around with its own bluetoothScanMode toggle. A BT
    // scanner types like a fast keyboard, so it doesn't strictly need this
    // (the textarea already turns any delimiter into a newline — see the
    // big comment above ctx.openBomScanner), but the toggle still (a) disables
    // the camera button so it can't be tapped by mistake while a physical
    // scanner is in use, and (b) keeps the mobile soft keyboard from
    // popping up over the box. Persists for as long as this BOM page stays
    // mounted, same as scansheet's ST.bluetoothScanMode.
    ctx.bomSerialBtMode = false;


  return { updateKitActionButtons, populateKitDropdown, refreshItemsPreview, setKitBuilderMode, renderKitBuilderSections, handleBuilderFieldEdit, handleItemFieldEdit, bomFindScrollParent, rerenderItemsPreview, bomRerenderItemRow };
}
