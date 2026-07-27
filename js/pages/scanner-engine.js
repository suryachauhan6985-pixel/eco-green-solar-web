// js/scanner-engine.js
// ============================================================================
// REUSABLE SCANNER ENGINE
// ============================================================================
// This file has NO storage and NO table/UI logic on purpose. It only knows
// how to (a) run the camera + decode QR/barcodes via html5-qrcode, (b) read
// USB "keyboard wedge" barcode scanners, and (c) play success/duplicate/
// error beeps. Any ERP module (Scanner tab today; Inventory, BOM, Dispatch,
// Purchase, Sales, Warranty, Installation, Returns, ... tomorrow) creates
// its own `new ScannerEngine({ onDecode })`, points it at its own container
// <div>, and decides for itself what a decoded value means (add to a table?
// check against Purchase serials? etc.). That separation is what makes this
// a genuine "Scanner Engine" instead of a one-off page script.
//
// Depends on html5-qrcode (loaded in index.html before this file).
// ============================================================================
window.ScannerEngine = (function () {
  function defaultFormats() {
    // Every format this project needs today (mirrors the handheld
    // barcode-gun formats already used in Purchase/Sale) plus a few common
    // 1D extras html5-qrcode supports for free.
    return [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.CODABAR,
    ];
  }

  // 1D barcode format names (html5-qrcode's decodedResult.result.format.formatName)
  // — anything in this set gets the wide "barcode" scan box; QR_CODE gets the
  // square box. Anything else/unknown leaves the current box shape as-is.
  const BARCODE_1D_FORMATS = new Set([
    'CODE_128', 'CODE_39', 'EAN_13', 'UPC_A', 'UPC_E', 'EAN_8', 'ITF', 'CODABAR',
  ]);

  function classifyShape(formatName) {
    if (formatName === 'QR_CODE') return 'qr';
    if (BARCODE_1D_FORMATS.has(formatName)) return 'barcode';
    return null;
  }

  // Builds the qrbox callback for a given shape. 'qr' = square (fits a QR
  // code snugly); 'barcode' = wide short rectangle (fits a 1D barcode's
  // label shape); 'auto' = a versatile in-between box used before the
  // engine has seen a code yet, so it can guess reasonably either way.
  function qrboxForShape(shape) {
    return (viewfinderWidth, viewfinderHeight) => {
      if (shape === 'barcode') {
        const width = Math.max(220, Math.floor(viewfinderWidth * 0.85));
        const height = Math.max(90, Math.floor(viewfinderHeight * 0.28));
        return { width, height };
      }
      if (shape === 'qr') {
        const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.68);
        const size = Math.max(180, edge);
        return { width: size, height: size };
      }
      // 'auto' — nothing decoded yet this session; a mid-sized rectangle
      // reads either a QR or a barcode reasonably until the real shape
      // is learned from the first successful decode.
      const width = Math.max(200, Math.floor(viewfinderWidth * 0.78));
      const height = Math.max(150, Math.floor(viewfinderHeight * 0.45));
      return { width, height };
    };
  }

  class ScannerEngine {
    /**
     * @param {Object} opts
     * @param {(value:string, formatName:string, source:'camera') => void} opts.onDecode
     *        Fires on every successful camera decode. The engine does NOT
     *        decide duplicate/invalid/valid here — that's the caller's job.
     * @param {number} [opts.repeatWindowMs] how long the SAME value held in
     *        front of the camera is suppressed from firing onDecode again
     *        and again every frame (continuous-scan noise control only —
     *        not related to "duplicate serial number" business logic).
     */
    constructor(opts = {}) {
      this.onDecode = typeof opts.onDecode === 'function' ? opts.onDecode : () => {};
      this.repeatWindowMs = opts.repeatWindowMs || 1500;
      this.html5QrCode = null;
      this.containerId = null;
      this.running = false;
      this.starting = false;
      this.facingMode = 'environment';
      this.torchOn = false;
      this._lastValue = null;
      this._lastAt = 0;
      // Scan-box shape: 'auto' until a code is actually decoded, then
      // 'qr' or 'barcode' — see qrboxForShape()/classifyShape() above.
      this.boxShape = 'auto';
      this._reshaping = false;
    }

    static isLibraryLoaded() {
      return typeof Html5Qrcode !== 'undefined';
    }

    get isRunning() { return this.running; }
    get currentFacingMode() { return this.facingMode; }
    get isTorchOn() { return this.torchOn; }
    get currentBoxShape() { return this.boxShape; }

    async start(containerId, opts = {}) {
      if (this.running || this.starting) return;
      if (!ScannerEngine.isLibraryLoaded()) {
        throw new Error('Scanner library not loaded. Check your internet connection and reload the page.');
      }
      this.starting = true;
      this.containerId = containerId;
      this.facingMode = opts.facingMode || this.facingMode;
      const formats = opts.formats || defaultFormats();

      this.html5QrCode = new Html5Qrcode(containerId, { formatsToSupport: formats, verbose: false });
      const config = {
        fps: opts.fps || 10,
        // Function-based qrbox sizes the scan region relative to the real
        // camera frame instead of a fixed box — avoids failures when the
        // live feed is smaller than a hardcoded 260x260. Shape (square vs
        // wide rectangle) is decided by this.boxShape — see reshape().
        qrbox: opts.qrbox || qrboxForShape(this.boxShape),
      };

      try {
        await this.html5QrCode.start(
          { facingMode: this.facingMode },
          config,
          (decodedText, decodedResult) => this._handleDecode(decodedText, decodedResult),
          () => { /* fires continuously while no code is in frame — expected */ }
        );
        this.running = true;
        this.starting = false;
      } catch (err) {
        this.running = false;
        this.starting = false;
        this.html5QrCode = null;
        throw err;
      }
    }

    _handleDecode(decodedText, decodedResult) {
      // Continuous scanning (req #3) keeps decoding every frame while a
      // code is still in view — only forward it again if the value changed
      // or the same code reappears after a short gap (e.g. re-scanned
      // later on purpose).
      const now = Date.now();
      if (decodedText === this._lastValue && (now - this._lastAt) < this.repeatWindowMs) return;
      this._lastValue = decodedText;
      this._lastAt = now;
      const formatName = (decodedResult && decodedResult.result && decodedResult.result.format
        && decodedResult.result.format.formatName) || 'Unknown';
      this.onDecode(decodedText, formatName, 'camera');
      // Auto-detect: square box for QR, wide box for 1D barcodes — reshape
      // for the NEXT read, fire-and-forget so it never delays reporting
      // this decode to the caller.
      const shape = classifyShape(formatName);
      if (shape) this.reshape(shape);
    }

    /** Switches the on-screen scan-box shape ('qr' square vs 'barcode' wide
     * rectangle vs 'auto'), restarting the live scan region to apply it.
     * No-op if already that shape or a reshape is already underway. */
    async reshape(shape) {
      if (this.boxShape === shape || this._reshaping || !this.running) return;
      this._reshaping = true;
      this.boxShape = shape;
      try {
        const containerId = this.containerId;
        const facingMode = this.facingMode;
        await this.stop();
        await this.start(containerId, { facingMode });
      } catch (e) {
        // If the reshape-restart fails, leave the camera stopped rather
        // than throwing from a fire-and-forget call — the person can tap
        // Scan again.
      } finally {
        this._reshaping = false;
      }
    }

    async stop() {
      if (!this.html5QrCode) { this.running = false; return; }
      try {
        if (this.running) await this.html5QrCode.stop();
        this.html5QrCode.clear();
      } catch (e) {
        // Already stopped/torn down (e.g. tab closed mid-scan) — ignore.
      }
      this.running = false;
      this.torchOn = false;
      this.html5QrCode = null;
    }

    /** Toggle between rear ("environment") and front ("user") camera. */
    async switchCamera() {
      const wasRunning = this.running;
      const containerId = this.containerId;
      const nextFacing = this.facingMode === 'environment' ? 'user' : 'environment';
      if (wasRunning) await this.stop();
      this.facingMode = nextFacing;
      if (wasRunning) await this.start(containerId, { facingMode: nextFacing });
      return this.facingMode;
    }

    /** Torch/flash — only works on devices+browsers that expose it (mostly Android Chrome). */
    async toggleFlash() {
      if (!this.html5QrCode || !this.running) return { supported: false, on: false };
      try {
        const next = !this.torchOn;
        await this.html5QrCode.applyVideoConstraints({ advanced: [{ torch: next }] });
        this.torchOn = next;
        return { supported: true, on: this.torchOn };
      } catch (e) {
        return { supported: false, on: false };
      }
    }
  }

  // ---------- Audio feedback (Web Audio — no mp3 assets needed) ----------
  let audioCtx = null;
  function getCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) { try { audioCtx = new Ctx(); } catch (e) { return null; } }
    return audioCtx;
  }
  function tone(freq, durationMs, delayMs) {
    const ctx = getCtx();
    if (!ctx) return;
    setTimeout(() => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = 0.18;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => { try { osc.stop(); } catch (e2) {} }, durationMs);
      } catch (e) { /* Web Audio blocked — skip silently, scanning still works */ }
    }, delayMs || 0);
  }

  /**
   * ScannerEngine.beep('success' | 'duplicate' | 'error')
   * - success  = one short beep
   * - duplicate = double beep (distinct from success, per req #7/#13)
   * - error    = one long beep (undecodable / invalid)
   */
  ScannerEngine.beep = function (kind) {
    if (kind === 'duplicate') {
      tone(760, 90, 0);
      tone(760, 90, 170);
    } else if (kind === 'error') {
      tone(220, 420, 0);
    } else {
      tone(1050, 110, 0);
    }
    if (navigator.vibrate) {
      try {
        if (kind === 'duplicate') navigator.vibrate([60, 60, 60]);
        else if (kind === 'error') navigator.vibrate(250);
        else navigator.vibrate(60);
      } catch (e) { /* not supported — ignore */ }
    }
  };

  // ---------- USB HID (keyboard-wedge) barcode scanner support ----------
  // USB barcode scanners plug in as a standard keyboard: they "type" the
  // decoded value into whatever input has focus, then send Enter. Point
  // this at a dedicated (auto-focused) text input and it needs ZERO other
  // code changes to work — req #16. Returns a detach() function.
  ScannerEngine.attachUsbHid = function (inputEl, onScan) {
    if (!inputEl) return () => {};
    function onKeydown(e) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const val = (inputEl.value || '').trim();
        inputEl.value = '';
        if (val) onScan(val, 'USB-HID');
      }
    }
    inputEl.addEventListener('keydown', onKeydown);
    return () => inputEl.removeEventListener('keydown', onKeydown);
  };

  return ScannerEngine;
})();
