import { test, expect } from "bun:test";
import { readProgress, writeProgress, readRawProgress } from "./storage.ts";
import { memStore } from "../testing/memStore.ts";

const fake = (v: string | null) => ({ getItem: (_k: string) => v });

test("reads a valid progress blob", () => {
  const raw = JSON.stringify({ total: 12, skill: { grammaire: { R: 1600 }, vocabulaire: { R: 1500 }, kanji: { R: 1550 }, lecture: { R: 1620 } } });
  const p = readProgress(fake(raw));
  expect(p?.total).toBe(12);
  expect(p?.skill.lecture?.R).toBe(1620);
});

test("returns null when absent", () => {
  expect(readProgress(fake(null))).toBeNull();
});

test("returns null on malformed JSON", () => {
  expect(readProgress(fake("{not json"))).toBeNull();
});

test("returns the blob even with incomplete skill data (legacy format defaults missing skills)", () => {
  const raw = JSON.stringify({ total: 5, skill: { grammaire: { R: 1600 } } });
  const p = readProgress(fake(raw));
  expect(p?.total).toBe(5);
  expect(p?.skill.grammaire?.R).toBe(1600);
});

test("returns null when getItem throws", () => {
  const badStore = { getItem: () => { throw new Error("storage error"); } };
  expect(readProgress(badStore)).toBeNull();
});


test("writeProgress merges onto the existing blob, preserving unmanaged fields (gram/streak)", () => {
  const store = memStore({
    jlptN3adapt_v2: JSON.stringify({
      total: 3, right: 1, streak: 2, gram: { "点A": { box: 3 } },
      skill: { grammaire: { R: 1500, t: 3, r: 1 }, kanji: { R: 1450, t: 0, r: 0 } },
    }),
  });
  writeProgress({ total: 4, right: 2, skill: { grammaire: { R: 1520, t: 4, r: 2 } } }, store);
  const out = JSON.parse(store._get("jlptN3adapt_v2") as string);
  expect(out.total).toBe(4);
  expect(out.right).toBe(2);
  expect(out.streak).toBe(2);               // preserved
  expect(out.gram).toEqual({ "点A": { box: 3 } }); // preserved (vanilla SRS)
  expect(out.skill.grammaire).toEqual({ R: 1520, t: 4, r: 2 }); // updated skill
  expect(out.skill.kanji).toEqual({ R: 1450, t: 0, r: 0 });     // other skill preserved
  expect(typeof store._get("jlptN3_updatedAt")).toBe("string");
});

test("writeProgress writes quiz fields beyond total/right/skill (wrong, streak) while preserving unmanaged fields", () => {
  const store = memStore({
    jlptN3adapt_v2: JSON.stringify({
      total: 3, right: 1, streak: 2, gram: { "点A": { box: 3 } },
      history: [{ date: "2025-01-01", count: 5 }],
      skill: { grammaire: { R: 1500, t: 3, r: 1 }, kanji: { R: 1450, t: 0, r: 0 } },
    }),
  });
  writeProgress({ wrong: [5, 9], streak: 3, skill: { grammaire: { R: 1520, t: 4, r: 2 } } }, store);
  const out = JSON.parse(store._get("jlptN3adapt_v2") as string);
  expect(out.wrong).toEqual([5, 9]);            // quiz field, no longer dropped
  expect(out.streak).toBe(3);                   // quiz field, no longer dropped
  expect(out.skill.grammaire).toEqual({ R: 1520, t: 4, r: 2 }); // merged skill
  expect(out.skill.kanji).toEqual({ R: 1450, t: 0, r: 0 });     // other skill preserved
  expect(out.gram).toEqual({ "点A": { box: 3 } }); // preserved (vanilla SRS, unmanaged field)
  expect(out.history).toEqual([{ date: "2025-01-01", count: 5 }]); // preserved (unmanaged field)
});

test("writeProgress on empty store creates a blob", () => {
  const store = memStore();
  writeProgress({ total: 1, skill: { grammaire: { R: 1450, t: 1, r: 0 } } }, store);
  expect(readRawProgress(store)?.total).toBe(1);
});

test("writeProgress sets jlptN3_updatedAt timestamp", () => {
  const store = memStore();
  const beforeTime = new Date().toISOString();
  writeProgress({ total: 1 }, store);
  const afterTime = new Date().toISOString();
  const timestamp = store._get("jlptN3_updatedAt") as string;
  expect(timestamp >= beforeTime && timestamp <= afterTime).toBe(true);
});

