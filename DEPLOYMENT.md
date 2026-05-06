# Déploiement Cabine 2.0

## Options de déploiement

### 1) Render

Render est déjà configuré via `render.yaml`.

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Port: `3000`

Variables d'environnement importantes:
- `NODE_ENV=production`
- `GENIUSPAY_MODE` (sandbox ou live)
- `GENIUSPAY_PK`
- `GENIUSPAY_SK`
- `GENIUSPAY_API_KEY`
- `GENIUSPAY_WALLET_ID`
- `GENIUSPAY_WEBHOOK_SECRET`
- `DATABASE_URL` (optionnel, PostgreSQL)

### 2) Docker

Construire l'image:

```bash
docker build -t cabine-2-0 .
```

Lancer le container:

```bash
docker run -d -p 3000:3000 --env NODE_ENV=production \
  --env GENIUSPAY_MODE=sandbox \
  --env GENIUSPAY_PK=... \
  --env GENIUSPAY_SK=... \
  --env GENIUSPAY_API_KEY=... \
  --env GENIUSPAY_WALLET_ID=... \
  --env GENIUSPAY_WEBHOOK_SECRET=... \
  cabine-2-0
```

### 3) Vercel

Vercel est configuré pour servir le frontend statique depuis `dist` et router `/api/*` vers `server.js`.

- Assurez-vous que `vercel.json` est présent.
- Déployez avec `vercel` ou via GitHub.

## Vérification post-déploiement

- Ouvrir `/api/health` pour vérifier l’état du service.
- Ouvrir l’application pour vérifier le dashboard et l’API.

## Notes techniques

- Le backend sert déjà les fichiers statiques construits dans `dist`.
- L’API supporte désormais des filtres avancés et un export CSV.
- Les headers de sécurité sont appliqués pour un usage production.
