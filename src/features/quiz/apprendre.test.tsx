import { test, expect, afterEach, beforeEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { allocateLearn, buildLearnQueue } from "../entrainement/learnQueue.ts";
import { anchorIndex, selectAnchor, clearAnchorCache } from "./anchor.ts";
import { clearRevisionCache } from "./revision.ts";
import { clearCategoryCache } from "../../lib/bank.ts";
import { clearCoursCache } from "../cours/useCours.ts";
import { PROGRESS_KEY, RESUME_KEY } from "../../lib/keys.ts";
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
/** 8 entités par piste enseignable, DEUX questions chacune (ancre + reprise) : ords `2i`/`2i+1`
 *  du shard, ce qui laisse les ords 16-19 libres pour les erreurs. */
const PAR_PISTE = 8;

const PISTES = [
  { track: "gram", skill: "grammaire" as Skill, prefix: "jlpt:gram/" },
  { track: "vocab", skill: "vocabulaire" as Skill, prefix: "jlpt:word/" },
  { track: "kanji", skill: "kanji" as Skill, prefix: "jlpt:kanji/" },
];
const iris = (prefix: string) =>
  Array.from({ length: PAR_PISTE }, (_, i) => `${prefix}e${i}`);
const GRAM = iris("jlpt:gram/");
const base = (skill: Skill) => SKILLS_STUB.indexOf(skill) * PAR_SKILL;

/** Un shard `q-<skill>.jsonld` : ords contigus, et — au besoin — les arêtes `tests` qui rendent
 *  chaque entité de la piste ancrable ET re-testable (deux questions par entité). */
function shard(skill: Skill, avecAretes: boolean) {
  const piste = PISTES.find((p) => p.skill === skill);
  const from = base(skill);
  return {
    "@graph": Array.from({ length: PAR_SKILL }, (_, i) => {
      const iri = avecAretes && piste && i < PAR_PISTE * 2
        ? `${piste.prefix}e${Math.floor(i / 2)}`
        : null;
      return {
        "@id": `jlpt:q/${from + i}`, "@type": "jlpt:Question",
        "jlpt:ord": from + i, "jlpt:skill": skill, "jlpt:difficulty": 1,
        "jlpt:stem": `question ${from + i}`, opts: ["a", "b", "c", "d"], "jlpt:answer": 0,
        ...(iri ? { tests: [iri] } : {}),
      };
    }),
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
      "@graph": PISTES.map((p) => ({
        "@id": `jlpt:lesson/${p.track}-g1`, "@type": "jlpt:Lesson", "schema:name": `Leçon ${p.track}`,
        "jlpt:order": 0, "jlpt:track": p.track, covers: iris(p.prefix),
      })),
    },
    "data/graph/gram.jsonld": {
      "@graph": GRAM.map((iri) => ({
        "@id": iri, "@type": "jlpt:GrammarPoint",
        "jlpt:form": `〜${iri.split("/").pop()}`, "schema:description": "si",
      })),
    },
    "data/graph/word.jsonld": {
      "@graph": iris("jlpt:word/").map((iri) => ({
        "@id": iri, "@type": "jlpt:Word",
        "schema:name": iri.split("/").pop(), "jlpt:reading": "よみ", "schema:description": "sens",
      })),
    },
    "data/graph/kanji.jsonld": {
      "@graph": iris("jlpt:kanji/").map((iri) => ({
        "@id": iri, "@type": "jlpt:Kanji",
        "schema:name": iri.split("/").pop(), "schema:description": "sens",
      })),
    },
    "data/graph/example.jsonld": { "@graph": [] },
    "data/graph/method.jsonld": { "@graph": [] },
  };
  for (const s of SKILLS_STUB) docs[`data/graph/q-${s}.jsonld`] = shard(s, avecAretes);
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

async function monterQuiz(
  avecAretes = true, search = "",
): Promise<{ api: () => QuizApi; root: Root }> {
  bouchonneFetch(avecAretes);
  let courant: QuizApi | null = null;
  function Probe() { courant = useQuiz(); return null; }
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/entrainement${search}`]}><Probe /></MemoryRouter>,
    );
  });
  // Une frontière de macrotâche vide TOUTES les microtâches en attente : les six documents du
  // cours ont résolu quand elle rend la main (attente CONDITIONNELLE au sens de la règle : le
  // bouchon ne fait aucune E/S, aucun délai n'est deviné).
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return { api: () => courant as unknown as QuizApi, root };
}

/** Tout l'état de module que ce fichier alimente avec ses bouchons (cf. CLAUDE.md : happy-dom
 *  est préchargé pour toute la suite, les caches fuient d'un fichier de test à l'autre). */
function isoler() {
  localStorage.clear();
  clearCategoryCache();
  clearAnchorCache();
  clearRevisionCache();
  clearCoursCache();
}

beforeEach(isoler);

afterEach(() => {
  globalThis.fetch = vraiFetch;
  isoler();
});

test("une session qui a des entites a enseigner s ouvre sur la phase apprendre", async () => {
  const { api, root } = await monterQuiz();
  // `skipDiagnostic` force le chemin « composed » (sinon un diagnostic est dû au premier lancement).
  await act(async () => { await api().start(10, { skipDiagnostic: true }); });
  expect(api().phase).toBe("apprendre");
  expect(api().learnStep).not.toBeNull();
  expect(api().learnStep?.item.id).toBe(GRAM[0]);
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

// ⚠ Sur une entité ANCRÉE, l'auto-évaluation avancerait la file sans consommer la question :
// la carte suivante s'ouvrirait sur l'ancre de la PRÉCÉDENTE. Le hook se garde lui-même — il ne
// dépend pas de la vue pour ne pas exposer le bouton (ni d'un double-clic pour ne pas y mener).
test("l auto evaluation est refusee sur une entite ancree", async () => {
  const { api, root } = await monterQuiz();
  await act(async () => { await api().start(10, { skipDiagnostic: true }); });
  const iri = api().learnStep?.item.id as string;
  expect(api().learnStep?.hasAnchor).toBe(true);
  await act(async () => { api().learnSelfGrade(3); });
  expect(api().learnStep?.item.id).toBe(iri); // la file n'a pas bougé
  expect(api().phase).toBe("apprendre");
  const blob = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}");
  expect(blob.fsrs?.[iri]).toBeUndefined(); // et rien n'a été écrit
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
    // ords 0 et 2 = les ancres de e0 et e1 (deux questions par entité : 2i et 2i+1).
    await api().resumeNow({
      kind: "quiz", ids: [0, 2, 5, 6, 7], qi: 0, right: 0, t: Date.now(),
      learn: [GRAM[0], GRAM[1]],
    });
  });
  expect(api().phase).toBe("apprendre");
  expect(api().learnStep?.item.id).toBe(GRAM[0]);
  expect(api().learnStep?.hasAnchor).toBe(true);
  await act(async () => { api().learnNext(); });
  expect(api().question?.tests).toContain(GRAM[0]);
  await act(async () => { root.unmount(); });
});

/**
 * ⚠ LA COURSE — reproduite sur le chemin RÉEL du lien profond du cours (« Revenir à la
 * question » → `#/entrainement?resume=1`), et distincte de la reprise MANUELLE ci-dessus.
 *
 * L'auto-reprise tire au MONTAGE : aucun commit React n'a encore posé `coursRef`, et les `await`
 * de `resumeNow` (`ensureCorpus`, `questionsForIds`) résolvent depuis des caches module, en
 * microtâches — jamais assez pour que React reflushe. Lire le ref y rendait donc TOUJOURS `null` :
 * mêmes blob et séance, la reprise manuelle restaurait 5 cartes, l'auto **0**. Effet de second
 * ordre : `avancerLearn` ne tournant plus, `resume.learn` n'était jamais élagué, et une reprise
 * ultérieure ré-ouvrait les cartes en plein quiz.
 */
test("l auto reprise par ?resume=1 restaure la file d apprentissage", async () => {
  // ords 0 et 2 = les ancres de e0 et e1 (deux questions par entité : 2i et 2i+1).
  localStorage.setItem(RESUME_KEY, JSON.stringify({
    kind: "quiz", ids: [0, 2, 5, 6, 7], qi: 0, right: 0, t: Date.now(),
    learn: [GRAM[0], GRAM[1]],
  }));
  const { api, root } = await monterQuiz(true, "?resume=1");
  expect(api().phase).toBe("apprendre");
  expect(api().learnStep?.count).toBe(2);
  expect(api().learnStep?.item.id).toBe(GRAM[0]);
  expect(api().learnStep?.hasAnchor).toBe(true);
  await act(async () => { root.unmount(); });
});

/**
 * ⚠ LE CAS QUE LE PREMIER JET NE POUVAIT PAS VOIR : un blob VIDE laisse `alloc.adaptive` à 13,
 * treize places de marge où aucun débordement ne peut se manifester. Ici l'apprenant est CHARGÉ —
 * erreurs et entités dues saturent le budget (`alloc.adaptive === 0`), l'état normal de
 * quelqu'un qui révise depuis des semaines.
 *
 * Les reprises rejoignent la tranche GARANTIE, et `composeSession` ne tronque jamais celle-ci
 * (`bank.ts:125-131`) : sans la borne de `selectReprises`, la séance rend `alloc.learn` questions
 * de trop — 21 au lieu de 15.
 */
test("une seance d apprenant charge ne depasse pas son budget", async () => {
  // 4 erreurs (ords 16-19 : les seules questions de grammaire sans arête) + 5 entités dues
  // (e3..e7 de la piste grammaire, chacune testée par deux questions).
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({
    total: 40, skill: {}, wrong: [16, 17, 18, 19],
    fsrs: Object.fromEntries(GRAM.slice(3).map((iri) => [iri, [0.5, 5, 0]])),
  }));
  const { api, root } = await monterQuiz();
  await act(async () => { await api().start(10, { skipDiagnostic: true }); });
  // Plan : errors 4 + revision 5 + learn 6 + adaptive 0 = 15.
  expect(api().phase).toBe("apprendre");
  expect(api().learnStep?.count).toBe(6);
  expect(api().count).toBe(15);
  await act(async () => { root.unmount(); });
});
