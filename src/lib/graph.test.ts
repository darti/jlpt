import { test, expect } from "bun:test";
import { toQuestion, skillOfOrd, loadSkill, loadCorpus, clearGraphCache } from "./graph.ts";

const sujet = {
  "@id": "jlpt:q/7", "@type": "jlpt:Question",
  "jlpt:skill": "kanji", "jlpt:difficulty": 2, "jlpt:ord": 7,
  "jlpt:stem": "「政治」の読み方は？",
  opts: ["せいじ", "せいち", "しょうじ", "しょうち"], "jlpt:answer": 0,
  "schema:description": "<b>政治</b> = politique.",
  "jlpt:gloss": "政治（せいじ）",
  "jlpt:optionNote": ["a", "b", "c", "d"],
  tests: ["jlpt:word/政治"],
};

test("toQuestion projette un sujet vers le type interne du moteur", () => {
  const q = toQuestion(sujet);
  expect(q.id).toBe(7);
  expect(q.cat).toBe("kanji");
  expect(q.d).toBe(2);
  expect(q.q).toBe("「政治」の読み方は？");
  expect(q.o).toHaveLength(4);
  expect(q.a).toBe(0);
  expect(q.e).toContain("politique");
  expect(q.g).toBe("政治（せいじ）");
  expect(q.od).toHaveLength(4);
});

test("toQuestion projette les arêtes tests — sans elles, pas de rappel dans le corrigé", () => {
  expect(toQuestion(sujet).tests).toEqual(["jlpt:word/政治"]);
});

test("toQuestion n'invente pas d'arête sur une question non reliée", () => {
  const { tests: _drop, ...sans } = sujet;
  expect(toQuestion(sans).tests).toBeUndefined();
});

test("toQuestion conserve script et passage quand ils existent", () => {
  const q = toQuestion({ ...sujet, "jlpt:script": "音声", "jlpt:passage": "文章" });
  expect(q.script).toBe("音声");
  expect(q.passage).toBe("文章");
});

test("toQuestion n'invente pas les champs optionnels absents", () => {
  const q = toQuestion({
    "@id": "jlpt:q/0", "jlpt:skill": "lecture", "jlpt:difficulty": 1, "jlpt:ord": 0,
    "jlpt:stem": "x", opts: ["a", "b"], "jlpt:answer": 1,
  });
  expect(q.e).toBeUndefined();
  expect(q.od).toBeUndefined();
  expect(q.a).toBe(1);
});

test("skillOfOrd résout un ordinal via les intervalles", () => {
  const ranges = [
    { skill: "grammaire" as const, from: 0, count: 3 },
    { skill: "kanji" as const, from: 3, count: 2 },
  ];
  expect(skillOfOrd(0, ranges)).toBe("grammaire");
  expect(skillOfOrd(2, ranges)).toBe("grammaire");
  expect(skillOfOrd(3, ranges)).toBe("kanji");
  expect(skillOfOrd(4, ranges)).toBe("kanji");
  expect(skillOfOrd(5, ranges)).toBeNull(); // hors corpus
});

test("loadSkill mémoïse : deux appels, un seul fetch", async () => {
  clearGraphCache();
  let n = 0;
  const fetchImpl = async () => { n++; return { json: async () => ({ "@graph": [sujet] }) }; };
  await loadSkill("kanji", fetchImpl);
  await loadSkill("kanji", fetchImpl);
  expect(n).toBe(1);
});

test("loadSkill fetche le shard de la compétence demandée", async () => {
  clearGraphCache();
  let url = "";
  const fetchImpl = async (u: string) => { url = u; return { json: async () => ({ "@graph": [sujet] }) }; };
  const qs = await loadSkill("kanji", fetchImpl);
  expect(url).toBe("data/graph/q-kanji.jsonld");
  expect(qs[0].id).toBe(7);
});

test("loadCorpus projette les SkillRange et mémoïse", async () => {
  clearGraphCache();
  let n = 0;
  const fetchImpl = async () => {
    n++;
    return { json: async () => ({ "@graph": [
      { "@id": "jlpt:corpus/kanji", "@type": "jlpt:SkillRange",
        "jlpt:skill": "kanji", "jlpt:from": 3, "jlpt:count": 2 },
    ] }) };
  };
  const a = await loadCorpus(fetchImpl);
  await loadCorpus(fetchImpl);
  expect(n).toBe(1);
  expect(a).toEqual([{ skill: "kanji", from: 3, count: 2 }]);
});

test("loadCorpus purge sa mémoïsation en cas d'échec, pour laisser retenter", async () => {
  // Une promesse rejetée gardée en cache condamnerait l'app pour toute la session : sans
  // corpus, ni les anneaux ni la reprise de session ne se reconstruisent.
  clearGraphCache();
  let n = 0;
  const fetchImpl = async () => {
    n++;
    if (n === 1) throw new Error("offline");
    return { json: async () => ({ "@graph": [
      { "jlpt:skill": "kanji", "jlpt:from": 0, "jlpt:count": 1 },
    ] }) };
  };
  await expect(loadCorpus(fetchImpl)).rejects.toThrow("offline");
  expect(await loadCorpus(fetchImpl)).toEqual([{ skill: "kanji", from: 0, count: 1 }]);
  expect(n).toBe(2);
});

test("un document vide ne fait pas planter la projection", async () => {
  clearGraphCache();
  const fetchImpl = async () => ({ json: async () => ({}) });
  expect(await loadSkill("ecoute", fetchImpl)).toEqual([]);
  expect(await loadCorpus(fetchImpl)).toEqual([]);
});
