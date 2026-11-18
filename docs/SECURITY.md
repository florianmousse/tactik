# Sécurité

## Modèle de menace

Le site est public et tout navigateur peut être modifié. Un attaquant peut falsifier une commande, changer un index, rejouer une requête, deviner un salon, appeler directement Supabase, ou créer de nombreuses identités. Les règles et les données secrètes ne doivent donc jamais dépendre de l'interface.

## Protections implémentées

| Risque                                | Mesure                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Lecture de cartes adverses            | États complets serveur ; projection `viewFor` ; aucune publication Realtime des états                                |
| Accès direct à PostgreSQL             | RLS sur toutes les tables ; aucun droit client sur états/quota ; RPC de mutation serveur uniquement                  |
| Usurpation d'un joueur                | JWT vérifié par Supabase Auth ; UUID obtenu du token, jamais du corps ; appartenance vérifiée                        |
| Coup falsifié                         | Schéma strict, contrôle de phase/tour/carte/couleur, moteur réexécuté côté serveur                                   |
| Double action ou perte de mise à jour | Comparaison atomique de version dans une transaction SQL                                                             |
| Échange anticipé                      | Tous les choix restent privés jusqu'à la résolution simultanée                                                       |
| RNG prévisible                        | `crypto.randomInt` pour le mélange serveur, 40 bits aleatoires pour les nouvelles invitations (8 caracteres base 32) |
| Énumération et rafales                | Quotas distribués en base : 240/min/IP, 90/min/utilisateur, 15 jonctions/min/utilisateur, 5 créations/h/utilisateur  |
| Charge utile excessive                | Lecture du corps bornée à 8 Kio, maximum quatre mouvements par carte                                                 |
| Requêtes cross-site                   | Origine exacte et JSON requis ; bearer explicite, aucun cookie d'auth automatiquement envoyé à l'API                 |
| Injection SQL/XSS                     | Client SQL paramétré, pseudo borné et filtré, échappement React, aucun HTML arbitraire                               |
| Exécution de scripts                  | CSP à nonce par réponse ; `strict-dynamic`, pas de `unsafe-eval` en production                                       |
| Clic détourné et fuite de lien        | `frame-ancestors 'none'`, X-Frame-Options DENY, Referrer-Policy no-referrer                                          |
| Cache partagé privé                   | API `private, no-store` et page dynamique                                                                            |
| Données dans les logs                 | Messages génériques, pas de tokens, états, mains, IP brutes ou erreurs DB détaillées                                 |
| Secret faible de pseudonymisation     | `RATE_LIMIT_SECRET` de 32 caractères minimum, HMAC SHA-256                                                           |

Les styles autorisent `unsafe-inline` pour les couleurs dynamiques React. Cela ne permet pas l'exécution de scripts. Les seuls hôtes tiers permis par la CSP sont Supabase et Turnstile. Les fonctions SQL ont un `search_path` vide et ne s'exécutent pas avec les droits d'un propriétaire privilégié.

## Responsabilités de déploiement

1. **Activer le CAPTCHA dans Supabase Auth** et vérifier son rejet sans jeton valide. La variable publique n'active pas à elle seule la protection côté Supabase.
2. Utiliser HTTPS et une origine canonique. `APP_ORIGIN` est obligatoire en production.
3. Limiter les requêtes en amont avec Vercel et ajuster les plafonds Auth. Le rate limiter SQL consomme lui-même des ressources ; il ne constitue pas une protection DDoS suffisante.
4. Restreindre l'accès aux secrets et aux tableaux de bord. Rotation immédiate après une exposition de `service_role` ; cette clé contourne RLS et donne accès à tous les états.
5. Appliquer les migrations sans policies permissives ajoutées manuellement. Vérifier la liste des publications.
6. Mettre en place la purge, les alertes de consommation et les mises à jour.
7. Tester les permissions réelles avant l'ouverture. Les tests du moteur seuls ne prouvent pas la configuration du service externe.

## Limites connues

