# =============================================
# STAGE 1 — Build (Node + toutes les dépendances)
# =============================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# =============================================
# STAGE 2 — Production (dépendances runtime seulement)
# =============================================
FROM node:20-alpine

WORKDIR /app

# Dépendances runtime uniquement
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Fichiers de l'application
COPY server.js ./
COPY --from=builder /app/dist ./dist

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
