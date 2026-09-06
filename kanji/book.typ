// 漢字 — Cahier d'écriture JLPT N3, pour reMarkable Paper Pro Move.
//
//   typst compile --root . --input traits=oui kanji/book.typ kanji/kanjis.pdf
//
// Le `--root .` n'est pas optionnel : les modules lisent `/data/graph/*.jsonld`
// depuis la racine du dépôt, parce que le graphe est la source et qu'aucun
// fichier dérivé ne doit s'intercaler entre lui et le livre.
//
// `--input traits=oui` compose les diagrammes d'ordre des traits, qui supposent
// d'avoir lancé la chaîne KanjiVG (cf. tools/kanjivg/). Sans lui, le livre se
// compose à l'identique moins ces diagrammes, et n'emprunte alors rien à
// personne. Typst ne sait pas demander si un fichier existe — `json()` sur un
// chemin absent est une erreur de compilation — donc cela se déclare.
//
// ⚠ UNE PAGE = UN APPEL À `tournee()`. La page du PDF est portrait (92 × 163),
// son contenu est composé en paysage (163 × 92) puis posé pivoté de 90°. Rien
// ici ne « coule » d'une page à l'autre : les sections à rallonge (sommaire,
// index, prose) se paginent elles-mêmes en mesurant, et rendent une LISTE de
// pages. Ce qui déborderait d'un bloc pivoté serait perdu sans erreur.

#import "lib/theme.typ": *
#import "lib/data.typ": *
#import "lib/fiche.typ": fiche
#import "lib/pages.typ": *

#set document(
  title: "漢字 — Cahier d'écriture JLPT N3",
  description: "810 kanji du N3, groupés par famille de radical, avec ordre des traits et grilles d'écriture.",
)

#show: apply-theme

// Le titre de planche EST le titre de chapitre : un seul élément, donc les
// signets du PDF ne peuvent pas diverger de ce qui est imprimé.
#show heading.where(level: 1): it => text(size: P(11), font: JP-SANS, weight: "bold")[#it.body]
#set heading(numbering: none)

// Pose une suite de pages, séparées par des sauts. Le dernier saut est omis :
// il ajouterait une page blanche en fin de volume.
#let poser(pages) = {
  for (i, p) in pages.enumerate() {
    tournee(p)
    if i + 1 < pages.len() { pagebreak() }
  }
}

// --- liminaire -------------------------------------------------------------
#tournee(page-titre)
#pagebreak()

#context {
  poser(mode-emploi())
  pagebreak()
  // Le sommaire lit le relevé `<chapitre>` déposé par les planches, donc il
  // doit être composé APRÈS elles dans l'ordre d'évaluation de l'introspection
  // — ce que `context` garantit : Typst reprend la passe jusqu'à stabilisation.
  poser(sommaire())
  pagebreak()
}

// --- le corps --------------------------------------------------------------
#context {
  let n = 0
  for (i, ch) in CHAPTERS.enumerate() {
    poser(planche(ch, numero: i + 1, total: CHAPTERS.len()))
    pagebreak()
    for k in ch.kanji {
      n += 1
      tournee(fiche(k, chapitre: ch.titre, numero: n, total: FICHES))
      pagebreak()
    }
  }
}

// --- tables de repérage ----------------------------------------------------
#context {
  poser(index-lectures())
  pagebreak()
  poser(index-sens())

  // Les crédits ne sont imprimés que si les diagrammes le sont : sans eux, le
  // livre n'emprunte rien et n'a rien à attribuer.
  if TRAITS {
    pagebreak()
    poser(page-credits())
  }
}
