import { test, expect, afterEach } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

/** Le contrat de ce point d'entrée n'est pas ce qu'il calcule — c'est son CODE DE
 *  SORTIE : c'est lui qui fait rougir la CI. On l'exécute donc pour de vrai, sous
 *  `node`, comme le workflow. */
const TEMOIN = "data/graph/zz-temoin-test.jsonld";
const run = () => spawnSync("node", ["tools/validate-graph.mjs"], { encoding: "utf8" });

afterEach(() => { if (existsSync(TEMOIN)) rmSync(TEMOIN); });

test("validate-graph sort en 0 sur un graphe valide", () => {
  const r = run();
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("graphe valide");
});

test("validate-graph sort en 1 et nomme chaque défaut", () => {
  writeFileSync(TEMOIN, JSON.stringify({
    "@context": "context.jsonld",
    "@graph": [{
      "@id": "jlpt:q/0", "@type": "jlpt:Question",
      "jlpt:stem": "x", opts: ["a", "a"], "jlpt:answer": 0,
      "jlpt:skill": "kanji", "jlpt:difficulty": 9, "jlpt:ord": 3,
      tests: ["jlpt:gram/absent"],
    }],
  }));
  const r = run();
  expect(r.status).toBe(1);
  expect(r.stderr).toMatch(/options identiques/);   // contrôle intra-question
  expect(r.stderr).toMatch(/difficulty 9/);         // plage hors sh:in
  expect(r.stderr).toMatch(/ord non dense/);        // invariant global
  expect(r.stderr).toMatch(/référence pendante/);   // intégrité référentielle
});

test("validate-graph sort en 1 sur un sujet dont le type n'a aucune shape", () => {
  writeFileSync(TEMOIN, JSON.stringify({
    "@context": "context.jsonld",
    "@graph": [{ "@id": "jlpt:x/1", "@type": "jlpt:TypoDansLeType" }],
  }));
  const r = run();
  expect(r.status).toBe(1);
  expect(r.stderr).toMatch(/aucune shape/);
});
