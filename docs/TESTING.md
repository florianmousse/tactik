# Vérifications

## Commandes

```sh
npm run check
npm run build
npm audit --audit-level=high
```

Les tests utilisent `node:test` via `tsx`. Le moteur n'accède pas au réseau ; le hasard est injecté et déterministe dans les scénarios de test.

La suite couvre : configurations 2/3/4/6/8, distribution, échange simultané, pieux bloquants et protégés, sortie, recul, capture, maisons, permutation, partitions du 7, interdiction de mélanger les couleurs, défausse obligatoire, aide au partenaire, victoire et absence de données adverses dans la projection. Une simulation de 250 tours vérifie le nombre et les valeurs des cartes, l'unicité des positions et les bornes du plateau. Les contrats Zod sont testés contre des champs injectés et des mouvements impossibles.

## Intégration Supabase

Exclusivement sur un projet de test où les quatre migrations ont été appliquées. Ajouter `RUN_SUPABASE_INTEGRATION=1` au fichier `.env.local` puis :

```sh
node --env-file=.env.local --import tsx --test tests/integration/supabase.test.ts
```

La suite crée deux identités temporaires via l'API admin (sans envoyer d'email), les connecte avec un jeton à usage unique, crée un salon, puis teste les accès membre/tiers/anonyme, les RPC interdites, l'unicité du commit concurrent et le quota atomique. Le nettoyage ne vise que les identifiants créés par cette invocation. La clé serveur est indispensable mais ne doit jamais être imprimée.

Ce test ne remplace pas une recette du CAPTCHA et de l'API HTTP. Sans `RUN_SUPABASE_INTEGRATION=1`, il est explicitement **ignoré**, pas déclaré réussi.

## Recette navigateur et multijoueur

1. **Local sans secrets** : accueil, mémorisation du nombre de joueurs, entraînement, échange, défausse si aucun coup, sortie avec 1/10, déplacement, permutation et composition du 7.
2. **Responsive** : accueil et partie à 390 px et sur bureau, pas de débordement horizontal, cartes et boutons accessibles. Sur mobile, les boutons nommés des pions permettent d'éviter les petites cibles SVG.
3. **Identités** : deux profils/navigateurs distincts (deux onglets du même profil partagent la session). Créer une table à 2, joindre via lien ; vérifier pseudo et places. Essayer de commencer avant que le salon soit complet.
4. **Partie** : l'hôte lance, chacun choisit une carte. Le premier ne voit pas la carte reçue tant que le second n'a pas choisi. Les mains sont correctes et le tour tourne après un seul coup.
5. **Confidentialité** : inspecter les réponses `/api/game` des deux clients et les messages WebSocket. Ni `hands`, ni `deck`, ni `exchanges` dans les réponses de projection ; Realtime n'envoie que code/version/chat_revision. Vérifier avec une troisième identité que la lecture échoue.
6. **Reconnexion** : actualiser après avoir joué. L'URL contient le code du salon et la session existante permet une reprise automatique. Couper puis rétablir le réseau ; vérifier la convergence au plus tard à la prochaine lecture de secours sur onglet visible.
7. **Concurrence** : deux requêtes d'action avec la même version. Une seule peut être enregistrée ; l'autre doit recevoir 409. Ne pas rejouer automatiquement un coup après une erreur réseau sans resynchroniser.
8. **Validation** : falsifier index de carte, ID de pion, action, version ou champ inconnu ; aucune mutation. Défausse refusée si une autre carte est jouable. Requête sans JWT : 401 ; mauvaise origine : 403 ; JSON non conforme : 400 ; dépassement du quota : 429.
9. **CAPTCHA** : session nouvelle avec et sans jeton valide, vérifiée directement par Supabase Auth. Une session existante reste utilisable après expiration du widget.
10. **Fin et équipes** : à 4/6/8, rentrer les pions d'une couleur, vérifier l'aide au partenaire, puis la victoire seulement après les huit pions.

## État de livraison - 18 novembre 2026

