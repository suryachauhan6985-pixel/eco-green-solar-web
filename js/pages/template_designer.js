/**
 * Eco Green Solar ERP - Visual Print Template Designer & Publishing Studio v2.0
 * Features:
 * - Photoshop-Style Multi-Format Canvas (A4, A5, Letter, Legal, 80mm POS Thermal, Custom mm/in)
 * - Pre-loaded Existing ERP BOM & Dual-Copy Challan Presets
 * - New Official Modern Solar BOQ, Detailed Portrait Challan & GST Invoice
 * - Media & Asset Insertion (Logo, Signatures, Seal/Stamp, QR Code)
 * - Text Watermark Engine (Rotated & Opacity Controls)
 * - Browser Print Margin & Bleed Safety Zone Inspector
 * - 1-Click Excel-Style Fit-To-Page Scaling
 */

(function(window) {
  'use strict';

  let currentTemplate = null;
  let currentDocType = 'all';
  let previewScale = 0.82;
  let showBrowserBleed = false;
  let showBrowserHeaderFooter = false;

  const TemplateDesignerPage = {
    render(opts = {}) {
      return `
        <div class="tpl-designer-wrap">
          <!-- Top Studio Header -->
          <div class="tpl-designer-topbar">
            <div class="tpl-topbar-left">
              <div style="display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-compass-drafting" style="color:var(--blue, #3b8ed0); font-size:18px;"></i>
                <strong style="font-size:14px; color:var(--txt);">Template Studio</strong>
                <span class="pill pill-gold" style="font-size:10px; padding:1px 6px;">v2.0</span>
              </div>
              <select id="tplDocTypeFilter" class="input" style="padding:4px 8px; font-size:12px; font-weight:700; border-radius:6px; background:var(--bg2);">
                <option value="all">All Document Types</option>
                <option value="bom">BOM / BOQ Kits</option>
                <option value="challan">Delivery Challans</option>
                <option value="invoice">GST Invoices</option>
              </select>
              <select id="tplActiveSelect" class="input" style="padding:4px 8px; font-size:12px; border-radius:6px; background:var(--bg2); min-width:220px;">
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
                <button type="button" class="tpl-tab-btn" data-tab="tab-media"><i class="fa-solid fa-image"></i> Media</button>
                <button type="button" class="tpl-tab-btn" data-tab="tab-watermark"><i class="fa-solid fa-stamp"></i> Watermark</button>
                <button type="button" class="tpl-tab-btn" data-tab="tab-pagefit" style="color:var(--gold);"><i class="fa-solid fa-compress"></i> Page-Fit</button>
              </div>

              <!-- Tab 1: 📐 Photoshop-Style Canvas & Page Setup -->
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
                  <div class="tpl-card-title">Page Margins (mm)</div>
                  <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:8px;">
                    <div class="field"><label style="font-size:10.5px;">Top (mm)</label><input type="number" id="marginItemTop" min="0" max="30" value="8" style="padding:4px 6px; font-size:12px;"></div>
                    <div class="field"><label style="font-size:10.5px;">Bottom (mm)</label><input type="number" id="marginItemBottom" min="0" max="30" value="8" style="padding:4px 6px; font-size:12px;"></div>
                    <div class="field"><label style="font-size:10.5px;">Left (mm)</label><input type="number" id="marginItemLeft" min="0" max="30" value="6" style="padding:4px 6px; font-size:12px;"></div>
                    <div class="field"><label style="font-size:10.5px;">Right (mm)</label><input type="number" id="marginItemRight" min="0" max="30" value="6" style="padding:4px 6px; font-size:12px;"></div>
                  </div>
                </div>
              </div>

              <!-- Tab 2: 📊 Columns & Grid Manager -->
              <div class="tpl-tab-pane" id="tab-cols">
                <div class="tpl-card">
                  <div class="tpl-card-title">
                    <span>Table Columns &amp; Widths</span>
                    <button type="button" class="btn btn-ghost" id="tplBtnAddCol" style="font-size:10.5px; padding:2px 6px;"><i class="fa-solid fa-plus"></i> Add Column</button>
                  </div>
                  <div id="tplColumnsList">
                    <!-- Column cards injected dynamically -->
                  </div>
                </div>
              </div>

              <!-- Tab 3: 🎛️ Typography & Cell Spacing -->
              <div class="tpl-tab-pane" id="tab-spacing">
                <div class="tpl-card">
                  <div class="tpl-card-title">Typography &amp; Cell Spacing</div>
                  
                  <div class="tpl-slider-group">
                    <div class="tpl-slider-label">
                      <span>Base Font Size</span>
                      <span class="tpl-slider-val" id="valBaseFont">9.0pt</span>
                    </div>
                    <input type="range" class="tpl-range-input" id="rangeBaseFont" min="7.0" max="13.0" step="0.2" value="9.0">
                  </div>

                  <div class="tpl-slider-group">
                    <div class="tpl-slider-label">
                      <span>Row Height / Cell Padding</span>
                      <span class="tpl-slider-val" id="valRowPadding">1.2px</span>
                    </div>
                    <input type="range" class="tpl-range-input" id="rangeRowPadding" min="0.5" max="8.0" step="0.2" value="1.2">
                  </div>

                  <div class="tpl-slider-group">
                    <div class="tpl-slider-label">
                      <span>Section Header Font Size</span>
                      <span class="tpl-slider-val" id="valSecFont">9.6pt</span>
                    </div>
                    <input type="range" class="tpl-range-input" id="rangeSecFont" min="8.0" max="14.0" step="0.2" value="9.6">
                  </div>

                  <div class="tpl-slider-group">
                    <div class="tpl-slider-label">
                      <span>Section Header Padding</span>
                      <span class="tpl-slider-val" id="valSecPadding">2.0px</span>
                    </div>
                    <input type="range" class="tpl-range-input" id="rangeSecPadding" min="1.0" max="8.0" step="0.5" value="2.0">
                  </div>
                </div>

                <div class="tpl-card">
                  <div class="tpl-card-title">Table Headers &amp; Borders</div>
                  <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:8px;">
                    <div class="field">
                      <label style="font-size:11px;">Table Head Color</label>
                      <input type="color" id="inputTableHeadBg" value="#666699" style="height:32px; padding:2px; cursor:pointer;">
                    </div>
                    <div class="field">
                      <label style="font-size:11px;">Section Header Bg</label>
                      <input type="color" id="inputSecBg" value="#f2f2f2" style="height:32px; padding:2px; cursor:pointer;">
                    </div>
                  </div>
                  <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:10px;">
                    <div class="field">
                      <label style="font-size:11px;">Border Color</label>
                      <input type="color" id="inputBorderColor" value="#000000" style="height:32px; padding:2px; cursor:pointer;">
                    </div>
                    <div class="field">
                      <label style="font-size:11px;">Border Width</label>
                      <select id="selBorderWidth" class="input" style="font-size:12px; padding:4px 6px;">
                        <option value="1px">1px (Standard)</option>
                        <option value="1.5px">1.5px (Medium)</option>
                        <option value="2px">2px (Thick Bold)</option>
                        <option value="0.5px">0.5px (Hairline)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tab 4: 🖼️ Media, Logo & Signatures -->
              <div class="tpl-tab-pane" id="tab-media">
                <div class="tpl-card">
                  <div class="tpl-card-title">Logo &amp; Header Branding</div>
                  <div class="field" style="margin-bottom:8px;">
                    <label style="font-size:11px;">Document Title</label>
                    <input type="text" id="inputHeaderTitle" placeholder="e.g. BILL OF MATERIAL (BOM)" style="padding:5px 8px; font-size:12px;">
                  </div>
                  <div class="field" style="margin-bottom:10px;">
                    <label style="font-size:11px;">Subtitle / Tagline</label>
                    <input type="text" id="inputHeaderSubtitle" placeholder="e.g. Solar System Components Specification Sheet" style="padding:5px 8px; font-size:12px;">
                  </div>

                  <label class="checkbox" style="font-size:11.5px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" id="chkShowLogo" checked>
                    <span>Show Organization Logo</span>
                  </label>

                  <div class="tpl-slider-group" id="logoWidthGroup">
                    <div class="tpl-slider-label">
                      <span>Logo Width</span>
                      <span class="tpl-slider-val" id="valLogoWidth">140px</span>
                    </div>
                    <input type="range" class="tpl-range-input" id="rangeLogoWidth" min="60" max="240" step="5" value="140">
                  </div>
                </div>

                <div class="tpl-card">
                  <div class="tpl-card-title">Footer Notes &amp; Signatures</div>
                  <label class="checkbox" style="font-size:11.5px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" id="chkShowFooterNotes" checked>
                    <span>Show Footer Notes</span>
                  </label>
                  <textarea id="txtFooterNotes" rows="2" style="width:100%; font-size:11px; padding:6px; border-radius:6px; background:var(--bg2); border:1px solid var(--border-light); margin-bottom:10px;" placeholder="Footer notes or terms..."></textarea>

                  <label class="checkbox" style="font-size:11.5px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                    <input type="checkbox" id="chkShowSignatures" checked>
                    <span>Show Signature Blocks</span>
                  </label>
                </div>
              </div>

              <!-- Tab 5: 🌊 Watermark & Dynamic Variables -->
              <div class="tpl-tab-pane" id="tab-watermark">
                <div class="tpl-card">
                  <div class="tpl-card-title">Document Watermark</div>
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
                  <div class="tpl-card-title" style="color:var(--gold);">
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
              <!-- Floating Live Gauge & Zoom -->
              <div class="tpl-viewport-toolbar">
                <div class="tpl-gauge-badge tpl-gauge-safe" id="tplLiveGauge">
                  <i class="fa-solid fa-circle-check"></i>
                  <span id="tplGaugeText">94% of Page 1 (Fits on 1 Page)</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--txt-muted);">
                  <span>Zoom:</span>
                  <input type="range" id="rangePreviewZoom" min="0.4" max="1.2" step="0.05" value="0.82" style="width:85px; accent-color:var(--blue);">
                  <span id="valPreviewZoom" style="font-family:monospace; font-weight:700; color:var(--txt);">82%</span>
                </div>
              </div>

              <!-- Browser Header Simulation Bar -->
              <div class="browser-header-sim" id="browserHeaderSim" style="display:none; width:794px;">
                <span id="simBrowserDate">25/08/2026, 11:30 AM</span>
                <span id="simBrowserTitle">BOM Kit - EGS/2026/0842</span>
              </div>

              <!-- Canvas Container -->
              <div class="a4-sheet-preview-wrap A4_portrait" id="a4CanvasWrap">
                <iframe id="a4PreviewIframe" class="a4-sheet-inner-frame" src="about:blank"></iframe>
                <!-- Red page break boundary line -->
                <div class="a4-page-break-line" id="a4PageBreakLine" style="top: 1123px;">
                  <span class="a4-page-break-label">1-PAGE CUTOFF BOUNDARY</span>
                </div>
                <!-- Browser Bleed Safety Overlay -->
                <div class="browser-bleed-box" id="browserBleedBox" style="display:none;">
                  <span class="browser-bleed-label">PRINTABLE HARDWARE SAFETY BOUNDARY</span>
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

      function loadTemplatesDropdown() {
        const templates = PTE.getTemplatesByDocType(currentDocType);
        const activeTpl = PTE.getActiveTemplate(currentDocType === 'all' ? 'bom' : currentDocType);
        const sel = $('tplActiveSelect');
        if (sel) {
          const presets = templates.filter((t) => t.isPreset);
          const custom = templates.filter((t) => !t.isPreset);

          let html = '';
          if (presets.length) {
            html += '<optgroup label="⭐ Pre-loaded Official Templates">';
            presets.forEach((t) => {
              html += `<option value="${t.id}" ${t.id === activeTpl.id ? 'selected' : ''}>${t.name} ${t.id === activeTpl.id ? '★ (Active)' : ''}</option>`;
            });
            html += '</optgroup>';
          }
          if (custom.length) {
            html += '<optgroup label="🎨 My Custom Templates">';
            custom.forEach((t) => {
              html += `<option value="${t.id}" ${t.id === activeTpl.id ? 'selected' : ''}>${t.name} ${t.id === activeTpl.id ? '★ (Active)' : ''}</option>`;
            });
            html += '</optgroup>';
          }
          sel.innerHTML = html;
        }

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

        // Sliders & Values
        const baseFontNum = parseFloat(t.baseFontSize) || 9.0;
        if ($('rangeBaseFont')) $('rangeBaseFont').value = baseFontNum;
        if ($('valBaseFont')) $('valBaseFont').textContent = baseFontNum + 'pt';

        const rowPadNum = parseFloat(t.rowPadding) || 1.2;
        if ($('rangeRowPadding')) $('rangeRowPadding').value = rowPadNum;
        if ($('valRowPadding')) $('valRowPadding').textContent = rowPadNum + 'px';

        const secFontNum = parseFloat(t.sectionHeaderFontSize) || 9.6;
        if ($('rangeSecFont')) $('rangeSecFont').value = secFontNum;
        if ($('valSecFont')) $('valSecFont').textContent = secFontNum + 'pt';

        const secPadNum = parseFloat(t.sectionHeaderPadding) || 2.0;
        if ($('rangeSecPadding')) $('rangeSecPadding').value = secPadNum;
        if ($('valSecPadding')) $('valSecPadding').textContent = secPadNum + 'px';

        if ($('inputTableHeadBg')) $('inputTableHeadBg').value = t.tableHeadBg || '#666699';
        if ($('inputSecBg')) $('inputSecBg').value = t.sectionHeaderBg || '#f2f2f2';
        if ($('inputBorderColor')) $('inputBorderColor').value = t.borderColor || '#000000';
        if ($('selBorderWidth')) $('selBorderWidth').value = t.borderWidth || '1px';

        const m = t.margins || { top: 8, bottom: 8, left: 6, right: 6 };
        if ($('marginItemTop')) $('marginItemTop').value = m.top || 8;
        if ($('marginItemBottom')) $('marginItemBottom').value = m.bottom || 8;
        if ($('marginItemLeft')) $('marginItemLeft').value = m.left || 6;
        if ($('marginItemRight')) $('marginItemRight').value = m.right || 6;

        if ($('inputHeaderTitle')) $('inputHeaderTitle').value = t.headerTitle || '';
        if ($('inputHeaderSubtitle')) $('inputHeaderSubtitle').value = t.headerSubtitle || '';
        if ($('chkShowLogo')) $('chkShowLogo').checked = t.showLogo !== false;
        const logoWidthNum = parseInt(t.logoWidth, 10) || 140;
        if ($('rangeLogoWidth')) $('rangeLogoWidth').value = logoWidthNum;
        if ($('valLogoWidth')) $('valLogoWidth').textContent = logoWidthNum + 'px';

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

        const scaleNum = Number(t.printScale) || 1.0;
        if ($('rangePrintScale')) $('rangePrintScale').value = scaleNum;
        if ($('valPrintScale')) $('valPrintScale').textContent = Math.round(scaleNum * 100) + '%';

        updateCanvasGeometry();
        renderColumnsList();
      }

      function updateCanvasGeometry() {
        if (!currentTemplate) return;
        const isLandscape = currentTemplate.orientation === 'landscape';
        if ($('btnOrientPortrait')) $('btnOrientPortrait').className = isLandscape ? 'btn btn-ghost' : 'btn btn-blue';
        if ($('btnOrientLandscape')) $('btnOrientLandscape').className = isLandscape ? 'btn btn-blue' : 'btn btn-ghost';

        const wrap = $('a4CanvasWrap');
        const canvasPreset = currentTemplate.canvasPreset || (isLandscape ? 'A4_landscape' : 'A4_portrait');
        if (wrap) {
          wrap.className = `a4-sheet-preview-wrap ${canvasPreset}`;
          const breakLine = $('a4PageBreakLine');
          if (breakLine) {
            if (canvasPreset === 'A4_landscape' || canvasPreset === 'A5_landscape') breakLine.style.top = '794px';
            else if (canvasPreset === 'POS80') breakLine.style.top = '600px';
            else breakLine.style.top = '1123px';
          }
        }
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
              </div>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <input type="text" class="input input-col-label" data-index="${idx}" value="${col.label}" placeholder="Header label..." style="flex:1; font-size:11px; padding:3px 6px;">
              <input type="text" class="input input-col-width" data-index="${idx}" value="${col.width}" placeholder="e.g. 15%" style="width:65px; font-size:11px; padding:3px 4px; text-align:center;">
            </div>
          </div>
        `).join('');

        // Attach listeners
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
          inp.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            currentTemplate.columns[idx].width = e.target.value;
            refreshLivePreview();
          });
        });

        listEl.querySelectorAll('.tpl-align-btn').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const target = e.currentTarget;
            const idx = parseInt(target.dataset.index, 10);
            currentTemplate.columns[idx].align = target.dataset.align;
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

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();

        setTimeout(measurePageUtilization, 150);
      }

      function measurePageUtilization() {
        const iframe = $('a4PreviewIframe');
        if (!iframe || !currentTemplate) return;
        try {
          const doc = iframe.contentWindow.document;
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
          const doc = iframe.contentWindow.document;
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
          console.warn('Auto-fit calculation error:', e);
        }
      }

      // Tab switching
      document.querySelectorAll('.tpl-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.tpl-tab-btn').forEach((b) => b.classList.remove('active'));
          document.querySelectorAll('.tpl-tab-pane').forEach((p) => p.classList.remove('active'));
          btn.classList.add('active');
          const targetPane = $(btn.dataset.tab);
          if (targetPane) targetPane.classList.add('active');
        });
      });

      // Canvas preset change
      if ($('selCanvasPreset')) $('selCanvasPreset').addEventListener('change', (e) => {
        const val = e.target.value;
        currentTemplate.canvasPreset = val;
        if (val.includes('landscape')) currentTemplate.orientation = 'landscape';
        else if (val.includes('portrait') || val === 'POS80') currentTemplate.orientation = 'portrait';
        if ($('customCanvasRow')) $('customCanvasRow').style.display = (val === 'custom') ? 'grid' : 'none';
        updateCanvasGeometry();
        refreshLivePreview();
      });

      // Sliders & inputs bindings
      if ($('rangeBaseFont')) $('rangeBaseFont').addEventListener('input', (e) => {
        const val = e.target.value + 'pt';
        if ($('valBaseFont')) $('valBaseFont').textContent = val;
        currentTemplate.baseFontSize = val;
        refreshLivePreview();
      });

      if ($('rangeRowPadding')) $('rangeRowPadding').addEventListener('input', (e) => {
        const val = e.target.value + 'px';
        if ($('valRowPadding')) $('valRowPadding').textContent = val;
        currentTemplate.rowPadding = val + ' 3.5px';
        refreshLivePreview();
      });

      if ($('rangeSecFont')) $('rangeSecFont').addEventListener('input', (e) => {
        const val = e.target.value + 'pt';
        if ($('valSecFont')) $('valSecFont').textContent = val;
        currentTemplate.sectionHeaderFontSize = val;
        refreshLivePreview();
      });

      if ($('rangeSecPadding')) $('rangeSecPadding').addEventListener('input', (e) => {
        const val = e.target.value + 'px';
        if ($('valSecPadding')) $('valSecPadding').textContent = val;
        currentTemplate.sectionHeaderPadding = val + ' 4px';
        refreshLivePreview();
      });

      if ($('inputTableHeadBg')) $('inputTableHeadBg').addEventListener('input', (e) => {
        currentTemplate.tableHeadBg = e.target.value;
        refreshLivePreview();
      });

      if ($('inputSecBg')) $('inputSecBg').addEventListener('input', (e) => {
        currentTemplate.sectionHeaderBg = e.target.value;
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

      ['marginItemTop', 'marginItemBottom', 'marginItemLeft', 'marginItemRight'].forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener('change', () => {
          currentTemplate.margins = {
            top: parseInt($('marginItemTop').value, 10) || 8,
            bottom: parseInt($('marginItemBottom').value, 10) || 8,
            left: parseInt($('marginItemLeft').value, 10) || 6,
            right: parseInt($('marginItemRight').value, 10) || 6
          };
          refreshLivePreview();
        });
      });

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
        if ($('logoWidthGroup')) $('logoWidthGroup').style.display = e.target.checked ? 'flex' : 'none';
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

      // Watermark bindings
      if (!currentTemplate.watermark) currentTemplate.watermark = { show: false, text: 'ORIGINAL', opacity: 0.1, angle: -30, color: '#3b8ed0' };
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

      if ($('rangePrintScale')) $('rangePrintScale').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 1.0;
        if ($('valPrintScale')) $('valPrintScale').textContent = Math.round(val * 100) + '%';
        currentTemplate.printScale = val;
        refreshLivePreview();
      });

      if ($('btnOrientPortrait')) $('btnOrientPortrait').addEventListener('click', () => {
        currentTemplate.orientation = 'portrait';
        updateCanvasGeometry();
        refreshLivePreview();
      });

      if ($('btnOrientLandscape')) $('btnOrientLandscape').addEventListener('click', () => {
        currentTemplate.orientation = 'landscape';
        updateCanvasGeometry();
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

      if ($('rangePreviewZoom')) $('rangePreviewZoom').addEventListener('input', (e) => {
        previewScale = parseFloat(e.target.value) || 0.82;
        if ($('valPreviewZoom')) $('valPreviewZoom').textContent = Math.round(previewScale * 100) + '%';
        if ($('a4CanvasWrap')) $('a4CanvasWrap').style.transform = `scale(${previewScale})`;
      });
      if ($('a4CanvasWrap')) $('a4CanvasWrap').style.transform = `scale(${previewScale})`;

      // Dropdown & Action Buttons
      if ($('tplDocTypeFilter')) $('tplDocTypeFilter').addEventListener('change', (e) => {
        currentDocType = e.target.value;
        loadTemplatesDropdown();
      });

      if ($('tplActiveSelect')) $('tplActiveSelect').addEventListener('change', (e) => {
        loadTemplateIntoEditor(e.target.value);
      });

      if ($('tplBtnSave')) $('tplBtnSave').addEventListener('click', () => {
        try {
          const saved = PTE.saveCustomTemplate(currentTemplate);
          if (window.showNotification) window.showNotification(`💾 Template "${saved.name}" saved successfully!`, 'success');
          loadTemplatesDropdown();
          if ($('tplActiveSelect')) $('tplActiveSelect').value = saved.id;
        } catch (err) {
          if (window.showNotification) window.showNotification(err.message || 'Failed to save template.', 'error');
        }
      });

      if ($('tplBtnSetActive')) $('tplBtnSetActive').addEventListener('click', () => {
        if (!currentTemplate) return;
        PTE.setActiveTemplate(currentTemplate.docType || 'bom', currentTemplate.id);
        if (window.showNotification) window.showNotification(`🌟 "${currentTemplate.name}" is now the active default print layout!`, 'success');
        loadTemplatesDropdown();
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
              loadTemplatesDropdown();
              if ($('tplActiveSelect')) $('tplActiveSelect').value = imported.id;
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

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }, 250);
      });

      // Initial load
      loadTemplatesDropdown();
    }
  };

  window.TemplateDesignerPage = TemplateDesignerPage;
  if (window.PAGES) window.PAGES['template_designer'] = TemplateDesignerPage;

})(window);