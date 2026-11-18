# TacTik

Une table de TAC-TIK dans le navigateur : salons privés, cartes personnelles, parties à 2, 3, 4 ou 6 joueurs, et entraînement local avec joueurs automatiques. Interface française, plateau SVG dessiné pour le projet, couleurs bois, sauge et corail.

**État : première version implémentée.** Le mode local fonctionne sans service externe. Le multijoueur nécessite un projet Supabase et un déploiement Vercel configurés. Il n’a pas encore été validé contre un véritable projet Supabase ; les tests d’intégration fournis et la recette à plusieurs navigateurs sont nécessaires avant ouverture publique. Aucun compte externe ni déploiement n’a été créé automatiquement.

## Démarrage rapide

Prérequis : Node.js 22 ou plus récent, npm et, pour publier, un dépôt Git et les comptes Vercel/Supabase/Cloudflare Turnstile.

```sh
npm ci
npm run dev
```

Ouvrir `http://localhost:3000`, choisir le nombre de joueurs et cliquer sur **Essayer avec des joueurs automatiques**. Pas de variables requises pour ce mode. Les robots sont des partenaires d’entraînement simples, pas une IA stratégique. Une actualisation réinitialise l’entraînement.

Pour tester une compilation de production :

```sh
npm run check
npm run build
npm start
```

Sous Windows, utiliser `npm.cmd` si la stratégie PowerShell bloque `npm.ps1`.

## Fonctionnalités

- Création d’un salon par pseudo, capacité fixe, invitation par code de 12 caractères hexadécimaux ou lien.
- Les places sont attribuées par ordre d’arrivée. À 4/6, les partenaires sont opposés. À 2/3, chacun contrôle deux couleurs.
- Seul l’hôte peut commencer, et uniquement lorsque toutes les places sont occupées.
- Distribution, échange simultané secret, jeu obligatoire, défausse lorsqu’aucune carte n’est jouable.
- Pieux protégés et bloquants, capture, recul, permutation, maisons, 7 fractionné, aide au partenaire et victoire.
- Aide aux coups : choisir une carte, un pion, puis son déplacement ; composer les déplacements du 7 avant confirmation.
- Sauvegarde de chaque action en base, notification Realtime privée et resynchronisation de secours toutes les 15 secondes lorsque l’onglet est visible.
- Reconnexion : reprise automatique en rouvrant le lien avec le même navigateur et sa session Supabase, ou saisie du code pour rejoindre à nouveau. Le pseudo ne sert jamais de preuve d’identité.

## Architecture

```text
src/
  app/
    layout.tsx              Métadonnées, langue, styles
    page.tsx                Page dynamique (nonce CSP par requête)
    globals.css             Design responsive, sans police ni image externe
    api/game/route.ts       Frontière HTTP : origine, auth, limites, validation
  components/
    game-app.tsx            Accueil, salon, main, composition des coups, mode local
    board.tsx               Plateau SVG accessible et pions
  game/
    types.ts                Modèle de jeu et projection privée
    engine.ts               Règles pures, coups légaux, transitions, projection
    room.ts                 Contrats du salon
  lib/supabase.ts           Client navigateur : identité et notifications
  server/
    schema.ts               Contrats Zod stricts pour les commandes
    store.ts                Accès serveur, RNG cryptographique, CAS, quotas
  proxy.ts                  CSP avec nonce, absence de scripts inline arbitraires
supabase/migrations/        Schéma SQL, RLS, fonctions atomiques, publication
tests/                      Tests des règles et validation des entrées
tests/integration/          Vérification réelle RLS, RPC, concurrence et quotas
docs/
  DEPLOYMENT.md             Configuration Supabase, Turnstile et Vercel
  ARCHITECTURE.md           Flux, invariants, décisions et modèle de données
  RULES.md                  Traduction des règles et hypothèses explicites
  SECURITY.md               Modèle de menace, protections et limites
  TESTING.md                Commandes, recette et état des vérifications
AGENTS.md                   Guide de contribution pour agents et développeurs
```

Le navigateur envoie une **intention** ; le serveur authentifie le joueur, relit la partie, vérifie les règles, puis enregistre l’état avec une comparaison de version atomique. Il renvoie uniquement la projection du joueur. Realtime transmet `{room_code, version}` : jamais de pioche ni de main.

## Mise en ligne

Suivre [le guide de déploiement](docs/DEPLOYMENT.md), de la création du projet Supabase jusqu’à la recette Vercel. Copier `.env.example` vers `.env.local` pour le développement connecté. **Ne jamais committer les clés**, ni utiliser un préfixe `NEXT_PUBLIC_` pour la clé `service_role`.

| Variable                         | Où ?              | Usage                                                        |
| -------------------------------- | ----------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`       | Client + serveur  | URL du projet                                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Client            | Clé publique publishable ou anon                             |
| `SUPABASE_SERVICE_ROLE_KEY`      | Serveur seulement | Accès aux états privés et RPC                                |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Client            | Widget CAPTCHA ; requis en production                        |
| `APP_ORIGIN`                     | Serveur           | Origine exacte autorisée, sans slash final                   |
| `RATE_LIMIT_SECRET`              | Serveur           | Secret aléatoire d’au moins 32 caractères pour hacher les IP |

La clé **secrète Turnstile** se configure dans Supabase Auth, pas dans le navigateur ni ce dépôt. Un fichier de configuration incomplet désactive le multijoueur avec une erreur explicite ; le jeu local reste utilisable.

## Qualité et sécurité

```sh
npm run test             # Moteur, scénarios et contrats HTTP
npm run typecheck        # TypeScript strict
npm run check            # Tests + types
npm run build            # Build de production
npm audit               # Vérification des avis de sécurité npm
```

Voir [SECURITY.md](docs/SECURITY.md) et [TESTING.md](docs/TESTING.md). Une architecture restrictive ne constitue pas une garantie d’absence de vulnérabilités. Le CAPTCHA Supabase, les limites de la plateforme, les secrets et les politiques SQL font partie du déploiement, pas d’une simple option esthétique.

## Périmètre et limites

- TAC-TIK de base uniquement ; pas de variante TOCK, cartes 13/Joker ou extension à 8.
- Pas de matchmaking public, chat, spectateurs, expulsion, remplacement d’un joueur, compte permanent ou abandon automatique. Un joueur parti peut revenir avec sa session ; sinon il faut ouvrir une autre table.
- Les parties expirent 7 jours après leur création. La purge SQL doit être planifiée (guide fourni).
- Le code d’invitation permet d’entrer tant que le salon est ouvert. Il doit rester entre les participants ; ce n’est pas un mécanisme d’approbation individuelle par l’hôte.
- La session anonyme est liée au stockage du navigateur : la supprimer fait perdre l’accès à la place. Les données d’une partie ne sont jamais récupérables avec le seul pseudo.
- La photo mentionne 49 cartes, le PDF décrit un paquet TAC-TIK de 48. Cette version suit le PDF ; la répartition uniforme des 12 types de cartes est une hypothèse documentée à confirmer sur le paquet physique.
- Le plateau conserve le parcours de 16 cases par couleur mais adopte une disposition elliptique pour la lisibilité. Il ne reproduit pas exactement la découpe en panneaux du plateau physique.

Les références fournies par l’utilisateur restent hors du code distribué. Les visuels sont réalisés en CSS/SVG. Cette adaptation indépendante n’est pas présentée comme un produit officiel de l’éditeur.
