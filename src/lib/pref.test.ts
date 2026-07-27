import { expect, test, describe } from "bun:test";
import { memStore } from "../testing/memStore.ts";
import { UPDATED_KEY } from "./keys.ts";
import { pref, boolPref, enumPref } from "./pref.ts";
import { readFuri, writeFuri } from "./furigana.ts";
import { readRate, writeRate } from "./audioRate.ts";
import { readProduction, writeProduction } from "./production.ts";
import { applyTheme } from "./theme.ts";
import { bumpFs } from "./fontscale.ts";

/**
 * ⚠ Ce fichier fige l'invariant qui manquait : **toute** écriture de préférence horodate.
 *
 * Trois des cinq préférences ne le faisaient pas (`furi`, `rate`, `production`). Comme
 * `collectData` prend `UPDATED_KEY` pour `updatedAt` et que `cloudPull` n'applique le distant
 * que si `remoteT > localT`, changer SEULEMENT l'une des trois laissait l'horodatage périmé :
 * la synchro suivante restaurait l'ancienne valeur, sans erreur. Le bug tenait à ce que les
 * cinq modules retapaient le même corps — la divergence d'une ligne était invisible.
 */

describe("toute préférence horodate son écriture (régression synchro)", () => {
  // Chaque entrée : nom, écriture, clé attendue dans le store.
  const ECRITURES: [string, (s: ReturnType<typeof memStore>) => void][] = [
    ["writeFuri", (s) => { writeFuri(true, s); }],
    ["writeRate", (s) => { writeRate(0.7, s); }],
    ["writeProduction", (s) => { writeProduction(true, s); }],
    ["bumpFs", (s) => { bumpFs("Ui", +1, s); }],
    ["applyTheme", (s) => { applyTheme("light", { setAttribute: () => {} } as unknown as HTMLElement, s); }],
  ];

  for (const [nom, ecrire] of ECRITURES) {
    test(`${nom} pose ${UPDATED_KEY}`, () => {
      const s = memStore();
      ecrire(s);
      expect(typeof s._get(UPDATED_KEY)).toBe("string");
    });
  }
});

describe("pref — fabrique", () => {
  test("read rend le défaut quand la clé est absente", () => {
    const p = pref("k", { decode: (raw) => raw ?? "def", encode: (v: string) => v });
    expect(p.read(memStore())).toBe("def");
  });

  test("write persiste, horodate, et rend la valeur écrite", () => {
    const p = pref("k", { decode: (raw) => raw ?? "def", encode: (v: string) => v });
    const s = memStore();
    expect(p.write("x", s)).toBe("x");
    expect(s._get("k")).toBe("x");
    expect(typeof s._get(UPDATED_KEY)).toBe("string");
  });

  test("un getItem qui jette → défaut, aucune exception", () => {
    const p = pref("k", { decode: (raw) => raw ?? "def", encode: (v: string) => v });
    const bad = { getItem: () => { throw new Error("boom"); } };
    expect(p.read(bad)).toBe("def");
  });

  test("un setItem qui jette est avalé, la valeur est quand même rendue", () => {
    const p = pref("k", { decode: (raw) => raw ?? "def", encode: (v: string) => v });
    const bad = { getItem: () => null, setItem: () => { throw new Error("boom"); } };
    expect(p.write("x", bad)).toBe("x");
  });
});

describe("boolPref", () => {
  test("round-trip sur le couple de littéraux donné", () => {
    const p = boolPref("b", "on", "off");
    const s = memStore();
    expect(p.read(s)).toBe(false);
    p.write(true, s);
    expect(s._get("b")).toBe("on");
    expect(p.read(s)).toBe(true);
    p.write(false, s);
    expect(s._get("b")).toBe("off");
    expect(p.read(s)).toBe(false);
  });

  test("toute autre valeur stockée lit false", () => {
    expect(boolPref("b", "on", "off").read(memStore({ b: "bruit" }))).toBe(false);
  });
});

describe("enumPref", () => {
  const p = enumPref("e", [0.7, 0.9, 1.0] as const, 0.9);

  test("rabat une valeur hors de l'énumération sur le défaut", () => {
    expect(p.read(memStore({ e: "0.85" }))).toBe(0.9);
    expect(p.read(memStore({ e: "abc" }))).toBe(0.9);
  });

  test("accepte un cran déclaré", () => {
    expect(p.read(memStore({ e: "0.7" }))).toBe(0.7);
  });
});

describe("les préférences existantes gardent leur comportement", () => {
  test("furi : 'on' seul vaut true", () => {
    expect(readFuri(memStore({ jlptN3_furi: "on" }))).toBe(true);
    expect(readFuri(memStore({ jlptN3_furi: "off" }))).toBe(false);
    expect(readFuri(memStore())).toBe(false);
  });

  test("rate : défaut 0.9, crans seuls acceptés", () => {
    expect(readRate(memStore())).toBe(0.9);
    expect(readRate(memStore({ jlptN3_ecouteRate: "2" }))).toBe(0.9);
    expect(readRate(memStore({ jlptN3_ecouteRate: "1" }))).toBe(1.0);
  });

  test("production : '1' seul vaut true", () => {
    expect(readProduction(memStore({ jlptN3_production: "1" }))).toBe(true);
    expect(readProduction(memStore({ jlptN3_production: "0" }))).toBe(false);
    expect(readProduction(memStore())).toBe(false);
  });
});
