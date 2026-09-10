# Guide CRM Client

Ce guide est pour des personnes **qui ne connaissent pas le code**.

Objectif : avoir **votre propre CRM en ligne**, puis le faire évoluer avec **Claude** ou **Cursor**.

Suivez les étapes **dans l’ordre**.

---

## 1. Ce que vous allez obtenir

Un CRM privé avec :

- Contacts (liste + kanban)
- Entreprises
- Actions à faire
- Statistiques
- Connexion sécurisée (login / mot de passe)
- Possibilité de brancher Claude ou Cursor pour lire / modifier les données

Temps estimé pour le premier déploiement : **15 à 30 minutes**.

---

## 2. Comptes à créer (une seule fois)

Avant de commencer, créez ces comptes (gratuits au départ) :

1. **GitHub** → [https://github.com](https://github.com)  
   Sert à stocker une copie du projet.
2. **Railway** → [https://railway.app](https://railway.app)  
   Sert à héberger le CRM en ligne (comme un “hébergeur automatique”).
3. (Optionnel) **Cursor** → [https://cursor.com](https://cursor.com)  
   Éditeur d’IA pour modifier le projet.
4. (Optionnel) **Claude** → [https://claude.ai](https://claude.ai)  
   Assistant IA, utile une fois le CRM en ligne.

Vous n’avez **pas besoin** d’installer quoi que ce soit sur votre ordinateur pour déployer.

---

## 3. Dupliquer le projet (Fork)

Le dépôt d’origine est un **modèle**.  
Vous devez en faire **votre copie**, sinon vos changements écraseraient le modèle commun.

### Étapes

1. Ouvrez le dépôt GitHub du CRM template.
2. Cliquez sur le bouton **Fork** (en haut à droite).
3. Laissez les options par défaut.
4. Validez.

Résultat : vous avez maintenant un dépôt du type  
`https://github.com/VOTRE-NOM/crm-template`

C’est **votre** projet. Travaillez toujours dessus.

Astuce : dans GitHub, vous pouvez ensuite renommer le dépôt (Settings → General → Repository name), par exemple `mon-crm`.

---

## 4. Déployer sur Railway

### 4.1 Créer le service

1. Allez sur [https://railway.app](https://railway.app) et connectez-vous.
2. Cliquez sur **New Project**.
3. Choisissez **Deploy from GitHub repo**.
4. Autorisez Railway à accéder à GitHub si demandé.
5. Sélectionnez **votre fork** (pas le dépôt d’origine).
6. Lancez le déploiement.

Railway détecte automatiquement le `Dockerfile`. Laissez-le faire.

### 4.2 Ajouter un volume (très important)

Sans volume, vos données peuvent être **effacées** à chaque redéploiement.

1. Ouvrez votre service Railway.
2. Allez dans **Settings** (ou l’onglet Volume selon l’interface).
3. Ajoutez un **Volume**.
4. Point de montage (Mount path) : `/data`

### 4.3 Générer une adresse web

1. Dans le service, ouvrez **Settings → Networking / Public Networking**.
2. Cliquez sur **Generate Domain**.
3. Notez l’URL, du type :  
   `https://mon-crm-production.up.railway.app`

### 4.4 Ajouter les variables d’environnement

Dans Railway → votre service → **Variables**, ajoutez :

| Variable | Que mettre ? | Exemple |
|---|---|---|
| `MCP_TOKEN` | Une longue phrase secrète aléatoire | `crm-mcp-K9xP2mQ7vL4nR8wY` |
| `AUTH_SECRET` | Une autre longue phrase secrète | `crm-auth-H3bT6cF1jN9sD2qA` |
| `ADMIN_EMAIL` | L’email de connexion admin | `vous@entreprise.com` |
| `ADMIN_PASSWORD` | Un mot de passe fort | `MotDePasseFort123!` |

Notes simples :

- `DATABASE_URL` est déjà géré par Docker (`file:/data/crm.db`) : **vous n’avez en général rien à ajouter**.
- Ne partagez jamais `MCP_TOKEN`, `AUTH_SECRET` ni `ADMIN_PASSWORD`.
- Après avoir modifié les variables, **redéployez** (Redeploy) si Railway ne le fait pas tout seul.

### 4.5 Vérifier que ça marche

1. Ouvrez l’URL publique Railway.
2. Vous devez arriver sur la page de connexion.
3. Connectez-vous avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
4. Vous devez voir la page **Contacts**.

Si la page ne charge pas : attendez 1–2 minutes (premier build), puis regardez les **Logs** Railway.

---

## 5. Première utilisation du CRM

Menu de gauche :

- **Contacts** : vos interlocuteurs (liste ou kanban)
- **Entreprises** : les sociétés
- **Actions** : tâches / appels / emails / RDV
- **Statistiques** : vue d’ensemble

Gestes utiles :

- Cliquez sur un contact → panneau latéral (fiche)
- Bouton **Nouveau contact** pour créer
- Passez en vue **Kanban** pour faire glisser les contacts d’état en état

Changez le mot de passe admin dès que possible (demandez à Cursor/Claude de vous ajouter une page “changer mon mot de passe” si besoin).

---

## 6. Travailler avec Cursor (recommandé pour modifier le CRM)

Cursor permet de dire en français :  
« Ajoute un champ LinkedIn sur les entreprises »  
…et l’IA fait les changements dans le code.

### 6.1 Ouvrir votre projet

1. Installez Cursor.
2. Connectez votre compte GitHub dans Cursor si demandé.
3. Clonez / ouvrez **votre fork**.
4. Ouvrez le chat Agent.

### 6.2 Exemples de demandes

- « Ajoute un bouton Exporter les contacts en CSV »
- « Sur la fiche contact, ajoute un champ LinkedIn »
- « Change le nom affiché en Mon CRM Entreprise »
- « Ajoute un filtre par source sur la page Contacts »

### 6.3 Publier vos changements

En résumé :

1. Cursor modifie les fichiers.
2. Vous demandez : « Commit et push sur main ».
3. Railway redéploie automatiquement.
4. Rechargez votre URL CRM.

Règle d’or : ne demandez **jamais** à l’IA de mettre des mots de passe ou tokens en dur dans le code. Toujours via les variables Railway.

---

## 7. Brancher Claude (connecteur MCP)

Le CRM expose une “prise” appelée **MCP**.  
Claude peut s’y brancher pour lister/créer des contacts, etc.

### 7.1 Ce qu’il vous faut

- L’URL publique de votre CRM  
  Exemple : `https://mon-crm-production.up.railway.app`
- Votre `MCP_TOKEN` (celui mis dans Railway)

Adresse MCP :

```text
https://VOTRE-URL-RAILWAY/api/mcp
```

### 7.2 Brancher dans Claude

Selon l’interface Claude (Connectors / MCP / Custom tools) :

1. Ajoutez un connecteur personnalisé.
2. URL : `https://VOTRE-URL-RAILWAY/api/mcp`
3. Authentification : **Bearer Token**
4. Token : votre `MCP_TOKEN`

### 7.3 Ce que Claude peut faire (outils inclus)

- Lister les contacts
- Créer un contact
- Changer l’état d’un contact
- Lister les actions
- Ajouter une note

Exemple de demande à Claude une fois branché :

> Liste mes contacts en catégorie prospect.

Si Claude répond “401 / non autorisé” : le token est faux ou mal collé.

---

## 8. Brancher Cursor en MCP

Dans Cursor, vous pouvez aussi ajouter le serveur MCP du CRM :

1. Ouvrez les réglages MCP de Cursor.
2. Ajoutez un serveur avec l’URL `https://VOTRE-URL-RAILWAY/api/mcp`.
3. Mettez le header d’auth Bearer avec votre `MCP_TOKEN`.
4. Testez avec : « Liste les contacts du CRM ».

Même principe que Claude : Cursor devient capable d’agir sur **vos données en ligne**, pas seulement sur le code.

---

## 9. Ajouter d’autres connecteurs / intégrations

Par défaut, le template reste volontairement simple (pas de Gmail, LinkedIn, Stripe, etc.).

Pour en ajouter un :

1. Ouvrez le projet dans Cursor.
2. Demandez clairement, par exemple :  
   « Ajoute une intégration Gmail pour créer une action quand je reçois un email d’un contact. »
3. L’IA vous demandera souvent une clé API → ajoutez-la dans Railway → Variables.
4. Commit + push → Railway redéploie.

Bonnes pratiques :

- Une intégration à la fois
- Toujours stocker les secrets dans Railway (jamais dans le chat public / README)
- Tester après chaque ajout

---

## 10. Mettre à jour le CRM au quotidien

Workflow simple :

1. Décrivez le besoin à Cursor / Claude Code.
2. Vérifiez le résultat (localement si possible, ou directement en prod).
3. Commit + push sur `main`.
4. Railway reconstruit et publie.
5. Rechargez le site.

Si quelque chose casse : regardez les **Logs** Railway, puis demandez à Cursor :  
« Voici l’erreur des logs, corrige. »

---

## 11. Sécurité (à lire une fois)

- Ne publiez jamais `MCP_TOKEN`, `AUTH_SECRET`, `ADMIN_PASSWORD`.
- Donnez l’accès GitHub/Railway seulement aux personnes de confiance.
- Changez les secrets dès la mise en production.
- Le login protège l’interface web ; le `MCP_TOKEN` protège l’accès IA.

---

## 12. Problèmes fréquents

### “Je n’arrive pas à me connecter”
- Vérifiez `ADMIN_EMAIL` / `ADMIN_PASSWORD` dans Railway.
- Redéployez après modification des variables.
- Videz le cache / essayez une fenêtre privée.

### “Mes données ont disparu”
- Le volume `/data` n’est probablement pas monté.
- Ajoutez-le, puis redéployez.

### “Claude / Cursor ne se connecte pas au CRM”
- Vérifiez l’URL : elle doit finir par `/api/mcp`
- Vérifiez le Bearer token = `MCP_TOKEN`
- Vérifiez que le service Railway est bien “Online”

### “Le site est blanc / erreur 502”
- Attendez la fin du build.
- Ouvrez les Logs Railway et copiez l’erreur à Cursor.

---

## 13. Pour les plus à l’aise (optionnel, en local)

Si vous voulez tester sur votre PC avant Railway :

```bash
docker compose up --build
```

Puis ouvrez [http://localhost:3000](http://localhost:3000).

Identifiants de démo Docker :

- Email : `admin@example.com`
- Mot de passe : `admin123!`
- Token MCP démo : `dev-mcp-token-change-me`

---

## 14. Récapitulatif express

1. Fork GitHub  
2. Déployer sur Railway  
3. Volume `/data`  
4. Domaine public  
5. Variables `MCP_TOKEN`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`  
6. Se connecter au CRM  
7. Brancher Claude / Cursor via `/api/mcp`  
8. Demander des évolutions à Cursor, puis push

Vous êtes prêt.
