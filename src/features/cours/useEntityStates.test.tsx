import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useEntityStates } from "./useEntityStates.ts";
import { COURS_KEY, COURS_MIGRE_KEY, PROGRESS_KEY } from "../../lib/keys.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  try { globalThis.localStorage.clear(); } catch { /* noop */ }
});

async function monter(): Promise<{ api: () => ReturnType<typeof useEntityStates> }> {
  let courant: ReturnType<typeof useEntityStates> | null = null;
  function Probe() { courant = useEntityStates(); return null; }
  const host = document.createElement("div");
  const root: Root = createRoot(host);
  await act(async () => { root.render(<Probe />); });
  return { api: () => courant! };
}

test("markKnown amorce la carte FSRS et rend l entite non-neuve", async () => {
  const { api } = await monter();
  expect(api().stateOf("jlpt:gram/ば")).toBe("neuf");
  await act(async () => { api().markKnown("jlpt:gram/ば"); });
  expect(api().stateOf("jlpt:gram/ば")).not.toBe("neuf");
  const blob = JSON.parse(globalThis.localStorage.getItem(PROGRESS_KEY)!);
  expect(blob.fsrs["jlpt:gram/ば"]).toBeArrayOfSize(3);
});

test("markKnown preserve les cartes des autres entites", async () => {
  const { api } = await monter();
  await act(async () => { api().markKnown("jlpt:gram/ば"); });
  await act(async () => { api().markKnown("jlpt:gram/たら"); });
  const blob = JSON.parse(globalThis.localStorage.getItem(PROGRESS_KEY)!);
  expect(Object.keys(blob.fsrs).sort()).toEqual(["jlpt:gram/たら", "jlpt:gram/ば"].sort());
});

test("le montage migre COURS_KEY une seule fois", async () => {
  globalThis.localStorage.setItem(
    COURS_KEY, JSON.stringify({ "jlpt:gram/ば": "known" }),
  );
  const { api } = await monter();
  expect(api().stateOf("jlpt:gram/ば")).not.toBe("neuf");
  expect(globalThis.localStorage.getItem(COURS_MIGRE_KEY)).toBe("1");
  // COURS_KEY survit : preuve du travail manuel, rejouable.
  expect(globalThis.localStorage.getItem(COURS_KEY)).not.toBeNull();
});

test("un second montage ne rejoue pas la migration", async () => {
  globalThis.localStorage.setItem(COURS_KEY, JSON.stringify({ "jlpt:gram/ば": "known" }));
  globalThis.localStorage.setItem(COURS_MIGRE_KEY, "1");
  const { api } = await monter();
  expect(api().stateOf("jlpt:gram/ば")).toBe("neuf");
});
