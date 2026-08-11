// js/pages/bom-party-autocomplete.js
// -----------------------------------------------------------------------------
// Split out of js/pages/bom.js (pure code-organization refactor, no logic
// changes) per refactor-bom-prompt.md, purely to keep bom.js under the
// 800-line cap once its HTML shell + init() were combined. Contains the
// serial-mandatory-by-category lookup (bomLoadSerialMandatoryInfo,
// bomItemNeedsSerial) and the Customer/Dealer/Installer/Fabricator
// autocomplete wiring (searchBomCustomerLedgers, searchBomCustomerShortCodes,
// fillBomCustomerDatalist, wireBomCustomerAutocomplete,
// wireBomPartyTypeAutocomplete) used by the New BOM Entry form. Must load
// AFTER bom-kit-helpers.js/bom-challan.js and BEFORE bom.js, which calls
// createBomPartyAutocompleteModule(ctx) from inside init().
// -----------------------------------------------------------------------------
function createBomPartyAutocompleteModule(ctx) {
    async function bomLoadSerialMandatoryInfo() {
      try {
        const [items, cats] = await Promise.all([
          window.Api.get('/masters/items'),
          window.Api.get('/masters/categories'),
        ]);
        bomCategoryNameList = (cats || []).map((c) => c.name).filter(Boolean);
        bomItemsByCategory = {};
        (cats || []).forEach((c) => { ctx.bomCategorySerialMandatory[c.name] = !!c.serial_mandatory; });
        (items || []).forEach((it) => {
          if (!it.name) return;
          ctx.bomItemCategoryByName[it.name] = it.category;
          if (!it.category) return;
          if (!bomItemsByCategory[it.category]) bomItemsByCategory[it.category] = [];
          bomItemsByCategory[it.category].push(it.name);
        });
      } catch (e) {
        // API/DB not reachable in this preview — no item is treated as serial-mandatory,
        // and the Category/Model dropdowns on category-driven sections fall back to empty lists.
      }
    }
    function bomItemNeedsSerial(name) {
      const cat = ctx.bomItemCategoryByName[name];
      return !!(cat && ctx.bomCategorySerialMandatory[cat]);
    }

    // Live, mutable clone of the selected kit's `sections`. Selecting a kit
    // auto-fills this from BOM_KITS; every field rendered from it is a real
    // input/select, so edits below write straight back into this object —
    // this is what actually gets printed (not the static BOM_KITS data).
    ctx.currentKitState = null;

    // ---------------- Customer ledger live autocomplete + autofill ---------
    // Same idea as Sale/Purchase, but without a separate Short Code field:
    // a customer's short code IS the Order No here, so typing in Order No
    // itself live-searches customer ledgers by short code, and the instant
    // it exactly matches one, Customer Name auto-fills. Typing directly in
    // Customer Name still searches/auto-fills by full name. Both fields
    // stay fully editable so the person can type over the auto-filled value.
    // Was passing the literal string 'ctx.bomCustNameList' as the element
    // id (typo) — that id doesn't exist in the DOM, so this always
    // resolved to null and the Customer Name / Order No. datalists never
    // got populated by search results.
    ctx.bomCustNameList = ctx.$('bomCustNameList');
    ctx.bomOrderNoList = ctx.$('bomOrderNoList');
    ctx.bomCustSearchTimer = null;

    async function searchBomCustomerLedgers(q) {
      // silent: true — this fires on every keystroke (debounced) for
      // autocomplete; flashing the full-screen loader on each one made the
      // BOM page feel like it was constantly "loading". The initial focus
      // load (empty query) also goes through here and stays silent for the
      // same reason — it's a background suggestion fetch, not a page load.
      try { return await window.Api.get(`/ledgers?type=Customer&q=${encodeURIComponent(q)}`, { silent: true }); }
      catch (e) { return []; }
    }
    async function searchBomCustomerShortCodes(q) {
      try { return await window.Api.get(`/ledgers/shortcodes?type=Customer&q=${encodeURIComponent(q)}`, { silent: true }); }
      catch (e) { return []; }
    }
    function fillBomCustomerDatalist(listEl, ledgers, key) {
      if (!listEl) return;
      listEl.innerHTML = ledgers
        .filter((l) => String(l[key] || '').trim() !== '')
        .map((l) => `<option value="${String(l[key]).replace(/"/g, '&quot;')}">`).join('');
    }
    function wireBomCustomerAutocomplete(inputEl, listEl, matchKey, searchFn) {
      if (!inputEl || !listEl) return;
      inputEl.addEventListener('input', () => {
        const text = inputEl.value;
        clearTimeout(ctx.bomCustSearchTimer);
        ctx.bomCustSearchTimer = setTimeout(async () => {
          const ledgers = await searchFn(text);
          ctx.fillBomCustomerDatalist(listEl, ledgers, matchKey);
          const exact = ledgers.find((l) => String(l[matchKey] || '').trim().toLowerCase() === text.trim().toLowerCase());
          if (exact) ctx.$('bomCustomerName').value = exact.name || '';
        }, 250);
      });
      inputEl.addEventListener('focus', async () => {
        if (inputEl.value.trim()) return;
        const ledgers = await searchFn('');
        ctx.fillBomCustomerDatalist(listEl, ledgers, matchKey);
      });
    }
    // Bare local names, not ctx.wireBomCustomerAutocomplete/ctx.search* —
    // this factory function hasn't returned yet, so none of its own
    // exports exist on ctx at this point. Calling ctx.wireBomCustomerAutocomplete(...)
    // here throws "ctx.wireBomCustomerAutocomplete is not a function" and
    // aborts the whole factory (and every module load after it) the
    // instant bom.js's init() reaches this file.
    wireBomCustomerAutocomplete(ctx.$('bomCustomerName'), ctx.bomCustNameList, 'name', searchBomCustomerLedgers);
    wireBomCustomerAutocomplete(ctx.$('bomOrderNo'), ctx.bomOrderNoList, 'short', searchBomCustomerShortCodes);

    // ---------------- Dealer / Installer / Fabricator ledger autocomplete --
    // These are now real Party Ledger types too. Each field here is a single
    // Name box (no separate short-code field), so this searches by EITHER
    // full name or short name (the plain /ledgers endpoint already matches
    // both) and shows the matching full name in the dropdown — typing the
    // short name and picking/matching it fills the box with the full name.
    function wireBomPartyTypeAutocomplete(inputEl, listEl, ledgerType) {
      if (!inputEl || !listEl) return;
      let timer = null;
      async function search(q) {
        // silent: true — same reasoning as ctx.searchBomCustomerLedgers above:
        // this is a debounced keystroke-driven autocomplete call, not a
        // user-initiated page load, so it shouldn't flash the full-screen
        // loader every time someone types a letter.
        try { return await window.Api.get(`/ledgers?type=${encodeURIComponent(ledgerType)}&q=${encodeURIComponent(q)}`, { silent: true }); }
        catch (e) { return []; }
      }
      function fillList(ledgers) {
        listEl.innerHTML = ledgers
          .filter((l) => String(l.name || '').trim() !== '')
          .map((l) => `<option value="${bomEscAttr(l.name)}">`).join('');
      }
      inputEl.addEventListener('input', () => {
        const text = inputEl.value;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const ledgers = await search(text);
          fillList(ledgers);
          const exact = ledgers.find((l) => {
            const t = text.trim().toLowerCase();
            return String(l.name || '').trim().toLowerCase() === t || String(l.short || '').trim().toLowerCase() === t;
          });
          if (exact) inputEl.value = exact.name || '';
        }, 250);
      });
      inputEl.addEventListener('focus', async () => {
        if (inputEl.value.trim()) return;
        fillList(await search(''));
      });
    }
    // Same reasoning as above — bare local name, not ctx.wireBomPartyTypeAutocomplete.
    wireBomPartyTypeAutocomplete(ctx.$('bomDealerName'), ctx.$('bomDealerList'), 'Dealer');
    wireBomPartyTypeAutocomplete(ctx.$('bomInstallerName'), ctx.$('bomInstallerList'), 'Installer');
    wireBomPartyTypeAutocomplete(ctx.$('bomFabricatorName'), ctx.$('bomFabricatorList'), 'Fabricator');

    // ---------------- Ch. Date: calendar-picker only, no manual typing -----
    // Mirrors sales.js/purchase.js: clicking opens the native date picker,
    // and every keystroke except Tab is blocked, so the date can only be
    // set by picking it from the calendar.
    ctx.bomChallanDateEl = ctx.$('bomChallanDate');
    if (ctx.bomChallanDateEl) {
      ctx.bomChallanDateEl.addEventListener('click', () => {
        if (ctx.bomChallanDateEl.showPicker) { try { ctx.bomChallanDateEl.showPicker(); } catch (e) {} }
      });
      ctx.bomChallanDateEl.addEventListener('keydown', (e) => { if (e.key !== 'Tab') e.preventDefault(); });
    }

    // "Verify BOM" gate: Create Dispatch stays locked until the person
    // explicitly confirms the BOM is ready. Any kit change or item edit
    // after that re-locks it, since the verified snapshot no longer matches
    // what's on screen.
    ctx.btnVerify = ctx.$('bomBtnVerify');
    ctx.btnDispatch = ctx.$('bomBtnDispatch');
    ctx.btnChallan = ctx.$('bomBtnChallan');
    ctx.verifyStatus = ctx.$('bomVerifyStatus');
    ctx.bomVerified = false;

  return { bomLoadSerialMandatoryInfo, bomItemNeedsSerial, searchBomCustomerLedgers, searchBomCustomerShortCodes, fillBomCustomerDatalist, wireBomCustomerAutocomplete, wireBomPartyTypeAutocomplete };
}