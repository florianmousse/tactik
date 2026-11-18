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

Exclusivement sur un projet de test où les trois migrations ont été appliquées. Ajouter `RUN_SUPABASE_INTEGRATION=1` au fichier `.env.local` puis :

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
