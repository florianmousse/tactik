# Vérifications

## Commandes

```sh
npm run check
npm run build
npm audit --audit-level=high
```

Les tests utilisent `node:test` via `tsx`. Le moteur n’accède pas au réseau ; le hasard est injecté et déterministe dans les scénarios de test.

La suite couvre : configurations 2/3/4/6, distribution, échange simultané, pieux bloquants et protégés, sortie, recul, capture, maisons, permutation, partitions du 7, interdiction de mélanger les couleurs, défausse obligatoire, aide au partenaire, victoire et absence de données adverses dans la projection. Une simulation de 250 tours vérifie le nombre et les valeurs des cartes, l’unicité des positions et les bornes du plateau. Les contrats Zod sont testés contre des champs injectés et des mouvements impossibles.

## Intégration Supabase

Exclusivement sur un projet de test où la migration a été appliquée. Ajouter `RUN_SUPABASE_INTEGRATION=1` au fichier `.env.local` puis :

```sh
node --env-file=.env.local --import tsx --test tests/integration/supabase.test.ts
```

La suite crée deux identités temporaires via l’API admin (sans envoyer d’email), les connecte avec un jeton à usage unique, crée un salon, puis teste les accès membre/tiers/anonyme, les RPC interdites, l’unicité du commit concurrent et le quota atomique. Le nettoyage ne vise que les identifiants créés par cette invocation. La clé serveur est indispensable mais ne doit jamais être imprimée.

Ce test ne remplace pas une recette du CAPTCHA et de l’API HTTP. Sans `RUN_SUPABASE_INTEGRATION=1`, il est explicitement **ignoré**, pas déclaré réussi.

## Recette navigateur et multijoueur

1. **Local sans secrets** : accueil, mémorisation du nombre de joueurs, entraînement, échange, défausse si aucun coup, sortie avec 1/10, déplacement, permutation et composition du 7.
2. **Responsive** : accueil et partie à 390 px et sur bureau, pas de débordement horizontal, cartes et boutons accessibles. Sur mobile, les boutons nommés des pions permettent d’éviter les petites cibles SVG.
3. **Identités** : deux profils/navigateurs distincts (deux onglets du même profil partagent la session). Créer une table à 2, joindre via lien ; vérifier pseudo et places. Essayer de commencer avant que le salon soit complet.
4. **Partie** : l’hôte lance, chacun choisit une carte. Le premier ne voit pas la carte reçue tant que le second n’a pas choisi. Les mains sont correctes et le tour tourne après un seul coup.
5. **Confidentialité** : inspecter les réponses `/api/game` des deux clients et les messages WebSocket. Ni `hands`, ni `deck`, ni `exchanges` dans les réponses de projection ; Realtime n’envoie que code/version. Vérifier avec une troisième identité que la lecture échoue.
6. **Reconnexion** : actualiser après avoir joué. L’URL contient le code du salon et la session existante permet une reprise automatique. Couper puis rétablir le réseau ; vérifier la convergence au plus tard à la prochaine lecture de secours sur onglet visible.
7. **Concurrence** : deux requêtes d’action avec la même version. Une seule peut être enregistrée ; l’autre doit recevoir 409. Ne pas rejouer automatiquement un coup après une erreur réseau sans resynchroniser.
8. **Validation** : falsifier index de carte, ID de pion, action, version ou champ inconnu ; aucune mutation. Défausse refusée si une autre carte est jouable. Requête sans JWT : 401 ; mauvaise origine : 403 ; JSON non conforme : 400 ; dépassement du quota : 429.
9. **CAPTCHA** : session nouvelle avec et sans jeton valide, vérifiée directement par Supabase Auth. Une session existante reste utilisable après expiration du widget.
10. **Fin et équipes** : à 4/6, rentrer les pions d’une couleur, vérifier l’aide au partenaire, puis la victoire seulement après les huit pions.

## État de livraison — 18 novembre 2026

- Tests du moteur et des contrats : exécutés avec succès (16 tests).
- TypeScript strict et build Next.js de production : exécutés avec succès.
- Audit npm : aucun avis de vulnérabilité signalé au moment du contrôle.
- Navigateur : accueil, entraînement à 2/4, échange, tours automatiques, défausse et sortie de réserve d’un pieu vérifiés ; affichage mobile à 390 px inspecté. Capture : `docs/screenshots/game-mobile.jpg`.
- HTTP local de production : page 200, CSP, X-Frame-Options DENY, nosniff vérifiés ; origine étrangère refusée avec 403 et réponse `private, no-store`.
- Intégration Supabase : non exécutée contre un service réel (aucun projet ni clé configurés) ; lancement sans configuration vérifié comme ignoré.
- CAPTCHA, RLS sur le projet déployé, WebSocket réel entre deux utilisateurs, reprise en ligne et concurrence HTTP : à valider après configuration.
- Aucune publication Vercel réalisée.

Mettre à jour cet état lorsqu’un nouveau contrôle est effectivement exécuté ; ne pas transformer une étape de recette en résultat présumé.
