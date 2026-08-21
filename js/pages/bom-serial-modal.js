// js/pages/bom-serial-modal.js
// -----------------------------------------------------------------------------
// Split out of js/pages/bom.js (pure code-organization refactor, no logic
// changes) per refactor-bom-prompt.md. Contains ONLY the Serial No. modal
// (openBomSerialModal, and its private nested helpers focusSerialBox,
// applyBomSerialBtModeUi, backToTypeMode, updateCountNote, showQtyCapError,
// showBtCard, hideBtCard — all still nested inside openBomSerialModal
// exactly as before, untouched). Kept separate from bom-serial-scan.js
// purely to keep both files under the 800-line cap. Must load AFTER
// bom-kit-helpers.js, bom-challan.js and bom-serial-scan.js (calls
// ctx.bomScanBeep/ctx.openBomScanner etc. from that file) and BEFORE
// bom.js, which calls createBomSerialModalModule(ctx) from inside init().
// -----------------------------------------------------------------------------
function createBomSerialModalModule(ctx) {
    function openBomSerialModal(si, ii) {
      const item = ctx.currentKitState[si] && ctx.currentKitState[si].items[ii];
      if (!item) return;
      const required = bomEffectiveQty(item);

      window.openModal(`Serial No. — ${item.name || 'Item'}`, `
        <div class="bom-serial-modal">
          <p class="note" style="margin-bottom:10px;">
            <i class="fa-solid fa-box"></i> <b>${bomEsc(item.name || 'Item')}</b>
            &nbsp;—&nbsp; Quantity required: <b>${required != null ? required : '—'}</b> serial number(s)
          </p>
          <div class="actions-row bom-serial-mode-row" style="margin-bottom:12px; gap:8px;">
            <button type="button" class="btn btn-ghost bom-serial-mode-btn" id="bomSerialModeUpload" title="Upload serial numbers from .txt or .csv file"><i class="fa-solid fa-file-arrow-up"></i> Upload File</button>
            <button type="button" class="btn btn-ghost bom-serial-mode-btn" id="bomSerialCameraBtn" ${ctx.bomSerialBtMode ? 'disabled aria-disabled="true"' : ''} title="${ctx.bomSerialBtMode ? 'Camera disabled in Bluetooth scanner mode' : 'Scan barcode / QR with camera'}"><i class="fa-solid fa-camera"></i> Scan with Camera</button>
            <button type="button" class="btn ${ctx.bomSerialBtMode ? 'btn-blue active' : 'btn-ghost'} bom-serial-bt-btn" id="bomSerialBtBtn" title="Bluetooth scanner mode — disables the camera and prepares the box for physical scanner"><i class="fa-brands fa-bluetooth-b"></i> ${ctx.bomSerialBtMode ? 'BT Scanner: ON' : 'BT Scanner'}</button>
          </div>
          <div id="bomSerialUploadPane" style="display:none; margin-bottom:10px;">
            <input type="file" id="bomSerialFileInput" accept=".txt,.csv">
            <p class="note" style="margin-top:6px;">Pick a .txt or .csv file — one serial per line, or comma/space separated. It loads into the box below so you can review before saving.</p>
          </div>
          <div style="position:relative;">
            <textarea id="bomSerialModalBox" rows="8" ${ctx.bomSerialBtMode ? 'inputmode="none"' : 'inputmode="text"'} ${required != null ? `data-max-serials="${required}"` : ''} placeholder="Scan or type serial numbers — one per line...">${bomEsc(item.serials || '')}</textarea>
            <!-- Bluetooth scan confirm card — sits ALREADY in the DOM
                 (just hidden) instead of being created fresh per scan like
                 the full-screen camera overlay is. Toggling display is
                 instant, which is what keeps this fast: the scan itself
                 shows the card immediately, and only the human's own Done
                 tap (not any artificial delay) gates when it lands in the
                 box. -->
            <div id="bomBtResultCard" style="display:none; position:absolute; inset:0; background:var(--bg2, #1e1e1e); border:1px solid var(--border, #444); border-radius:8px; padding:14px; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:8px; z-index:2;">
              <div class="note" style="font-size:12px;">Scanned value</div>
              <div id="bomBtResultValue" style="font-size:18px; font-weight:700; word-break:break-all;"></div>
              <div id="bomBtResultMsg" class="note" style="margin:0;"></div>
              <div class="actions-row" style="margin-top:6px;">
                <button type="button" class="btn btn-ghost" id="bomBtRetryBtn"><i class="fa-solid fa-rotate-left"></i> Retry</button>
                <button type="button" class="btn btn-green" id="bomBtDoneBtn"><i class="fa-solid fa-check"></i> Done</button>
              </div>
            </div>
          </div>
          <p class="note" id="bomSerialCountNote" style="margin-top:8px;"></p>
          <div class="actions-row" style="margin-top:12px;">
            <button type="button" class="btn btn-blue" id="bomSerialSaveBtn"><i class="fa-solid fa-check"></i> Save</button>
            <button type="button" class="btn btn-ghost" id="bomSerialCancelBtn">Cancel</button>
          </div>
        </div>
      `);

      const box = document.getElementById('bomSerialModalBox');
      const countNote = document.getElementById('bomSerialCountNote');
      const modeUploadBtn = document.getElementById('bomSerialModeUpload');
      const uploadPane = document.getElementById('bomSerialUploadPane');
      const fileInput = document.getElementById('bomSerialFileInput');
      const saveBtn = document.getElementById('bomSerialSaveBtn');
      const cancelBtn = document.getElementById('bomSerialCancelBtn');
      const cameraBtn = document.getElementById('bomSerialCameraBtn');
      const btBtn = document.getElementById('bomSerialBtBtn');
      const btCard = document.getElementById('bomBtResultCard');
      const btCardValueEl = document.getElementById('bomBtResultValue');
      const btCardMsgEl = document.getElementById('bomBtResultMsg');
      const btRetryBtn = document.getElementById('bomBtRetryBtn');
      const btDoneBtn = document.getElementById('bomBtDoneBtn');
      if (!box) return;

      // Buffers a physical BT scanner's keystrokes ourselves in BT mode
      // (see the keydown listener below) instead of letting them land
      // directly in the box — Enter/Tab then pops the same Retry/Done
      // result card the camera scanner shows, via ctx.openBomBtScanResult.
      let bomBtBuffer = '';

      // Focuses the box the same way it normally gets the cursor when this
      // modal opens. In BT mode the field is briefly marked readonly first
      // — that stops the mobile soft keyboard from popping up (a BT
      // scanner is a hardware keyboard, it doesn't need the on-screen
      // one) — then released a moment later so the caret is sitting in
      // the box, ready for the scanner's next scan, exactly like the plain
      // type/scan box already does outside BT mode.
      function focusSerialBox() {
        if (ctx.bomSerialBtMode) {
          box.setAttribute('readonly', 'readonly');
          box.focus({ preventScroll: true });
          window.setTimeout(() => {
            box.removeAttribute('readonly');
            const len = box.value.length;
            if (typeof box.setSelectionRange === 'function') box.setSelectionRange(len, len);
            box.focus({ preventScroll: true });
          }, 450);
        } else {
          box.focus({ preventScroll: true });
        }
      }

      // Reflects ctx.bomSerialBtMode onto the modal's buttons + textarea
      // without rebuilding the modal (so whatever's already typed/scanned
      // in the box is never lost when the toggle is flipped).
      function applyBomSerialBtModeUi() {
        if (btBtn) {
          btBtn.classList.toggle('active', ctx.bomSerialBtMode);
          btBtn.classList.toggle('btn-blue', ctx.bomSerialBtMode);
          btBtn.classList.toggle('btn-ghost', !ctx.bomSerialBtMode);
          btBtn.innerHTML = `<i class="fa-brands fa-bluetooth-b"></i> ${ctx.bomSerialBtMode ? 'BT Scanner: ON' : 'BT Scanner'}`;
        }
        if (cameraBtn) {
          cameraBtn.disabled = ctx.bomSerialBtMode;
          cameraBtn.classList.toggle('ss-disabled', ctx.bomSerialBtMode);
          cameraBtn.title = ctx.bomSerialBtMode ? 'Camera disabled in Bluetooth scanner mode' : 'Scan barcode / QR with camera';
        }
        box.setAttribute('inputmode', ctx.bomSerialBtMode ? 'none' : 'text');
      }

      if (btBtn) {
        btBtn.addEventListener('click', () => {
          ctx.bomSerialBtMode = !ctx.bomSerialBtMode;
          bomBtBuffer = '';
          hideBtCard();
          applyBomSerialBtModeUi();
          if (ctx.bomSerialBtMode) {
            backToTypeMode(); // BT mode always uses the box, never the Upload pane
            if (window.showToast) window.showToast('Bluetooth scanner mode ON — camera disabled, box ready for the scanner.');
          } else if (window.showToast) {
            window.showToast('Bluetooth scanner mode OFF — camera scan available again.');
          }
          focusSerialBox();
        });
      }

      // Auto-focus on open, same as a fresh scan/type box normally gets.
      focusSerialBox();

      // Hides the Upload pane and returns focus to the type/scan box —
      // replaces the old "Scan Serial No." mode-toggle button, which was
      // removed (the box is the default/active mode already, so a
      // separate button just to switch back to it was redundant).
      function backToTypeMode() {
        modeUploadBtn.classList.remove('active');
        uploadPane.style.display = 'none';
        box.focus();
      }

      // The real camera scanner (see ctx.openBomScanner above) — appending
      // each Done'd scan straight into this modal's box. Labeled "Scan
      // Serial No." since it's the only actual scan entry point now.
      if (cameraBtn) cameraBtn.addEventListener('click', () => ctx.openBomScanner('bomSerialModalBox'));

      function updateCountNote() {
        const count = bomSplitSerials(box.value).length;
        if (required != null) {
          const ok = count === required;
          countNote.style.color = ok ? 'var(--green)' : 'var(--red)';
          countNote.innerHTML = `<i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${count} of ${required} serial number(s) entered${ok ? ' — matches quantity.' : ''}`;
        } else {
          countNote.style.color = '';
          countNote.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${count} serial number(s) entered.`;
        }
      }

      // Shows a clear, consistent error whenever a scan/entry would push
      // the count past the item's required Quantity — used by every entry
      // path below (BT scan, camera scan, typing, paste, file upload) so
      // the message is identical no matter how the extra serial arrived.
      function showQtyCapError() {
        countNote.style.color = 'var(--red)';
        countNote.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> You cannot scan more than the entered quantity — ${required} serial number(s) allowed for this item.`;
        if (window.showToast) window.showToast(`Limit reached — only ${required} serial number(s) allowed for this item.`);
      }

      // Pending code waiting on a Done/Retry tap in BT mode. While this is
      // non-null the confirm card is showing and new scanner keystrokes
      // are ignored (mirrors the camera flow's handledOnce gate) so a
      // second physical trigger-pull can't silently land underneath the
      // card the user hasn't acted on yet.
      let bomBtPendingCode = null;

      function showBtCard(code, opts) {
        opts = opts || {};
        bomBtPendingCode = opts.blocked ? null : code;
        btCardValueEl.textContent = code || '(empty)';
        btCardMsgEl.textContent = opts.dup
          ? 'This serial no. is already in the box. Retry with a different code.'
          : opts.overCap
            ? `You cannot scan more than the entered quantity — ${required} serial number(s) allowed for this item.`
            : 'Scanned — tap Done to add it.';
        btDoneBtn.style.display = opts.blocked ? 'none' : '';
        btCard.style.display = 'flex';
      }
      function hideBtCard() {
        btCard.style.display = 'none';
        bomBtPendingCode = null;
      }
      if (btRetryBtn) btRetryBtn.addEventListener('click', () => { hideBtCard(); focusSerialBox(); });
      if (btDoneBtn) {
        btDoneBtn.addEventListener('click', () => {
          if (!bomBtPendingCode) return;
          const existing = bomSplitSerials(box.value);
          existing.push(bomBtPendingCode);
          box.value = existing.join('\n') + '\n';
          box.dispatchEvent(new Event('input', { bubbles: true }));
          hideBtCard();
          focusSerialBox();
        });
      }

      // Auto-newline on delimiter + paste normalization — identical logic
      // to Purchase/Sale's serial box (splitSerials there === bomSplitSerials here).
      //
      // In BT mode this branches instead: a physical scanner's keystrokes
      // are buffered ourselves (never inserted directly). Enter/Tab shows
      // the confirm card ABOVE (already sitting in the DOM, just hidden —
      // see showBtCard) instantly, so the scan itself always feels fast;
      // a Done tap then commits it to the box. This replaces the earlier
      // "auto-add with no confirmation" version, which was fast but gave
      // no chance to catch a misread before it landed in the box — and it
      // also replaces the ORIGINAL version, which popped a brand-new
      // full-screen overlay (ctx.openBomBtScanResult) per scan and re-ran a
      // 450ms readonly-release delay in ctx.closeBomScanner() every time,
      // which was the actual source of the earlier slowness. Reusing one
      // always-present card and only doing the readonly-release dance
      // after the user's own Done/Retry tap (see focusSerialBox() calls
      // above) gets both: an instant card AND no per-scan overlay cost.
      box.addEventListener('keydown', (e) => {
        if (ctx.bomSerialBtMode) {
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          // A fast HID/BT wedge scanner can outrun the main thread just
          // enough that the browser doesn't see a key's keyup in time and
          // the OS fires its own auto-repeat keydown(s) for that same key
          // (e.repeat === true) before the real next character arrives.
          // Previously every one of those repeats got appended to
          // bomBtBuffer too, which is exactly what produced scans like
          // "MMMMMMMMMMMMMMS2409S531420" / "MS24PPPPPS531420" /
          // "MS240PS53111111111420" — random runs of one duplicated
          // character in the middle of an otherwise-correct serial.
          // Dropping repeat events here fixes it: a real scanner keystroke
          // is never itself a repeat, only the OS's phantom echo of it is.
          if (e.repeat) { e.preventDefault(); return; }
          // Card already showing — ignore further scanner input until the
          // user resolves it (Done/Retry).
          if (btCard.style.display !== 'none') { e.preventDefault(); return; }
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const code = bomBtBuffer.trim();
            bomBtBuffer = '';
            if (!code) return;
            const existing = bomSplitSerials(box.value);
            if (required != null && existing.length >= required) { showBtCard(code, { blocked: true, overCap: true }); return; }
            const dup = existing.some((s) => s.toLowerCase() === code.toLowerCase());
            if (dup) { showBtCard(code, { blocked: true, dup: true }); return; }
            ctx.bomScanBeep();
            showBtCard(code);
            return;
          }
          if (e.key === 'Escape') { bomBtBuffer = ''; return; }
          if (e.key.length === 1) {
            e.preventDefault();
            bomBtBuffer += e.key;
          }
          return;
        }
        if ([',', ' ', '|', ';', 'Tab'].includes(e.key)) {
          e.preventDefault();
          // Block starting a NEW serial once the box already holds
          // `required` of them — bomSplitSerials(box.value) at this point
          // still includes the token the user just finished typing, so
          // this only rejects the (required+1)th one onward, never the
          // final in-quota entry itself.
          if (required != null && bomSplitSerials(box.value).length > required) {
            showQtyCapError();
            return;
          }
          const before = box.value.slice(0, box.selectionStart);
          const after = box.value.slice(box.selectionEnd);
          const needsNewline = before && !before.endsWith('\n');
          box.value = before + (needsNewline ? '\n' : '') + after;
          const pos = before.length + (needsNewline ? 1 : 0);
          box.setSelectionRange(pos, pos);
        }
        updateCountNote();
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        let incoming = bomSplitSerials(pasted);
        if (required != null) {
          const room = Math.max(0, required - bomSplitSerials(box.value).length);
          if (incoming.length > room) {
            const skipped = incoming.length - room;
            incoming = incoming.slice(0, room);
            showQtyCapError();
            if (window.showToast) window.showToast(`${skipped} serial number(s) skipped — quantity limit is ${required}.`);
          }
        }
        const normalized = incoming.join('\n');
        const before = box.value.slice(0, box.selectionStart);
        const after = box.value.slice(box.selectionEnd);
        const prefix = before && !before.endsWith('\n') ? '\n' : '';
        box.value = before + prefix + normalized + (normalized ? '\n' : '') + after;
        updateCountNote();
      });
      box.addEventListener('input', updateCountNote);
      box.addEventListener('blur', () => {
        let serials = bomSplitSerials(box.value);
        if (required != null && serials.length > required) {
          serials = serials.slice(0, required);
          showQtyCapError();
        }
        box.value = serials.join('\n');
        updateCountNote();
      });

      modeUploadBtn.addEventListener('click', () => {
        const isOpen = uploadPane.style.display !== 'none' && uploadPane.style.display !== '';
        if (isOpen) { backToTypeMode(); return; }
        modeUploadBtn.classList.add('active');
        uploadPane.style.display = '';
      });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const parsed = bomSplitSerials(String(reader.result || ''));
          let merged = bomSplitSerials(box.value).concat(parsed);
          let loadedCount = parsed.length;
          if (required != null && merged.length > required) {
            const skipped = merged.length - required;
            merged = merged.slice(0, required);
            loadedCount = Math.max(0, parsed.length - skipped);
            showQtyCapError();
          }
          box.value = merged.join('\n');
          updateCountNote();
          backToTypeMode(); // back to the box so it can be reviewed/edited before Save
          if (window.showToast) window.showToast(`${loadedCount} serial number(s) loaded from file.`);
        };
        reader.onerror = () => window.openModal('File Read Error', '<p>Could not read that file. Please try a plain .txt or .csv file.</p>');
        reader.readAsText(file);
        fileInput.value = '';
      });

      saveBtn.addEventListener('click', () => {
        const serials = bomSplitSerials(box.value);
        if (!serials.length) {
          countNote.style.color = 'var(--red)';
          countNote.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Please enter Serial No. first.';
          return;
        }
        const seen = new Set();
        const dupes = new Set();
        serials.forEach((s) => { if (seen.has(s)) dupes.add(s); seen.add(s); });
        if (dupes.size) {
          countNote.style.color = 'var(--red)';
          countNote.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Duplicate serial number(s): ${[...dupes].map(bomEsc).join(', ')}`;
          return;
        }
        if (required != null && serials.length > required) {
          countNote.style.color = 'var(--red)';
          countNote.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> You cannot scan more than the entered quantity — ${required} serial number(s) allowed, ${serials.length} entered.`;
          return;
        }
        if (required != null && serials.length < required) {
          countNote.style.color = 'var(--red)';
          countNote.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Please enter Serial No. first — exactly ${required} needed, ${serials.length} entered.`;
          return;
        }
        item.serials = serials.join('\n');
        item.checked = false; // any serial change invalidates this row's tick
        ctx.setVerified(false);
        window.closeModal();
        ctx.bomRerenderItemRow(si, ii);
        if (window.showToast) window.showToast('Serial numbers saved.');
      });

      cancelBtn.addEventListener('click', () => window.closeModal());

      updateCountNote();
    }

    // Delegated click listener: lets a new item be inserted at ANY position
    // within any section (not just appended at the end) — e.g. right after
    // the 5th item in "Solar Structure" — plus removing an item, adding a
    // whole new section, or removing one. Every structural change
    // renumbers Sr No. across the whole kit so it always stays 1,2,3...
    // Restructuring the kit (add/remove item, add/remove section) is
    // Admin/SuperAdmin only — the buttons themselves are already hidden for
    // a plain User (see bomRenderScreenItemsHtml), this is the defensive
    // second check. Remove actions (item/section) ask for confirmation
    // first — a stray tap used to delete a row instantly with no way back;
    // Add actions still fire immediately since they're non-destructive.
    ctx.itemsPreview.addEventListener('click', async (e) => {
      if (!ctx.currentKitState) return;
      const serialBtn = e.target.closest('.bom-serial-btn');
      if (serialBtn) {
        ctx.openBomSerialModal(Number(serialBtn.dataset.sec), Number(serialBtn.dataset.idx));
        return;
      }
      const mapBtn = e.target.closest('.bom-challan-map-badge');
      if (mapBtn) {
        if (!ctx.bomIsAdmin) return;
        const si = Number(mapBtn.dataset.sec);
        const idx = Number(mapBtn.dataset.idx);
        if (typeof ctx.bomOpenQuickMapModal === 'function') {
          ctx.bomOpenQuickMapModal(si, idx);
        }
        return;
      }
      const insertBtn = e.target.closest('[data-insert-after-sec]');
      const removeItemBtn = e.target.closest('[data-remove-sec]');
      const addItemBtn = e.target.closest('[data-sec-add-item]');
      const removeSectionBtn = e.target.closest('[data-sec-remove]');
      const addSectionBtn = e.target.closest('#bomBtnAddSectionLive');
      if ((insertBtn || removeItemBtn || addItemBtn || removeSectionBtn || addSectionBtn) && !ctx.bomIsAdmin) return;
      const blankItem = () => ({ sr: '', name: '', model: '', qty: '', remarks: '', serials: '', checked: false, dispatchQty: '' });

      if (insertBtn) {
        const si = Number(insertBtn.dataset.insertAfterSec);
        const idx = Number(insertBtn.dataset.insertAfterIdx);
        ctx.currentKitState[si].items.splice(idx + 1, 0, blankItem());
      } else if (removeItemBtn) {
        const si = Number(removeItemBtn.dataset.removeSec);
        const idx = Number(removeItemBtn.dataset.removeIdx);
        const itemName = (ctx.currentKitState[si].items[idx] && ctx.currentKitState[si].items[idx].name) || 'this item';
        const confirmed = await window.confirmDanger('Remove Item', `Remove "${itemName}" from this BOM? This cannot be undone.`);
        if (!confirmed) return;
        ctx.currentKitState[si].items.splice(idx, 1);
      } else if (addItemBtn) {
        const si = Number(addItemBtn.dataset.secAddItem);
        ctx.currentKitState[si].items.push(blankItem());
      } else if (removeSectionBtn) {
        if (ctx.currentKitState.length <= 1) {
          window.openModal('Cannot Remove', '<p>A kit needs at least one section.</p>');
          return;
        }
        const si = Number(removeSectionBtn.dataset.secRemove);
        const secTitle = ctx.currentKitState[si].title || 'this section';
        const confirmed = await window.confirmDanger('Remove Section', `Remove the section "${secTitle}" and all ${ctx.currentKitState[si].items.length} item(s) in it? This cannot be undone.`);
        if (!confirmed) return;
        ctx.currentKitState.splice(si, 1);
      } else if (addSectionBtn) {
        ctx.currentKitState.push({ title: 'New Section', items: [blankItem()] });
      } else {
        return;
      }
      bomRenumberAll(ctx.currentKitState);
      ctx.rerenderItemsPreview();
    });


  return { openBomSerialModal };
}
