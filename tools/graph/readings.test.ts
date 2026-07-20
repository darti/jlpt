import { test, expect } from "bun:test";
import { toHiragana, applyReadings } from "./readings.mjs";

// Récupéré de tools/migrate-to-graph.mjs (supprimé au lot 4) : la règle vaut toujours, et
// c'est le seul endroit du dépôt qui décide comment une lecture entre dans le graphe.
test("toHiragana replie les katakana sans toucher au reste", () => {
  expect(toHiragana("カイ")).toBe("かい");
  expect(toHiragana("えいきょう")).toBe("えいきょう");
  expect(toHiragana("コーヒー")).toBe("こーひー"); // l'allongement ー est conservé
});

const mot = (nom: string, lecture?: string) => ({
  "@id": `jlpt:word/${nom}`, "@type": "jlpt:Word", "schema:name": nom,
  ...(lecture ? { "jlpt:reading": lecture } : {}),
});

test("applyReadings pose la lecture arbitrée sur un mot qui n'en a pas", () => {
  const { sujets, poses } = applyReadings([mot("影響")], { "影響": "えいきょう" });
  expect(sujets[0]["jlpt:reading"]).toBe("えいきょう");
  expect(poses).toBe(1);
});

test("applyReadings replie une décision saisie en katakana", () => {
  // Une lecture de MOT sert de furigana, et les furigana s'écrivent en hiragana.
  const { sujets } = applyReadings([mot("階")], { "階": "カイ" });
  expect(sujets[0]["jlpt:reading"]).toBe("かい");
});

test("applyReadings n'ÉCRASE JAMAIS une lecture existante", () => {
  // C'est l'invariant qui distingue cet outil du générateur qu'il remplace : il ajoute,
  // il ne régénère pas. Une lecture déjà dans le graphe fait autorité.
  const { sujets, poses, conflits } = applyReadings([mot("嫌", "いや")], { "嫌": "きら" });
  expect(sujets[0]["jlpt:reading"]).toBe("いya".replace("ya", "や"));
  expect(poses).toBe(0);
  expect(conflits).toEqual(["嫌"]);
});

test("applyReadings est idempotent : deux passes donnent le même graphe", () => {
  const un = applyReadings([mot("影響")], { "影響": "えいきょう" });
  const deux = applyReadings(un.sujets, { "影響": "えいきょう" });
  expect(deux.sujets).toEqual(un.sujets);
  expect(deux.poses).toBe(0); // rien de neuf au second passage
});

test("applyReadings ignore une décision qui ne vise aucun mot du graphe", () => {
  const { sujets, poses, inconnus } = applyReadings([mot("影響")], { "存在しない": "なし" });
  expect(sujets).toHaveLength(1);
  expect(poses).toBe(0);
  expect(inconnus).toEqual(["存在しない"]);
});

test("applyReadings refuse une décision vide plutôt que d'écrire une lecture vide", () => {
  const { sujets, poses } = applyReadings([mot("謎")], { "謎": "   " });
  expect(sujets[0]["jlpt:reading"]).toBeUndefined();
  expect(poses).toBe(0);
});

test("applyReadings ne touche pas aux sujets qui ne sont pas des mots", () => {
  const kanji = { "@id": "jlpt:kanji/影", "@type": "jlpt:Kanji", "schema:name": "影" };
  const { sujets } = applyReadings([kanji], { "影": "かげ" });
  expect(sujets[0]["jlpt:reading"]).toBeUndefined();
});
