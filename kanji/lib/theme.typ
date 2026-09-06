// Gabarit du livre — reMarkable Paper Pro Move, 7,3" en PAYSAGE.
//
// La dalle fait 1696 x 954 px a 264 dpi, soit 163,1 x 91,7 mm. On arrondit a
// 163 x 92 mm : un PDF au format EXACT de la dalle s'affiche sans marge grise
// ni recadrage, ce qui compte sur liseuse ou l'ajustement est fait une fois
// pour toutes. Toute autre proportion coute de la surface utile.

#let PAGE-W = 163mm
#let PAGE-H = 92mm
#let MARGIN-X = 5mm
#let MARGIN-Y = 4mm

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

#let apply-theme(doc) = {
  set page(
    width: PAGE-W, height: PAGE-H,
    margin: (x: MARGIN-X, y: MARGIN-Y),
    fill: white,
  )
  set text(font: JP-SERIF, size: 8pt, fill: INK, lang: "fr")
  set par(leading: 0.55em, justify: false)
  show heading: set text(font: JP-SANS)
  doc
}

// Filet horizontal fin, utilise partout plutot que des cadres : sur e-ink un
// trait plein coute moins de rafraichissement qu'un aplat.
#let rule(thickness: 0.4pt, paint: RULE) = line(length: 100%, stroke: thickness + paint)
