# CRM Client

CRM simple, prêt à l’emploi : contacts, entreprises, pipeline et actions. Personnalisable avec Cursor ou Claude Code, déployable sur Railway à partir du Dockerfile.

## Démarrage local (Docker)

Aucune configuration manuelle n’est requise :

```bash
docker compose up --build
```

Ouvrez [http://localhost:3000](http://localhost:3000).

Le token MCP de développement est `dev-mcp-token-change-me` (défini dans `docker-compose.yml`).

## Démarrage local (Node)

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Modifiez `MCP_TOKEN` dans `.env` avant tout usage réel.

## Fonctionnalités

- Contacts : création, modification, suppression, recherche et filtre par statut
- Entreprises : fiche et contacts rattachés
- Pipeline : colonnes Lead / Contacté / RDV / Client / Perdu (glisser-déposer)
- Actions liées à un contact : note, appel, e-mail, rendez-vous — création, démarrage, clôture
- API REST sous `/api/contacts`, `/api/companies`, `/api/actions`
- MCP sous `/api/mcp` (Bearer token)

## MCP

Authentification : header `Authorization: Bearer <MCP_TOKEN>`.

Sans token valide, la route répond `401`.

Exemples :

```bash
# Santé de la route (token requis)
curl -H "Authorization: Bearer $MCP_TOKEN" http://localhost:3000/api/mcp

# Liste des outils
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Outils exposés : `list_contacts`, `create_contact`, `update_contact_status`, `add_note`.

## Déploiement Railway

1. Dupliquez ce dépôt pour le client
2. Connectez le dépôt GitHub à Railway (Dockerfile détecté automatiquement)
3. Ajoutez un volume persisté monté sur `/data`
4. Variables d’environnement :
   - `DATABASE_URL=file:/data/crm.db`
   - `MCP_TOKEN=` une valeur longue et aléatoire
5. Un push sur `main` redéploie automatiquement

## Structure

```
app/api/          routes REST et MCP
app/(dashboard)/  interface
prisma/           schéma SQLite et migrations
lib/              Prisma + helpers (auth MCP, labels)
Dockerfile        image de production (Railway)
docker-compose.yml usage local
```

## Personnalisation (pour l’IA)

- Rester sur les patterns Next.js App Router
- Prisma comme unique accès aux données (pas de SQL brut)
- Toute nouvelle route API suit `/app/api/<ressource>/route.ts`
- Ne jamais committer de token : uniquement des variables d’environnement
- Pas de service externe supplémentaire sans validation