- Tests du moteur et des contrats : exécutés avec succès (28 tests).
- TypeScript strict et build Next.js de production : exécutés avec succès.
- Audit npm : aucun avis de vulnérabilité signalé au moment du contrôle.
- Navigateur : accueil, entraînement à 2/4, échange, tours automatiques, défausse et sortie de réserve d'un pieu vérifiés ; affichage mobile à 390 px inspecté. Capture : `docs/screenshots/game-mobile.jpg`.
- HTTP local de production : page 200, CSP, X-Frame-Options DENY, nosniff vérifiés ; origine étrangère refusée avec 403 et réponse `private, no-store`.
- Intégration Supabase : non exécutée sur un projet de test. Le projet de production a uniquement fait l'objet de lectures de diagnostic ; ce contrôle ne valide pas les frontières d'accès.
- CAPTCHA, RLS sur le projet déployé, WebSocket réel entre deux utilisateurs, reprise en ligne et concurrence HTTP : à valider après configuration.
- Cette refonte n'a pas été publiée sur Vercel. Le site existant utilise encore la version précédente.

Mettre à jour cet état lorsqu'un nouveau contrôle est effectivement exécuté ; ne pas transformer une étape de recette en résultat présumé.

## Recette de la refonte

Contrôle navigateur local de la refonte : partie à huit avec sept bots, échanges, Joker joué par un bot, défausse complète puis nouvelle distribution, sélection d'un pion et démarrage validé. Affichage inspecté à 390 x 844 et 1440 x 900. Captures actualisées : `docs/screenshots/game-mobile.jpg` et `docs/screenshots/game-desktop.jpg`. Le chat en ligne, la reconnexion entre deux clients et les conflits HTTP restent à tester après configuration du service.

Les nouveaux tests couvrent Joker (y compris démarrage et 7), deux paquets à huit, défausse complète autorisée en réserve et refusée derrière un pieu, bots et géométrie du plateau. La suite d'intégration inclut désormais le refus de lecture et de RPC du chat pour membre/tiers/anonyme, le refus d'un auteur tiers, l'idempotence du message, la séparation version/chat_revision et l'exclusion des bots des membres Auth. Ces scénarios SQL restent à exécuter sur un projet de test.

Le diagnostic en lecture a identifié une origine refusée sur l'API publiée, les nouvelles inscriptions Auth désactivées et la migration chat absente. Voir `UPGRADE.md`. Il ne prouve pas la validité des clés Turnstile sur le déploiement.

## Salons publics et ergonomie - nouvelle verification

Tests ajoutes : panneaux de reserve sans recouvrement du parcours, destinations comparees au moteur (sortie, recul, maison, permutation, 7), nouveaux codes et anciens codes, commandes strictes, exclusion reservee a l'hote avant lancement. La suite SQL couvre aussi liste minimale publique, absence des salons prives, RPC refusee aux clients, retrait du membre et de ses signaux, chat interdit apres exclusion et refus du CAS obsolete.

Recette restant a effectuer : salon public visible et joignable avec deux identites, exclusion et tentative de reentree, fermeture de liste apres lancement ou remplissage, anciens liens, mobile 390 px et bureau, capture par clic sur destination occupee, permutation directe, 7 fractionne et annulation, reconnexion et concurrence. L'exclusion pendant une partie commencee est volontairement refusee pour conserver les equipes et les mains.

Resultats de cette livraison :

- `npm run check` : reussi, 32 tests et TypeScript strict.
- `npm run build` : reussi, compilation Next.js de production.
- `node --env-file=.env.local --import tsx --test tests/integration/supabase.test.ts` : un test ignore, car RUN_SUPABASE_INTEGRATION n'est pas active. Aucun acces multijoueur reel valide.
- Recette navigateur non executee : acces localhost du navigateur integre en timeout, puis connexion au navigateur Windows expiree. Aucun resultat visuel bureau/mobile revendique pour ces changements.
- Migration 003 non appliquee et version non deployee. Appliquer les migrations manquantes sur un projet de test, executer l'integration et la recette ci-dessus avant publication.

## Depart, presence et orientation - 18 novembre 2026

Nouveaux tests locaux : depart de membre/tiers, transfert d'hote et fermeture du dernier siege humain ; preservation du jeu commence pour reprise ; distinction d'une erreur temporaire et d'une perte d'acces ; interdiction de rejouer un coup apres renouvellement ; schema strict des signaux et du depart ; stockage local borne des codes ; depart en bas et geometrie dans le cadre pour toutes les couleurs et configurations, sans mutation du jeu.

