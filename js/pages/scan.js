// js/pages/scan.js
// Standalone "Scan" page — reads QR codes and common 1D barcodes (Code128,
// EAN-13, EAN-8, UPC-A, UPC-E, Code39, ITF, Codabar) straight from the
// device camera, entirely in-browser via the free/open-source html5-qrcode
// library (see index.html's <script> tag — no API key, no external calls).
//
// Camera opens the moment this tab is opened (no separate "Start Scanning"
// step) and decodes automatically the instant a code is in frame — no
// capture button, no popup/new window, just like a normal barcode-scanner
// app. Every distinct scan gets appended to an on-screen list (newest on
// top, with a timestamp + detected format), plus a short beep/vibrate as
// feedback. The camera stays open across multiple scans; a single
// Scan/Stop toggle button lets it be paused and resumed. This page does
// NOT feed into Purchase/BOM/etc. yet — that wiring is a separate, later
// step once it's decided which screen each scanned value should land in.
//
// IMPORTANT FIX vs the first version: html5-qrcode's start() has to be
// called while its target <div> is already visible/on-screen with real
// width/height. This container used to be `display:none` until *after*
// start() resolved, so the camera preview showed up but every frame was
// captured against a zero-size element — it never actually decoded
// anything. The container is now shown BEFORE start() is called.
window.PAGES = window.PAGES || {};

