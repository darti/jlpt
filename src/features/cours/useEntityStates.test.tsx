import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useEntityStates } from "./useEntityStates.ts";
import { COURS_KEY, PROGRESS_KEY } from "../../lib/keys.ts";
import { writeProgress } from "../../lib/storage.ts";

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

// ⚠ « acquis », pas seulement « non-neuve » : l'ancien geste posait `fsrsInit(3)` et laissait
// l'entité « en cours », donc due quatre jours plus tard. Asserter `not.toBe("neuf")` restait
// vert sur ce défaut — c'est exactement ce que le test ne voyait pas.
test("markKnown classe l entite acquise et ecrit la carte FSRS", async () => {
  const { api } = await monter();
  expect(api().stateOf("jlpt:gram/ば")).toBe("neuf");
  await act(async () => { api().markKnown("jlpt:gram/ば"); });
  expect(api().stateOf("jlpt:gram/ば")).toBe("acquis");
  const blob = JSON.parse(globalThis.localStorage.getItem(PROGRESS_KEY)!);
  expect(blob.fsrs["jlpt:gram/ば"]).toBeArrayOfSize(3);
});

// Le cas qui n'était pas offert avant (le bouton ne s'affichait que sur `neuf`) et qui est le
// plus fréquent chez quelqu'un qui reprend un programme : un point déjà rencontré, mais su.
test("markKnown evacue aussi une entite deja rencontree", async () => {
  writeProgress({ fsrs: { "jlpt:gram/ば": [0.5, 6, 0] } });
  const { api } = await monter();
  expect(api().stateOf("jlpt:gram/ば")).not.toBe("acquis");
  await act(async () => { api().markKnown("jlpt:gram/ば"); });
  expect(api().stateOf("jlpt:gram/ば")).toBe("acquis");
});

test("markKnown preserve les cartes des autres entites", async () => {
  const { api } = await monter();
  await act(async () => { api().markKnown("jlpt:gram/ば"); });
  await act(async () => { api().markKnown("jlpt:gram/たら"); });
  const blob = JSON.parse(globalThis.localStorage.getItem(PROGRESS_KEY)!);
  expect(Object.keys(blob.fsrs).sort()).toEqual(["jlpt:gram/たら", "jlpt:gram/ば"].sort());
});

// ⚠ Régression : `markKnown` partait de l'état React figé au montage (`cur`), pas du blob à
// jour. Un second onglet — ou un `cloudPull` Gist — peut écrire des cartes FSRS entre le montage
// et le clic ; comme `writeProgress` remplace `fsrs` EN ENTIER (pas de deep-merge sur ce champ),
// ces écritures concurrentes disparaissaient sans erreur.
test("markKnown preserve une carte ecrite par un AUTRE onglet apres le montage", async () => {
  const { api } = await monter();
  // Simule un second onglet qui écrit APRÈS le montage de ce hook (donc absent de `cur`).
  writeProgress({ fsrs: { "jlpt:gram/concurrent": [12, 0.9, 30] } });
  await act(async () => { api().markKnown("jlpt:gram/ば"); });
  const blob = JSON.parse(globalThis.localStorage.getItem(PROGRESS_KEY)!);
  expect(blob.fsrs["jlpt:gram/concurrent"]).toEqual([12, 0.9, 30]);
  expect(blob.fsrs["jlpt:gram/ば"]).toBeArrayOfSize(3);
});

test("le montage migre COURS_KEY vers la carte FSRS", async () => {
  globalThis.localStorage.setItem(
    COURS_KEY, JSON.stringify({ "jlpt:gram/ば": "known" }),
  );
  const { api } = await monter();
  expect(api().stateOf("jlpt:gram/ば")).not.toBe("neuf");
  // COURS_KEY survit : preuve du travail manuel, rejouable.
  expect(globalThis.localStorage.getItem(COURS_KEY)).not.toBeNull();
});

// ⚠ Plus de drapeau de migration (`COURS_MIGRE_KEY` retiré) : `migrateCoursProgress` tourne à
// CHAQUE montage, mais elle est idempotente PAR CONSTRUCTION — elle n'écrase jamais une carte
// existante. Un second montage doit donc être un NO-OP strict sur le blob déjà migré.
test("un second montage est un no-op : la carte existante n est pas rejouee ni modifiee", async () => {
  globalThis.localStorage.setItem(COURS_KEY, JSON.stringify({ "jlpt:gram/ば": "known" }));
  const { api: api1 } = await monter();
  expect(api1().stateOf("jlpt:gram/ば")).not.toBe("neuf");
  const blobApresPremierMontage = globalThis.localStorage.getItem(PROGRESS_KEY);

  const { api: api2 } = await monter();
  expect(api2().stateOf("jlpt:gram/ば")).not.toBe("neuf");
  expect(globalThis.localStorage.getItem(PROGRESS_KEY)).toBe(blobApresPremierMontage);
});
