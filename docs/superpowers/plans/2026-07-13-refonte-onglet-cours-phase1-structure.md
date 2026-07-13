# Refonte onglet Cours — Phase 1 : structure (nav master-detail + progression)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la page unique d'accordéons de `/cours` par une navigation master-detail à 3 niveaux (hub → index de thèmes → détail), sur un schéma de données unifié `Category › Group › Item`, avec un suivi de progression léger par item — sans changer *quels* items vont dans *quels* groupes (le re-classement sémantique = plans 2-4).

**Architecture:** `/cours/*` monte un `Cours` qui charge 4 fichiers `data/cours-{gram,vocab,kanji,method}.json` (nouveau schéma) une seule fois et rend un `<Routes>` imbriqué : `index` = hub de catégories, `:cat` = index de thèmes (cartes + progression), `:cat/:group` = détail. Un outil `tools/transform-cours.mjs` (jetable) convertit les données actuelles vers le nouveau schéma pour que l'app marche de bout en bout dès la Phase 1. La progression vit dans `localStorage['jlptN3_cours_v1']`, séparée de la progression quiz.

**Tech Stack:** React 18 + TypeScript, react-router-dom (HashRouter déjà monté), Bun (runtime + test + bundle), Tailwind v4 vendorisé.

## Global Constraints

- **Runtime & outils : `bun` exclusivement — jamais `node`.** Tests : `bun test`. Typecheck : `bun run typecheck`.
- **Tout le travail dans le worktree `.worktrees/refonte-cours`** (déjà créé, branche `refonte-cours`). Ne jamais éditer la racine.
- **UI en français, contenu en japonais.** Largeur max 100 colonnes. Types `PascalCase`, fonctions `camelCase`.
- **Tests** : logique pure → unitaires ; composants → `renderToStaticMarkup` (SSR smoke) ; effets/DOM/nav → happy-dom (`createRoot` + `act`, `IS_REACT_ACT_ENVIRONMENT=true`). Router → envelopper dans `<MemoryRouter>`. ⚠ `renderToStaticMarkup` échappe les apostrophes (`'` → `&#x27;`) — asserter sur des sous-chaînes **sans** apostrophe.
- **Après modif d'un asset livré** (`data/*.json`, `sw.js`) → bumper `CACHE` dans `sw.js`.
- `data/cours-*.json` est servi automatiquement par `tools/copy-static.mjs` (regex `/^cours-.*\.json$/`) — aucun inventaire à éditer pour `cours-method.json` ; supprimer un fichier `cours-*.json` = juste le retirer de `data/`.
- **Commits** : conventional en français (`feat : …`, `test : …`, `refactor : …`, `chore : …`). **Jamais** de ligne `Co-Authored-By`.
- `bun tools/validate.mjs` doit sortir 0 à la fin.

---

## File Structure

**Créés (`src/features/cours/`)**
- `coursSchema.ts` — types du schéma unifié (`CoursCategory`, `LearnCategory`, `MethodCategory`, `CoursGroup`, `CoursItem`, `VocabItem`, `KanjiItem`, `GramItem`, `CoursExample`). Zéro logique.
- `coursProgress.ts` (+ `.test.ts`) — logique pure de progression + persistance localStorage.
- `useCoursProgress.ts` (+ `.test.tsx`) — hook `{ progress, toggle }`.
- `CoursHub.tsx` — hub des catégories (niveau 0).
- `CategoryIndex.tsx` — index des thèmes d'une catégorie (niveau 1).
- `GroupDetail.tsx` — détail d'un thème, rendu par catégorie (niveau 2).
- `MethodPage.tsx` — page de conseils (catégorie `method`).
- `Breadcrumb.tsx` — fil d'Ariane pur.

**Réécrits**
- `src/features/cours/useCours.ts` — charge les 4 fichiers du nouveau schéma → `CoursCategory[]`.
- `src/features/cours/Cours.tsx` — conteneur + `<Routes>` imbriqué + câblage progression.
- `src/features/cours/coursGramIndex.ts` (+ `.test.ts`) — adapté au nouveau schéma (parcourt `groups[].items`).
- `src/features/cours/cours.test.tsx` — réécrit pour la nouvelle vue (SSR smoke).

**Modifiés**
- `src/entries/index.tsx` — `path="cours"` → `path="cours/*"`.
- `tools/validate.mjs` — validation du schéma cours.
- `sw.js` — bump `CACHE`.

**Créé (jetable, `tools/`)**
- `tools/transform-cours.mjs` — convertit les `data/cours-*.json` actuels vers le nouveau schéma.

**Données (produites par le transform, committées)**
- `data/cours-{vocab,kanji,gram}.json` réécrits ; `data/cours-method.json` créé ; `data/cours-{dokkai,choukai}.json` supprimés.

---

## Task 1 : Schéma unifié + logique de progression (pure, TDD)

**Files:**
- Create: `src/features/cours/coursSchema.ts`
- Create: `src/features/cours/coursProgress.ts`
- Test: `src/features/cours/coursProgress.test.ts`

**Interfaces:**
- Produces (`coursSchema.ts`) :
  ```ts
  export interface CoursExample { jp: string; ro: string; fr: string; an?: string[]; }
  export interface VocabItem { id: string; mot: string; lecture: string; sens: string; niv?: string; }
  export interface KanjiItem { id: string; kanji: string; lecture: string; sens: string; exemple?: string; }
  export interface GramItem  { id: string; form: string; struct?: string; mean?: string; niv?: string; examples?: CoursExample[]; }
  export type CoursItem = VocabItem | KanjiItem | GramItem;
  export interface CoursGroup { id: string; title: string; subtitle?: string; note?: string; items: CoursItem[]; }
  export interface LearnCategory { id: "gram" | "vocab" | "kanji"; title: string; kind: "learn"; intro?: string[]; groups: CoursGroup[]; }
  export interface MethodSection { title: string; tips: string[]; }
  export interface MethodCategory { id: "method"; title: string; kind: "method"; sections: MethodSection[]; }
  export type CoursCategory = LearnCategory | MethodCategory;
  export type CoursCategoryId = CoursCategory["id"]; // "gram" | "vocab" | "kanji" | "method"
  ```
- Produces (`coursProgress.ts`) :
  ```ts
  export type ItemState = "known" | "review";
  export type CoursProgress = Record<string, ItemState>;      // absent = neuf
  export interface GroupStats { known: number; review: number; total: number; }
  export function groupProgress(group: CoursGroup, p: CoursProgress): GroupStats;
  export function categoryProgress(cat: LearnCategory, p: CoursProgress): GroupStats;
  export function cycleState(cur: ItemState | undefined): ItemState | undefined; // neuf→known→review→neuf
  export function setItemState(p: CoursProgress, id: string, s: ItemState | undefined): CoursProgress; // pur
  export function loadCoursProgress(store?: Pick<Storage, "getItem">): CoursProgress;
  export function saveCoursProgress(p: CoursProgress, store?: Pick<Storage, "setItem">): void;
  ```

- [ ] **Step 1 : Écrire `coursSchema.ts`** (types seuls, pas de test — il est exercé par la Task 1 via `coursProgress`).

Contenu = le bloc `Produces (coursSchema.ts)` ci-dessus, avec un doc-comment module en tête :
```ts
/** Schéma unifié du contenu de cours : Category › Group › Item. Zéro logique — juste les types
 *  partagés par la vue master-detail, la progression et le loader. */
```

- [ ] **Step 2 : Écrire les tests de `coursProgress`** dans `coursProgress.test.ts`

