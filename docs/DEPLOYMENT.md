# Déployer sur Vercel avec Supabase

Ce guide part de zéro. Ne coller aucune clé secrète dans le chat, Git, une capture ou une issue. Les interfaces des fournisseurs peuvent changer de libellé ; les paramètres à rechercher sont indiqués ci-dessous.

## 1. Créer Supabase

1. Créer un compte sur [Supabase](https://supabase.com/dashboard) et un nouveau projet. Conserver le mot de passe de la base dans un gestionnaire de mots de passe.
2. Choisir une région proche des joueurs et, si possible, de la région des fonctions Vercel.
3. Dans le **SQL Editor**, exécuter le contenu complet de `supabase/migrations/202611180001_initial.sql` une seule fois. Les tables, permissions, fonctions et la publication Realtime sont créées ensemble.
4. Vérifier que les quatre tables ont RLS activé. Seule `room_events` doit figurer dans la publication `supabase_realtime` pour ce projet. **Ne pas ajouter `game_rooms`.**
5. Dans **Authentication / Sign In / Providers**, activer les connexions anonymes. Aucune connexion email n’est nécessaire pour le jeu.
6. Relever l’URL du projet, sa clé publique publishable (ou `anon`) et sa clé serveur `service_role` dans les paramètres API. La clé serveur reste dans les variables d’environnement du serveur.

Documentation : [connexions anonymes](https://supabase.com/docs/guides/auth/auth-anonymous), [Realtime et changements](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes).

## 2. Configurer le CAPTCHA

Le CAPTCHA protège **la création de sessions Supabase**, pas simplement le bouton du site. Les limites de l’API de jeu ne protègent pas un endpoint Auth Supabase directement appelé par un robot.

1. Créer un widget [Cloudflare Turnstile](https://dash.cloudflare.com/) pour le domaine de production et, au besoin, le domaine de test. Ajouter explicitement les domaines utilisés ; éviter des autorisations trop larges.
2. Conserver la **site key publique** pour `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Dans Supabase Auth, section protection contre les abus/CAPTCHA, sélectionner Turnstile, activer la protection et saisir la **secret key Turnstile**.
4. Régler également les limites de création de sessions anonymes dans Supabase Auth.
5. Tester qu’un appel de création de session sans CAPTCHA valide est refusé. La seule présence d’une site key dans Vercel ne prouve pas que cette protection serveur est active.

Le widget apparaît sur le formulaire lorsque la clé publique est renseignée. Le jeton est transmis à `signInAnonymously`, puis réinitialisé. Une session déjà existante est réutilisée.

Documentation : [CAPTCHA Supabase](https://supabase.com/docs/guides/auth/auth-captcha).

## 3. Connecter le développement local

Copier `.env.example` vers `.env.local`, puis renseigner les six variables. Générer `RATE_LIMIT_SECRET` (ne pas réutiliser une autre clé) :

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Le résultat est secret : le copier directement dans `.env.local` et les variables Vercel. Ne pas l’ajouter à la documentation ou au dépôt.

`APP_ORIGIN` doit correspondre exactement à l’URL utilisée : `http://localhost:3000` **ou** `http://127.0.0.1:3000`. Ces deux origines ne sont pas interchangeables pour la protection HTTP. Ne pas ajouter de slash final. Relancer `npm run dev` après toute modification des variables.

Pour des tests locaux connectés, utiliser un projet Supabase distinct du futur projet public et configurer un widget Turnstile adapté à l’hôte local. Le mode d’entraînement n’a besoin d’aucune clé.

## 4. Préparer le dépôt

Créer un dépôt Git chez l’hébergeur de votre choix et y pousser le projet. Vérifier que `.env.local`, `node_modules`, `.next` et `tmp` sont ignorés. Conserver `package-lock.json`, `AGENTS.md`, les migrations et toute la documentation.

Avant d’envoyer :

```sh
npm ci
npm run check
npm run build
npm audit
```

Une CI GitHub est fournie si le dépôt est hébergé sur GitHub. Elle vérifie les tests, TypeScript, le build et les avis de sécurité critiques/élevés sans utiliser de secrets Supabase.

## 5. Créer le projet Vercel

1. Sur [Vercel](https://vercel.com/new), importer le dépôt. Le framework détecté doit être **Next.js**.
2. Garder le répertoire racine du projet. Installation : `npm ci`. Build : `npm run build`. Pas d’export statique ; l’API exige des fonctions serveur.
3. Sélectionner Node.js 22 ou une version compatible supérieure.
4. Ajouter les six variables du README dans l’environnement **Production**. Définir `APP_ORIGIN` à l’URL exacte de production, par exemple `https://votre-projet.vercel.app`.
5. Configurer les domaines correspondants dans Turnstile et le Site URL Supabase Auth.
6. Déployer. Si le nom de domaine n’était connu qu’après la première création, corriger `APP_ORIGIN` et les domaines Turnstile, puis redéployer avant d’ouvrir le multijoueur.
7. Pour un domaine personnalisé, remplacer l’origine autorisée par ce domaine canonique et y rediriger les autres domaines. Ne pas autoriser des origines à partir d’un simple suffixe fourni par la requête.

Les variables `NEXT_PUBLIC_*` sont intégrées lors du build : leur modification nécessite un nouveau déploiement. La clé `service_role` et `RATE_LIMIT_SECRET` ne doivent jamais recevoir ce préfixe.

Les Preview Deployments doivent utiliser un projet Supabase de test et une origine explicite. Ne pas partager les secrets de production avec les builds de contributions externes. En l’absence de configuration, le mode local reste disponible mais l’API refuse les parties en ligne.

## 6. Vérifier avant ouverture publique

Sur un **projet de test** :

```sh
node --env-file=.env.local --import tsx --test tests/integration/supabase.test.ts
```

Les tests créent deux utilisateurs de test, un salon temporaire et leurs propres données, puis les suppriment. Ils exigent `RUN_SUPABASE_INTEGRATION=1` dans l’environnement. Ne pas les exécuter sur une base de production.

Puis suivre la recette de `docs/TESTING.md`, avec deux navigateurs/profils distincts, et contrôler :

- Aucune carte adverse ni pioche dans les réponses réseau ou Realtime.
- Un tiers ne peut ni lire ni modifier la partie.
- Le double-clic/la concurrence n’applique qu’une action.
- Le CAPTCHA est vérifié par Supabase, pas seulement affiché.
- La reprise fonctionne avec le même navigateur ; une autre session n’usurpe pas une place avec le même pseudo.
- Les réponses 403/409/429 sont visibles et compréhensibles dans l’interface.
- Le pare-feu/rate limiting de Vercel est configuré pour réduire les rafales sur `/api/game` avant qu’elles atteignent Supabase. Les quotas applicatifs n’évitent pas à eux seuls les coûts d’une attaque distribuée.

## 7. Rétention et entretien

Les salons expirent sept jours après création ; l’API refuse alors leurs lectures et modifications. Leur suppression physique n’est pas automatique tant que la tâche suivante n’est pas installée.

Activer l’extension **pg_cron / Supabase Cron** dans le dashboard, puis planifier (une seule fois) :

```sql
select cron.schedule(
  'taktik-cleanup',
  '17 * * * *',
  $$
    delete from public.game_rooms where expires_at < now();
    delete from public.rate_limits where resets_at < now() - interval '1 day';
  $$
);
```

Les membres et signaux sont supprimés par cascade. Cette tâche ne supprime pas les identités Supabase : définir séparément une politique de suppression des comptes anonymes inactifs (par exemple 30 jours), en excluant ceux associés à une partie encore valide et en utilisant l’API admin Supabase. Ne pas lancer une purge générale d’utilisateurs.

Activer des alertes de consommation et d’erreurs côté Vercel/Supabase, surveiller les limites Auth et Realtime, et faire les mises à jour de dépendances régulièrement. Vérifier les sauvegardes selon le plan choisi. Aucun prix ou quota gratuit n’est supposé garanti par ce dépôt.

## Dépannage

| Symptôme                              | Vérification                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Bouton multijoueur désactivé          | Variables publiques absentes au moment du build                                                 |
| 403 Origine refusée                   | URL exacte, protocole, port, `APP_ORIGIN`, redéploiement                                        |
| 503 Multijoueur non configuré         | Clé serveur, secret d’au moins 32 caractères, origine, clé Turnstile en production              |
| Connexion impossible                  | Auth anonyme activée, clés, domaine et secret CAPTCHA Supabase                                  |
| Création/sauvegarde indisponible      | Migration appliquée et clé serveur correcte ; examiner les logs sans divulguer les états privés |
| Mise à jour seulement toutes les 15 s | Publication `room_events`, RLS et Realtime activé                                               |
| 409                                   | Synchroniser ; une autre requête a gagné ou la table n’est pas encore prête                     |
| Place perdue                          | Session anonyme supprimée ou autre profil/navigateur ; un pseudo ne restaure pas une identité   |
