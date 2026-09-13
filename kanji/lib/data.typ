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

// Nombre de traits — la mesure de DIFFICULTE sur laquelle tout le volume est ordonne
// (cf. « progression » plus bas). Pose par `bun tools/graph/traits.mjs`, et la shape du
// graphe l'impose desormais a chaque kanji (`sh:minCount` 1, plage 1-34 verifiee par
// `checkKanji`) : les 810 en portent un, et la CI refuse le graphe si l'un le perd.
//
// ⚠ Le defaut est 99, pas 0, et ce n'est pas un detail : un compte manquant qui vaudrait
// 0 se rangerait EN TETE DU VOLUME, c'est-a-dire a la place du caractere le plus simple.
// Le defaut choisi renvoie l'anomalie en fin de chapitre, ou elle se voit. Le seul cas ou
// il peut servir est un graphe edite a la main sans revalidation.
#let strokes(node) = f(node, "jlpt:strokeCount", default: 99)

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

// --- furigana des phrases d'exemple ----------------------------------------
// Meme algorithme que `src/lib/dict.ts#furi` dans l'app, et pour la meme
// raison : une phrase d'exemple sans lectures ne se lit pas encore a ce
// niveau, donc elle n'apprend que le sens. Deux implementations peuvent
// deriver — celle-ci est en Typst faute de pouvoir executer du TS pendant la
// composition — d'ou la reprise des memes REGLES, qui sont ce qui compte :
//
//   * on n'annote qu'avec une lecture TOUT EN KANA PROPRE. Les entrees
//     mono-kanji du dictionnaire portent parfois un vidage on/kun
//     («ユウ・やさ(しい)・すぐ(れる)») : en furigana c'est absurde, et si large
//     que ca deforme la base ;
//   * la recherche est GOURMANDE et confinee au run de kanji : 富士山 est
//     essaye avant 富士 puis 富. Sans ca 富士山 se lirait «とみ・し・やま».
//
// La branche «lecture inline 漢字（かな）» de l'app est volontairement absente :
// elle sert aux enonces de quiz, et aucune des 227 phrases n'en porte.
//
// Mesure : 386 des 416 runs annotables le sont (92,8 %). Les 30 restants
// s'impriment en clair — un kanji sans lecture vaut mieux qu'une lecture fausse.
#let _KANA-PROPRE = regex("^[ぁ-んァ-ンー]+$")
#let _EST-KANJI = regex("[一-鿿々]")

#let READ = {
  let m = (:)
  for w in WORD-DOC {
    let r = reading(w)
    if r != none and r.match(_KANA-PROPRE) != none { m.insert(name(w), r) }
  }
  m
}

// Rend une suite de `(base, lecture)` ou `lecture` vaut `none` hors annotation.
// Les morceaux non annotes consecutifs sont FUSIONNES : chaque segment devient
// une colonne de grille a la composition, et une colonne par kana casserait le
// crenage de la phrase.
#let segments-furigana(phrase) = {
  let cs = phrase.clusters()
  let n = cs.len()

  // 1. decoupage brut : un element par mot reconnu, un par caractere sinon.
  // ⚠ Pas de fonction auxiliaire pour vider un tampon : une closure Typst ne
  // peut PAS modifier une variable de la portee englobante.
  let bruts = ()
  let i = 0
  while i < n {
    if cs.at(i).match(_EST-KANJI) == none {
      bruts.push((base: cs.at(i), lecture: none))
      i += 1
      continue
    }
    let fin = i
    while fin < n and cs.at(fin).match(_EST-KANJI) != none { fin += 1 }
    let k = i
    while k < fin {
      let trouve = none
      let taille = calc.min(12, fin - k)
      while taille >= 1 and trouve == none {
        let sous = cs.slice(k, k + taille).join()
        if sous in READ { trouve = sous }
        taille -= 1
      }
      if trouve == none {
        bruts.push((base: cs.at(k), lecture: none))
        k += 1
      } else {
        bruts.push((base: trouve, lecture: READ.at(trouve)))
        k += trouve.clusters().len()
      }
    }
    i = fin
  }

  // 2. fusion des morceaux non annotes consecutifs.
  let out = ()
  for b in bruts {
    if b.lecture == none and out.len() > 0 and out.last().lecture == none {
      out.at(out.len() - 1) = (base: out.last().base + b.base, lecture: none)
    } else {
      out.push(b)
    }
  }
  out
}