```ts
import { test, expect } from "bun:test";
import {
  groupProgress, categoryProgress, cycleState, setItemState,
  loadCoursProgress, saveCoursProgress, type CoursProgress,
} from "./coursProgress.ts";
import type { CoursGroup, LearnCategory } from "./coursSchema.ts";

const g = (id: string, ...ids: string[]): CoursGroup =>
  ({ id, title: id, items: ids.map((x) => ({ id: x, mot: x, lecture: "", sens: "" })) });

test("groupProgress compte known/review/total, ignore les états manquants", () => {
  const group = g("grp", "a", "b", "c");
  const p: CoursProgress = { a: "known", b: "review" };
  expect(groupProgress(group, p)).toEqual({ known: 1, review: 1, total: 3 });
});

test("categoryProgress additionne sur tous les groupes", () => {
  const cat: LearnCategory = { id: "vocab", title: "V", kind: "learn", groups: [g("x", "a", "b"), g("y", "c")] };
  const p: CoursProgress = { a: "known", c: "known" };
  expect(categoryProgress(cat, p)).toEqual({ known: 2, review: 0, total: 3 });
});

test("cycleState : neuf → known → review → neuf", () => {
  expect(cycleState(undefined)).toBe("known");
  expect(cycleState("known")).toBe("review");
  expect(cycleState("review")).toBe(undefined);
});

test("setItemState pose un état, supprime la clé quand undefined, sans muter l'entrée", () => {
  const p: CoursProgress = { a: "known" };
  expect(setItemState(p, "b", "review")).toEqual({ a: "known", b: "review" });
  expect(setItemState(p, "a", undefined)).toEqual({});
  expect(p).toEqual({ a: "known" }); // pas de mutation
});

test("load/save : round-trip, JSON invalide → {}, valeurs inconnues filtrées", () => {
  const mem: Record<string, string> = {};
  const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
  saveCoursProgress({ a: "known", b: "review" }, store);
  expect(loadCoursProgress(store)).toEqual({ a: "known", b: "review" });
  mem["jlptN3_cours_v1"] = "{pas du json";
  expect(loadCoursProgress(store)).toEqual({});
  mem["jlptN3_cours_v1"] = JSON.stringify({ a: "known", c: "bidon" });
  expect(loadCoursProgress(store)).toEqual({ a: "known" }); // "bidon" ignoré
});
```

- [ ] **Step 3 : Lancer les tests → échec attendu**

Run: `cd .worktrees/refonte-cours && bun test src/features/cours/coursProgress.test.ts`
Expected: FAIL (`Cannot find module './coursProgress.ts'`).

- [ ] **Step 4 : Écrire `coursProgress.ts`**

```ts
/** Progression de cours : état par item (known/review), persistée à part du quiz. Pur + localStorage. */
import type { CoursGroup, LearnCategory } from "./coursSchema.ts";

export type ItemState = "known" | "review";
export type CoursProgress = Record<string, ItemState>;
export interface GroupStats { known: number; review: number; total: number; }

const KEY = "jlptN3_cours_v1";

export function groupProgress(group: CoursGroup, p: CoursProgress): GroupStats {
  let known = 0, review = 0;
  for (const it of group.items) {
    if (p[it.id] === "known") known++;
    else if (p[it.id] === "review") review++;
  }
  return { known, review, total: group.items.length };
}

export function categoryProgress(cat: LearnCategory, p: CoursProgress): GroupStats {
  return cat.groups.reduce<GroupStats>((acc, grp) => {
    const s = groupProgress(grp, p);
    return { known: acc.known + s.known, review: acc.review + s.review, total: acc.total + s.total };
  }, { known: 0, review: 0, total: 0 });
}

export function cycleState(cur: ItemState | undefined): ItemState | undefined {
  if (cur === undefined) return "known";
  if (cur === "known") return "review";
  return undefined;
}

export function setItemState(p: CoursProgress, id: string, s: ItemState | undefined): CoursProgress {
  const next = { ...p };
  if (s === undefined) delete next[id]; else next[id] = s;
  return next;
}

export function loadCoursProgress(store: Pick<Storage, "getItem"> = globalThis.localStorage): CoursProgress {
  let raw: string | null;
  try { raw = store.getItem(KEY); } catch { return {}; }
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: CoursProgress = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === "known" || v === "review") out[k] = v;
    }
    return out;
  } catch { return {}; }
}

export function saveCoursProgress(p: CoursProgress, store: Pick<Storage, "setItem"> = globalThis.localStorage): void {
  try { store.setItem(KEY, JSON.stringify(p)); } catch { /* best-effort */ }
}
```

- [ ] **Step 5 : Lancer les tests → succès**

Run: `bun test src/features/cours/coursProgress.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6 : Commit**

```bash
git add src/features/cours/coursSchema.ts src/features/cours/coursProgress.ts src/features/cours/coursProgress.test.ts
git commit -m "feat : schéma cours unifié + logique de progression (pure, localStorage)"
```

---

## Task 2 : Hook `useCoursProgress` (happy-dom)

**Files:**
- Create: `src/features/cours/useCoursProgress.ts`
- Test: `src/features/cours/useCoursProgress.test.tsx`

**Interfaces:**
- Consumes : `loadCoursProgress`, `saveCoursProgress`, `cycleState`, `setItemState` (Task 1).
- Produces : `export function useCoursProgress(): { progress: CoursProgress; toggle: (id: string) => void; }`

- [ ] **Step 1 : Écrire le test** dans `useCoursProgress.test.tsx`

```ts
import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCoursProgress } from "./useCoursProgress.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { try { globalThis.localStorage.clear(); } catch { /* noop */ } });