- Les sessions anonymes sont stockées par le SDK Supabase dans le navigateur, donc accessibles au JavaScript de la même origine. Une XSS ou une extension malveillante pourrait voler une session. La CSP, l'absence de HTML brut et les mises à jour réduisent ce risque ; un futur modèle de session HttpOnly nécessiterait de revoir l'intégration Realtime.
- Un code d'invitation est une capacité d'entrée pendant le salon. Toute personne qui le reçoit peut occuper une place ; l'hote peut exclure une identite avant le lancement. Une nouvelle identite peut contourner cette exclusion ; le code lui-meme ne change pas.
- Le rate limiting IP est adapté au header `x-vercel-forwarded-for` injecté par Vercel. Hors Vercel, la clé IP est partagée (`local`) ; adapter explicitement le proxy de confiance avant d'utiliser un autre hébergeur.
- Les identités anonymes ont leur propre rétention, distincte de celle des salons. Les UUID de joueurs et pseudos sont visibles entre les membres.
- Les participants peuvent communiquer leurs cartes hors de l'application. Ce projet ne prétend pas empêcher la collusion humaine.
- Pas d'audit indépendant de sécurité, ni de tests de pénétration externes exécutés.

## Signaler un problème

Transmettre au mainteneur un scénario minimal, les versions et l'impact sans données de joueurs, clés ou jetons. Ne pas publier une vulnérabilité exploitable dans une issue publique avant correction. Le propriétaire doit définir un canal privé de signalement avant une diffusion large.

## Chat et sièges automatiques

Le chat est limité à 500 caractères et 12 envois par minute par utilisateur, en plus des quotas globaux. Les messages sont rendus comme texte React, jamais comme HTML. La lecture passe par la projection authentifiée du salon ; ni un membre, ni un tiers, ni un anonyme ne lisent directement `room_messages`. La migration du chat conserve les droits serveur exclusifs des RPC.

Un bot ne peut pas servir à usurper une identité : ses identifiants ne sont pas ajoutés à `room_members`. Le serveur choisit ses actions et conserve les vérifications CAS. Aucun client ne fournit une main ou un état arbitraire.

Les clés locales restent dans `.env.local`, ignoré par Git. `.env.example` contient uniquement des exemples. Le diagnostic `scripts/check-config.mjs` affiche des indicateurs et codes d'erreur, pas les clés ni les données des parties.

## Salons publics

La migration 003 ne donne aucun droit client supplementaire et ne publie aucune nouvelle table. La liste passe par une RPC reservee a service_role et expose seulement les metadonnees d'accueil des salons opt-in. Les codes courts gardent 40 bits de hasard cryptographique et restent soumis aux quotas de jonction. Les anciens codes hexadecimaux de 12 caracteres sont acceptes.

L'exclusion supprime atomiquement l'appartenance avec le CAS. Le compte exclu perd lecture, chat et Realtime ; son identite est conservee uniquement dans l'etat prive pour refuser sa reentree. Les tests SQL de retrait des droits doivent etre executes sur un projet de test avant publication.

## Presence et depart

`room_presence` est sous RLS sans privilege client. Les RPC de presence et depart sont exclusivement service_role, security invoker et search_path vide. Aucun ajout a Realtime. Le serveur derive l'UUID utilisateur du JWT, verifie l'appartenance et la version, et genere la date de derniere presence en base. Le client peut declarer uniquement sa propre visibilite, pas celle d'un autre utilisateur. Une presence n'est pas une preuve d'activite humaine.

Le depart avant lancement retire l'appartenance par CAS et ses lignes de presence par cascade. Le depart d'une partie commencee garde volontairement l'appartenance pour permettre la reprise. Aucun transfert de place par pseudo, aucune recreation automatique de session pour reprendre une partie. La liste locale des parties recentes contient seulement des codes, jamais cartes, tokens ou etats complets.

## Observation locale et traces

L'affichage des cartes des bots est exclusivement local : aucune option de commande HTTP ni aucun champ de projection en ligne ne permet de le demander. Les traces de coups ne stockent que des cartes deja jouees et des positions publiques, sans choix d'echange ou cartes des defausses completes. Elles restent reservees aux membres via viewFor et ne sont jamais publiees sur Realtime.

Les erreurs fournies par le navigateur mentionnent GrowthBook, absent du code et des dependances du projet. La CSP n'est pas elargie pour autoriser cette requete. Les messages techniques bruts, etats et identites ne sont pas ajoutes aux logs par l'ecran de recuperation.
