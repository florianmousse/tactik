# Fonctionnement des bots

Les bots utilisent une heuristique déterministe avec un très petit départage aléatoire. Ils ne sont pas un modèle de langage et n'apprennent pas au fil des parties. Le même code fonctionne en solo et en ligne : `src/game/bots.ts`.

## Informations disponibles

Chaque décision reçoit uniquement `viewFor` pour le bot : sa main, les positions et pieux publics, les équipes, les compteurs de cartes, les coups légaux complets et sa mémoire privée décrite ci-dessous. Ni les mains adverses ou du partenaire, ni l'ordre de la pioche, ni les choix d'échange non résolus ne sont accessibles à sa stratégie. Observer ses cartes en solo ou comme administrateur ne change pas les informations reçues par le bot.

## Déroulement

Pendant l'échange, les bots sans choix confirmé passent chacun leur tour. Pendant le jeu, seul le bot dont c'est le tour agit. Il défausse toute sa main lorsque cette option est autorisée. Sinon, il évalue les options légales calculées par le moteur, y compris les valeurs du Joker et les séquences complètes du 7. Sans coup légal, il défausse la première carte. Le moteur revalide toujours le résultat.

## Classement des coups

1. Chaque option est simulée sur une copie des positions publiques. Les captures sur le chemin du 7 comptent aussi.
2. Les options sont d'abord triées par nombre de captures alliées croissant. Une option sans capture alliée passe toujours avant une option avec capture alliée, quel que soit son score. Si toute option impose une capture alliée, le bot doit jouer et minimise leur nombre.
3. Entre options avec le même nombre de captures alliées, le score suivant détermine le choix.

La valeur d'une position est -25 en réserve, le nombre de cases parcourues depuis son départ sur le circuit, et L + 60 + 12 × indice de case dans la maison (L vaut 64, 96 ou 128 ; indice de 0 à 3).

| Critère                                                 | Contribution                                 |
| ------------------------------------------------------- | -------------------------------------------- |
| Progression d'un pion allié, y compris partenaire       | Valeur après moins valeur avant              |
| Capture adverse                                         | +45 par pion                                 |
| Sortie de réserve alliée                                | +20, en plus de la progression               |
| Pieu allié devenu mobile                                | +6                                           |
| Déplacement adverse sans capture, notamment permutation | Moitié de sa progression soustraite          |
| Utilisation du Joker                                    | -8, pour le conserver à score proche         |
| Départage                                               | Nombre aléatoire entre 0 inclus et 0,1 exclu |

Exemple : sortir de réserve rapporte normalement 25 + 20 = 45 points. Avancer de cinq cases vaut généralement 5 points. Une entrée en maison reçoit un fort bonus par la formule de position. Le recul peut être favorisé s'il place le pion près de son entrée selon cette mesure circulaire.

## Echange tactique

Le bot simule chaque carte de sa main sur les positions publiques du destinataire. Il utilise les mêmes générateurs de coups légaux que le moteur, sans créer ni consulter une main adverse réelle. Un 7 doit être utilisable en totalité : aucun don n'est valorisé pour un petit segment impossible à compléter. Les pieux, maisons bloquées, captures alliées et changements de couleur contrôlée restent pris en compte.

| Résultat immédiat possible                           | Valeur pour le don                                |
| ---------------------------------------------------- | ------------------------------------------------- |
| Entrer un pion en maison                             | +140                                              |
| Progresser vers le fond de maison                    | +18 par case dans la maison                       |
| Sortir de réserve                                    | +45                                               |
| Terminer les couleurs actuellement contrôlées        | +450                                              |
| Préparer la finition du dernier pion au coup suivant | Jusqu'à +120 selon les cartes connues ou estimées |

Le bot retient le meilleur coup sans capture alliée pour chaque carte. Il compare l'intérêt pour le partenaire à sa propre perte : 35 % de la différence avec sa meilleure autre carte. Céder sa seule carte de démarrage alors que tous ses pions contrôlés sont en réserve coûte 200 points. Donner le Joker coûte 10 points supplémentaires. L'ancienne préférence de démarrage et de conservation du Joker ne sert plus que de petit départage (+2).

Cela favorise un 8 permettant une entrée exacte, un 2 qui débloque le fond de maison ou un 7 réparti légalement pour ranger plusieurs pions. A 2/3 joueurs, l'échange va à un adversaire : son bénéfice est soustrait au lieu d'être ajouté. Le bot cherche donc à limiter le cadeau tout en conservant ses cartes utiles.

