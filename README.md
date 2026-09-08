# CRM Client

CRM simple, prêt à l’emploi : contacts, entreprises, actions et statistiques. Personnalisable avec Cursor ou Claude Code, déployable sur Railway à partir du Dockerfile.

## Démarrage local (Docker)

```bash
docker compose up --build
```

Ouvrez [http://localhost:3000](http://localhost:3000).

- Connexion UI : `admin@example.com` / `admin123!` (variables `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Token MCP de développement : `dev-mcp-token-change-me`

## Démarrage local (Node)

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Modifiez `MCP_TOKEN` et `AUTH_SECRET` dans `.env` avant tout usage réel.

## Fonctionnalités

- **Auth UI** : session cookie (JWT) ; pages et API protégées sauf `/login`, `/api/health`, `/api/auth/login`, `/api/mcp`
- **Contacts** : liste / kanban, filtres catégorie & état (taxonomie MeetMagnet), side peek Infos / Actions
- **Entreprises** : liste + side peek Informations / Notes / Contacts
- **Actions** : vue globale liste / kanban (À faire / En cours / Terminé)
- **Statistiques** : stocks par catégorie / état, retards, historique d’états
- **API REST** sous `/api/contacts`, `/api/companies`, `/api/actions`
- **MCP** sous `/api/mcp` (Bearer `MCP_TOKEN`)

## MCP

Authentification : header `Authorization: Bearer <MCP_TOKEN>`.

Outils : `list_contacts`, `create_contact`, `update_contact_state`, `list_actions`, `add_note`.

## Déploiement Railway

1. Dupliquez ce dépôt pour le client
2. Connectez le dépôt GitHub à Railway (Dockerfile détecté automatiquement)
3. Ajoutez un volume persisté monté sur `/data`
4. Variables d’environnement :
   - `DATABASE_URL=file:/data/crm.db`
   - `MCP_TOKEN=` valeur longue et aléatoire
   - `AUTH_SECRET=` valeur longue et aléatoire
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` (premier seed)
5. Un push sur `main` redéploie automatiquement

## Structure

```
app/api/          routes REST, auth et MCP
app/(dashboard)/  interface (contacts, entreprises, actions, stats)
app/login/        connexion UI
prisma/           schéma SQLite et migrations
lib/              Prisma, auth, labels, helpers
middleware.ts     protection session UI
Dockerfile        image de production (Railway)
docker-compose.yml usage local
```

## Personnalisation (pour l’IA)

- Rester sur les patterns Next.js App Router
- Prisma comme unique accès aux données (pas de SQL brut)
- Toute nouvelle route API suit `/app/api/<ressource>/route.ts`
- Ne jamais committer de token : uniquement des variables d’environnement
- Pas de service externe supplémentaire sans validation
- Taxonomie contacts alignée MeetMagnet (catégorie + état)
