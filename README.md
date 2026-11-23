# TAC-TIK

Jeu de plateau web pour 2, 3, 4, 6 ou 8 joueurs. Salons publics ou privés, chat, humains et bots, Joker et sauvegarde en ligne. Le plateau SVG reprend les chemins, maisons, réserves et panneaux rectangulaires de la photo fournie. Les cartes et la validation restent dans le même panneau.

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

Pour une première installation, suivre [DEPLOYMENT.md](docs/DEPLOYMENT.md). Pour le site existant, suivre [UPGRADE.md](docs/UPGRADE.md). Les quatre migrations sont nécessaires, dans l'ordre ; ne pas réexécuter la première si elle est déjà appliquée.

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
- Liste des salons publics ouverts (30 maximum). Exclusion par le créateur avant le lancement. Pas de spectateurs ni de remplacement en cours de partie.
- Les bots en ligne avancent tant qu'un membre est connecté. Ils reprennent au retour des joueurs, sans processus permanent Vercel.
- La session anonyme appartient au navigateur. Effacer son stockage fait perdre sa place ; le pseudo ne sert jamais de preuve d'identité.
- Les salons expirent sept jours après création ; planifier la purge décrite dans le guide. Les messages sont supprimés avec le salon.
- Le mode solo est réinitialisé par une actualisation.
- La disposition à 8 prolonge le panneau central selon la logique du plateau. Aucune photo de l'extension à 8 n'a été fournie.

Le code et les visuels sont une adaptation indépendante. Lire [SECURITY.md](docs/SECURITY.md) pour les protections et limites. Aucun résultat de test local ne remplace la vérification du CAPTCHA et des permissions du déploiement réel.

## Salons publics et commandes directes

Appliquer aussi `supabase/migrations/202611180003_public_rooms.sql` avant de mettre cette version en ligne. Les anciens salons restent prives. La case Salon public rend le salon visible dans la liste des parties ouvertes ; rejoindre utilise le pseudo sans saisie de code. Une session anonyme verifiee et les quotas restent obligatoires pour la liste.

Les nouvelles invitations ont 8 caracteres sans I, O, 0 ou 1 ; les anciens codes a 12 caracteres restent valables. Le createur peut exclure un invite avant le lancement. Cette identite ne peut plus rejoindre ce salon, lire son chat ni recevoir ses signaux.

Un coup simple demande carte, pion, puis une seule confirmation. Les destinations sont affichees sur le plateau ; les choix de maison et les segments du 7 restent explicites. Pour permuter, choisir son pion puis le pion cible directement sur le plateau, ou utiliser les boutons nommes. Le chat se replie avec son bouton et reste dans le panneau lateral sur mobile. Un bandeau rappelle vos couleurs, votre equipe et votre partenaire.

## Quitter, reprendre et voir la presence

Le bouton Quitter la table est disponible en ligne et en solo. Avant le lancement, il libere le siege ; si le createur part, le premier humain restant devient hote. Le dernier humain ferme le salon. En cours de partie, quitter conserve la place, les cartes et les equipes : la partie attend toujours le joueur dont c'est le tour. Il peut rejoindre une autre table puis revenir avec Mes parties recentes (huit salons maximum sur ce navigateur).

Les parties recentes affichent les participants et bots, les places, le Joker, la donne, votre couleur et votre partenaire. Les parties terminees indiquent les gagnants et proposent Voir le resultat. Ces informations sont relues via la synchronisation authentifiee a l'accueil, puis chaque minute si l'onglet est visible, et avec Actualiser les parties. Seuls les codes sont conserves sur disque ; une erreur de lecture est affichee sans effacer la partie. Les salons publics restent limites aux parties ouvertes a rejoindre.

La reprise utilise la session Supabase existante, jamais le pseudo comme preuve d'identite. Une erreur de reseau ou d'origine ne supprime plus la table ni son lien. Reprendre / synchroniser relit l'etat, sans rejouer un coup dont la sauvegarde est incertaine. Si la session anonyme a ete effacee, un pseudo identique ne permet pas de recuperer une place ; garder le meme navigateur et profil.

