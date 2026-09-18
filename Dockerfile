# Ein Container für Frontend und Backend (z. B. für Google Cloud Run)

# Schritt 1: React-Frontend bauen
FROM node:20-slim AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY public ./public
COPY src ./src
RUN npm run build

# Schritt 2: Backend, das auch das gebaute Frontend ausliefert
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Europe/Berlin
COPY server/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=frontend /app/build ./public

# Cloud Run setzt PORT automatisch, lokal ist es 8080
EXPOSE 8080
CMD ["node", "server.mjs"]