window.PAGES.scan = {
  name: 'Scan',
  icon: 'fa-camera',
  sub: 'Scan barcodes & QR codes with your camera',
  html: `
    <div class="page-head"><i class="fa-solid fa-camera" style="color:var(--gold);"></i><h2>Scan</h2>
      <button type="button" class="info-btn" data-info="Uses your device camera to read QR codes and barcodes (Code128, EAN-13, EAN-8, UPC-A, UPC-E, Code39, ITF, Codabar). Runs entirely in the browser — nothing is uploaded anywhere. Camera opens automatically when you open this tab."><i class="fa-solid fa-circle-info"></i></button>
    </div>

    <div class="panel">
      <h3><i class="fa-solid fa-video"></i> Camera</h3>
      <div class="actions-row" style="margin-top:0;">
        <button class="btn btn-red" type="button" id="scanBtnToggle"><i class="fa-solid fa-stop"></i> Stop Camera</button>
        <span class="note" id="scanStatus" style="align-self:center; margin:0;"><i class="fa-solid fa-spinner fa-spin"></i> Opening camera...</span>
      </div>

      <div id="scanPermissionMsg" class="scan-permission-msg" style="display:none;">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span id="scanPermissionMsgText">Camera permission was denied. Please allow camera access for this site in your browser settings and try again.</span>
      </div>

      <div id="scanReaderWrap" class="scan-reader-wrap" style="display:none;">
        <div id="scanReaderBox"></div>
      </div>
    </div>

    <div class="panel">
      <h3><i class="fa-solid fa-bullseye"></i> Last Scanned</h3>
      <div class="form-grid cols-2">
        <div class="field span-full"><label>Last Scanned Value</label><input id="scanLastValue" readonly placeholder="Nothing scanned yet"></div>
      </div>
    </div>

    <div class="panel">
      <h3><i class="fa-solid fa-list"></i> Scan History <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(this session, newest first)</span></h3>
      <div class="toolbar">
        <div class="grow"></div>
        <button class="btn btn-ghost" type="button" id="scanBtnClearHistory"><i class="fa-solid fa-broom"></i> Clear List</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Value</th><th>Format</th><th>Time</th></tr></thead>
        <tbody id="scanHistoryBody">
          <tr><td colspan="4" style="text-align:center; color:var(--txt-muted); font-style:italic;">No scans yet.</td></tr>
        </tbody>
      </table></div>
    </div>

    <p class="note" style="margin-top:10px;">
      <i class="fa-solid fa-circle-info"></i> Yeh abhi ek standalone Scan tab hai — scanned values sirf isi list mein
      jama hote hain. Kis form/page mein use hone chahiye (Purchase, BOM, etc.), wo wiring baad mein alag se decide karke jodi jayegi.
    </p>
  `,

  init() {
    const $ = (id) => document.getElementById(id);

    const btnToggle = $('scanBtnToggle');
    const statusEl = $('scanStatus');
    const permMsg = $('scanPermissionMsg');
    const permMsgText = $('scanPermissionMsgText');
    const readerWrap = $('scanReaderWrap');
    const readerBox = $('scanReaderBox');
    const lastValueEl = $('scanLastValue');
    const historyBody = $('scanHistoryBody');
    const btnClearHistory = $('scanBtnClearHistory');

    function setStatus(html) {
      statusEl.innerHTML = html;
    }

    // html5-qrcode (see index.html) isn't loaded yet if the CDN failed —
    // fail gracefully with an on-screen message instead of a dead button.
    if (typeof Html5Qrcode === 'undefined') {
      setStatus('<i class="fa-solid fa-triangle-exclamation" style="color:var(--red);"></i> Scanner library failed to load. Check your internet connection and reload the page.');
      btnToggle.disabled = true;
      return;
    }

    // Reads every QR format plus the common 1D barcode formats this project
    // needs (mirrors the Serial No. formats already scanned in Purchase/Sale
    // with handheld barcode guns — this just adds camera-based scanning).
    const SUPPORTED_FORMATS = [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.CODABAR,
    ];

    let html5QrCode = null;
    let isScanning = false;
    let starting = false;
    let scanCount = 0;
    let lastValue = null;
    let lastValueAt = 0;
    let watchdogTimer = null;

    // Short beep via Web Audio API — no external mp3 file needed, so this
    // stays self-contained like the rest of the project (no build step,
    // no extra assets). Vibration is a bonus on phones that support it.
    function playFeedback() {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 130);
      } catch (e) {
        // Web Audio unavailable/blocked — silently skip the beep, scanning still works.
      }
      if (navigator.vibrate) {
        try { navigator.vibrate(80); } catch (e) { /* not supported — ignore */ }
      }
    }

    function escHtml(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function addToHistory(value, formatName) {
      scanCount += 1;
      const stamp = new Date().toLocaleString();
      if (historyBody.children.length === 1 && historyBody.children[0].children.length === 1) {
        historyBody.innerHTML = ''; // clear the "No scans yet." placeholder row
      }
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${scanCount}</td>
        <td style="word-break:break-all;">${escHtml(value)}</td>
        <td>${escHtml(formatName || 'Unknown')}</td>
        <td style="white-space:nowrap;">${escHtml(stamp)}</td>`;
      historyBody.insertBefore(row, historyBody.firstChild); // newest on top
    }

    function onScanSuccess(decodedText, decodedResult) {
      // The camera keeps decoding every frame while a code is still in
      // view, which would otherwise spam the same value dozens of times a
      // second — only log it again if the value changed, or the same value
      // reappears after a short gap (e.g. the same item scanned again later).
      const now = Date.now();
      if (decodedText === lastValue && (now - lastValueAt) < 2000) return;
      lastValue = decodedText;
      lastValueAt = now;

      const formatName = (decodedResult && decodedResult.result && decodedResult.result.format
        && decodedResult.result.format.formatName) || '';
      lastValueEl.value = decodedText;
      addToHistory(decodedText, formatName);
      playFeedback();
    }

    function onScanFailure() {
      // Fires continuously while no code is in frame — expected/normal,
      // nothing to show the user for this.
    }

    function setToggleUi() {
      if (isScanning) {
        btnToggle.className = 'btn btn-red';
        btnToggle.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Camera';
      } else {
        btnToggle.className = 'btn btn-green';
        btnToggle.innerHTML = '<i class="fa-solid fa-play"></i> Start Camera';
      }
    }

    async function startScanning() {
      if (isScanning || starting) return;
      starting = true;
      permMsg.style.display = 'none';
      setStatus('<i class="fa-solid fa-spinner fa-spin"></i> Requesting camera access...');
      btnToggle.disabled = true;

      // Show the preview box BEFORE start() runs — html5-qrcode measures
      // this element's on-screen size to size the video/scan canvas, so it
      // must already be visible (not display:none) at the moment start()
      // is called, or every frame gets decoded against a zero-size canvas
      // and nothing is ever detected even though the camera looks "on".
      readerWrap.style.display = '';

      html5QrCode = new Html5Qrcode('scanReaderBox', { formatsToSupport: SUPPORTED_FORMATS, verbose: false });
      // A function-based qrbox (recommended by html5-qrcode's own docs)
      // sizes the scan region relative to the actual camera frame instead
      // of a fixed 260x260 — avoids failures on webcams/phones whose live
      // feed comes in smaller than that fixed box.
      const config = {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
          const size = Math.max(150, edge);
          return { width: size, height: size };
        },
      };

      try {
        // facingMode "environment" (non-exact) asks for the rear camera on
        // phones but still works on a laptop webcam that has no rear/front
        // concept — the browser just falls back to whatever camera it has.
        await html5QrCode.start({ facingMode: 'environment' }, config, onScanSuccess, onScanFailure);
        isScanning = true;
        starting = false;
        btnToggle.disabled = false;
        setToggleUi();
        setStatus('<i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Scanning — point the camera at a QR code or barcode.');
        // Self-clears if the page is navigated away from without clicking
        // Stop first — same pattern lowstock.js uses for its refresh timer,
        // since app.js has no page-teardown hook to rely on instead.
        watchdogTimer = setInterval(() => {
          if (!document.body.contains(readerBox)) stopScanning();
        }, 2000);
      } catch (err) {
        isScanning = false;
        starting = false;
        readerWrap.style.display = 'none';
        btnToggle.disabled = false;
        setToggleUi();
        const msg = String((err && (err.message || err)) || '').toLowerCase();
        if (msg.indexOf('permission') !== -1 || msg.indexOf('notallowed') !== -1 || msg.indexOf('denied') !== -1) {
          permMsgText.textContent = 'Camera permission was denied. Please allow camera access for this site in your browser settings and try again.';
        } else if (msg.indexOf('notfound') !== -1 || msg.indexOf('no camera') !== -1) {
          permMsgText.textContent = 'No camera was found on this device.';
        } else {
          permMsgText.textContent = 'Could not start the camera. Please check camera permissions and try again.';
        }
        permMsg.style.display = '';
        setStatus('<i class="fa-solid fa-circle-xmark" style="color:var(--red);"></i> Camera is off.');
      }
    }

    async function stopScanning() {
      if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
      if (!html5QrCode || !isScanning) {
        isScanning = false;
        btnToggle.disabled = false;
        readerWrap.style.display = 'none';
        setToggleUi();
        return;
      }
      try {
        await html5QrCode.stop();
        html5QrCode.clear();
      } catch (e) {
        // Already stopped/torn down (e.g. tab was closed mid-scan) — ignore.
      }
      isScanning = false;
      btnToggle.disabled = false;
      readerWrap.style.display = 'none';
      setToggleUi();
      setStatus('<i class="fa-solid fa-circle-info"></i> Camera is off.');
    }

    btnToggle.addEventListener('click', () => {
      if (isScanning) stopScanning();
      else startScanning();
    });

    btnClearHistory.addEventListener('click', () => {
      scanCount = 0;
      lastValue = null;
      lastValueEl.value = '';
      historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--txt-muted); font-style:italic;">No scans yet.</td></tr>';
    });

    // Camera opens the instant this tab is opened — no extra "Start
    // Scanning" click needed, matching how a normal barcode scanner works.
    startScanning();
  },
};
