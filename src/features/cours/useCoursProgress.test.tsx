import { test, expect, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCoursProgress } from "./useCoursProgress.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => {
  try {
    globalThis.localStorage.clear();
  } catch {
    /* noop */
  }
});

test("toggle fait cycler l'état d'un item et le persiste", async () => {
  let api: ReturnType<typeof useCoursProgress> | null = null;
  function Probe() {
    api = useCoursProgress();
    return null;
  }
  const host = document.createElement("div");
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(<Probe />);
  });

  await act(async () => {
    api!.toggle("vocab:食べる");
  }); // neuf → known
  expect(api!.progress["vocab:食べる"]).toBe("known");
  await act(async () => {
    api!.toggle("vocab:食べる");
  }); // known → review
  expect(api!.progress["vocab:食べる"]).toBe("review");
  await act(async () => {
    api!.toggle("vocab:食べる");
  }); // review → neuf
  expect(api!.progress["vocab:食べる"]).toBeUndefined();

  // toggle persistant dans localStorage
  await act(async () => {
    api!.toggle("kanji:政");
  });
  expect(
    JSON.parse(globalThis.localStorage.getItem("jlptN3_cours_v2")!)
  ).toEqual({ "kanji:政": "known" });
  await act(async () => {
    root.unmount();
  });
});

test("charge la progression depuis localStorage au montage", async () => {
  // seed localStorage avec des données existantes
  globalThis.localStorage.setItem(
    "jlptN3_cours_v2",
    JSON.stringify({ "vocab:水": "known", "kanji:火": "review" })
  );

  let api: ReturnType<typeof useCoursProgress> | null = null;
  function Probe() {
    api = useCoursProgress();
    return null;
  }
  const host = document.createElement("div");
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(<Probe />);
  });

  // hook doit avoir chargé les données depuis localStorage
  expect(api!.progress["vocab:水"]).toBe("known");
  expect(api!.progress["kanji:火"]).toBe("review");

  await act(async () => {
    root.unmount();
  });
});
