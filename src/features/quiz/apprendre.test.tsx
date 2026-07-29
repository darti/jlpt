import { test, expect, afterEach, beforeEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { allocateLearn, buildLearnQueue } from "../entrainement/learnQueue.ts";
import { anchorIndex, selectAnchor, clearAnchorCache } from "./anchor.ts";
import { clearRevisionCache } from "./revision.ts";
import { clearCategoryCache } from "../../lib/bank.ts";
import { useQuiz } from "./useQuiz.ts";
import type { Question } from "../../types/quiz.ts";
import type { CoursCategory, CoursItem } from "../cours/coursSchema.ts";
import type { Skill } from "../../types/progress.ts";

const item = (id: string): CoursItem => ({ id, form: id }) as CoursItem;
const cats: CoursCategory[] = [{
  id: "gram", title: "文法", kind: "learn",
  groups: [{ id: "g1", title: "L1", items: [item("a"), item("b"), item("c")] }],
}];
const q = (id: number, tests: string[]): Question =>
  ({ id, cat: "grammaire", d: 1, q: "", o: [], a: 0, tests }) as Question;

/**
 * INVARIANT DE BUDGET (spec §5.1) : le créneau d'une entité sans ancre retourne au quiz.
 * Une session dont AUCUNE entité enseignée n'a d'ancre doit encore compter `total` questions.
 */
test("le creneau d une entite sans ancre retourne au quiz", () => {
  const total = 10;
  const alloc = allocateLearn(() => 1, 3);
  const index = anchorIndex([q(1, ["a"])]); // seule « a » est ancrable
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 3, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  });
  const ancres = file.filter((s) => s.anchor !== null).length;
  expect(file).toHaveLength(3);
  expect(ancres).toBe(1);
  // Le quiz doit recevoir total - ancres, pas total - entités enseignées.
  expect(total - ancres).toBe(9);
  expect(alloc.gram + alloc.vocab + alloc.kanji).toBe(3);
});

test("aucune entite ancrable laisse le budget entier au quiz", () => {
  const index = anchorIndex([q(1, ["zzz"])]);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 3, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  });
  expect(file.every((s) => s.anchor === null)).toBe(true);
  expect(10 - file.filter((s) => s.anchor !== null).length).toBe(10);
});

test("les ancres et les reprises ne se recouvrent jamais", () => {
  const qs = [q(1, ["a"]), q(2, ["a"])];
  const index = anchorIndex(qs);
  const file = buildLearnQueue({
    categories: cats, fsrs: {}, today: 0,
    alloc: { gram: 1, vocab: 0, kanji: 0 }, index, exclude: new Set(),
  });
  const ancre = file[0].anchor!;
  // La reprise se choisit avec l'ancre déjà exclue : elle DOIT tomber sur l'autre question.
  expect(selectAnchor("a", index, new Set([ancre]))).not.toBe(ancre);
});

// ── Câblage du hook ─────────────────────────────────────────────────────────────────────────

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SKILLS_STUB: Skill[] = ["grammaire", "vocabulaire", "kanji", "lecture", "ecoute"];
/** 20 questions par compétence : le budget d'une séance de 10 min (15) doit pouvoir être servi. */
const PAR_SKILL = 20;
const ENTITES = ["jlpt:gram/ば", "jlpt:gram/たら", "jlpt:gram/なら"];

/** Un shard `q-<skill>.jsonld` : ords contigus, et — au besoin — les arêtes `tests` qui rendent
 *  les deux premières entités du programme ancrables (et re-testables : deux questions chacune). */
function shard(skill: Skill, from: number, avecAretes: boolean) {
  const aretes: Record<number, string[]> = avecAretes && skill === "grammaire"
    ? { 0: [ENTITES[0]], 1: [ENTITES[1]], 2: [ENTITES[0]], 3: [ENTITES[1]] }
    : {};
  return {
    "@graph": Array.from({ length: PAR_SKILL }, (_, i) => ({
      "@id": `jlpt:q/${from + i}`, "@type": "jlpt:Question",
      "jlpt:ord": from + i, "jlpt:skill": skill, "jlpt:difficulty": 1,
      "jlpt:stem": `question ${from + i}`, opts: ["a", "b", "c", "d"], "jlpt:answer": 0,
      ...(aretes[i] ? { tests: aretes[i] } : {}),
    })),
  };
}

