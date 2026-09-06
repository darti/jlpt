# 漢字 — cahier d'écriture pour reMarkable Paper Pro Move

Un livre PDF de **889 pages** : une fiche par kanji du référentiel N3 (810), avec sens,
lectures 音/訓, les mots que le caractère permet de lire, et une grille d'écriture à
remplir au stylet. Composé avec **Typst**, directement depuis `data/graph/`.

    bun run cahier          # → kanji/book.pdf
    bun run cahier:watch    # recompose à chaque édition

`typst` doit être sur le `PATH` (il n'est pas dans les dépendances bun ; la CI ne compose
donc pas le livre — `kanji/book.test.ts` saute cette partie quand le binaire est absent).
Le PDF est **gitignoré** : il se refait en huit secondes, et un binaire de 5,7 Mo versionné
serait exactement le dérivé désynchronisable que la migration vers le graphe a supprimé.

## Le format n'est pas un choix esthétique

La dalle du Paper Pro Move fait 1696 × 954 px à 264 dpi, soit **163 × 92 mm en paysage**.
Le PDF est composé à cette taille exacte : la liseuse l'affiche alors sans marge grise ni
recadrage. Toute autre proportion coûte de la surface utile — sur une page de 92 mm de
haut, deux millimètres perdus, c'est une rangée de la grille.

## Ce que contient une page

| Page | Rôle |
|---|---|
| Titre, mode d'emploi, sommaire | 3 pages ; le sommaire donne les pages réelles des 62 chapitres |
| Planche d'ouverture | les caractères de la famille avec leurs sens, en 8 colonnes — sert aussi de test de révision, gloses masquées |
| Fiche | à gauche le caractère, son sens, ses lectures et jusqu'à 6 mots ; à droite 19 cases d'écriture en trois tailles ; en bas une phrase d'emploi, furigana compris, quand il en existe une |
| Index des lectures 音 | lecture (katakana) → caractère → page, en ordre gojūon |
| Index des sens | sens français → caractère → page, accents repliés pour le classement |

### La grille : trois tailles, une par rangée

22 mm × 4 cases, 14 mm × 6, 9 mm × 9. On apprend un caractère en grand — c'est la seule
taille où l'on voit ce qu'on rate — mais on l'écrit petit : la dernière rangée est calibrée
sur l'écriture courante, et c'est là que vingt traits deviennent vraiment difficiles. Une
grille d'une seule taille entraîne une main qu'on n'emploiera jamais.

Modèle franc puis modèle pâle sur la première rangée, modèle pâle seul en tête des deux
autres ; le reste est vide. Les pointillés en croix servent à **placer** les traits.

Les largeurs sont calées sur les 93 mm de la colonne (91,6 / 90,0 / 90,6 mm). Changer une
taille ou un nombre de cases sans refaire le calcul pousse la rangée hors de la page — et
**une rangée tronquée ne lève aucune erreur**.

### Furigana des phrases d'exemple

Même algorithme que `src/lib/dict.ts#furi` : recherche gourmande dans le dictionnaire,
confinée au run de kanji (富士山 est essayé avant 富士 puis 富), et **uniquement** des
lectures tout en kana propre — les entrées mono-kanji portent parfois un vidage on/kun
(« ユウ・やさ(しい)・すぐ(れる) »), absurde en furigana et si large qu'il déformerait la base.
386 des 416 runs annotables le sont (92,8 %) ; les autres s'impriment en clair, un kanji
sans lecture valant mieux qu'une lecture fausse.

Le rendu, lui, **diffère** de l'app à dessein : ici les lectures sont posées en grille à
deux rangées, donc la colonne fait la largeur du plus large des deux et deux lectures
voisines ne peuvent pas se chevaucher. L'app les met hors flux pour ne pas élargir la base
— un écran se relit en tapant dessus, une page non.

## Progression : celle du graphe, pas une autre

Les 51 leçons `jlpt:track = "kanji"` de `lesson.jsonld` sont déjà groupées par famille de
radical (「Famille 氵 — eau」) et déjà ordonnées par `jlpt:order`. Le livre les suit
telles quelles : un cahier qui contredirait l'ordre d'apprentissage de l'app
désapprendrait ce qu'elle enseigne.

