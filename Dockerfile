# Eco Green Solar ERP — Web (Render Docker deploy)
# Needed so LibreOffice headless (Excel -> PDF for Challan printing) is
# available in production — Render's default Node buildpack does not
# include it.
FROM node:20-slim

# LibreOffice headless — only the 'calc' component + dependencies needed
# for xlsx->pdf conversion, not the full office suite, to keep image small.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-calc \
    && rm -rf /var/lib/apt/lists/*

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
EXPOSE 5000

CMD ["node", "api/server.js"]
