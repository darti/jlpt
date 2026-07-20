# Modèle de données : le contenu devient un graphe JSON-LD

Statut : validé, prêt pour le plan d'implémentation
Date : 2026-07-20

## Pourquoi

Le contenu de `data/` n'est pas un modèle mais trois îlots reliés par des outils morts
ou manuels.

```
bank.json ──split-bank.mjs──▶ bank-*.json + bank-index.json ──fetch──▶ app
    └──── miné à la main (584ca6b) ────▶ dict.json ──fetch──▶ app

cours-gram/vocab/kanji/method.json ──fetch──▶ app
    ▲
    └── transform-cours.mjs  ✝ n'est plus exécutable
        (lit data/cours-dokkai.json et cours-choukai.json, supprimés depuis)

grammar.json · vocab.json · kanji.json  ──▶ (rien)
    └── 2,5 Mo validés par la CI, consommés par personne
```

Les trois pannes constatées ont la même cause — des dérivés qu'aucun mécanisme ne
re-synchronise :

| symptôme | mesure |
|---|---|
| Deux référentiels de grammaire concurrents | 246 et 251 formes, dont **122 et 127 disjointes** |
| Lien quiz → fiche de grammaire deviné en parsant `<b>` dans la prose du corrigé | **48,7 %** de résolution (572 / 1174) |
| `dict.json` contredit `vocab.json` | **36** lectures fausses qui s'affichent réellement (`嫌`→きら au lieu de いや, `下`→さ au lieu de した) |
| Présentation incohérente des lectures | **138** en katakana contre 3 024 en hiragana |
| Entrées de dictionnaire vides | **419** sans définition, **203** sans lecture |
| Banques d'auteur décrochées | `od` : 10310/10310 dans `bank.json`, 0/246 et 45/2955 dans les sources |
| Compétences non distinctes | 読み方 réparti 2504 en `vocabulaire` / 1353 en `kanji` ; 意味 453 / 759 |

Défauts unitaires certains, à corriger au passage : `#1381` propose `なながつ` deux fois
(3 options réelles) ; 5 paires de questions homophones proposent les mêmes options et
désignent une bonne réponse différente (ids 5884/5886, 6182/9014, 6348/6862, 7594/8448,
7618/8468) — quel que soit le choix, une des deux corrige à tort.

## Objectif

Le contenu devient **un graphe de connaissance navigable par plusieurs axes**, source
unique, sans dérivé. Une correction faite une fois atteint le quiz, le dictionnaire et
le cours parce qu'il n'y a qu'un nœud.

Cible à terme : JLPT devient un plugin Oku, rendu par a2ui. Le modèle adopte donc les
conventions d'`oku-domain-bridge` — sujets RDF décrits par des `sh:NodeShape` en JSON-LD,
validés par lot, upsertés dans le store, interrogés en SPARQL, projetés en `DomainEntity`.

### Non-objectifs

- **Combler les trous de contenu.** Le graphe rend le manque mesurable ; il ne l'écrit pas.
  ~261 fiches de grammaire et 277 corrigés sans forme en gras resteront à faire à la main.
- **Préserver la progression des utilisateurs.** Décision explicite : la remise à zéro est
  acceptée, c'est ce qui débloque le reste.
- **Recatégoriser kanji / vocabulaire.** Le chevauchement est documenté, pas traité ici.

### Contrainte de calendrier

`EXAM_DATE` = 2026-12-06, soit 139 jours. L'app sert à réviser pendant toute la migration :
elle doit rester utilisable à chaque étape.

## Architecture

Le graphe **est** le format livré. Pas d'étape de build, pas de fichier dérivé. L'app fetche
des sujets JSON-LD shardés, construit ses index en mémoire au montage, et le moteur travaille
sur les index — jamais sur le graphe.

Ce n'est pas un mécanisme neuf : `loadCoursGramIndex` fetche déjà `cours-gram.json` et
construit une `Map` mémoïsée. On généralise ce qui existe.

