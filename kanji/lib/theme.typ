// Gabarit du livre — reMarkable Paper Pro Move, 7,3".
//
// La dalle fait 1696 x 954 px a 264 dpi, soit 163,1 x 91,7 mm. On arrondit a
// 163 x 92 mm : un PDF au format EXACT de la dalle s'affiche sans marge grise
// ni recadrage, ce qui compte sur liseuse ou l'ajustement est fait une fois
// pour toutes. Toute autre proportion coute de la surface utile.
//
// ⚠ LA PAGE EST PORTRAIT (92 x 163), LE CONTENU EST PAYSAGE (163 x 92).
//
// La liseuse est haute : un PDF portrait s'y affiche plein ecran, et c'est
// l'appareil qu'on tourne pour lire. Chaque page est donc composee dans un bloc
// paysage, pose pivote de 90 degres par `tournee()` — en UNE passe, sans PDF
// intermediaire. C'est ce qui oblige le livre a paginer lui-meme ce qui
// « coulerait » autrement (index, sommaire, prose) : un bloc pivote ne se
// repartit pas tout seul sur plusieurs pages.
#let PAGE-W = 163mm
#let PAGE-H = 92mm
#let MARGIN-X = 5mm
#let MARGIN-Y = 4mm
#let LARGEUR-UTILE = PAGE-W - 2 * MARGIN-X
#let HAUTEUR-UTILE = PAGE-H - 2 * MARGIN-Y

// Encre : l'e-ink couleur du Paper Move rend les teintes tres pales. On reste
// donc en niveaux de gris, sauf UN accent, reserve aux reperes de lecture.
#let INK = rgb("#000000")
#let INK-SOFT = rgb("#555555")
#let RULE = rgb("#8a8a8a")
#let GRID = rgb("#9a9a9a")
#let GUIDE = rgb("#c8c8c8")
#let TRACE = rgb("#bdbdbd")   // modele a repasser au stylet
#let TRACE-PALE = rgb("#e6e6e6")
#let ACCENT = rgb("#1f4e79")

// Polices : mincho d'abord — c'est la forme de reference d'un caractere
// imprime, celle dont les pleins et delies montrent la structure des traits.
// La liste est une CASCADE : typst descend glyphe par glyphe, donc la machine
// de l'auteur (Hiragino) et la CI (IPA) rendent le meme document.
#let JP-SERIF = (
  "Libertinus Serif",
  "Hiragino Mincho ProN", "Noto Serif CJK JP", "Noto Serif JP",
  "YuMincho", "IPAMincho", "IPAexMincho",
  "Hiragino Sans", "Noto Sans CJK JP", "IPAGothic",
)
#let JP-SANS = (
  "Libertinus Serif",
  "Hiragino Sans", "Noto Sans CJK JP", "Noto Sans JP", "IPAGothic",
)

// ECHELLE — le facteur de TOUTES les tailles de texte du livre, en un seul
// endroit. Sur une page de 163 x 92 mm, agrandir se paie forcement en contenu
// par page : monter ce nombre reduit le nombre de mots par fiche, ajoute des
// pages d'index et peut faire tenir une planche sur deux pages. C'est un
// arbitrage, pas un reglage — mais il se refait en changeant un chiffre.
//
// Les tailles en MILLIMETRES (le glyphe de la fiche, celui de la planche, le
// 漢字 du titre) ne passent PAS par ici : ce sont des dessins, pas du texte,
// et ils sont dimensionnes par la place qu'on leur donne.
#let ECHELLE = 1.5
#let P(taille) = taille * ECHELLE * 1pt

#let apply-theme(doc) = {
  // Page PORTRAIT et marge NULLE : les marges vivent dans `tournee()`, a
  // l'interieur du bloc pivote, sans quoi elles seraient prises dans le mauvais
  // sens.
  set page(width: PAGE-H, height: PAGE-W, margin: 0pt, fill: white)
  set text(font: JP-SERIF, size: P(8), fill: INK, lang: "fr")
  set par(leading: 0.55em, justify: false)
  // Explicite : une page composee dans un bloc pivote n'herite pas de
  // l'alignement par defaut du flux, et la prose sortait centree.
  set align(left + top)
  show heading: set text(font: JP-SANS)
  doc
}

// Filet horizontal fin, utilise partout plutot que des cadres : sur e-ink un
// trait plein coute moins de rafraichissement qu'un aplat.
#let rule(thickness: 0.4pt, paint: RULE) = line(length: 100%, stroke: thickness + paint)

// UNE page du livre : le corps est compose en paysage, puis pose pivote sur la
// page portrait. `reflow: false` parce qu'on veut precisement que la rotation
// ne change rien a la mise en page — le bloc garde ses 163 x 92 mm.
//
// ⚠ Le corps doit tenir dans un SEUL bloc : rien ici ne se repartit sur la page
// suivante. Ce qui deborde est perdu en silence, d'ou `paginer()` plus bas,
// qui decoupe une liste en pages AVANT de composer.
#let tournee(corps) = {
  place(
    center + horizon,
    rotate(90deg, reflow: false, block(
      width: PAGE-W,
      height: PAGE-H,
      inset: (x: MARGIN-X, y: MARGIN-Y),
      corps,
    )),
  )
}

// Decoupe une liste de blocs en pages de `colonnes` colonnes, en MESURANT.
// Aucune hauteur n'est ecrite en dur : le decoupage suit ce que la composition
// produit vraiment, donc il survit a un changement d'ECHELLE.
//
// ⚠ On mesure la colonne CUMULEE, pas chaque bloc isolement. `measure` ignore
// le `spacing` qui separe deux blocs — sur une colonne de trente entrees a
// 1 mm d'ecart, c'est 30 mm de trop, et les dernieres entrees se superposaient
// en bas de colonne sans qu'aucune erreur ne soit levee. Le cout est une mesure
// par bloc, sur un contenu qui grandit : negligeable a l'echelle d'une colonne.
//
// Rend une liste de pages, chaque page etant une liste de colonnes.
#let paginer(blocs, colonnes: 3, gouttiere: 5mm, hauteur: 0mm, tete: 0mm, marge: 1mm) = {
  let large = (LARGEUR-UTILE - gouttiere * (colonnes - 1)) / colonnes
  let pages = ()
  let page = ()
  let colonne = ()
  // Seule la PREMIERE page porte un titre ; les suivantes recuperent sa hauteur.
  let dispo = hauteur - tete - marge
  for b in blocs {
    let essai = colonne + (b,)
    if colonne.len() > 0 and measure(block(width: large, essai.join())).height > dispo {
      page.push(colonne)
      colonne = ()
      if page.len() == colonnes {
        pages.push(page)
        page = ()
        dispo = hauteur - marge
      }
      colonne = (b,)
    } else {
      colonne = essai
    }
  }
  if colonne.len() > 0 { page.push(colonne) }
  if page.len() > 0 { pages.push(page) }
  (pages: pages, largeur: large, gouttiere: gouttiere)
}

// Rend une page produite par `paginer()`.
#let colonnes-de(page, largeur, gouttiere) = grid(
  columns: (largeur,) * page.len(),
  column-gutter: gouttiere,
  align: left + top,
  ..page.map(c => block(width: largeur, c.join())),
)
