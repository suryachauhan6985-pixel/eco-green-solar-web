// Eco Green Solar ERP - SuperAdmin Multi-Tenant SaaS Management API Routes
const crypto = require('crypto');
const { pool } = require('../db/pool');
const { requireRole } = require('../middleware/auth.middleware');
const { invalidateTenantCache, DEFAULT_TENANT_ID } = require('../middleware/tenant.middleware');

function registerSaaSTenantsRoutes(app) {
  // 1. List All Tenants (SuperAdmin only)
  app.get('/api/saas/tenants', requireRole('SuperAdmin'), async (req, res) => {
    try {
      const [tenants] = await pool.query(`
        SELECT t.*,
               th.primary_color, th.secondary_color, th.accent_color, th.logo_url,
               tc.storage_quota_mb,
               (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS users_count,
               (SELECT COUNT(*) FROM items i WHERE i.tenant_id = t.id) AS items_count,
               (SELECT COUNT(*) FROM stock_ledger sl WHERE sl.tenant_id = t.id) AS stock_records_count
        FROM tenants t
        LEFT JOIN tenant_themes th ON t.id = th.tenant_id
        LEFT JOIN tenant_config tc ON t.id = tc.tenant_id
        ORDER BY t.created_at ASC
      `);

      res.json(tenants);
    } catch (err) {
      console.error('[SaaS Tenants] Error listing tenants:', err);
      res.status(500).json({ error: 'Could not list tenants.' });
    }
  });

  // 2. Get Single Tenant Profile
  app.get('/api/saas/tenants/:id', requireRole('SuperAdmin'), async (req, res) => {
    try {
      const tenantId = req.params.id;
      const [tRows] = await pool.query(`SELECT * FROM tenants WHERE id = ? LIMIT 1`, [tenantId]);
      if (!tRows.length) return res.status(404).json({ error: 'Tenant not found.' });

      const [thRows] = await pool.query(`SELECT * FROM tenant_themes WHERE tenant_id = ? LIMIT 1`, [tenantId]);
      const [tfRows] = await pool.query(`SELECT * FROM tenant_features WHERE tenant_id = ? LIMIT 1`, [tenantId]);
      const [tcRows] = await pool.query(`SELECT * FROM tenant_config WHERE tenant_id = ? LIMIT 1`, [tenantId]);

      const tenant = tRows[0];
      const theme = thRows[0] || {};
      const features = tfRows[0] || {};
      const config = tcRows[0] || {};

      let terminology = {};
      try { terminology = config.terminology_json ? JSON.parse(config.terminology_json) : {}; } catch (e) {}

      let companyMeta = {};
      try { companyMeta = config.company_meta_json ? JSON.parse(config.company_meta_json) : {}; } catch (e) {}

      let customFlags = {};
      try { customFlags = features.custom_flags_json ? JSON.parse(features.custom_flags_json) : {}; } catch (e) {}

      res.json({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        customDomain: tenant.custom_domain,
        status: tenant.status,
        plan: tenant.plan,
        createdAt: tenant.created_at,
        theme: {
          primaryColor: theme.primary_color || '#008080',
          secondaryColor: theme.secondary_color || '#005a5a',
          accentColor: theme.accent_color || '#e5a93c',
          bgColor: theme.bg_color || '#0b1320',
          sidebarBg: theme.sidebar_bg || '#070d18',
          sidebarText: theme.sidebar_text || '#ffffff',
          cardRadius: theme.card_radius || '12px',
          cardShadow: theme.card_shadow || '0 8px 24px rgba(0, 0, 0, 0.35)',
          fontFamily: theme.font_family || "'Segoe UI', system-ui, sans-serif",
          logoUrl: theme.logo_url || null,
          faviconUrl: theme.favicon_url || null,
          loginBannerUrl: theme.login_banner_url || null,
          customCss: theme.css_custom_overrides || null
        },
        features: {
          inventoryEnabled: features.inventory_enabled === null || features.inventory_enabled === undefined ? true : !!features.inventory_enabled,
          gstInvoicing: features.gst_invoicing === null || features.gst_invoicing === undefined ? true : !!features.gst_invoicing,
          multiBranch: features.multi_branch === null || features.multi_branch === undefined ? false : !!features.multi_branch,
          exportReports: features.export_reports === null || features.export_reports === undefined ? true : !!features.export_reports,
          bomEnabled: features.bom_enabled === null || features.bom_enabled === undefined ? true : !!features.bom_enabled,
          serialTracking: features.serial_tracking === null || features.serial_tracking === undefined ? true : !!features.serial_tracking,
          vouchersEnabled: features.vouchers_enabled === null || features.vouchers_enabled === undefined ? true : !!features.vouchers_enabled,
          customFlags
        },
        terminology,
        companyMeta,
        storageQuotaMb: config.storage_quota_mb || 5000
      });
    } catch (err) {
      console.error('[SaaS Tenants] Error getting tenant profile:', err);
      res.status(500).json({ error: 'Could not get tenant profile.' });
    }
  });

  // 3. Create New Tenant
  app.post('/api/saas/tenants', requireRole('SuperAdmin'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const { slug, name, customDomain, status, plan, theme, features, terminology, companyMeta } = req.body;

      if (!slug || !name) {
        return res.status(400).json({ error: 'Tenant slug and name are required.' });
      }

      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (cleanSlug.length < 2) {
        return res.status(400).json({ error: 'Tenant slug must be at least 2 alphanumeric characters.' });
      }

      const [existingSlug] = await conn.query(`SELECT id FROM tenants WHERE slug = ? LIMIT 1`, [cleanSlug]);
      if (existingSlug.length) {
        return res.status(409).json({ error: `Tenant slug "${cleanSlug}" is already in use.` });
      }

      if (customDomain) {
        const [existingDomain] = await conn.query(`SELECT id FROM tenants WHERE custom_domain = ? LIMIT 1`, [customDomain.trim().toLowerCase()]);
        if (existingDomain.length) {
          return res.status(409).json({ error: `Domain "${customDomain}" is already mapped to another tenant.` });
        }
      }

      const newTenantId = crypto.randomUUID();

      await conn.beginTransaction();

      // Insert tenant
      await conn.query(
        `INSERT INTO tenants (id, slug, name, custom_domain, status, plan) VALUES (?, ?, ?, ?, ?, ?)`,
        [newTenantId, cleanSlug, name.trim(), customDomain ? customDomain.trim().toLowerCase() : null, status || 'active', plan || 'enterprise']
      );

      // Insert theme
      const t = theme || {};
      await conn.query(
        `INSERT INTO tenant_themes (
          tenant_id, primary_color, secondary_color, accent_color, bg_color, sidebar_bg, sidebar_text,
          card_radius, card_shadow, font_family, logo_url, favicon_url, login_banner_url, css_custom_overrides
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newTenantId,
          t.primaryColor || '#008080',
          t.secondaryColor || '#005a5a',
          t.accentColor || '#e5a93c',
          t.bgColor || '#0b1320',
          t.sidebarBg || '#070d18',
          t.sidebarText || '#ffffff',
          t.cardRadius || '12px',
          t.cardShadow || '0 8px 24px rgba(0, 0, 0, 0.35)',
          t.fontFamily || "'Segoe UI', system-ui, sans-serif",
          t.logoUrl || null,
          t.faviconUrl || null,
          t.loginBannerUrl || null,
          t.customCss || null
        ]
      );

      // Insert features
      const f = features || {};
      await conn.query(
        `INSERT INTO tenant_features (
          tenant_id, inventory_enabled, gst_invoicing, multi_branch, export_reports,
          bom_enabled, serial_tracking, vouchers_enabled, custom_flags_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newTenantId,
          f.inventoryEnabled !== false ? 1 : 0,
          f.gstInvoicing !== false ? 1 : 0,
          f.multiBranch ? 1 : 0,
          f.exportReports !== false ? 1 : 0,
          f.bomEnabled !== false ? 1 : 0,
          f.serialTracking !== false ? 1 : 0,
          f.vouchersEnabled !== false ? 1 : 0,
          f.customFlags ? JSON.stringify(f.customFlags) : null
        ]
      );

      // Insert config
      const defaultTerminology = {
        client_alias: 'Customer',
        supplier_alias: 'Supplier',
        item_alias: 'Product / Item',
        invoice_alias: 'Delivery Challan / Invoice',
        warehouse_alias: 'Godown / Warehouse',
        tax_alias: 'GSTIN'
      };
      const finalTerminology = Object.assign(defaultTerminology, terminology || {});

      const defaultCompanyMeta = {
        brand_name: name.trim(),
        support_email: `support@${cleanSlug}.com`,
        copyright_text: `${name.trim()} © 2026 • Enterprise Operations Suite`
      };
      const finalCompanyMeta = Object.assign(defaultCompanyMeta, companyMeta || {});

      await conn.query(
        `INSERT INTO tenant_config (tenant_id, terminology_json, company_meta_json, storage_quota_mb) VALUES (?, ?, ?, ?)`,
        [newTenantId, JSON.stringify(finalTerminology), JSON.stringify(finalCompanyMeta), req.body.storageQuotaMb || 5000]
      );

      await conn.commit();
      invalidateTenantCache(cleanSlug);

      res.status(201).json({
        success: true,
        message: `Tenant "${name}" created successfully.`,
        tenantId: newTenantId,
        slug: cleanSlug
      });
    } catch (err) {
      await conn.rollback();
      console.error('[SaaS Tenants] Error creating tenant:', err);
      res.status(500).json({ error: 'Could not create tenant.' });
    } finally {
      conn.release();
    }
  });

  // 4. Update Existing Tenant
  app.put('/api/saas/tenants/:id', requireRole('SuperAdmin'), async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const tenantId = req.params.id;
      const { name, customDomain, status, plan, theme, features, terminology, companyMeta, storageQuotaMb } = req.body;

      const [existing] = await conn.query(`SELECT * FROM tenants WHERE id = ? LIMIT 1`, [tenantId]);
      if (!existing.length) return res.status(404).json({ error: 'Tenant not found.' });

      const current = existing[0];

      if (customDomain && customDomain.trim().toLowerCase() !== (current.custom_domain || '').toLowerCase()) {
        const [dupDomain] = await conn.query(`SELECT id FROM tenants WHERE custom_domain = ? AND id != ? LIMIT 1`, [customDomain.trim().toLowerCase(), tenantId]);
        if (dupDomain.length) return res.status(409).json({ error: `Domain "${customDomain}" is already used by another tenant.` });
      }

      await conn.beginTransaction();

      // Update tenant
      await conn.query(
        `UPDATE tenants SET name = COALESCE(?, name), custom_domain = ?, status = COALESCE(?, status), plan = COALESCE(?, plan) WHERE id = ?`,
        [name ? name.trim() : current.name, customDomain ? customDomain.trim().toLowerCase() : null, status || current.status, plan || current.plan, tenantId]
      );

      // Update theme if provided
      if (theme) {
        await conn.query(
          `INSERT INTO tenant_themes (
            tenant_id, primary_color, secondary_color, accent_color, bg_color, sidebar_bg, sidebar_text,
            card_radius, card_shadow, font_family, logo_url, favicon_url, login_banner_url, css_custom_overrides
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            primary_color = VALUES(primary_color),
            secondary_color = VALUES(secondary_color),
            accent_color = VALUES(accent_color),
            bg_color = VALUES(bg_color),
            sidebar_bg = VALUES(sidebar_bg),
            sidebar_text = VALUES(sidebar_text),
            card_radius = VALUES(card_radius),
            card_shadow = VALUES(card_shadow),
            font_family = VALUES(font_family),
            logo_url = VALUES(logo_url),
            favicon_url = VALUES(favicon_url),
            login_banner_url = VALUES(login_banner_url),
            css_custom_overrides = VALUES(css_custom_overrides)`,
          [
            tenantId,
            theme.primaryColor || '#008080',
            theme.secondaryColor || '#005a5a',
            theme.accentColor || '#e5a93c',
            theme.bgColor || '#0b1320',
            theme.sidebarBg || '#070d18',
            theme.sidebarText || '#ffffff',
            theme.cardRadius || '12px',
            theme.cardShadow || '0 8px 24px rgba(0, 0, 0, 0.35)',
            theme.fontFamily || "'Segoe UI', system-ui, sans-serif",
            theme.logoUrl || null,
            theme.faviconUrl || null,
            theme.loginBannerUrl || null,
            theme.customCss || null
          ]
        );
      }

      // Update features if provided
      if (features) {
        await conn.query(
          `INSERT INTO tenant_features (
            tenant_id, inventory_enabled, gst_invoicing, multi_branch, export_reports,
            bom_enabled, serial_tracking, vouchers_enabled, custom_flags_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            inventory_enabled = VALUES(inventory_enabled),
            gst_invoicing = VALUES(gst_invoicing),
            multi_branch = VALUES(multi_branch),
            export_reports = VALUES(export_reports),
            bom_enabled = VALUES(bom_enabled),
            serial_tracking = VALUES(serial_tracking),
            vouchers_enabled = VALUES(vouchers_enabled),
            custom_flags_json = VALUES(custom_flags_json)`,
          [
            tenantId,
            features.inventoryEnabled !== false ? 1 : 0,
            features.gstInvoicing !== false ? 1 : 0,
            features.multiBranch ? 1 : 0,
            features.exportReports !== false ? 1 : 0,
            features.bomEnabled !== false ? 1 : 0,
            features.serialTracking !== false ? 1 : 0,
            features.vouchersEnabled !== false ? 1 : 0,
            features.customFlags ? JSON.stringify(features.customFlags) : null
          ]
        );
      }

      // Update config if provided
      if (terminology || companyMeta || storageQuotaMb !== undefined) {
        await conn.query(
          `INSERT INTO tenant_config (tenant_id, terminology_json, company_meta_json, storage_quota_mb)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             terminology_json = COALESCE(VALUES(terminology_json), terminology_json),
             company_meta_json = COALESCE(VALUES(company_meta_json), company_meta_json),
             storage_quota_mb = COALESCE(VALUES(storage_quota_mb), storage_quota_mb)`,
          [
            tenantId,
            terminology ? JSON.stringify(terminology) : null,
            companyMeta ? JSON.stringify(companyMeta) : null,
            storageQuotaMb || 5000
          ]
        );
      }

      await conn.commit();
      invalidateTenantCache(tenantId);
      invalidateTenantCache(current.slug);

      res.json({ success: true, message: `Tenant "${current.name}" updated successfully.` });
    } catch (err) {
      await conn.rollback();
      console.error('[SaaS Tenants] Error updating tenant:', err);
      res.status(500).json({ error: 'Could not update tenant.' });
    } finally {
      conn.release();
    }
  });

  // 5. Delete / Deactivate Tenant
  app.delete('/api/saas/tenants/:id', requireRole('SuperAdmin'), async (req, res) => {
    try {
      const tenantId = req.params.id;
      if (tenantId === DEFAULT_TENANT_ID) {
        return res.status(400).json({ error: 'The primary default tenant cannot be deleted.' });
      }

      const [existing] = await pool.query(`SELECT slug FROM tenants WHERE id = ? LIMIT 1`, [tenantId]);
      if (!existing.length) return res.status(404).json({ error: 'Tenant not found.' });

      await pool.query(`DELETE FROM tenants WHERE id = ?`, [tenantId]);
      invalidateTenantCache(tenantId);
      invalidateTenantCache(existing[0].slug);

      res.json({ success: true, message: 'Tenant removed successfully.' });
    } catch (err) {
      console.error('[SaaS Tenants] Error deleting tenant:', err);
      res.status(500).json({ error: 'Could not delete tenant.' });
    }
  });
}

module.exports = registerSaaSTenantsRoutes;
