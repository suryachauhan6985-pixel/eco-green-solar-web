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
    }

    static isLibraryLoaded() {
      return typeof Html5Qrcode !== 'undefined';
    }

    get isRunning() { return this.running; }
    get currentFacingMode() { return this.facingMode; }
    get isTorchOn() { return this.torchOn; }

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
        // live feed is smaller than a hardcoded 260x260.
        qrbox: opts.qrbox || ((viewfinderWidth, viewfinderHeight) => {
          const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
          const size = Math.max(150, edge);
          return { width: size, height: size };
        }),
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
