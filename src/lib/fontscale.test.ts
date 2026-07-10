import { test, expect } from "bun:test";
import { readFs, bumpFs, applyFontScale } from "./fontscale.ts";

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
           setItem: (k: string, v: string) => void m.set(k, v), _get: (k: string) => m.get(k) };
}

test("readFs defaults to 1 when unset or out of range", () => {
  expect(readFs("Ui", memStore())).toBe(1);
  expect(readFs("Jp", memStore({ jlptN3_fsJp: "9" }))).toBe(1);
  expect(readFs("Ui", memStore({ jlptN3_fsUi: "1.3" }))).toBe(1.3);
});

test("readFs boundary values for valid range [0.7, 2]", () => {
  // Boundary: valid at 0.7
  expect(readFs("Ui", memStore({ jlptN3_fsUi: "0.7" }))).toBe(0.7);
  // Boundary: valid at 2.0
  expect(readFs("Jp", memStore({ jlptN3_fsJp: "2" }))).toBe(2);
  // Below range: 0.69 returns default
  expect(readFs("Ui", memStore({ jlptN3_fsUi: "0.69" }))).toBe(1);
  // Above range: 2.01 returns default
  expect(readFs("Jp", memStore({ jlptN3_fsJp: "2.01" }))).toBe(1);
});

test("bumpFs steps by 0.1, clamps to [0.8,1.8], persists key + updatedAt", () => {
  const s = memStore({ jlptN3_fsUi: "1.0" });
  expect(bumpFs("Ui", +1, s)).toBe(1.1);
  expect(s._get("jlptN3_fsUi")).toBe("1.1");
  expect(typeof s._get("jlptN3_updatedAt")).toBe("string");
  const hi = memStore({ jlptN3_fsUi: "1.8" });
  expect(bumpFs("Ui", +1, hi)).toBe(1.8); // clamp high
  const lo = memStore({ jlptN3_fsJp: "0.8" });
  expect(bumpFs("Jp", -1, lo)).toBe(0.8); // clamp low
});

test("bumpFs isolated negative direction (not within clamp test)", () => {
  const s = memStore({ jlptN3_fsUi: "1.5" });
  expect(bumpFs("Ui", -1, s)).toBe(1.4);
  expect(s._get("jlptN3_fsUi")).toBe("1.4");
});

test("applyFontScale sets --fs-ui/--fs-jp from stored values", () => {
  const props: Record<string, string> = {};
  const root = { style: { setProperty: (k: string, v: string) => { props[k] = v; } } } as unknown as HTMLElement;
  applyFontScale(root, memStore({ jlptN3_fsUi: "1.2", jlptN3_fsJp: "1.4" }));
  expect(props["--fs-ui"]).toBe("1.2");
  expect(props["--fs-jp"]).toBe("1.4");
});
