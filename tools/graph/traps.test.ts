import { test, expect } from "bun:test";
import { applyTrapKinds, SHARDS } from "./traps.mjs";

const question = () => ({
  "@id": "jlpt:q/1",
  "jlpt:skill": "vocabulaire",
  opts: ["影像", "映像", "影響", "反響"],
  "jlpt:answer": 2,
  "jlpt:optionNote": [
    "影像（えいぞう）: partage 影, lecture différente",
    "映像 : 映 ressemble à 影",
    "Correct : 影響",
    "反響 : partage 響",
  ],
});

test("pose un tableau parallèle aux options, vide à l'index de la réponse", () => {
  const { sujets, poses } = applyTrapKinds([question()]);
  expect(poses).toBe(1);
  expect(sujets[0]["jlpt:trapKind"]).toEqual(["kanji-partage", "forme-proche", "", "kanji-partage"]);
});

test("n'écrase JAMAIS un type déjà posé — une correction à la main survit au rejeu", () => {
  const dejaPose = { ...question(), "jlpt:trapKind": ["autre", "autre", "", "autre"] };
  const { sujets, poses } = applyTrapKinds([dejaPose]);
  expect(poses).toBe(0);
  expect(sujets[0]["jlpt:trapKind"]).toEqual(["autre", "autre", "", "autre"]);
});

test("est idempotent : la seconde passe ne change plus rien", () => {
  const un = applyTrapKinds([question()]);
  const deux = applyTrapKinds(un.sujets);
  expect(deux.poses).toBe(0);
  expect(JSON.stringify(deux.sujets)).toBe(JSON.stringify(un.sujets));
});

test("laisse intacte une question sans options", () => {
  const { sujets, poses } = applyTrapKinds([{ "@id": "jlpt:q/2", "jlpt:skill": "kanji" }]);
  expect(poses).toBe(0);
  expect(sujets[0]["jlpt:trapKind"]).toBeUndefined();
});

test("ne traite que les shards kanji et vocabulaire", () => {
  expect(SHARDS).toEqual(["q-kanji", "q-vocabulaire"]);
});

test("ignore et signale une question dont jlpt:answer est absent ou hors bornes", () => {
  const sansReponse = { ...question(), "jlpt:answer": undefined };
  const horsBornes = { ...question(), "@id": "jlpt:q/3", "jlpt:answer": 99 };
  const { sujets, poses, invalides } = applyTrapKinds([sansReponse, horsBornes]);
  expect(poses).toBe(0);
  expect(sujets[0]["jlpt:trapKind"]).toBeUndefined();
  expect(sujets[1]["jlpt:trapKind"]).toBeUndefined();
  expect(invalides).toEqual(["jlpt:q/1", "jlpt:q/3"]);
});

test("classe en 'autre' une option dont la note est manquante, sans planter", () => {
  const sansNotes = { ...question(), "jlpt:optionNote": undefined };
  const { sujets, poses } = applyTrapKinds([sansNotes]);
  expect(poses).toBe(1);
  expect(sujets[0]["jlpt:trapKind"]).toEqual(["autre", "autre", "", "autre"]);
});

test("ne compte que les questions réellement posées dans un lot mixte", () => {
  const dejaPose = { ...question(), "@id": "jlpt:q/4", "jlpt:trapKind": ["autre", "autre", "", "autre"] };
  const { sujets, poses } = applyTrapKinds([question(), dejaPose]);
  expect(poses).toBe(1);
  expect(sujets[0]["jlpt:trapKind"]).toEqual(["kanji-partage", "forme-proche", "", "kanji-partage"]);
  expect(sujets[1]["jlpt:trapKind"]).toEqual(["autre", "autre", "", "autre"]);
});