test("toggle fait cycler l'état d'un item et le persiste", async () => {
  let api: ReturnType<typeof useCoursProgress> | null = null;
  function Probe() { api = useCoursProgress(); return null; }
  const host = document.createElement("div");
  const root: Root = createRoot(host);
  await act(async () => { root.render(<Probe />); });

  await act(async () => { api!.toggle("vocab:食べる"); });   // neuf → known
  expect(api!.progress["vocab:食べる"]).toBe("known");
  await act(async () => { api!.toggle("vocab:食べる"); });   // known → review
  expect(api!.progress["vocab:食べる"]).toBe("review");
  await act(async () => { api!.toggle("vocab:食べる"); });   // review → neuf
  expect(api!.progress["vocab:食べる"]).toBeUndefined();

  // persistance : re-mont → relit localStorage
  await act(async () => { api!.toggle("kanji:政"); });
  expect(JSON.parse(globalThis.localStorage.getItem("jlptN3_cours_v1")!)).toEqual({ "kanji:政": "known" });
  await act(async () => { root.unmount(); });
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run: `bun test src/features/cours/useCoursProgress.test.tsx`
Expected: FAIL (`Cannot find module './useCoursProgress.ts'`).

- [ ] **Step 3 : Écrire `useCoursProgress.ts`**

```ts
/** Charge la progression de cours une fois (localStorage), expose un toggle qui cycle + persiste. */
import { useCallback, useState } from "react";
import { loadCoursProgress, saveCoursProgress, cycleState, setItemState, type CoursProgress } from "./coursProgress.ts";

export function useCoursProgress(): { progress: CoursProgress; toggle: (id: string) => void } {
  const [progress, setProgress] = useState<CoursProgress>(() => loadCoursProgress());
  const toggle = useCallback((id: string) => {
    setProgress((cur) => {
      const next = setItemState(cur, id, cycleState(cur[id]));
      saveCoursProgress(next);
      return next;
    });
  }, []);
  return { progress, toggle };
}
```

- [ ] **Step 4 : Lancer → succès**

Run: `bun test src/features/cours/useCoursProgress.test.tsx`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/features/cours/useCoursProgress.ts src/features/cours/useCoursProgress.test.tsx
git commit -m "feat : hook useCoursProgress (cycle + persistance)"
```

---

## Task 3 : Outil de transformation → nouveau schéma + fichiers data

Convertit les `data/cours-*.json` actuels vers le nouveau schéma pour que l'app marche dès la Phase 1.
Grammaire : **fusionne** l'aide-mémoire (`Forme/Niv./Sens`, source du rappel de cours) avec les points
des leçons (struct + examples) par forme normalisée → items uniques portant `niv` **et** `examples`.

**Files:**
- Create: `tools/transform-cours.mjs`
- Produit/écrase : `data/cours-{vocab,kanji,gram}.json`, `data/cours-method.json`
- Supprime : `data/cours-dokkai.json`, `data/cours-choukai.json`

**Interfaces:**
- Produces : 4 fichiers JSON au schéma `CoursCategory`. IDs d'item : `vocab:<mot>`, `kanji:<kanji>`,
  `gram:<normalizeForm(form)>`. Un item = un seul groupe (dédup global par id, premier gagne).

- [ ] **Step 1 : Écrire `tools/transform-cours.mjs`**

```js
// Convertit data/cours-*.json (ancien schéma imbriqué lessons/table/points) vers le schéma unifié
// Category › Group › Item. JETABLE : les plans 2-4 ré-assignent les groupes par-dessus ce schéma.
// Grammaire : fusionne l'aide-mémoire (Forme/Niv./Sens) avec les points (struct/examples) par forme.
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const normForm = (s) => { const c = s.lastIndexOf(":"); return (c >= 0 ? s.slice(c + 1) : s).replace(/〜/g, "").replace(/\s+/g, ""); };

// --- VOCAB : items = lignes des tables Mot/…/Sens, dédupliquées par mot ; groupes = leçons/sous-leçons ---
function transformVocab() {
  const src = read("data/cours-vocab.json");
  const groups = []; const seen = new Set();
  const pushGroup = (title, table) => {
    if (!table) return;
    const hi = table.headers, iMot = 0;
    const iLec = hi.findIndex((h) => /Lecture/i.test(h));
    const iSens = hi.findIndex((h) => /Sens/i.test(h));
    const iNiv = hi.findIndex((h) => /Niv/i.test(h));
    const items = [];
    for (const r of table.rows) {
      const mot = r[iMot]; const id = "vocab:" + mot;
      if (seen.has(id)) continue; seen.add(id);
      items.push({ id, mot, lecture: iLec >= 0 ? r[iLec] : "", sens: iSens >= 0 ? r[iSens] : "", ...(iNiv >= 0 ? { niv: r[iNiv] } : {}) });
    }
    if (items.length) groups.push({ id: "g" + (groups.length + 1), title, items });
  };
  const walk = (lessons) => { for (const l of lessons ?? []) { if (l.table) pushGroup(l.title, l.table); walk(l.lessons); } };
  walk(src.lessons);
  return { id: "vocab", title: src.title, kind: "learn", intro: src.intro, groups };
}

// --- KANJI : items = lignes Kanji/Lecture/Sens/(Mot exemple), dédup par kanji ; groupes = leçons/sous-leçons ---
function transformKanji() {
  const src = read("data/cours-kanji.json");
  const groups = []; const seen = new Set();
  const pushGroup = (title, table) => {
    if (!table) return;
    const hi = table.headers;
    const iLec = hi.findIndex((h) => /Lecture/i.test(h));
    const iSens = hi.findIndex((h) => /Sens/i.test(h));
    const iEx = hi.findIndex((h) => /exemple/i.test(h));
    const items = [];
    for (const r of table.rows) {
      const kanji = r[0]; const id = "kanji:" + kanji;
      if (seen.has(id)) continue; seen.add(id);
      items.push({ id, kanji, lecture: iLec >= 0 ? r[iLec] : "", sens: iSens >= 0 ? r[iSens] : "", ...(iEx >= 0 && r[iEx] ? { exemple: r[iEx] } : {}) });
    }
    if (items.length) groups.push({ id: "g" + (groups.length + 1), title, items });
  };
  const walk = (lessons) => { for (const l of lessons ?? []) { if (l.table) pushGroup(l.title, l.table); walk(l.lessons); } };
  walk(src.lessons);
  return { id: "kanji", title: src.title, kind: "learn", intro: src.intro, groups };
}

// --- GRAMMAIRE : merge aide-mémoire (niv/sens) + points (struct/examples) par forme normalisée.
//     3 passes ordonnées : le groupe d'ENSEIGNEMENT (points) gagne toujours l'assignation de groupe. ---
function transformGram() {
  const src = read("data/cours-gram.json");
  const flat = [];
  const flatten = (lessons) => { for (const l of lessons ?? []) { flat.push(l); flatten(l.lessons); } };
  flatten(src.lessons);

  const byKey = new Map();    // key normForm → item
  const groupOf = new Map();  // key normForm → titre de groupe (fixé une seule fois, priorité aux passes)
  const order = [];
  const ensure = (title) => { if (!order.includes(title)) order.push(title); };
  const place = (key, title) => { if (!groupOf.has(key)) { groupOf.set(key, title); ensure(title); } };

  // Pass A — points (struct + examples). C'est la leçon d'enseignement qui définit le groupe.
  for (const l of flat) {
    for (const pt of l.points ?? []) {
      if (!pt.form) continue;
      const key = normForm(pt.form); if (!key) continue;
      const item = byKey.get(key) ?? { id: "gram:" + key, form: pt.form };
      if (pt.struct) item.struct = pt.struct;
      if (pt.mean) item.mean = pt.mean;
      if (pt.examples?.length) item.examples = pt.examples;
      byKey.set(key, item); place(key, l.title);
    }
  }
  // Pass B — aide-mémoire (Forme/Niv./Sens) : back-fill niv + sens ; crée l'item si absent.
  for (const l of flat) {
    const t = l.table;
    if (!(t && t.headers[0] === "Forme" && t.headers.includes("Niv.") && t.headers.includes("Sens"))) continue;
    const iNiv = t.headers.indexOf("Niv."), iSens = t.headers.indexOf("Sens");
    for (const r of t.rows) for (const alt of String(r[0]).split(" / ")) {
      const key = normForm(alt); if (!key) continue;
      const item = byKey.get(key) ?? { id: "gram:" + key, form: alt.trim() };
      if (!item.niv && r[iNiv]) item.niv = r[iNiv];
      if (!item.mean && r[iSens]) item.mean = r[iSens];
      byKey.set(key, item); place(key, l.title);
    }
  }
  // Pass C — autres tables (conjugaison, keigo) : un item par ligne si la clé est neuve.
  for (const l of flat) {
    const t = l.table;
    if (!t || t.headers[0] === "Forme") continue;
    for (const r of t.rows) {
      const key = normForm(String(r[0])); if (!key || byKey.has(key)) continue;
      byKey.set(key, { id: "gram:" + key, form: r[0], mean: r.slice(1).filter(Boolean).join(" · ") });
      place(key, l.title);
    }
  }

  const groups = order.map((title, i) => ({
    id: "g" + (i + 1), title,
    items: [...byKey.keys()].filter((k) => groupOf.get(k) === title).map((k) => byKey.get(k)),
  })).filter((g) => g.items.length);
  return { id: "gram", title: src.title, kind: "learn", intro: src.intro, groups };
}

// --- MÉTHODE : fusion lecture + écoute (tips) ---
function transformMethod() {
  const dk = read("data/cours-dokkai.json"), ck = read("data/cours-choukai.json");
  return { id: "method", title: "読解・聴解 — Méthode", kind: "method",
    sections: [{ title: dk.title, tips: dk.tips }, { title: ck.title, tips: ck.tips }] };
}

const assertUnique = (cat) => {
  if (cat.kind !== "learn") return;
  const seen = new Set();
  for (const g of cat.groups) for (const it of g.items) {
    if (seen.has(it.id)) throw new Error(cat.id + " : id dupliqué " + it.id);
    seen.add(it.id);
  }
};

const write = (name, cat) => { assertUnique(cat); writeFileSync("data/" + name, JSON.stringify(cat, null, 1)); };
write("cours-vocab.json", transformVocab());
write("cours-kanji.json", transformKanji());
write("cours-gram.json", transformGram());
write("cours-method.json", transformMethod());
for (const f of ["data/cours-dokkai.json", "data/cours-choukai.json"]) if (existsSync(f)) rmSync(f);
console.log("✓ transform terminé");
```

- [ ] **Step 2 : Lancer le transform**

Run: `cd .worktrees/refonte-cours && bun tools/transform-cours.mjs`
Expected: `✓ transform terminé` (aucune exception `id dupliqué`).

- [ ] **Step 3 : Vérifier la forme produite**

Run: `bun -e 'const c=await Bun.file("data/cours-gram.json").json(); console.log(c.id, c.kind, c.groups.length, "groupes"); const it=c.groups.flatMap(g=>g.items).find(i=>i.examples); console.log("item avec examples ET niv ?", it?.form, it?.niv, !!it?.examples);'`
Expected: `gram learn <N> groupes` et un item ayant à la fois `examples` et (souvent) `niv` — preuve que le merge aide-mémoire↔points a marché.

- [ ] **Step 4 : Commit**

```bash
git add tools/transform-cours.mjs data/cours-vocab.json data/cours-kanji.json data/cours-gram.json data/cours-method.json
git rm data/cours-dokkai.json data/cours-choukai.json
git commit -m "feat : transform du contenu cours vers le schéma unifié (+ méthode fusionnée)"
```

---

## Task 4 : `useCours` — charge les 4 fichiers du nouveau schéma

**Files:**
- Modify (réécriture): `src/features/cours/useCours.ts`
- Test: `src/features/cours/useCours.test.tsx`

**Interfaces:**
- Consumes : types de `coursSchema.ts`.
- Produces : `export function useCours(): CoursCategory[] | null` (ordre `gram, vocab, kanji, method` ; `null` = chargement, `[]` = échec). Réexporte les types de `coursSchema.ts` pour compat des imports existants.

- [ ] **Step 1 : Écrire le test** dans `useCours.test.tsx`

```ts
import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCours } from "./useCours.ts";
import type { CoursCategory } from "./coursSchema.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const origFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = origFetch; });

test("useCours charge gram/vocab/kanji/method dans l'ordre", async () => {
  const fake: Record<string, unknown> = {
    "data/cours-gram.json":   { id: "gram", title: "G", kind: "learn", groups: [] },
    "data/cours-vocab.json":  { id: "vocab", title: "V", kind: "learn", groups: [] },
    "data/cours-kanji.json":  { id: "kanji", title: "K", kind: "learn", groups: [] },
    "data/cours-method.json": { id: "method", title: "M", kind: "method", sections: [] },
  };
  globalThis.fetch = ((url: string) => Promise.resolve({ json: () => Promise.resolve(fake[url]) })) as unknown as typeof fetch;

  let cats: CoursCategory[] | null = null;
  function Probe() { cats = useCours(); return null; }
  const host = document.createElement("div"); const root: Root = createRoot(host);
  await act(async () => { root.render(<Probe />); });
  await act(async () => { await Promise.resolve(); });

  expect(cats?.map((c) => c.id)).toEqual(["gram", "vocab", "kanji", "method"]);
  await act(async () => { root.unmount(); });
});
```

- [ ] **Step 2 : Lancer → échec attendu** (`useCours` renvoie encore l'ancien type / mauvais ids).

Run: `bun test src/features/cours/useCours.test.tsx`

- [ ] **Step 3 : Réécrire `useCours.ts`**

```ts
/** Charge le contenu de cours (data/cours-*.json, schéma unifié) au runtime. null = chargement, [] = échec. */
import { useEffect, useState } from "react";
import type { CoursCategory, CoursCategoryId } from "./coursSchema.ts";

export * from "./coursSchema.ts"; // compat : consommateurs important les types depuis useCours

const IDS: CoursCategoryId[] = ["gram", "vocab", "kanji", "method"];

export function useCours(): CoursCategory[] | null {
  const [cats, setCats] = useState<CoursCategory[] | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all(IDS.map((id) => fetch(`data/cours-${id}.json`).then((r) => r.json() as Promise<CoursCategory>)))
      .then((c) => { if (alive) setCats(c); })
      .catch(() => { if (alive) setCats([]); });
    return () => { alive = false; };
  }, []);
  return cats;
}
```

- [ ] **Step 4 : Lancer → succès**

Run: `bun test src/features/cours/useCours.test.tsx`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/features/cours/useCours.ts src/features/cours/useCours.test.tsx
git commit -m "feat : useCours charge le schéma unifié (gram/vocab/kanji/method)"
```

