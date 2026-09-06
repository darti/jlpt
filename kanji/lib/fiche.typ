#import "theme.typ": *
#import "data.typ": *

// --- grille d'ecriture -----------------------------------------------------
// Une case de 田字格 : cadre plein, guides en croix pointilles, et un modele
// optionnel a repasser au stylet. Les guides sont ce qui rend la case utile —
// sans eux on recopie une forme, avec eux on place les traits.
#let case(taille, modele: none, encre: TRACE) = box(
  width: taille, height: taille,
  stroke: 0.4pt + GRID,
  {
    let g = (paint: GUIDE, thickness: 0.3pt, dash: "densely-dotted")
    place(center + horizon, line(length: taille, stroke: g))
    place(center + horizon, line(angle: 90deg, length: taille, stroke: g))
    if modele != none {
      // 0.78 : au-dela le glyphe deborde des guides, en deca la case parait vide.
      place(center + horizon, dy: 0.04 * taille, text(size: 0.78 * taille, fill: encre)[#modele])
    }
  },
)

// TROIS TAILLES, une par rangee. On apprend un caractere en GRAND — c'est la
// seule taille ou l'on voit ce qu'on rate — mais on l'ECRIT en petit. Une
// grille d'une seule taille entraine une main qu'on n'emploiera jamais : la
// derniere rangee est calibree sur l'ecriture courante, celle d'une prise de
// notes, et c'est la que 22 traits deviennent vraiment difficiles.
//
// Premiere case de la premiere rangee : modele franc, a repasser. Deuxieme :
// modele pale, pour ecrire dessus sans s'appuyer dessus. Les rangees suivantes
// n'ouvrent que sur un modele pale — passe la taille, c'est de memoire.
//
// Les largeurs sont calees sur les 93 mm de la colonne : 91,6 / 90,0 / 90,6.
// Toucher une taille ou un nombre de cases sans refaire le calcul pousse la
// rangee hors de la page — et une rangee tronquee ne leve aucune erreur.
// Largeurs calees sur les 91,6 mm de la colonne : 89,8 / 84,2 / 89,0. Les
// hauteurs, elles, ont ete reprises quand la bande d'ordre des traits est
// arrivee en haut de page : elle prend 11 mm, qu'il a fallu rendre.
#let RANGEES = (
  (taille: 17mm, cases: 5, modeles: (TRACE, TRACE-PALE)),
  (taille: 11mm, cases: 7, modeles: (TRACE-PALE,)),
  (taille: 7mm, cases: 11, modeles: (TRACE-PALE,)),
)

#let grille(glyphe, ecart: 1.2mm, entre-rangees: 2.8mm) = stack(
  dir: ttb,
  spacing: entre-rangees,
  ..RANGEES.map(r => grid(
    columns: (r.taille,) * r.cases,
    column-gutter: ecart,
    ..range(r.cases).map(i => if i < r.modeles.len() {
      case(r.taille, modele: glyphe, encre: r.modeles.at(i))
    } else {
      case(r.taille)
    }),
  )),
)

// --- ordre des traits ------------------------------------------------------
// Une case par trait, le dernier en noir, les precedents en gris : on voit ou
// le trait COMMENCE et dans quel sens il part, ce qu'un caractere annote de
// numeros ne montre qu'a qui connait deja l'ordre.
//
// La bande occupe toute la largeur de la page, pas la colonne de droite, et
// c'est une contrainte de lisibilite : 22 traits dans 91,6 mm donneraient des
// cases de 4,2 mm. Sur 153 mm elles font 7 mm au pire, 8 mm des que le
// caractere en compte 18 ou moins — soit 800 des 810.
#let CASE-TRAIT = 8mm

#let ordre-des-traits(ch) = {
  let b = bande-traits(ch)
  if b == none { return none }
  align(center, image(b.chemin, width: calc.min(CASE-TRAIT * b.traits, LARGEUR-UTILE)))
}

