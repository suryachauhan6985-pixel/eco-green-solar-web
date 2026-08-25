// Eco Green Solar ERP - Multi-Tenant SaaS Resolution & Feature Gate Middleware
const { pool } = require('../db/pool');
const { DEFAULT_TENANT_ID } = require('../db/schema');

const tenantCache = new Map();
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function invalidateTenantCache(idOrSlug) {
  if (!idOrSlug) {
    tenantCache.clear();
    return;
  }
  for (const [key, entry] of tenantCache.entries()) {
    if (entry.data.id === idOrSlug || entry.data.slug === idOrSlug || key === idOrSlug) {
      tenantCache.delete(key);
    }
  }
}

async function fetchTenantData(identifier, isId = false) {
  const query = isId
    ? `SELECT t.*, 
              th.primary_color, th.secondary_color, th.accent_color, th.bg_color, th.sidebar_bg, th.sidebar_text,
              th.card_radius, th.card_shadow, th.font_family, th.logo_url, th.favicon_url, th.login_banner_url, th.css_custom_overrides,
              tf.inventory_enabled, tf.gst_invoicing, tf.multi_branch, tf.export_reports, tf.bom_enabled, tf.serial_tracking, tf.vouchers_enabled, tf.custom_flags_json,
              tc.terminology_json, tc.company_meta_json, tc.storage_quota_mb
       FROM tenants t
       LEFT JOIN tenant_themes th ON t.id = th.tenant_id
       LEFT JOIN tenant_features tf ON t.id = tf.tenant_id
       LEFT JOIN tenant_config tc ON t.id = tc.tenant_id
       WHERE t.id = ? LIMIT 1`
    : `SELECT t.*, 
              th.primary_color, th.secondary_color, th.accent_color, th.bg_color, th.sidebar_bg, th.sidebar_text,
              th.card_radius, th.card_shadow, th.font_family, th.logo_url, th.favicon_url, th.login_banner_url, th.css_custom_overrides,
              tf.inventory_enabled, tf.gst_invoicing, tf.multi_branch, tf.export_reports, tf.bom_enabled, tf.serial_tracking, tf.vouchers_enabled, tf.custom_flags_json,
              tc.terminology_json, tc.company_meta_json, tc.storage_quota_mb
       FROM tenants t
       LEFT JOIN tenant_themes th ON t.id = th.tenant_id
       LEFT JOIN tenant_features tf ON t.id = tf.tenant_id
       LEFT JOIN tenant_config tc ON t.id = tc.tenant_id
       WHERE t.slug = ? OR t.custom_domain = ? LIMIT 1`;

  const params = isId ? [identifier] : [identifier, identifier];
  const [rows] = await pool.query(query, params);
  if (!rows.length) return null;

  const row = rows[0];

  let terminology = {};
  try { terminology = row.terminology_json ? JSON.parse(row.terminology_json) : {}; } catch (e) {}

  let companyMeta = {};
  try { companyMeta = row.company_meta_json ? JSON.parse(row.company_meta_json) : {}; } catch (e) {}

  let customFlags = {};
  try { customFlags = row.custom_flags_json ? JSON.parse(row.custom_flags_json) : {}; } catch (e) {}

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    customDomain: row.custom_domain,
    status: row.status || 'active',
    plan: row.plan || 'enterprise',
    theme: {
      primaryColor: row.primary_color || '#008080',
      secondaryColor: row.secondary_color || '#005a5a',
      accentColor: row.accent_color || '#e5a93c',
      bgColor: row.bg_color || '#0b1320',
      sidebarBg: row.sidebar_bg || '#070d18',
      sidebarText: row.sidebar_text || '#ffffff',
      cardRadius: row.card_radius || '12px',
      cardShadow: row.card_shadow || '0 8px 24px rgba(0, 0, 0, 0.35)',
      fontFamily: row.font_family || "'Segoe UI', system-ui, sans-serif",
      logoUrl: row.logo_url || null,
      faviconUrl: row.favicon_url || null,
      loginBannerUrl: row.login_banner_url || null,
      customCss: row.css_custom_overrides || null
    },
    features: {
      inventoryEnabled: row.inventory_enabled === null || row.inventory_enabled === undefined ? true : !!row.inventory_enabled,
      gstInvoicing: row.gst_invoicing === null || row.gst_invoicing === undefined ? true : !!row.gst_invoicing,
      multiBranch: row.multi_branch === null || row.multi_branch === undefined ? false : !!row.multi_branch,
      exportReports: row.export_reports === null || row.export_reports === undefined ? true : !!row.export_reports,
      bomEnabled: row.bom_enabled === null || row.bom_enabled === undefined ? true : !!row.bom_enabled,
      serialTracking: row.serial_tracking === null || row.serial_tracking === undefined ? true : !!row.serial_tracking,
      vouchersEnabled: row.vouchers_enabled === null || row.vouchers_enabled === undefined ? true : !!row.vouchers_enabled,
      customFlags
    },
    terminology: Object.assign({
      client_alias: 'Customer',
      supplier_alias: 'Supplier',
      item_alias: 'Product / Item',
      invoice_alias: 'Delivery Challan / Invoice',
      warehouse_alias: 'Godown / Warehouse',
      tax_alias: 'GSTIN'
    }, terminology),
    companyMeta: Object.assign({
      brand_name: row.name || 'Eco Green Solar ERP',
      support_email: 'support@ecogreensolar.com',
      copyright_text: `${row.name || 'Eco Green Solar ERP'} © 2026 • Enterprise Operations Suite`
    }, companyMeta),
    storageQuotaMb: row.storage_quota_mb || 5000
  };
}

