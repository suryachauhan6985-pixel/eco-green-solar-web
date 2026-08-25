/**
 * Eco Green Solar ERP - Multi-Tenant SaaS Context, Theming & Terminology Engine
 * Provides dynamic white-labeling, CSS variable injection, terminology hooks, and feature gating.
 */

(function () {
  'use strict';

  let currentTenant = {
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'default',
    name: 'Eco Green Solar',
    status: 'active',
    plan: 'enterprise',
    theme: {
      primaryColor: '#008080',
      secondaryColor: '#005a5a',
      accentColor: '#e5a93c',
      bgColor: '#0b1320',
      sidebarBg: '#070d18',
      sidebarText: '#ffffff',
      cardRadius: '12px',
      cardShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      logoUrl: null,
      faviconUrl: null,
      loginBannerUrl: null,
      customCss: null
    },
    features: {
      inventoryEnabled: true,
      gstInvoicing: true,
      multiBranch: false,
      exportReports: true,
      bomEnabled: true,
      serialTracking: true,
      vouchersEnabled: true,
      customFlags: {}
    },
    terminology: {
      client_alias: 'Customer',
      supplier_alias: 'Supplier',
      item_alias: 'Product / Item',
      invoice_alias: 'Delivery Challan / Invoice',
      warehouse_alias: 'Godown / Warehouse',
      tax_alias: 'GSTIN'
    },
    companyMeta: {
      brand_name: 'Eco Green Solar ERP',
      support_email: 'support@ecogreensolar.com',
      copyright_text: 'Eco Green Solar ERP © 2026 • Enterprise Operations & Inventory Suite'
    }
  };

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16);
      const g = parseInt(clean[1] + clean[1], 16);
      const b = parseInt(clean[2] + clean[2], 16);
      return `${r}, ${g}, ${b}`;
    }
    if (clean.length === 6) {
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    }
    return '0, 128, 128';
  }

  function applyTenantTheme(theme) {
    if (!theme) return;
    const root = document.documentElement;

    if (theme.primaryColor) {
      root.style.setProperty('--tenant-primary', theme.primaryColor);
      root.style.setProperty('--tenant-primary-rgb', hexToRgb(theme.primaryColor));
      root.style.setProperty('--primary', theme.primaryColor);
    }
    if (theme.secondaryColor) {
      root.style.setProperty('--tenant-secondary', theme.secondaryColor);
      root.style.setProperty('--tenant-secondary-rgb', hexToRgb(theme.secondaryColor));
    }
    if (theme.accentColor) {
      root.style.setProperty('--tenant-accent', theme.accentColor);
      root.style.setProperty('--tenant-accent-rgb', hexToRgb(theme.accentColor));
      root.style.setProperty('--gold', theme.accentColor);
    }
    if (theme.bgColor) {
      root.style.setProperty('--tenant-bg', theme.bgColor);
    }
    if (theme.sidebarBg) {
      root.style.setProperty('--tenant-sidebar-bg', theme.sidebarBg);
    }
    if (theme.sidebarText) {
      root.style.setProperty('--tenant-sidebar-text', theme.sidebarText);
    }
    if (theme.cardRadius) {
      root.style.setProperty('--tenant-card-radius', theme.cardRadius);
    }
    if (theme.cardShadow) {
      root.style.setProperty('--tenant-card-shadow', theme.cardShadow);
    }
    if (theme.fontFamily) {
      root.style.setProperty('--tenant-font-family', theme.fontFamily);
      document.body.style.fontFamily = theme.fontFamily;
    }

    // Dynamic Custom CSS Overrides Injection
    let customStyleEl = document.getElementById('tenantCustomOverrides');
    if (theme.customCss) {
      if (!customStyleEl) {
        customStyleEl = document.createElement('style');
        customStyleEl.id = 'tenantCustomOverrides';
        document.head.appendChild(customStyleEl);
      }
      customStyleEl.textContent = theme.customCss;
    } else if (customStyleEl) {
      customStyleEl.remove();
    }

    // Dynamic Favicon Injection
    if (theme.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = theme.faviconUrl;
    }
  }

  function resolveTenantSlug() {
    // 1. Query param override
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tenant')) {
      const qTenant = urlParams.get('tenant').trim().toLowerCase();
      localStorage.setItem('egs_tenant_slug', qTenant);
      return qTenant;
    }

    // 2. Subdomain check
    const host = window.location.hostname.toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1' && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const parts = host.split('.');
      if (parts.length > 2) {
        return parts[0];
      }
    }

    // 3. LocalStorage persistence
    return localStorage.getItem('egs_tenant_slug') || 'default';
  }

  async function loadTenantBranding() {
    const slug = resolveTenantSlug();
    const API_BASE = window.API_BASE || 'http://192.168.0.123:5000/api';

    try {
      const res = await fetch(`${API_BASE}/public/tenant-branding`, {
        headers: {
          'x-tenant-slug': slug
        }
      });

      if (res.ok) {
        const data = await res.json();
        currentTenant = data;
        applyTenantTheme(data.theme);

        // Update brand metadata in DOM
        if (data.companyMeta && data.companyMeta.brand_name) {
          const brandNameEls = document.querySelectorAll('.tenant-brand-name, .logo-text');
          brandNameEls.forEach((el) => { el.textContent = data.companyMeta.brand_name; });
          document.title = `${data.companyMeta.brand_name} — Web ERP`;
        }

        // Update brand logos
        if (data.theme && data.theme.logoUrl) {
          const logoImgs = document.querySelectorAll('.brand-logo-img, .tenant-brand-logo');
          logoImgs.forEach((img) => {
            img.src = data.theme.logoUrl;
            img.alt = data.name || 'Tenant Brand';
          });
        }

        // Broadcast tenant loaded event
        window.dispatchEvent(new CustomEvent('tenantLoaded', { detail: currentTenant }));
      }
    } catch (err) {
      console.warn('[Tenant Context] Fallback to default theme:', err.message);
      applyTenantTheme(currentTenant.theme);
    }
  }

  // Pre-paint initialization
  loadTenantBranding();

  // Public APIs
  window.TenantContext = {
    getTenant: () => currentTenant,
    getTheme: () => currentTenant.theme || {},
    getFeatures: () => currentTenant.features || {},
    getTerminology: () => currentTenant.terminology || {},
    getCompanyMeta: () => currentTenant.companyMeta || {},
    reload: loadTenantBranding
  };

  window.useTenantLabel = function (key, fallback = '') {
    const terms = (currentTenant && currentTenant.terminology) || {};
    return terms[key] || fallback || key;
  };

  window.isTenantFeatureEnabled = function (featureKey) {
    const features = (currentTenant && currentTenant.features) || {};
    if (features[featureKey] === false) return false;
    return true;
  };

  window.renderTenantLogo = function (extraClass = '', compact = false) {
    const theme = (currentTenant && currentTenant.theme) || {};
    const company = (currentTenant && currentTenant.companyMeta) || {};
    const brandName = company.brand_name || currentTenant.name || 'Eco Green Solar';

    if (theme.logoUrl) {
      return `
        <div class="${compact ? 'tenant-logo-compact' : 'tenant-logo-slot'} ${extraClass}">
          <img src="${theme.logoUrl}" alt="${brandName}" class="tenant-brand-logo" loading="lazy">
        </div>
      `;
    }

    return `
      <div class="${compact ? 'tenant-logo-compact' : 'tenant-logo-slot'} ${extraClass}">
        <span class="logo-fallback-badge" style="font-size:${compact ? '15px' : '18px'}; font-weight:800; color:var(--tenant-primary); letter-spacing:-0.5px; display:inline-flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-solar-panel" style="color:var(--tenant-accent);"></i>
          <span>${brandName}</span>
        </span>
      </div>
    `;
  };

  window.validateAndCompressTenantAsset = function (file, maxMb = 2) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file provided.'));

      const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
      if (!validTypes.includes(file.type)) {
        return reject(new Error('Invalid image format. Supported formats: PNG, JPEG, WebP, SVG.'));
      }

      if (file.size > maxMb * 1024 * 1024) {
        return reject(new Error(`Image file size exceeds maximum limit of ${maxMb}MB.`));
      }

      // If SVG, convert directly to data URL without rasterizing
      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read SVG file.'));
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target.result;
      };

      img.onload = () => {
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/webp', 0.88);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Could not process image asset.'));
      reader.readAsDataURL(file);
    });
  };
})();
