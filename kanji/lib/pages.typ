#import "theme.typ": *
#import "data.typ": *

// --- ouverture de chapitre -------------------------------------------------
// Une planche de la famille entiere avant d'entrer dans les fiches : on voit
// d'un coup ce que le radical a en commun, ce qu'aucune fiche isolee ne montre.
// Elle sert deux fois — a l'entree pour situer, en revision pour se tester en
// masquant les gloses.
#let planche(chapitre, numero: 0, total: 0) = {
  let ks = chapitre.kanji
  block(spacing: 0pt, {
    grid(
      columns: (1fr, auto),
      align: (left + horizon, right + horizon),
      // Le titre de planche EST le heading de niveau 1 : sommaire et signets
      // du PDF sont alors le MEME element que ce qui est imprime, donc ils ne
      // peuvent pas diverger. Un titre pose en `text` laisse un sommaire vide.
      heading(level: 1, outlined: true, bookmarked: true)[#chapitre.titre],
      context text(size: 6.5pt, fill: INK-SOFT, font: JP-SANS)[#ks.len() kanji · chapitre #numero / #total · p. #here().page()],
    )
    v(1mm)
    rule(thickness: 0.7pt, paint: INK)
  })
  v(2.5mm)

  // 8 colonnes, glyphe a 7,5 mm : dimensionne sur la PLUS GROSSE famille (亻,
  // 30 kanji, donc 4 rangees) avec la glose la plus longue du corpus (32
  // caracteres, qui passe a la ligne). Une planche qui deborde perd la rangee
  // du bas en silence — c'est arrive avec un glyphe a 8,5 mm.
  let cols = 8
  grid(
    columns: (1fr,) * cols,
    row-gutter: 1.4mm,
    column-gutter: 1.5mm,
    ..ks.map(k => align(center, {
      // Hauteur du glyphe FIXEE : l'interligne d'une police CJK a 7,5 mm
      // atteint 10 mm, ce qui portait la rangee a 20 mm et faisait deborder
      // la quatrieme — les gloses du bas disparaissaient sans erreur.
      box(height: 8.6mm, align(center + horizon, text(size: 7.5mm)[#name(k)]))
      v(0.3mm)
      text(size: 5pt, fill: INK-SOFT)[#gloss(k)]
    })),
  )
}

// --- liminaire -------------------------------------------------------------
#let page-titre = {
  set align(center + horizon)
  // Hauteur fixee : l'interligne d'une police CJK a 26 mm ouvre un blanc de
  // 12 mm sous le titre, que `v()` ne peut que creuser davantage.
  box(height: 27mm, align(center + horizon, text(size: 24mm)[漢字]))
  v(4mm)
  text(size: 13pt, font: JP-SANS, weight: "bold")[Cahier d'écriture — JLPT N3]
  v(2mm)
  text(size: 8pt, fill: INK-SOFT)[#FICHES fiches · #CHAPTERS.len() chapitres, dont #ORPHAN-CHAPTERS.len() hors des groupes du référentiel]
  v(3.5mm)
  text(size: 7pt, fill: INK-SOFT)[Composé depuis le graphe du projet — reMarkable Paper Pro Move, 163 × 92 mm]
}

#let mode-emploi = {
  text(size: 11pt, font: JP-SANS, weight: "bold")[Comment se servir de ce cahier]
  v(1mm)
  rule(thickness: 0.7pt, paint: INK)
  v(2.5mm)
  set text(size: 7.5pt)
  set par(leading: 0.62em)
  grid(
    columns: (1fr, 1fr),
    column-gutter: 6mm,
    [
      *Une fiche, un caractère.* À gauche le caractère à la taille où l'on
      distingue les traits, son sens, ses lectures 音 (on, en katakana) et
      訓 (kun, en hiragana ; ce qui suit entre parenthèses est l'okurigana,
      écrit en kana et non compris dans le caractère).

      *Les mots comptent plus que le caractère.* Un kanji ne s'emploie
      presque jamais seul : les mots listés sous les lectures sont ce que
      le caractère permet de lire. Les apprendre, c'est apprendre le kanji ;
      l'inverse est faux.

      *La phrase du bas*, quand elle est là, montre le caractère en emploi.
      Ses lectures sont notées au-dessus, en petit : les mots que le
      dictionnaire du projet ne connaît pas restent en clair.
    ],
    [
      *La grille : trois tailles, une par rangée.* On apprend un caractère en
      grand — c'est la seule taille où l'on voit ce qu'on rate — mais on
      l'écrit petit. Descendez les rangées dans l'ordre : la dernière est
      calibrée sur l'écriture courante, celle d'une prise de notes, et c'est
      là que vingt traits deviennent vraiment difficiles.

      La première case porte un modèle franc : repassez-le au stylet, trait
      par trait, dans l'ordre. La deuxième est presque effacée : écrivez
      dessus sans vous y appuyer. Les rangées suivantes n'ouvrent que sur un
      modèle pâle — passé la taille, c'est de mémoire. Les pointillés en croix
      servent à placer les traits, pas à les décorer : visez leurs quarts.

      *Les planches d'ouverture* de chaque famille se relisent en masquant
      les gloses : nommer les trente caractères d'un radical de mémoire est
      une révision plus dure, et plus utile, qu'une fiche relue.
    ],
  )
}

// --- index -----------------------------------------------------------------
// Les numeros de page sont ceux du PDF, pas une estimation : chaque fiche
// depose un `metadata` etiquete, et `query` rend la position reelle apres mise
// en page. Une table de reperage fausse est pire que pas de table.
// ⚠ FONCTION, pas une constante : `context { ... }` rend du CONTENU, pas le
// dictionnaire construit dedans. Un `.at(glyphe, default: "—")` sur ce contenu
// ne jette pas — il rend le defaut, et l'index entier s'imprime en « — ».
// A appeler depuis un bloc `context`, seul endroit ou `query` sait repondre.
#let pages-des-fiches() = {
  let m = (:)
  for it in query(<fiche>) { m.insert(it.value, it.location().page()) }
  // Le seul garde-fou qui vaille : une table de reperage fausse se lit comme
  // une table juste. Mieux vaut ne pas produire le livre.
  assert(
    m.len() == KANJI.len(),
    message: "index : " + str(m.len()) + " fiches reperees sur " + str(KANJI.len())
      + " — l'ancre <fiche> ne suit plus les fiches.",
  )
  m
}

#let _entree(glyphe, libelle, pages) = box(width: 100%, {
  text(size: 7.5pt)[#glyphe]
  h(0.8mm)
  text(size: 5.8pt, fill: INK-SOFT)[#libelle]
  box(width: 1fr, repeat(text(size: 5pt, fill: luma(190))[.]))
  text(size: 5.8pt, fill: INK-SOFT)[#pages.at(glyphe)]
})

#let _titre-index(titre, chapeau) = {
  block(spacing: 0pt, {
    text(size: 11pt, font: JP-SANS, weight: "bold")[#titre]
    v(1mm)
    rule(thickness: 0.7pt, paint: INK)
  })
  v(1mm)
  text(size: 6.5pt, fill: INK-SOFT)[#chapeau]
  v(2mm)
}

// Tri des gloses : le point de code met « é » apres « z ». Sans repli des
// accents, « écrire » se retrouve en fin d'index — la table de reperage
// deviendrait alors plus lente a consulter que le feuilletage.
#let _PLIS = (
  ("à", "a"), ("â", "a"), ("ä", "a"), ("ç", "c"), ("é", "e"), ("è", "e"),
  ("ê", "e"), ("ë", "e"), ("î", "i"), ("ï", "i"), ("ô", "o"), ("ö", "o"),
  ("ù", "u"), ("û", "u"), ("ü", "u"), ("œ", "oe"),
)
#let plier(s) = {
  let out = lower(s)
  for (de, vers) in _PLIS { out = out.replace(de, vers) }
  out
}

#let index-lectures = context {
  let pages = pages-des-fiches()
  _titre-index(
    "Index des lectures 音",
    "Lecture on (katakana) → caractère → page. Un caractère à plusieurs lectures figure à chacune.",
  )
  let lignes = ()
  for k in KANJI {
    for r in on-readings(k) { lignes.push((r, name(k))) }
  }
  set text(size: 6pt)
  columns(5, gutter: 4mm)[
    #for (r, g) in lignes.sorted(key: e => (e.at(0), e.at(1))) {
      block(spacing: 1.05mm, _entree(g, r, pages))
    }
  ]
}

#let index-sens = context {
  let pages = pages-des-fiches()
  _titre-index(
    "Index des sens",
    "Sens français → caractère → page. Accents repliés pour le classement : « écrire » se lit à la lettre E.",
  )
  set text(size: 6pt)
  columns(5, gutter: 4mm)[
    #for k in KANJI.sorted(key: k => (plier(gloss(k)), name(k))) {
      block(spacing: 1.05mm, _entree(name(k), gloss(k), pages))
    }
  ]
}
