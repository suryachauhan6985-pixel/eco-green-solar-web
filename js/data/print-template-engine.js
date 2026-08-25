/**
 * Eco Green Solar ERP - Universal Print Template Engine
 * Handles schema validation, template persistence, factory presets,
 * and dynamic HTML generation with Excel-style Fit-To-Page scaling.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY_TEMPLATES = 'egs_print_templates';
  const STORAGE_KEY_ACTIVE = 'egs_active_print_templates';

  // ---------------------------------------------------------------------------
  // 1. BUILT-IN FACTORY PRESETS
  // ---------------------------------------------------------------------------
  const FACTORY_PRESETS = [
    {
      id: 'bom_default',
      name: 'Standard Solar BOM (Full Detail)',
      docType: 'bom',
      isPreset: true,
      paperSize: 'A4',
      orientation: 'portrait',
      margins: { top: 8, bottom: 8, left: 6, right: 6 },
      fontFamily: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif",
      baseFontSize: '9.6pt',
      rowPadding: '2.5px 4px',
      sectionHeaderBg: '#f2f4f7',
      sectionHeaderColor: '#000000',
      sectionHeaderFontSize: '9.8pt',
      sectionHeaderPadding: '3.5px 6px',
      borderWidth: '1px',
      borderColor: '#000000',
      printScale: 1.0,
      autoFitOnePage: true,
      showLogo: true,
      logoWidth: '150px',
      logoAlign: 'left',
      headerTitle: 'BILL OF MATERIAL (BOM)',
      headerSubtitle: 'Solar System Components & Kit Specification Sheet',
      showCompanyInfo: true,
      showProjectDetails: true,
      showSignatures: true,
      signatures: [
        { title: 'Prepared By (Tech Team)' },
        { title: 'Verified By (Store Incharge)' },
        { title: 'Authorized Signatory' }
      ],
      showFooterNotes: true,
      footerNotes: 'All equipment dispatched in sound condition. Serial numbers and warranty records are mapped in the central ERP ledger.',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', width: '6%', align: 'center', visible: true },
        { key: 'item_desc', label: 'Item Description & Specification', width: '52%', align: 'left', visible: true },
        { key: 'brand', label: 'Brand / Make', width: '15%', align: 'left', visible: true },
        { key: 'wattage', label: 'Watt / Spec', width: '11%', align: 'center', visible: true },
        { key: 'qty', label: 'Quantity', width: '9%', align: 'right', visible: true },
        { key: 'uom', label: 'UOM', width: '7%', align: 'center', visible: true }
      ]
    },
    {
      id: 'bom_compact_1page',
      name: 'Compact 1-Page Fit Solar BOM',
      docType: 'bom',
      isPreset: true,
      paperSize: 'A4',
      orientation: 'portrait',
      margins: { top: 5, bottom: 5, left: 5, right: 5 },
      fontFamily: "'Segoe UI', Arial, sans-serif",
      baseFontSize: '8.8pt',
      rowPadding: '1.5px 3px',
      sectionHeaderBg: '#e5e7eb',
      sectionHeaderColor: '#000000',
      sectionHeaderFontSize: '9.0pt',
      sectionHeaderPadding: '2px 4px',
      borderWidth: '1px',
      borderColor: '#000000',
      printScale: 0.96,
      autoFitOnePage: true,
      showLogo: true,
      logoWidth: '120px',
      logoAlign: 'left',
      headerTitle: 'BILL OF MATERIAL (BOM)',
      headerSubtitle: 'System Component Dispatch Sheet',
      showCompanyInfo: true,
      showProjectDetails: true,
      showSignatures: true,
      signatures: [
        { title: 'Store Dispatch' },
        { title: 'Authorized Signatory' }
      ],
      showFooterNotes: false,
      footerNotes: '',
      columns: [
        { key: 'sr_no', label: 'S.N.', width: '5%', align: 'center', visible: true },
        { key: 'item_desc', label: 'Component Description', width: '55%', align: 'left', visible: true },
        { key: 'brand', label: 'Make', width: '15%', align: 'left', visible: true },
        { key: 'wattage', label: 'Watt', width: '10%', align: 'center', visible: true },
        { key: 'qty', label: 'Qty', width: '8%', align: 'right', visible: true },
        { key: 'uom', label: 'UOM', width: '7%', align: 'center', visible: true }
      ]
    },
    {
      id: 'challan_dual_copy',
      name: 'Landscape A4 Dual Copy Challan (Consignee & Transporter)',
      docType: 'challan',
      isPreset: true,
      paperSize: 'A4',
      orientation: 'landscape',
      margins: { top: 10, bottom: 5, left: 5, right: 5 },
      fontFamily: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif",
      baseFontSize: '9.2pt',
      rowPadding: '2px 4px',
      sectionHeaderBg: '#f2f4f7',
      sectionHeaderColor: '#000000',
      sectionHeaderFontSize: '9.4pt',
      sectionHeaderPadding: '3px 4px',
      borderWidth: '1px',
      borderColor: '#000000',
      printScale: 1.0,
      autoFitOnePage: true,
      showLogo: true,
      logoWidth: '110px',
      logoAlign: 'left',
      headerTitle: 'DELIVERY CHALLAN',
      headerSubtitle: '',
      showCompanyInfo: true,
      showProjectDetails: true,
      showSignatures: true,
      signatures: [
        { title: 'Receiver Signature' },
        { title: 'For Eco Green Solar' }
      ],
      showFooterNotes: true,
      footerNotes: 'Goods once sold/dispatched will not be taken back.',
      columns: [
        { key: 'sr_no', label: 'S.N.', width: '7%', align: 'center', visible: true },
        { key: 'item_desc', label: 'Description of Goods', width: '60%', align: 'left', visible: true },
        { key: 'qty', label: 'Qty', width: '18%', align: 'right', visible: true },
        { key: 'uom', label: 'Unit', width: '15%', align: 'center', visible: true }
      ]
    },
    {
      id: 'challan_single_detailed',
      name: 'Portrait Detailed Delivery Challan',
      docType: 'challan',
      isPreset: true,
      paperSize: 'A4',
      orientation: 'portrait',
      margins: { top: 10, bottom: 10, left: 8, right: 8 },
      fontFamily: "'Segoe UI', Arial, sans-serif",
      baseFontSize: '9.6pt',
      rowPadding: '3px 5px',
      sectionHeaderBg: '#f0fdf4',
      sectionHeaderColor: '#166534',
      sectionHeaderFontSize: '10pt',
      sectionHeaderPadding: '4px 6px',
      borderWidth: '1px',
      borderColor: '#000000',
      printScale: 1.0,
      autoFitOnePage: true,
      showLogo: true,
      logoWidth: '150px',
      logoAlign: 'left',
      headerTitle: 'DELIVERY CHALLAN',
      headerSubtitle: 'Stock Transport & Dispatch Voucher',
      showCompanyInfo: true,
      showProjectDetails: true,
      showSignatures: true,
      signatures: [
        { title: 'Prepared By' },
        { title: 'Driver / Transporter Sign' },
        { title: 'Authorized Signatory' }
      ],
      showFooterNotes: true,
      footerNotes: 'Received above goods in good condition & intact seal.',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', width: '7%', align: 'center', visible: true },
        { key: 'item_desc', label: 'Item Name & Description', width: '55%', align: 'left', visible: true },
        { key: 'brand', label: 'Brand', width: '15%', align: 'left', visible: true },
        { key: 'qty', label: 'Dispatch Qty', width: '13%', align: 'right', visible: true },
        { key: 'uom', label: 'UOM', width: '10%', align: 'center', visible: true }
      ]
    }
  ];

  // ---------------------------------------------------------------------------
  // 2. STORAGE & REPOSITORY ENGINE
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
      if (!targetId || targetId.startsWith('bom_') || targetId.startsWith('challan_')) {
        targetId = 'tpl_' + template.docType + '_' + Date.now().toString(36);
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
      if (!parsed.name || !parsed.docType || !parsed.columns) {
        throw new Error('Invalid template JSON schema.');
      }
      return this.saveCustomTemplate(parsed);
    },

    renderDocumentHtml(docType, data, customTemplate) {
      const tpl = customTemplate || this.getActiveTemplate(docType);
      const isLandscape = tpl.orientation === 'landscape';
      const m = tpl.margins || { top: 8, bottom: 8, left: 6, right: 6 };

      const project = (data && data.project) || {
        customerName: (data && (data.customerName || data.party_name || data.customer)) || 'Shree Radhey Solar Enterprises',
        docNo: (data && (data.docNo || data.challan_no || data.bom_no || data.order_no)) || 'EGS/2026/0842',
        docDate: (data && (data.docDate || data.challan_date || data.date)) || new Date().toLocaleDateString('en-IN'),
        capacity: (data && data.capacity) || '10 KW On-Grid System',
        siteLocation: (data && data.siteLocation) || 'Site #42, Industrial Zone, Phase-2',
        contactPerson: (data && data.contactPerson) || 'Mr. Rajesh Verma (+91 98123 45678)'
      };

      const sections = (data && data.sections) || [
        {
          name: '1. SOLAR PV MODULES',
          items: [
            { sr_no: 1, item_desc: 'Mono PERC Bifacial Solar Panels 550W (TOPCon Half-Cut)', brand: 'Adani Solar', wattage: '550W', qty: 18, uom: 'NOS', remarks: 'Serial Tracked' }
          ]
        },
        {
          name: '2. SOLAR INVERTER & PCU',
          items: [
            { sr_no: 2, item_desc: '10 kW 3-Phase Grid-Tied Solar Inverter with Built-in WiFi / RS485', brand: 'Growatt', wattage: '10KW', qty: 1, uom: 'SET', remarks: 'Serial: GW10K-9982' }
          ]
        },
        {
          name: '3. MOUNTING STRUCTURE & HARDWARE',
          items: [
            { sr_no: 3, item_desc: 'HDG Elevated Solar Module Mounting Structure (3x6 Array Configuration)', brand: 'Standard HDG', wattage: '-', qty: 1, uom: 'SET', remarks: 'Grade 8.8 Fasteners' },
            { sr_no: 4, item_desc: 'Aluminium Mid & End Clamps with EPDM Rubber Pad (35mm)', brand: 'Standard', wattage: '-', qty: 44, uom: 'NOS', remarks: '-' }
          ]
        },
        {
          name: '4. ELECTRICAL BALANCE OF SYSTEM (BOS)',
          items: [
            { sr_no: 5, item_desc: '10 kW AC Distribution Box (ACDB) with 25A 4P MCB & Type-2 SPD', brand: 'Havells / L&T', wattage: '10KW', qty: 1, uom: 'NOS', remarks: 'IP65 Enclosure' },
            { sr_no: 6, item_desc: '2 In 2 Out DC Distribution Box (DCDB) with 1000V DC Fuses & 2P SPD', brand: 'Elmex / L&T', wattage: '1000V', qty: 1, uom: 'NOS', remarks: 'IP65 Enclosure' },
            { sr_no: 7, item_desc: '4 sq mm 1C Solar DC Cable (XLPO Flame Retardant Red & Black)', brand: 'Polycab', wattage: '-', qty: 120, uom: 'MTR', remarks: 'UV Resistant' },
            { sr_no: 8, item_desc: '6 sq mm 4C Copper Armoured AC Cable', brand: 'Polycab', wattage: '-', qty: 35, uom: 'MTR', remarks: 'Grade 1100V' }
          ]
        },
        {
          name: '5. EARTHING & LIGHTNING PROTECTION',
          items: [
            { sr_no: 9, item_desc: 'Chemical Earthing Electrode (17.2mm Dia x 2 Mtr Long Solid Copper Bonded)', brand: 'True Power', wattage: '-', qty: 3, uom: 'SET', remarks: 'With 25kg BFC compound' },
            { sr_no: 10, item_desc: 'Conventional ESE Lightning Arrester (Copper Spike with SS Support Mast)', brand: 'LPI / Standard', wattage: '-', qty: 1, uom: 'SET', remarks: 'With Base Plate' }
          ]
        }
      ];

      const visibleCols = (tpl.columns || []).filter((c) => c.visible !== false);

      let tableRowsHtml = '';
      let globalSr = 1;
      let totalQty = 0;

      sections.forEach((sec) => {
        if (sec.name) {
          tableRowsHtml += '<tr class="sec-header-row" style="background:' + (tpl.sectionHeaderBg || '#f2f4f7') + ' !important; -webkit-print-color-adjust:exact;">' +
            '<td colspan="' + visibleCols.length + '" style="padding:' + (tpl.sectionHeaderPadding || '3px 6px') + '; font-size:' + (tpl.sectionHeaderFontSize || '9.5pt') + '; font-weight:800; color:' + (tpl.sectionHeaderColor || '#000000') + '; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; letter-spacing:0.3px;">' +
            sec.name +
            '</td></tr>';
        }

        (sec.items || []).forEach((it) => {
          const qVal = Number(it.qty || it.quantity || 0);
          totalQty += qVal;

          tableRowsHtml += '<tr class="item-row" style="page-break-inside:avoid; break-inside:avoid;">';
          visibleCols.forEach((col) => {
            let val = '';
            if (col.key === 'sr_no') val = it.sr_no || globalSr++;
            else if (col.key === 'item_desc') val = '<strong>' + (it.item_desc || it.name || it.item_name || '-') + '</strong>';
            else if (col.key === 'brand') val = it.brand || '-';
            else if (col.key === 'wattage') val = it.wattage || it.spec || '-';
            else if (col.key === 'qty') val = '<strong>' + qVal + '</strong>';
            else if (col.key === 'uom') val = it.uom || it.unit || 'NOS';
            else if (col.key === 'rate') val = it.rate ? ('₹' + it.rate) : '-';
            else if (col.key === 'amount') val = it.amount ? ('₹' + it.amount) : '-';
            else if (col.key === 'remarks') val = it.remarks || '-';
            else val = it[col.key] || '-';

            tableRowsHtml += '<td style="padding:' + (tpl.rowPadding || '2px 4px') + '; text-align:' + (col.align || 'left') + '; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; font-size:' + (tpl.baseFontSize || '9.6pt') + '; vertical-align:middle;">' +
              val +
              '</td>';
          });
          tableRowsHtml += '</tr>';
        });
      });

      tableRowsHtml += '<tr class="total-row" style="background:#fafafa; font-weight:800; -webkit-print-color-adjust:exact;">' +
        '<td colspan="' + Math.max(1, visibleCols.length - 2) + '" style="padding:' + (tpl.rowPadding || '3px 4px') + '; text-align:right; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; font-size:' + (tpl.baseFontSize || '9.6pt') + ';">' +
        'TOTAL DISPATCH QUANTITY:' +
        '</td>' +
        '<td style="padding:' + (tpl.rowPadding || '3px 4px') + '; text-align:right; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; font-size:' + (tpl.baseFontSize || '9.6pt') + ';">' +
        totalQty +
        '</td>' +
        '<td style="padding:' + (tpl.rowPadding || '3px 4px') + '; text-align:center; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; font-size:' + (tpl.baseFontSize || '9.6pt') + ';">' +
        'ITEMS' +
        '</td>' +
      '</tr>';

      const colHeadersHtml = visibleCols.map((c) => '<th style="width:' + (c.width || 'auto') + '; text-align:' + (c.align || 'left') + '; padding:' + (tpl.rowPadding || '3px 4px') + '; border:' + (tpl.borderWidth || '1px') + ' solid ' + (tpl.borderColor || '#000000') + '; background:#f2f4f7; font-size:' + (tpl.baseFontSize || '9.6pt') + '; font-weight:800; -webkit-print-color-adjust:exact;">' + c.label + '</th>').join('');

      const sigsHtml = (tpl.signatures || []).map((s) => '<div style="flex:1; text-align:center; padding:10px 4px 0 4px; border-top:1px solid #000000;"><div style="font-size:8.5pt; font-weight:700;">' + (s.title || 'Authorized Signatory') + '</div></div>').join('');

      return '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
          '<meta charset="utf-8">' +
          '<title>' + tpl.headerTitle + ' - ' + project.docNo + '</title>' +
          '<style>' +
            '@page { size: ' + (isLandscape ? '297mm 210mm' : '210mm 297mm') + '; margin: ' + m.top + 'mm ' + m.right + 'mm ' + m.bottom + 'mm ' + m.left + 'mm; }' +
            '* { box-sizing: border-box; margin: 0; padding: 0; }' +
            'html, body { background: #ffffff; width: 100%; height: 100%; font-family: ' + tpl.fontFamily + '; color: #000000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
            '.print-sheet { width: ' + (isLandscape ? '282mm' : '198mm') + '; margin: 0 auto; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; transform-origin: top center; ' + (tpl.printScale && tpl.printScale !== 1.0 ? 'transform: scale(' + tpl.printScale + ');' : '') + ' }' +
            'table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 6px; }' +
            '@media print { body { background: #ffffff !important; } .no-print { display: none !important; } }' +
          '</style>' +
        '</head>' +
        '<body>' +
          '<div class="print-sheet" id="printSheetRoot">' +
            '<div style="border-bottom:2px solid #000000; padding-bottom:6px; margin-bottom:6px;">' +
              '<div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">' +
                (tpl.showLogo ? '<div style="flex:0 0 ' + (tpl.logoWidth || '140px') + '; text-align:' + (tpl.logoAlign || 'left') + ';"><img src="assets/logo.png" alt="Logo" style="max-width:100%; max-height:48px; object-fit:contain;"></div>' : '') +
                '<div style="flex:1; text-align:center;">' +
                  '<h1 style="font-size:14pt; font-weight:900; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:2px;">' + tpl.headerTitle + '</h1>' +
                  (tpl.headerSubtitle ? '<div style="font-size:8.5pt; color:#444;">' + tpl.headerSubtitle + '</div>' : '') +
                '</div>' +
                '<div style="flex:0 0 160px; text-align:right; font-size:8pt; line-height:1.3;">' +
                  '<div><strong>Doc No:</strong> ' + project.docNo + '</div>' +
                  '<div><strong>Date:</strong> ' + project.docDate + '</div>' +
                  (project.capacity ? '<div><strong>Capacity:</strong> ' + project.capacity + '</div>' : '') +
                '</div>' +
              '</div>' +
              '<div style="display:flex; justify-content:space-between; margin-top:6px; padding-top:4px; border-top:1px dashed #777; font-size:8.5pt;">' +
                '<div><strong>Client / Consignee:</strong> ' + project.customerName + '</div>' +
                (project.siteLocation ? '<div><strong>Site:</strong> ' + project.siteLocation + '</div>' : '') +
              '</div>' +
            '</div>' +
            '<table>' +
              '<thead><tr>' + colHeadersHtml + '</tr></thead>' +
              '<tbody>' + tableRowsHtml + '</tbody>' +
            '</table>' +
            '<div style="margin-top:auto; padding-top:8px;">' +
              (tpl.showFooterNotes && tpl.footerNotes ? '<div style="font-size:7.5pt; color:#444; margin-bottom:12px; font-style:italic; line-height:1.2;">* ' + tpl.footerNotes + '</div>' : '') +
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

})(window);