/** Les documents que le hook fetche : le corpus, les cinq shards, et le cours (six documents). */
function documents(avecAretes: boolean): Record<string, unknown> {
  const docs: Record<string, unknown> = {
    "data/graph/corpus.jsonld": {
      "@graph": SKILLS_STUB.map((s, i) => ({
        "jlpt:skill": s, "jlpt:from": i * PAR_SKILL, "jlpt:count": PAR_SKILL,
      })),
    },
    "data/graph/lesson.jsonld": {
      "@graph": [{
        "@id": "jlpt:lesson/gram-g1", "@type": "jlpt:Lesson", "schema:name": "Conditionnels",
        "jlpt:order": 0, "jlpt:track": "gram", covers: ENTITES,
      }],
    },
    "data/graph/gram.jsonld": {
      "@graph": ENTITES.map((iri) => ({
        "@id": iri, "@type": "jlpt:GrammarPoint",
        "jlpt:form": iri.split("/").pop(), "schema:description": "si",
      })),
    },
    "data/graph/kanji.jsonld": { "@graph": [] },
    "data/graph/word.jsonld": { "@graph": [] },
    "data/graph/example.jsonld": { "@graph": [] },
    "data/graph/method.jsonld": { "@graph": [] },
  };
  SKILLS_STUB.forEach((s, i) => {
    docs[`data/graph/q-${s}.jsonld`] = shard(s, i * PAR_SKILL, avecAretes);
  });
  return docs;
}

const vraiFetch = globalThis.fetch;

function bouchonneFetch(avecAretes: boolean) {
  const docs = documents(avecAretes);
  globalThis.fetch = ((url: string) =>
    Promise.resolve({
      json: () => Promise.resolve(docs[url] ?? { "@graph": [] }),
    })) as unknown as typeof fetch;
}

type QuizApi = ReturnType<typeof useQuiz>;

async function monterQuiz(avecAretes = true): Promise<{ api: () => QuizApi; root: Root }> {
  bouchonneFetch(avecAretes);
  let courant: QuizApi | null = null;
  function Probe() { courant = useQuiz(); return null; }
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => {
    root.render(<MemoryRouter><Probe /></MemoryRouter>);
  });
  // Une frontière de macrotâche vide TOUTES les microtâches en attente : les six documents du
  // cours ont résolu quand elle rend la main (attente CONDITIONNELLE au sens de la règle : le
  // bouchon ne fait aucune E/S, aucun délai n'est deviné).
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return { api: () => courant as unknown as QuizApi, root };
}

beforeEach(() => {
  localStorage.clear();
  clearCategoryCache();
  clearAnchorCache();
  clearRevisionCache();
});

afterEach(() => {
  globalThis.fetch = vraiFetch;
  clearCategoryCache();
  clearAnchorCache();
  clearRevisionCache();
  localStorage.clear();
});

test("une session qui a des entites a enseigner s ouvre sur la phase apprendre", async () => {
  const { api, root } = await monterQuiz();
  // `skipDiagnostic` force le chemin « composed » (sinon un diagnostic est dû au premier lancement).
  await act(async () => { await api().start(10, { skipDiagnostic: true }); });
  expect(api().phase).toBe("apprendre");
  expect(api().learnStep).not.toBeNull();
  expect(api().learnStep?.item.id).toBe(ENTITES[0]);
  expect(api().learnStep?.state).toBe("neuf");
  await act(async () => { root.unmount(); });
});

