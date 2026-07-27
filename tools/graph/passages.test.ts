import { test, expect } from "bun:test";
import { applyPassages } from "./passages.mjs";

const decisions = {
  passages: [{
    id: "jlpt:passage/tanbun-01", name: "Note", format: "tanbun", jp: "工事です。",
    fr: "Travaux.", tests: ["jlpt:word/工事"],
    questions: [{
      stem: "何 ですか。", opts: ["a", "b"], answer: 0, difficulty: 2,
      description: "…", gloss: "…", optionNote: ["x", "y"], tests: ["jlpt:word/工事"],
    }],
  }],
};
const docsVides = () => ({
  passages: [],
  lecture: [{ "@id": "jlpt:q/10223", "@type": "jlpt:Question", "jlpt:skill": "lecture", "jlpt:ord": 10223 }],
  corpus: [{ "@id": "jlpt:corpus/lecture", "@type": "jlpt:SkillRange", "jlpt:skill": "lecture", "jlpt:from": 10223, "jlpt:count": 1 }],
  nextOrd: 10224,
});

test("applyPassages pose le passage, la question et l'intervalle", () => {
  const r = applyPassages(decisions, docsVides());
  expect(r.poses).toBe(1);
  expect(r.passages[0]["@type"]).toBe("jlpt:Passage");
  expect(r.passages[0]["jlpt:format"]).toBe("tanbun");
  const q = r.questions[r.questions.length - 1];
  expect(q["jlpt:ord"]).toBe(10224);
  expect(q.readsPassage).toBe("jlpt:passage/tanbun-01");
  expect(q["jlpt:skill"]).toBe("lecture");
  const nouveau = r.corpus.find((c) => c["@id"] === "jlpt:corpus/lecture-2");
  expect(nouveau["jlpt:from"]).toBe(10224);
  expect(nouveau["jlpt:count"]).toBe(1);
});

test("applyPassages est idempotent : rejoué, il ne pose rien", () => {
  const premier = applyPassages(decisions, docsVides());
  const second = applyPassages(decisions, {
    passages: premier.passages, lecture: premier.questions, corpus: premier.corpus,
    nextOrd: 10225,
  });
  expect(second.poses).toBe(0);
  expect(second.deja).toBe(1);
  expect(second.questions.length).toBe(premier.questions.length);
  expect(second.corpus.length).toBe(premier.corpus.length);
});

test("applyPassages étend l'intervalle existant plutôt que d'en créer un troisième", () => {
  const premier = applyPassages(decisions, docsVides());
  const autre = {
    passages: [{ ...decisions.passages[0], id: "jlpt:passage/tanbun-02" }],
  };
  const second = applyPassages(autre, {
    passages: premier.passages, lecture: premier.questions, corpus: premier.corpus,
    nextOrd: 10225,
  });
  const intervalles = second.corpus.filter((c) => c["jlpt:skill"] === "lecture");
  expect(intervalles.length).toBe(2);
  expect(intervalles.find((c) => c["@id"] === "jlpt:corpus/lecture-2")["jlpt:count"]).toBe(2);
});

test("applyPassages crée un nouvel intervalle si l'existant n'est pas contigu (trou creusé par une autre compétence)", () => {
  const premier = applyPassages(decisions, docsVides());
  const autre = { passages: [{ ...decisions.passages[0], id: "jlpt:passage/tanbun-04" }] };
  // Une autre compétence a grandi entre les deux poses : le prochain ordinal libre (10230)
  // n'est plus juste après "lecture-2" (qui se termine à 10225) — trou de 5 ordinaux.
  const second = applyPassages(autre, {
    passages: premier.passages, lecture: premier.questions, corpus: premier.corpus,
    nextOrd: 10230,
  });
  const intervalles = second.corpus.filter((c) => c["jlpt:skill"] === "lecture");
  expect(intervalles.length).toBe(3);
  const inchange = intervalles.find((c) => c["@id"] === "jlpt:corpus/lecture-2");
  expect(inchange["jlpt:from"]).toBe(10224);
  expect(inchange["jlpt:count"]).toBe(1); // laissé intact, pas étendu à tort sur le trou
  const nouveau = intervalles.find((c) => c["@id"] === "jlpt:corpus/lecture-3");
  expect(nouveau["jlpt:from"]).toBe(10230);
  expect(nouveau["jlpt:count"]).toBe(1);
});

test("applyPassages numérote le troisième intervalle lecture-3 (jamais lecture-2 codé en dur)", () => {
  const docs = {
    passages: [],
    lecture: [{ "@id": "jlpt:q/10350", "@type": "jlpt:Question", "jlpt:skill": "lecture", "jlpt:ord": 10350 }],
    corpus: [
      { "@id": "jlpt:corpus/lecture", "@type": "jlpt:SkillRange", "jlpt:skill": "lecture", "jlpt:from": 10223, "jlpt:count": 52 },
      { "@id": "jlpt:corpus/lecture-2", "@type": "jlpt:SkillRange", "jlpt:skill": "lecture", "jlpt:from": 10307, "jlpt:count": 44 },
    ],
    nextOrd: 10360, // trou : une autre compétence occupe [10351, 10360)
  };
  const r = applyPassages(decisions, docs);
  const intervalles = r.corpus.filter((c) => c["jlpt:skill"] === "lecture");
  expect(intervalles.length).toBe(3);
  expect(intervalles.find((c) => c["@id"] === "jlpt:corpus/lecture-3")?.["jlpt:from"]).toBe(10360);
  // les deux intervalles préexistants restent inchangés
  expect(intervalles.find((c) => c["@id"] === "jlpt:corpus/lecture")?.["jlpt:count"]).toBe(52);
  expect(intervalles.find((c) => c["@id"] === "jlpt:corpus/lecture-2")?.["jlpt:count"]).toBe(44);
});

test("applyPassages n'écrit pas les champs optionnels absents", () => {
  const minimal = {
    passages: [{
      id: "jlpt:passage/tanbun-09", name: "Minimal", format: "tanbun", jp: "短い文。",
      questions: [{ stem: "何 ですか。", opts: ["a", "b"], answer: 0, difficulty: 1 }],
    }],
  };
  const r = applyPassages(minimal, docsVides());
  const p = r.passages[r.passages.length - 1];
  const q = r.questions[r.questions.length - 1];
  expect(p["schema:description"]).toBeUndefined();
  expect(p.tests).toBeUndefined();
  expect(q["schema:description"]).toBeUndefined();
  expect(q["jlpt:gloss"]).toBeUndefined();
  expect(q["jlpt:optionNote"]).toBeUndefined();
  expect(q.tests).toBeUndefined();
});

test("applyPassages ne mute pas les documents de l'appelant", () => {
  const premier = applyPassages(decisions, docsVides());
  const docs = {
    passages: premier.passages,
    lecture: premier.questions,
    corpus: premier.corpus,
    nextOrd: 10225,
  };
  const avant = JSON.stringify(docs);
  const autre = {
    passages: [{ ...decisions.passages[0], id: "jlpt:passage/tanbun-03" }],
  };
  applyPassages(autre, docs);
  expect(JSON.stringify(docs)).toBe(avant);
});
