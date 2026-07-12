import { useEffect, useRef } from "react";
import { BAR_SKILLS, type Skill } from "../../types/progress.ts";

const LABELS: Record<Skill, string> = {
  grammaire: "Grammaire", vocabulaire: "Vocab", kanji: "Kanji", lecture: "Lecture", ecoute: "Écoute",
};
// Per-skill identity dot for the value list — matches the app-wide `--color-skill-*` tokens.
// Decorative only: the skill name beside it carries identity (dataviz: never color alone).
const DOT: Record<Skill, string> = {
  grammaire: "bg-skill-grammaire", vocabulaire: "bg-skill-vocabulaire",
  kanji: "bg-skill-kanji", lecture: "bg-skill-lecture", ecoute: "bg-skill-lecture",
};

// cssVar is only ever called inside the effect (browser), so `document` is defined there.
function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Skill-mastery radar (spider) chart — one learner profiled across the four BAR_SKILLS
 * (0–100 % each). Single series → a single accent hue with no legend (the axis labels name
 * each skill, so identity is never color-alone). ECharts is tree-shaken and dynamically
 * imported so it lands in its own runtime-cached chunk and never touches the DOM under SSR.
 * The visible value list below carries exact %s — radar is poor at precise reading — and
 * doubles as the accessible + offline-first-visit fallback when the chart chunk is absent.
 */
export function SkillChart({ mastery }: { mastery: Record<Skill, number> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    let chart: { resize: () => void; dispose: () => void } | null = null;
    let onResize: (() => void) | null = null;
    let disposed = false;
    (async () => {
      try {
        const echarts = await import("echarts/core");
        const { RadarChart } = await import("echarts/charts");
        const { TooltipComponent } = await import("echarts/components");
        const { SVGRenderer } = await import("echarts/renderers");
        echarts.use([RadarChart, TooltipComponent, SVGRenderer]);
        if (disposed || !ref.current) return;
        const c = echarts.init(ref.current, undefined, { renderer: "svg" });
        chart = c; // narrow binding kept only for dispose() in cleanup
        const accent = cssVar("--color-accent", "#88c0d0");
        const dim = cssVar("--color-fg-dim", "rgba(236,239,244,0.62)");
        const line = cssVar("--color-line-hi", "rgba(236,239,244,0.14)");
        c.setOption({
          tooltip: {}, // per-series hover (dataviz: ship a hover layer)
          radar: {
            indicator: BAR_SKILLS.map((s) => ({ name: LABELS[s], max: 100 })),
            radius: "66%",
            splitNumber: 4,
            axisName: { color: dim, fontSize: 12 },
            splitLine: { lineStyle: { color: line } },   // recessive web
            axisLine: { lineStyle: { color: line } },
            splitArea: { show: false },                   // no zebra rings — keep it quiet
          },
          series: [{
            type: "radar",
            data: [{
              value: BAR_SKILLS.map((s) => mastery[s]),
              name: "Maîtrise",
              symbolSize: 8,                              // dataviz: markers ≥ 8px
              lineStyle: { color: accent, width: 2 },     // dataviz: thin 2px line
              itemStyle: { color: accent },
              areaStyle: { color: accent, opacity: 0.18 },// soft fill; line + vertices carry the shape
            }],
          }],
        });
        onResize = () => c.resize();
        window.addEventListener("resize", onResize);
      } catch { /* ECharts chunk unavailable (offline first visit) → value list below is the fallback */ }
    })();
    return () => { disposed = true; if (onResize) window.removeEventListener("resize", onResize); chart?.dispose(); };
  }, [mastery]);

  return (
    <div>
      <div
        ref={ref}
        className="skill-chart"
        style={{ width: "100%", height: 220 }}
        role="img"
        aria-label="Radar de maîtrise par compétence"
      />
      <div className="flex flex-wrap justify-center gap-4 mt-1 text-sm">
        {BAR_SKILLS.map((s) => (
          <span key={s} className="flex items-center gap-2 text-fg-dim">
            <span className={`inline-block w-2 h-2 rounded-full ${DOT[s]}`} aria-hidden="true" />
            {LABELS[s]} <b className="text-fg">{mastery[s]}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}