```
data/graph/
  context.jsonld          @context partagé (préfixes, alias de termes)
  shapes.jsonld           sh:NodeShape par type — décrit ET valide
  kanji.jsonld            ~700 sujets jlpt:Kanji
  word.jsonld             ~4 000 sujets jlpt:Word          (remplace dict.json)
  gram.jsonld             ~400 sujets jlpt:GrammarPoint
  lesson.jsonld           leçons qui POINTENT vers les entités
  q-grammaire.jsonld      questions shardées par compétence —
  q-kanji.jsonld          même granularité de chargement qu'aujourd'hui
  q-vocabulaire.jsonld
  q-lecture.jsonld
  q-ecoute.jsonld
```

Trois fichiers disparaissent en tant que concepts : `dict.json` devient une vue sur les nœuds
`jlpt:Word` ; les `cours-*.json` cessent de recopier mot/lecture/sens ; les banques d'auteur
orphelines sont absorbées puis supprimées.

Coût de charge utile mesuré, sur 10310 questions :

```
format actuel (bank.json)     4,6 Mo
sujets JSON-LD compacts       5,4 Mo   (+19 %)   ← retenu
quads dépliés [s,p,o,i]       7,4 Mo   (+62 %)   ← rejeté
```

On livre des **sujets compacts**, pas des quads dépliés.

## Vocabulaire

