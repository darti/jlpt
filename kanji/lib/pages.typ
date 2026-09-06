#import "theme.typ": *
#import "data.typ": *

// --- ouverture de chapitre -------------------------------------------------
// Une planche de la famille entiere avant d'entrer dans les fiches : on voit
// d'un coup ce que le radical a en commun, ce qu'aucune fiche isolee ne montre.
// Elle sert deux fois — a l'entree pour situer, en revision pour se tester en
// masquant les gloses.
#let CASE-PLANCHE = 8
#let GLYPHE-PLANCHE = 7.5mm

// Une rangee de la planche : huit caracteres avec leur sens.
//
// ⚠ Hauteur du glyphe FIXEE : l'interligne d'une police CJK a 7,5 mm atteint
// 10 mm, ce qui portait la rangee a 20 mm et faisait deborder la quatrieme —
// les gloses du bas disparaissaient sans erreur.
#let _rangee(ks) = block(spacing: 1.4mm, grid(
  columns: (1fr,) * CASE-PLANCHE,
  column-gutter: 1.5mm,
  align: center + top,
  ..ks.map(k => {
    box(height: 8.6mm, align(center + horizon, text(size: GLYPHE-PLANCHE)[#name(k)]))
    v(0.3mm)
    text(size: P(5), fill: INK-SOFT)[#gloss(k)]
  }),
))

// Rend une LISTE de pages : une famille de plus de trois rangees en occupe
// deux.
//
// ⚠ Elle se paginait toute seule tant que le livre coulait. Une page pivotee ne
// coule pas : ce qui depassait se superposait en bas de page, sans erreur. Le
// decoupage se fait donc ici, en mesurant — `paginer` a une seule colonne,
// c'est-a-dire une colonne par page.
#let planche(chapitre, numero: 0, total: 0) = {
  let ks = chapitre.kanji
  let rangees = range(calc.ceil(ks.len() / CASE-PLANCHE)).map(i => _rangee(
    ks.slice(i * CASE-PLANCHE, calc.min((i + 1) * CASE-PLANCHE, ks.len())),
  ))

  let entete(titre) = {
    block(spacing: 0pt, {
      grid(
        columns: (1fr, auto),
        align: (left + horizon, right + horizon),
        titre,
        context text(size: P(6.5), fill: INK-SOFT, font: JP-SANS)[#ks.len() kanji · chapitre #numero / #total · p. #here().page()],
      )
      v(1mm)
      rule(thickness: 0.7pt, paint: INK)
    })
    v(2.5mm)
  }

  // Le titre de planche EST le heading de niveau 1 : sommaire et signets du PDF
  // sont alors le MEME element que ce qui est imprime, donc ils ne peuvent pas
  // diverger. Sur une seconde planche, un titre en clair — un second heading
  // dedoublerait le chapitre dans les signets.
  let titre-1 = heading(level: 1, outlined: true, bookmarked: true)[#chapitre.titre]
  let titre-n = text(size: P(11), font: JP-SANS, weight: "bold")[#chapitre.titre #text(fill: INK-SOFT)[(suite)]]

  let h = measure(block(width: LARGEUR-UTILE, entete(titre-1))).height
  let mise = paginer(rangees, colonnes: 1, hauteur: HAUTEUR-UTILE, tete: h)

  mise.pages.enumerate().map(((i, page)) => {
    // Titre + page reelle du chapitre : c'est de la que le SOMMAIRE est bati.
    // `outline()` ne sert plus — il coule sur plusieurs pages, et une page
    // pivotee ne coule pas. On releve donc, on pagine, on compose.
    if i == 0 { context [#metadata((titre: chapitre.titre, page: here().page()))<chapitre>] }
    entete(if i == 0 { titre-1 } else { titre-n })
    page.first().join()
  })
}

// --- liminaire -------------------------------------------------------------
#let page-titre = {
  set align(center + horizon)
  // Hauteur fixee : l'interligne d'une police CJK a 26 mm ouvre un blanc de
  // 12 mm sous le titre, que `v()` ne peut que creuser davantage.
  box(height: 27mm, align(center + horizon, text(size: 24mm)[漢字]))
  v(4mm)
  text(size: P(13), font: JP-SANS, weight: "bold")[Cahier d'écriture — JLPT N3]
  v(2mm)
  text(size: P(8), fill: INK-SOFT)[#FICHES fiches · #CHAPTERS.len() chapitres, dont #ORPHAN-CHAPTERS.len() hors des groupes du référentiel]
  v(3.5mm)
  text(size: P(7), fill: INK-SOFT)[Composé depuis le graphe du projet — reMarkable Paper Pro Move, 163 × 92 mm]
  if TRAITS {
    v(1.5mm)
    text(size: P(6.2), fill: INK-SOFT)[Diagrammes d'ordre des traits : KanjiVG, CC BY-SA 3.0 — voir les crédits en fin de volume]
  }
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

// `block`, pas `box` : une boite ne coupe pas les lignes, donc un libelle plus
// large que la colonne DEBORDE sur la colonne voisine — silencieusement.
#let _entree(glyphe, libelle, pages) = block(width: 100%, {
  text(size: P(7.5))[#glyphe]
  h(0.8mm)
  text(size: P(5.8), fill: INK-SOFT)[#libelle]
  box(width: 1fr, repeat(text(size: P(5), fill: luma(190))[.]))
  text(size: P(5.8), fill: INK-SOFT)[#pages.at(glyphe)]
})

#let _titre-section(titre, chapeau: none) = {
  block(spacing: 0pt, {
    text(size: P(11), font: JP-SANS, weight: "bold")[#titre]
    v(1mm)
    rule(thickness: 0.7pt, paint: INK)
  })
  if chapeau != none {
    v(1mm)
    text(size: P(6.5), fill: INK-SOFT)[#chapeau]
  }
  v(2mm)
}

// Une section a plusieurs pages : titre sur la premiere, colonnes sur toutes.
// Rend une LISTE de pages, que `book.typ` pose une a une par `tournee()`.
//
// ⚠ C'est ici que se paie la page pivotee : un bloc pivote ne se repartit pas
// sur la page suivante, donc ce qui deborde serait perdu SANS ERREUR. Le
// decoupage se fait donc avant de composer, en mesurant chaque bloc — aucune
// hauteur n'est ecrite en dur, et un changement d'ECHELLE se propage tout seul.
#let section-paginee(titre, blocs, chapeau: none, colonnes: 3, taille: P(6)) = {
  let entete = _titre-section(titre, chapeau: chapeau)
  let h-entete = measure(block(width: LARGEUR-UTILE, entete)).height
  let mise = paginer(
    blocs.map(b => text(size: taille, b)),
    colonnes: colonnes,
    hauteur: HAUTEUR-UTILE,
    tete: h-entete,
  )
  mise.pages.enumerate().map(((i, page)) => {
    if i == 0 { entete }
    colonnes-de(page, mise.largeur, mise.gouttiere)
  })
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

#let mode-emploi() = section-paginee(
  "Comment se servir de ce cahier",
  (
    [*La bande du haut* montre l'ordre des traits : une case par trait, le
     dernier en noir, les précédents en gris. On y voit où le trait commence et
     dans quel sens il part — ce qu'un caractère annoté de numéros ne dit qu'à
     qui connaît déjà l'ordre. Suivez-la avant d'écrire quoi que ce soit.],
    [*Une fiche, un caractère.* À gauche le caractère à la taille où l'on
     distingue les traits, son sens, ses lectures 音 (on, en katakana) et
     訓 (kun, en hiragana ; ce qui suit entre parenthèses est l'okurigana, écrit
     en kana et non compris dans le caractère).],
    [*Les mots comptent plus que le caractère.* Un kanji ne s'emploie presque
     jamais seul : les mots listés sous les lectures sont ce que le caractère
     permet de lire. Les apprendre, c'est apprendre le kanji ; l'inverse est
     faux.],
    [*La phrase du bas*, quand elle est là, montre le caractère en emploi. Ses
     lectures sont notées au-dessus, en petit : les mots que le dictionnaire du
     projet ne connaît pas restent en clair.],
    [*La grille : trois tailles, une par rangée.* On apprend un caractère en
     grand — c'est la seule taille où l'on voit ce qu'on rate — mais on l'écrit
     petit. Descendez les rangées dans l'ordre : la dernière est calibrée sur
     l'écriture courante, celle d'une prise de notes, et c'est là que vingt
     traits deviennent vraiment difficiles.],
    [La première case porte un modèle franc : repassez-le au stylet, trait par
     trait, dans l'ordre. La deuxième est presque effacée : écrivez dessus sans
     vous y appuyer. Les rangées suivantes n'ouvrent que sur un modèle pâle —
     passé la taille, c'est de mémoire. Les pointillés en croix servent à placer
     les traits, pas à les décorer : visez leurs quarts.],
    [*Les planches d'ouverture* de chaque famille se relisent en masquant les
     gloses : nommer les trente caractères d'un radical de mémoire est une
     révision plus dure, et plus utile, qu'une fiche relue.],
  ).map(b => block(spacing: 2.4mm, b)),
  colonnes: 2,
  taille: P(7.5),
)

// Page de CRÉDITS — obligatoire, pas décorative.
//
// Les tracés d'ordre des traits viennent de KanjiVG, sous CC BY-SA 3.0 : cette
// licence exige d'attribuer l'œuvre et de lier vers son site, et impose le
// ShareAlike à toute redistribution de ce PDF. Le reste du livre ne vient que
// du graphe du projet — c'est pourquoi la page dit précisément CE QUI est
// emprunté, et n'attribue pas plus que ce qui l'est.
#let page-credits() = section-paginee(
  "Crédits",
  (
    [*Diagrammes d'ordre des traits.* Les tracés proviennent de
     #link("https://kanjivg.tagaini.net/")[KanjiVG], © Ulrich Apel, distribué sous licence
     #link("https://creativecommons.org/licenses/by-sa/3.0/")[Creative Commons Attribution — Partage dans les mêmes conditions 3.0].
     Ce cahier en est une œuvre dérivée : le redistribuer suppose de le faire
     sous la même licence, ou une licence compatible, et de conserver cette
     attribution.],
    [Aucune autre partie du livre n'en dépend. Les caractères, leurs sens, leurs
     lectures, les mots et les phrases d'exemple viennent du graphe du projet,
     et le cahier se compose sans les diagrammes — il est alors libre de cette
     contrainte.],
    [*Sens, lectures, mots, phrases.* Contenu propre au projet, arbitré à la
     main. Les lectures manquantes ont été décidées en s'appuyant sur JMdict et
     KANJIDIC2 (EDRDG, CC BY-SA 4.0), consultés comme sources de décision :
     aucune de leurs données n'est reproduite ici.],
    [*Progression.* Les 51 familles de radicaux et leur ordre sont ceux des
     leçons du projet. Les caractères qu'aucune ne couvre sont classés par le
     nombre de mots du référentiel qui les emploient.],
  ).map(b => block(spacing: 2.4mm, b)),
  colonnes: 2,
  taille: P(7.5),
)

#let index-lectures() = {
  let pages = pages-des-fiches()
  let lignes = ()
  for k in KANJI {
    for r in on-readings(k) { lignes.push((r, name(k))) }
  }
  section-paginee(
    "Index des lectures 音",
    lignes
      .sorted(key: e => (e.at(0), e.at(1)))
      .map(((r, g)) => block(spacing: 1.05mm, _entree(g, r, pages))),
    chapeau: "Lecture on (katakana) → caractère → page. Un caractère à plusieurs lectures figure à chacune.",
  )
}

#let index-sens() = {
  let pages = pages-des-fiches()
  section-paginee(
    "Index des sens",
    KANJI
      .sorted(key: k => (plier(gloss(k)), name(k)))
      .map(k => block(spacing: 1.05mm, _entree(name(k), gloss(k), pages))),
    chapeau: "Sens français → caractère → page. Accents repliés pour le classement : « écrire » se lit à la lettre E.",
  )
}

// Le SOMMAIRE, bati sur le meme releve que les signets du PDF : un seul
// element, donc l'imprime et le navigable ne peuvent pas diverger.
#let sommaire() = {
  let chapitres = query(<chapitre>).map(it => it.value)
  section-paginee(
    "Sommaire",
    chapitres.map(c => block(spacing: 1.15mm, box(width: 100%, {
      text(size: P(6.2))[#c.titre]
      box(width: 1fr, repeat(text(size: P(5), fill: luma(190))[.]))
      text(size: P(6.2))[#c.page]
    }))),
    colonnes: 2,
    taille: P(6.2),
  )
}
