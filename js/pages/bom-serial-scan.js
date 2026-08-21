// js/pages/bom-serial-scan.js
// -----------------------------------------------------------------------------
// Split out of js/pages/bom.js (pure code-organization refactor, no logic
// changes) per refactor-bom-prompt.md. Contains the camera/BT serial
// scanner (openBomScanner, startBomScanCamera, launchBomScanCamera,
// onBomScanSuccess, showBomScanResult, hideBomScanResult, retryBomScan,
// confirmBomScan, toggleBomScanTorch, flipBomScanCamera, closeBomScanner,
// openBomBtScanResult, confirmBomBtScan). The Serial No. modal itself
// (openBomSerialModal, ~430 lines on its own) lives in the sibling file
// bom-serial-modal.js instead, purely to keep both files under the
// 800-line cap (refactor-bom-prompt.md explicitly allows this). Must load
// AFTER bom-kit-helpers.js/bom-challan.js and BEFORE bom-serial-modal.js
// and bom.js, which call createBomSerialScanModule(ctx) /
// createBomSerialModalModule(ctx) from inside init().
//
// createBomSerialScanModule(ctx) is a factory: every function below closes
// over `ctx`, a single shared-state object created in bom.js's init() (DOM
// refs, currentKitState, bomScanState, bomSerialBtMode, bomVerified, and
// every other top-level init() function/variable, all reachable as
// ctx.<name>). This replaces the natural JS closure these functions used
// to have over init()'s local scope back when they were nested directly
// inside it — see refactor-bom-prompt.md section 2 for why.
// -----------------------------------------------------------------------------
function createBomSerialScanModule(ctx) {
    function bomScanBeep() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1050;
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
        osc.onended = () => ctx.close();
      } catch (e) { /* Web Audio not available — silently skip the beep */ }
    }

    function bomScanSetStatus(msg) {
      const el = document.getElementById('bomScanStatus');
      if (el) el.textContent = msg;
    }

    function openBomScanner(targetId) {
      const box = document.getElementById(targetId);
      if (!box) return;
      ctx.bomScanState.targetId = targetId;
      ctx.bomScanState.torchOn = false;
      ctx.bomScanState.handledOnce = false;
      ctx.bomScanState.pendingText = null;
      ctx.bomScanState.pendingIsDup = false;
      ctx.bomScanState.pendingIsOverCap = false;

      const existingSerials = bomSplitSerials(box.value);
      ctx.bomScanState.addedCount = existingSerials.length;

      const maxAttr = box.getAttribute('data-max-serials');
      const max = maxAttr !== null && maxAttr !== '' ? Number(maxAttr) : null;
      const countLabel = max != null ? `${existingSerials.length} / ${max}` : `${existingSerials.length}`;

      const overlay = document.createElement('div');
      overlay.className = 'ss-scanner-overlay';
      overlay.innerHTML = `
        <div class="ss-scanner-topbar">
          <button type="button" class="ss-icon-btn light" id="bomScanBack" title="Close Scanner"><i class="fa-solid fa-arrow-left"></i></button>
          <div class="ss-scanner-title">
            <span><i class="fa-solid fa-camera"></i> Scan Serials</span>
            <span class="badge" id="bomScanTitleBadge">${countLabel}</span>
          </div>
          <div class="ss-scanner-topbtns">
            <button type="button" class="ss-icon-btn light" id="bomScanTorch" title="Flashlight"><i class="fa-solid fa-bolt"></i></button>
            <button type="button" class="ss-icon-btn light" id="bomScanFlip" title="Flip camera"><i class="fa-solid fa-camera-rotate"></i></button>
          </div>
        </div>
        <div class="ss-scanner-camwrap">
          <div id="bomScanRegion" class="ss-scanner-camfeed"></div>
          <div class="ss-scanner-target" id="bomScanTargetBox">
            <div class="ss-scanner-target-corners">
              <div class="ss-scanner-target-corners-topright"></div>
              <div class="ss-scanner-target-corners-bottomleft"></div>
            </div>
            <div class="ss-scanner-laser"></div>
          </div>
          <div class="ss-scanner-instruction" id="bomScanStatus"><i class="fa-solid fa-spinner fa-spin"></i> Initializing camera&hellip;</div>
          <div class="ss-scanner-result" id="bomScanResult" style="display:none;">
            <div class="ss-scanner-result-card" id="bomScanResultCard">
              <div class="ss-scanner-result-label">Scanned Barcode / QR</div>
              <div class="ss-scanner-result-value" id="bomScanResultValue"></div>
              <div class="ss-scanner-result-msg" id="bomScanResultMsg"></div>
            </div>
            <div class="ss-scanner-result-actions">
              <button type="button" class="btn btn-ghost" id="bomScanRetry"><i class="fa-solid fa-rotate-left"></i> Retry</button>
              <button type="button" class="btn btn-green" id="bomScanDone2"><i class="fa-solid fa-check"></i> Add & Next</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      ctx.bomScanState.overlayEl = overlay;
      document.body.style.overflow = 'hidden';

      overlay.querySelector('#bomScanBack').onclick = ctx.closeBomScanner;
      overlay.querySelector('#bomScanTorch').onclick = ctx.toggleBomScanTorch;
      overlay.querySelector('#bomScanFlip').onclick = ctx.flipBomScanCamera;
      overlay.querySelector('#bomScanRetry').onclick = ctx.retryBomScan;
      overlay.querySelector('#bomScanDone2').onclick = ctx.confirmBomScan;

      ctx.startBomScanCamera();
    }

    function startBomScanCamera() {
      if (!window.Html5Qrcode) {
        ctx.bomScanSetStatus('Scanner library failed to load. Check your connection and try again.');
        return;
      }
      window.Html5Qrcode.getCameras().then((cameras) => {
        if (!cameras || !cameras.length) { ctx.bomScanSetStatus('No camera found on this device.'); return; }
        ctx.bomScanState.cameras = cameras;
        const backIdx = cameras.findIndex((c) => /back|rear|environment/i.test(c.label || ''));
        ctx.bomScanState.cameraIndex = backIdx !== -1 ? backIdx : 0;
        ctx.launchBomScanCamera();
      }).catch((err) => {
        console.warn('Camera permission error', err);
        ctx.bomScanSetStatus('Camera permission denied. Please allow camera access in your browser settings, then tap Close and try again.');
      });
    }

    function launchBomScanCamera() {
      const camera = ctx.bomScanState.cameras[ctx.bomScanState.cameraIndex];
      if (!camera) return;
      ctx.bomScanState.handledOnce = false;
      ctx.bomScanSetStatus('Place the serial barcode / QR in the box');

      const config = { fps: 10 };
      if (window.Html5QrcodeSupportedFormats) {
        config.formatsToSupport = [
          window.Html5QrcodeSupportedFormats.QR_CODE,
          window.Html5QrcodeSupportedFormats.EAN_13,
          window.Html5QrcodeSupportedFormats.EAN_8,
          window.Html5QrcodeSupportedFormats.CODE_128,
          window.Html5QrcodeSupportedFormats.CODE_39,
          window.Html5QrcodeSupportedFormats.UPC_A,
          window.Html5QrcodeSupportedFormats.UPC_E,
          window.Html5QrcodeSupportedFormats.ITF,
        ];
      }

      ctx.bomScanState.html5QrCode = new window.Html5Qrcode('bomScanRegion', { verbose: false });
      ctx.bomScanState.html5QrCode.start(
        camera.id,
        config,
        ctx.onBomScanSuccess,
        () => { /* per-frame "no code found yet" — expected, ignore */ }
      ).catch((err) => {
        console.warn('Camera start error', err);
        ctx.bomScanSetStatus('Could not start the camera. Tap Close and try again.');
      });
    }

    // Decoding pauses here (handledOnce guard, exactly like Purchase/
    // scansheet.js) until the user explicitly taps Retry or Done.
    function onBomScanSuccess(decodedText) {
      if (ctx.bomScanState.handledOnce) return;
      ctx.bomScanState.handledOnce = true;
      ctx.bomScanBeep();
      if (navigator.vibrate) { try { navigator.vibrate(180); } catch (e) { /* not supported */ } }
      ctx.showBomScanResult(decodedText);
    }

    function showBomScanResult(text) {
      const code = String(text || '').trim();
      const box = document.getElementById(ctx.bomScanState.targetId);
      const existing = box ? bomSplitSerials(box.value) : [];
      const dup = !!code && existing.some((s) => s.toLowerCase() === code.toLowerCase());

      // The target box carries its own required-Quantity cap via
      // data-max-serials (set by ctx.openBomSerialModal). Reading it straight
      // off the element keeps this generic — works for the main Serial
      // No. modal today and any future scan target without extra wiring.
      const maxAttr = box ? box.getAttribute('data-max-serials') : null;
      const max = maxAttr !== null && maxAttr !== '' ? Number(maxAttr) : null;
      const overCap = !dup && !!code && max != null && !Number.isNaN(max) && existing.length >= max;

      ctx.bomScanState.pendingText = code;
      ctx.bomScanState.pendingIsDup = dup;
      ctx.bomScanState.pendingIsOverCap = overCap;

      const panel = document.getElementById('bomScanResult');
      const card = document.getElementById('bomScanResultCard');
      const valueEl = document.getElementById('bomScanResultValue');
      const msgEl = document.getElementById('bomScanResultMsg');
      const doneBtn = document.getElementById('bomScanDone2');
      const targetBox = document.getElementById('bomScanTargetBox');
      if (!panel || !valueEl) return;

      valueEl.textContent = code || '(empty)';
      if (card) card.classList.toggle('dup', dup || overCap);
      if (msgEl) msgEl.textContent = dup
        ? 'This serial no. is already in the box. Retry with a different code, or remove the old one first.'
        : overCap
          ? `You cannot scan more than the entered quantity — ${max} serial number(s) allowed for this item.`
          : 'Scanned successfully.';
      if (doneBtn) doneBtn.style.display = (dup || overCap) ? 'none' : '';

      panel.style.display = 'flex';
      ctx.bomScanSetStatus('');
      if (targetBox) targetBox.style.visibility = 'hidden';
    }

    function hideBomScanResult() {
      const panel = document.getElementById('bomScanResult');
      const targetBox = document.getElementById('bomScanTargetBox');
      if (panel) panel.style.display = 'none';
      if (targetBox) targetBox.style.visibility = '';
      ctx.bomScanState.pendingText = null;
      ctx.bomScanState.pendingIsDup = false;
      ctx.bomScanState.pendingIsOverCap = false;
    }

    function retryBomScan() {
      ctx.hideBomScanResult();
      ctx.bomScanState.handledOnce = false;
      ctx.bomScanSetStatus('Place the serial barcode / QR in the box');
    }

    // "Done" — commit the scanned value into the target textarea (one per
    // line, same normalization Purchase's paste handler uses), then resume
    // scanning so the next serial can be captured right away.
    function confirmBomScan() {
      if (ctx.bomScanState.pendingIsDup || ctx.bomScanState.pendingIsOverCap) return; // guard — Done is hidden for dupes/over-cap anyway
      const code = ctx.bomScanState.pendingText;
      if (!code) { ctx.retryBomScan(); return; }

      const box = document.getElementById(ctx.bomScanState.targetId);
      if (box) {
        const existing = bomSplitSerials(box.value);
        existing.push(code);
        box.value = existing.join('\n') + '\n';
        box.dispatchEvent(new Event('input', { bubbles: true }));
        ctx.bomScanState.addedCount = existing.length;
        const countEl = document.getElementById('bomScanCount');
        if (countEl) countEl.innerHTML = `<i class="fa-solid fa-list-check"></i> <span>${existing.length} serial(s) entered</span>`;
        const badgeEl = document.getElementById('bomScanTitleBadge');
        if (badgeEl) {
          const maxAttr = box.getAttribute('data-max-serials');
          const max = maxAttr !== null && maxAttr !== '' ? Number(maxAttr) : null;
          badgeEl.textContent = max != null ? `${existing.length} / ${max}` : `${existing.length}`;
        }
      }

      ctx.hideBomScanResult();
      ctx.bomScanState.handledOnce = false;
      ctx.bomScanSetStatus('Added \u2713 — scan the next one');
    }

    function toggleBomScanTorch() {
      if (!ctx.bomScanState.html5QrCode) return;
      ctx.bomScanState.torchOn = !ctx.bomScanState.torchOn;
      ctx.bomScanState.html5QrCode.applyVideoConstraints({ advanced: [{ torch: ctx.bomScanState.torchOn }] })
        .then(() => {
          const btn = document.getElementById('bomScanTorch');
          if (btn) btn.classList.toggle('active', ctx.bomScanState.torchOn);
        })
        .catch(() => { if (window.showToast) window.showToast('Flashlight not supported on this device'); ctx.bomScanState.torchOn = false; });
    }

    function flipBomScanCamera() {
      if (!ctx.bomScanState.cameras.length || ctx.bomScanState.cameras.length < 2) { if (window.showToast) window.showToast('Only one camera available'); return; }
      ctx.bomScanState.cameraIndex = (ctx.bomScanState.cameraIndex + 1) % ctx.bomScanState.cameras.length;
      const qr = ctx.bomScanState.html5QrCode;
      if (qr) qr.stop().then(ctx.launchBomScanCamera).catch(ctx.launchBomScanCamera);
      else ctx.launchBomScanCamera();
    }

    function closeBomScanner() {
      const qr = ctx.bomScanState.html5QrCode;
      const targetId = ctx.bomScanState.targetId;
      ctx.bomScanState.pendingText = null;
      ctx.bomScanState.pendingIsDup = false;
      ctx.bomScanState.pendingIsOverCap = false;
      const finish = () => {
        if (ctx.bomScanState.overlayEl) { ctx.bomScanState.overlayEl.remove(); ctx.bomScanState.overlayEl = null; }
        document.body.style.overflow = '';
        ctx.bomScanState.html5QrCode = null;
        // Final normalize pass (dedupe/trim), same cleanup Purchase's
        // blur() handler already does.
        const box = targetId ? document.getElementById(targetId) : null;
        if (box) {
          box.value = bomSplitSerials(box.value).join('\n');
          // Same readonly-then-release trick ctx.openBomSerialModal's
          // focusSerialBox() uses in BT mode — a plain box.focus() here
          // pops the mobile soft keyboard right over a physical BT
          // scanner's target field, which is exactly what BT mode exists
          // to avoid.
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
            box.focus();
          }
          box.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
      if (qr) qr.stop().then(finish).catch(finish);
      else finish();
    }

    // Bluetooth-scanner result card — same Retry/Done + duplicate-check
    // card the camera scanner shows (reuses ctx.showBomScanResult/ctx.confirmBomScan
    // verbatim, since those only look up elements by id and don't care
    // whether they're sitting inside a live camera overlay or this
    // camera-less "paused" one). Previously a BT scan's Enter just landed
    // straight in the textarea with no confirmation step at all — this
    // gives BT scans the same pause-and-confirm card the camera already
    // has, per scansheet.js's Bluetooth Scan overlay pattern.
    // NOTE: no longer called from ctx.openBomSerialModal's BT keydown handler —
    // that now commits a valid scan directly (see the keydown listener in
    // ctx.openBomSerialModal) instead of popping this overlay every time, since
    // the overlay + manual "Done" tap + ctx.closeBomScanner()'s 450ms
    // readonly-release was exactly what made BT mode feel slow. Left in
    // place in case a future BT entry point wants the confirm-card flow.
    function openBomBtScanResult(targetId, code) {
      ctx.bomScanState.targetId = targetId;
      ctx.bomScanState.handledOnce = true;

      const overlay = document.createElement('div');
      overlay.className = 'ss-scanner-overlay ss-bt-result-overlay';
      overlay.innerHTML = `
        <div class="ss-scanner-topbar">
          <button type="button" class="ss-icon-btn light" id="bomScanBack" title="Close"><i class="fa-solid fa-arrow-left"></i></button>
          <div class="ss-scanner-title">Bluetooth Scan</div>
          <div class="ss-scanner-topbtns"></div>
        </div>
        <div class="ss-scanner-camwrap">
          <div class="ss-bt-result-blank">
            <i class="fa-brands fa-bluetooth-b"></i>
            <span>Scanner paused</span>
          </div>
          <div class="ss-scanner-instruction" id="bomScanStatus"></div>
          <div class="ss-scanner-result" id="bomScanResult" style="display:none;">
            <div class="ss-scanner-result-card" id="bomScanResultCard">
              <div class="ss-scanner-result-label">Scanned value</div>
              <div class="ss-scanner-result-value" id="bomScanResultValue"></div>
              <div class="ss-scanner-result-msg" id="bomScanResultMsg"></div>
            </div>
            <div class="ss-scanner-result-actions">
              <button type="button" class="btn btn-ghost" id="bomScanRetry"><i class="fa-solid fa-rotate-left"></i> Retry</button>
              <button type="button" class="btn btn-green" id="bomScanDone2"><i class="fa-solid fa-check"></i> Done</button>
            </div>
          </div>
        </div>
        <div class="ss-scanner-bottom">
          <span class="proof-name" id="bomScanCount" style="color:#fff;">0 serial(s) added</span>
          <button type="button" class="btn btn-red ss-scanner-cancel" id="bomScanCancel"><i class="fa-solid fa-xmark"></i> Close</button>
        </div>
      `;
      document.body.appendChild(overlay);
      ctx.bomScanState.overlayEl = overlay;
      document.body.style.overflow = 'hidden';
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

      overlay.querySelector('#bomScanBack').onclick = ctx.closeBomScanner;
      overlay.querySelector('#bomScanCancel').onclick = ctx.closeBomScanner;
      // "Retry" for a BT scan just discards this reading and closes back to
      // the (readonly-released) box, ready for the next physical scan —
      // there's no live decode loop to resume like the camera has.
      overlay.querySelector('#bomScanRetry').onclick = ctx.closeBomScanner;
      overlay.querySelector('#bomScanDone2').onclick = ctx.confirmBomBtScan;

      const targetBox = document.getElementById(targetId);
      const existingCount = targetBox ? bomSplitSerials(targetBox.value).length : 0;
      const countEl = document.getElementById('bomScanCount');
      if (countEl) countEl.textContent = `${existingCount} serial(s) added`;

      ctx.showBomScanResult(code);
    }

    // Same as ctx.confirmBomScan (appends the pending value to the target
    // textarea) but also closes the BT result overlay afterwards, since a
    // BT scan has no camera feed running behind the card to return to.
    function confirmBomBtScan() {
      ctx.confirmBomScan();
      ctx.closeBomScanner();
    }

    // Serial No. popup — click the Serial No. button on a serial-mandatory
    // row (Solar Panel, Inverter, etc.) to open the same style of box
    // Purchase/Sale already use: scan-or-type with auto-newline on any
    // delimiter, paste normalization, and a live count against the item's
    // Quantity. Adds "Scan Serial No." / "Upload Serial No. through File"
    // as two entry modes on top of the same box, per the requested flow.

  return { bomScanBeep, bomScanSetStatus, openBomScanner, startBomScanCamera, launchBomScanCamera, onBomScanSuccess, showBomScanResult, hideBomScanResult, retryBomScan, confirmBomScan, toggleBomScanTorch, flipBomScanCamera, closeBomScanner, openBomBtScanResult, confirmBomBtScan };
}
