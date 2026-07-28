import { test, expect, afterEach } from "bun:test";
import { readResumeState, persistResumeState, type ResumeState } from "./resume.ts";
import { RESUME_KEY } from "../../lib/keys.ts";

afterEach(() => { try { globalThis.localStorage.clear(); } catch { /* noop */ } });

test("persistResumeState conserve la file d apprentissage", () => {
  const r: ResumeState = {
    kind: "quiz", ids: [1, 2], qi: 0, right: 0, t: Date.now(),
    learn: ["jlpt:gram/ば", "jlpt:kanji/位"],
  };
  persistResumeState(r);
  expect(readResumeState()?.learn).toEqual(["jlpt:gram/ば", "jlpt:kanji/位"]);
});

// ⚠ Le blob est de la donnée utilisateur ancienne, éventuellement rapatriée d un Gist : un
// champ absent dégrade vers un défaut, il ne jette jamais.
test("un blob ancien sans champ learn se relit sans erreur", () => {
  globalThis.localStorage.setItem(RESUME_KEY, JSON.stringify(
    { kind: "quiz", ids: [1], qi: 0, right: 0, t: Date.now() },
  ));
  const r = readResumeState();
  expect(r).not.toBeNull();
  expect(r?.learn).toBeUndefined();
});

test("un champ learn malforme est ignore, la session reste lisible", () => {
  globalThis.localStorage.setItem(RESUME_KEY, JSON.stringify(
    { kind: "quiz", ids: [1], qi: 0, right: 0, t: Date.now(), learn: "pas un tableau" },
  ));
  const r = readResumeState();
  expect(r).not.toBeNull();
  expect(r?.learn).toBeUndefined();
});
