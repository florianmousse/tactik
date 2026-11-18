# Règles

Références : PDF utilisateur `regles_JEU039_TAC-TIK_LEDELIRANT.pdf`, photo du plateau à 6, et demandes explicites du propriétaire pour le Joker et la défausse complète.

## Configuration

| Joueurs | Couleurs | Organisation                     | Cartes par donne |
| ------- | -------- | -------------------------------- | ---------------- |
| 2       | 4        | Individuel, deux couleurs chacun | 6                |
| 3       | 6        | Individuel, deux couleurs chacun | 4                |
| 4       | 4        | Deux équipes de deux             | 4                |
| 6       | 6        | Trois équipes de deux            | 4                |
| 8       | 8        | Quatre équipes de deux           | 4                |

Quatre pions par couleur, quatre cases de maison, 16 cases de parcours par secteur : 64, 96 ou 128 cases. Les partenaires sont opposés. A 8 : rouge/jaune, noir/violet, blanc/orange, bleu/vert. Le premier distributeur est le créateur ; le joueur suivant commence. Le distributeur change à chaque donne.

Le SVG reprend les chemins, maisons, réserves et panneaux du plateau photographié. A 4, le panneau central est retiré ; à 8, un deuxième panneau central est ajouté. La géométrie est indépendante de la logique des positions et testée pour éviter les superpositions.

## Paquets et cartes

48 cartes ordinaires : quatre exemplaires de 1, 2, 3, -4, 5, 6, 7, 8, 9, 10, permutation et 12. Le PDF précise le total mais pas les quantités par type : la répartition uniforme reste à confirmer si le paquet physique diffère.

Le propriétaire a confirmé **1 Joker supplémentaire par paquet**. Option activée par défaut à la création des nouveaux salons. Un paquet jusqu'à 6 joueurs, deux à 8 : 49 ou 98 cartes avec Joker. Les parties déjà enregistrées conservent leur paquet initial.

- 1/10 : démarrer ou avancer, jamais les deux.
- -4 : reculer exactement quatre cases, sans entrer en marche arrière dans la maison.
- Permutation : son pion/pieu du parcours avec un autre pion du parcours. Pas de pieu adverse ni de pion en maison. En individuel, ses propres pieux de couleurs différentes peuvent être permutés.
- 7 : un à quatre déplacements positifs, total sept, une fois par pion, une seule couleur. Tous les pions rencontrés sont capturés, même les siens ou ceux du partenaire.
- Joker : annoncer une carte ordinaire, puis appliquer exactement ses règles, y compris démarrage, recul, permutation et partition du 7. Pas de 4 positif, 11 ou 13.
- Autres nombres : avancer exactement la valeur.

## Echange

Obligatoire à chaque donne. A 2, vers l'adversaire ; à 3, vers le joueur suivant ; en équipes, vers le partenaire. Les mains ne changent que lorsque tous les choix sont validés. Chaque joueur ne voit que les confirmations, pas les cartes ou indices choisis par les autres.

## Pieux, captures et maisons

Un pion sorti de réserve est un pieu sur sa case de démarrage. Il ne peut être capturé ni dépassé, même par son propriétaire. Il bloque une autre sortie de sa réserve et ne peut entrer directement dans sa maison. Son premier déplacement ou sa permutation par son propriétaire le transforme en pion ordinaire.

Hors 7, la capture se fait uniquement à destination. Les pions ordinaires peuvent être dépassés. Toute capture renvoie en réserve. Dans la maison : aucun dépassement, capture, permutation ou recul. La valeur exacte est nécessaire.

Le passage par sa case de démarrage est compté avant la première case de maison. Le recul peut faciliter une entrée à un tour ultérieur. L'entrée en maison est un choix explicite `home: true`. Si la valeur ne permet pas de rentrer, le pion peut continuer sur le parcours ; aucune obligation supplémentaire de rentrer n'est ajoutée.

## Défausse

Une carte peut être défaussée sans effet seulement si aucune carte de la main ne permet un coup complet légal. Jouer peut imposer de capturer son propre pion.

**Défausse de toute la main, règle demandée par le propriétaire :** uniquement pendant son tour, si tous les pions actuellement contrôlés sont en réserve, sans carte 1, 10 ou Joker. Cela vide la main et fait passer ses tours jusqu'à la prochaine donne.

La présence d'un pion sur le parcours interdit toujours cette option, même si un pieu empêche tout déplacement. Un mélange maison/réserve ne remplit pas non plus cette condition stricte. La défausse d'une seule carte reste disponible en cas de blocage complet.

Lorsque toutes les mains sont vides, distribution et échange. La défausse est mélangée quand la pioche est épuisée.

## Equipes, bots et victoire

Après avoir rentré ses quatre pions, un joueur contrôle ceux du partenaire aux tours suivants. Le 7 ne peut pas commencer sur sa couleur et finir sur celle du partenaire. Les huit pions de l'équipe doivent être en maison pour gagner ; en individuel, les huit pions du joueur.

Les bots ont les mêmes règles et ne reçoivent que leur projection privée. Ils privilégient les maisons et les sorties. Le serveur décide de leurs coups et applique un seul pas par commande protégée par version. Un navigateur humain peut demander le prochain pas, sans choisir les mouvements à la place du bot.

La variante TOCK et les cartes 13 ne sont pas activées.