---

## Task 5 : Fil d'Ariane + Hub + Index de catégorie (SSR smoke)

**Files:**
- Create: `src/features/cours/Breadcrumb.tsx`
- Create: `src/features/cours/CoursHub.tsx`
- Create: `src/features/cours/CategoryIndex.tsx`
- Test: `src/features/cours/CoursNav.test.tsx`

**Interfaces:**
- Consumes : `CoursCategory`, `LearnCategory` (schéma) ; `categoryProgress`, `groupProgress`, `CoursProgress` (Task 1).
- Produces :
  ```ts
  export function Breadcrumb(props: { crumbs: { label: string; to?: string }[] }): JSX.Element;
  export function CoursHub(props: { categories: CoursCategory[]; progress: CoursProgress }): JSX.Element;
  export function CategoryIndex(props: { category: LearnCategory; progress: CoursProgress }): JSX.Element;
  ```
  Liens : `Breadcrumb` et les cartes utilisent `<Link to="/cours/...">` (chemins absolus). Cartes-thèmes → `/cours/<catId>/<groupId>`.

- [ ] **Step 1 : Écrire le test** dans `CoursNav.test.tsx`

```ts
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { CoursHub } from "./CoursHub.tsx";
import { CategoryIndex } from "./CategoryIndex.tsx";
import type { CoursCategory, LearnCategory } from "./coursSchema.ts";

const gram: LearnCategory = { id: "gram", title: "文法 — Grammaire", kind: "learn",
  groups: [{ id: "g1", title: "Conditionnels", items: [{ id: "gram:ば", form: "〜ば" }, { id: "gram:たら", form: "〜たら" }] }] };
const cats: CoursCategory[] = [gram, { id: "method", title: "Méthode", kind: "method", sections: [] }];

test("CoursHub liste les catégories avec un lien par catégorie", () => {
  const html = renderToStaticMarkup(<MemoryRouter><CoursHub categories={cats} progress={{}} /></MemoryRouter>);
  expect(html).toContain("Grammaire");
  expect(html).toContain("Méthode");
  expect(html).toContain('href="#/cours/gram"');
  expect(html).toContain('href="#/cours/method"');
});

test("CategoryIndex montre une carte par thème + ratio de progression", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter><CategoryIndex category={gram} progress={{ "gram:ば": "known" }} /></MemoryRouter>);
  expect(html).toContain("Conditionnels");
  expect(html).toContain('href="#/cours/gram/g1"');
  expect(html).toContain("1/2 appris"); // 1 appris sur 2 (ratio dérivé de la progression)
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run: `bun test src/features/cours/CoursNav.test.tsx`

- [ ] **Step 3 : Écrire `Breadcrumb.tsx`**

```tsx
import { Link } from "react-router-dom";
/** Fil d'Ariane pur : le dernier crumb est inactif, les précédents sont des liens. */
export function Breadcrumb({ crumbs }: { crumbs: { label: string; to?: string }[] }) {
  return (
    <nav className="text-meta text-fg-dim flex gap-1 flex-wrap mb-3">
      {crumbs.map((c, i) => (
        <span key={i} className="flex gap-1 items-center">
          {c.to ? <Link to={c.to} className="text-accent">{c.label}</Link> : <span className="text-fg">{c.label}</span>}
          {i < crumbs.length - 1 && <span aria-hidden>›</span>}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4 : Écrire `CategoryIndex.tsx`**

```tsx
import { Link } from "react-router-dom";
import type { LearnCategory } from "./coursSchema.ts";
import { groupProgress, type CoursProgress } from "./coursProgress.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";

/** Niveau 1 : les thèmes d'une catégorie, en cartes, avec ratio de progression. */
export function CategoryIndex({ category, progress }: { category: LearnCategory; progress: CoursProgress }) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb crumbs={[{ label: "Cours", to: "/cours" }, { label: category.title.split(" ")[0] }]} />
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
        {category.groups.map((g) => {
          const s = groupProgress(g, progress);
          return (
            <Link key={g.id} to={`/cours/${category.id}/${g.id}`}
              className="bg-panel border border-line rounded-xl p-3 shadow-card flex flex-col gap-1 no-underline">
              <span className="text-fg font-semibold text-sm">{g.title}</span>
              {g.subtitle && <span className="text-fg-dim text-meta">{g.subtitle}</span>}
              <span className="text-fg-muted text-meta mt-1">
                {s.known}/{s.total} appris{s.review > 0 ? ` · ${s.review} à revoir` : ""}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5 : Écrire `CoursHub.tsx`**

```tsx
import { Link } from "react-router-dom";
import type { CoursCategory } from "./coursSchema.ts";
import { categoryProgress, type CoursProgress } from "./coursProgress.ts";

/** Niveau 0 : cartes de catégories (learn = ratio global ; method = page conseils). */
export function CoursHub({ categories, progress }: { categories: CoursCategory[]; progress: CoursProgress }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-fg text-lg font-bold border-l-4 border-accent pl-2.5">Cours</h2>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
        {categories.map((c) => {
          const s = c.kind === "learn" ? categoryProgress(c, progress) : null;
          return (
            <Link key={c.id} to={`/cours/${c.id}`}
              className="bg-panel border border-line rounded-xl p-4 shadow-card flex flex-col gap-1 no-underline surface-blur">
              <span className="text-fg font-bold">{c.title}</span>
              <span className="text-fg-muted text-meta">
                {s ? `${s.known}/${s.total} appris${s.review > 0 ? ` · ${s.review} à revoir` : ""}` : "Conseils d'examen"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6 : Lancer → succès**

Run: `bun test src/features/cours/CoursNav.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7 : Commit**

```bash
git add src/features/cours/Breadcrumb.tsx src/features/cours/CoursHub.tsx src/features/cours/CategoryIndex.tsx src/features/cours/CoursNav.test.tsx
git commit -m "feat : hub cours + index de catégorie + fil d'Ariane (master-detail niveaux 0-1)"
```

---

## Task 6 : Vue détail `GroupDetail` (par catégorie) + `MethodPage` (SSR smoke)

**Files:**
- Create: `src/features/cours/GroupDetail.tsx`
- Create: `src/features/cours/MethodPage.tsx`
- Test: `src/features/cours/GroupDetail.test.tsx`

**Interfaces:**
- Consumes : `CoursGroup`, `LearnCategory`, `MethodCategory`, `VocabItem`, `KanjiItem`, `GramItem`, `CoursExample` ; `CoursProgress`, `ItemState` (Task 1).
- Produces :
  ```ts
  export function GroupDetail(props: {
    category: LearnCategory; group: CoursGroup; progress: CoursProgress; onToggle: (id: string) => void;
  }): JSX.Element;
  export function MethodPage(props: { category: MethodCategory }): JSX.Element;
  ```
- `furi` : global exposé par `src/lib/dict.ts` (SSR-guardé) ; helper local `furiOrPlain` comme dans l'actuel `Cours.tsx`. `visualBreak` importé de `../../lib/dict.ts` pour les annotations d'exemple.

- [ ] **Step 1 : Écrire le test** dans `GroupDetail.test.tsx`

```ts
import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { GroupDetail } from "./GroupDetail.tsx";
import { MethodPage } from "./MethodPage.tsx";
import type { LearnCategory, MethodCategory, CoursGroup } from "./coursSchema.ts";

const vocabCat: LearnCategory = { id: "vocab", title: "V", kind: "learn", groups: [] };
const vocabGroup: CoursGroup = { id: "g1", title: "Nourriture",
  items: [{ id: "vocab:食べる", mot: "食べる", lecture: "たべる", sens: "manger" }] };

test("GroupDetail (vocab) rend mot/lecture/sens + un contrôle d'état par item", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter><GroupDetail category={vocabCat} group={vocabGroup} progress={{}} onToggle={() => {}} /></MemoryRouter>);
  expect(html).toContain("Nourriture");
  expect(html).toContain("食べる");
  expect(html).toContain("manger");
  expect(html).toContain('data-item-id="vocab:食べる"'); // le bouton toggle porte l'id
});

const gramCat: LearnCategory = { id: "gram", title: "G", kind: "learn", groups: [] };
const gramGroup: CoursGroup = { id: "g1", title: "Conditionnels",
  items: [{ id: "gram:ば", form: "〜ば", struct: "V(ば)", mean: "« si »",
    examples: [{ jp: "安ければ買う", ro: "yasukereba kau", fr: "si bon marche j achete", an: ["安い→安ければ « verbe »"] }] }] };

test("GroupDetail (grammaire) rend forme/structure/exemple", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter><GroupDetail category={gramCat} group={gramGroup} progress={{ "gram:ば": "known" }} onToggle={() => {}} /></MemoryRouter>);
  expect(html).toContain("〜ば");
  expect(html).toContain("V(ば)");
  expect(html).toContain("安ければ買う");
});

test("MethodPage rend les sections de conseils", () => {
  const m: MethodCategory = { id: "method", title: "Méthode", kind: "method",
    sections: [{ title: "読解", tips: ["Lis la question"] }] };
  const html = renderToStaticMarkup(<MemoryRouter><MethodPage category={m} /></MemoryRouter>);
  expect(html).toContain("読解");
  expect(html).toContain("Lis la question");
});
```

- [ ] **Step 2 : Lancer → échec attendu**

Run: `bun test src/features/cours/GroupDetail.test.tsx`

- [ ] **Step 3 : Écrire `MethodPage.tsx`**

```tsx
import type { MethodCategory } from "./coursSchema.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";

/** Catégorie method : pages de conseils, pas d'items ni de progression. */
export function MethodPage({ category }: { category: MethodCategory }) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb crumbs={[{ label: "Cours", to: "/cours" }, { label: "Méthode" }]} />
      {category.sections.map((s, i) => (
        <section key={i} className="bg-panel border border-line rounded-xl p-4 shadow-card">
          <h3 className="text-fg font-bold mb-2">{s.title}</h3>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 text-fg-dim text-sm m-0">
            {s.tips.map((t, j) => <li key={j} dangerouslySetInnerHTML={{ __html: t }} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4 : Écrire `GroupDetail.tsx`**

```tsx
import type { LearnCategory, CoursGroup, VocabItem, KanjiItem, GramItem, CoursExample } from "./coursSchema.ts";
import { type CoursProgress, type ItemState } from "./coursProgress.ts";
import { visualBreak } from "../../lib/dict.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";

declare const furi: ((s: string) => string) | undefined;
const furiOrPlain = (t: string): string => (typeof furi === "function" ? furi(t) : t);

const STATE_LABEL: Record<"new" | ItemState, string> = { new: "○", known: "●", review: "◐" };
function StateToggle({ id, state, onToggle }: { id: string; state: ItemState | undefined; onToggle: (id: string) => void }) {
  const key = state ?? "new";
  return (
    <button type="button" data-item-id={id} onClick={() => onToggle(id)}
      title="neuf → appris → à revoir" aria-label={`état : ${key}`}
      className="shrink-0 w-7 h-7 rounded-full border border-line bg-surface-2 text-accent text-sm cursor-pointer">
      {STATE_LABEL[key]}
    </button>
  );
}

function Example({ ex }: { ex: CoursExample }) {
  return (
    <div className="bg-surface-2 border border-line rounded-lg p-3 text-sm flex flex-col gap-0.5">
      <div className="text-fg text-base" dangerouslySetInnerHTML={{ __html: furiOrPlain(ex.jp) }} />
      <div className="text-fg-muted text-meta">{ex.ro}</div>
      <div className="text-fg-dim">{ex.fr}</div>
      {ex.an && ex.an.length > 0 && <div dangerouslySetInnerHTML={{ __html: visualBreak(ex.an.join(" · "), { legend: false }) }} />}
    </div>
  );
}

function VocabRow({ it, state, onToggle }: { it: VocabItem; state: ItemState | undefined; onToggle: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-2">
      <StateToggle id={it.id} state={state} onToggle={onToggle} />
      <div className="flex-1 min-w-0">
        <span className="text-fg text-base" dangerouslySetInnerHTML={{ __html: furiOrPlain(it.mot) }} />
        <span className="text-fg-muted text-meta ml-2">{it.lecture}</span>
        <div className="text-fg-dim text-sm">{it.sens}</div>
      </div>
      {it.niv && <span className="text-meta text-fg-muted">{it.niv}</span>}
    </div>
  );
}

function KanjiRow({ it, state, onToggle }: { it: KanjiItem; state: ItemState | undefined; onToggle: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-2">
      <StateToggle id={it.id} state={state} onToggle={onToggle} />
      <span className="text-fg text-2xl w-10 text-center">{it.kanji}</span>
      <div className="flex-1 min-w-0">
        <span className="text-fg-muted text-meta">{it.lecture}</span>
        <div className="text-fg-dim text-sm">{it.sens}</div>
        {it.exemple && <div className="text-fg-muted text-meta" dangerouslySetInnerHTML={{ __html: furiOrPlain(it.exemple) }} />}
      </div>
    </div>
  );
}

function GramPoint({ it, state, onToggle }: { it: GramItem; state: ItemState | undefined; onToggle: (id: string) => void }) {
  return (
    <div className="border-l-2 border-accent pl-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <StateToggle id={it.id} state={state} onToggle={onToggle} />
        <span className="text-fg text-base font-bold">{it.form}</span>
        {it.niv && <span className="text-meta text-fg-muted">{it.niv}</span>}
      </div>
      {it.struct && <div className="text-fg-muted text-meta font-mono">{it.struct}</div>}
      {it.mean && <div className="text-fg-dim text-sm">{it.mean}</div>}
      {it.examples?.map((ex, i) => <Example key={i} ex={ex} />)}
    </div>
  );
}

/** Niveau 2 : le contenu d'un thème, rendu selon la catégorie. */
export function GroupDetail({ category, group, progress, onToggle }:
  { category: LearnCategory; group: CoursGroup; progress: CoursProgress; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb crumbs={[{ label: "Cours", to: "/cours" }, { label: category.title.split(" ")[0], to: `/cours/${category.id}` }, { label: group.title }]} />
      <h2 className="text-fg text-lg font-bold">{group.title}</h2>
      {group.note && <p className="text-fg-dim text-sm bg-surface-2 border border-line rounded-lg p-2.5">{group.note}</p>}
      <div className="flex flex-col gap-3">
        {category.id === "vocab" && group.items.map((it) => <VocabRow key={it.id} it={it as VocabItem} state={progress[it.id]} onToggle={onToggle} />)}
        {category.id === "kanji" && group.items.map((it) => <KanjiRow key={it.id} it={it as KanjiItem} state={progress[it.id]} onToggle={onToggle} />)}
        {category.id === "gram" && group.items.map((it) => <GramPoint key={it.id} it={it as GramItem} state={progress[it.id]} onToggle={onToggle} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 5 : Lancer → succès**

Run: `bun test src/features/cours/GroupDetail.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6 : Commit**

```bash
git add src/features/cours/GroupDetail.tsx src/features/cours/MethodPage.tsx src/features/cours/GroupDetail.test.tsx
git commit -m "feat : vue détail cours par catégorie + page méthode (master-detail niveau 2)"
```

---

## Task 7 : `Cours.tsx` (routes imbriquées) + câblage `index.tsx` + happy-dom nav/toggle

**Files:**
- Modify (réécriture): `src/features/cours/Cours.tsx`
- Modify: `src/entries/index.tsx` (ligne `<Route path="cours" …>`)
- Modify (réécriture): `src/features/cours/cours.test.tsx`

**Interfaces:**
- Consumes : `useCours` (Task 4), `useCoursProgress` (Task 2), `CoursHub`/`CategoryIndex` (Task 5), `GroupDetail`/`MethodPage` (Task 6).
- Produces : `export function Cours(): JSX.Element` (monte un `<Routes>` interne : `index`, `:cat`, `:cat/:group`).

- [ ] **Step 1 : Réécrire `cours.test.tsx`** (SSR smoke sur les 3 niveaux via `MemoryRouter initialEntries`)

```ts
import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Cours } from "./Cours.tsx";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const origFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = origFetch; try { globalThis.localStorage.clear(); } catch { /* noop */ } });

const CATS: Record<string, unknown> = {
  "data/cours-gram.json": { id: "gram", title: "文法 — Grammaire", kind: "learn",
    groups: [{ id: "g1", title: "Conditionnels", items: [{ id: "gram:ば", form: "〜ば", mean: "si" }] }] },
  "data/cours-vocab.json": { id: "vocab", title: "語彙", kind: "learn", groups: [] },
  "data/cours-kanji.json": { id: "kanji", title: "漢字", kind: "learn", groups: [] },
  "data/cours-method.json": { id: "method", title: "Méthode", kind: "method", sections: [] },
};

async function mountAt(path: string): Promise<{ host: HTMLElement; root: Root }> {
  globalThis.fetch = ((url: string) => Promise.resolve({ json: () => Promise.resolve(CATS[url]) })) as unknown as typeof fetch;
  const host = document.createElement("div"); const root = createRoot(host);
  await act(async () => { root.render(
    <MemoryRouter initialEntries={[path]}><Routes><Route path="cours/*" element={<Cours />} /></Routes></MemoryRouter>); });
  await act(async () => { await Promise.resolve(); });
  return { host, root };
}

test("Cours /cours → hub des catégories", async () => {
  const { host, root } = await mountAt("/cours");
  expect(host.innerHTML).toContain("Grammaire");
  expect(host.innerHTML).toContain("Méthode");
  await act(async () => { root.unmount(); });
});

test("Cours /cours/gram/g1 → détail + toggle qui persiste", async () => {
  const { host, root } = await mountAt("/cours/gram/g1");
  expect(host.innerHTML).toContain("〜ば");
  const btn = host.querySelector('[data-item-id="gram:ば"]') as HTMLButtonElement;
  expect(btn).not.toBeNull();
  await act(async () => { btn.click(); }); // neuf → known
  expect(JSON.parse(globalThis.localStorage.getItem("jlptN3_cours_v1")!)).toEqual({ "gram:ば": "known" });
  await act(async () => { root.unmount(); });
});
```

- [ ] **Step 2 : Lancer → échec attendu** (l'ancien `Cours` rend `CoursView`, pas de routes).

Run: `bun test src/features/cours/cours.test.tsx`

- [ ] **Step 3 : Réécrire `Cours.tsx`**

```tsx
/** Route /cours/* : master-detail à 3 niveaux. Charge le contenu + la progression une fois, rend un
 *  <Routes> interne (hub → index de catégorie → détail de thème). */
import { Routes, Route, useParams } from "react-router-dom";
import { useCours } from "./useCours.ts";
import { useCoursProgress } from "./useCoursProgress.ts";
import { CoursHub } from "./CoursHub.tsx";
import { CategoryIndex } from "./CategoryIndex.tsx";
import { GroupDetail } from "./GroupDetail.tsx";
import { MethodPage } from "./MethodPage.tsx";
import type { CoursCategory } from "./coursSchema.ts";
import type { CoursProgress } from "./coursProgress.ts";

function NotFound() { return <p className="text-fg-dim text-sm">Thème introuvable.</p>; }

function CategoryRoute({ categories, progress }: { categories: CoursCategory[]; progress: CoursProgress }) {
  const { cat } = useParams();
  const category = categories.find((c) => c.id === cat);
  if (!category) return <NotFound />;
  if (category.kind === "method") return <MethodPage category={category} />;
  return <CategoryIndex category={category} progress={progress} />;
}

function GroupRoute({ categories, progress, onToggle }:
  { categories: CoursCategory[]; progress: CoursProgress; onToggle: (id: string) => void }) {
  const { cat, group } = useParams();
  const category = categories.find((c) => c.id === cat);
  if (!category || category.kind !== "learn") return <NotFound />;
  const g = category.groups.find((x) => x.id === group);
  if (!g) return <NotFound />;
  return <GroupDetail category={category} group={g} progress={progress} onToggle={onToggle} />;
}

export function Cours() {
  const categories = useCours();
  const { progress, toggle } = useCoursProgress();
  if (!categories) return <p className="text-fg-dim text-sm">Chargement du cours…</p>;
  if (!categories.length) return <p className="text-fg-dim text-sm">Cours indisponible (hors ligne ?).</p>;
  return (
    <Routes>
      <Route index element={<CoursHub categories={categories} progress={progress} />} />
      <Route path=":cat" element={<CategoryRoute categories={categories} progress={progress} />} />
      <Route path=":cat/:group" element={<GroupRoute categories={categories} progress={progress} onToggle={toggle} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

- [ ] **Step 4 : Modifier `src/entries/index.tsx`** — passer la route en wildcard

Remplacer la ligne :
```tsx
          <Route path="cours" element={<Cours />} />
```
par :
```tsx
          <Route path="cours/*" element={<Cours />} />
```

- [ ] **Step 5 : Lancer → succès**

Run: `bun test src/features/cours/cours.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6 : Commit**

```bash
git add src/features/cours/Cours.tsx src/entries/index.tsx src/features/cours/cours.test.tsx
git commit -m "feat : Cours master-detail (routes imbriquées /cours/:cat/:group)"
```

---

## Task 8 : Adapter `coursGramIndex` au nouveau schéma (garder le rappel de cours vert)

Le rappel de cours du corrigé quiz lit `cours-gram.json`. Le nouveau schéma range les points dans
`groups[].items` (`GramItem` avec `form`, `mean`, `niv?`). `buildCoursGramIndex` doit parcourir ça.

**Files:**
- Modify: `src/features/cours/coursGramIndex.ts`
- Modify: `src/features/cours/coursGramIndex.test.ts`

**Interfaces:**
- Consumes : `LearnCategory`, `GramItem` (schéma). `normalizeForm`, `GrammarRappel`, `resolveGrammarRappel`, `loadCoursGramIndex` **inchangés** en signature.
- Produces : `buildCoursGramIndex(category: LearnCategory): CoursGramIndex` (au lieu de `CoursSection`).

- [ ] **Step 1 : Mettre à jour le test** `coursGramIndex.test.ts` — remplacer la fixture ancien-schéma par le nouveau

```ts
// Fixture nouveau schéma : une catégorie learn avec un groupe et des GramItem.
import type { LearnCategory } from "./coursSchema.ts";
const gramCat: LearnCategory = {
  id: "gram", title: "文法", kind: "learn",
  groups: [{ id: "g1", title: "Conditionnels", items: [
    { id: "gram:たら", form: "〜たら", niv: "N4", mean: "quand/si" },
    { id: "gram:について", form: "〜について / 〜に対して", niv: "N3", mean: "au sujet de" },
  ] }],
};
```
Adapter les assertions existantes de `buildCoursGramIndex` pour appeler `buildCoursGramIndex(gramCat)` et
vérifier : la clé `たら` → `{ forme:"〜たら", niv:"N4", sens:"quand/si" }` ; l'alternative `について` **et**
`に対して` indexées séparément (split sur ` / `). Garder les tests de `normalizeForm`, `extractGrammarForm`,
`resolveGrammarRappel`, `loadCoursGramIndex` (fetch mocké renvoyant `gramCat`).

- [ ] **Step 2 : Lancer → échec attendu** (type `CoursSection` vs `LearnCategory`, chemin `.lessons`).

Run: `bun test src/features/cours/coursGramIndex.test.ts`

- [ ] **Step 3 : Modifier `buildCoursGramIndex`** dans `coursGramIndex.ts`

Remplacer l'import et la fonction `buildCoursGramIndex` :
```ts
import type { LearnCategory, GramItem } from "./coursSchema.ts";
```
```ts
/** Construit l'index forme→point depuis la catégorie grammaire (schéma unifié). Chaque GramItem :
 *  `form` peut porter des alternatives `A / B` → chacune devient une clé. sens = mean, niv = niv. */
export function buildCoursGramIndex(category: LearnCategory): CoursGramIndex {
  const index: CoursGramIndex = new Map();
  for (const group of category.groups) {
    for (const it of group.items as GramItem[]) {
      if (!it.form) continue;
      for (const alt of it.form.split(" / ")) {
        const key = normalizeForm(alt);
        if (key) index.set(key, { forme: alt.trim(), niv: it.niv ?? "", sens: it.mean ?? "" });
      }
    }
  }
  return index;
}
```
Dans `loadCoursGramIndex`, changer le type de parse : `.then((r) => r.json() as Promise<LearnCategory>)`.

- [ ] **Step 4 : Lancer → succès** (rappel de cours toujours fonctionnel)

Run: `bun test src/features/cours/coursGramIndex.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/features/cours/coursGramIndex.ts src/features/cours/coursGramIndex.test.ts
git commit -m "refactor : coursGramIndex lit le schéma cours unifié (rappel de cours préservé)"
```

---

## Task 9 : Validation du schéma cours dans `validate.mjs`

**Files:**
- Modify: `tools/validate.mjs`

- [ ] **Step 1 : Ajouter un bloc de validation cours** avant le `// ---------- rapport ----------`

```js
// ---------- cours (schéma unifié Category › Group › Item) ----------
for (const id of ['gram', 'vocab', 'kanji', 'method']) {
  const f = load('data/cours-' + id + '.json'); if (!f) continue;
  let cat;
  try { cat = JSON.parse(f.raw); } catch (e) { errors.push('data/cours-' + id + '.json : JSON invalide — ' + e.message); continue; }
  if (cat.id !== id) errors.push('cours-' + id + ' : id="' + cat.id + '" ≠ "' + id + '"');
  if (cat.kind !== 'learn' && cat.kind !== 'method') errors.push('cours-' + id + ' : kind invalide "' + cat.kind + '"');
  if (cat.kind === 'method') {
    if (!Array.isArray(cat.sections)) errors.push('cours-' + id + ' : sections doit être un tableau');
    else cat.sections.forEach((s, i) => { if (!Array.isArray(s.tips)) errors.push('cours-' + id + '.sections[' + i + '] : tips manquant'); });
    info.push('cours-' + id + '.json : ' + (cat.sections?.length ?? 0) + ' sections (méthode)');
    continue;
  }
  if (!Array.isArray(cat.groups)) { errors.push('cours-' + id + ' : groups doit être un tableau'); continue; }
  const seenId = new Set(); let nItems = 0;
  cat.groups.forEach((g, gi) => {
    if (typeof g.title !== 'string' || !g.title) errors.push('cours-' + id + '.groups[' + gi + '] : title manquant');
    if (!Array.isArray(g.items)) { errors.push('cours-' + id + '.groups[' + gi + '] : items doit être un tableau'); return; }
    g.items.forEach((it, ii) => {
      const at = 'cours-' + id + '.groups[' + gi + '].items[' + ii + ']';
      if (typeof it.id !== 'string' || !it.id) errors.push(at + ' : id manquant');
      else if (seenId.has(it.id)) errors.push(at + ' : id dupliqué "' + it.id + '"');
      else seenId.add(it.id);
      if (id === 'vocab' && (!it.mot || typeof it.sens !== 'string')) errors.push(at + ' : mot/sens manquant');
      if (id === 'kanji' && (!it.kanji || typeof it.sens !== 'string')) errors.push(at + ' : kanji/sens manquant');
      if (id === 'gram' && !it.form) errors.push(at + ' : form manquant');
      nItems++;
    });
  });
  info.push('cours-' + id + '.json : ' + cat.groups.length + ' groupes, ' + nItems + ' items');
}
```

- [ ] **Step 2 : Lancer la validation → succès**

Run: `cd .worktrees/refonte-cours && bun tools/validate.mjs`
Expected: exit 0, `✓ Tout le contenu est valide`, avec des lignes `· cours-<id>.json : N groupes, M items`.

- [ ] **Step 3 : Commit**

```bash
git add tools/validate.mjs
git commit -m "test : validate.mjs valide le schéma cours unifié (unicité des id d'item)"
```

---

## Task 10 : Finitions — bump SW, typecheck, suite complète

**Files:**
- Modify: `sw.js` (constante `CACHE`)

- [ ] **Step 1 : Bumper `CACHE` dans `sw.js`**

Repérer la ligne `const CACHE = "jlpt-n3-vNN";` et incrémenter le numéro (ex. `v96` → `v97`).

Run (pour trouver la valeur actuelle) : `grep -n "jlpt-n3-v" sw.js`

- [ ] **Step 2 : Typecheck** (le nouveau schéma remplace `CoursSection`/`CoursLesson` — vérifier qu'aucun consommateur résiduel ne casse)

Run: `bun run typecheck`
Expected: 0 erreur. Si un import résiduel de `CoursSection`/`CoursLesson`/`CoursView` subsiste (ex. ancien `Cours.tsx` supprimé), le corriger.

- [ ] **Step 3 : Grep des références mortes** (inclure `.ts` ET `.tsx`)

Run: `grep -rn "CoursView\|CoursSection\|CoursLesson\|cours-dokkai\|cours-choukai" src/ tools/ scripts/ --include="*.ts" --include="*.tsx" --include="*.mjs"`
Expected: aucune occurrence hors `coursSchema.ts`/tests légitimes. Corriger toute référence morte (ex. `scripts/dev.ts` s'il liste explicitement `cours-dokkai`).

- [ ] **Step 4 : Suite de tests complète + validation**

Run: `bun test && bun tools/validate.mjs`
Expected: tous les tests PASS, validation exit 0.

- [ ] **Step 5 : Vérification manuelle dans le navigateur** (voir « Vérification » ci-dessous), puis commit

```bash
git add sw.js
git commit -m "chore : bump SW cache (data cours restructuré) + nettoyage refs"
```

---

## Vérification (avant de déclarer terminé)

1. `bun run build` (bundle + copie statique). Confirmer que `_site/data/cours-method.json` existe et que
   `_site/data/cours-dokkai.json` **n'existe pas**.
2. `bunx serve _site`, ouvrir `#/cours` :
   - Hub : 4 cartes (Grammaire, Vocab, Kanji, Méthode) avec un ratio de progression sur les 3 « learn ».
   - Cliquer Grammaire → cartes-thèmes ; cliquer un thème → détail avec les points.
   - Cliquer un toggle d'item (○→●→◐→○) ; revenir au hub → le ratio a bougé ; recharger la page
     (`location.reload()`) → l'état persiste (localStorage).
   - Bouton **retour** navigateur → remonte les niveaux (fil d'Ariane cohérent).
   - Méthode → page de conseils (pas de toggles).
3. Onglet Entraînement : sur un corrigé de question **grammaire**, le bloc « Rappel de cours » s'affiche
   toujours (régression `coursGramIndex`).

---

## Self-review (couverture spec Phase 1)

- Nav master-detail 3 niveaux + sous-routes → Tasks 5-7. ✅
- Schéma unifié Category/Group/Item → Task 1. ✅
- 4 catégories (method = fusion lecture/écoute, sans progression) → Tasks 3, 6, 7. ✅
- Progression B (item + roll-up thème/catégorie, localStorage `jlptN3_cours_v1`) → Tasks 1, 2, 5, 6. ✅
- IDs d'item stables dérivés du contenu → Task 3 (transform) + Task 9 (unicité validée). ✅
- Intégration `coursGramIndex` (rappel de cours préservé) → Task 8. ✅
- `validate.mjs` + `copy-static` (auto) + bump `sw.js` → Tasks 9, 10 (copy-static : rien à éditer). ✅
- Suppression `cours-dokkai/choukai.json` → Task 3. ✅

**Hors Phase 1 (plans 2-4)** : le *re-classement sémantique* du contenu (vocab→champs lexicaux,
kanji→familles graphiques, grammaire→familles fonctionnelles). La Phase 1 conserve volontairement le
regroupement actuel (lots / leçons numérotées) ; seul le **schéma** et la **navigation** changent.
