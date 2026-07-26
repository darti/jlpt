import { test, expect } from "bun:test";
import { migrateInline } from "./migrate-passages.mjs";

const q = (ord: number, texte?: string) => ({
  "@id": `jlpt:q/${ord}`, "@type": "jlpt:Question", "jlpt:skill": "lecture",
  "jlpt:difficulty": 2, "jlpt:ord": ord, "jlpt:stem": `énoncé ${ord}`,
  opts: ["a", "b"], "jlpt:answer": 0,
  ...(texte ? { "jlpt:passage": texte } : {}),
});
const noms = { "texte A": "Annonce A", "texte B": "Annonce B" };

test("migrateInline crée un passage par texte distinct et relie ses questions", () => {
  const r = migrateInline([], [q(1, "texte A"), q(2, "texte A"), q(3, "texte B")], noms);
  expect(r.migres).toBe(2);
  expect(r.passages.length).toBe(2);
  expect(r.passages[0]["jlpt:jp"]).toBe("texte A");
  expect(r.passages[0]["schema:name"]).toBe("Annonce A");
  expect(r.passages[0]["jlpt:format"]).toBe("tanbun");
  expect(r.questions[0].readsPassage).toBe(r.passages[0]["@id"]);
  expect(r.questions[1].readsPassage).toBe(r.passages[0]["@id"]); // même texte, même passage
  expect(r.questions[2].readsPassage).toBe(r.passages[1]["@id"]);
});

test("migrateInline retire le champ jlpt:passage des questions migrées", () => {
  const r = migrateInline([], [q(1, "texte A")], noms);
  expect("jlpt:passage" in r.questions[0]).toBe(false);
});

test("migrateInline laisse intacte une question sans passage", () => {
  const r = migrateInline([], [q(1)], noms);
  expect(r.migres).toBe(0);
  expect(r.questions[0]).toEqual(q(1));
  expect(r.passages).toEqual([]);
});

test("migrateInline est idempotent : rejoué, il ne migre rien", () => {
  const premier = migrateInline([], [q(1, "texte A"), q(2, "texte A")], noms);
  const second = migrateInline(premier.passages, premier.questions, noms);
  expect(second.migres).toBe(0);
  expect(second.passages.length).toBe(1);
});

test("migrateInline ne renumérote aucun ordinal", () => {
  const r = migrateInline([], [q(7, "texte A"), q(8, "texte A")], noms);
  expect(r.questions.map((x) => x["jlpt:ord"])).toEqual([7, 8]);
});
