# Buienradar

**Connecteur non officiel, sans lien avec Buienradar.** Il fait de
[Buienradar](https://www.buienradar.nl) le fournisseur météo de Gladys pour
les **Pays-Bas et la Belgique**, et ajoute ce qui fait la réputation de
Buienradar : la pluie des deux prochaines heures, par pas de 5 minutes. Ni
compte, ni clé, rien à saisir. Données :
[Buienradar.nl](https://www.buienradar.nl) ; Buienradar et ses données sont
© Buienradar / RTL.

## Ce que vous obtenez

| Surface                   | Contenu                                                                                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Météo** de Gladys       | la météo actuelle de la station Buienradar la plus proche (température, ressenti, humidité, pression, vent et rafales, visibilité, point de rosée, lever et coucher du soleil) et les prévisions à 5 jours, pour le widget météo et la discussion avec Gladys |
| **Radar de pluie**        | les cartes radar de Buienradar des Pays-Bas et de la Belgique, dans le widget météo                                                                                                                                                                           |
| Déclencheurs de scène     | **pluie attendue** d'ici 5 minutes à 2 heures (toute pluie, modérée ou forte), **pluie arrêtée**                                                                                                                                                              |
| Action de scène           | **pluie des 2 prochaines heures** d'une maison : sec ou non, minutes avant la pluie, pic, cumul, un résumé                                                                                                                                                    |
| Widget de tableau de bord | **Pluie des 2 prochaines heures** : prochaine pluie, pic, cumul et une barre toutes les 5 minutes                                                                                                                                                             |

Une fois installée, l'intégration prend le pas sur le service OpenWeather
intégré à Gladys. Le widget météo peut aussi la choisir explicitement.

## Couverture

- **Météo** : la quarantaine de stations que publie Buienradar sont toutes
  aux Pays-Bas. Une maison à moins de 80 km de l'une d'elles a sa météo
  (tout le pays, le nord de la Belgique, la frontière allemande). Plus
  loin, Gladys apprend que le lieu est hors couverture et passe à son
  fournisseur suivant.
- **Prévision de pluie et radar** : les Pays-Bas et la Belgique.
- Buienradar n'écrit ses descriptions qu'en néerlandais : les conditions de
  Gladys (ensoleillé, nuageux, pluie, neige…) sont lues dans les icônes de
  Buienradar, elles s'affichent donc dans votre langue.

## Installation

1. Installez l'intégration depuis le catalogue de Gladys (Gladys 5.1 ou
   plus récent) et acceptez l'accès à la **position de vos maisons** : les
   déclencheurs de pluie, l'action de scène et le widget les surveillent.
2. Vérifiez que votre maison est placée sur la carte (**Paramètres →
   Maisons**).
3. Dans l'écran **Configuration**, cliquez sur **Tester Buienradar** : le
   message nomme la station utilisée pour chaque maison et sa prévision de
   pluie.
4. Placez le widget **Pluie des 2 prochaines heures** sur un tableau de
   bord. Pour le radar, activez l'option « images du fournisseur » du
   widget météo.

## Configuration

- **Langue des textes des scènes** (anglais par défaut) — les résumés
  envoyés aux scènes, en anglais, en français ou en néerlandais.
- **Intervalle de vérification de la pluie** (5 minutes par défaut, 5 au
  minimum) — la fréquence de lecture de la prévision de pluie de chaque
  maison pour les déclencheurs. Buienradar la met à jour toutes les 5
  minutes.
- **Radar de pluie dans le widget météo** (activé par défaut).

## Scènes

- **Pluie attendue (Buienradar)** : choisissez **Pluie d'ici** (5, 10, 15
  ou 30 minutes, 1 ou 2 heures) et l'**intensité minimale** : toute pluie
  (dès 0,1 mm/h), modérée (2,5 mm/h) ou forte (10 mm/h). Facultatif : le
  nom exact de la **maison**. La scène s'exécute une fois par épisode de
  pluie, quand la prévision radar annonce pour la première fois cette
  pluie dans ce délai, pas à chaque vérification. Variables : `house`,
  `starts_in` (minutes), `start_time` (heure locale « 14:35 »),
  `max_intensity` (mm/h), `total_mm` et `summary`.
- **Pluie arrêtée (Buienradar)** : il pleuvait sur la maison et le radar
  annonce désormais au moins 15 minutes sèches. Variables : `house`,
  `next_rain_in` (vide quand les 2 prochaines heures sont sèches) et
  `summary`.

Rien ne se déclenche au démarrage : la première vérification ne fait
qu'apprendre la situation.

L'action **Pluie Buienradar des 2 prochaines heures** (champ **maison**,
vide pour la première maison localisée) donne `dry`, `raining`,
`minutes_until_rain`, `rain_time`, `minutes_until_dry`, `max_intensity`,
`total_mm` et `summary`, pour un message ou une condition qui suit.

Exemples : pluie d'ici 15 minutes → fermer le velux et envoyer « Rentrez le
linge : {{triggerEvent.data.summary}} » ; chaque matin à 7 h 30, envoyer le
résumé de l'action avant de partir à l'école.

## Fréquence de lecture de Buienradar

- Le flux météo : au plus une fois toutes les 10 minutes (Buienradar le
  rafraîchit toutes les 10 minutes), seulement quand Gladys demande la
  météo.
- La prévision de pluie : une fois par maison toutes les 5 minutes
  (l'option), partagée avec le widget et l'action de scène.
- Les cartes radar : seulement quand le widget météo les affiche, au plus
  toutes les 5 minutes.

## Dépannage

- **« Outside the Buienradar coverage »** : le lieu est à plus de 80 km
  d'une station Buienradar ; Gladys prend la météo chez son fournisseur
  suivant.
- **Aucun déclencheur de pluie** : la maison doit être localisée dans
  Gladys, aux Pays-Bas ou en Belgique ; l'état de l'intégration et le
  bouton **Tester Buienradar** indiquent les maisons surveillées.
- **« Buienradar ne répond pas »** : la dernière météo reste servie pendant
  une heure ; tout revient de soi-même.
- Logs : le niveau de log de l'intégration se règle avec la variable
  `LOG_LEVEL`.

## Confidentialité

Le flux météo et les cartes radar sont les mêmes pour tous : aucune
position n'est envoyée pour les obtenir. La prévision de pluie est demandée
pour les coordonnées de chaque maison arrondies à 2 décimales (environ
1 km).

## Données et conditions d'utilisation

Les données viennent de Buienradar.nl. Les conditions de Buienradar
autorisent un **usage non commercial avec mention de la source** :
buienradar.nl cité avec un lien vers
[www.buienradar.nl](https://www.buienradar.nl). Ce connecteur gratuit et
non commercial affiche « Données : Buienradar.nl » dans le widget, les
légendes du radar et l'écran de configuration. Gardez vous aussi un usage
non commercial (pas de service payant construit dessus).