// --- ordre des traits ------------------------------------------------------
// Les diagrammes viennent de KanjiVG (CC BY-SA 3.0), hors depot, produits par
// `bun tools/kanjivg/fetch.mjs` puis `bun tools/kanjivg/strips.mjs`. Le graphe
// ne porte AUCUNE donnee de trace : l'app reste libre de toute attribution,
// seul le PDF est une oeuvre derivee (cf. sa page de credits).
//
// ⚠ Typst ne sait pas demander si un fichier existe, et `json()` sur un chemin
// absent est une ERREUR de compilation. Le livre ne peut donc pas « essayer ».
// Deux verrous : `--input traits=oui`, pose par `kanji/build.ts` uniquement si
// le dossier est la, et l'index ci-dessous, qui dit quels caracteres en ont un.
#let TRAITS = sys.inputs.at("traits", default: "non") == "oui"
#let TRAITS-INDEX = if TRAITS { json("/.kanjivg/traits/index.json") } else { (:) }
// Rend `(chemin, traits)` ou `none`. Le nombre de traits vient de l'index et
// non du SVG : c'est lui qui fixe la largeur d'une case.
#let bande-traits(ch) = if ch in TRAITS-INDEX {
  let e = TRAITS-INDEX.at(ch)
  (chemin: "/.kanjivg/traits/" + e.f + ".svg", traits: e.n)
} else { none }

// --- difficulte ------------------------------------------------------------
// LA DIFFICULTE DE CE LIVRE EST LE NOMBRE DE TRAITS, et c'est un choix de fond,
// pas un tri parmi d'autres. Un cahier d'ECRITURE entraine une main : ce qui y
// est difficile, c'est le nombre de gestes a enchainer dans une case de 7 mm,
// pas la rarete du mot ni le niveau d'examen. 一 (1 trait) est trivial a tracer
// et 驚 (22) ne l'est jamais, quel que soit le niveau JLPT de chacun.
//
// Rang d'une fiche, du plus simple au plus dur :
//   1. le nombre de traits ;
//   2. a egalite, le PLUS PRODUCTIF d'abord — le caractere qui rend le plus de
//      mots lisibles se rentabilise le plus vite, et c'etait deja le critere
//      qui ordonnait les chapitres hors famille ;
//   3. le glyphe, pour que l'ordre soit TOTAL. Sans ce dernier cran, deux
//      caracteres a egalite parfaite se rangeraient dans l'ordre du graphe,
//      donc le livre changerait d'ordre a chaque retouche de `kanji.jsonld`.
#let rang-kanji(k) = (strokes(k), -words-for(name(k)).len(), name(k))

// Difficulte d'un chapitre = la MOYENNE des traits de ses fiches.
//
// La moyenne, et non le maximum : un maximum ferait d'un seul caractere dense
// la difficulte de toute sa famille — 「Famille 言」 partirait en fin de volume
// pour son 議 (20) alors que ses onze autres membres sont sous les treize
// traits. La moyenne dit ce que la famille coute a ECRIRE d'un bout a l'autre,
// qui est ce qu'on lui demande.
#let difficulte-chapitre(ks) = if ks.len() == 0 { 0 } else {
  ks.map(strokes).sum() / ks.len()
}

