/**
 * Eco Green Solar ERP - Visual Print Template Designer & Publishing Studio v2.1
 * Features:
 * - Photoshop-Style Multi-Format Canvas (A4, A5, Letter, Legal, 80mm POS Thermal, Custom mm/in/px)
 * - Pre-loaded Existing ERP BOM & Dual-Copy Challan Presets
 * - Direct Device File Uploads for Logo, Signature, and Stamp/Seal
 * - Granular Per-Element Single-Font & Typography Inspector
 * - Real-time Margin Adjustments & Browser Bleed Zone Simulation
 * - 1-Click Excel-Style Fit-To-Page Scaling
 */

(function(window) {
  'use strict';

  let currentTemplate = null;
  let currentDocType = 'all';
  let previewScale = 0.75;
  let showBrowserBleed = false;
  let showBrowserHeaderFooter = false;
  let activeTypographyElement = 'title';

  const TemplateDesignerPage = {
    render(opts = {}) {
      return `
        <div class="tpl-designer-wrap">
          <!-- Top Studio Header -->
          <div class="tpl-designer-topbar">
            <div class="tpl-topbar-left">
              <div style="display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-compass-drafting" style="color:var(--blue, #3b8ed0); font-size:18px;"></i>
                <strong style="font-size:14px; color:var(--txt, #fff);">Template Studio</strong>
                <span class="pill pill-gold" style="font-size:10px; padding:1px 6px;">v2.1</span>
              </div>
              <select id="tplDocTypeFilter" class="input" style="padding:4px 8px; font-size:12px; font-weight:700; border-radius:6px; background:var(--bg2, #181d24);">
                <option value="all">All Documents</option>
                <option value="bom">BOM / BOQ Kits</option>
                <option value="challan">Delivery Challans</option>
                <option value="invoice">GST Invoices</option>
              </select>
              <select id="tplActiveSelect" class="input" style="padding:4px 8px; font-size:12px; border-radius:6px; background:var(--bg2, #181d24); min-width:240px;">
                <!-- Templates grouped dynamically -->
              </select>
            </div>

            <div class="tpl-topbar-right">
              <button type="button" class="btn btn-ghost" id="tplBtnNew" style="font-size:11px; padding:5px 9px;" title="Create new blueprint"><i class="fa-solid fa-plus"></i> New</button>
              <button type="button" class="btn btn-ghost" id="tplBtnClone" style="font-size:11px; padding:5px 9px;" title="Clone current layout"><i class="fa-solid fa-clone"></i> Clone</button>
              <button type="button" class="btn btn-ghost" id="tplBtnExport" style="font-size:11px; padding:5px 9px;" title="Export JSON"><i class="fa-solid fa-download"></i> Export</button>
              <button type="button" class="btn btn-ghost" id="tplBtnImport" style="font-size:11px; padding:5px 9px;" title="Import JSON"><i class="fa-solid fa-upload"></i> Import</button>
              <button type="button" class="btn btn-gold" id="tplBtnSetActive" style="font-size:11px; padding:5px 11px; font-weight:700;" title="Set as default print layout"><i class="fa-solid fa-star"></i> Set Default</button>
              <button type="button" class="btn btn-blue" id="tplBtnSave" style="font-size:11px; padding:5px 12px; font-weight:700;"><i class="fa-solid fa-floppy-disk"></i> Save Layout</button>
              <button type="button" class="btn btn-green" id="tplBtnTestPrint" style="font-size:11px; padding:5px 12px; font-weight:700;"><i class="fa-solid fa-print"></i> Test Print</button>
            </div>
          </div>

          <!-- Split Workspace -->
          <div class="tpl-designer-split">
            <!-- Left Controls Sidebar -->
            <div class="tpl-controls-sidebar">
              <!-- Tab Navigation -->
              <div class="tpl-tabs-header">
                <button type="button" class="tpl-tab-btn active" data-tab="tab-canvas"><i class="fa-solid fa-ruler-combined"></i> Canvas</button>
                <button type="button" class="tpl-tab-btn" data-tab="tab-cols"><i class="fa-solid fa-table-columns"></i> Columns</button>
                <button type="button" class="tpl-tab-btn" data-tab="tab-spacing"><i class="fa-solid fa-font"></i> Typography</button>
                <button type="button" class="tpl-tab-btn" data-tab="tab-media"><i class="fa-solid fa-image"></i> Media & Uploads</button>
                <button type="button" class="tpl-tab-btn" data-tab="tab-watermark"><i class="fa-solid fa-stamp"></i> Watermark</button>
                <button type="button" class="tpl-tab-btn" data-tab="tab-pagefit" style="color:var(--gold, #f1c40f);"><i class="fa-solid fa-compress"></i> Page-Fit</button>
              </div>

              <!-- Tab 1: 📐 Canvas & Page Setup -->
              <div class="tpl-tab-pane active" id="tab-canvas">
                <div class="tpl-card">
                  <div class="tpl-card-title">
                    <span><i class="fa-solid fa-palette"></i> Canvas Format Preset</span>
                  </div>
                  <div class="field" style="margin-bottom:10px;">
                    <label style="font-size:11px;">Standard Paper Dimensions</label>
                    <select id="selCanvasPreset" class="input" style="font-size:12px; padding:5px 8px; width:100%;">
                      <option value="A4_portrait">A4 Portrait (210 × 297 mm) — Standard</option>
                      <option value="A4_landscape">A4 Landscape (297 × 210 mm) — Dual Copy</option>
                      <option value="A5_portrait">A5 Portrait (148 × 210 mm) — Half Page</option>
                      <option value="A5_landscape">A5 Landscape (210 × 148 mm)</option>
                      <option value="Letter_portrait">Letter (8.5 × 11 in)</option>
                      <option value="Legal_portrait">Legal (8.5 × 14 in)</option>
                      <option value="POS80">80mm POS Thermal Roll Receipt</option>
                      <option value="custom">Custom Canvas Dimensions...</option>
                    </select>
                  </div>

                  <div id="customCanvasRow" class="form-grid" style="grid-template-columns: 1fr 1fr 1fr; gap:8px; display:none; margin-bottom:10px;">
                    <div class="field">
                      <label style="font-size:10.5px;">Width</label>
                      <input type="number" id="inpCustomWidth" value="210" min="40" max="500" style="padding:4px 6px; font-size:12px;">
                    </div>
                    <div class="field">
                      <label style="font-size:10.5px;">Height</label>
                      <input type="number" id="inpCustomHeight" value="297" min="40" max="800" style="padding:4px 6px; font-size:12px;">
                    </div>
                    <div class="field">
                      <label style="font-size:10.5px;">Unit</label>
                      <select id="selCustomUnit" class="input" style="padding:4px 6px; font-size:12px;">
                        <option value="mm">mm</option>
                        <option value="in">inches</option>
                        <option value="px">pixels</option>
                      </select>
                    </div>
                  </div>

                  <div class="tpl-card-title" style="margin-top:12px;">Page Orientation</div>
                  <div style="display:flex; gap:8px;">
                    <button type="button" class="btn btn-blue" id="btnOrientPortrait" style="flex:1; font-size:11.5px; font-weight:700;"><i class="fa-solid fa-file"></i> Portrait</button>
                    <button type="button" class="btn btn-ghost" id="btnOrientLandscape" style="flex:1; font-size:11.5px; font-weight:700;"><i class="fa-solid fa-file-lines fa-rotate-90"></i> Landscape</button>
                  </div>
                </div>

                <div class="tpl-card">
                  <div class="tpl-card-title">Live Page Margins (mm)</div>
                  <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:8px;">
                    <div class="field"><label style="font-size:10.5px;">Top Margin (mm)</label><input type="number" id="marginItemTop" min="0" max="40" value="8" style="padding:4px 6px; font-size:12px;"></div>
                    <div class="field"><label style="font-size:10.5px;">Bottom Margin (mm)</label><input type="number" id="marginItemBottom" min="0" max="40" value="8" style="padding:4px 6px; font-size:12px;"></div>
                    <div class="field"><label style="font-size:10.5px;">Left Margin (mm)</label><input type="number" id="marginItemLeft" min="0" max="40" value="6" style="padding:4px 6px; font-size:12px;"></div>
                    <div class="field"><label style="font-size:10.5px;">Right Margin (mm)</label><input type="number" id="marginItemRight" min="0" max="40" value="6" style="padding:4px 6px; font-size:12px;"></div>
                  </div>
                </div>
              </div>

              <!-- Tab 2: 📊 Columns & Grid Manager -->
              <div class="tpl-tab-pane" id="tab-cols">
                <div class="tpl-card">
                  <div class="tpl-card-title">
                    <span>Table Columns &amp; Widths</span>
                    <button type="button" class="btn btn-ghost" id="tplBtnAddCol" style="font-size:10.5px; padding:3px 8px;"><i class="fa-solid fa-plus"></i> Add Column</button>
                  </div>
                  <div id="tplColumnsList">
                    <!-- Column cards injected dynamically -->
                  </div>
                </div>
              </div>

              <!-- Tab 3: 🎛️ Granular Single-Font & Typography Inspector -->
              <div class="tpl-tab-pane" id="tab-spacing">
                <div class="tpl-card" style="border:1.5px solid rgba(59,142,208,0.3); background:rgba(59,142,208,0.05);">
                  <div class="tpl-card-title" style="color:var(--blue, #3b8ed0);">
                    <span><i class="fa-solid fa-arrow-pointer"></i> Element Single-Font Inspector</span>
                  </div>
                  <div class="field" style="margin-bottom:10px;">
                    <label style="font-size:11px;">Select Element to Customize Font</label>
                    <select id="selTypoTargetElement" class="input" style="font-size:12px; padding:5px 8px; width:100%; font-weight:700;">
                      <option value="title">1. Document Main Title</option>
                      <option value="subtitle">2. Document Subtitle / Tagline</option>
                      <option value="tableHead">3. Table Header Row (TH)</option>
                      <option value="category">4. Section / Category Headers</option>
                      <option value="data">5. Table Data Rows (TD)</option>
                      <option value="total">6. Total Summary Row</option>
                    </select>
                  </div>

                  <div class="tpl-slider-group">
                    <div class="tpl-slider-label">
                      <span>Element Font Size</span>
                      <span class="tpl-slider-val" id="valElemFontSize">13.5pt</span>
                    </div>
                    <input type="range" class="tpl-range-input" id="rangeElemFontSize" min="7.0" max="22.0" step="0.5" value="13.5">
                  </div>

                  <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px;">
                    <div class="field">
                      <label style="font-size:10.5px;">Font Weight</label>
                      <select id="selElemFontWeight" class="input" style="padding:4px 6px; font-size:11.5px;">
                        <option value="400">Regular (400)</option>
                        <option value="600">Semi-Bold (600)</option>
                        <option value="700">Bold (700)</option>
                        <option value="900">Black / Ultra Bold (900)</option>
                      </select>
                    </div>
                    <div class="field">
                      <label style="font-size:10.5px;">Text Color</label>
                      <input type="color" id="inpElemTextColor" value="#000000" style="height:30px; padding:2px; cursor:pointer;">
                    </div>
                  </div>

                  <div class="field">
                    <label style="font-size:10.5px;">Background Color</label>
                    <input type="color" id="inpElemBgColor" value="#f2f2f2" style="height:30px; padding:2px; cursor:pointer;">
                  </div>
                </div>

                <div class="tpl-card">
                  <div class="tpl-card-title">Global Table Padding &amp; Borders</div>
                  <div class="tpl-slider-group">
                    <div class="tpl-slider-label">
                      <span>Cell Padding / Row Height</span>
                      <span class="tpl-slider-val" id="valRowPadding">1.2px</span>
                    </div>
                    <input type="range" class="tpl-range-input" id="rangeRowPadding" min="0.5" max="8.0" step="0.2" value="1.2">
                  </div>

                  <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:8px;">
                    <div class="field">
                      <label style="font-size:10.5px;">Border Color</label>
                      <input type="color" id="inputBorderColor" value="#000000" style="height:30px; padding:2px; cursor:pointer;">
                    </div>
                    <div class="field">
                      <label style="font-size:10.5px;">Border Width</label>
                      <select id="selBorderWidth" class="input" style="font-size:11.5px; padding:4px 6px;">
                        <option value="1px">1px (Standard)</option>
                        <option value="1.5px">1.5px (Medium)</option>
                        <option value="2px">2px (Thick)</option>
                        <option value="0.5px">0.5px (Hairline)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tab 4: 🖼️ Media & Device Uploads -->
              <div class="tpl-tab-pane" id="tab-media">
                <!-- Logo Upload -->
                <div class="tpl-card">
                  <div class="tpl-card-title">
                    <span><i class="fa-solid fa-cloud-arrow-up"></i> Organization Logo</span>
                    <button type="button" class="btn btn-ghost" id="btnResetLogo" style="font-size:10px; padding:2px 6px;">Reset</button>
                  </div>
                  <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                    <input type="file" id="fileLogoUpload" accept="image/*" style="display:none;">
                    <button type="button" class="btn btn-blue" id="btnBrowseLogo" style="font-size:11px; padding:5px 10px;"><i class="fa-solid fa-folder-open"></i> Upload Logo from Device</button>
                    <span id="txtLogoStatus" style="font-size:11px; color:var(--txt-muted);">Stock Logo</span>
                  </div>

                  <label class="checkbox" style="font-size:11.5px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" id="chkShowLogo" checked>
                    <span>Show Logo on Sheet</span>
                  </label>

                  <div class="tpl-slider-group" id="logoWidthGroup">
                    <div class="tpl-slider-label">
                      <span>Logo Width</span>
                      <span class="tpl-slider-val" id="valLogoWidth">140px</span>
                    </div>
                    <input type="range" class="tpl-range-input" id="rangeLogoWidth" min="50" max="280" step="5" value="140">
                  </div>
                </div>

                <!-- Signature Upload -->
                <div class="tpl-card">
                  <div class="tpl-card-title">
                    <span><i class="fa-solid fa-signature"></i> Authorized Signature Image</span>
                    <button type="button" class="btn btn-ghost" id="btnResetSign" style="font-size:10px; padding:2px 6px;">Remove</button>
                  </div>
                  <input type="file" id="fileSignUpload" accept="image/*" style="display:none;">
                  <button type="button" class="btn btn-ghost" id="btnBrowseSign" style="font-size:11px; padding:5px 10px; width:100%; margin-bottom:6px;"><i class="fa-solid fa-pen-nib"></i> Upload Signature Image</button>
                  <label class="checkbox" style="font-size:11.5px; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" id="chkShowSignatures" checked>
                    <span>Show Signature Blocks</span>
                  </label>
                </div>

                <!-- Company Stamp / Seal Upload -->
                <div class="tpl-card">
                  <div class="tpl-card-title">
                    <span><i class="fa-solid fa-stamp"></i> Official Stamp / Seal</span>
                    <button type="button" class="btn btn-ghost" id="btnResetStamp" style="font-size:10px; padding:2px 6px;">Remove</button>
                  </div>
                  <input type="file" id="fileStampUpload" accept="image/*" style="display:none;">
                  <button type="button" class="btn btn-ghost" id="btnBrowseStamp" style="font-size:11px; padding:5px 10px; width:100%;"><i class="fa-solid fa-certificate"></i> Upload Stamp / Seal Image</button>
                </div>

                <!-- Document Titles & Footer Notes -->
                <div class="tpl-card">
                  <div class="tpl-card-title">Document Titles &amp; Notes</div>
                  <div class="field" style="margin-bottom:8px;">
                    <label style="font-size:10.5px;">Main Document Title</label>
                    <input type="text" id="inputHeaderTitle" placeholder="e.g. BILL OF MATERIAL (BOM)" style="padding:4px 6px; font-size:12px;">
                  </div>
                  <div class="field" style="margin-bottom:8px;">
                    <label style="font-size:10.5px;">Subtitle / Tagline</label>
                    <input type="text" id="inputHeaderSubtitle" placeholder="e.g. Solar System Specification Sheet" style="padding:4px 6px; font-size:12px;">
                  </div>
                  <div class="field">
                    <label style="font-size:10.5px;">Footer Notes &amp; Terms</label>
                    <textarea id="txtFooterNotes" rows="2" style="width:100%; font-size:11px; padding:5px; border-radius:6px; background:var(--bg2); border:1px solid var(--border-light);" placeholder="Footer terms..."></textarea>
                  </div>
                </div>
              </div>

              <!-- Tab 5: 🌊 Watermark & Dynamic Variables -->
              <div class="tpl-tab-pane" id="tab-watermark">
                <div class="tpl-card">
                  <div class="tpl-card-title">Document Background Watermark</div>
                  <label class="checkbox" style="font-size:11.5px; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" id="chkShowWatermark">
                    <span>Enable Background Watermark</span>
                  </label>

                  <div class="field" style="margin-bottom:8px;">
                    <label style="font-size:11px;">Watermark Text</label>
                    <input type="text" id="inpWatermarkText" placeholder="e.g. ORIGINAL / DRAFT / PAID" value="ORIGINAL" style="padding:5px 8px; font-size:12px;">
                  </div>

                  <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:8px;">
                    <div class="field">
                      <label style="font-size:11px;">Color</label>
                      <input type="color" id="inpWatermarkColor" value="#3b8ed0" style="height:32px; padding:2px; cursor:pointer;">
                    </div>
                    <div class="field">
                      <label style="font-size:11px;">Angle (deg)</label>
                      <input type="number" id="inpWatermarkAngle" value="-30" min="-90" max="90" style="padding:4px 6px; font-size:12px;">
                    </div>
                  </div>

                  <div class="tpl-slider-group">
                    <div class="tpl-slider-label">
                      <span>Opacity</span>
                      <span class="tpl-slider-val" id="valWatermarkOpacity">10%</span>
                    </div>
                    <input type="range" class="tpl-range-input" id="rangeWatermarkOpacity" min="0.02" max="0.40" step="0.02" value="0.10">
                  </div>
                </div>

                <div class="tpl-card">
                  <div class="tpl-card-title">Dynamic Variable Placeholders</div>
                  <p style="font-size:11px; color:var(--txt-muted); margin-bottom:8px;">
                    Use these tags in Document Title, Subtitle, or Footer Notes:
                  </p>
                  <div style="display:flex; flex-wrap:wrap; gap:4px; font-family:monospace; font-size:10.5px;">
                    <span class="pill pill-blue">{{company_name}}</span>
                    <span class="pill pill-blue">{{customer_name}}</span>
                    <span class="pill pill-blue">{{doc_no}}</span>
                    <span class="pill pill-blue">{{date}}</span>
                    <span class="pill pill-blue">{{capacity}}</span>
                    <span class="pill pill-blue">{{vehicle_no}}</span>
                    <span class="pill pill-blue">{{gstin}}</span>
                  </div>
                </div>
              </div>

              <!-- Tab 6: ⚡ 1-Page Auto-Fit & Browser Margin Inspector -->
              <div class="tpl-tab-pane" id="tab-pagefit">
                <div class="tpl-card" style="border:1.5px solid rgba(212,175,55,0.3); background:rgba(212,175,55,0.04);">
                  <div class="tpl-card-title" style="color:var(--gold, #f1c40f);">
                    <span><i class="fa-solid fa-wand-magic-sparkles"></i> 1-Page Auto Fit Engine</span>
                  </div>
                  <p style="font-size:11.5px; color:var(--txt-muted); margin-bottom:12px; line-height:1.4;">
                    Measures exact pixel dimensions of all content and scales font and paddings so the layout fits comfortably on <strong>exactly 1 page</strong> without spilling.
                  </p>
                  <button type="button" class="btn btn-gold" id="btnAutoFitOnePage" style="width:100%; font-weight:800; padding:8px 14px; font-size:12.5px; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <i class="fa-solid fa-compress"></i> ⚡ Auto-Fit to Exactly 1 Page
                  </button>
                </div>

                <div class="tpl-card">
                  <div class="tpl-card-title">Manual Print Scale Zoom</div>
                  <div class="tpl-slider-group">
                    <div class="tpl-slider-label">
                      <span>Document Scale</span>
                      <span class="tpl-slider-val" id="valPrintScale">100%</span>
                    </div>
                    <input type="range" class="tpl-range-input" id="rangePrintScale" min="0.60" max="1.15" step="0.01" value="1.00">
                  </div>
                </div>

                <div class="tpl-card">
                  <div class="tpl-card-title">Browser Print Inspector</div>
                  <label class="checkbox" style="font-size:11.5px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" id="chkSimulateBleed">
                    <span>Show Printer Hardware Bleed Safety Box</span>
                  </label>
                  <label class="checkbox" style="font-size:11.5px; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" id="chkSimulateBrowserHeaderFooter">
                    <span>Simulate Browser Default Header/Footer</span>
                  </label>
                </div>
              </div>

            </div>

            <!-- Right Live A4 Canvas Preview -->
            <div class="tpl-viewport">
              <!-- Floating Live Gauge & Zoom Controls -->
              <div class="tpl-viewport-toolbar">
                <div class="tpl-gauge-badge tpl-gauge-safe" id="tplLiveGauge">
                  <i class="fa-solid fa-circle-check"></i>
                  <span id="tplGaugeText">94% of Page 1 (Fits on 1 Page)</span>
                </div>

                <div style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--txt-muted);">
                  <span>Zoom:</span>
                  <input type="range" id="rangePreviewZoom" min="0.25" max="1.50" step="0.05" value="0.75" style="width:90px; accent-color:var(--blue, #3b8ed0);">
                  <span id="valPreviewZoom" style="font-family:monospace; font-weight:700; color:var(--txt, #fff);">75%</span>
                  <button type="button" class="btn btn-ghost" id="btnZoomFit" style="padding:2px 6px; font-size:10.5px;">Fit</button>
                  <button type="button" class="btn btn-ghost" id="btnZoom100" style="padding:2px 6px; font-size:10.5px;">100%</button>
                </div>
              </div>

              <!-- Browser Header Simulation Bar -->
              <div class="browser-header-sim" id="browserHeaderSim" style="display:none; width:794px;">
                <span id="simBrowserDate">25/08/2026, 11:30 AM</span>
                <span id="simBrowserTitle">BOM Kit - EGS/2026/0842</span>
              </div>

              <!-- Canvas Container -->
              <div class="a4-sheet-preview-wrap A4_portrait" id="a4CanvasWrap" style="transform: scale(0.75);">
                <iframe id="a4PreviewIframe" class="a4-sheet-inner-frame" style="width:794px; height:1123px; border:none; display:block;"></iframe>
                <!-- Red page break boundary line -->
                <div class="a4-page-break-line" id="a4PageBreakLine" style="top: 1123px;">
                  <span class="a4-page-break-label">1-PAGE CUTOFF BOUNDARY</span>
                </div>
                <!-- Browser Bleed Safety Overlay -->
                <div class="browser-bleed-box" id="browserBleedBox" style="display:none;">
                  <span class="browser-bleed-label">PRINTABLE HARDWARE BLEED ZONE</span>
                </div>
              </div>

              <!-- Browser Footer Simulation Bar -->
              <div class="browser-footer-sim" id="browserFooterSim" style="display:none; width:794px;">
                <span>https://app.ecogreensolar.com/print</span>
                <span>Page 1 of 1</span>
              </div>

            </div>
          </div>
        </div>
      `;
    },

    init(opts = {}) {
      const $ = (id) => document.getElementById(id);
      const PTE = window.PrintTemplateEngine;
      if (!PTE) return;

      currentDocType = opts.docType || 'all';
      if ($('tplDocTypeFilter')) $('tplDocTypeFilter').value = currentDocType;

      function loadTemplatesDropdown(preferredId = null) {
        const templates = PTE.getTemplatesByDocType(currentDocType);
        const sel = $('tplActiveSelect');
        if (!sel || templates.length === 0) return;

        let activeTpl = preferredId ? PTE.getTemplateById(preferredId) : null;
        if (!activeTpl) {
          activeTpl = PTE.getActiveTemplate(currentDocType === 'all' ? 'bom' : currentDocType);
        }
        if (!activeTpl || (currentDocType !== 'all' && activeTpl.docType !== currentDocType)) {
          activeTpl = templates[0];
        }

        const presets = templates.filter((t) => t.isPreset);
        const custom = templates.filter((t) => !t.isPreset);

        let html = '';
        if (presets.length) {
          html += '<optgroup label="⭐ Pre-loaded Official Templates">';
          presets.forEach((t) => {
            html += `<option value="${t.id}" ${t.id === activeTpl.id ? 'selected' : ''}>${t.name}</option>`;
          });
          html += '</optgroup>';
        }
        if (custom.length) {
          html += '<optgroup label="🎨 My Custom Templates">';
          custom.forEach((t) => {
            html += `<option value="${t.id}" ${t.id === activeTpl.id ? 'selected' : ''}>${t.name}</option>`;
          });
          html += '</optgroup>';
        }
        sel.innerHTML = html;
        sel.value = activeTpl.id;

        loadTemplateIntoEditor(activeTpl.id);
      }

      function loadTemplateIntoEditor(id) {
        const tpl = PTE.getTemplateById(id);
        currentTemplate = JSON.parse(JSON.stringify(tpl));
        syncControlsFromTemplate();
        refreshLivePreview();
      }

      function syncControlsFromTemplate() {
        if (!currentTemplate) return;
        const t = currentTemplate;

        // Canvas Preset
        const canvasPreset = t.canvasPreset || (t.orientation === 'landscape' ? 'A4_landscape' : 'A4_portrait');
        if ($('selCanvasPreset')) $('selCanvasPreset').value = canvasPreset;
        if ($('customCanvasRow')) $('customCanvasRow').style.display = (canvasPreset === 'custom') ? 'grid' : 'none';

        // Orientation Buttons
        const isLandscape = t.orientation === 'landscape';
        if ($('btnOrientPortrait')) $('btnOrientPortrait').className = isLandscape ? 'btn btn-ghost' : 'btn btn-blue';
        if ($('btnOrientLandscape')) $('btnOrientLandscape').className = isLandscape ? 'btn btn-blue' : 'btn btn-ghost';

        // Margins
        const m = t.margins || { top: 8, bottom: 8, left: 6, right: 6 };
        if ($('marginItemTop')) $('marginItemTop').value = m.top || 8;
        if ($('marginItemBottom')) $('marginItemBottom').value = m.bottom || 8;
        if ($('marginItemLeft')) $('marginItemLeft').value = m.left || 6;
        if ($('marginItemRight')) $('marginItemRight').value = m.right || 6;

        // Header and Footer Text
        if ($('inputHeaderTitle')) $('inputHeaderTitle').value = t.headerTitle || '';
        if ($('inputHeaderSubtitle')) $('inputHeaderSubtitle').value = t.headerSubtitle || '';
        if ($('chkShowLogo')) $('chkShowLogo').checked = t.showLogo !== false;
        const logoWidthNum = parseInt(t.logoWidth, 10) || 140;
        if ($('rangeLogoWidth')) $('rangeLogoWidth').value = logoWidthNum;
        if ($('valLogoWidth')) $('valLogoWidth').textContent = logoWidthNum + 'px';
        if ($('txtLogoStatus')) $('txtLogoStatus').textContent = t.customLogoData ? 'Custom Logo' : 'Stock Logo';

        if ($('chkShowFooterNotes')) $('chkShowFooterNotes').checked = t.showFooterNotes !== false;
        if ($('txtFooterNotes')) $('txtFooterNotes').value = t.footerNotes || '';
        if ($('chkShowSignatures')) $('chkShowSignatures').checked = t.showSignatures !== false;

        // Watermark
        const wm = t.watermark || {};
        if ($('chkShowWatermark')) $('chkShowWatermark').checked = !!wm.show;
        if ($('inpWatermarkText')) $('inpWatermarkText').value = wm.text || 'ORIGINAL';
        if ($('inpWatermarkColor')) $('inpWatermarkColor').value = wm.color || '#3b8ed0';
        if ($('inpWatermarkAngle')) $('inpWatermarkAngle').value = wm.angle != null ? wm.angle : -30;
        const wmOp = wm.opacity != null ? wm.opacity : 0.10;
        if ($('rangeWatermarkOpacity')) $('rangeWatermarkOpacity').value = wmOp;
        if ($('valWatermarkOpacity')) $('valWatermarkOpacity').textContent = Math.round(wmOp * 100) + '%';

        // Scale
        const scaleNum = Number(t.printScale) || 1.0;
        if ($('rangePrintScale')) $('rangePrintScale').value = scaleNum;
        if ($('valPrintScale')) $('valPrintScale').textContent = Math.round(scaleNum * 100) + '%';

        // Row Padding & Borders
        const rowPadNum = parseFloat(t.rowPadding) || 1.2;
        if ($('rangeRowPadding')) $('rangeRowPadding').value = rowPadNum;
        if ($('valRowPadding')) $('valRowPadding').textContent = rowPadNum + 'px';
        if ($('inputBorderColor')) $('inputBorderColor').value = t.borderColor || '#000000';
        if ($('selBorderWidth')) $('selBorderWidth').value = t.borderWidth || '1px';

        syncTypographyTargetControl();
        updateCanvasGeometry();
        renderColumnsList();
      }

      function syncTypographyTargetControl() {
        if (!currentTemplate) return;
        const t = currentTemplate;
        let targetObj = null;

        if (activeTypographyElement === 'title') {
          if (!t.titleStyles) t.titleStyles = { fontSize: '13.5pt', fontWeight: '900', color: '#000000', bg: 'transparent' };
          targetObj = t.titleStyles;
        } else if (activeTypographyElement === 'subtitle') {
          if (!t.subtitleStyles) t.subtitleStyles = { fontSize: '8.5pt', fontWeight: '400', color: '#444444', bg: 'transparent' };
          targetObj = t.subtitleStyles;
        } else if (activeTypographyElement === 'tableHead') {
          if (!t.tableHeadStyles) t.tableHeadStyles = { fontSize: '9.2pt', fontWeight: '800', color: '#ffffff', bg: t.tableHeadBg || '#666699' };
          targetObj = t.tableHeadStyles;
        } else if (activeTypographyElement === 'category') {
          if (!t.categoryStyles) t.categoryStyles = { fontSize: '9.6pt', fontWeight: '700', color: '#000000', bg: t.sectionHeaderBg || '#f2f2f2' };
          targetObj = t.categoryStyles;
        } else if (activeTypographyElement === 'data') {
          if (!t.dataStyles) t.dataStyles = { fontSize: '9.0pt', fontWeight: '400', color: '#000000', bg: '#ffffff' };
          targetObj = t.dataStyles;
        } else if (activeTypographyElement === 'total') {
          if (!t.totalStyles) t.totalStyles = { fontSize: '9.5pt', fontWeight: '800', color: '#000000', bg: '#fafafa' };
          targetObj = t.totalStyles;
        }

        if (targetObj) {
          const fsNum = parseFloat(targetObj.fontSize) || 10.0;
          if ($('rangeElemFontSize')) $('rangeElemFontSize').value = fsNum;
          if ($('valElemFontSize')) $('valElemFontSize').textContent = fsNum + 'pt';
          if ($('selElemFontWeight')) $('selElemFontWeight').value = targetObj.fontWeight || '700';
          if ($('inpElemTextColor')) $('inpElemTextColor').value = targetObj.color && targetObj.color.startsWith('#') ? targetObj.color : '#000000';
          if ($('inpElemBgColor')) $('inpElemBgColor').value = targetObj.bg && targetObj.bg.startsWith('#') ? targetObj.bg : '#ffffff';
        }
      }

      function updateCanvasGeometry() {
        if (!currentTemplate) return;
        const isLandscape = currentTemplate.orientation === 'landscape';
        const canvasPreset = currentTemplate.canvasPreset || (isLandscape ? 'A4_landscape' : 'A4_portrait');

        let widthPx = 794;
        let heightPx = 1123;

        if (canvasPreset === 'A4_landscape' || canvasPreset === 'A5_landscape') {
          widthPx = 1123;
          heightPx = 794;
        } else if (canvasPreset === 'A5_portrait') {
          widthPx = 559;
          heightPx = 794;
        } else if (canvasPreset === 'POS80') {
          widthPx = 320;
          heightPx = 880;
        } else if (canvasPreset === 'Letter_portrait') {
          widthPx = 816;
          heightPx = 1056;
        } else if (canvasPreset === 'Legal_portrait') {
          widthPx = 816;
          heightPx = 1344;
        }

        const wrap = $('a4CanvasWrap');
        const iframe = $('a4PreviewIframe');
        const breakLine = $('a4PageBreakLine');
        const headerSim = $('browserHeaderSim');
        const footerSim = $('browserFooterSim');

        if (wrap) {
          wrap.className = `a4-sheet-preview-wrap ${canvasPreset}`;
          wrap.style.width = widthPx + 'px';
          wrap.style.height = heightPx + 'px';
        }

        if (iframe) {
          iframe.style.width = widthPx + 'px';
          iframe.style.height = heightPx + 'px';
        }

        if (breakLine) {
          breakLine.style.top = heightPx + 'px';
        }

        if (headerSim) headerSim.style.width = widthPx + 'px';
        if (footerSim) footerSim.style.width = widthPx + 'px';
      }

      function renderColumnsList() {
        const listEl = $('tplColumnsList');
        if (!listEl || !currentTemplate) return;

        listEl.innerHTML = (currentTemplate.columns || []).map((col, idx) => `
          <div class="tpl-col-item" data-index="${idx}">
            <div class="tpl-col-header">
              <label class="tpl-col-title checkbox">
                <input type="checkbox" class="chk-col-vis" data-index="${idx}" ${col.visible !== false ? 'checked' : ''}>
                <span>${col.key}</span>
              </label>
              <div class="tpl-align-btns">
                <button type="button" class="tpl-align-btn ${col.align === 'left' ? 'active' : ''}" data-align="left" data-index="${idx}" title="Align Left"><i class="fa-solid fa-align-left"></i></button>
                <button type="button" class="tpl-align-btn ${col.align === 'center' ? 'active' : ''}" data-align="center" data-index="${idx}" title="Align Center"><i class="fa-solid fa-align-center"></i></button>
                <button type="button" class="tpl-align-btn ${col.align === 'right' ? 'active' : ''}" data-align="right" data-index="${idx}" title="Align Right"><i class="fa-solid fa-align-right"></i></button>
                <button type="button" class="tpl-align-btn btn-col-up" data-index="${idx}" title="Move Left"><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" class="tpl-align-btn btn-col-down" data-index="${idx}" title="Move Right"><i class="fa-solid fa-arrow-down"></i></button>
                <button type="button" class="tpl-align-btn btn-col-del" data-index="${idx}" style="color:#e74c3c;" title="Remove Column"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <input type="text" class="input input-col-label" data-index="${idx}" value="${col.label}" placeholder="Header label..." style="flex:1; font-size:11px; padding:3px 6px;">
              <input type="text" class="input input-col-width" data-index="${idx}" value="${col.width}" placeholder="e.g. 15%" style="width:65px; font-size:11px; padding:3px 4px; text-align:center;">
            </div>
          </div>
        `).join('');

        // Wire Column Event Handlers
        listEl.querySelectorAll('.chk-col-vis').forEach((chk) => {
          chk.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            currentTemplate.columns[idx].visible = e.target.checked;
            refreshLivePreview();
          });
        });

        listEl.querySelectorAll('.input-col-label').forEach((inp) => {
          inp.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            currentTemplate.columns[idx].label = e.target.value;
            refreshLivePreview();
          });
        });

        listEl.querySelectorAll('.input-col-width').forEach((inp) => {
          inp.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            currentTemplate.columns[idx].width = e.target.value;
            refreshLivePreview();
          });
        });

        listEl.querySelectorAll('.tpl-align-btn[data-align]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const idx = parseInt(target.dataset.index, 10);
            currentTemplate.columns[idx].align = target.dataset.align;
            renderColumnsList();
            refreshLivePreview();
          });
        });

        listEl.querySelectorAll('.btn-col-up').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            if (idx > 0) {
              const tmp = currentTemplate.columns[idx];
              currentTemplate.columns[idx] = currentTemplate.columns[idx - 1];
              currentTemplate.columns[idx - 1] = tmp;
              renderColumnsList();
              refreshLivePreview();
            }
          });
        });

        listEl.querySelectorAll('.btn-col-down').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            if (idx < currentTemplate.columns.length - 1) {
              const tmp = currentTemplate.columns[idx];
              currentTemplate.columns[idx] = currentTemplate.columns[idx + 1];
              currentTemplate.columns[idx + 1] = tmp;
              renderColumnsList();
              refreshLivePreview();
            }
          });
        });

        listEl.querySelectorAll('.btn-col-del').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            if (currentTemplate.columns.length <= 1) {
              alert('A table must have at least one visible column.');
              return;
            }
            currentTemplate.columns.splice(idx, 1);
            renderColumnsList();
            refreshLivePreview();
          });
        });
      }

      function refreshLivePreview() {
        if (!currentTemplate) return;
        const html = PTE.renderDocumentHtml(currentTemplate.docType || 'bom', {}, currentTemplate);
        const iframe = $('a4PreviewIframe');
        if (!iframe) return;

        iframe.srcdoc = html;
        setTimeout(measurePageUtilization, 150);
      }

      function measurePageUtilization() {
        const iframe = $('a4PreviewIframe');
        if (!iframe || !currentTemplate) return;
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          const root = doc.getElementById('printSheetRoot') || doc.body;
          const naturalHeight = root.scrollHeight || root.offsetHeight;
          const isLandscape = currentTemplate.orientation === 'landscape';
          const maxTargetHeight = isLandscape ? 740 : 1060;

          const utilization = Math.round((naturalHeight / maxTargetHeight) * 100);
          const gaugeEl = $('tplLiveGauge');
          const gaugeText = $('tplGaugeText');

          if (gaugeEl && gaugeText) {
            if (utilization <= 100) {
              gaugeEl.className = 'tpl-gauge-badge tpl-gauge-safe';
              gaugeText.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${utilization}% of Page 1 (Fits on 1 Page)`;
            } else {
              gaugeEl.className = 'tpl-gauge-badge tpl-gauge-warn';
              gaugeText.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${utilization}% (Spills to Page 2 — Click Auto-Fit)`;
            }
          }
        } catch (e) {}
      }

      function autoFitOnePage() {
        const iframe = $('a4PreviewIframe');
        if (!iframe || !currentTemplate) return;
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          const root = doc.getElementById('printSheetRoot') || doc.body;
          const naturalHeight = root.scrollHeight || root.offsetHeight;
          const isLandscape = currentTemplate.orientation === 'landscape';
          const maxTargetHeight = isLandscape ? 740 : 1060;

          if (naturalHeight > maxTargetHeight) {
            let scale = maxTargetHeight / naturalHeight;
            scale = Math.max(0.65, Math.min(1.0, Math.floor(scale * 100) / 100));
            currentTemplate.printScale = scale;
            currentTemplate.rowPadding = '1.0px 2.5px';
            currentTemplate.baseFontSize = '8.6pt';
            currentTemplate.sectionHeaderPadding = '1.8px 3px';

            syncControlsFromTemplate();
            refreshLivePreview();
            if (window.showNotification) window.showNotification('⚡ Template auto-scaled & locked to exactly 1 Page!', 'success');
          } else {
            if (window.showNotification) window.showNotification('✅ Content already fits comfortably on 1 Page.', 'info');
          }
        } catch (e) {
          console.warn('Auto-fit error:', e);
        }
      }

      // Tab Navigation
      document.querySelectorAll('.tpl-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.tpl-tab-btn').forEach((b) => b.classList.remove('active'));
          document.querySelectorAll('.tpl-tab-pane').forEach((p) => p.classList.remove('active'));
          btn.classList.add('active');
          const targetPane = $(btn.dataset.tab);
          if (targetPane) targetPane.classList.add('active');
        });
      });

      // Canvas Format Preset
      if ($('selCanvasPreset')) $('selCanvasPreset').addEventListener('change', (e) => {
        const val = e.target.value;
        currentTemplate.canvasPreset = val;
        if (val.includes('landscape')) currentTemplate.orientation = 'landscape';
        else if (val.includes('portrait') || val === 'POS80') currentTemplate.orientation = 'portrait';
        if ($('customCanvasRow')) $('customCanvasRow').style.display = (val === 'custom') ? 'grid' : 'none';
        syncControlsFromTemplate();
        refreshLivePreview();
      });

      // Orientation Buttons
      if ($('btnOrientPortrait')) $('btnOrientPortrait').addEventListener('click', () => {
        currentTemplate.orientation = 'portrait';
        currentTemplate.canvasPreset = 'A4_portrait';
        syncControlsFromTemplate();
        refreshLivePreview();
      });

      if ($('btnOrientLandscape')) $('btnOrientLandscape').addEventListener('click', () => {
        currentTemplate.orientation = 'landscape';
        currentTemplate.canvasPreset = 'A4_landscape';
        syncControlsFromTemplate();
        refreshLivePreview();
      });

      // Real-Time Live Margins
      ['marginItemTop', 'marginItemBottom', 'marginItemLeft', 'marginItemRight'].forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener('input', () => {
          currentTemplate.margins = {
            top: parseInt($('marginItemTop').value, 10) || 0,
            bottom: parseInt($('marginItemBottom').value, 10) || 0,
            left: parseInt($('marginItemLeft').value, 10) || 0,
            right: parseInt($('marginItemRight').value, 10) || 0
          };
          refreshLivePreview();
        });
      });

      // Typography Inspector Element Switcher
      if ($('selTypoTargetElement')) $('selTypoTargetElement').addEventListener('change', (e) => {
        activeTypographyElement = e.target.value;
        syncTypographyTargetControl();
      });

      if ($('rangeElemFontSize')) $('rangeElemFontSize').addEventListener('input', (e) => {
        const val = e.target.value + 'pt';
        if ($('valElemFontSize')) $('valElemFontSize').textContent = val;
        let targetObj = currentTemplate[activeTypographyElement + 'Styles'];
        if (!targetObj) targetObj = currentTemplate[activeTypographyElement + 'Styles'] = {};
        targetObj.fontSize = val;
        refreshLivePreview();
      });

      if ($('selElemFontWeight')) $('selElemFontWeight').addEventListener('change', (e) => {
        let targetObj = currentTemplate[activeTypographyElement + 'Styles'];
        if (!targetObj) targetObj = currentTemplate[activeTypographyElement + 'Styles'] = {};
        targetObj.fontWeight = e.target.value;
        refreshLivePreview();
      });

      if ($('inpElemTextColor')) $('inpElemTextColor').addEventListener('input', (e) => {
        let targetObj = currentTemplate[activeTypographyElement + 'Styles'];
        if (!targetObj) targetObj = currentTemplate[activeTypographyElement + 'Styles'] = {};
        targetObj.color = e.target.value;
        refreshLivePreview();
      });

      if ($('inpElemBgColor')) $('inpElemBgColor').addEventListener('input', (e) => {
        let targetObj = currentTemplate[activeTypographyElement + 'Styles'];
        if (!targetObj) targetObj = currentTemplate[activeTypographyElement + 'Styles'] = {};
        targetObj.bg = e.target.value;
        refreshLivePreview();
      });

      // Row Padding & Borders
      if ($('rangeRowPadding')) $('rangeRowPadding').addEventListener('input', (e) => {
        const val = e.target.value + 'px';
        if ($('valRowPadding')) $('valRowPadding').textContent = val;
        currentTemplate.rowPadding = val + ' 3.5px';
        refreshLivePreview();
      });

      if ($('inputBorderColor')) $('inputBorderColor').addEventListener('input', (e) => {
        currentTemplate.borderColor = e.target.value;
        refreshLivePreview();
      });

      if ($('selBorderWidth')) $('selBorderWidth').addEventListener('change', (e) => {
        currentTemplate.borderWidth = e.target.value;
        refreshLivePreview();
      });

      // Media Uploads (Logo, Signature, Stamp)
      if ($('btnBrowseLogo')) $('btnBrowseLogo').addEventListener('click', () => $('fileLogoUpload').click());
      if ($('fileLogoUpload')) $('fileLogoUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
          currentTemplate.customLogoData = re.target.result;
          $('txtLogoStatus').textContent = file.name;
          refreshLivePreview();
        };
        reader.readAsDataURL(file);
      });
      if ($('btnResetLogo')) $('btnResetLogo').addEventListener('click', () => {
        delete currentTemplate.customLogoData;
        $('txtLogoStatus').textContent = 'Stock Logo';
        refreshLivePreview();
      });

      if ($('btnBrowseSign')) $('btnBrowseSign').addEventListener('click', () => $('fileSignUpload').click());
      if ($('fileSignUpload')) $('fileSignUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
          currentTemplate.customSignData = re.target.result;
          refreshLivePreview();
        };
        reader.readAsDataURL(file);
      });
      if ($('btnResetSign')) $('btnResetSign').addEventListener('click', () => {
        delete currentTemplate.customSignData;
        refreshLivePreview();
      });

      if ($('btnBrowseStamp')) $('btnBrowseStamp').addEventListener('click', () => $('fileStampUpload').click());
      if ($('fileStampUpload')) $('fileStampUpload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
          currentTemplate.customStampData = re.target.result;
          refreshLivePreview();
        };
        reader.readAsDataURL(file);
      });
      if ($('btnResetStamp')) $('btnResetStamp').addEventListener('click', () => {
        delete currentTemplate.customStampData;
        refreshLivePreview();
      });

      // Header, Notes, Logo Width
      if ($('inputHeaderTitle')) $('inputHeaderTitle').addEventListener('input', (e) => {
        currentTemplate.headerTitle = e.target.value;
        refreshLivePreview();
      });

      if ($('inputHeaderSubtitle')) $('inputHeaderSubtitle').addEventListener('input', (e) => {
        currentTemplate.headerSubtitle = e.target.value;
        refreshLivePreview();
      });

      if ($('chkShowLogo')) $('chkShowLogo').addEventListener('change', (e) => {
        currentTemplate.showLogo = e.target.checked;
        $('logoWidthGroup').style.display = e.target.checked ? 'flex' : 'none';
        refreshLivePreview();
      });

      if ($('rangeLogoWidth')) $('rangeLogoWidth').addEventListener('input', (e) => {
        const val = e.target.value + 'px';
        if ($('valLogoWidth')) $('valLogoWidth').textContent = val;
        currentTemplate.logoWidth = val;
        refreshLivePreview();
      });

      if ($('chkShowFooterNotes')) $('chkShowFooterNotes').addEventListener('change', (e) => {
        currentTemplate.showFooterNotes = e.target.checked;
        refreshLivePreview();
      });

      if ($('txtFooterNotes')) $('txtFooterNotes').addEventListener('input', (e) => {
        currentTemplate.footerNotes = e.target.value;
        refreshLivePreview();
      });

      if ($('chkShowSignatures')) $('chkShowSignatures').addEventListener('change', (e) => {
        currentTemplate.showSignatures = e.target.checked;
        refreshLivePreview();
      });

      // Watermark
      if ($('chkShowWatermark')) $('chkShowWatermark').addEventListener('change', (e) => {
        if (!currentTemplate.watermark) currentTemplate.watermark = {};
        currentTemplate.watermark.show = e.target.checked;
        refreshLivePreview();
      });

      if ($('inpWatermarkText')) $('inpWatermarkText').addEventListener('input', (e) => {
        if (!currentTemplate.watermark) currentTemplate.watermark = {};
        currentTemplate.watermark.text = e.target.value;
        refreshLivePreview();
      });

      if ($('inpWatermarkColor')) $('inpWatermarkColor').addEventListener('input', (e) => {
        if (!currentTemplate.watermark) currentTemplate.watermark = {};
        currentTemplate.watermark.color = e.target.value;
        refreshLivePreview();
      });

      if ($('inpWatermarkAngle')) $('inpWatermarkAngle').addEventListener('change', (e) => {
        if (!currentTemplate.watermark) currentTemplate.watermark = {};
        currentTemplate.watermark.angle = parseInt(e.target.value, 10) || -30;
        refreshLivePreview();
      });

      if ($('rangeWatermarkOpacity')) $('rangeWatermarkOpacity').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0.10;
        if ($('valWatermarkOpacity')) $('valWatermarkOpacity').textContent = Math.round(val * 100) + '%';
        if (!currentTemplate.watermark) currentTemplate.watermark = {};
        currentTemplate.watermark.opacity = val;
        refreshLivePreview();
      });

      // Scale & Auto-fit
      if ($('rangePrintScale')) $('rangePrintScale').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 1.0;
        if ($('valPrintScale')) $('valPrintScale').textContent = Math.round(val * 100) + '%';
        currentTemplate.printScale = val;
        refreshLivePreview();
      });

      if ($('btnAutoFitOnePage')) $('btnAutoFitOnePage').addEventListener('click', autoFitOnePage);

      // Browser Bleed & Header/Footer simulation
      if ($('chkSimulateBleed')) $('chkSimulateBleed').addEventListener('change', (e) => {
        showBrowserBleed = e.target.checked;
        const box = $('browserBleedBox');
        if (box) box.style.display = showBrowserBleed ? 'block' : 'none';
      });

      if ($('chkSimulateBrowserHeaderFooter')) $('chkSimulateBrowserHeaderFooter').addEventListener('change', (e) => {
        showBrowserHeaderFooter = e.target.checked;
        if ($('browserHeaderSim')) $('browserHeaderSim').style.display = showBrowserHeaderFooter ? 'flex' : 'none';
        if ($('browserFooterSim')) $('browserFooterSim').style.display = showBrowserHeaderFooter ? 'flex' : 'none';
      });

      // Zoom Controls
      function applyZoom(scale) {
        previewScale = Math.max(0.25, Math.min(1.50, scale));
        if ($('rangePreviewZoom')) $('rangePreviewZoom').value = previewScale;
        if ($('valPreviewZoom')) $('valPreviewZoom').textContent = Math.round(previewScale * 100) + '%';
        if ($('a4CanvasWrap')) $('a4CanvasWrap').style.transform = `scale(${previewScale})`;
      }

      if ($('rangePreviewZoom')) $('rangePreviewZoom').addEventListener('input', (e) => {
        applyZoom(parseFloat(e.target.value) || 0.75);
      });
      if ($('btnZoomFit')) $('btnZoomFit').addEventListener('click', () => applyZoom(0.55));
      if ($('btnZoom100')) $('btnZoom100').addEventListener('click', () => applyZoom(1.00));

      // Add Column Button
      if ($('tplBtnAddCol')) $('tplBtnAddCol').addEventListener('click', () => {
        const name = prompt('Enter new column header name (e.g. HSN Code / Remarks):');
        if (!name) return;
        const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        currentTemplate.columns.push({
          key: key,
          label: name,
          width: '12%',
          align: 'center',
          visible: true
        });
        renderColumnsList();
        refreshLivePreview();
      });

      // Document Type Filter & Selection
      if ($('tplDocTypeFilter')) $('tplDocTypeFilter').addEventListener('change', (e) => {
        currentDocType = e.target.value;
        loadTemplatesDropdown();
      });

      if ($('tplActiveSelect')) $('tplActiveSelect').addEventListener('change', (e) => {
        loadTemplateIntoEditor(e.target.value);
      });

      // Top Actions
      if ($('tplBtnSave')) $('tplBtnSave').addEventListener('click', () => {
        try {
          const saved = PTE.saveCustomTemplate(currentTemplate);
          if (window.showNotification) window.showNotification(`💾 Template "${saved.name}" saved successfully!`, 'success');
          loadTemplatesDropdown(saved.id);
        } catch (err) {
          if (window.showNotification) window.showNotification(err.message || 'Failed to save template.', 'error');
        }
      });

      if ($('tplBtnSetActive')) $('tplBtnSetActive').addEventListener('click', () => {
        if (!currentTemplate) return;
        PTE.setActiveTemplate(currentTemplate.docType || 'bom', currentTemplate.id);
        if (window.showNotification) window.showNotification(`🌟 "${currentTemplate.name}" is now the active default print layout!`, 'success');
        loadTemplatesDropdown(currentTemplate.id);
      });

      if ($('tplBtnClone')) $('tplBtnClone').addEventListener('click', () => {
        if (!currentTemplate) return;
        const cloned = JSON.parse(JSON.stringify(currentTemplate));
        cloned.id = 'tpl_' + (currentTemplate.docType || 'doc') + '_' + Date.now().toString(36);
        cloned.name = currentTemplate.name + ' (Custom Copy)';
        cloned.isPreset = false;
        currentTemplate = cloned;
        syncControlsFromTemplate();
        refreshLivePreview();
        if (window.showNotification) window.showNotification(`📋 Cloned template. Click "Save Layout" to store.`, 'info');
      });

      if ($('tplBtnNew')) $('tplBtnNew').addEventListener('click', () => {
        const name = prompt('Enter a name for the new print template:');
        if (!name) return;
        const newTpl = JSON.parse(JSON.stringify(PTE.getAllTemplates()[0]));
        newTpl.id = 'tpl_' + (newTpl.docType || 'bom') + '_' + Date.now().toString(36);
        newTpl.name = name.trim();
        newTpl.isPreset = false;
        currentTemplate = newTpl;
        syncControlsFromTemplate();
        refreshLivePreview();
        if (window.showNotification) window.showNotification(`Created "${newTpl.name}". Customize your canvas & settings.`, 'info');
      });

      if ($('tplBtnExport')) $('tplBtnExport').addEventListener('click', () => {
        if (!currentTemplate) return;
        const json = PTE.exportTemplateJson(currentTemplate.id);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${currentTemplate.name.replace(/\s+/g, '_')}_template.json`;
        a.click();
      });

      if ($('tplBtnImport')) $('tplBtnImport').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (re) => {
            try {
              const imported = PTE.importTemplateJson(re.target.result);
              if (window.showNotification) window.showNotification(`📥 Imported "${imported.name}" successfully!`, 'success');
              loadTemplatesDropdown(imported.id);
            } catch (err) {
              if (window.showNotification) window.showNotification('Invalid template JSON file.', 'error');
            }
          };
          reader.readAsText(file);
        };
        input.click();
      });

      if ($('tplBtnTestPrint')) $('tplBtnTestPrint').addEventListener('click', () => {
        if (!currentTemplate) return;
        const html = PTE.renderDocumentHtml(currentTemplate.docType || 'bom', {}, currentTemplate);
        let iframe = document.getElementById('bomTemplateTestPrintFrame');
        if (iframe) iframe.remove();
        iframe = document.createElement('iframe');
        iframe.id = 'bomTemplateTestPrintFrame';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        iframe.srcdoc = html;
        setTimeout(() => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (e) {
            console.warn('Print error:', e);
          }
        }, 300);
      });

      // Initial load
      loadTemplatesDropdown();
      applyZoom(0.75);
    }
  };

  window.TemplateDesignerPage = TemplateDesignerPage;
  if (window.PAGES) window.PAGES['template_designer'] = TemplateDesignerPage;

})(window);