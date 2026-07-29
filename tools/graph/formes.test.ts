import { test, expect } from "bun:test";
import { applyFormes } from "./formes.mjs";

const point = (id: string, description: string, over: Record<string, unknown> = {}) => ({
  "@id": `jlpt:gram/${id}`, "@type": "jlpt:GrammarPoint", "jlpt:form": id,
  "schema:description": description, ...over,
});

const DECISION = {
  "jlpt:gram/動詞verbe": {
    structure: "行く · 行かない · 行った · 行かなかった",
    description: "Les quatre formes de base d'un verbe : non-passé, négatif, passé, passé négatif.",
  },
};

test("applyFormes déplace le paradigme vers jlpt:structure et pose la glose", () => {
  const sujets = [point("動詞verbe", "行く · 行かない · 行った · 行かなかった")];
  const { sujets: out, poses, formes } = applyFormes(sujets, DECISION);
  expect(out[0]["jlpt:structure"]).toBe("行く · 行かない · 行った · 行かなかった");
  expect(out[0]["schema:description"]).toBe(
    "Les quatre formes de base d'un verbe : non-passé, négatif, passé, passé négatif.",
  );
  expect(poses).toBe(1);
  expect(formes).toEqual(["jlpt:gram/動詞verbe"]);
});

test("applyFormes est idempotent : un second passage ne change plus rien", () => {
  const sujets = [point("動詞verbe", "行く · 行かない · 行った · 行かなかった")];
  const un = applyFormes(sujets, DECISION);
  const deux = applyFormes(un.sujets, DECISION);
  expect(deux.sujets).toEqual(un.sujets);
  expect(deux.poses).toBe(0);
  expect(deux.conflits).toEqual([]);
});

test("applyFormes n'ÉCRASE JAMAIS une jlpt:structure déjà posée", () => {
  // Description déjà glosée à l'identique (donc no-op) pour isoler le seul invariant testé :
  // la structure, elle, diffère de la décision et doit être protégée.
  const sujets = [point("動詞verbe",
    "Les quatre formes de base d'un verbe : non-passé, négatif, passé, passé négatif.",
    { "jlpt:structure": "AUTRE CHOSE" })];
  const { sujets: out, poses, conflits } = applyFormes(sujets, DECISION);
  expect(out[0]["jlpt:structure"]).toBe("AUTRE CHOSE");
  expect(poses).toBe(0);
  expect(conflits).toEqual(["jlpt:gram/動詞verbe"]);
});

test("applyFormes n'ÉCRASE JAMAIS une description déjà glosée (contient une lettre latine)", () => {
  // Structure déjà posée à l'identique (donc no-op) pour isoler le seul invariant testé :
  // la description, elle, diffère de la décision et doit être protégée.
  const sujets = [point("動詞verbe", "Already glosed, mais différente",
    { "jlpt:structure": "行く · 行かない · 行った · 行かなかった" })];
  const { sujets: out, poses, conflits } = applyFormes(sujets, DECISION);
  expect(out[0]["schema:description"]).toBe("Already glosed, mais différente");
  expect(out[0]["jlpt:structure"]).toBe("行く · 行かない · 行った · 行かなかった");
  expect(poses).toBe(0);
  expect(conflits).toEqual(["jlpt:gram/動詞verbe"]);
});

test("applyFormes corrige un champ tout en signalant le désaccord sur l'autre (par champ)", () => {
  // Les deux invariants sont indépendants : une structure en désaccord n'empêche pas de poser
  // la description quand celle-ci est encore le paradigme brut (aucune lettre latine).
  const sujets = [point("動詞verbe", "行く · 行かない · 行った · 行かなかった", {
    "jlpt:structure": "AUTRE CHOSE",
  })];
  const { sujets: out, poses, conflits } = applyFormes(sujets, DECISION);
  expect(out[0]["jlpt:structure"]).toBe("AUTRE CHOSE"); // protégée
  expect(out[0]["schema:description"]).toBe(
    "Les quatre formes de base d'un verbe : non-passé, négatif, passé, passé négatif.",
  ); // posée
  expect(poses).toBe(1);
  expect(conflits).toEqual(["jlpt:gram/動詞verbe"]);
});

test("applyFormes ne signale pas de conflit si la description déjà glosée coïncide (rejeu)", () => {
  // Cas du second passage après application : schema:description contient déjà la glose
  // arbitrée (donc une lettre latine), jlpt:structure porte déjà la valeur arbitrée. Aucun des
  // deux ne doit être vu comme un désaccord.
  const sujets = [point("動詞verbe",
    "Les quatre formes de base d'un verbe : non-passé, négatif, passé, passé négatif.",
    { "jlpt:structure": "行く · 行かない · 行った · 行かなかった" })];
  const { sujets: out, poses, conflits } = applyFormes(sujets, DECISION);
  expect(out).toEqual(sujets);
  expect(poses).toBe(0);
  expect(conflits).toEqual([]);
});

test("applyFormes signale un @id absent du graphe, sans planter", () => {
  const { sujets, poses, inconnus } = applyFormes([point("動詞verbe", "行く · 行かない")],
    { "jlpt:gram/absent": { structure: "x", description: "y" } });
  expect(sujets).toHaveLength(1);
  expect(poses).toBe(0);
  expect(inconnus).toEqual(["jlpt:gram/absent"]);
});

test("applyFormes ne touche pas aux sujets qui ne sont pas des jlpt:GrammarPoint", () => {
  const example = { "@id": "jlpt:gram/動詞verbe", "@type": "jlpt:Example", "schema:description": "行く · 行かない" };
  const { sujets, poses } = applyFormes([example], DECISION);
  expect(sujets).toEqual([example]);
  expect(poses).toBe(0);
});
