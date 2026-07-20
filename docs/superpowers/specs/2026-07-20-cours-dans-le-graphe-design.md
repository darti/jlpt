# Les cours dans le graphe — design

**Date :** 2026-07-20
**État :** validé, prêt pour un plan d'implémentation

## Le problème

`data/` ne contient plus que deux choses : `data/graph/*.jsonld` et quatre `data/cours-*.json`.
Ces quatre-là sont les derniers survivants de l'ancien modèle, et ils ne sont pas là par oubli :
**le graphe ne porte pas leur contenu.**

`lesson.jsonld` est une ombre structurelle partielle du cours. Elle a les 92 groupes et elle
ordonne des entités, mais elle ne porte que `schema:name`, `jlpt:order`, `jlpt:track`, `covers`.
Ce que le cours affiche vraiment vit encore dans les JSON :

| | `cours-*.json` | `lesson.jsonld` |
|---|---|---|
| groupes | 92 | 92 ✅ |
| items | 1391 | **245 orphelins** (0 gram, 66 vocab, 179 kanji) |
| exemples | **227** (992 lignes d'analyse) | aucun |
| conseils de méthode | **12** | aucun |

(`covers` totalise 1145 IRIs et non 1391 − 245 = 1146 : la liste est dédoublonnée, deux items
d'une même leçon pointant vers la même entité ne comptent qu'une fois.)

C'est une duplication d'un genre désagréable : les deux copies ne sont pas redondantes, elles
sont **complémentaires**. Ni l'une ni l'autre ne suffit seule, donc aucune ne peut être
supprimée — et la structure des 92 groupes existe bel et bien deux fois.

## Ce que le terrain dit exactement

Mesuré avant de concevoir, parce que trois hypothèses raisonnables étaient fausses :

| Piste | Constat |
|---|---|
| **Grammaire** | **0 orphelin.** Les 222 items pointent déjà tous vers un `GrammarPoint`. Les 227 exemples sont **tous ici** — 212 items sur 222 en portent un. |
| **Vocabulaire** | 66 « orphelins », mais **63 sont un problème de format** : il suffit de retirer le suffixe entre parenthèses (`予防(する)` → l'entité `予防`) ou de prendre la première forme d'une cellule `A / B`. Les 3 restants sont des cellules qui énumèrent plusieurs mots (`得意(な) / 苦手(な), etc.`, `苦しい / 怖い`, `なかなか〜ない`) : **elles deviennent des items pointant vers plusieurs entités**, `covers` étant déjà une liste. |
| **Kanji** | **179 kanji réellement absents** du référentiel (偶 傷 仁 停 任 俳 優 泳 温 治 湯 濃…) sur 631. Du contenu à créer, pas un problème de format. |
| **Méthode** | 2 sections × 6 conseils. **Prose pure, aucun item** — rien vers quoi pointer. |

Corollaire important : `vocab` et `kanji` ne portent **aucun** exemple. Un `jlpt:Example` ne
concerne que la grammaire, ce qui simplifie le modèle.

## Décisions

### D1 — Un exemple se rattache à l'ENTITÉ, pas à la leçon

```
Leçon ──covers──► GrammarPoint ◄──illustrates── Example
                       ▲
Question ──tests───────┘   (10 307 arêtes, déjà en place)
```

**Pourquoi.** C'est la promesse du graphe : corriger une fois, atteindre le cours *et* le quiz.
Les questions portent déjà des arêtes `tests` vers ces mêmes `GrammarPoint` ; un exemple attaché
à l'entité devient donc consultable depuis le corrigé du quiz. Attaché à la leçon, il resterait
enfermé dans le cours, et un point enseigné dans deux leçons dupliquerait ses exemples.

Rejeté : porter les deux arêtes (`illustrates` + `inLesson`). Deux arêtes à garder cohérentes,
donc la possibilité qu'un exemple illustre un point que sa leçon ne couvre pas — l'incohérence
silencieuse que ce graphe existe pour supprimer.

### D2 — La méthode devient un type du graphe

`jlpt:MethodNote`, une par section. `data/` devient alors **100 % graphe** : plus un seul JSON
hors `data/graph/`, donc plus de « sauf celui-là » à expliquer.

**Coût assumé :** un nœud isolé, sans arête. C'est de la prose, elle n'a de relation avec rien.
Rejeté : créer un type `jlpt:Skill` pour y rattacher les conseils — un type entier pour 12
conseils, alors que les compétences ne sont aujourd'hui que des chaînes.

### D3 — Les 179 kanji manquants deviennent des entités

Le cours porte déjà `kanji` + `sens` pour chacun. Le référentiel passe de **631 à 810**, et la
leçon kanji pointe vers **100 % de ses items**.

Les lectures on/kun manqueront sur ces 179 : c'est un **trou mesuré**, pas une perte — le cours
ne les portait pas non plus. Rejeté : laisser la leçon porter des items inline, ce qui
réintroduirait la duplication (corriger le sens de 優 se ferait à deux endroits).

### D4 — Le script de migration est jetable

Il est écrit, exécuté, et **supprimé dans le même commit** que `cours-*.json`. Il n'est jamais
commité comme outil durable.

**Pourquoi.** Ce dépôt s'est fait avoir deux fois : `transform-cours.mjs` (lit et réécrit les
mêmes fichiers, mort aujourd'hui) et `migrate-to-graph.mjs` (non idempotent, supprimé au lot 4).
Un générateur qui survit finit par écraser du travail fait à la main. Ce qui porte une règle
durable est extrait avant sa mort — comme `toHiragana` l'a été vers `tools/graph/readings.mjs`.

### D5 — La progression du cours repart de zéro

Les ids d'item (`gram:動詞verbe`, `kanji:位`) sont pourtant quasi-isomorphes aux IRIs
(`jlpt:gram/動詞verbe`, `jlpt:kanji/位`), donc une migration mécanique était possible. Choix
retenu : repartir de zéro, comme la progression du quiz au lot 1. `COURS_KEY` sera purgée.

## Architecture

### Types du graphe

```json
{ "@id": "jlpt:example/ために-1", "@type": "jlpt:Example",
  "illustrates": "jlpt:gram/ために",
  "jlpt:jp": "健康のために毎朝走っている。",
  "jlpt:romaji": "kenkō no tame ni maiasa hashitte iru.",
  "schema:description": "Je cours chaque matin pour ma santé.",
  "jlpt:analysis": ["健康（けんこう）« santé »→健康のために …", "…"] }

{ "@id": "jlpt:method/dokkai", "@type": "jlpt:MethodNote",
  "schema:name": "読解 — Méthode compréhension écrite",
  "jlpt:order": 0,
  "jlpt:tip": ["Lis d'abord les questions, puis le texte.", "…"] }
```

`illustrates` est un alias de `context.jsonld` (`@type: @id`), comme `tests` / `covers` /
`usesKanji`. `jlpt:analysis` et `jlpt:tip` sont des listes de chaînes.

`jlpt:Lesson` **ne change pas**. Elle ordonne, elle ne recopie rien.

### Nouveaux documents

| Fichier | Contenu |
|---|---|
| `data/graph/example.jsonld` | 227 `jlpt:Example` |
| `data/graph/method.jsonld` | 2 `jlpt:MethodNote` |

`kanji.jsonld` passe à 810 sujets ; `lesson.jsonld` est régénéré avec 0 orphelin.

### Runtime — `/cours` joint le graphe

Une **seule** couche connaît le JSON-LD : `src/features/cours/coursFromGraph.ts`. Elle fetche
`lesson` + `gram`/`kanji`/`word` + `example` + `method` et reconstitue la forme `CoursCategory`
existante. Les composants (`GroupDetail`, listes, progression) **ne changent pas** — même
principe qu'au lot 2 avec `src/lib/graph.ts`, et c'est ce qui rendra leurs tests valables sans
modification.

`coursGramIndex.ts` (index forme → point, consommé par le « Rappel de cours » du quiz) fetche
`cours-gram.json` : il doit passer à `gram.jsonld`.

**Hors périmètre, explicitement :** remplacer l'heuristique de parsing de `coursGramIndex` par
les arêtes `tests` déjà présentes sur les questions. C'est le lot 3 (axes de navigation) ; le
mélanger ici ferait deux migrations dans un même changement.

### Validation

- `ExampleShape` et `MethodNoteShape` dans `shapes.jsonld` (8 types au total).
- `illustrates` ajouté à `REF_PREDICATES` de `integrity.mjs` → une référence pendante devient
  une erreur, comme pour `tests` / `covers` / `usesKanji`.
- **Nouveau contrôle : zéro item de leçon orphelin.** Aujourd'hui 245 sont tolérés en silence.
  Après migration il n'y en a plus, donc le contrôle devient une **erreur** — c'est ce qui
  garantit qu'aucun contenu ne disparaîtra à la prochaine édition du cours.

### Suppressions

`data/cours-{gram,vocab,kanji,method}.json`, le script de migration (cf. D4), et
**`tools/validate.mjs` en entier** — il n'aurait plus rien à valider — avec son étape CI.

Résultat : `data/` = `graph/` seul, **un seul validateur**.

⚠ Les trois inventaires de fichiers livrés (`copy-static.mjs`, `scripts/dev.ts`, `sw.js`)
doivent perdre `cours-*.json` et gagner `example.jsonld` / `method.jsonld`, et `CACHE` doit
être bumpé. Les tests d'inventaire ajoutés au lot 2 le vérifient automatiquement pour
`data/graph/` ; ils devront couvrir le retrait des cours.

## Critères de succès

1. `data/` ne contient plus que `graph/`.
2. `node tools/validate-graph.mjs` passe, avec **0 orphelin** de leçon (contrôle bloquant).
3. `bun test` et `bun run typecheck` passent. Les composants de `src/features/cours/` **et
   leurs tests** n'ont pas été modifiés — seule la couche de chargement change.
4. Vérification navigateur sur le build servi : les trois pistes affichent leurs items avec
   sens et lecture, une fiche de grammaire affiche ses exemples avec l'analyse, la méthode
   affiche ses 12 conseils, et le « Rappel de cours » du quiz fonctionne toujours.
5. Aucune requête en échec ni erreur console.

## Risques

| Risque | Parade |
|---|---|
| Le join client-side multiplie les fetch au chargement de `/cours` | `Promise.all`, et les documents sont déjà précachés par le SW depuis le lot 2 |
| La normalisation vocab (`予防(する)` → `予防`) rate un cas et perd un item | Le contrôle « 0 orphelin » devient bloquant : un item non rattaché fait échouer la validation |
| Le script de migration survit par accident | Sa suppression est dans le même commit ; la revue doit le vérifier |
| `example.jsonld` grossit le payload | 227 exemples ≈ 200 Ko bruts, ≈ 25 Ko gzippés. Négligeable (cf. mesures du lot 2) |
