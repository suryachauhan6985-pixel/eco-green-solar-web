/**
 * Eco Green Solar ERP - Universal Print Template Engine v2.0
 * Comprehensive Document & Report Publishing Engine with Factory Presets,
 * Photoshop-Style Multi-Format Canvases, Media Insertion, Watermarks & 1-Page Scaling.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY_TEMPLATES = 'egs_print_templates';
  const STORAGE_KEY_ACTIVE = 'egs_active_print_templates';

  // ---------------------------------------------------------------------------
  // 1. PAPER & CANVAS DEFINITIONS
  // ---------------------------------------------------------------------------
  const CANVAS_PRESETS = {
    'A4_portrait': { name: 'A4 Portrait (210 × 297 mm)', width: 210, height: 297, unit: 'mm', orientation: 'portrait' },
    'A4_landscape': { name: 'A4 Landscape (297 × 210 mm)', width: 297, height: 210, unit: 'mm', orientation: 'landscape' },
    'A5_portrait': { name: 'A5 Portrait (148 × 210 mm)', width: 148, height: 210, unit: 'mm', orientation: 'portrait' },
    'A5_landscape': { name: 'A5 Landscape (210 × 148 mm)', width: 210, height: 148, unit: 'mm', orientation: 'landscape' },
    'Letter_portrait': { name: 'Letter Portrait (8.5 × 11 in)', width: 215.9, height: 279.4, unit: 'mm', orientation: 'portrait' },
    'Legal_portrait': { name: 'Legal Portrait (8.5 × 14 in)', width: 215.9, height: 355.6, unit: 'mm', orientation: 'portrait' },
    'POS80': { name: '80mm POS Thermal Roll (80 × 220 mm)', width: 80, height: 220, unit: 'mm', orientation: 'portrait' },
    'custom': { name: 'Custom Canvas Size', width: 210, height: 297, unit: 'mm', orientation: 'portrait' }
  };

  // ---------------------------------------------------------------------------
  // 2. BUILT-IN FACTORY PRESETS
  // ---------------------------------------------------------------------------
  const FACTORY_PRESETS = [
    // 1. Existing Official ERP BOM Kit Layout
    {
      id: 'bom_existing_original',
      name: 'Existing Official ERP BOM Kit (Original Classic)',
      docType: 'bom',
      isPreset: true,
      canvasPreset: 'A4_portrait',
      paperSize: 'A4',
      orientation: 'portrait',
      margins: { top: 7, bottom: 7, left: 8, right: 8 },
      fontFamily: "'Calibri Light', Calibri, 'Segoe UI', Arial, sans-serif",
      baseFontSize: '9.0pt',
      rowPadding: '1.2px 3.5px',
      sectionHeaderBg: '#f2f2f2',
      sectionHeaderColor: '#000000',
      sectionHeaderFontSize: '9.6pt',
      sectionHeaderPadding: '1.8px 3.5px',
      tableHeadBg: '#666699',
      tableHeadColor: '#ffffff',
      borderWidth: '1px',
      borderColor: '#000000',
      printScale: 1.0,
      autoFitOnePage: true,
      showLogo: true,
      logoWidth: '140px',
      logoAlign: 'left',
      headerTitle: 'BILL OF MATERIAL (BOM)',
      headerSubtitle: 'Solar System Components & Kit Specification Sheet',
      showKwBox: true,
      watermark: { show: false, text: 'ORIGINAL', opacity: 0.12, angle: -30, color: '#3b8ed0', fontSize: '42pt' },
      showSignatures: true,
      signatures: [
        { title: 'Store Incharge Sign' },
        { title: 'Verified / Dispatched By' },
        { title: 'Authorized Signatory' }
      ],
      showFooterNotes: true,
      footerNotes: 'Eco Green Solar Enterprise ERP • Page 1 of 1 • System Generated Official Document',
      columns: [
        { key: 'sr_no', label: 'Sr.', width: '6.5%', align: 'center', visible: true },
        { key: 'item_desc', label: 'Item Name & Specification', width: '31.5%', align: 'left', visible: true },
        { key: 'brand', label: 'Model / Brand', width: '17%', align: 'center', visible: true },
        { key: 'qty', label: 'Quantity', width: '11%', align: 'center', visible: true },
        { key: 'checked', label: 'Check', width: '8%', align: 'center', visible: true },
        { key: 'remarks', label: 'Remarks / Serial Numbers', width: '26%', align: 'center', visible: true }
      ]
    },

    // 2. Existing Official Dual-Copy Landscape Delivery Challan
    {
      id: 'challan_existing_dual',
      name: 'Existing Official Landscape Dual Copy Challan',
      docType: 'challan',
      isPreset: true,
      canvasPreset: 'A4_landscape',
      paperSize: 'A4',
      orientation: 'landscape',
      isDualCopy: true,
      margins: { top: 12, bottom: 5, left: 5, right: 5 },
      fontFamily: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif",
      baseFontSize: '9.2pt',
      rowPadding: '1.5px 3px',
      sectionHeaderBg: '#f2f4f7',
      sectionHeaderColor: '#000000',
      sectionHeaderFontSize: '9.4pt',
      sectionHeaderPadding: '2.5px 4px',
      borderWidth: '1px',
      borderColor: '#000000',
      printScale: 1.0,
      autoFitOnePage: true,
      showLogo: true,
      logoWidth: '110px',
      logoAlign: 'center',
      headerTitle: 'DELIVERY CHALLAN',
      headerSubtitle: '',
      watermark: { show: false, text: 'DUPLICATE', opacity: 0.1, angle: -25, color: '#e67e22', fontSize: '36pt' },
      showSignatures: true,
      signatures: [
        { title: 'Issued By (Store Incharge)' },
        { title: 'Received By (Transporter/Driver)' }
      ],
      showFooterNotes: true,
      footerNotes: 'Goods once dispatched/delivered in sound condition will not be returned.',
      columns: [
        { key: 'sr_no', label: 'S.N.', width: '8.5%', align: 'center', visible: true },
        { key: 'item_desc', label: 'Item Name & Description', width: '32%', align: 'left', visible: true },
        { key: 'brand', label: 'Model/Size', width: '13.5%', align: 'center', visible: true },
        { key: 'qty', label: 'Qty', width: '13%', align: 'center', visible: true },
        { key: 'remarks', label: 'Description & Serial', width: '33%', align: 'left', visible: true }
      ]
    },

    // 3. New Official Modern Executive Solar BOQ
    {
      id: 'bom_modern_corporate',
      name: 'Modern Executive Solar BOQ (Navy & Cyan)',
      docType: 'bom',
      isPreset: true,
      canvasPreset: 'A4_portrait',
      paperSize: 'A4',
      orientation: 'portrait',
      margins: { top: 8, bottom: 8, left: 6, right: 6 },
      fontFamily: "'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif",
      baseFontSize: '9.5pt',
      rowPadding: '2.8px 5px',
      sectionHeaderBg: '#0f172a',
      sectionHeaderColor: '#38bdf8',
      sectionHeaderFontSize: '9.8pt',
      sectionHeaderPadding: '4px 8px',
      tableHeadBg: '#1e293b',
      tableHeadColor: '#ffffff',
      borderWidth: '1px',
      borderColor: '#334155',
      printScale: 0.98,
      autoFitOnePage: true,
      showLogo: true,
      logoWidth: '155px',
      logoAlign: 'left',
      headerTitle: 'SOLAR SYSTEM BILL OF QUANTITIES (BOQ)',
      headerSubtitle: 'High-Efficiency Solar Power System Engineering Specification',
      watermark: { show: false, text: 'APPROVED', opacity: 0.08, angle: -35, color: '#2ecc71', fontSize: '48pt' },
      showSignatures: true,
      signatures: [
        { title: 'Design Engineer' },
        { title: 'Project Manager' },
        { title: 'Authorized Signatory' }
      ],
      showFooterNotes: true,
      footerNotes: 'Manufactured and assembled to ISO 9001:2015 and MNRE solar standard benchmarks.',
      columns: [
        { key: 'sr_no', label: '#', width: '5%', align: 'center', visible: true },
        { key: 'item_desc', label: 'Equipment & Component Specification', width: '50%', align: 'left', visible: true },
        { key: 'brand', label: 'OEM Brand', width: '16%', align: 'left', visible: true },
        { key: 'wattage', label: 'Rating / Spec', width: '13%', align: 'center', visible: true },
        { key: 'qty', label: 'Qty', width: '8%', align: 'right', visible: true },
        { key: 'uom', label: 'UOM', width: '8%', align: 'center', visible: true }
      ]
    },

    // 4. New Official Single-Page Detailed Delivery Challan (Portrait)
    {
      id: 'challan_single_portrait',
      name: 'Detailed Single Copy Delivery Challan (Portrait)',
      docType: 'challan',
      isPreset: true,
      canvasPreset: 'A4_portrait',
      paperSize: 'A4',
      orientation: 'portrait',
      margins: { top: 10, bottom: 10, left: 8, right: 8 },
      fontFamily: "'Segoe UI', Roboto, Arial, sans-serif",
      baseFontSize: '9.6pt',
      rowPadding: '3px 5px',
      sectionHeaderBg: '#f0fdf4',
      sectionHeaderColor: '#166534',
      sectionHeaderFontSize: '10pt',
      sectionHeaderPadding: '4px 6px',
      tableHeadBg: '#15803d',
      tableHeadColor: '#ffffff',
      borderWidth: '1px',
      borderColor: '#000000',
      printScale: 1.0,
      autoFitOnePage: true,
      showLogo: true,
      logoWidth: '150px',
      logoAlign: 'left',
      headerTitle: 'DELIVERY CHALLAN & DISPATCH VOUCHER',
      headerSubtitle: 'Issued under Rule 55 of GST (Transportation of Goods without Invoice)',
      watermark: { show: false, text: 'DISPATCHED', opacity: 0.1, angle: -30, color: '#16a34a', fontSize: '40pt' },
      showSignatures: true,
      signatures: [
        { title: 'Store Dispatcher' },
        { title: 'Driver / Transporter Signature' },
        { title: 'Receiver Signature & Stamp' }
      ],
      showFooterNotes: true,
      footerNotes: 'Declaration: The goods supplied are for solar power plant execution and not for resale.',
      columns: [
        { key: 'sr_no', label: 'Sr.', width: '6%', align: 'center', visible: true },
        { key: 'item_desc', label: 'Description of Solar Goods', width: '52%', align: 'left', visible: true },
        { key: 'brand', label: 'Make / Model', width: '18%', align: 'left', visible: true },
        { key: 'qty', label: 'Qty', width: '12%', align: 'right', visible: true },
        { key: 'uom', label: 'Unit', width: '12%', align: 'center', visible: true }
      ]
    },

    // 5. Official Standard GST Tax Invoice
    {
      id: 'invoice_gst_standard',
      name: 'Standard GST Tax Invoice (B2B / B2C)',
      docType: 'invoice',
      isPreset: true,
      canvasPreset: 'A4_portrait',
      paperSize: 'A4',
      orientation: 'portrait',
      margins: { top: 8, bottom: 8, left: 6, right: 6 },
      fontFamily: "'Segoe UI', Calibri, Arial, sans-serif",
      baseFontSize: '9.2pt',
      rowPadding: '2.5px 4px',
      sectionHeaderBg: '#f8fafc',
      sectionHeaderColor: '#0f172a',
      sectionHeaderFontSize: '9.5pt',
      sectionHeaderPadding: '3px 6px',
      tableHeadBg: '#1e293b',
      tableHeadColor: '#ffffff',
      borderWidth: '1px',
      borderColor: '#000000',
      printScale: 0.98,
      autoFitOnePage: true,
      showLogo: true,
      logoWidth: '140px',
      logoAlign: 'left',
      headerTitle: 'TAX INVOICE',
      headerSubtitle: 'Original for Recipient',
      watermark: { show: false, text: 'TAX INVOICE', opacity: 0.08, angle: -30, color: '#000000', fontSize: '42pt' },
      showSignatures: true,
      signatures: [
        { title: 'Customer Acceptance Sign' },
        { title: 'For Eco Green Solar (Auth Signatory)' }
      ],
      showFooterNotes: true,
      footerNotes: 'Terms: 100% payment against delivery. Disputes subject to local jurisdiction.',
      columns: [
        { key: 'sr_no', label: '#', width: '5%', align: 'center', visible: true },
        { key: 'item_desc', label: 'Item Name & HSN/SAC Code', width: '45%', align: 'left', visible: true },
        { key: 'qty', label: 'Qty', width: '8%', align: 'right', visible: true },
        { key: 'uom', label: 'UOM', width: '8%', align: 'center', visible: true },
        { key: 'rate', label: 'Unit Rate', width: '14%', align: 'right', visible: true },
        { key: 'amount', label: 'Taxable Value', width: '20%', align: 'right', visible: true }
      ]
    },

    // 6. 80mm Roll Thermal POS Mini Receipt / Gate Pass
    {
      id: 'thermal_pos_80mm',
      name: '80mm POS Thermal Slip / Security Gate Pass',
      docType: 'challan',
      isPreset: true,
      canvasPreset: 'POS80',
      paperSize: 'POS80',
      orientation: 'portrait',
      margins: { top: 4, bottom: 4, left: 3, right: 3 },
      fontFamily: "'Courier New', Courier, monospace",
      baseFontSize: '8.5pt',
      rowPadding: '1.5px 2px',
      sectionHeaderBg: '#e2e8f0',
      sectionHeaderColor: '#000000',
      sectionHeaderFontSize: '8.8pt',
      sectionHeaderPadding: '2px 3px',
      tableHeadBg: '#f1f5f9',
      tableHeadColor: '#000000',
      borderWidth: '1px',
      borderColor: '#000000',
      printScale: 1.0,
      autoFitOnePage: true,
      showLogo: true,
      logoWidth: '90px',
      logoAlign: 'center',
      headerTitle: 'DISPATCH GATE PASS',
      headerSubtitle: 'Store Outward Verification Slip',
      watermark: { show: false, text: '', opacity: 0, angle: 0, color: '#000', fontSize: '20pt' },
      showSignatures: true,
      signatures: [
        { title: 'Security Outward Sign' },
        { title: 'Driver Sign' }
      ],
      showFooterNotes: true,
      footerNotes: 'Vehicle cleared through Security Gate #1.',
      columns: [
        { key: 'sr_no', label: '#', width: '8%', align: 'center', visible: true },
        { key: 'item_desc', label: 'Item Description', width: '64%', align: 'left', visible: true },
        { key: 'qty', label: 'Qty', width: '14%', align: 'right', visible: true },
        { key: 'uom', label: 'Unit', width: '14%', align: 'center', visible: true }
      ]
    }
  ];

  // ---------------------------------------------------------------------------
  // 3. STORAGE & REPOSITORY ENGINE
  // ---------------------------------------------------------------------------
  const PrintTemplateEngine = {
    getAllTemplates() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
        const userTemplates = raw ? JSON.parse(raw) : [];
        const merged = [...FACTORY_PRESETS];
        userTemplates.forEach((ut) => {
          const idx = merged.findIndex((m) => m.id === ut.id);
          if (idx >= 0) merged[idx] = ut;
          else merged.push(ut);
        });
        return merged;
      } catch (e) {
        return [...FACTORY_PRESETS];
      }
    },

    getTemplatesByDocType(docType) {
      if (!docType || docType === 'all') return this.getAllTemplates();
      return this.getAllTemplates().filter((t) => t.docType === docType);
    },

    getTemplateById(id) {
      if (!id) return this.getAllTemplates()[0];
      return this.getAllTemplates().find((t) => t.id === id) || this.getAllTemplates()[0];
    },

    getActiveTemplate(docType) {
      try {
        const rawActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
        const activeMap = rawActive ? JSON.parse(rawActive) : {};
        const activeId = activeMap[docType];
        if (activeId) {
          const t = this.getTemplateById(activeId);
          if (t && t.docType === docType) return t;
        }
      } catch (e) {}
      const list = this.getTemplatesByDocType(docType);
      return list[0] || FACTORY_PRESETS[0];
    },

    setActiveTemplate(docType, templateId) {
      try {
        const rawActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
        const activeMap = rawActive ? JSON.parse(rawActive) : {};
        activeMap[docType] = templateId;
        localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(activeMap));
        return true;
      } catch (e) {
        return false;
      }
    },

    saveCustomTemplate(template) {
      if (!template || !template.name) throw new Error('Template name is required.');
      let targetId = template.id;
      if (!targetId || targetId.startsWith('bom_') || targetId.startsWith('challan_') || targetId.startsWith('invoice_') || targetId.startsWith('thermal_')) {
        targetId = 'tpl_' + (template.docType || 'doc') + '_' + Date.now().toString(36);
      }
      const toSave = { ...template, id: targetId, isPreset: false, updatedAt: new Date().toISOString() };
      const userTemplates = this.getUserTemplates().filter((t) => t.id !== targetId);
      userTemplates.push(toSave);
      localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(userTemplates));
      return toSave;
    },

    getUserTemplates() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    deleteTemplate(id) {
      const t = this.getTemplateById(id);
      if (t && t.isPreset) throw new Error('Built-in system presets cannot be deleted.');
      const userTemplates = this.getUserTemplates().filter((u) => u.id !== id);
      localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(userTemplates));
      return true;
    },

    exportTemplateJson(id) {
      const t = this.getTemplateById(id);
      return JSON.stringify(t, null, 2);
    },

    importTemplateJson(jsonStr) {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.name || !parsed.columns) {
        throw new Error('Invalid template JSON schema.');
      }
      return this.saveCustomTemplate(parsed);
    },

    // -------------------------------------------------------------------------
    // 4. DYNAMIC HTML RENDERING ENGINE (Multi-Canvas, Watermark & Placeholders)
    // -------------------------------------------------------------------------
    renderDocumentHtml(docType, data, customTemplate) {
      const tpl = customTemplate || this.getActiveTemplate(docType);
      const isLandscape = tpl.orientation === 'landscape';
      const m = tpl.margins || { top: 8, bottom: 8, left: 6, right: 6 };

      // Determine canvas geometry
      let pageSizeCss = isLandscape ? '297mm 210mm' : '210mm 297mm';
      let sheetWidthCss = isLandscape ? '282mm' : '198mm';

      if (tpl.canvasPreset === 'A5_portrait') {
        pageSizeCss = '148mm 210mm';
        sheetWidthCss = '136mm';
      } else if (tpl.canvasPreset === 'A5_landscape') {
        pageSizeCss = '210mm 148mm';
        sheetWidthCss = '198mm';
      } else if (tpl.canvasPreset === 'POS80') {
        pageSizeCss = '80mm 220mm';
        sheetWidthCss = '74mm';
      } else if (tpl.canvasPreset === 'custom' && tpl.customWidth && tpl.customHeight) {
        const u = tpl.paperUnit || 'mm';
        pageSizeCss = `${tpl.customWidth}${u} ${tpl.customHeight}${u}`;
        sheetWidthCss = `${tpl.customWidth - (m.left + m.right)}${u}`;
      }

      // Variable Replacement Context
      const company = (data && data.company) || {
        name: 'ECO GREEN SOLAR',
        tagline: 'Solar Power Solutions & Enterprise ERP',
        address: 'B-12, Industrial Area, Sector 62, Noida, UP - 201301',
        gstin: '09AAECE1234F1Z5',
        phone: '+91 98765 43210',
        email: 'info@ecogreensolar.com'
      };

      const project = (data && data.project) || {
        customerName: (data && (data.customerName || data.party_name || data.customer)) || 'Shree Radhey Solar Enterprises',
        docNo: (data && (data.docNo || data.challan_no || data.bom_no || data.order_no)) || 'EGS/2026/0842',
        docDate: (data && (data.docDate || data.challan_date || data.date)) || new Date().toLocaleDateString('en-IN'),
        capacity: (data && data.capacity) || '10 KW On-Grid System',
        siteLocation: (data && data.siteLocation) || 'Site #42, Industrial Zone, Phase-2',
        vehicleNo: (data && (data.vehicleNo || data.vehicle_no)) || 'UP 16 AB 1234',
        contactPerson: (data && data.contactPerson) || 'Mr. Rajesh Verma (+91 98123 45678)'
      };

      const replaceVars = (str) => {
        if (!str) return '';
        return String(str)
          .replace(/\{\{company_name\}\}/gi, company.name)
          .replace(/\{\{customer_name\}\}/gi, project.customerName)
          .replace(/\{\{doc_no\}\}/gi, project.docNo)
          .replace(/\{\{date\}\}/gi, project.docDate)
          .replace(/\{\{capacity\}\}/gi, project.capacity)
          .replace(/\{\{site_location\}\}/gi, project.siteLocation)
          .replace(/\{\{vehicle_no\}\}/gi, project.vehicleNo)
          .replace(/\{\{gstin\}\}/gi, company.gstin);
      };

      // Mock or Real Line Items
      const sections = (data && data.sections) || [
        {
          name: '1. SOLAR PV MODULES',
          items: [
            { sr_no: 1, item_desc: 'Mono PERC Bifacial Solar Panels 550W (TOPCon Half-Cut)', brand: 'Adani Solar', wattage: '550W', qty: 18, uom: 'NOS', rate: '12400', amount: '223200', remarks: 'Serial Tracked' }
          ]
        },
        {
          name: '2. SOLAR INVERTER & PCU',
          items: [
            { sr_no: 2, item_desc: '10 kW 3-Phase Grid-Tied Solar Inverter with Built-in WiFi / RS485', brand: 'Growatt', wattage: '10KW', qty: 1, uom: 'SET', rate: '54000', amount: '54000', remarks: 'Serial: GW10K-9982' }
          ]
        },
        {
          name: '3. MOUNTING STRUCTURE & HARDWARE',
          items: [
            { sr_no: 3, item_desc: 'HDG Elevated Solar Module Mounting Structure (3x6 Array Configuration)', brand: 'Standard HDG', wattage: '-', qty: 1, uom: 'SET', rate: '28000', amount: '28000', remarks: 'Grade 8.8 Fasteners' },
            { sr_no: 4, item_desc: 'Aluminium Mid & End Clamps with EPDM Rubber Pad (35mm)', brand: 'Standard', wattage: '-', qty: 44, uom: 'NOS', rate: '65', amount: '2860', remarks: '-' }
          ]
        },
        {
          name: '4. ELECTRICAL BALANCE OF SYSTEM (BOS)',
          items: [
            { sr_no: 5, item_desc: '10 kW AC Distribution Box (ACDB) with 25A 4P MCB & Type-2 SPD', brand: 'Havells / L&T', wattage: '10KW', qty: 1, uom: 'NOS', rate: '6500', amount: '6500', remarks: 'IP65 Enclosure' },
            { sr_no: 6, item_desc: '2 In 2 Out DC Distribution Box (DCDB) with 1000V DC Fuses & 2P SPD', brand: 'Elmex / L&T', wattage: '1000V', qty: 1, uom: 'NOS', rate: '7200', amount: '7200', remarks: 'IP65 Enclosure' },
            { sr_no: 7, item_desc: '4 sq mm 1C Solar DC Cable (XLPO Flame Retardant Red & Black)', brand: 'Polycab', wattage: '-', qty: 120, uom: 'MTR', rate: '42', amount: '5040', remarks: 'UV Resistant' },
            { sr_no: 8, item_desc: '6 sq mm 4C Copper Armoured AC Cable', brand: 'Polycab', wattage: '-', qty: 35, uom: 'MTR', rate: '240', amount: '8400', remarks: 'Grade 1100V' }
          ]
        },
        {
          name: '5. EARTHING & LIGHTNING PROTECTION',
          items: [
            { sr_no: 9, item_desc: 'Chemical Earthing Electrode (17.2mm Dia x 2 Mtr Long Solid Copper Bonded)', brand: 'True Power', wattage: '-', qty: 3, uom: 'SET', rate: '2800', amount: '8400', remarks: 'With 25kg BFC compound' },
            { sr_no: 10, item_desc: 'Conventional ESE Lightning Arrester (Copper Spike with SS Support Mast)', brand: 'LPI / Standard', wattage: '-', qty: 1, uom: 'SET', rate: '4500', amount: '4500', remarks: 'With Base Plate' }
          ]
        }
      ];

      const visibleCols = (tpl.columns || []).filter((c) => c.visible !== false);
      let tableRowsHtml = '';
      let globalSr = 1;
      let totalQty = 0;
      let totalAmount = 0;

      sections.forEach((sec) => {
        if (sec.name) {
          tableRowsHtml += '<tr class="sec-header-row" style="background:' + (tpl.sectionHeaderBg || '#f2f4f7') + ' !important; -webkit-print-color-adjust:exact;">' +
            '<td colspan="' + visibleCols.length + '" style="padding:' + (tpl.sectionHeaderPadding || '3px 6px') + '; font-size:' + (tpl.sectionHeaderFontSize || '9.5pt') + '; font-weight:800; color:' + (tpl.sectionHeaderColor || '#000000') + '; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; letter-spacing:0.3px;">' +
            sec.name +
            '</td></tr>';
        }

        (sec.items || []).forEach((it) => {
          const qVal = Number(it.qty || it.quantity || 0);
          const amtVal = Number(it.amount || 0);
          totalQty += qVal;
          totalAmount += amtVal;

          tableRowsHtml += '<tr class="item-row" style="page-break-inside:avoid; break-inside:avoid;">';
          visibleCols.forEach((col) => {
            let val = '';
            if (col.key === 'sr_no') val = it.sr_no || globalSr++;
            else if (col.key === 'item_desc') val = '<strong>' + (it.item_desc || it.name || it.item_name || '-') + '</strong>';
            else if (col.key === 'brand') val = it.brand || '-';
            else if (col.key === 'wattage') val = it.wattage || it.spec || '-';
            else if (col.key === 'qty') val = '<strong>' + qVal + '</strong>';
            else if (col.key === 'uom') val = it.uom || it.unit || 'NOS';
            else if (col.key === 'rate') val = it.rate ? ('₹' + Number(it.rate).toLocaleString('en-IN')) : '-';
            else if (col.key === 'amount') val = it.amount ? ('₹' + Number(it.amount).toLocaleString('en-IN')) : '-';
            else if (col.key === 'checked') val = '<div style="width:14px; height:14px; border:1px solid #777; margin:0 auto;"></div>';
            else if (col.key === 'remarks') val = it.remarks || '-';
            else val = it[col.key] || '-';

            tableRowsHtml += '<td style="padding:' + (tpl.rowPadding || '2px 4px') + '; text-align:' + (col.align || 'left') + '; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; font-size:' + (tpl.baseFontSize || '9.6pt') + '; vertical-align:middle;">' +
              val +
              '</td>';
          });
          tableRowsHtml += '</tr>';
        });
      });

      // Total summary row
      const isInvoice = tpl.docType === 'invoice';
      tableRowsHtml += '<tr class="total-row" style="background:#fafafa; font-weight:800; -webkit-print-color-adjust:exact;">' +
        '<td colspan="' + Math.max(1, visibleCols.length - (isInvoice ? 2 : 2)) + '" style="padding:' + (tpl.rowPadding || '3px 4px') + '; text-align:right; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; font-size:' + (tpl.baseFontSize || '9.6pt') + ';\">' +
        (isInvoice ? 'TOTAL INVOICE AMOUNT:' : 'TOTAL DISPATCH QUANTITY:') +
        '</td>' +
        '<td style="padding:' + (tpl.rowPadding || '3px 4px') + '; text-align:right; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; font-size:' + (tpl.baseFontSize || '9.6pt') + ';\">' +
        (isInvoice ? ('₹' + totalAmount.toLocaleString('en-IN')) : totalQty) +
        '</td>' +
        '<td style="padding:' + (tpl.rowPadding || '3px 4px') + '; text-align:center; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; font-size:' + (tpl.baseFontSize || '9.6pt') + ';\">' +
        (isInvoice ? 'INR' : 'ITEMS') +
        '</td>' +
      '</tr>';

      const colHeadersHtml = visibleCols.map((c) => '<th style="width:' + (c.width || 'auto') + '; text-align:' + (c.align || 'left') + '; padding:' + (tpl.rowPadding || '3px 4px') + '; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; background:' + (tpl.tableHeadBg || '#f2f4f7') + '; color:' + (tpl.tableHeadColor || '#000000') + '; font-size:' + (tpl.baseFontSize || '9.6pt') + '; font-weight:800; -webkit-print-color-adjust:exact;">' + c.label + '</th>').join('');

      const sigsHtml = (tpl.signatures || []).map((s) => '<div style="flex:1; text-align:center; padding:12px 4px 0 4px; border-top:1px solid #000000;"><div style="font-size:8.5pt; font-weight:700;">' + (s.title || 'Authorized Signatory') + '</div></div>').join('');

      const wm = tpl.watermark || {};
      const watermarkHtml = (wm.show && wm.text) ? `
        <div style="position:fixed; top:45%; left:50%; transform:translate(-50%, -50%) rotate(${wm.angle || -30}deg); font-size:${wm.fontSize || '48pt'}; font-weight:900; color:${wm.color || '#000000'}; opacity:${wm.opacity || 0.08}; pointer-events:none; z-index:0; white-space:nowrap; text-transform:uppercase; letter-spacing:4px;">
          ${wm.text}
        </div>
      ` : '';

      return '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
          '<meta charset="utf-8">' +
          '<title>' + replaceVars(tpl.headerTitle) + ' - ' + project.docNo + '</title>' +
          '<style>' +
            '@page { size: ' + pageSizeCss + '; margin: ' + m.top + 'mm ' + m.right + 'mm ' + m.bottom + 'mm ' + m.left + 'mm; }' +
            '* { box-sizing: border-box; margin: 0; padding: 0; }' +
            'html, body { background: #ffffff; width: 100%; height: 100%; font-family: ' + tpl.fontFamily + '; color: #000000; -webkit-print-color-adjust: exact; print-color-adjust: exact; position: relative; }' +
            '.print-sheet { width: ' + sheetWidthCss + '; margin: 0 auto; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; transform-origin: top center; position: relative; ' + (tpl.printScale && tpl.printScale !== 1.0 ? 'transform: scale(' + tpl.printScale + ');' : '') + ' }' +
            'table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 6px; }' +
            '@media print { body { background: #ffffff !important; } .no-print { display: none !important; } }' +
          '</style>' +
        '</head>' +
        '<body>' +
          watermarkHtml +
          '<div class="print-sheet" id="printSheetRoot">' +
            '<div style="border-bottom:2px solid #000000; padding-bottom:6px; margin-bottom:6px;">' +
              '<div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">' +
                (tpl.showLogo ? '<div style="flex:0 0 ' + (tpl.logoWidth || '140px') + '; text-align:' + (tpl.logoAlign || 'left') + ';"><img src="assets/logo.png" alt="Logo" style="max-width:100%; max-height:48px; object-fit:contain;"></div>' : '') +
                '<div style="flex:1; text-align:center;">' +
                  '<h1 style="font-size:13.5pt; font-weight:900; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:2px;">' + replaceVars(tpl.headerTitle) + '</h1>' +
                  (tpl.headerSubtitle ? '<div style="font-size:8.5pt; color:#444;">' + replaceVars(tpl.headerSubtitle) + '</div>' : '') +
                '</div>' +
                '<div style="flex:0 0 160px; text-align:right; font-size:8pt; line-height:1.3;">' +
                  '<div><strong>Doc No:</strong> ' + project.docNo + '</div>' +
                  '<div><strong>Date:</strong> ' + project.docDate + '</div>' +
                  (project.capacity ? '<div><strong>Capacity:</strong> ' + project.capacity + '</div>' : '') +
                '</div>' +
              '</div>' +
              '<div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:4px; border-top:1px dashed #777; font-size:8.5pt;">' +
                '<div><strong>Client / Consignee:</strong> ' + project.customerName + '</div>' +
                (project.siteLocation ? '<div><strong>Site:</strong> ' + project.siteLocation + '</div>' : (project.vehicleNo ? '<div><strong>Vehicle:</strong> ' + project.vehicleNo + '</div>' : '')) +
              '</div>' +
            '</div>' +
            '<table>' +
              '<thead><tr>' + colHeadersHtml + '</tr></thead>' +
              '<tbody>' + tableRowsHtml + '</tbody>' +
            '</table>' +
            '<div style="margin-top:auto; padding-top:8px;">' +
              (tpl.showFooterNotes && tpl.footerNotes ? '<div style="font-size:7.5pt; color:#444; margin-bottom:12px; font-style:italic; line-height:1.2;">* ' + replaceVars(tpl.footerNotes) + '</div>' : '') +
              (tpl.showSignatures ? '<div style="display:flex; justify-content:space-between; gap:24px; margin-top:14px;">' + sigsHtml + '</div>' : '') +
              '<div style="text-align:center; font-size:7pt; color:#777; margin-top:8px; border-top:0.5px solid #ccc; padding-top:3px;">' +
                'Eco Green Solar Enterprise ERP • Page 1 of 1 • System Generated Official Document' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</body>' +
        '</html>';
    }
  };

  window.PrintTemplateEngine = PrintTemplateEngine;
  window.CANVAS_PRESETS = CANVAS_PRESETS;

})(window);
