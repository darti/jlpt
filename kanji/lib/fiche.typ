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
#let RANGEES = (
  (taille: 22mm, cases: 4, modeles: (TRACE, TRACE-PALE)),
  (taille: 14mm, cases: 6, modeles: (TRACE-PALE,)),
  (taille: 9mm, cases: 9, modeles: (TRACE-PALE,)),
)

#let grille(glyphe, ecart: 1.2mm, entre-rangees: 3.4mm) = stack(
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

// --- phrase d'exemple annotee ----------------------------------------------
// Les furigana sont poses en GRILLE a deux rangees, pas en surimpression : la
// colonne fait alors la largeur du plus large des deux (base ou lecture), donc
// deux lectures voisines ne peuvent pas se chevaucher et la ligne de base reste
// commune. C'est l'inverse du choix de l'app, ou l'annotation est hors flux
// pour ne pas elargir la base — mais un ecran se relit en tapant, une page non.
#let phrase-annotee(phrase, taille: 7pt, taille-lecture: 5pt) = {
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
  text(size: 5.5pt, fill: INK-SOFT, font: JP-SANS)[#txt],
)

#let lectures(k) = {
  let on = on-readings(k)
  let kun = kun-readings(k)
  set text(size: 7.5pt)
  if on.len() > 0 { block(spacing: 1.1mm)[#badge("音") #h(1mm) #on.join("・")] }
  if kun.len() > 0 { block(spacing: 1.1mm)[#badge("訓") #h(1mm) #kun.join("・")] }
}

// Les mots ne sont pas une decoration : ils sont la raison d'apprendre le
// caractere. On en montre peu et en entier — lecture ET sens — plutot que
// beaucoup en abrege ; un mot sans lecture ne se prononce pas, un mot sans
// sens ne se retient pas.
#let mots(k, maxi: 6) = {
  let tous = words-for(name(k))
  let ws = tous.slice(0, calc.min(maxi, tous.len()))
  if ws.len() == 0 {
    let c = f(k, "jlpt:compound")
    if c != none { text(size: 6.5pt, fill: INK-SOFT)[#c] }
    return
  }
  set text(size: 6.8pt)
  for w in ws {
    block(spacing: 0.9mm, {
      text(size: 7.6pt)[#name(w)]
      text(size: 6pt, fill: INK-SOFT)[ #reading(w) ]
      linebreak()
      text(size: 6.2pt, fill: INK-SOFT)[#gloss(w)]
    })
  }
}

// --- la fiche --------------------------------------------------------------
#let fiche(k, chapitre: "", numero: 0, total: 0) = {
  let glyphe = name(k)
  let ex = example-for(glyphe)

  // Ancre pour les index : `metadata` ne s'imprime pas mais porte une
  // position, donc `query` rend un vrai numero de page — pas une estimation.
  // ⚠ L'etiquette se colle en syntaxe markup, COLLEE a l'element : ecrire
  // `#metadata(g) #label("fiche")` ne l'attache a rien, `query` rend une liste
  // vide et l'index s'imprime entierement en « — », sans la moindre erreur.
  [#metadata(glyphe)<fiche>]

  block(spacing: 0pt, {
    grid(
      columns: (1fr, auto),
      align: (left + horizon, right + horizon),
      text(size: 6pt, fill: INK-SOFT, font: JP-SANS)[#chapitre],
      context text(size: 6pt, fill: INK-SOFT, font: JP-SANS)[#numero / #total · p. #here().page()],
    )
    v(0.6mm)
    rule()
  })

  v(2.6mm)

  grid(
    columns: (56mm, 1fr),
    column-gutter: 4mm,
    {
      // En-tete du caractere : le glyphe a la taille ou l'on distingue les
      // traits, la glose juste a cote — c'est le couple qu'on veut memoriser.
      //
      // Le glyphe vit dans une BOITE plus grande que lui, et c'est le blanc
      // autour qui le rend saillant : colle a la glose et aux mots, il n'etait
      // qu'un mot de plus en gros. La boite est aussi ce qui donne le meme
      // aplomb a 一 et a 優 — l'interligne d'une police CJK varie avec le
      // glyphe, donc sans hauteur fixee la glose remonte ou descend d'une
      // fiche a l'autre.
      grid(
        columns: (26mm, 1fr),
        column-gutter: 5mm,
        align: (center + horizon, left + top),
        box(height: 26mm, align(center + horizon, text(size: 15.5mm)[#glyphe])),
        {
          v(2.5mm)
          text(size: 9pt, weight: "bold")[#gloss(k)]
          v(1.6mm)
          lectures(k)
        },
      )
      v(4mm)
      mots(k)
    },
    align(center + top, grille(glyphe)),
  )

  if ex != none {
    place(bottom + left, block(width: 100%, {
      rule()
      v(1mm)
      grid(
        columns: (auto, 1fr),
        column-gutter: 3.5mm,
        align: (left + bottom, left + bottom),
        phrase-annotee(f(ex, "jlpt:jp")),
        text(size: 6.2pt, fill: INK-SOFT)[#gloss(ex)],
      )
    }))
  }
}
