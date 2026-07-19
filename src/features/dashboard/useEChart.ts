import { useEffect, useRef, type RefObject } from "react";
// Imports de TYPE uniquement : effacés au build, donc ils n'embarquent PAS ECharts
// dans le chunk d'entrée — l'invariant « ECharts en import() dynamique » tient.
import type { EChartsCoreOption, use as echartsUse } from "echarts/core";

type EChartsExtensions = Parameters<typeof echartsUse>[0];

/** Lit une variable CSS du thème. Appelée uniquement depuis l'effet (navigateur),
 *  où `document` existe — jamais au rendu SSR. */
export function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Cycle de vie d'un graphe ECharts : montage dans le `<div>` référencé, écoute du
 * redimensionnement, démontage propre. Retourne la ref à poser sur ce `<div>`.
 *
 * **ECharts DOIT rester en `import()` dynamique** (cf. CLAUDE.md) : un import statique
 * basculerait toute la lib dans le chunk d'entrée, et aucun test ni CI ne le détecte.
 * Cet invariant vit ici, en un seul endroit, au lieu d'être retapé dans chaque graphe.
 * `load()` renvoie les modules spécifiques au graphe (série, composants, renderer) ;
 * ils partent en parallèle du cœur plutôt qu'en cascade de `await`.
 *
 * `deps` est déclaré par l'appelant : `load`/`option` sont recréés à chaque rendu et ne
 * peuvent donc pas servir de dépendances. `enabled` couvre les graphes qui n'ont pas
 * toujours de quoi tracer (`ProgressChart` sous 2 points).
 *
 * L'échec d'import est avalé : à la première visite hors ligne le chunk n'existe pas,
 * et chaque graphe rend alors son propre repli textuel.
 */
export function useEChart(
  load: () => Promise<EChartsExtensions>,
  option: () => EChartsCoreOption,
  deps: unknown[],
  enabled = true,
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    let chart: { resize: () => void; dispose: () => void } | null = null;
    let onResize: (() => void) | null = null;
    let disposed = false;

    (async () => {
      try {
        const [core, extensions] = await Promise.all([import("echarts/core"), load()]);
        core.use(extensions);
        if (disposed || !ref.current) return;
        const c = core.init(ref.current, undefined, { renderer: "svg" });
        chart = c; // liaison étroite, gardée seulement pour le dispose() du nettoyage
        c.setOption(option());
        onResize = () => c.resize();
        window.addEventListener("resize", onResize);
      } catch { /* chunk ECharts indisponible → repli du composant appelant */ }
    })();

    return () => {
      disposed = true;
      if (onResize) window.removeEventListener("resize", onResize);
      chart?.dispose();
    };
  }, [...deps, enabled]);

  return ref;
}
