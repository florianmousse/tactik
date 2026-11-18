# Mise a jour du site existant

## Changements

- Chat privé dans les salons, texte brut limité à 500 caractères, 12 envois/minute/utilisateur. Les 100 derniers messages sont conservés et les 50 derniers affichés.
- 8 joueurs, 4 équipes, 32 pions, 128 cases, deux paquets.
- Joker activé par défaut à la création : 1 par paquet, soit 49 ou 98 cartes. Le créateur peut le désactiver.
- Bots ajoutés aux places libres avant le début, en plus du mode solo local.
- Défausse de toute la main : tous les pions contrôlés en réserve, sans 1, 10 ni Joker. Un pion sur le parcours, même bloqué, interdit la défausse complète.
- Plateau rectangulaire construit à partir du parcours et des emplacements de la photo. Panneaux centraux ajoutés pour 6 et 8 couleurs.
- Cartes, choix du déplacement et confirmation regroupés dans un panneau fixe. Sur mobile, le plateau et ce panneau partagent la hauteur disponible.

## Supabase déjà installé

Appliquer les migrations manquantes dans cet ordre : `202611180002_chat_bots.sql`, puis `202611180003_public_rooms.sql`. Ne pas reexecuter une migration deja appliquee. La migration 003 est indispensable aux codes courts, aux salons publics et au retrait atomique des droits apres exclusion.

Cette migration ajoute `room_messages`, le compteur de notification du chat et adapte le commit aux bots. Elle ne supprime pas les parties ni les utilisateurs. Les anciens salons et jeux restent sans Joker, sauf ceux créés avec cette nouvelle option. La capacité et les cartes des parties commencées ne changent pas.

Le chat ne publie aucun texte via Realtime. Seul le signal `room_events` change. Les lectures et écritures des messages passent par le serveur et vérifient les membres.

## Diagnostic du 18 novembre 2026

Contrôles sans lecture de parties ni affichage de clés :

- Le fichier local de configuration utilisait un lien `supabase.com/dashboard/project/...`. Le client attend **Project URL**, de la forme `https://<référence>.supabase.co`. La valeur locale a été corrigée.
- La configuration locale utilisait une origine localhost. Elle utilise désormais `http://127.0.0.1:3000` pour le développement. Sur Vercel, l'origine doit être `https://tactik-bigflom.vercel.app`.
- Le site publié retournait **403** à une requête provenant de son propre domaine. Cela confirme un problème de configuration de son origine autorisée.
- Sur le projet Supabase réel, les connexions anonymes sont activées, mais `disable_signup` est vrai. Autoriser la création de nouveaux utilisateurs dans Supabase Auth pour permettre de nouvelles sessions anonymes.
- Les tables initiales existent. `room_messages` et `room_events.chat_revision` sont absents : appliquer la deuxième migration.
- La vérification du CAPTCHA côté fournisseur n'a pas été exécutée automatiquement. Aucun CAPTCHA n'a été contourné.

La configuration avec clés était dans `.env.example`, suivi par Git. Elle a été préservée dans `.env.local`, ignoré, et le fichier d'exemple a été restauré sans valeurs privées. Si les clés ont déjà été publiées dans un dépôt ou partagées ailleurs, les remplacer dans Supabase et Vercel.

## Valeurs à vérifier dans Vercel

| Variable                         | Valeur attendue                                     |
| -------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`       | Project URL dans Supabase, pas le lien du dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Clé publique du même projet                         |
| `SUPABASE_SERVICE_ROLE_KEY`      | Clé serveur du même projet, sans préfixe public     |
| `APP_ORIGIN`                     | `https://tactik-bigflom.vercel.app`                 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key du widget autorisant ce domaine            |
| `RATE_LIMIT_SECRET`              | Secret aléatoire, 32 caractères minimum             |

Les clés existantes restent dans le fichier local privé et dans les plateformes. Aucun secret ne doit être copié dans ce document. Le secret Turnstile se renseigne dans **Supabase Auth / CAPTCHA**, pas comme clé publique Vercel.

Après les corrections, **redéployer** : les variables `NEXT_PUBLIC_*` sont intégrées au build. Le formulaire attend maintenant un CAPTCHA valide avant de demander une nouvelle session et distingue `captcha_failed`, `signup_disabled` et `anonymous_provider_disabled`.

Références : [erreurs Auth Supabase](https://supabase.com/docs/guides/auth/debugging/error-codes), [erreurs Turnstile](https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/).

## Recette

1. Créer un salon à 8, confirmer le Joker, remplir les sept places libres de bots et lancer.
2. Vérifier les échanges, les tours des bots, puis un coup humain et un Joker.
3. Dans un autre salon, inviter un second navigateur et vérifier le chat dans les deux sens.
4. Actualiser : le plateau, les cartes et le chat sont restaurés pour la même session.
5. Vérifier une défausse complète sans démarrage, puis son refus avec un pion bloqué derrière un pieu.

Les bots avancent quand un membre du salon est connecté. Ils ne nécessitent pas de processus permanent sur Vercel. Si tous les navigateurs sont fermés, la partie reprend au prochain retour.
