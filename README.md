# TAC-TIK

Jeu de plateau web pour 2, 3, 4, 6 ou 8 joueurs. Salons privés, chat, humains et bots, Joker et sauvegarde en ligne. Le plateau SVG reprend les chemins, maisons, réserves et panneaux rectangulaires de la photo fournie. Les cartes et la validation restent dans le même panneau.

**Site déjà publié :** lire [UPGRADE.md](docs/UPGRADE.md) pour appliquer la deuxième migration et corriger la configuration Vercel/Supabase. Le mode solo est utilisable sans service externe. La nouvelle version du multijoueur exige encore la migration et une recette sur le service configuré.

## Démarrer

Node.js 22 ou supérieur et npm.

```sh
npm ci
npm run dev
```

Ouvrir `http://127.0.0.1:3000`. Choisir le nombre de joueurs puis **Jouer contre des bots**, ou créer/rejoindre un salon connecté. Sous PowerShell, utiliser `npm.cmd` si `npm.ps1` est bloqué.

## Fonctionnalités

- A 2/3, deux couleurs par joueur. A 4/6/8, équipes de deux aux places opposées.
- Pieux, démarrage, captures, recul, permutation, 7 fractionné, maisons, aide au partenaire et victoire.
- 1 Joker par paquet, activé par défaut pour les nouveaux salons. Il remplace une carte ordinaire annoncée. Deux paquets à 8 joueurs : 98 cartes avec Jokers, 96 sans.
- Défausse complète si tous les pions contrôlés sont en réserve, sans 1, 10 ou Joker. Un pion sur le parcours interdit cette option, y compris derrière un pieu.
- Bots locaux en solo, ou bots côté serveur ajoutés aux places libres du salon avant le début. Ils ne voient pas les cartes adverses.
- Chat réservé aux membres, 500 caractères par message, 12 envois/minute/utilisateur. Les 100 derniers messages sont conservés et les 50 derniers affichés.
- Main, valeur du Joker, choix du pion, déplacement et validation regroupés. Vue mobile limitée à la hauteur de la fenêtre ; plateau agrandissable.
- Invitations par code ou lien, sauvegarde atomique et reprise avec la même session navigateur.

## Architecture

```text
src/
  app/
    api/game/route.ts       Origine, auth, quotas, limite de corps, validation
    page.tsx               Page dynamique pour le nonce CSP
    layout.tsx             Métadonnées et langue
    globals.css            Interface responsive
  components/
    game-app.tsx           Connexion, salons, synchronisation et mode solo
    turn-controls.tsx      Main, Joker, composition et validation du coup
    board.tsx              Plateau SVG et pions accessibles
    chat.tsx               Messages, envoi idempotent et erreurs
  game/
    types.ts               Types du jeu
    engine.ts              Règles pures, coups légaux et projection privée
    bots.ts                Décisions depuis la seule projection du bot
    board-layout.ts        Coordonnées des panneaux, chemins et maisons
    labels.ts              Libellés et couleurs
    room.ts                Contrats des salons et messages
  server/
    schema.ts              Commandes Zod strictes
    store.ts               Stockage, RNG cryptographique, CAS et chat
    origin.ts              Validation de l'origine configurée
  lib/
    supabase.ts            Client Auth/Realtime
    game-api.ts            Requêtes authentifiées et erreurs HTTP
    auth-errors.ts         Diagnostics sans données sensibles
    config.ts              Validation de l'URL publique
  proxy.ts                 CSP à nonce
supabase/migrations/        Schéma initial puis migration chat/bots
tests/                      Moteur, contrat HTTP, géométrie et conventions
tests/integration/          Permissions réelles et concurrence Supabase
scripts/check-config.mjs    Diagnostic sans afficher clés ni données de parties
docs/                      Architecture, règles, sécurité, déploiement et tests
AGENTS.md                  Instructions de contribution
```

Le navigateur envoie une intention. Le serveur vérifie identité, appartenance, tour, cartes et règles. Il sauvegarde avec une comparaison atomique de version, puis renvoie la projection du joueur. Realtime ne publie que code, version et compteur de chat, jamais les mains, la pioche ou les messages.

## Configuration

Pour une première installation, suivre [DEPLOYMENT.md](docs/DEPLOYMENT.md). Pour le site existant, suivre [UPGRADE.md](docs/UPGRADE.md). Les deux migrations sont nécessaires, dans l'ordre ; ne pas réexécuter la première si elle est déjà appliquée.

Copier `.env.example` vers `.env.local` seulement si le fichier local n'existe pas. Ne jamais placer des secrets dans le fichier d'exemple, même temporairement.

| Variable                         | Usage                                                                  |
| -------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`       | Project URL, `https://<référence>.supabase.co`, pas le dashboard       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Clé publique du projet                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`      | Clé serveur uniquement                                                 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key publique du CAPTCHA                                           |
| `APP_ORIGIN`                     | Origine exacte : locale en développement, domaine Vercel en production |
| `RATE_LIMIT_SECRET`              | Secret aléatoire d'au moins 32 caractères pour le HMAC des quotas      |

Le secret Turnstile se renseigne dans Supabase Auth. Activer les connexions anonymes **et** autoriser les nouvelles inscriptions. Vérifier le domaine autorisé dans Turnstile. Redéployer après une modification des variables publiques.

## Vérifications

```sh
npm run check
npm run build
npm run format:check
npm audit --audit-level=high
```

Diagnostic de configuration en lecture seule : `node --env-file=.env.local scripts/check-config.mjs`. Les tests d'intégration décrits dans [TESTING.md](docs/TESTING.md) doivent être exécutés sur un Supabase de test, pas automatiquement sur la production.

## Limites

- Pas de TOCK ni carte 13. Les 12 cartes ordinaires sont présentes en quatre exemplaires par paquet ; le Joker supplémentaire a été confirmé par le propriétaire.
- Pas de matchmaking public, spectateurs, expulsion ou remplacement en cours de partie.
- Les bots en ligne avancent tant qu'un membre est connecté. Ils reprennent au retour des joueurs, sans processus permanent Vercel.
- La session anonyme appartient au navigateur. Effacer son stockage fait perdre sa place ; le pseudo ne sert jamais de preuve d'identité.
- Les salons expirent sept jours après création ; planifier la purge décrite dans le guide. Les messages sont supprimés avec le salon.
- Le mode solo est réinitialisé par une actualisation.
- La disposition à 8 prolonge le panneau central selon la logique du plateau. Aucune photo de l'extension à 8 n'a été fournie.

Le code et les visuels sont une adaptation indépendante. Lire [SECURITY.md](docs/SECURITY.md) pour les protections et limites. Aucun résultat de test local ne remplace la vérification du CAPTCHA et des permissions du déploiement réel.