Ces leçons couvrent **551 kanji sur 810**. Le graphe ne portant aucune donnée de
décomposition, inventer une famille aux 259 restants reviendrait à se tromper en silence :
ils sont donc réunis dans 11 chapitres « hors famille », classés par **productivité** — le
nombre de mots du référentiel qui les emploient. C'est mesuré, et ça met en tête les
caractères qui rendent le plus de mots lisibles (日, 一, 大, 人, 気…).

> **Piste d'amélioration la plus rentable** : une chaîne d'arbitrage des radicaux, sur le
> modèle de `readings.mjs` (KRADFILE/EDRDG, même éditeur et même licence que JMdict et
> KANJIDIC2, donc même invariant : la source sert à **décider**, elle n'entre pas dans le
> graphe). Elle ferait passer les 259 orphelins dans de vraies familles.

## Les mots viennent de la présence du caractère, pas de l'arête `usesKanji`

L'arête `usesKanji` du graphe est **incomplète** : `泳ぐ` et `泳ぎ` existent dans
`word.jsonld` et ne la portent pas. S'y fier laissait **180 fiches sans le moindre mot** ;
la présence du caractère dans le mot en laisse **12**. Ce n'est pas une heuristique — c'est
une recherche exacte de sous-chaîne, et un mot qui contient 泳 emploie 泳.

Un mot n'est retenu que s'il porte **à la fois** une lecture et une glose : le référentiel
a longtemps charrié des entrées minées depuis les options de quiz (cf. la chaîne
`purge-words`). Les composés de deux caractères passent en premier — c'est l'unité qu'on
apprend et qu'on réemploie ; les entrées d'un seul caractère passent en dernier, parce que
「泳」lu およ n'est pas un mot.

`kanji/book.test.ts` fige les deux mesures (12 et 180) **côte à côte** : le test
redeviendrait vert en silence si la fiche repassait à l'arête.

## Pièges Typst payés ici — à ne pas repayer

- **Un chaînage `.methode()` en début de ligne n'est pas rattaché au `#let`.** Typst clôt
  l'expression au saut de ligne et lit la suite comme du **markup**, qui s'imprime dans le
  document. Le filtre disparaît sans erreur : `LESSONS` a un moment renvoyé les 92 leçons
  au lieu des 51. Toute chaîne multiligne est **entre parenthèses**, ou sur une ligne.
- **Une étiquette se colle à l'élément, sans espace** : `#metadata(g)<fiche>`. Écrire
  `#metadata(g) #label("fiche")` ne l'attache à rien — `query` rend une liste vide et
  l'index s'imprime **entièrement en « — »**, sans la moindre erreur. D'où l'`assert` de
  `pages-des-fiches()` : une table de repérage fausse se lit comme une table juste.
- **`context { … }` rend du CONTENU, pas la valeur construite dedans.** Un
  `.at(clé, default: …)` sur ce contenu ne jette pas : il rend le défaut. C'est la seconde
  moitié de la même panne d'index.
- **L'interligne d'une police CJK à 7,5 mm atteint 10 mm.** La planche d'ouverture
  débordait, et la quatrième rangée de gloses disparaissait en bas de page sans erreur :
  les glyphes sont dans des boîtes de **hauteur fixée**.
- **Le titre de planche EST le `heading` de niveau 1**, sinon `outline` ne trouve rien et
  le sommaire sort **vide** — c'est aussi ce qui donne les signets du PDF.
- **Une closure ne peut pas modifier une variable de la portée englobante.** La
  segmentation des furigana accumule donc en deux passes (découpage brut, puis fusion des
  morceaux non annotés) plutôt qu'avec un `vider()` sur un tampon.

## Vérifier une modification

    bun test kanji/book.test.ts   # contrat de données + compilation réelle
    bun run cahier && ~/.local/bin/typst compile --root . --pages 1,3,4,5,876 kanji/book.typ /tmp/p{p}.png --ppi 180

Rendre les pages en PNG et **les regarder** : les quatre pannes ci-dessus sont toutes
passées au travers d'une compilation verte.
