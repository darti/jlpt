// 漢字 — Cahier d'écriture JLPT N3, pour reMarkable Paper Pro Move.
//
//   typst compile --root . kanji/book.typ kanji/kanjis.pdf
//
// Le `--root .` n'est pas optionnel : les modules lisent `/data/graph/*.jsonld`
// depuis la racine du depot, parce que le graphe est la source et qu'aucun
// fichier derive ne doit s'intercaler entre lui et le livre.

#import "lib/theme.typ": *
#import "lib/data.typ": *
#import "lib/fiche.typ": fiche
#import "lib/pages.typ": *

#set document(
  title: "漢字 — Cahier d'écriture JLPT N3",
  description: "810 kanji du N3, groupés par famille de radical, avec grilles d'écriture.",
)

#show: apply-theme

// Le titre de planche EST le titre de chapitre : un seul element, donc le
// sommaire et les signets du PDF ne peuvent pas diverger de ce qui est imprime.
#show heading.where(level: 1): it => text(size: P(11), font: JP-SANS, weight: "bold")[#it.body]
#set heading(numbering: none)

// --- liminaire -------------------------------------------------------------
#page-titre
#pagebreak()

#mode-emploi
#pagebreak()

#block(spacing: 0pt, {
  text(size: P(11), font: JP-SANS, weight: "bold")[Sommaire]
  v(1mm)
  rule(thickness: 0.7pt, paint: INK)
})
#v(2mm)
#columns(2, gutter: 6mm)[
  #set text(size: P(6.2))
  #show outline.entry: it => block(spacing: 1.15mm, it)
  #outline(title: none, depth: 1, indent: 0mm)
]
#pagebreak()

// --- le corps --------------------------------------------------------------
#{
  let n = 0
  for (i, ch) in CHAPTERS.enumerate() {
    planche(ch, numero: i + 1, total: CHAPTERS.len())
    pagebreak()
    for k in ch.kanji {
      n += 1
      fiche(k, chapitre: ch.titre, numero: n, total: FICHES)
      pagebreak()
    }
  }
}

// --- tables de reperage ----------------------------------------------------
#index-lectures
#pagebreak()
#index-sens
