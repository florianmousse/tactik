# Règles et décisions d’implémentation

Référence : PDF utilisateur `regles_JEU039_TAC-TIK_LEDELIRANT.pdf`, quatre pages lues visuellement. La photo utilisateur sert de référence pour les pions et l’ambiance, pas d’asset distribué.

## Configurations

| Joueurs | Couleurs | Organisation                  | Cartes par donne |
| ------- | -------- | ----------------------------- | ---------------- |
| 2       | 4        | Individuel, 2 couleurs chacun | 6                |
| 3       | 6        | Individuel, 2 couleurs chacun | 4                |
| 4       | 4        | 2 équipes de 2                | 4                |
| 6       | 6        | 3 équipes de 2                | 4                |

Le parcours est de 16 cases par secteur de couleur (64 ou 96 cases), avec quatre places dans chaque réserve et maison. Les partenaires sont opposés. L’hôte commence comme distributeur ; le joueur à sa gauche joue le premier. Le rôle de distributeur tourne à chaque nouvelle donne.

## Cartes

Paquet de 48 cartes, sans 13 ni Joker. Douze types : 1, 2, 3, -4, 5, 6, 7, 8, 9, 10, permutation, 12.

**Hypothèse à confirmer sur le paquet physique : quatre exemplaires de chaque type.** Le PDF précise le total mais pas les quantités par valeur ; la photo d’une autre édition indique 49 cartes. La version implémentée suit le total du PDF. Si la distribution physique diffère, adapter la construction du paquet dans `createGame` et le test de conservation.

- 1/10 : démarrer **ou** avancer, jamais les deux.
- -4 : reculer exactement quatre cases, sans entrer en marche arrière dans la maison.
- Permutation : un de ses pions/pieux du parcours avec un autre pion du parcours. Pieu adverse et pions en maison exclus ; ses propres pieux de couleurs différentes peuvent être permutés en individuel.
- 7 : un à quatre déplacements positifs, total exactement sept, chaque pion au plus une fois, une seule couleur. Tous les pions rencontrés sont capturés, même ses propres pions ou ceux du partenaire.
- Autres nombres : avancer exactement la valeur.

## Échange

Obligatoire après chaque donne. À 2, vers l’adversaire ; à 3, vers le joueur suivant ; en équipes, vers le partenaire. Les choix sont enregistrés séparément ; aucune carte n’est retirée ou ajoutée tant que tout le monde n’a pas choisi. Les clients voient seulement qui a validé, pas l’index ou la valeur.

## Parcours, pieux et maison

Un pion sorti de réserve est un pieu sur sa case de démarrage. Il ne peut être capturé ni dépassé, par personne. Il bloque aussi une autre sortie de sa propre réserve. Il ne peut entrer directement dans sa maison. Dès son premier déplacement ou sa permutation par son propriétaire, il devient ordinaire.

Hors 7, seule la pièce sur la destination est capturée. Un pion ordinaire peut être dépassé. Les captures renvoient en réserve. Dans les maisons, aucun dépassement, capture, permutation ou recul ; la valeur exacte est nécessaire. Le passage par sa case de démarrage est compté avant la première case de maison. Un recul peut permettre une entrée lors d’un prochain tour.

L’entrée en maison est un choix explicite `home: true` lorsqu’elle est accessible. Si la valeur ne permet pas l’entrée, le pion peut poursuivre sur le parcours conformément à l’exemple du PDF. Aucune obligation générale d’entrer dès que possible n’est ajoutée.

## Tour et fin

Un joueur ne peut défausser sans effet que si **aucune carte de sa main** ne permet un coup complet légal. Il peut être contraint de capturer ses propres pions. Une carte est consommée par tour. Quand toutes les mains sont vides, nouvelle distribution et échange ; la défausse est mélangée lorsque la pioche est épuisée.

En équipe, après avoir rentré ses quatre pions, on joue ceux du partenaire à partir du tour suivant. Une carte 7 ne peut donc pas commencer sur sa couleur et finir sur celle du partenaire. La victoire demande les huit pions de l’équipe (ou les huit pions de l’individu à 2/3).

## Hors périmètre

TOCK, Jokers, 13 et huit joueurs ne sont pas activés. Le plateau affiché est une interprétation elliptique du parcours pour conserver les cases visibles sur petit écran.