// L'INVARIANT DE BUDGET, au niveau du câblage : la séance compte `total` questions (15 pour
// 10 min) que ses entités soient ancrées ou non. Les créneaux des ancres ne se comptent pas deux
// fois, et ceux des entités sans ancre retournent au quiz.
test("la seance compte le meme total avec et sans ancres", async () => {
  const avec = await monterQuiz(true);
  await act(async () => { await avec.api().start(10, { skipDiagnostic: true }); });
  const ancrees = avec.api().count;
  expect(avec.api().learnStep?.hasAnchor).toBe(true);
  await act(async () => { avec.root.unmount(); });

  localStorage.clear();
  clearCategoryCache();
  clearAnchorCache();
  const sans = await monterQuiz(false);
  await act(async () => { await sans.api().start(10, { skipDiagnostic: true }); });
  expect(sans.api().learnStep?.hasAnchor).toBe(false);
  expect(sans.api().count).toBe(ancrees);
  expect(ancrees).toBe(15); // questionCount(10)
  await act(async () => { sans.root.unmount(); });
});

test("learnNext sur une etape ancree amene en phase question", async () => {
  const { api, root } = await monterQuiz();
  await act(async () => { await api().start(10, { skipDiagnostic: true }); });
  expect(api().learnStep?.hasAnchor).toBe(true);
  const iri = api().learnStep?.item.id;
  await act(async () => { api().learnNext(); });
  expect(api().phase).toBe("question");
  // La question ouverte est bien CELLE qui teste l'entité qu'on vient de voir.
  expect(api().question?.tests).toContain(iri as string);
  await act(async () => { root.unmount(); });
});

// Le corrigé d'une ancre rend la main à la FILE, pas à la question suivante du quiz.
test("le corrige d une ancre ramene a la carte suivante", async () => {
  const { api, root } = await monterQuiz();
  await act(async () => { await api().start(10, { skipDiagnostic: true }); });
  const premier = api().learnStep?.item.id;
  await act(async () => { api().learnNext(); });
  await act(async () => { api().choose(0); });
  expect(api().phase).toBe("corrige");
  await act(async () => { api().next(); });
  expect(api().phase).toBe("apprendre");
  expect(api().learnStep?.item.id).not.toBe(premier);
  await act(async () => { root.unmount(); });
});

// Une entité sans ancre n'a pas de question : l'auto-évaluation est le seul signal disponible,
// et elle doit AMORCER le planificateur (carte FSRS écrite), pas ne rien faire.
test("l auto evaluation d une entite sans ancre ecrit une carte fsrs", async () => {
  const { api, root } = await monterQuiz(false);
  await act(async () => { await api().start(10, { skipDiagnostic: true }); });
  const iri = api().learnStep?.item.id as string;
  expect(api().learnStep?.hasAnchor).toBe(false);
  await act(async () => { api().learnSelfGrade(3); });
  const blob = JSON.parse(localStorage.getItem("jlptN3adapt_v2") ?? "{}");
  expect(blob.fsrs?.[iri]).toBeDefined();
  expect(api().learnStep?.item.id).not.toBe(iri); // et la file a avancé
  await act(async () => { root.unmount(); });
});

// ⚠ Tolérance imposée aux lectures de blob : un blob antérieur au lot 2 n'a pas le champ
// `learn` — la reprise doit dégrader silencieusement vers la phase quiz, jamais jeter.
test("une reprise sans champ learn entre directement en phase quiz", async () => {
  const { api, root } = await monterQuiz();
  await act(async () => {
    await api().resumeNow({ kind: "quiz", ids: [0], qi: 0, right: 0, t: Date.now() });
  });
  expect(api().phase).not.toBe("apprendre");
  await act(async () => { root.unmount(); });
});

// Une reprise EN PLEINE phase d'apprentissage rouvre la carte où l'on en était — et l'ancre se
// relit dans l'ordre de la session, elle ne se rechoisit pas.
test("une reprise avec des entites restantes rouvre la phase apprendre", async () => {
  const { api, root } = await monterQuiz();
  await act(async () => {
    await api().resumeNow({
      kind: "quiz", ids: [0, 1, 5, 6, 7], qi: 0, right: 0, t: Date.now(),
      learn: [ENTITES[0], ENTITES[1]],
    });
  });
  expect(api().phase).toBe("apprendre");
  expect(api().learnStep?.item.id).toBe(ENTITES[0]);
  expect(api().learnStep?.hasAnchor).toBe(true);
  await act(async () => { api().learnNext(); });
  expect(api().question?.tests).toContain(ENTITES[0]);
  await act(async () => { root.unmount(); });
});
