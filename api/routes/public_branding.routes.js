// Eco Green Solar ERP - Public Tenant Branding API Routes
const express = require('express');

function registerPublicBrandingRoutes(app) {
  // Public endpoint to fetch tenant branding and white-label tokens before authentication
  app.get('/api/public/tenant-branding', (req, res) => {
    try {
      const tenant = req.tenant;
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant configuration not found.' });
      }

      res.json({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        customDomain: tenant.customDomain,
        status: tenant.status,
        plan: tenant.plan,
        theme: tenant.theme,
        features: tenant.features,
        terminology: tenant.terminology,
        companyMeta: tenant.companyMeta
      });
    } catch (err) {
      console.error('[Public Branding API] Error:', err);
      res.status(500).json({ error: 'Failed to retrieve tenant branding.' });
    }
  });
}

module.exports = registerPublicBrandingRoutes;