## Mémoire privée et comptage

L'état sauvegarde une mémoire par joueur, mais `viewFor` n'en transmet que celle du demandeur. Les bots ne reçoivent toujours que leur projection.

- Après la résolution simultanée des échanges : carte donnée, carte reçue, destinataire, expéditeur et numéro de donne. Rien n'est révélé avant cette résolution.
- La carte donnée est tenue pour connue chez le destinataire jusqu'à ce qu'il joue une carte identique, défausse sa main ou passe à la nouvelle donne. S'il joue un exemplaire identique, le bot retire sa certitude même s'il pourrait rester un doublon.
- Chaque carte publiquement jouée ou défaussée individuellement incrémente un compteur. Un Joker annoncé comme 8 est compté comme Joker.
- Une défausse complète n'ajoute ses valeurs qu'à la mémoire de son propriétaire. Les autres mémoires savent uniquement que sa main est vide. Le calcul ne consulte pas le contenu de `discard` pour découvrir ces cartes.
- Les compteurs survivent aux nouvelles donnes et à la limite des 40 coups affichés. Ils sont remis à zéro lorsque la défausse est remélangée dans la pioche, y compris si cela arrive pendant une distribution.
- Les souvenirs de mains et d'échange sont effacés à chaque nouvelle donne. Les anciennes sauvegardes sans mémoire repartent sans inventer d'observations passées. Les mémoires sont conservées par les sauvegardes JSON et le CAS existants ; aucune migration SQL n'est nécessaire.

Pour chaque valeur, le nombre encore inconnu est le nombre initial d'exemplaires, moins les sorties observées, la main propre et les cartes données encore connues. Un paquet contient quatre exemplaires ordinaires et éventuellement un Joker ; à huit joueurs ces nombres doublent.

La chance qu'un joueur possède au moins une des cartes utiles est estimée par tirage sans remise dans cet ensemble inconnu, en tenant compte du nombre de cartes qu'il possède. L'ensemble inclut la pioche et les défausses complètes dont le contenu est inconnu : c'est une approximation, pas une lecture des mains ni une probabilité parfaitement calibrée. Zéro exemplaire possible signifie zéro chance ; un exemplaire possible ne signifie pas qu'il est distribué, ni qu'il est chez le partenaire. Une carte donnée et pas encore jouée fournit au contraire une information certaine.

## Fin de partie commune

Lorsqu'il ne reste qu'un pion de l'équipe hors maison, le bot recherche, pour chaque coup candidat, les cartes qui permettraient de finir au coup suivant depuis la position résultante. Il utilise ses cartes restantes, la carte connue chez le partenaire et les estimations des autres cartes du partenaire. Il vérifie quel joueur peut réellement contrôler la couleur.

Une victoire immédiate reçoit +2000. Une suite gagnante ajoute jusqu'à 480 points si elle repose sur sa propre main, ou 540 points si elle repose sur le partenaire, pondérés par la probabilité. Le nombre de captures alliées reste le premier critère du classement. Le calcul du don utilise également une continuation pour le dernier pion des couleurs contrôlées, en retirant la carte donnée de la main disponible.

Exemple : pour une entrée à huit cases, 5 puis 3 et 6 puis 2 ne sont plus équivalents. Si les quatre 3 ont été vus depuis le dernier remélange, le bot privilégie 6 puis 2 lorsqu'un 2 reste possible. S'il sait avoir donné un 3 à son partenaire, il peut préparer 5 puis ce 3. Si les quatre 2 ont été vus, il préfère la piste 5 puis 3. Les suites sont simulées avec les contraintes réelles des maisons et du 7.

## Limites et rythme

La recherche anticipée est limitée à une carte supplémentaire autour du dernier pion. Le bot ne résout pas toute la donne, ne simule pas les réponses adverses intermédiaires et ne suppose pas que le partenaire suivra toujours son idée. Les déplacements ou captures entre les deux tours peuvent invalider une suite. Le bot ne mémorise pas un profil comportemental des adversaires et n'apprend pas ses coefficients.

Le navigateur attend trois secondes avant de déclencher le prochain bot, en local comme en ligne, pour laisser lire les déplacements. En ligne le serveur calcule un seul pas, utilise son hasard cryptographique et sauvegarde par CAS. Plusieurs navigateurs peuvent déclencher le même tour, mais une seule version peut être enregistrée. Sans navigateur humain connecté, les bots attendent. Le délai est un confort visuel, pas une règle de sécurité.
