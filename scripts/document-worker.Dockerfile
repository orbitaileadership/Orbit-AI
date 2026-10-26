FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-writer libreoffice-impress libreoffice-calc poppler-utils fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY scripts/document-worker.mjs ./scripts/document-worker.mjs
RUN useradd --system --create-home orbit && chown -R orbit:orbit /app
USER orbit
ENV HOME=/tmp NODE_OPTIONS=--max-old-space-size=512
CMD ["node", "scripts/document-worker.mjs"]