// --- chapitres -------------------------------------------------------------
// Les 51 lecons `track: kanji` donnent les familles de radical (「Famille 氵 —
// eau」) ; le graphe les ordonnait par `jlpt:order`, et le livre suivait.
//
// ⚠ CE LIVRE NE SUIT PLUS CET ORDRE, et il faut savoir ce que ca coute. La
// progression du graphe est celle que l'app enseigne : un cahier qui la
// contredit n'est plus le compagnon de l'app, c'est un volume d'entrainement
// au TRACE, qui se parcourt du geste le plus simple au plus dur. Le GROUPEMENT
// par famille, lui, est intact — c'est lui qui fait qu'une planche montre ce
// que le radical a en commun, et aucun tri ne le defait.
#let LESSONS = LESSON-DOC.filter(l => f(l, "jlpt:track") == "kanji").sorted(key: l => f(l, "jlpt:order", default: 0))

#let LESSON-CHAPTERS = LESSONS.map(l => (
  titre: name(l),
  source: "famille",
  kanji: lst(f(l, "covers")).filter(id => id in KANJI-BY-ID).map(id => KANJI-BY-ID.at(id)),
))

// Les 259 kanji qu'aucune lecon ne couvre. Le graphe ne porte pas de
// decomposition en radicaux : leur inventer une famille serait se tromper en
// silence. Ils sont donc tries par la MEME regle que tout le reste, puis
// decoupes en tranches — ce qui rend chaque tranche homogene en difficulte, la
// premiere ne portant que des caracteres de quelques traits.
#let COVERED-IDS = {
  let s = (:)
  for ch in LESSON-CHAPTERS { for k in ch.kanji { s.insert(f(k, "@id"), true) } }
  s
}

#let ORPHANS = KANJI.filter(k => not (f(k, "@id") in COVERED-IDS)).sorted(key: rang-kanji)

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

// L'ordre du volume : fiches triees dans chaque chapitre, puis chapitres tries
// entre eux. Les deux familles de chapitres sont melees a dessein — une tranche
// « hors famille » de six traits se lit apres 「Famille 亻」 et avant
// 「Famille 言」 si c'est la sa place, parce que le lecteur suit une courbe de
// difficulte, pas un decoupage administratif du referentiel.
//
// ⚠ Le tri des chapitres se fait sur `(difficulte, indice d'origine)`. L'indice
// n'est pas une precaution de style : `sorted` est stable en Typst, mais la
// moyenne est un FLOTTANT, et deux chapitres de meme moyenne exacte se
// departagent alors par leur place dans le graphe plutot que par l'ordre
// d'evaluation — c'est reproductible, et ca se relit.
#let CHAPTERS = {
  let tous = LESSON-CHAPTERS + ORPHAN-CHAPTERS
  let indexes = tous.enumerate().map(((i, c)) => (
    titre: c.titre,
    source: c.source,
    kanji: c.kanji.sorted(key: rang-kanji),
    ordre: i,
  ))
  indexes.sorted(key: c => (difficulte-chapitre(c.kanji), c.ordre))
}

#let FICHES = CHAPTERS.map(c => c.kanji.len()).sum()

// L'ORDRE EST L'ARGUMENT DE CE LIVRE : il se prouve, il ne se constate pas.
//
// Ces deux assertions coutent une passe sur 810 entiers et attrapent la seule
// panne qui compte ici — un volume qui s'imprime dans le desordre, ce qui ne
// leve rien du tout. Elles echouent a la COMPILATION, donc `kanji/book.test.ts`
// les declenche partout ou `typst` existe.
//
// ⚠ Une comparaison NON STRICTE : les ex aequo sont la regle, pas l'exception
// (57 kanji a 5 traits, et deux chapitres peuvent partager une moyenne). Exiger
// une croissance stricte ferait echouer un livre parfaitement ordonne.
#let _moyennes = CHAPTERS.map(c => difficulte-chapitre(c.kanji))
#assert(
  _moyennes.sorted() == _moyennes,
  message: "chapitres hors ordre de difficulte : " + repr(_moyennes),
)
#for c in CHAPTERS {
  let ts = c.kanji.map(strokes)
  assert(
    ts.sorted() == ts,
    message: "fiches hors ordre de difficulte dans « " + c.titre + " » : " + repr(ts),
  )
}