La suite Supabase est etendue aux privileges de room_presence, aux RPC interdites pour membre/tiers/anonyme, a la version obsolete, aux connexions multiples, au CAS concurrent des departs et au retrait en cascade de la presence. Recette navigateur restante : accueil et pseudo, fiche propre en premier, coequipier sous pseudo, rotation et cibles tactiles, mobile 390 px/bureau, changement de table, reprise, deux utilisateurs et onglets, reconnexion apres coup, et 7 fractionne. Les tentatives de navigateur integre local ont expire ; le controle Firefox a retourne unknown or expired node_repl continuation. Aucun nouveau rendu visuel valide.

Resultats executes pour cette livraison : `npm run check` reussi (38 tests et TypeScript), puis `npm run build` reussi, puis `npm run format:check` reussi. La commande `node --env-file=.env.local --import tsx --test tests/integration/supabase.test.ts` a ignore son unique test car RUN_SUPABASE_INTEGRATION n'est pas active. Migration 004 non appliquee et version non deployee. Aucun diagnostic de la deconnexion reelle ne peut etre conclu de ces tests locaux.

## Plantage, bots et historique - 18 novembre 2026

Reproduction avant correction : le test `plateau : un apercu du tour precedent ne plante pas apres une entree en maison` echouait avec TypeError is not iterable dans board.tsx. Apres une entree en maison, le nouveau plateau recevait encore l'ancien apercu et calculait une case de maison hors limites. Le filtre des apercus courants et la verification de coordonnee corrigent ce scenario. La correspondance avec le chunk de production n'a pas pu etre verifiee (ressource distante inaccessible), donc ce test ne prouve pas que toutes les causes du signalement sont resolues.

React 418 designe une divergence d'hydratation (https://react.dev/errors/418). Le premier rendu est teste deterministe, sans lecture du stockage ou de session avant montage. Cela ne remplace pas une reproduction avec navigateur et extensions ; l'erreur 418 signalee reste a reproduire. GrowthBook est absent du code ; les messages CSP et cookie ne prouvent pas une perte de session Supabase.

Nouveaux scenarios : bot evitant captures propres/alliees, capture forcee avec defausse interdite, capture en chemin du 7, don de demarrage au partenaire et conservation de sa seule sortie ; traces de permutation/capture, absence de champs prives, anciens etats sans historique, retentions de 40 coups ; ordre de jeu et nouvelle donne ; messages non lus par UUID meme a longueur de liste constante ; rendu initial deterministe.

Recette restante : survol et clavier de l'historique, dialogue mobile et Echap, fleches apres permutation et 7, lisibilite a 390 px, compteur chat sur deux clients, reception en arriere-plan, observation des bots locaux et rechargement apres erreur. Le controle navigateur etait bloque dans cette session (timeout du navigateur integre et continuation Firefox expiree) ; aucun nouveau controle visuel n'est revendique. Pas de changement de frontiere SQL dans cette livraison ; les integrations Supabase des migrations precedentes restent a executer sur le projet de test.

Resultats de cette iteration : `npm run check` reussi (48 tests, TypeScript strict), `npm run build` reussi et `npm run format:check` reussi. Le test de plantage a ete observe en echec avant correction puis en succes. Pas de deploiement effectue. Cette iteration n'ajoute pas de migration ; la migration 004 des changements precedents reste necessaire a la version complete.

## Placement des reserves - 18 novembre 2026

Les reserves bleue et verte sont replacees dans les espaces libres exterieurs selon Screenshot_8 pour quatre couleurs. Les extensions a six et huit couleurs utilisent la poche laterale du panneau pour eviter les cases du secteur adjacent. Le test de non-recouvrement des panneaux et du parcours passe pour les trois configurations, ainsi que les tests d'orientation.

Validation : `npm run check` reussi (48 tests et TypeScript), puis `npm run build` reussi. Rendus SVG du composant Board inspectes en images pour 4, 6 et 8 joueurs. Ce controle statique ne remplace pas une recette interactive mobile/bureau ; les limites navigateur precedentes restent applicables. Aucun deploiement effectue.

## Reserves des extensions - 19 novembre 2026

Correction du placement precedent a 6 et 8 couleurs : toutes les reserves des extensions occupent maintenant les espaces exterieurs proches de leur maison. Les espaces les plus etroits utilisent un panneau moins large et un espacement de 19 unites entre pions, sans reduire les pions. Le plateau a quatre couleurs conserve ses coordonnees et dimensions.