La migration `202611180004_presence_leave.sql` ajoute la presence privee : Present, En arriere-plan, Absent et Bot. Un signal est envoye toutes les 15 secondes tant que la table est visible, et lors des changements de visibilite. Sans signal pendant 45 secondes, le joueur est considere absent lors de la prochaine lecture (jusqu'a 15 secondes de delai supplementaire). Ce statut ne mesure pas les clics ni l'attention du joueur. Plusieurs onglets sont pris en compte.

Votre fiche apparait en premier, avec votre coequipier sous votre pseudo. Le plateau tourne pour placer votre zone de depart dans sa moitie basse ; les coordonnees logiques et l'ordre des tours ne changent pas. Les reserves bleue et verte occupent les espaces libres au bord du parcours, entre les cases, sur les plateaux a 4, 6 et 8 couleurs.

La reserve de votre premiere couleur est alignee en bas du plateau. Le titre et les cartes centrales restent face a vous, avec des cartes agrandies. Les pions suivent les cases à 180 ms par pas (minimum 600 ms). Sorties, captures et permutations utilisent un trajet direct. La preference systeme de reduction des animations desactive cette transition. Les regles et la validation des coups ne dependent pas de l'animation.

## Observation, bots et historique

Le chat signale les nouveaux messages des autres joueurs par un compteur de non-lus et un bandeau lorsque le panneau est ferme. Les messages sont marques lus uniquement lorsque le chat est visible dans un onglet actif. Pas de son ni de notification systeme.

Les bots simulent les coups legaux avec les seules positions publiques et leur main : ils preferent les alternatives sans capture alliee, y compris sur le passage d'un 7. Si les regles imposent une capture de soi, ils doivent toutefois jouer. Ils evaluent sorties, progression, maisons, permutations et captures adverses. A l'echange, ils peuvent donner un 1 ou un 10 au partenaire encore en reserve, en conservant une sortie si necessaire. Il s'agit d'une heuristique, pas d'une recherche strategique exhaustive.

L'option Observer les cartes des bots est disponible uniquement en entrainement local, avant et pendant la partie. Elle ne change pas ce que les bots voient eux-memes. Une interface admin séparée permet aussi au propriétaire autorisé de consulter les seules mains des bots en ligne.

L'historique conserve les 40 derniers coups avec leurs positions publiques. Survol, focus clavier ou toucher affiche depart et arrivee, permutations et captures. Historique ouvre un dialogue avec plateau fixe et fermeture par Echap. Les parties anciennes restent compatibles : seuls leurs nouveaux coups ont une trace geometrique. Les textes d'evenements precedents restent consultables. Les jetons identifient le donneur et la personne qui ouvre la donne courante.

## Ergonomie et administration

La dernière carte est sélectionnée automatiquement. Si une carte ne permet de jouer qu'un pion, ce pion est sélectionné ; un déplacement unique est préparé, avec confirmation finale obligatoire. Les choix ambigus, les cibles de permutation et la valeur du Joker restent explicites. Un coup complet affiche ses flèches, départs, arrivées et captures avant validation. Chaque pion porte son numéro au centre. Sur grand écran, les joueurs occupent une colonne latérale ; les membres de votre équipe partagent un badge de couleurs. L'accueil montre un plateau adapté au nombre de joueurs choisi.

Le coup sélectionné reste visible pendant le défilement de la liste. Le dialogue ajuste le plateau entier à son cadre. Le journal textuel conserve les événements sans remplacer les traces géométriques.

L'écran `/admin`, accessible depuis l'accueil, affiche l'UUID de votre session existante. Le propriétaire doit renseigner `ADMIN_USER_IDS` côté serveur (UUID séparés par des virgules), puis redéployer. Aucun UUID n'est activé automatiquement. Une session anonyme perdue ne récupère pas ses droits par pseudo : la liste doit être mise à jour par le propriétaire. Ne pas partager le profil de navigateur administrateur.

L'administrateur peut lister tous les salons par pages de 30, consulter les cartes des bots et supprimer un salon, même commencé. La suppression exige de retaper son code et utilise sa version affichée ; un changement concurrent renvoie 409 et impose une nouvelle consultation. Elle efface aussi chat, membres, présence et signaux par cascade. Aucun retry automatique. Les clients connectés constatent la disparition à leur prochaine synchronisation. Les mains humaines, la pioche et les choix d'échange restent privés. Aucune migration nouvelle n'est nécessaire, les quatre migrations existantes restent requises.

Détail de la stratégie et des scores : [BOTS.md](docs/BOTS.md).

## Bots : échanges et mémoire

Les bots évaluent désormais les cartes à donner selon les entrées exactes, la profondeur des maisons et les répartitions légales du 7. Ils conservent leur échange résolu et comptent les cartes observées jusqu'au prochain remélange. En fin de partie commune, ils comparent aussi les compléments possibles (par exemple 5 + 3 ou 6 + 2), avec priorité aux cartes connues et une estimation prudente des cartes inconnues. Ils ne consultent aucune main cachée. La mémoire persiste avec la partie ; les anciennes sauvegardes commencent sans souvenirs inventés. Voir [BOTS.md](docs/BOTS.md) pour le détail et les limites.

Dans un salon complet à 4, 6 ou 8, l'hôte compose les équipes avant le lancement en échangeant deux invités (humains ou bots). Son siège reste le premier. La commande `swap-seats` exige la version du salon et le serveur enregistre le nouvel ordre par CAS.

Les noms bordent les réserves. Le jeton D indique qui a distribué, le jeton 1 qui ouvre la donne. Chaque dos de carte représente une carte restante chez un autre joueur. Sur mobile les participants occupent deux colonnes sans défilement interne. L'historique s'ouvre directement avec un plateau fixe et une liste de coups défilante. Les positions des pions sont reconstituées à partir des changements publics conservés. Les confirmations se ferment après six secondes et les bots attendent 1,2 seconde avant leur prochain tour.
