# Eco Green Solar ERP — Web (Render Docker deploy)
# Needed so LibreOffice headless (Excel -> PDF for Challan printing) is
# available in production — Render's default Node buildpack does not
# include it.
FROM node:20-slim

# LibreOffice headless — only the 'calc' component + dependencies needed
# for xlsx->pdf conversion, not the full office suite, to keep image small.
# libreoffice-core is listed explicitly (not just relied on as a transitive
# dependency) because it's the package that actually provides the `soffice`
# binary/wrapper — --no-install-recommends can otherwise leave it out on
# some base images. The `which soffice` check at the end makes the BUILD
# itself fail loudly if the binary isn't on PATH, instead of silently
# deploying a broken image that only errors when someone clicks Print.
# fonts-crosextra-carlito / -caladea are pixel-metric-compatible substitutes
# for Calibri / Cambria (Excel's default fonts), and fonts-liberation covers
# Arial/Times New Roman/Courier New. Without these, node:20-slim has no match
# for the template's font, so LibreOffice falls back to a generic font with
# different character widths than what's used locally — at a fixed manual
# print scale (see challanPdf.js SHEET_CONFIG.page.scale), this is what was
# causing content to overflow onto a second page only on Render, never
# locally where a proper font (or its correct substitute) is already present.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-calc \
    libreoffice-core \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/* \
    && which soffice \
    && soffice --version

WORKDIR /app

# Root package.json (frontend has none to install, just static files)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# api/ has its own package.json (per AI_CONTEXT.md's api/package.json note)
COPY api/package.json api/package-lock.json* ./api/
RUN cd api && npm install --omit=dev

COPY . .

ENV PORT=5000
ENV SOFFICE_PATH=soffice
ENV HOME=/tmp
EXPOSE 5000

CMD ["node", "api/server.js"]
