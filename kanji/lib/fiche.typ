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

// Premiere case : modele franc, a repasser. Deuxieme : modele pale, pour ecrire
// dessus sans s'appuyer dessus. Les suivantes : vides — c'est la seule qui
// prouve que le caractere est su.
#let grille(glyphe, colonnes: 4, lignes: 3, taille: 21mm, ecart: 1.2mm) = grid(
  columns: (taille,) * colonnes,
  rows: (taille,) * lignes,
  column-gutter: ecart, row-gutter: ecart,
  ..range(colonnes * lignes).map(i => {
    if i == 0 { case(taille, modele: glyphe, encre: TRACE) }
    else if i == 1 { case(taille, modele: glyphe, encre: TRACE-PALE) }
    else { case(taille) }
  }),
)

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
      v(0.8mm)
      text(size: 7pt)[#f(ex, "jlpt:jp")]
      h(2mm)
      text(size: 6.2pt, fill: INK-SOFT)[#gloss(ex)]
    }))
  }
}