`npm run check` reussi (48 tests et TypeScript), puis `npm run build` reussi. Le controle geometrique couvre aussi les cases des maisons. Rendus statiques du composant Board a 6 et 8 inspectes ; recette interactive navigateur non executee (limites precedentes). Aucun deploiement effectue.

## Orientation face au joueur et mouvements - 19 novembre 2026

La rotation aligne maintenant la reserve propre horizontalement dans le quart inferieur pour chaque couleur, au lieu de verifier seulement un depart dans la moitie basse. Le test d'orientation couvre 2/3/4/6/8 joueurs. Le titre et les cartes centrales ont une contre-rotation ; cartes agrandies de 40 x 64 a 60 x 90. Les groupes de pions et leurs reperes utilisent une translation CSS animee de 450 ms ; la preference de reduction des animations la desactive.

`npm run check` reussi (48 tests et TypeScript), puis `npm run build` reussi. Rendus statiques inspectes depuis le bleu a 4 et 8 couleurs. Le mouvement en navigateur, les clics pendant la transition, les permutations, captures et la reduction des animations restent a verifier interactivement (acces navigateur bloque precedemment). Aucun deploiement effectue.

## Parties recentes detaillees - 19 novembre 2026

Accueil reorganise : une rubrique visible a la fois (public, creation, code, bots, parties recentes), details des parties et apercu du plateau repliables. Les options du solo sont accessibles dans sa propre rubrique. Validation apres reorganisation : `npm run check` reussi (49 tests et TypeScript), puis `npm run build` reussi. Recette visuelle bureau/mobile et navigation interactive restant a effectuer ; les limites d'acces navigateur precedentes restent applicables. Pas de deploiement.

Les fiches sont relues par sync, avec les droits de membre existants ; aucune nouvelle API ni migration. Seuls les codes restent dans localStorage. Le resume en memoire exclut mains, messages et etat complet. Attente, echange et victoire (y compris equipe zero), partenaire et absence de main sont couverts par un test. `npm run check` reussi : 49 tests et TypeScript, puis `npm run build` reussi. Format des fichiers modifies verifie avec Prettier. Recette interactive restante : victoire distante pendant une absence, retour accueil, actualisation, acces perdu, panne reseau et lisibilite mobile. Integration Supabase non executee ; aucune validation multijoueur reelle revendiquee. Aucun deploiement effectue.

## Sélections, affichage et administration - 20 novembre 2026

Modifications : dernière carte et pion unique sélectionnés automatiquement, coup complet simulé avant confirmation, bulles numérotées, déplacement case par case, fiches latérales sur grand écran, badge d'équipe, plateau d'accueil variable, survol temporaire et plateau ajusté dans le dialogue historique. Les bots attendent trois secondes entre déclenchements. La stratégie de décision reste inchangée et est documentée dans BOTS.md.

Une interface et une API admin séparées permettent aux UUID autorisés dans ADMIN_USER_IDS de lister tous les salons, consulter uniquement les mains des bots et supprimer par code/version avec cascade. Aucun droit n'est activé automatiquement et aucune donnée réelle n'a été supprimée. Tests locaux ajoutés : refus par défaut, UUID exact, schémas stricts et projection sans mains humaines, pioche ou choix d'échange. Tests SQL étendus : DELETE interdit au membre/tiers/anonyme, version périmée, suppressions concurrentes et cascades.

Vérifications exécutées :

- `npm run check` : réussi, 51 tests et TypeScript strict.
- `npm run build` : réussi, routes /admin et /api/admin incluses.
- `node --env-file=.env.local --import tsx --test tests/integration/supabase.test.ts` : un test ignoré, RUN_SUPABASE_INTEGRATION non activé. Aucun accès multijoueur ou administrateur réel validé.
- Contrôle visuel interactif non exécuté : localhost inaccessible au navigateur intégré (ERR_CONNECTION_TIMED_OUT), puis Firefox refusé par Computer Use car sa politique d'URL n'est pas prise en charge pour ce navigateur Windows.

Recette restante : bureau/mobile, dernière carte, pion unique avec embranchement maison/parcours, permutation, 7 avec capture d'un pion déjà déplacé, annulation, flèches avant validation, survol/focus/toucher, dialogue et Echap, animations réduites et numéros depuis chaque orientation. Sur un Supabase de test, vérifier les réponses HTTP admin 401/403, UUID autorisé et révoqué, mains des seuls bots, suppression en attente et en cours, conflit 409, cascades et disparition chez deux clients. Aucun déploiement effectué ; ADMIN_USER_IDS reste à configurer par le propriétaire.

