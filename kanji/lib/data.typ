// Lecture du graphe — DIRECTE, sans etape intermediaire.
//
// `data/graph/` est a la fois la source et ce qui est livre (cf. CLAUDE.md) :
// fabriquer ici un JSON derive pour le livre recreerait exactement le probleme
// que la migration vers le graphe a supprime — un fichier que plus rien ne
// resynchronise. Typst sait lire du JSON, donc il lit la source.
//
// ATTENTION — un chainage `.methode()` place en DEBUT DE LIGNE n'est PAS
// rattache au `#let` : typst clot l'expression au saut de ligne et lit la
// suite comme du MARKUP, qui s'imprime alors dans le document. Le filtre
// disparait en silence. Toute chaine multiligne est donc ENTRE PARENTHESES,
// ou tient sur une seule ligne. `assertions.typ` verifie les effectifs
// obtenus, precisement parce que cette panne-la ne leve rien.

#let _g(nom) = json("/data/graph/" + nom + ".jsonld").at("@graph")

#let KANJI-DOC = _g("kanji")
#let WORD-DOC = _g("word")
#let LESSON-DOC = _g("lesson")
#let EXAMPLE-DOC = _g("example")

// --- acces tolerants -------------------------------------------------------
// Le graphe est de la donnee redigee : un predicat peut manquer (596 kanji sur
// 810 ont une lecture kun, 27 un compose). Un acces qui jette transformerait
// chacun de ces trous en echec de compilation du livre entier.
#let f(node, key, default: none) = if key in node { node.at(key) } else { default }
#let lst(v) = if v == none { () } else if type(v) == array { v } else { (v,) }

#let name(node) = f(node, "schema:name", default: "")
#let gloss(node) = f(node, "schema:description")
#let reading(node) = f(node, "jlpt:reading")
#let on-readings(node) = lst(f(node, "jlpt:onReading"))
#let kun-readings(node) = lst(f(node, "jlpt:kunReading"))

// --- kanji -----------------------------------------------------------------
#let KANJI = KANJI-DOC.filter(k => f(k, "@type") == "jlpt:Kanji")

#let KANJI-BY-ID = {
  let m = (:)
  for k in KANJI { m.insert(f(k, "@id"), k) }
  m
}

#let KANJI-BY-CHAR = {
  let m = (:)
  for k in KANJI { m.insert(name(k), k) }
  m
}

// --- mots par kanji --------------------------------------------------------
// On indexe par PRESENCE DU CARACTERE dans le mot, pas par l'arete `usesKanji`
// du graphe. L'arete est incomplete — 泳ぐ et 泳ぎ existent dans `word.jsonld`
// et ne la portent pas — et s'y fier laissait 180 fiches sans le moindre mot
// contre 12 par presence. La presence n'est pas une heuristique : c'est une
// recherche exacte de sous-chaine, et un mot qui contient 泳 emploie 泳.
//
// Un mot n'est retenu que s'il porte a la fois une lecture et une glose : sans
// les deux il n'apprend rien, et le referentiel a longtemps charrie des
// entrees minees depuis les options de quiz (cf. la chaine `purge-words`).
#let WORDS-BY-CHAR = {
  let m = (:)
  for w in WORD-DOC {
    if reading(w) == none or gloss(w) == none { continue }
    let vus = (:)
    for ch in name(w).clusters() {
      if ch in KANJI-BY-CHAR and not (ch in vus) {
        vus.insert(ch, true)
        m.insert(ch, m.at(ch, default: ()) + (w,))
      }
    }
  }
  m
}

// Ordre d'affichage : les composes de deux caracteres d'abord — c'est l'unite
// qu'on apprend et qu'on reemploie — puis les formes plus longues, et EN
// DERNIER les entrees d'un seul caractere. Ces dernieres sont souvent des
// artefacts du minage (「泳」lu およ n'est pas un mot), donc on ne les montre
// que faute de mieux. A longueur egale, un mot date d'un niveau JLPT est
// prefere : il a ete relu.
#let _rang(w) = {
  let n = name(w).clusters().len()
  (if n == 1 { 99 } else { n }, if f(w, "jlpt:level") == none { 1 } else { 0 }, name(w))
}
#let words-for(ch) = WORDS-BY-CHAR.at(ch, default: ()).sorted(key: _rang)

// --- phrases d'exemple par kanji -------------------------------------------
// Les 227 exemples illustrent des points de GRAMMAIRE : aucun n'est indexe par
// kanji. On les rattache par presence du caractere dans la phrase — recherche
// exacte sur le texte, pas heuristique de sens. 261 kanji sur 810 en heritent.
#let EXAMPLES-BY-CHAR = {
  let m = (:)
  for e in EXAMPLE-DOC {
    let vus = (:)
    for ch in f(e, "jlpt:jp", default: "").clusters() {
      if ch in KANJI-BY-CHAR and not (ch in vus) {
        vus.insert(ch, true)
        m.insert(ch, m.at(ch, default: ()) + (e,))
      }
    }
  }
  m
}

// La plus courte : sur une page de 92 mm de haut, une phrase longue chasse la
// grille d'ecriture, qui est la raison d'etre de la fiche.
#let example-for(ch) = {
  let es = EXAMPLES-BY-CHAR.at(ch, default: ())
  if es.len() == 0 { none } else { es.sorted(key: e => f(e, "jlpt:jp", default: "").clusters().len()).first() }
}

// --- chapitres -------------------------------------------------------------
// Partie I : les 51 lecons `track: kanji`, deja groupees par famille de
// radical (「Famille 氵 — eau」) et deja ordonnees par `jlpt:order`. On ne
// reinvente pas de progression : celle du graphe est celle que l'app enseigne,
// et un livre qui la contredirait desapprendrait ce que l'app apprend.
#let LESSONS = LESSON-DOC.filter(l => f(l, "jlpt:track") == "kanji").sorted(key: l => f(l, "jlpt:order", default: 0))

#let LESSON-CHAPTERS = LESSONS.map(l => (
  titre: name(l),
  source: "famille",
  kanji: lst(f(l, "covers")).filter(id => id in KANJI-BY-ID).map(id => KANJI-BY-ID.at(id)),
))

// Partie II : les 259 kanji qu'aucune lecon ne couvre. Le graphe ne porte pas
// de decomposition en radicaux : leur inventer une famille serait se tromper
// en silence. On les classe donc par PRODUCTIVITE — le nombre de mots du
// referentiel qui les emploient — ce qui est mesure, et met en premier ceux
// qui rendent le plus de mots lisibles.
#let COVERED-IDS = {
  let s = (:)
  for ch in LESSON-CHAPTERS { for k in ch.kanji { s.insert(f(k, "@id"), true) } }
  s
}

#let ORPHANS = KANJI.filter(k => not (f(k, "@id") in COVERED-IDS)).sorted(key: k => (-words-for(name(k)).len(), name(k)))

#let ORPHAN-SIZE = 24

#let ORPHAN-CHAPTERS = {
  let n = calc.ceil(ORPHANS.len() / ORPHAN-SIZE)
  let out = ()
  for i in range(n) {
    out.push((
      titre: "Kanji hors famille " + str(i + 1) + " / " + str(n),
      source: "hors-famille",
      kanji: ORPHANS.slice(i * ORPHAN-SIZE, calc.min((i + 1) * ORPHAN-SIZE, ORPHANS.len())),
    ))
  }
  out
}

#let CHAPTERS = LESSON-CHAPTERS + ORPHAN-CHAPTERS
#let FICHES = CHAPTERS.map(c => c.kanji.len()).sum()
