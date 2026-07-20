# Énoncés ambigus « Xを漢字で書くと？ » — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser superpowers:subagent-driven-development
> (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche.
> Les étapes utilisent la syntaxe case à cocher (`- [ ]`).

**But :** rendre défendable chacune des questions dont l'énoncé admet plusieurs réponses
correctes, en les réécrivant en phrase à trou, et empêcher la récidive par un contrôle en CI.

## Révisions du plan (G9 — le plan doit rester exact)

Quatre écarts constatés à l'exécution, tous par mesure et non par supposition. Ils sont
consignés ici parce que chacun invalidait une hypothèse du plan initial.

**R1 — les chiffres du plan venaient de sondes trop étroites.** « 134 contradictions,
585 homophones » supposait un balayage limité à `q-vocabulaire` et aux énoncés
« を漢字で書くと ». Le balayage complet donne **135 groupes contradictoires** (dont un à
cheval sur deux shards, invisible d'un groupement par fichier) et un périmètre plus large.
Chiffres courants : voir la sortie de `node tools/graph/audit-stems.mjs`.

**R2 — la détection est à TROIS classes, pas deux, et deux d'entre elles sont des preuves.**
Le plan ne prévoyait que l'heuristique de prose. `word.jsonld` porte les lectures : un
distracteur qui partage la `jlpt:reading` de la réponse EST une seconde bonne réponse, sans
jugement. D'où `contradictions` + `memeLecture` (prouvés, verrou CI possible) et `suspects`
(heuristique, rapport seulement).

**R3 — l'heuristique de prose change de sens selon le sens de la question.** En
「X」の読み方は？, une note « homophone » désigne la lecture d'un AUTRE mot (いっぱん = 一般,
distracteur de 一番) : la question est saine. La restreindre au sens écriture élimine
36 faux positifs qui auraient bloqué la CI.

**R4 — `word.jsonld` est pollué, et ça corrompait la preuve.** Il contient des distracteurs
fabriqués importés comme mots (約速、役束、約則 tous « やくそく », aucune glose), qui faisaient
passer des questions saines pour ambiguës. L'index est restreint aux mots GLOSÉS. La purge du
dictionnaire fait l'objet d'un lot séparé (cf. tâche 9).

**R5 — le corpus écrit ses trous de deux façons.** `___` ASCII (1529 énoncés) et `＿`
pleine chasse (256, tous en grammaire). Ne lire que l'ASCII réclamait l'arbitrage de
questions déjà à trou. On LIT les deux, on n'ÉCRIT que l'ASCII.

**Architecture :** on sépare la **décision** (quelle phrase, quel gloss — jugement humain, non
mécanisable) de l'**application** (patch idempotent du graphe — code testé). C'est exactement la
chaîne déjà en place pour les lectures JMdict : `propose` → fichier de décisions relu par
l'auteur → `apply` qui n'écrase jamais rien. Trois modules purs et testables
(`audit-stems.mjs`, `stems.mjs`, contrôles dans `integrity.mjs`), chacun avec une CLI mince.

**Pile technique :** Node pur pour `tools/**/*.mjs` (la CI exécute `node`, jamais `bun` —
aucune API `Bun.*`), `bun test` pour les tests, JSON-LD indenté à 1 espace + newline finale.

## Contraintes globales

- **`jlpt:ord` est immuable.** Il indexe les bitsets `seen`/`mastered`, `wrong[]` et
  `jlptN3quiz_resume.ids` en localStorage. Aucune tâche ne crée, ne supprime ni ne renumérote une
  question. On ne modifie que `jlpt:stem` et `jlpt:gloss`.
- **`jlpt:answer` et `opts` sont immuables.** La bonne réponse ne change pas ; on ajoute du
  contexte à l'énoncé pour que cette réponse devienne la seule défendable.
- **`tools/**/*.mjs` = Node-compatible obligatoire.** `.github/workflows/validate.yml` lance
  `node tools/validate-graph.mjs` (setup-node 20). Aucun `Bun.file`, `Bun.write`, `Bun.$`.
- **Écriture JSON-LD :** `JSON.stringify(doc, null, 1) + "\n"`, comme `readings.mjs:72`. Toute
  autre indentation réécrit 4,6 Mo de diff pour rien.
- **Format de trou :** `___` (trois soulignés ASCII U+005F), jamais `＿＿＿` (U+FF3F). C'est la
  forme déjà employée par les 1079 questions de `q-grammaire` et les 609 de `q-kanji`.
- **Format d'énoncé cible :** `<phrase avec ___>。（<lecture en kana>）` — la lecture reste dans
  l'énoncé, sinon on change la compétence testée (écriture → compréhension).
- **Pas de linter** dans le projet. `bun run typecheck` + `bun test` font foi.
- Tout le travail se fait dans le worktree `.worktrees/fix-enonces-ambigus`.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `tools/graph/audit-stems.mjs` | **Créer.** Détection pure : rend la liste des questions à énoncé ambigu. Aucune écriture. |
| `tools/graph/audit-stems.test.ts` | **Créer.** Tests de la détection. |
| `tools/graph/stems.mjs` | **Créer.** Application pure et idempotente des énoncés arbitrés. Aucune écriture (la CLI écrit). |
| `tools/graph/stems.test.ts` | **Créer.** Tests de l'application, dont idempotence et non-écrasement. |
| `tools/graph/integrity.mjs` | **Modifier.** Resserrer `checkCorpus` (contradiction sur l'énoncé seul) + nouveau contrôle « homophone sans désambiguïsation ». |
| `tools/graph/integrity.test.ts` | **Modifier.** Retourner le test de tolérance ligne 91, ajouter les cas neufs. |
| `data/enonces-arbitres.json` | **Créer.** Décisions de l'auteur : `@id` → `{ from, stem, gloss }`. Source, jamais généré automatiquement. |
| `docs/superpowers/enonces-a-arbitrer.md` | **Créer (généré, non commité en l'état).** Rapport d'audit pour relecture. |
| `data/graph/q-vocabulaire.jsonld` | **Modifier** par `stems.mjs` uniquement. |
| `sw.js` | **Modifier.** Bump `CACHE` — `data/graph/*.jsonld` est un asset livré. |
| `CLAUDE.md` | **Modifier.** Documenter la nouvelle chaîne décision/application. |

---

### Task 1 : Détection des énoncés ambigus

**Fichiers :**
- Créer : `tools/graph/audit-stems.mjs`
- Test : `tools/graph/audit-stems.test.ts`

**Interfaces :**
- Consomme : rien (première tâche).
- Produit : `auditStems(sujets) → { contradictions: Group[], homophones: Question[] }`
  où `Group = { stem: string, questions: {id: string, ord: number, answer: string}[] }`.
  Les tâches 2, 5 et 6 en dépendent.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tools/graph/audit-stems.test.ts` :

```ts
import { test, expect } from "bun:test";
import { auditStems } from "./audit-stems.mjs";

const q = (id: string, ord: number, extra: Record<string, unknown>) => ({
  "@id": id, "@type": "jlpt:Question", "jlpt:skill": "vocabulaire",
  "jlpt:difficulty": 2, "jlpt:ord": ord, ...extra,
});

test("auditStems groupe deux questions au même énoncé et réponses divergentes", () => {
  // Cas réel : #2569 et #4609 partagent 「あける」を漢字で書くと？ mais se corrigent
  // l'une l'autre à tort. Les jeux d'options DIFFÈRENT — c'est précisément pour ça que
  // checkCorpus les ratait.
  const a = q("jlpt:q/2569", 2569, {
    "jlpt:stem": "「あける」を漢字で書くと？",
    opts: ["閉ける", "明ける", "開ける", "開く"], "jlpt:answer": 2,
  });
  const b = q("jlpt:q/4609", 4609, {
    "jlpt:stem": "「あける」を漢字で書くと？",
    opts: ["開ける", "空ける", "明ける", "昭ける"], "jlpt:answer": 2,
  });
  const { contradictions } = auditStems([a, b]);
  expect(contradictions).toHaveLength(1);
  expect(contradictions[0].stem).toBe("「あける」を漢字で書くと？");
  expect(contradictions[0].questions.map((x) => x.answer).sort()).toEqual(["明ける", "開ける"]);
});

test("auditStems ne groupe pas deux questions au même énoncé et MÊME réponse", () => {
  const a = q("jlpt:q/1", 0, { "jlpt:stem": "同じ", opts: ["A", "B"], "jlpt:answer": 0 });
  const b = q("jlpt:q/2", 1, { "jlpt:stem": "同じ", opts: ["A", "C"], "jlpt:answer": 0 });
  expect(auditStems([a, b]).contradictions).toEqual([]);
});

test("auditStems signale un distracteur noté homophone sans désambiguïsation", () => {
  const a = q("jlpt:q/4609", 4609, {
    "jlpt:stem": "「あける」を漢字で書くと？",
    opts: ["開ける", "空ける", "明ける", "昭ける"], "jlpt:answer": 2,
    "jlpt:optionNote": [
      "開ける（あける）« ouvrir » : homophone, kanji différent",
      "空ける（あける）« vider » : homophone, kanji différent",
      "Correct : 明ける",
      "昭ける : graphie inexistante",
    ],
  });
  expect(auditStems([a]).homophones.map((x) => x.id)).toEqual(["jlpt:q/4609"]);
});

test("auditStems ignore une note « homophone » portée par la BONNE réponse", () => {
  // La note de la réponse décrit la réponse, pas un piège : elle ne rend rien ambigu.
  const a = q("jlpt:q/1", 0, {
    "jlpt:stem": "「かんじ」を漢字で書くと？", opts: ["感じ", "漢字"], "jlpt:answer": 1,
    "jlpt:optionNote": ["感じ : autre mot", "Correct : 漢字, homophone de 感じ"],
  });
  expect(auditStems([a]).homophones).toEqual([]);
});

test("auditStems considère un énoncé à trou comme déjà désambiguïsé", () => {
  const a = q("jlpt:q/1", 0, {
    "jlpt:stem": "夜が___。（あける）",
    opts: ["開ける", "空ける", "明ける", "昭ける"], "jlpt:answer": 2,
    "jlpt:optionNote": ["開ける : homophone", "空ける : homophone", "Correct : 明ける", "昭ける : inexistant"],
  });
  expect(auditStems([a]).homophones).toEqual([]);
});

test("auditStems considère la forme 「…の意味」 comme déjà désambiguïsée", () => {
  // Convention préexistante du corpus (ord 93521), à ne pas casser.
  const a = q("jlpt:q/1", 0, {
    "jlpt:stem": "「おさめる」を漢字で書くと（「gouverner un pays」の意味）？",
    opts: ["収める", "治める"], "jlpt:answer": 1,
    "jlpt:optionNote": ["収める : homophone", "Correct : 治める"],
  });
  expect(auditStems([a]).homophones).toEqual([]);
});

test("auditStems ignore les sujets qui ne sont pas des questions", () => {
  expect(auditStems([{ "@id": "jlpt:word/明", "@type": "jlpt:Word" }]))
    .toEqual({ contradictions: [], homophones: [] });
});
```

- [ ] **Étape 2 : lancer le test pour vérifier qu'il échoue**

```bash
cd .worktrees/fix-enonces-ambigus && bun test tools/graph/audit-stems.test.ts
```

Attendu : ÉCHEC, `Cannot find module './audit-stems.mjs'`.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Créer `tools/graph/audit-stems.mjs` :

```js
// Détecte les énoncés qui admettent plusieurs réponses correctes.
//
// Deux classes, de fiabilité très différente — elles sont rendues séparément pour ça :
//
//   contradictions : OBJECTIF. Deux questions portent le même énoncé et se corrigent
//     mutuellement à tort (#2569 vs #4609 sur 「あける」). Aucun jugement requis : le
//     corpus se contredit lui-même. C'est ce que checkCorpus ratait, parce que sa clé
//     de groupement inclut le jeu d'options — or l'apprenant ne voit qu'un énoncé.
//
//   homophones : HEURISTIQUE. Un distracteur non-réponse est annoté « homophone » par
//     l'auteur du corrigé, et l'énoncé ne porte aucune désambiguïsation. Le signal est
//     de la prose française : suffisant pour trier un rapport de relecture, à ne pas
//     confondre avec une preuve.
//
// Node pur : la CI exécute `node`, jamais `bun`.

const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const isQuestion = (s) => arr(s["@type"]).includes("jlpt:Question");

/** Un énoncé est désambiguïsé s'il porte un trou (`___`) ou la glose de sens 「…の意味」.
 *  Les deux formes préexistent dans le corpus ; on reconnaît les deux pour ne pas
 *  redemander l'arbitrage de ce qui est déjà arbitré. */
export function isDisambiguated(stem) {
  return /_{3,}/.test(String(stem ?? "")) || /の意味/.test(String(stem ?? ""));
}

/** Rend les deux classes d'énoncés à arbitrer. Fonction pure : aucune lecture disque. */
export function auditStems(sujets) {
  const questions = sujets.filter(isQuestion);

  // --- contradictions : clé = énoncé SEUL ---
  const parEnonce = new Map();
  for (const q of questions) {
    const k = norm(q["jlpt:stem"]);
    if (!parEnonce.has(k)) parEnonce.set(k, []);
    parEnonce.get(k).push(q);
  }
  const contradictions = [];
  for (const [stem, groupe] of parEnonce) {
    if (groupe.length < 2) continue;
    const reponses = new Set(groupe.map((q) => norm(arr(q.opts)[q["jlpt:answer"]])));
    if (reponses.size < 2) continue;
    contradictions.push({
      stem,
      questions: groupe.map((q) => ({
        id: q["@id"], ord: q["jlpt:ord"], answer: norm(arr(q.opts)[q["jlpt:answer"]]),
      })),
    });
  }

  // --- homophones : distracteur annoté, énoncé nu ---
  const homophones = questions
    .filter((q) => !isDisambiguated(q["jlpt:stem"]))
    .filter((q) => arr(q["jlpt:optionNote"])
      .some((n, i) => i !== q["jlpt:answer"] && /homophone/i.test(String(n))))
    .map((q) => ({
      id: q["@id"], ord: q["jlpt:ord"], stem: norm(q["jlpt:stem"]),
      opts: arr(q.opts), answer: norm(arr(q.opts)[q["jlpt:answer"]]),
      notes: arr(q["jlpt:optionNote"]),
      description: q["schema:description"] ?? "",
    }));

  return { contradictions, homophones };
}
```

- [ ] **Étape 4 : lancer les tests pour vérifier qu'ils passent**

```bash
bun test tools/graph/audit-stems.test.ts
```

Attendu : 7 pass, 0 fail.

- [ ] **Étape 5 : commit**

```bash
git add tools/graph/audit-stems.mjs tools/graph/audit-stems.test.ts
git commit -m "feat(graph): détecte les énoncés admettant plusieurs réponses correctes"
```

---

### Task 2 : CLI d'audit — rapport de relecture + squelette de décisions

**Fichiers :**
- Modifier : `tools/graph/audit-stems.mjs` (ajouter le bloc CLI en fin de fichier)

**Interfaces :**
- Consomme : `auditStems(sujets)` de la tâche 1.
- Produit : deux fichiers sur disque —
  `docs/superpowers/enonces-a-arbitrer.md` (rapport lisible) et
  `data/enonces-arbitres.skel.json` (squelette à compléter, **jamais** commité tel quel).

- [ ] **Étape 1 : écrire le bloc CLI**

Ajouter en fin de `tools/graph/audit-stems.mjs` :

```js
// --- CLI ---------------------------------------------------------------------------
// Ne produit QUE des documents de relecture. Aucune écriture dans data/graph/ : la
// décision appartient à l'auteur, l'application est le travail de stems.mjs.
if (process.argv[1]?.endsWith("audit-stems.mjs")) {
  const { readFileSync, writeFileSync, mkdirSync } = await import("node:fs");

  const SHARDS = ["q-vocabulaire", "q-kanji", "q-grammaire", "q-lecture", "q-ecoute"];
  const sujets = SHARDS.flatMap(
    (f) => JSON.parse(readFileSync(`data/graph/${f}.jsonld`, "utf8"))["@graph"] ?? [],
  );
  const { contradictions, homophones } = auditStems(sujets);

  const enContradiction = new Set(contradictions.flatMap((g) => g.questions.map((q) => q.id)));
  const lignes = [
    "# Énoncés à arbitrer",
    "",
    "Généré par `node tools/graph/audit-stems.mjs`. **Ne pas éditer** : consigner les",
    "décisions dans `data/enonces-arbitres.json`, puis lancer `node tools/graph/stems.mjs`.",
    "",
    `- ${contradictions.length} énoncés contradictoires ` +
      `(${enContradiction.size} questions) — **priorité**, le corpus se contredit`,
    `- ${homophones.length} énoncés à distracteur homophone non désambiguïsé`,
    "",
    "## Contradictions",
    "",
  ];
  for (const g of contradictions) {
    lignes.push(`### ${g.stem}`, "");
    for (const q of g.questions) lignes.push(`- \`${q.id}\` (ord ${q.ord}) → **${q.answer}**`);
    lignes.push("");
  }
  lignes.push("## Distracteurs homophones", "");
  for (const h of homophones) {
    lignes.push(
      `### \`${h.id}\` (ord ${h.ord})${enContradiction.has(h.id) ? " — aussi contradictoire" : ""}`,
      "",
      `- énoncé : ${h.stem}`,
      `- options : ${h.opts.map((o, i) => (i === h.opts.indexOf(h.answer) ? `**${o}**` : o)).join(" / ")}`,
      `- sens attendu : ${String(h.description).replace(/<[^>]+>/g, "")}`,
      "",
    );
  }
  mkdirSync("docs/superpowers", { recursive: true });
  writeFileSync("docs/superpowers/enonces-a-arbitrer.md", lignes.join("\n") + "\n");

  // Squelette : un objet par question, `stem` et `gloss` à REMPLIR par l'auteur. `from`
  // est l'énoncé actuel — c'est lui qui permettra à stems.mjs de détecter un désaccord
  // plutôt que d'écraser une correction déjà faite à la main.
  const skel = Object.fromEntries(
    homophones.map((h) => [h.id, { from: h.stem, stem: "", gloss: "" }]),
  );
  writeFileSync("data/enonces-arbitres.skel.json", JSON.stringify(skel, null, 1) + "\n");

  console.log(`${contradictions.length} contradiction(s), ${homophones.length} homophone(s)`);
  console.log("→ docs/superpowers/enonces-a-arbitrer.md");
  console.log("→ data/enonces-arbitres.skel.json (à compléter, puis renommer sans .skel)");
}
```

- [ ] **Étape 2 : lancer la CLI et vérifier les nombres**

```bash
node tools/graph/audit-stems.mjs
```

Attendu, exactement :
```
134 contradiction(s), 585 homophone(s)
```
Si les nombres diffèrent, **s'arrêter** et le signaler : le corpus a bougé depuis
l'analyse, et le plan doit être remis à jour avant d'aller plus loin (G9).

- [ ] **Étape 3 : vérifier que le graphe n'a pas été touché**

```bash
git status --porcelain data/graph/
```
Attendu : sortie vide. L'audit ne doit **rien** écrire dans `data/graph/`.

- [ ] **Étape 4 : ignorer le squelette**

Ajouter à `.gitignore` :
```
data/enonces-arbitres.skel.json
docs/superpowers/enonces-a-arbitrer.md
```

- [ ] **Étape 5 : commit**

```bash
git add tools/graph/audit-stems.mjs .gitignore
git commit -m "feat(graph): rapport de relecture des énoncés à arbitrer"
```

---

### Task 3 : Application idempotente des énoncés arbitrés

**Fichiers :**
- Créer : `tools/graph/stems.mjs`
- Test : `tools/graph/stems.test.ts`

**Interfaces :**
- Consomme : le format de décision produit par la tâche 2 —
  `{ "<@id>": { from: string, stem: string, gloss: string } }`.
- Produit : `applyStems(sujets, decisions) → { sujets, poses, questions, conflits, inconnus }`.
  `poses` = nombre d'énoncés écrits ; `conflits` = ids dont le graphe porte un énoncé
  qui n'est ni `from` ni `stem` ; `inconnus` = décisions sans question correspondante.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tools/graph/stems.test.ts` :

```ts
import { test, expect } from "bun:test";
import { applyStems } from "./stems.mjs";

const ANCIEN = "「あける」を漢字で書くと？";
const NOUVEAU = "夜が___。（あける）";
const GLOSS = "夜（よる）« nuit » · が « sujet » · 明ける（あける）« se lever, finir »";

const q = (id: string, stem: string, gloss?: string) => ({
  "@id": id, "@type": "jlpt:Question", "jlpt:skill": "vocabulaire",
  "jlpt:difficulty": 2, "jlpt:ord": 4609, "jlpt:stem": stem,
  opts: ["開ける", "空ける", "明ける", "昭ける"], "jlpt:answer": 2,
  ...(gloss ? { "jlpt:gloss": gloss } : {}),
});

const dec = { "jlpt:q/4609": { from: ANCIEN, stem: NOUVEAU, gloss: GLOSS } };

test("applyStems remplace l'énoncé et le gloss de la question visée", () => {
  const { sujets, poses } = applyStems([q("jlpt:q/4609", ANCIEN, "vieux gloss")], dec);
  expect(sujets[0]["jlpt:stem"]).toBe(NOUVEAU);
  expect(sujets[0]["jlpt:gloss"]).toBe(GLOSS);
  expect(poses).toBe(1);
});

test("applyStems ne touche NI à ord NI à answer NI aux options", () => {
  // Invariant dur : ord indexe les bitsets de progression en localStorage.
  const avant = q("jlpt:q/4609", ANCIEN);
  const { sujets } = applyStems([avant], dec);
  expect(sujets[0]["jlpt:ord"]).toBe(4609);
  expect(sujets[0]["jlpt:answer"]).toBe(2);
  expect(sujets[0].opts).toEqual(["開ける", "空ける", "明ける", "昭ける"]);
});

test("applyStems est idempotent : deux passes donnent le même graphe", () => {
  const un = applyStems([q("jlpt:q/4609", ANCIEN)], dec);
  const deux = applyStems(un.sujets, dec);
  expect(deux.sujets).toEqual(un.sujets);
  expect(deux.poses).toBe(0); // le second passage ne pose plus rien
});

test("applyStems SIGNALE au lieu d'écraser un énoncé modifié entre-temps", () => {
  // Même invariant que readings.mjs : le graphe fait autorité, un désaccord se voit.
  const { sujets, poses, conflits } = applyStems([q("jlpt:q/4609", "énoncé retouché à la main")], dec);
  expect(sujets[0]["jlpt:stem"]).toBe("énoncé retouché à la main");
  expect(poses).toBe(0);
  expect(conflits).toEqual(["jlpt:q/4609"]);
});

test("applyStems refuse une décision au stem vide plutôt que d'écrire un énoncé vide", () => {
  const { sujets, poses } = applyStems(
    [q("jlpt:q/4609", ANCIEN)], { "jlpt:q/4609": { from: ANCIEN, stem: "   ", gloss: GLOSS } },
  );
  expect(sujets[0]["jlpt:stem"]).toBe(ANCIEN);
  expect(poses).toBe(0);
});

test("applyStems refuse un énoncé cible sans trou ___", () => {
  // Le trou est la forme convenue (q-grammaire, q-kanji). Un énoncé sans trou est une
  // décision incomplète : mieux vaut la refuser que livrer un format bâtard.
  const { poses, refuses } = applyStems(
    [q("jlpt:q/4609", ANCIEN)],
    { "jlpt:q/4609": { from: ANCIEN, stem: "夜が明ける。（あける）", gloss: GLOSS } },
  );
  expect(poses).toBe(0);
  expect(refuses).toEqual(["jlpt:q/4609"]);
});

test("applyStems signale une décision qui ne vise aucune question", () => {
  const { poses, inconnus } = applyStems([q("jlpt:q/1", ANCIEN)], dec);
  expect(poses).toBe(0);
  expect(inconnus).toEqual(["jlpt:q/4609"]);
});

test("applyStems ne touche pas aux sujets qui ne sont pas des questions", () => {
  const mot = { "@id": "jlpt:q/4609", "@type": "jlpt:Word", "schema:name": "明ける" };
  const { sujets, poses } = applyStems([mot], dec);
  expect(sujets[0]).toEqual(mot);
  expect(poses).toBe(0);
});
```

- [ ] **Étape 2 : lancer le test pour vérifier qu'il échoue**

```bash
bun test tools/graph/stems.test.ts
```
Attendu : ÉCHEC, `Cannot find module './stems.mjs'`.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Créer `tools/graph/stems.mjs` :

```js
// Applique les énoncés ARBITRÉS par l'auteur sur les shards de questions.
//
// Même invariant que readings.mjs, et pour la même raison : ce script **pose** une
// décision, il ne régénère rien. Il est idempotent, et il n'écrase jamais un énoncé que
// le graphe porte déjà et que la décision n'attendait pas — un désaccord est signalé,
// pas résolu en silence. Le graphe fait autorité.
//
// La chaîne :
//   1. node tools/graph/audit-stems.mjs  → rapport + squelette de décisions
//   2. l'auteur rédige SES phrases dans data/enonces-arbitres.json
//   3. node tools/graph/stems.mjs        → patch des shards q-*.jsonld
//   4. node tools/validate-graph.mjs     → confirme
//
// Node pur : la CI exécute `node`, jamais `bun`.
import { readFileSync, writeFileSync } from "node:fs";

const DECISIONS = "data/enonces-arbitres.json";
const SHARDS = ["q-vocabulaire", "q-kanji", "q-grammaire", "q-lecture", "q-ecoute"];

const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const isQuestion = (s) => arr(s["@type"]).includes("jlpt:Question");

/**
 * Pose les énoncés décidés sur les questions visées.
 *
 * Rend les sujets patchés et quatre rapports : ce qui a été posé, les décisions refusées
 * (cible mal formée), les conflits (le graphe porte un énoncé imprévu) et les décisions
 * sans cible. Seul `poses` écrit ; tout le reste se contente de signaler.
 */
export function applyStems(sujets, decisions) {
  const vises = new Set(Object.keys(decisions));
  const poses = [];
  const refuses = [];
  const conflits = [];

  const out = sujets.map((s) => {
    if (!isQuestion(s)) return s;
    const id = s["@id"];
    const d = decisions[id];
    if (!d) return s;
    vises.delete(id);

    const cible = norm(d.stem);
    const actuel = norm(s["jlpt:stem"]);

    // Déjà posé : rien à faire. C'est ce qui rend le script rejouable sans danger.
    if (actuel === cible) return s;

    // Le graphe a bougé depuis l'audit : on ne décide pas à la place de l'auteur.
    if (actuel !== norm(d.from)) { conflits.push(id); return s; }

    // Décision incomplète ou mal formée : refuser vaut mieux qu'un format bâtard.
    if (!cible || !/_{3,}/.test(cible)) { refuses.push(id); return s; }

    poses.push(id);
    return { ...s, "jlpt:stem": cible, ...(norm(d.gloss) ? { "jlpt:gloss": norm(d.gloss) } : {}) };
  });

  return { sujets: out, poses: poses.length, questions: poses, refuses, conflits, inconnus: [...vises] };
}

if (process.argv[1]?.endsWith("stems.mjs")) {
  const decisions = JSON.parse(readFileSync(DECISIONS, "utf8"));
  let total = 0;
  const refuses = [], conflits = [];
  let restants = new Set(Object.keys(decisions));

  for (const f of SHARDS) {
    const chemin = `data/graph/${f}.jsonld`;
    const doc = JSON.parse(readFileSync(chemin, "utf8"));
    const r = applyStems(doc["@graph"] ?? [], decisions);
    if (r.poses) writeFileSync(chemin, JSON.stringify({ ...doc, "@graph": r.sujets }, null, 1) + "\n");
    for (const id of r.questions) restants.delete(id);
    for (const id of [...r.refuses, ...r.conflits]) restants.delete(id);
    refuses.push(...r.refuses);
    conflits.push(...r.conflits);
    total += r.poses;
    console.log(`${f} : ${r.poses} énoncé(s) posé(s)`);
  }

  console.log(`\n${total} énoncé(s) posé(s) au total`);
  if (refuses.length) console.log(`⚠ ${refuses.length} décision(s) refusée(s) (cible sans ___) : ${refuses.join(", ")}`);
  if (conflits.length) console.log(`⚠ ${conflits.length} conflit(s) — le graphe porte un énoncé imprévu : ${conflits.join(", ")}`);
  if (restants.size) console.log(`⚠ ${restants.size} décision(s) sans question : ${[...restants].join(", ")}`);
  console.log("Relancer `node tools/validate-graph.mjs` pour confirmer.");
}
```

- [ ] **Étape 4 : lancer les tests pour vérifier qu'ils passent**

```bash
bun test tools/graph/stems.test.ts
```
Attendu : 8 pass, 0 fail.

- [ ] **Étape 5 : commit**

```bash
git add tools/graph/stems.mjs tools/graph/stems.test.ts
git commit -m "feat(graph): applique les énoncés arbitrés sans jamais écraser le graphe"
```

---

### Task 4 : Lot pilote — 20 énoncés, format validé avant l'échelle

**Fichiers :**
- Créer : `data/enonces-arbitres.json`
- Modifier : `data/graph/q-vocabulaire.jsonld` (via `stems.mjs` uniquement)

**Interfaces :**
- Consomme : `audit-stems.mjs` (tâche 2) pour la liste, `stems.mjs` (tâche 3) pour poser.
- Produit : `data/enonces-arbitres.json` peuplé de 20 décisions. Les tâches 5 et 6
  l'étendent, elles ne le remplacent pas.

**Pourquoi un pilote :** 585 phrases japonaises rédigées d'un bloc et refusées en bloc,
c'est 585 phrases à refaire. On fait valider la forme sur 20 d'abord.

- [ ] **Étape 1 : générer le rapport**

```bash
node tools/graph/audit-stems.mjs
```

- [ ] **Étape 2 : rédiger les 20 premières décisions**

Prendre les 20 premières entrées de la section « Contradictions » du rapport (priorité :
ce sont celles où le corpus se contredit). Créer `data/enonces-arbitres.json` sur ce
modèle — `from` recopié **verbatim** du squelette, `stem` et `gloss` rédigés :

```json
{
 "jlpt:q/4609": {
  "from": "「あける」を漢字で書くと？",
  "stem": "夜が___。（あける）",
  "gloss": "夜（よる）« nuit » · が « sujet » · 明ける（あける）« (jour) se lever, finir »"
 },
 "jlpt:q/2569": {
  "from": "「あける」を漢字で書くと？",
  "stem": "窓を___。（あける）",
  "gloss": "窓（まど）« fenêtre » · を « COD » · 開ける（あける）« ouvrir »"
 }
}
```

Règles de rédaction, sans exception :
- La phrase doit rendre **une seule** option correcte. Si deux options restent
  défendables dans le contexte choisi, la phrase est mauvaise — en changer.
- Vocabulaire et grammaire au niveau N3 ou en dessous.
- `___` remplace exactement le mot à écrire, forme conjuguée comprise.
- La lecture entre `（）` en fin d'énoncé est celle de la **réponse**, en kana.
- Le `gloss` décompose la phrase token par token, séparateur ` · `, sur le modèle
  existant : `mot（lecture）« sens français »`.

- [ ] **Étape 3 : poser les décisions**

```bash
node tools/graph/stems.mjs
```
Attendu : `20 énoncé(s) posé(s) au total`, aucun refus, aucun conflit.

- [ ] **Étape 4 : vérifier l'idempotence sur le vrai graphe**

```bash
node tools/graph/stems.mjs && git diff --stat data/graph/
```
Attendu : `0 énoncé(s) posé(s) au total` au second passage, et **aucune ligne ajoutée par
ce second passage** au-delà du diff du premier.

- [ ] **Étape 5 : valider le graphe**

```bash
node tools/validate-graph.mjs
```
Attendu : sortie de succès, exit 0.

- [ ] **Étape 6 : point d'arrêt — faire relire les 20**

Montrer les 20 énoncés à l'auteur. **Ne pas passer à la tâche 5 sans accord explicite sur
la forme.** C'est le seul moment où corriger le format coûte 20 phrases et non 585.

- [ ] **Étape 7 : commit**

```bash
git add data/enonces-arbitres.json data/graph/q-vocabulaire.jsonld
git commit -m "fix(data): désambiguïse 20 énoncés contradictoires en phrases à trou"
```

---

### Task 5 : Solde des contradictions (114 énoncés restants)

**Fichiers :**
- Modifier : `data/enonces-arbitres.json`, `data/graph/q-vocabulaire.jsonld`,
  `data/graph/q-kanji.jsonld`, `data/graph/q-grammaire.jsonld`

**Interfaces :**
- Consomme : format et outillage validés en tâche 4.
- Produit : zéro contradiction résiduelle — c'est la précondition de la tâche 7.

- [ ] **Étape 1 : traiter par lots de 30**

Pour chaque lot : étendre `data/enonces-arbitres.json`, puis

```bash
node tools/graph/stems.mjs && node tools/validate-graph.mjs
```
Attendu à chaque lot : le nombre posé égale le nombre de décisions ajoutées ; validation OK.

- [ ] **Étape 2 : vérifier qu'il ne reste aucune contradiction**

```bash
node tools/graph/audit-stems.mjs
```
Attendu : `0 contradiction(s), <N> homophone(s)` — le premier nombre **doit** être 0.

- [ ] **Étape 3 : commit par lot**

```bash
git add data/enonces-arbitres.json data/graph/
git commit -m "fix(data): désambiguïse le lot <n> des énoncés contradictoires"
```

---

### Task 6 : Solde des distracteurs homophones

**Fichiers :**
- Modifier : `data/enonces-arbitres.json`, `data/graph/q-*.jsonld`

**Interfaces :**
- Consomme : idem tâche 5.
- Produit : `auditStems` rend `{ contradictions: [], homophones: [] }` sur le corpus.

- [ ] **Étape 1 : traiter par lots de 50, mêmes commandes qu'en tâche 5**

- [ ] **Étape 2 : vérifier que l'audit est vide**

```bash
node tools/graph/audit-stems.mjs
```
Attendu : `0 contradiction(s), 0 homophone(s)`.

- [ ] **Étape 3 : vérifier qu'aucun ord n'a bougé**

```bash
git diff data/graph/ | grep -c '^[-+] *"jlpt:ord"'
```
Attendu : `0`. Un seul `jlpt:ord` touché corrompt la progression des utilisateurs —
si ce nombre n'est pas 0, **s'arrêter** et annuler le lot fautif.

- [ ] **Étape 4 : commit par lot**

```bash
git add data/enonces-arbitres.json data/graph/
git commit -m "fix(data): désambiguïse le lot <n> des distracteurs homophones"
```

---

### Task 7 : Verrouiller en CI

**Fichiers :**
- Modifier : `tools/graph/integrity.mjs:134-150` (clé de groupement des contradictions)
- Modifier : `tools/graph/integrity.test.ts:91-95` (retourner le test de tolérance)

**Interfaces :**
- Consomme : `isDisambiguated` exporté par `audit-stems.mjs` (tâche 1) — **une seule
  implémentation de la règle**, importée, jamais recopiée.
- Produit : `checkCorpus` échoue désormais sur toute contradiction d'énoncé.

**Ordonnancement — ne pas déplacer cette tâche.** Le contrôle resserré fait échouer la CI
sur les 283 questions tant que le contenu n'est pas corrigé. Il ne peut donc atterrir
qu'**après** les tâches 5 et 6, et dans la même branche.

- [ ] **Étape 1 : retourner le test qui verrouille le bug**

Dans `tools/graph/integrity.test.ts`, remplacer le test des lignes 91-95 par :

```ts
test("checkCorpus signale le même énoncé à réponses divergentes MÊME options différentes", () => {
  // Ce test affirmait l'inverse jusqu'au 2026-07-20 (« tolère »). L'hypothèse était que
  // deux questions ne sont comparables que si elles proposent les mêmes choix — vrai pour
  // repérer un doublon mal recopié, faux pour une contradiction pédagogique : l'apprenant
  // ne voit qu'un énoncé. Cette tolérance laissait passer 134 énoncés, dont #2569/#4609
  // qui se corrigeaient l'un l'autre à tort sur 「あける」.
  const a = qq("jlpt:q/1", 0, { "jlpt:stem": "同じ", opts: ["A", "B"], "jlpt:answer": 0 });
  const b = qq("jlpt:q/2", 1, { "jlpt:stem": "同じ", opts: ["C", "D"], "jlpt:answer": 0 });
  expect(checkCorpus([a, b]).join(" ")).toMatch(/contradictoire/i);
});

test("checkCorpus tolère le même énoncé quand la RÉPONSE est la même", () => {
  const a = qq("jlpt:q/1", 0, { "jlpt:stem": "同じ", opts: ["A", "B"], "jlpt:answer": 0 });
  const b = qq("jlpt:q/2", 1, { "jlpt:stem": "同じ", opts: ["A", "C"], "jlpt:answer": 0 });
  expect(checkCorpus([a, b])).toEqual([]);
});
```

- [ ] **Étape 2 : lancer le test pour vérifier qu'il échoue**

```bash
bun test tools/graph/integrity.test.ts
```
Attendu : ÉCHEC sur le premier des deux tests ci-dessus (`received []`).

- [ ] **Étape 3 : resserrer la clé de groupement**

Dans `tools/graph/integrity.mjs`, remplacer le bloc `--- questions contradictoires ---`
(lignes 129-150) par :

```js
  // --- questions contradictoires ---
  // Même énoncé, bonne réponse différente : quel que soit le choix de l'apprenant, l'une
  // des deux le corrige à tort. La clé est l'ÉNONCÉ SEUL — c'est tout ce que l'apprenant
  // voit. Elle a longtemps inclus le jeu d'options, ce qui rendait le contrôle aveugle
  // aux 134 cas où deux questions au même énoncé proposaient des choix différents
  // (#2569 vs #4609 sur 「あける」 : 開ける d'un côté, 明ける de l'autre).
  const byKey = new Map();
  for (const q of questions) {
    const key = norm(q["jlpt:stem"]);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(q);
  }
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const answers = new Set(group.map((q) => norm(arr(q.opts)[q["jlpt:answer"]])));
    if (answers.size > 1) {
      errs.push(
        `réponses contradictoires entre ${group.map((q) => q["@id"]).join(", ")} — `
        + `« ${norm(group[0]["jlpt:stem"])} » → ${[...answers].join(" ≠ ")}`,
      );
    }
  }
```

- [ ] **Étape 4 : lancer les tests pour vérifier qu'ils passent**

```bash
bun test tools/graph/integrity.test.ts
```
Attendu : tous verts.

- [ ] **Étape 5 : ajouter le contrôle PROUVÉ « distracteur de même lecture »**

⚠ **Révision R2/R3/R4.** Le plan prévoyait ici un contrôle fondé sur la note « homophone »
du corrigé. Il ne doit PAS être livré : c'est de la prose, son sens dépend du sens de la
question, et il produit 36 faux positifs. Le contrôle livré est celui que le graphe prouve.

Il vit dans `checkCorpus` et non `checkQuestion` : il lui faut `word.jsonld`, et
`validate-graph.mjs:36-37` charge justement tous les documents dans un seul tableau.

```ts
test("checkCorpus refuse un distracteur qui partage la lecture de la réponse", () => {
  const q = qq("jlpt:q/4609", 4609, {
    "jlpt:stem": "「あける」を漢字で書くと？",
    opts: ["開ける", "明ける"], "jlpt:answer": 1,
  });
  const mots = [
    { "@id": "jlpt:word/明ける", "@type": "jlpt:Word", "schema:name": "明ける",
      "jlpt:reading": "あける", "schema:description": "(jour) se lever" },
    { "@id": "jlpt:word/開ける", "@type": "jlpt:Word", "schema:name": "開ける",
      "jlpt:reading": "あける", "schema:description": "ouvrir" },
  ];
  expect(checkCorpus([q, ...mots]).join(" ")).toMatch(/même lecture/i);
});

test("checkCorpus accepte le même jeu d'options si l'énoncé porte un trou", () => {
  const q = qq("jlpt:q/4609", 4609, {
    "jlpt:stem": "夜が___。（あける）", opts: ["開ける", "明ける"], "jlpt:answer": 1,
  });
  const mots = [
    { "@id": "jlpt:word/明ける", "@type": "jlpt:Word", "schema:name": "明ける",
      "jlpt:reading": "あける", "schema:description": "(jour) se lever" },
    { "@id": "jlpt:word/開ける", "@type": "jlpt:Word", "schema:name": "開ける",
      "jlpt:reading": "あける", "schema:description": "ouvrir" },
  ];
  expect(checkCorpus([q, ...mots])).toEqual([]);
});
```

Dans `tools/graph/integrity.mjs`, importer les deux fonctions déjà écrites et testées —
**une seule implémentation de la règle**, jamais recopiée :

```js
import { isDisambiguated, readingIndex, sameReadingConflicts } from "./audit-stems.mjs";
```

puis, dans `checkCorpus`, après le bloc des contradictions :

```js
  // --- distracteur de même lecture que la réponse ---
  // Deux graphies attestées d'une même lecture sont deux réponses correctes tant que
  // l'énoncé ne tranche pas. La preuve vient de word.jsonld, pas d'une note de corrigé.
  // ⚠ readingIndex n'indexe que les mots GLOSÉS : word.jsonld porte des distracteurs
  // fabriqués (約速、役束、約則, lecture recopiée de 約束, aucune glose) qui feraient
  // condamner des questions saines.
  for (const c of sameReadingConflicts(questions, readingIndex(subjects))) {
    if (isDisambiguated(byId.get(c.id)?.["jlpt:stem"])) continue;
    errs.push(
      `${c.id} : « ${c.jumeaux.join("、")} » se li(sen)t ${c.lecture} comme la réponse `
      + `« ${c.answer} » — l'énoncé doit trancher (phrase à trou)`,
    );
  }
```

- [ ] **Étape 5 bis (SUPPRIMÉE) : contrôle « homophone non désambiguïsé »**

Dans `tools/graph/integrity.test.ts`, ajouter :

```ts
test("checkQuestion refuse un distracteur homophone sans désambiguïsation de l'énoncé", () => {
  const q = qq("jlpt:q/4609", 4609, {
    "jlpt:stem": "「あける」を漢字で書くと？",
    opts: ["開ける", "空ける", "明ける", "昭ける"], "jlpt:answer": 2,
    "jlpt:optionNote": [
      "開ける（あける）« ouvrir » : homophone, kanji différent",
      "空ける（あける）« vider » : homophone, kanji différent",
      "Correct : 明ける", "昭ける : graphie inexistante",
    ],
  });
  expect(checkQuestion(q).join(" ")).toMatch(/homophone/i);
});

test("checkQuestion accepte le même jeu d'options si l'énoncé porte un trou", () => {
  const q = qq("jlpt:q/4609", 4609, {
    "jlpt:stem": "夜が___。（あける）",
    opts: ["開ける", "空ける", "明ける", "昭ける"], "jlpt:answer": 2,
    "jlpt:optionNote": [
      "開ける（あける）« ouvrir » : homophone, kanji différent",
      "空ける（あける）« vider » : homophone, kanji différent",
      "Correct : 明ける", "昭ける : graphie inexistante",
    ],
  });
  expect(checkQuestion(q)).toEqual([]);
});
```

Puis, dans `tools/graph/integrity.mjs`, importer la règle et l'appliquer dans
`checkQuestion`, juste avant le `return errs` :

```js
import { isDisambiguated } from "./audit-stems.mjs";
```

```js
  // Un distracteur que le corrigé lui-même qualifie d'« homophone » est une seconde
  // réponse correcte tant que l'énoncé ne tranche pas. Le signal est de la prose, donc
  // faillible — mais il vient de l'auteur du corrigé, et il a suffi à trouver 585 cas.
  if (arr(notes).some((n, i) => i !== answer && /homophone/i.test(String(n)))
      && !isDisambiguated(s["jlpt:stem"])) {
    errs.push(`${id} : distracteur « homophone » sans désambiguïsation de l'énoncé`);
  }
```

- [ ] **Étape 6 : lancer la suite complète et la validation**

```bash
bun test && bun run typecheck && node tools/validate-graph.mjs && node tools/validate.mjs
```
Attendu : tout vert, exit 0 partout. Si `validate-graph` signale des questions, c'est
qu'un cas a été manqué en tâche 5 ou 6 — y retourner, ne pas assouplir le contrôle.

- [ ] **Étape 7 : commit**

```bash
git add tools/graph/integrity.mjs tools/graph/integrity.test.ts
git commit -m "fix(graph): la clé de contradiction est l'énoncé seul, pas énoncé+options"
```

---

### Task 8 : Livraison — cache PWA et documentation

**Fichiers :**
- Modifier : `sw.js` (constante `CACHE`)
- Modifier : `CLAUDE.md` (section « Données — le graphe EST la source »)

**Interfaces :**
- Consomme : tout ce qui précède.
- Produit : rien que d'autres tâches consomment.

- [ ] **Étape 1 : bumper le cache du service worker**

`data/graph/*.jsonld` est un asset livré : sans bump, les clients installés gardent
l'ancien contenu en cache et ne voient aucune correction.

```bash
TOKENSAVE_DISABLE_GREP_HOOK=1 grep -n 'CACHE' sw.js
```
Incrémenter `jlpt-n3-vN` → `jlpt-n3-v(N+1)`.

- [ ] **Étape 2 : documenter la chaîne dans CLAUDE.md**

Sous « Lectures manquantes — la seule chaîne d'écriture outillée », remplacer « la seule »
par « la première » et ajouter :

```markdown
**Énoncés ambigus — seconde chaîne d'écriture outillée**, même invariant : elle n'écrase rien.

    node tools/graph/audit-stems.mjs   # → docs/…/enonces-a-arbitrer.md + squelette
    #   … l'auteur rédige SES phrases dans data/enonces-arbitres.json …
    node tools/graph/stems.mjs         # → pose stem + gloss sur les shards q-*.jsonld

Un énoncé « Xを漢字で書くと？ » n'est défendable que si UNE seule option est une graphie
valide de X. Sinon l'énoncé doit porter un trou (`___`) et un contexte qui tranche.
`checkQuestion` et `checkCorpus` le vérifient — le contrôle de contradiction a pour clé
l'**énoncé seul** : deux questions au même énoncé ne peuvent pas avoir deux réponses.
```

- [ ] **Étape 3 : vérification finale**

```bash
bun test && bun run typecheck && node tools/validate-graph.mjs && bun run build
```
Attendu : tout vert.

- [ ] **Étape 4 : commit**

```bash
git add sw.js CLAUDE.md
git commit -m "chore: bump cache SW et documente la chaîne d'arbitrage des énoncés"
```

---

---

### Task 9 : Purger les non-mots de `word.jsonld` — LOT SÉPARÉ

**Ne pas exécuter dans cette branche.** Décidé avec l'auteur : sujet distinct, revue
distincte. Consigné ici pour ne pas être perdu.

**Le défaut.** `word.jsonld` contient des distracteurs de quiz importés comme mots par un
générateur disparu : `約速`, `役束`, `約則`, `経検`, `径験`, `心輩`, `案全`, `便理`, `研宄`…
Chacun porte la lecture de la **bonne réponse** recopiée, et **aucune glose**. Ce fichier
est le dictionnaire que l'app sert pour les furigana et le tap-pour-définir.

**Deux effets, l'un déjà neutralisé :**
- sur la détection d'ambiguïté — neutralisé par le filtre « mot glosé » de `readingIndex` ;
- sur le dictionnaire livré — **non traité**, ces entrées y sont toujours.

**Le travail.**
1. Un outil idempotent qui retire les `jlpt:Word` sans glose **jamais réponse d'aucune
   question**. ⚠ Le critère « sans glose » seul ne suffit pas : il attrape aussi des formes
   conjuguées légitimes (`食べた`, `行われる`, `食べさせた`), distracteurs de grammaire.
2. Poser une glose sur les vrais mots à l'entrée incomplète — au moins `始め`, `始めて`,
   `謝り`, identifiés parce que le filtre les écarte à tort de la détection.
3. Vérifier ensuite si les 3 faux négatifs connus de `sameReadingConflicts` réapparaissent :
   `「はじめ」→ 初め vs 始め`, `「はじめて」→ 初めて vs 始めて`, `「あやまり」→ 誤り vs 謝り`
   sont de vraies ambiguïtés, à traiter comme les autres.
4. Bumper `CACHE` dans `sw.js` : `word.jsonld` est un asset livré.

---

## Auto-relecture

**Couverture du besoin.** #4609 → tâches 4 (pilote, c'est le cas d'exemple) et 7 (verrou).
Les 283 contradictions → tâches 4-5. Les 585 homophones → tâches 4-6. « Outil idempotent »
→ tâche 3, testée explicitement pour l'idempotence et le non-écrasement. « Règle impérative
dans validate-graph » → tâche 7. « Phrase à trou » → contrainte globale + refus en tâche 3
de toute cible sans `___`.

**Placeholders.** Aucun « TBD » ni « similaire à la tâche N » : chaque étape porte son code
ou sa commande. Les 585 phrases ne sont pas écrites ici — c'est le contenu à produire, pas
un détail éludé ; les tâches 4-6 en fixent les règles de rédaction et le critère d'arrêt.

**Cohérence des types.** `isDisambiguated` est défini une fois (tâche 1) et importé en
tâche 7, jamais recopié. `applyStems` rend `{sujets, poses, questions, refuses, conflits,
inconnus}` en tâche 3 et la CLI de la même tâche ne consomme que ces champs. Le format de
décision `{from, stem, gloss}` est produit en tâche 2 et consommé à l'identique en 3-6.

**Risque résiduel assumé.** Le contrôle « homophone » repose sur de la prose française dans
`jlpt:optionNote`. Une note mal rédigée passera au travers ; une note qui dit « homophone »
à tort bloquera la CI à tort. C'est le seul signal disponible, et il vient de l'auteur du
corrigé. Le contrôle de contradiction, lui, est purement structurel et sans faux positif.