// --- phrase d'exemple annotee ----------------------------------------------
// Les furigana sont poses en GRILLE a deux rangees, pas en surimpression : la
// colonne fait alors la largeur du plus large des deux (base ou lecture), donc
// deux lectures voisines ne peuvent pas se chevaucher et la ligne de base reste
// commune. C'est l'inverse du choix de l'app, ou l'annotation est hors flux
// pour ne pas elargir la base — mais un ecran se relit en tapant, une page non.
#let phrase-annotee(phrase, taille: P(7), taille-lecture: P(5)) = {
  let segs = segments-furigana(phrase)
  grid(
    columns: (auto,) * segs.len(),
    row-gutter: 0.2mm,
    align: center + bottom,
    ..segs.map(s => if s.lecture == none { [] } else {
      text(size: taille-lecture, fill: INK-SOFT)[#s.lecture]
    }),
    ..segs.map(s => text(size: taille)[#s.base]),
  )
}

// --- blocs de la colonne gauche --------------------------------------------
#let badge(txt) = box(
  inset: (x: 1.1mm, y: 0.5mm),
  radius: 0.6mm,
  fill: luma(232),
  text(size: P(5.5), fill: INK-SOFT, font: JP-SANS)[#txt],
)

#let lectures(k) = {
  let on = on-readings(k)
  let kun = kun-readings(k)
  set text(size: P(7.5))
  if on.len() > 0 { block(spacing: 1.1mm)[#badge("音") #h(1mm) #on.join("・")] }
  if kun.len() > 0 { block(spacing: 1.1mm)[#badge("訓") #h(1mm) #kun.join("・")] }
}

// Les mots ne sont pas une decoration : ils sont la raison d'apprendre le
// caractere. On en montre peu et en entier — lecture ET sens — plutot que
// beaucoup en abrege ; un mot sans lecture ne se prononce pas, un mot sans
// sens ne se retient pas.
// Largeur utile de la colonne de gauche, et budget vertical du bloc de mots.
// Les deux servent a MESURER : la phrase d'exemple est posee en `place`, donc
// elle ne reserve aucune place — un bloc de mots trop haut passerait dessous
// sans qu'aucune erreur ne soit levee.
#let COL-GAUCHE = 56mm
#let MOTS-MAX = 6
#let ECART-MOTS = 2.4mm
// `measure` sous-estime legerement un bloc de plusieurs paragraphes : la marge
// absorbe l'ecart, verifie sur les fiches les plus chargees du corpus.
#let MARGE-SECURITE = 2mm

#let _ligne-mot(w) = block(spacing: ECART-MOTS, {
  text(size: P(7.6))[#name(w)]
  text(size: P(6), fill: INK-SOFT)[ #reading(w) ]
  h(1.4mm)
  text(size: P(6.2), fill: INK-SOFT)[#gloss(w)]
})

// Un mot par LIGNE — mot, lecture et sens ensemble — plutot que sur deux.
// Le sens en dessous doublait la hauteur de chaque entree, si bien que six
// mots remplissaient la colonne et que l'ecart entre eux ne pouvait plus etre
// que d'un millimetre : la liste se lisait comme un pave. Sur une ligne, le
// meme espace vertical sert a SEPARER les mots au lieu de les couper en deux.
//
// Le nombre affiche s'ADAPTE : on mesure et on retire par la fin tant que le
// bloc depasse le budget. C'est ce qui autorise un ecart genereux sans parier
// sur la longueur des gloses — 「約束した やくそくした promesse, rendez-vous」
// passe a la ligne, 「政 せい politique」 non.
// Le nombre de mots s'ADAPTE a la place qui reste, et cette place est celle que
// la mise en page lui DONNE — pas une soustraction de hauteurs prevues.
//
// ⚠ Une version precedente calculait « hauteur utile moins en-tete moins
// caractere moins glose moins blancs » : elle se trompait de 17 mm, la hauteur
// de ligne d'un texte ne valant pas sa taille de police. Une autre lisait
// `here().position().y`, ce qui etait juste mais cesse de l'etre des que la
// page est pivotee. La bonne reponse est la rangee `1fr` de la colonne : sa
// hauteur EST la place restante, et `layout()` la donne.
#let mots(k, dispo) = {
  let tous = words-for(name(k))
  if tous.len() == 0 {
    let c = f(k, "jlpt:compound")
    if c != none { text(size: P(6.5), fill: INK-SOFT)[#c] }
    return
  }
  let bloc(n) = block(width: COL-GAUCHE, tous.slice(0, n).map(_ligne-mot).join())
  let n = calc.min(MOTS-MAX, tous.len())
  while n > 1 and measure(bloc(n)).height > dispo - MARGE-SECURITE { n -= 1 }
  bloc(n)
}

// --- la fiche --------------------------------------------------------------
// Quatre rangees, dont UNE en `1fr` : en-tete, ordre des traits, corps, phrase.
// C'est la grille qui distribue la hauteur, et la rangee elastique est le corps
// — donc la colonne de mots recoit exactement ce que les trois autres laissent.
// Rien n'est calcule, rien n'est place en absolu : la fiche se compose aussi
// bien droite que pivotee.
#let fiche(k, chapitre: "", numero: 0, total: 0) = {
  let glyphe = name(k)
  let ex = example-for(glyphe)

  // Ancre pour les index : `metadata` ne s'imprime pas mais porte une
  // position, donc `query` rend un vrai numero de page — pas une estimation.
  // ⚠ L'etiquette se colle en syntaxe markup, COLLEE a l'element : ecrire
  // `#metadata(g) #label("fiche")` ne l'attache a rien, `query` rend une liste
  // vide et l'index s'imprime entierement en « — », sans la moindre erreur.
  [#metadata(glyphe)<fiche>]

  let entete = {
    grid(
      columns: (1fr, auto),
      align: (left + horizon, right + horizon),
      text(size: P(6), fill: INK-SOFT, font: JP-SANS)[#chapitre],
      context text(size: P(6), fill: INK-SOFT, font: JP-SANS)[#numero / #total · p. #here().page()],
    )
    v(0.6mm)
    rule()
  }

  // Colonne de gauche EMPILEE, tout sur la pleine largeur : glyphe, glose,
  // lectures, mots. Rien n'est plus pose « a cote » du caractere.
  //
  // C'est la mise en page qu'impose l'echelle. A cote du glyphe il ne restait
  // que 26 mm : la glose y debordait dans la grille d'ecriture — un mot
  // francais long ne se coupe pas — et 「かえり(みる)」 s'y brisait en laissant
  // 「る)」 seul sur une ligne. Les deux pires cas du corpus sont mesures :
  // glose de 32 caracteres (省), lecture kun de 22 demi-chasses (試, 優).
  let tete = {
    box(width: 100%, height: 19mm, align(center + horizon, text(size: 14mm)[#glyphe]))
    v(2.5mm)
    text(size: P(9), weight: "bold")[#gloss(k)]
    v(1.8mm)
    lectures(k)
  }

  let traits = ordre-des-traits(glyphe)

  grid(
    rows: (auto, auto, 1fr, auto),
    row-gutter: 0mm,
    block(width: 100%, { entete; v(2.6mm) }),
    if traits == none { [] } else { block(width: 100%, { traits; v(3mm) }) },
    grid(
      columns: (COL-GAUCHE, 1fr),
      column-gutter: 4mm,
      grid(
        rows: (auto, 1fr),
        row-gutter: 3mm,
        tete,
        layout(place-restante => mots(k, place-restante.height)),
      ),
      align(center + top, grille(glyphe)),
    ),
    if ex == none { [] } else {
      block(width: 100%, {
        v(1.5mm)
        rule()
        v(1mm)
        grid(
          columns: (auto, 1fr),
          column-gutter: 3.5mm,
          align: (left + bottom, left + bottom),
          phrase-annotee(f(ex, "jlpt:jp")),
          text(size: P(6.2), fill: INK-SOFT)[#gloss(ex)],
        )
      })
    },
  )
}
