// js/data/config-engine.js
// ---------------------------------------------------------------------------
// ECO GREEN SOLAR ERP — CENTRALIZED CONFIGURATION & BUSINESS ENGINE
// ---------------------------------------------------------------------------
// Single source of truth for:
//   - Mode-Based Architecture & Feature Flags (Serial, Warehouse, BOM, GST, Accounting)
//   - Company Profile & Tax Settings (State code, GSTIN, PAN, FY)
//   - GST Intra-State vs Inter-State Automatic Tax Engine (CGST/SGST vs IGST)
//   - Document Sequences & Numbering Formats (PUR-, SAL-, CHL-, PMT-, etc.)
//   - Configuration Presets (Full ERP, Trading ERP, Serial Inventory, Simple Inventory)
// ---------------------------------------------------------------------------

(function () {
  'use strict';

  const STORAGE_KEY = 'egs_erp_config_cache';

  const PRESETS = {
    full_erp: {
      label: 'Full ERP + Accounting',
      icon: 'fa-solid fa-crown',
      desc: 'All features enabled: Quantity + Serial Tracking + Warehouses + BOM Kits + Delivery Challans + Accounting Vouchers + GST.',
      settings: {
        config_profile: 'full_erp',
        inventory_tracking: '1',
        serial_tracking: '1',
        warehouse_tracking: '1',
        batch_tracking: '0',
        expiry_tracking: '0',
        stock_valuation: 'FIFO',
        accounting_enabled: '1',
        double_entry: '1',
        gst_enabled: '1',
        cgst_sgst_enabled: '1',
        igst_enabled: '1',
        feature_bom_enabled: '1'
      }
    },
    trading_erp: {
      label: 'Trading ERP (Quantity + Accounting)',
      icon: 'fa-solid fa-store',
      desc: 'Quantity-based Inventory + Purchases + Sales + Vouchers + Ledgers + GST (Serial scanning hidden).',
      settings: {
        config_profile: 'trading_erp',
        inventory_tracking: '1',
        serial_tracking: '0',
        warehouse_tracking: '1',
        batch_tracking: '0',
        expiry_tracking: '0',
        stock_valuation: 'FIFO',
        accounting_enabled: '1',
        double_entry: '1',
        gst_enabled: '1',
        cgst_sgst_enabled: '1',
        igst_enabled: '1',
        feature_bom_enabled: '0'
      }
    },
    serial_inventory: {
      label: 'Serial Tracked Inventory',
      icon: 'fa-solid fa-barcode',
      desc: 'Serial Number Scanning + Stock Allocation + Delivery Challans + Registers (Accounting disabled).',
      settings: {
        config_profile: 'serial_inventory',
        inventory_tracking: '1',
        serial_tracking: '1',
        warehouse_tracking: '1',
        batch_tracking: '0',
        expiry_tracking: '0',
        stock_valuation: 'None',
        accounting_enabled: '0',
        double_entry: '0',
        gst_enabled: '0',
        cgst_sgst_enabled: '0',
        igst_enabled: '0',
        feature_bom_enabled: '1'
      }
    },
    simple_inventory: {
      label: 'Simple Inventory (Quantity Only)',
      icon: 'fa-solid fa-boxes-stacked',
      desc: 'Simple in/out quantity tracking with warehouse support and low stock alerts.',
      settings: {
        config_profile: 'simple_inventory',
        inventory_tracking: '1',
        serial_tracking: '0',
        warehouse_tracking: '1',
        batch_tracking: '0',
        expiry_tracking: '0',
        stock_valuation: 'None',
        accounting_enabled: '0',
        double_entry: '0',
        gst_enabled: '0',
        cgst_sgst_enabled: '0',
        igst_enabled: '0',
        feature_bom_enabled: '0'
      }
    }
  };

  let _settings = {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) _settings = JSON.parse(raw) || {};
  } catch (e) {}

  const ConfigEngine = {
    PRESETS,

    async init() {
      try {
        const API_BASE = window.API_BASE || 'http://192.168.0.123:5000/api';
        const res = await fetch(`${API_BASE}/auth/app-settings`, {
          headers: {
            'Authorization': 'Bearer ' + (localStorage.getItem('egs_jwt') || '')
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.settings) {
            _settings = { ..._settings, ...data.settings };
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn('[Config Engine] Could not fetch settings from server, using cached:', e.message);
      }
      return _settings;
    },

    getAll() {
      return { ..._settings };
    },

    get(key, fallback = '') {
      if (_settings[key] != null) return _settings[key];
      return fallback;
    },

    isSerialTrackingEnabled() {
      return String(_settings.serial_tracking ?? '1') === '1';
    },

    isWarehouseTrackingEnabled() {
      return String(_settings.warehouse_tracking ?? '1') === '1';
    },

    isAccountingEnabled() {
      return String(_settings.accounting_enabled ?? '1') === '1';
    },

    isDoubleEntryEnabled() {
      return String(_settings.double_entry ?? '1') === '1';
    },

    isGstEnabled() {
      return String(_settings.gst_enabled ?? '1') === '1';
    },

    isBomEnabled() {
      return String(_settings.feature_bom_enabled ?? '1') === '1';
    },

    getStockValuation() {
      return String(_settings.stock_valuation || 'FIFO');
    },

    getCompanyInfo() {
      return {
        name: _settings.company_name || 'Eco Green Solar',
        gstin: _settings.company_gstin || '24AAAAA0000A1Z5',
        pan: _settings.company_pan || 'AAAAA0000A',
        stateCode: _settings.company_state_code || '24',
        address: _settings.company_address || 'Plot No. 12, Industrial Area, Rajkot, Gujarat, India',
        currency: _settings.company_currency || 'INR',
        fyStart: _settings.company_fy_start || '2026-04-01'
      };
    },

    determineGst(partyGstin = '', partyStateCode = '', taxableAmount = 0, taxRatePercent = 18) {
      const company = this.getCompanyInfo();
      const compState = String(company.stateCode || '24').trim();

      let targetState = String(partyStateCode || '').trim();
      if (!targetState && partyGstin && partyGstin.length >= 2) {
        targetState = partyGstin.slice(0, 2);
      }

      const isInterState = Boolean(targetState && targetState !== compState);
      const rate = Number(taxRatePercent) || 0;
      const amt = Number(taxableAmount) || 0;

      const totalTax = (amt * rate) / 100;
      let cgstRate = 0, sgstRate = 0, igstRate = 0;
      let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;

      if (isInterState) {
        igstRate = rate;
        igstAmount = totalTax;
      } else {
        cgstRate = rate / 2;
        sgstRate = rate / 2;
        cgstAmount = totalTax / 2;
        sgstAmount = totalTax / 2;
      }

      return {
        isInterState,
        taxRatePercent: rate,
        taxableAmount: amt,
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTax,
        totalWithTax: amt + totalTax
      };
    },

    getNextDocNumberPreview(docType = 'purchase') {
      const type = String(docType).toLowerCase();
      const prefix = _settings[`${type}_prefix`] || (type === 'purchase' ? 'PUR-' : type === 'sales' ? 'SAL-' : type === 'challan' ? 'CHL-' : `${type.toUpperCase()}-`);
      const nextSeq = parseInt(_settings[`${type}_next`] || '1001', 10);
      const padLen = parseInt(_settings.challan_pad || '4', 10);
      const padded = String(nextSeq).padStart(padLen, '0');
      const curYear = new Date().getFullYear();
      return `${prefix}${curYear}-${padded}`;
    },

    async saveSettings(newSettings) {
      const API_BASE = window.API_BASE || 'http://192.168.0.123:5000/api';
      const res = await fetch(`${API_BASE}/auth/app-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (localStorage.getItem('egs_jwt') || '')
        },
        body: JSON.stringify({ settings: newSettings })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save system settings.');
      }
      _settings = { ..._settings, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
      } catch (e) {}
      return data;
    }
  };

  window.CONFIG = ConfigEngine;
  window.ERP_CONFIG = ConfigEngine;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => ConfigEngine.init());
    } else {
      ConfigEngine.init();
    }
  }
})();