Les IRIs portent du japonais : Oku accepte l'Unicode non-ASCII (RFC 3987, `is_safe_iri_for_sql`).
Interdits : `'`, `;`, `--`, `\`, `/*`, contrôles ASCII, contrôles de formatage Unicode, vide.
Les formes de grammaire à espace ou slash (`〜ようだ / 〜みたいだ`) sont sluggées.

```jsonc
// context.jsonld
{ "@context": {
    "schema": "https://schema.org/",
    "jlpt":   "https://okutheory.com/jlpt/vocab#",
    "tests":     { "@id": "jlpt:tests",     "@type": "@id", "@container": "@set" },
    "usesKanji": { "@id": "jlpt:usesKanji", "@type": "@id", "@container": "@set" },
    "covers":    { "@id": "jlpt:covers",    "@type": "@id", "@container": "@list" },
    "opts":      { "@id": "jlpt:option",    "@container": "@list" }
} }
```

```jsonc
// word.jsonld — source unique de la lecture et du sens
{ "@id": "jlpt:word/影響", "@type": "jlpt:Word",
  "schema:name": "影響", "jlpt:reading": "えいきょう",
  "schema:description": "influence", "jlpt:level": "N3",
  "usesKanji": ["jlpt:kanji/影", "jlpt:kanji/響"] }

// gram.jsonld
{ "@id": "jlpt:gram/tara", "@type": "jlpt:GrammarPoint",
  "jlpt:form": "〜たら", "jlpt:altForm": [], "jlpt:level": "N4",
  "schema:description": "quand / si… — condition ponctuelle",
  "jlpt:structure": "V(forme た) ＋ ら",
  "schema:example": [{ "jlpt:ja": "駅に着いたら、電話します。",
                       "jlpt:fr": "Quand j'arriverai à la gare, je t'appellerai." }] }

// q-grammaire.jsonld — la question DÉCLARE ce qu'elle teste
{ "@id": "jlpt:q/gram-0001", "@type": "jlpt:Question",
  "jlpt:skill": "grammaire", "jlpt:difficulty": 1, "jlpt:ord": 0,
  "jlpt:stem": "家に帰っ___、電話します。",
  "opts": ["たら", "なら", "ば", "と"], "jlpt:answer": 0,
  "tests": ["jlpt:gram/tara"],
  "schema:description": "<b>〜たら</b> = « quand/dès que »…",
  "jlpt:optionNote": ["« quand/dès que » : convient ici", "…", "…", "…"] }

// lesson.jsonld — le cours ORDONNE, il ne recopie plus
{ "@id": "jlpt:lesson/gram-conditionnel", "@type": "jlpt:Lesson",
  "schema:name": "Le conditionnel", "jlpt:order": 3,
  "covers": ["jlpt:gram/tara", "jlpt:gram/nara", "jlpt:gram/ba"] }
```

Les axes sont bidirectionnels par construction : `tests` donne question → fiche et fiche →
questions ; `usesKanji` donne mot → kanji et kanji → mots ; `covers` donne leçon → notions et
notion → où elle est enseignée.

### Décisions de modélisation

- **`jlpt:ord`** — ordinal dense, technique, qui préserve le bitset de couverture base64
  (1,3 Ko pour 10310 questions) et laisse `coverage.ts` inchangé. Attribué **à la migration
  et jamais réédité à la main** ; garanti par une shape `minCount 1 / maxCount 1` et par un
  test de densité + unicité.
- **`tests` est un `@set`** — une question de lecture peut tester plusieurs points, et ça
  évite une migration de cardinalité plus tard.
- **`covers` est un `@list`, pas un `@set`** — l'ordre des notions dans une leçon est
  pédagogique et doit être porté par la donnée. `jlpt:order` sur la leçon ordonne les leçons
  entre elles ; `covers` ordonne les notions à l'intérieur. La traversée inverse
  (notion → leçons) reste possible : elle se construit à l'indexation.
- **Le HTML reste dans `schema:description`** — les corrigés contiennent du `<b>` et
  `Corrige.tsx` fait déjà `dangerouslySetInnerHTML`. Le graphe ne l'assainit pas ; en
  revanche `extractGrammarForm` disparaît.

## Validation : le partage SHACL / code

**Déclaratif — `shapes.jsonld`, portable chez Oku sans retouche :**

```jsonc
{ "@id": "jlpt:QuestionShape", "@type": "sh:NodeShape",
  "sh:targetClass": "jlpt:Question",
  "sh:property": [
    { "sh:path": "jlpt:stem",       "sh:datatype": "xsd:string",             "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:answer",     "sh:datatype": "xsd:nonNegativeInteger", "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:ord",        "sh:datatype": "xsd:nonNegativeInteger", "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:skill",      "sh:in": ["grammaire","vocabulaire","kanji","lecture","ecoute"],
                                                                             "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:difficulty", "sh:datatype": "xsd:integer",            "sh:minCount": 1, "sh:maxCount": 1 },
    { "sh:path": "jlpt:tests",      "sh:nodeKind": "sh:IRI" }
  ] }
```

Le validateur JS implémente **exactement le sous-ensemble d'Oku**, et rien de plus. Vérifié
dans `domain-bridge/src/shape.rs` : les seules contraintes acceptées sont `sh:path`,
`sh:datatype`, `sh:minCount`, `sh:maxCount`, `sh:in`, `sh:nodeKind` — toute autre fait
échouer le parseur (`unsupported constraint`). Donc pas de `sh:pattern`.

⚠ **`sh:in` n'accepte que des littéraux chaîne.** Le parseur d'Oku fait
`filter_map(|v| v.as_str())` : une valeur numérique est **silencieusement ignorée**, et
`"sh:in": [1,2,3]` parserait en liste vide. `jlpt:difficulty` utilise donc
`sh:datatype: xsd:integer`, et sa plage 1–3 est vérifiée côté impératif. Le validateur JS
doit **rejeter** un `sh:in` contenant un non-string plutôt que de l'ignorer comme Oku :
mieux vaut échouer ici que produire une shape qui ne veut pas dire la même chose là-bas.

**Impératif — reste du code, parce que SHACL contraint une forme, pas une relation :**

| contrôle | pourquoi hors SHACL |
|---|---|
| `answer` dans les bornes de `opts` | arithmétique entre deux propriétés |
| `optionNote.length === opts.length` | idem |
| `difficulty` dans 1–3 | `sh:in` numérique impossible (voir ci-dessus) |
| options identiques dans une question | unicité intra-liste |
| réponses contradictoires entre questions | inter-sujets |
| `ord` dense et unique | invariant global |
| `tests` pointant vers une IRI inexistante | intégrité référentielle |

La dernière ligne est une classe d'erreur qu'aujourd'hui **rien ne peut détecter**, faute de
lien matérialisé. Elle devient une vérification triviale.

## Impact sur le code

**Les couches pures ne bougent pas.** `pickAdaptive`, `allocateCount`, `composeSession`,
`selectDiagnostic`, `elo.ts`, `scoring.ts` continuent de recevoir des `Question[]` : seul le
format interne de `loadCategory` change. Leurs tests passent inchangés — c'est le contrôle qui
prouve que la migration n'a pas touché aux règles du moteur.

| fichier | changement |
|---|---|
| `src/lib/graph.ts` | **nouveau** — charge le référentiel une fois, construit index directs et inverses. O(n) au montage, mémoïsé. |
| `src/lib/bank.ts` | `loadCategory` fetche `q-<cat>.jsonld` et mappe vers `Question` |
| `src/features/cours/coursGramIndex.ts` | **supprimé** — `resolveGrammarRappel` devient une lecture d'IRI ; `extractGrammarForm` et `normalizeForm` disparaissent |
| `src/lib/dict.ts` | `furi()` interroge l'index des mots au lieu de sa `READ` privée |
| `tools/validate.mjs` | réécrit : validateur de shapes + contrôles impératifs |
| `tools/split-bank.mjs` | **supprimé** — plus de dérivé à produire |
| `tools/transform-cours.mjs` | **supprimé** — déjà mort |
| `tools/copy-static.mjs`, `scripts/dev.ts`, `sw.js` | les trois inventaires livrés pointent vers `data/graph/` |

## Migration

Un script **exécuté une fois**, dont le résultat est commité, puis **le script est supprimé**.
C'est délibérément l'inverse de `transform-cours.mjs`, qui lisait et réécrivait les mêmes
fichiers et qui en est mort. Le graphe devient la source ; rien ne le régénère.

| arête | méthode | rendement mesuré |
|---|---|---|
| `tests` (kanji, vocab) | sujet extrait de 「…」 **et existant comme entité** | 5 460 / 9 052 (60 %) |
| `tests` (grammaire) | `<b>` du corrigé contre référentiel fusionné | 636 / 1 174 (54 %) |
| `usesKanji` | balayage des caractères du mot | intégral |
| `ord` | index courant du tableau | intégral |
| entités | sujets extraits + `dict.json` + banques d'auteur fusionnées | ~5 000 nœuds |

### Précédence en cas de conflit

Trois sources décrivent la lecture d'un mot et se contredisent 105 fois. Règle unique, appliquée
mécaniquement puis vérifiée à la main sur les écarts :

1. **`vocab.json` / `kanji.json`** — lecture explicite `読み：…`, saisie par l'auteur. Fait foi.
2. **`dict.json`** — miné automatiquement depuis `bank.json`, jamais relu. Ne sert que si (1)
   est muet.
3. Un conflit où (1) est absent et (2) suspect (lecture non mono-kana, katakana sur un mot,
   valeur qui ressemble à une paire « A / B ») est **signalé, pas tranché** : ces cas
   entrent dans une liste à arbitrer, ils ne partent pas dans le graphe en silence.

### Devenir de chaque fichier

| aujourd'hui | demain |
|---|---|
| `bank.json` | éclaté en `q-<compétence>.jsonld` ; le fichier disparaît |
| `bank-*.json`, `bank-index.json` | supprimés (dérivés) |
| `dict.json` | absorbé dans `word.jsonld` |
| `cours-gram/vocab/kanji.json` | éclatés en entités + `lesson.jsonld` |
| `cours-method.json` | conservé tel quel — contenu rédactionnel, pas des entités |
| `grammar.json`, `vocab.json`, `kanji.json` | absorbés puis supprimés |

Taux d'arêtes réel, mesuré : **59,1 %**. L'estimation initiale de 90 % sur vocab/kanji
confondait « sujet extractible de 「…」 » et « sujet existant comme entité » : 8 278 sujets
sont extractibles, seuls 5 462 correspondent à une entité.

⚠ **Ne PAS fabriquer d'entités depuis les sujets non résolus**, contrairement à ce que
cette spec affirmait d'abord (« le sujet extrait EST le mot-vedette »). Sur les 2 560
sujets sans entité, 998 sont des phrases entières (「申し込みは明日までです」), et une bonne
part du reste n'est pas lexicale non plus : marqueurs de trou (`___日`, `___手`) ou
lectures en kana que la question demande justement d'écrire en kanji (`やくそく`). En faire
des entités injecterait `jlpt:word/___日` dans le graphe — exactement le genre de déchet
que ce modèle doit empêcher.

Les questions sans arête **restent sans arête**. Une question sans `tests` est valide
(`minCount 0`) mais compte dans la métrique de couverture : le graphe rend le trou
mesurable, il ne le comble pas.

Corrections appliquées pendant la migration : l'option dupliquée de `#1381`, les 5 paires
homophones (désambiguïsation de l'énoncé), les 3 doublons purs inter-catégories, les 36
lectures fausses, l'unification katakana → hiragana des 138 lectures concernées.

## Séquencement

L'app sert à réviser pendant les 139 jours qui restent : aucune étape ne doit la laisser
cassée. Chaque lot ci-dessous se termine par une app fonctionnelle, testée et déployable.

**Lot 1 — le socle, sans toucher au runtime.** `context.jsonld` + `shapes.jsonld` + le
validateur de sous-ensemble SHACL + les contrôles impératifs, branchés en CI **à côté** de
`validate.mjs`. Le script de migration produit `data/graph/` et le commit. À ce stade le
graphe existe et est validé, mais l'app continue de lire `bank-*.json` : rien ne peut casser.

**Lot 2 — bascule de la lecture.** `graph.ts` + `loadCategory` lit `q-<cat>.jsonld`. Les
couches pures ne bougent pas, leurs tests non plus. Les trois inventaires de fichiers livrés
pointent vers `data/graph/`. C'est le seul lot à risque runtime : il se valide en servant le
build localement avant de pousser.

**Lot 3 — les axes.** Suppression de `coursGramIndex.ts` ; le rappel de cours passe par
`tests`. `dict.ts` interroge l'index des mots. Le cours rend des leçons qui pointent.

**Lot 4 — le ménage.** Suppression de `bank.json`, `bank-*.json`, `dict.json`, des banques
d'auteur, de `split-bank.mjs`, `transform-cours.mjs`, du script de migration, et de l'ancien
`validate.mjs`. Rien n'est supprimé avant que son remplaçant ne soit en production.

Les corrections de contenu (option dupliquée, paires homophones, lectures fausses) sont
appliquées dans le lot 1, sur le graphe, où elles sont vérifiables par les nouveaux contrôles.

## Tests

- validateur de shapes : un test par contrainte du sous-ensemble ;
- intégrité référentielle : aucune IRI pendante ;
- `ord` dense et unique sur l'ensemble du corpus ;
- constructeurs d'index : tests purs, sur le modèle de `buildCoursGramIndex` ;
- tests existants du moteur : inchangés, ils doivent passer tels quels ;
- **métrique de couverture des liens avec plancher** : échoue si le taux régresse, pour que le
  travail éditorial ne se défasse pas silencieusement.

## Risques

| risque | traitement |
|---|---|
| Le script de migration se ré-exécute et écrase du travail éditorial | il est supprimé après usage ; le graphe est la source |
| +19 % de charge utile sur mobile | shardé par compétence, comme les pools actuels ; à mesurer sur le build |
| Le chemin chaud traverse le graphe par inadvertance | le moteur ne voit que des `Question[]` ; les index sont construits au montage |
| Le sous-ensemble SHACL JS diverge de celui d'Oku | s'en tenir à cardinalité / datatype / `sh:in` ; ne rien ajouter sans contrepartie côté Oku |
| Perte de contenu à la migration | comptage avant/après par compétence, en test |

## Questions ouvertes

Aucune ne bloque le lot 1.

- **Graphes nommés.** `NodeShape` porte un `graph` chez Oku. Faut-il un graphe par type dès
  maintenant, ou un graphe unique jusqu'à l'ingestion ? Tranchable au lot 1 sans coût, mais
  plus cher après si on découpe tard.
- **Chevauchement kanji / vocabulaire.** Documenté, non traité ici : 読み方 réparti 2504 / 1353,
  意味 453 / 759, donc les deux ratings Elo mesurent la même aptitude sur un partage arbitraire.
  À reprendre une fois le graphe en place, où recatégoriser devient une réécriture d'arêtes au
  lieu d'une réécriture de fichiers.
- **Travail éditorial.** ~261 fiches de grammaire à écrire et 277 corrigés sans forme en gras à
  reprendre pour dépasser le plafond de 76,4 % sur l'axe quiz → fiche. Hors périmètre technique,
  mais c'est là qu'est l'essentiel du gain restant.