test("writeProgress with an array skill patch overwrites skill (generic merge, caller's responsibility)", () => {
  const store = memStore({
    jlptN3adapt_v2: JSON.stringify({
      total: 1, skill: { grammaire: { R: 1500 } },
    }),
  });
  // skill as array skips the object deep-merge guard, so the generic patch spread wins.
  writeProgress({ skill: [{ R: 1600 }] as unknown as Record<string, unknown> }, store);
  const out = JSON.parse(store._get("jlptN3adapt_v2") as string);
  expect(out.skill).toEqual([{ R: 1600 }]);
});

test("writeProgress with a null skill patch overwrites skill with null (generic merge, caller's responsibility)", () => {
  const store = memStore({
    jlptN3adapt_v2: JSON.stringify({
      total: 1, skill: { grammaire: { R: 1500 } },
    }),
  });
  // skill: null skips the object deep-merge guard, so the generic patch spread wins.
  writeProgress({ skill: null as unknown as Record<string, unknown> }, store);
  const out = JSON.parse(store._get("jlptN3adapt_v2") as string);
  expect(out.skill).toBeNull();
});

test("writeProgress never throws on corrupted store", () => {
  const store = memStore({ jlptN3adapt_v2: "not json" });
  expect(() => writeProgress({ total: 5 }, store)).not.toThrow();
  expect(readRawProgress(store)?.total).toBe(5); // fallback to empty blob worked
});

test("writeProgress preserves non-skill fields (history, settings, etc.)", () => {
  const store = memStore({
    jlptN3adapt_v2: JSON.stringify({
      total: 10, right: 8, streak: 3,
      history: [{ date: "2025-01-01", count: 5 }],
      settings: { lang: "ja" },
      skill: { grammaire: { R: 1500 } },
    }),
  });
  writeProgress({ total: 12, skill: { grammaire: { R: 1510 } } }, store);
  const out = JSON.parse(store._get("jlptN3adapt_v2") as string);
  expect(out.history).toEqual([{ date: "2025-01-01", count: 5 }]); // preserved
  expect(out.settings).toEqual({ lang: "ja" }); // preserved
  expect(out.total).toBe(12); // updated
  expect(out.skill.grammaire.R).toBe(1510); // deep-merged
});

test("writeProgress silently fails when setItem throws", () => {
  const store = {
    getItem: () => JSON.stringify({ total: 1, skill: {} }),
    setItem: () => { throw new Error("storage full"); },
  };
  expect(() => writeProgress({ total: 2 }, store as any)).not.toThrow();
});

test("writeProgress with complex skill objects handles merging correctly", () => {
  const store = memStore({
    jlptN3adapt_v2: JSON.stringify({
      total: 1,
      skill: {
        grammaire: { R: 1500, t: 10, r: 5, history: ["a", "b"] },
        kanji: { R: 1450, t: 0, r: 0 },
      },
    }),
  });
  // Patch with deeper updates to grammaire
  writeProgress(
    {
      skill: {
        grammaire: { R: 1520, t: 11, r: 6 },
        vocabulaire: { R: 1480, t: 5, r: 2 },
      },
    },
    store
  );
  const out = JSON.parse(store._get("jlptN3adapt_v2") as string);
  expect(out.skill.grammaire).toEqual({ R: 1520, t: 11, r: 6 }); // shallow-merged
  expect(out.skill.kanji).toEqual({ R: 1450, t: 0, r: 0 }); // preserved
  expect(out.skill.vocabulaire).toEqual({ R: 1480, t: 5, r: 2 }); // added
});

test("readRawProgress returns null on JSON.parse failure", () => {
  const store = { getItem: () => "{ broken json" };
  const result = readRawProgress(store as any);
  expect(result).toBeNull();
});

test("readRawProgress returns null when getItem throws", () => {
  const store = {
    getItem: () => {
      throw new Error("storage access error");
    },
  };
  const result = readRawProgress(store as any);
  expect(result).toBeNull();
});

test("writeProgress silently handles getItem failure during merge", () => {
  const store = {
    getItem: () => {
      throw new Error("cannot read");
    },
    setItem: (_k: string, _v: string) => {
      /* noop */
    },
  };
  expect(() => writeProgress({ total: 5 }, store as any)).not.toThrow();
});

test("writeProgress silently handles setItem failure", () => {
  const store = memStore({ jlptN3adapt_v2: JSON.stringify({ total: 1, skill: {} }) });
  const origSetItem = store.setItem.bind(store);
  let callCount = 0;
  store.setItem = () => {
    callCount++;
    if (callCount === 1) throw new Error("storage full");
  };
  expect(() => writeProgress({ total: 2 }, store as any)).not.toThrow();
});
