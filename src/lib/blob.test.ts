import { expect, test, describe } from "bun:test";
import { asBits, asBitsB64, asHistory, asNum, asProgress, asSkillState, asWrong } from "./blob.ts";
import { encodeBits, hasBit, setBit, emptyBits } from "./coverage.ts";

/**
 * Le schéma du blob de progression était décodé dans six fichiers, chacun retapant ses gardes —
 * dont `typeof raw?.seen === "string" ? raw.seen : ""`, présent cinq fois. Ce module est
 * désormais le seul endroit qui sache ce que le blob contient ; ces tests en figent le contrat,
 * champ par champ, y compris sur les blobs malformés (l'app doit dégrader, jamais jeter).
 */

describe("asNum", () => {
  test("rend le nombre, 0 sur absent / mauvais type / blob null", () => {
    expect(asNum({ total: 42 }, "total")).toBe(42);
    expect(asNum({}, "total")).toBe(0);
    expect(asNum({ total: "42" }, "total")).toBe(0);
    expect(asNum(null, "total")).toBe(0);
  });

  test("0 et les négatifs sont des valeurs, pas des absences", () => {
    expect(asNum({ total: 0 }, "total")).toBe(0);
    expect(asNum({ total: -3 }, "total")).toBe(-3);
  });
});

describe("asWrong", () => {
  test("rend le tableau, [] sur absent / non-tableau / null", () => {
    expect(asWrong({ wrong: [1, 2] })).toEqual([1, 2]);
    expect(asWrong({})).toEqual([]);
    expect(asWrong({ wrong: "1,2" })).toEqual([]);
    expect(asWrong(null)).toEqual([]);
  });
});

describe("asHistory", () => {
  test("rend le tableau, [] sur absent / non-tableau", () => {
    expect(asHistory({ history: [{ score: 1 }] })).toEqual([{ score: 1 }]);
    expect(asHistory({ history: 3 })).toEqual([]);
    expect(asHistory(null)).toEqual([]);
  });
});

describe("asSkillState", () => {
  test("rend {R,t,r} d'une compétence connue", () => {
    const raw = { skill: { kanji: { R: 1700, t: 12, r: 9 } } };
    expect(asSkillState(raw, "kanji")).toEqual({ R: 1700, t: 12, r: 9 });
  });

  test("compétence absente → état vierge R=1450", () => {
    expect(asSkillState({ skill: {} }, "kanji")).toEqual({ R: 1450, t: 0, r: 0 });
    expect(asSkillState(null, "kanji")).toEqual({ R: 1450, t: 0, r: 0 });
  });

  test("champs partiels : chaque champ retombe seul sur son défaut", () => {
    const raw = { skill: { kanji: { R: 1700 } } };
    expect(asSkillState(raw, "kanji")).toEqual({ R: 1700, t: 0, r: 0 });
  });

  test("`skill` malformé (tableau, chaîne) → état vierge, aucune exception", () => {
    expect(asSkillState({ skill: [] }, "kanji")).toEqual({ R: 1450, t: 0, r: 0 });
    expect(asSkillState({ skill: "x" }, "kanji")).toEqual({ R: 1450, t: 0, r: 0 });
  });
});

describe("asProgress", () => {
  test("vue minimale que lit scoring#masteryOf", () => {
    const p = asProgress({ total: 7, skill: { kanji: { R: 1700, t: 3 } }, bruit: 1 });
    expect(p.total).toBe(7);
    expect(p.skill.kanji?.R).toBe(1700);
  });

  test("blob null → total 0 et table vide", () => {
    const p = asProgress(null);
    expect(p.total).toBe(0);
    expect(p.skill).toEqual({});
  });
});

describe("asBitsB64 / asBits", () => {
  test("champ absent → chaîne vide et bitset vide", () => {
    expect(asBitsB64(null, "seen")).toBe("");
    expect(asBitsB64({}, "mastered")).toBe("");
    expect(asBits(null, "seen").length).toBe(0);
  });

  test("champ d'un mauvais type → chaîne vide (jamais l'objet brut)", () => {
    expect(asBitsB64({ seen: 42 }, "seen")).toBe("");
    expect(asBitsB64({ seen: ["x"] }, "seen")).toBe("");
  });

  test("round-trip : un bit posé se relit", () => {
    const b64 = encodeBits(setBit(emptyBits(), 10350));
    expect(asBitsB64({ seen: b64 }, "seen")).toBe(b64);
    expect(hasBit(asBits({ seen: b64 }, "seen"), 10350)).toBe(true);
    expect(hasBit(asBits({ seen: b64 }, "seen"), 10349)).toBe(false);
  });

  test("les deux champs sont indépendants", () => {
    const raw = { seen: encodeBits(setBit(emptyBits(), 5)), mastered: "" };
    expect(hasBit(asBits(raw, "seen"), 5)).toBe(true);
    expect(hasBit(asBits(raw, "mastered"), 5)).toBe(false);
  });

  test("base64 invalide → bitset vide, aucune exception (via decodeBits)", () => {
    expect(asBits({ seen: "!!!pas du base64!!!" }, "seen").length).toBe(0);
  });

  test("accepte aussi un objet Progress typé (useCoverage lui passe `p`)", () => {
    const p: { seen?: string; mastered?: string } = { seen: encodeBits(setBit(emptyBits(), 3)) };
    expect(hasBit(asBits(p, "seen"), 3)).toBe(true);
  });
});
