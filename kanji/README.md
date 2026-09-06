# 漢字 — cahier d'écriture pour reMarkable Paper Pro Move

Un livre PDF de **914 pages** au format portrait 92 × 163 mm (contenu tourné de 90°) : une fiche par kanji du référentiel N3 (810), avec l'ordre
des traits, le sens, les lectures 音/訓, les mots que le caractère permet de lire, et une
grille d'écriture à remplir au stylet. Composé avec **Typst**, directement depuis
`data/graph/`.

    bun tools/kanjivg/fetch.mjs && bun tools/kanjivg/strips.mjs   # diagrammes (une fois)
    bun run cahier          # → kanji/kanjis.pdf

Sans la première ligne, retirer `--input traits=oui` des commandes compose le livre **sans
les diagrammes** (909 pages, et pas de pages de crédits). Typst ne sait pas demander si un
fichier existe — `json()` sur un chemin absent est une **erreur de compilation** — donc la
présence des diagrammes se déclare, elle ne se devine pas.

## Deux passes, et la seconde tourne les pages

`bun run cahier` enchaîne **trois commandes `typst`**, rien d'autre :

    typst compile --root . --input traits=oui kanji/book.typ kanji/kanjis-paysage.pdf
    typst eval --root . --input traits=oui --in kanji/book.typ \
      'query(<chapitre>).map(it => it.value)' > kanji/.chapitres.json
    typst compile --root . --input source=/kanji/kanjis-paysage.pdf \
      --input plan=/kanji/.chapitres.json kanji/tourne.typ kanji/kanjis.pdf

Le livre se compose en **163 × 92 mm** (la dalle, en paysage), puis chaque page est reposée
pivotée de 90° sur une page **portrait de 92 × 163 mm** : la liseuse l'affiche alors plein
écran dans son orientation native, et c'est l'appareil qu'on tourne. La rotation est une
**composition Typst**, pas une retouche du PDF — le texte reste sélectionnable, Typst
incorpore les pages du PDF source au lieu de les rastériser.

Deux choses que la seconde passe ne peut pas deviner, et que le relevé `<chapitre>` lui
donne :

- **le nombre de pages** — le dernier enregistrement porte `titre: none` et sa page *est* le
  total, ce qui évite de compter des objets dans le PDF ;
