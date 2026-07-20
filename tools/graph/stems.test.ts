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
  const { sujets } = applyStems([q("jlpt:q/4609", ANCIEN)], dec);
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

test("applyStems refuse un énoncé cible dont le trou n'est pas seul sur sa ligne de sens", () => {
  // Un énoncé qui contient DÉJÀ la réponse en clair à côté du trou n'apprend rien.
  const { poses, refuses } = applyStems(
    [q("jlpt:q/4609", ANCIEN)],
    { "jlpt:q/4609": { from: ANCIEN, stem: "夜が___。明ける（あける）", gloss: GLOSS } },
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
