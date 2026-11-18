# Guide de travail - TacTik

## Objectif et périmètre

Application Next.js / React / TypeScript déployable sur Vercel, Supabase pour auth anonyme, stockage et Realtime. Langue produit : français. Préserver le TAC-TIK décrit dans `docs/RULES.md`. Ne pas remplacer ce projet par un site statique ou un autre hébergement sans demande utilisateur.

## Lire avant de modifier

- `README.md` pour lancer le projet et connaître ses limites.
- `docs/ARCHITECTURE.md` pour les responsabilités et invariants.
- `docs/SECURITY.md` avant toute modification de l'API, de l'auth ou du SQL.
- `docs/RULES.md` avant toute modification du moteur.
- `docs/TESTING.md` pour la validation et les vérifications non exécutées.

## Frontières d'architecture

1. `src/game` contient des règles pures. Aucun React, réseau, base de données, variable d'environnement ou horloge. Le hasard est injecté. Les transitions ne mutent jamais leur entrée.
2. `src/server` est serveur uniquement. `store.ts` importe `server-only`. Les clés privilégiées ne traversent jamais une prop de composant ni un export client.
3. `src/app/api/game/route.ts` valide les intentions, pas des états envoyés par le client. Toute commande exige identité vérifiée, appartenance et, hors lecture/jonction, version attendue.
4. `src/components` rend la projection privée. L'aide aux coups et le mode local ne sont pas des autorités de sécurité. Le serveur revérifie chaque action.
5. `supabase/migrations` évolue par nouvelles migrations après déploiement. Ne pas réécrire une migration déjà appliquée. Les fonctions de mutation restent accessibles exclusivement à `service_role`.

## Invariants non négociables

- Aucun envoi des mains adverses, pioche ou choix d'échange non résolus. Utiliser `viewFor` ; ne pas sérialiser `Game` dans l'API.
- Ne jamais publier `game_rooms` via Realtime. Seule `room_events` contient un signal de version filtré par RLS.
- Ne jamais ajouter une policy permissive pour faire passer un test. Tester un membre, un tiers et un anonyme.
- Chaque coup passe par une sauvegarde CAS atomique ; vérifier le résultat, retourner 409 en cas de concurrence. Aucun retry automatique d'une action à effet de bord.
- Pas de RNG `Math.random` pour les cartes ou invitations en ligne. Utiliser le RNG cryptographique serveur ; `Math.random` est réservé à l'entraînement.
- Garder les limites de taille, les schémas stricts, les quotas distribués et la vérification d'origine. Ne jamais se fier à un ID joueur fourni par le client.
- Aucun secret, token, corps de requête, pioche ou IP brute dans les logs, captures ou commits. `.env.local` est ignoré.
- Aucune dépendance de production ajoutée sans raison concrète. Versions exactes et lockfile conservés. Ne pas exécuter `npm audit fix --force` sans analyser ses changements.

## Conventions

- Utiliser uniquement l'apostrophe droite et le tiret simple. Aucun slogan ni texte de remplissage. Les cartes et la validation doivent rester dans le même panneau visible.
- Les nouvelles parties proposent un Joker par paquet. A 8 joueurs, deux paquets et quatre équipes. Le chat passe par le serveur ; les bots ne reçoivent que leur projection privée.

- TypeScript strict, types partagés explicites, erreurs produit en français.
- Noms de fonctions et variables en anglais ; documentation en français.
- Pas de `any`, de désactivation globale des vérifications ou de HTML brut non fiable.
- Préférer des composants dédiés quand l'interface grandit. Garder les données privées hors de leurs états.
- SVG/CSS existants pour le plateau et les cartes ; pas besoin de ressources distantes.
- Respecter navigation clavier, focus visible, messages d'erreur et réduction des animations.
- Mettre à jour la documentation quand une règle, une variable, un contrat ou une limite change.

## Vérifier avant livraison

Exécuter `npm run check` puis `npm run build`. Pour une règle, ajouter un test de scénario qui échoue avant la correction, incluant un coup interdit pertinent. Pour une frontière d'accès, exécuter les tests d'intégration sur un Supabase de test. Si aucun service n'est configuré, signaler cette limite explicitement ; ne pas déclarer le multijoueur validé.

Contrôler l'interface sur bureau et mobile lorsqu'un navigateur est disponible. Valider création, échange, coup simple, 7 fractionné, reconnexion et deux clients concurrents après modification du protocole. Les tests ne remplacent pas la recette de déploiement.

## Publication

Le propriétaire configure les comptes, le CAPTCHA et les secrets dans les plateformes. Le dépôt ne contient aucune clé. Ne pas déployer sur un autre compte ou rendre publiques des données de test. Documenter exactement les commandes réussies et les contrôles restant à faire.