## Echanges tactiques et mémoire des bots - 20 novembre 2026

Avant correction, les trois scénarios de don exact (8, 2 en maison, 7 fractionnable) échouaient : le bot donnait le premier 5. Un quatrième scénario a reproduit le don d'un 5 préparant un 3 épuisé au lieu d'un 6 préparant un 2 possible. Après correction, ces scénarios passent.

Onze tests ajoutés couvrent les dons, le refus d'un 7 partiellement consommé, les suites 5 + 3 / 6 + 2 au jeu et à l'échange, la carte donnée encore connue, l'indépendance de la décision vis-à-vis de la vraie main cachée, l'échange simultané privé, la sérialisation JSON, les destinataires à 2/3/8, la défausse complète non révélée, la nouvelle donne, le remélange, les anciens états, les doubles paquets et le Joker compté sous sa valeur imprimée. Les transitions testées préservent leurs entrées.

Vérifications exécutées : `npm run check` réussi (62 tests et TypeScript strict), puis `npm run build` réussi après une relance : la première tentative avait rencontré un EPERM Windows dans le dossier généré .next. `npm run format:check` réussi. `node --env-file=.env.local --import tsx --test tests/integration/supabase.test.ts` a ignoré son test, RUN_SUPABASE_INTEGRATION n'étant pas activé. Aucun multijoueur réel validé.

Pas de modification d'interface ni de nouvelle migration. Recette restante sur Supabase de test : mémoire propre à chaque identité après échange simultané, absence des mémoires tierces dans les réponses, reprise après reconnexion, deux bot-tick concurrents et persistance unique de l'observation avec le CAS. La mémoire ajoute uniquement un champ privé optionnel au JSON et une projection propre au demandeur, sans nouvelle commande ni droit SQL. Aucun déploiement effectué.

## Repères de table, équipes et relecture - 23 novembre 2026

`npm run check` réussi (64 tests et TypeScript strict), puis `npm run build` réussi. La suite vérifie les jetons, le nombre de dos de cartes adverses et le schéma strict de la commande versionnée `swap-seats`.

Chrome local, entraînement à huit joueurs : huit fiches visibles sans défilement interne et huit repères de réserve à 390 x 844 et 1440 x 900, sans débordement horizontal. Echange effectué, sept coups de bots consultables. Le plateau du dialogue reste visible à la même hauteur lors du défilement du journal sur les deux formats. Fermeture par Echap vérifiée.

`node --env-file=.env.local --import tsx --test tests/integration/supabase.test.ts` : test ignoré, intégration non activée. A vérifier sur Supabase de test : composition des équipes par l'hôte, refus pour l'invité, synchronisation après reconnexion, conflit entre modification et lancement. Pas de déploiement.

## Pieux, permutation et panneau de table

`npm run check` réussi (65 tests et TypeScript strict), puis `npm run build` réussi. Un scénario de permutation couvre la cible adverse choisie en premier, le choix entre deux pions propres, le refus d'un pieu adverse et la sélection dans l'ordre inverse.

Chrome local à 390 x 844 et 1440 x 900, avec réponses API simulées : chat ouvert à l'entrée, brouillon conservé après consultation de l'historique, permutation bloquée après un seul choix puis prête après le second, marque de pieu distincte du pion ordinaire. Une erreur de synchronisation simulée affiche Réessayer maintenant ; une lecture réussie le masque. Ces contrôles ne valident pas la connexion à Supabase ni le chat entre deux clients réels.

## Cartes et chat flottant

`npm run check` réussi (65 tests et TypeScript strict), puis `npm run build` réussi. Chrome local, salon simulé à deux joueurs homonymes, à 390 x 844 et 1440 x 900 : main de six cartes et absence de débordement horizontal sur les deux formats. Sur mobile, compteur à 1 à la réception, aperçu sur la fiche du bon auteur, disparition après six secondes, compteur effacé à la lecture, brouillon conservé après fermeture par Echap et réouverture. La position du plateau reste stable à l'ouverture du dialogue. Le chat en ligne entre deux identités Supabase reste à vérifier.
