// SECONDE PASSE — tourne chaque page du cahier de 90°.
//
// Le livre se compose en 163 × 92 mm (la dalle du Paper Move, en paysage), puis
// chaque page est reposée telle quelle, pivotée, sur une page portrait de
// 92 × 163 mm. La liseuse l'affiche alors plein écran dans son orientation
// native, et c'est l'appareil qu'on tourne.
//
// ⚠ Ce n'est PAS une recomposition : le contenu est identique au demi-point
// près, et son texte reste sélectionnable — Typst incorpore les pages du PDF
// source, il ne les rastérise pas.
//
// ⚠ En revanche l'incorporation perd les signets du PDF. Ils sont reconstruits
// ici depuis le relevé `<chapitre>` de la première passe, extrait par
// `typst query` (cf. kanji/build.ts) : sans eux, un livre de 900 pages ne se
// parcourt plus qu'en faisant défiler.
//
// Trois commandes `typst`, enchaînées par `bun run cahier` (cf. package.json) :
// composer en paysage, relever les chapitres, tourner. Rien d'autre que Typst
// n'intervient — la rotation est une composition, pas une retouche du PDF.

#let source = sys.inputs.at("source")

// Le relevé de la première passe : un enregistrement par chapitre, plus un
// dernier à `titre: none` dont la page est le nombre de pages du volume. Tout
// vient donc de la même source — rien n'est compté dans le PDF.
#let plan = json(sys.inputs.at("plan"))
#let pages = calc.max(..plan.map(c => c.page))

// « horaire » : le haut du contenu part à DROITE, on tourne la liseuse vers la
// gauche pour lire. `--input sens=antihoraire` fait l'inverse.
#let angle = if sys.inputs.at("sens", default: "horaire") == "antihoraire" { -90deg } else { 90deg }

#let LARGE = 163mm
#let HAUTE = 92mm

#set document(
  title: "漢字 — Cahier d'écriture JLPT N3",
  description: "810 kanji du N3, groupés par famille de radical, avec ordre des traits et grilles d'écriture.",
)
#set page(width: HAUTE, height: LARGE, margin: 0pt)

// Les titres ne sont là que pour les signets : `hide` garde l'élément et sa
// position — donc son entrée dans le sommaire du PDF — sans rien imprimer, et
// `place` lui évite de pousser l'image.
#show heading: it => place(top + left, hide(it))

#let chapitres = {
  let m = (:)
  for c in plan { if c.titre != none { m.insert(str(c.page), c.titre) } }
  m
}

#for i in range(1, pages + 1) {
  if str(i) in chapitres {
    heading(level: 1, outlined: true, bookmarked: true)[#chapitres.at(str(i))]
  }
  place(center + horizon, rotate(angle, reflow: false, image(source, page: i, width: LARGE, height: HAUTE)))
  if i < pages { pagebreak() }
}