async function resolveTenant(req, res, next) {
  try {
    let identifier = null;
    let isId = false;

    // 1. Explicit Header
    if (req.headers['x-tenant-id']) {
      identifier = req.headers['x-tenant-id'].trim();
      isId = true;
    } else if (req.headers['x-tenant-slug']) {
      identifier = req.headers['x-tenant-slug'].trim().toLowerCase();
    }

    // 2. Query Parameter fallback (e.g. ?tenant=xyz for local development / testing)
    if (!identifier && req.query && req.query.tenant) {
      identifier = String(req.query.tenant).trim().toLowerCase();
    }

    // 3. Subdomain / Custom Domain Parsing from Host Header
    if (!identifier && req.headers.host) {
      const host = req.headers.host.split(':')[0].toLowerCase();
      // Exclude localhost / ip addresses / main domain
      if (host !== 'localhost' && host !== '127.0.0.1' && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        const parts = host.split('.');
        if (parts.length > 2) {
          identifier = parts[0]; // subdomain e.g. client1.yourapp.com -> client1
        } else {
          identifier = host; // custom domain e.g. erp.client.com
        }
      }
    }

    if (!identifier) {
      identifier = 'default';
    }

    const cacheKey = `${isId ? 'id:' : 'slug:'}${identifier}`;
    const cached = tenantCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp < TENANT_CACHE_TTL_MS)) {
      req.tenant = cached.data;
      return next();
    }

    let tenantData = await fetchTenantData(identifier, isId);

    // Fallback to default tenant if identifier was not found
    if (!tenantData && identifier !== 'default' && identifier !== DEFAULT_TENANT_ID) {
      tenantData = await fetchTenantData(DEFAULT_TENANT_ID, true);
    }

    if (!tenantData) {
      // Hardcoded ultimate fallback
      tenantData = {
        id: DEFAULT_TENANT_ID,
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
        },
        storageQuotaMb: 5000
      };
    }

    tenantCache.set(cacheKey, { timestamp: now, data: tenantData });
    req.tenant = tenantData;
    next();
  } catch (err) {
    console.error('[Tenant Middleware] Resolution error:', err);
    req.tenant = { id: DEFAULT_TENANT_ID, slug: 'default', name: 'Eco Green Solar', status: 'active', features: {} };
    next();
  }
}

function requireTenantFeature(featureKey) {
  return (req, res, next) => {
    if (!req.tenant) return next();
    const features = req.tenant.features || {};
    if (features[featureKey] === false) {
      return res.status(403).json({
        error: `The feature "${featureKey}" is disabled for your organization tenant plan.`
      });
    }
    next();
  };
}

module.exports = {
  resolveTenant,
  requireTenantFeature,
  invalidateTenantCache,
  DEFAULT_TENANT_ID
};