- **les signets.** Incorporer des pages les perd tous, sans erreur. Ils sont reconstruits
  depuis le relevé (`hide()` garde l'élément et sa position sans rien imprimer). Sur 914
  pages, un livre sans signets ne se parcourt plus qu'en faisant défiler — le test vérifie
  qu'il en reste 62.

`--input sens=antihoraire` tourne dans l'autre sens. Par défaut le haut du contenu part à
droite : on tourne la liseuse vers la gauche pour lire.

`kanji/kanjis-paysage.pdf` reste sur le disque — c'est la source de la seconde passe, et
c'est aussi le livre à lire sur un écran large. Les deux sont gitignorés.

`typst` doit être sur le `PATH` (il n'est pas dans les dépendances bun ; la CI ne compose
donc pas le livre — `kanji/book.test.ts` saute cette partie quand le binaire est absent).
Le PDF est **gitignoré** : il se refait en huit secondes, et un binaire de 5,7 Mo versionné
serait exactement le dérivé désynchronisable que la migration vers le graphe a supprimé.

## Ordre des traits : la seule dépendance sous licence

Les diagrammes viennent de **[KanjiVG](https://kanjivg.tagaini.net/)** (© Ulrich Apel,
**CC BY-SA 3.0**), récupéré dans `.kanjivg/` — **gitignoré, jamais commité**, comme
`.jmdict/` et `.kanjidic/`.

Mais la ressemblance s'arrête là, et la différence est licencielle. JMdict et KANJIDIC2
servent à **proposer** : l'auteur arbitre, ses saisies entrent dans le graphe, rien de la
source n'est redistribué. **Un ordre de traits ne s'arbitre pas** — c'est un tracé, et
l'afficher, c'est le redistribuer. Conséquences, assumées et cantonnées :

- `data/graph/` n'est **pas** touché : l'app reste libre de toute attribution ;
- seul `kanji/kanjis.pdf` incorpore ces tracés. Il en est une **œuvre dérivée** :
  attribution (imprimée sur ses deux pages de crédits) et **ShareAlike si vous le
  distribuez**. Pour un cahier d'usage personnel, la question ne se pose pas ;
- ne pas lancer la chaîne suffit à retrouver un livre entièrement libre de cette contrainte.

`kanji/book.test.ts` garde l'invariant : `.gitignore` contient `.kanjivg/`, `git ls-files`
n'y voit rien, et `kanji.jsonld` ne mentionne pas KanjiVG. Un `.kanjivg/` commité par
mégarde changerait la licence du dépôt entier sans que rien ne le signale.

**La forme du diagramme** est une case par trait — le dernier en noir, les précédents en
gris — et non un caractère annoté de numéros : on veut voir où le trait commence et dans
quel sens il part, ce que des numéros ne disent qu'à qui connaît déjà l'ordre. La bande
occupe toute la largeur de la page et non la colonne de droite, par lisibilité : 22 traits
dans 91,6 mm feraient des cases de 4,2 mm, contre 7 mm sur 153.

Les tracés sont partagés par `<defs>` + `<use>` dans chaque SVG : sans ça un caractère de
22 traits répéterait ses tracés 253 fois. Le lot pèse 3,6 Mo, et n'ajoute que 0,8 Mo au PDF.

## Une seule molette : `ECHELLE`

Toutes les tailles de texte du livre passent par `P()` dans `lib/theme.typ`, et `P` ne fait
que multiplier par `ECHELLE` (**1,5** aujourd'hui). Les tailles en **millimètres** — le
caractère de la fiche, celui de la planche, le 漢字 du titre — n'y passent pas : ce sont
des dessins, dimensionnés par la place qu'on leur donne.

Sur une page de 163 × 92 mm, agrandir se paie en contenu par page, et le prix est réel :
à 1,5 une fiche porte **1 à 4 mots** au lieu de six, les familles de plus de 24 caractères
tiennent sur deux planches, le sommaire et le mode d'emploi passent à deux pages. Rien
n'est perdu — tout est reporté. Descendre à 1,25 rend la plupart des mots.

Aucune de ces limites n'est écrite en dur : le nombre de mots d'une fiche vient d'une
**mesure**, pas d'un calcul (voir plus bas), donc changer `ECHELLE` suffit.

## Le format n'est pas un choix esthétique

La dalle du Paper Pro Move fait 1696 × 954 px à 264 dpi, soit **163 × 92 mm en paysage** —
92 × 163 dans l'orientation native de l'appareil. Le PDF est produit à cette taille exacte :
la liseuse l'affiche alors sans marge grise ni recadrage. Toute autre proportion coûte de la surface utile — sur une page de 92 mm de
haut, deux millimètres perdus, c'est une rangée de la grille.

## Ce que contient une page

| Page | Rôle |
|---|---|
| Titre, mode d'emploi, sommaire | 5 pages ; le sommaire donne les pages réelles des 62 chapitres |
| Planche d'ouverture | les caractères de la famille avec leurs sens, en 8 colonnes — sert aussi de test de révision, gloses masquées |
| Fiche | en haut l'ordre des traits, pleine largeur ; à gauche le caractère, son sens, ses lectures et jusqu'à 6 mots (un par ligne, nombre ajusté à la place réelle) ; à droite 23 cases d'écriture en trois tailles ; en bas une phrase d'emploi, furigana compris, quand il en existe une |
| Index des lectures 音 | lecture (katakana) → caractère → page, en ordre gojūon |
| Index des sens | sens français → caractère → page, accents repliés pour le classement |
| Crédits | 2 pages, imprimées seulement si les diagrammes le sont — sans eux le livre n'emprunte rien |

### La grille : trois tailles, une par rangée

17 mm × 5 cases, 11 mm × 7, 7 mm × 11 — resserrées quand la bande d'ordre des traits est arrivée, qui prend 11 mm. On apprend un caractère en grand — c'est la seule
taille où l'on voit ce qu'on rate — mais on l'écrit petit : la dernière rangée est calibrée
sur l'écriture courante, et c'est là que vingt traits deviennent vraiment difficiles. Une
grille d'une seule taille entraîne une main qu'on n'emploiera jamais.

Modèle franc puis modèle pâle sur la première rangée, modèle pâle seul en tête des deux
autres ; le reste est vide. Les pointillés en croix servent à **placer** les traits.

Les largeurs sont calées sur les 91,6 mm de la colonne (89,8 / 84,2 / 89,0 mm). Changer une
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
- **`place` ne réserve aucune place.** La phrase d'exemple est posée en `place(bottom)` :
  un bloc de mots trop haut passerait dessous **sans erreur**. Le nombre de mots est donc
  borné par `measure()`, qui en retire par la fin tant que le bloc dépasse.
- **La place restante se LIT, elle ne se calcule pas.** Une première version du budget
  additionnait en-tête + caractère + glose + blancs : elle se trompait de **17 mm**, parce
  que la hauteur de ligne d'un texte ne vaut pas sa taille de police et que l'écart varie
  avec `ECHELLE`. Le budget part maintenant de `here().position().y` — la position réelle
  du bloc — moins la hauteur mesurée de la bande du bas.
- **Un `box` ne coupe pas les lignes.** Les entrées d'index étaient des `box` : un libellé
  plus large que sa colonne débordait sur la voisine, en silence. Ce sont des `block`.
- **Un `grid` à deux colonnes ne se rééquilibre pas** quand il passe sur une seconde page :
  la première colonne se vide et la seconde déborde. Le mode d'emploi est en `columns`.
- **Un mot français long ne se coupe pas.** À l'échelle 1,5, « appréhender, » était plus
  large que le créneau de 26 mm laissé à côté du caractère et débordait dans la grille
  d'écriture. La colonne de gauche est donc entièrement **empilée** : caractère, glose,
  lectures et mots occupent chacun toute sa largeur.

## Vérifier une modification

    bun test kanji/book.test.ts   # données + licence + les deux passes (pages, format, signets)
    bun run cahier && ~/.local/bin/typst compile --root . --pages 1,3,4,5,876 kanji/book.typ /tmp/p{p}.png --ppi 180

Rendre les pages en PNG et **les regarder** : les quatre pannes ci-dessus sont toutes
passées au travers d'une compilation verte.
