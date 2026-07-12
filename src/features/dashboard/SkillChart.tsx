import { useEffect, useRef, type CSSProperties } from "react";
import { BAR_SKILLS, type Skill } from "../../types/progress.ts";
import type { SkillCoverage } from "../../lib/coverage.ts";

const LABELS: Record<Skill, string> = {
  grammaire: "Grammaire", vocabulaire: "Vocab", kanji: "Kanji", lecture: "Lecture", ecoute: "Écoute",
};
// Visually-hidden style (inline → no Tailwind utility needed): keeps the exact per-skill
// figures in the DOM as the accessible table view + SSR text, without showing a sub-legend.
const SR_ONLY: CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
};

// cssVar is only ever called inside the effect (browser), so `document` is defined there.
function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Skill radar (spider) chart across the four BAR_SKILLS (0–100 % each). Always plots
 * "Maîtrise" (Elo mastery, filled accent). When `coverage` is given it overlays a second
 * "Vu" series (référentiel seen %) as a dashed, un-filled neutral outline — distinguished
 * from mastery by hue AND line-style AND fill, so the two series never rely on colour alone
 * (dataviz), with a legend since ≥2 series are shown. ECharts is tree-shaken + dynamically
 * imported (own runtime-cached chunk, never touches the DOM under SSR); the visible value
 * list below carries exact %s and is the accessible + offline-first-visit fallback.
 */
export function SkillChart(
  { mastery, coverage }:
  { mastery: Record<Skill, number>; coverage?: Record<Skill, SkillCoverage> | null },
) {
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
        const data: Record<string, unknown>[] = [{
          value: BAR_SKILLS.map((s) => mastery[s]),
          name: "Maîtrise",
          symbolSize: 8,                              // dataviz: markers ≥ 8px
          lineStyle: { color: accent, width: 2 },     // dataviz: thin 2px line
          itemStyle: { color: accent },
          areaStyle: { color: accent, opacity: 0.18 },// soft fill; line + vertices carry the shape
        }];
        if (coverage) {
          data.push({
            value: BAR_SKILLS.map((s) => coverage[s]?.seen ?? 0),
            name: "Vu",
            symbolSize: 5,
            // dashed neutral outline (no fill) → reads as the coverage "envelope" behind mastery
            lineStyle: { color: dim, width: 2, type: "dashed" },
            itemStyle: { color: dim },
          });
        }
        c.setOption({
          tooltip: {}, // per-series hover (dataviz: ship a hover layer)
          radar: {
            indicator: BAR_SKILLS.map((s) => ({ name: LABELS[s], min: 0, max: 100 })), // axes pinned 0–100 %
            radius: "66%",
            splitNumber: 4,
            axisName: { color: dim, fontSize: 12 },
            splitLine: { lineStyle: { color: line } },   // recessive web
            axisLine: { lineStyle: { color: line } },
            splitArea: { show: false },                   // no zebra rings — keep it quiet
          },
          series: [{ type: "radar", data }],
        });
        onResize = () => c.resize();
        window.addEventListener("resize", onResize);
      } catch { /* ECharts chunk unavailable (offline first visit) → value list below is the fallback */ }
    })();
    return () => { disposed = true; if (onResize) window.removeEventListener("resize", onResize); chart?.dispose(); };
  }, [mastery, coverage]);

  const hasCov = !!coverage;
  return (
    <div>
      <div
        ref={ref}
        className="skill-chart"
        style={{ width: "100%", height: 220 }}
        role="img"
        aria-label="Radar de maîtrise par compétence"
      />
      {hasCov && (
        // Legend — mandatory for ≥2 series; identity via label, not colour alone.
        <div className="flex flex-wrap justify-center gap-4 mt-2 text-meta text-fg-dim">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              style={{ background: "var(--color-accent)", width: 10, height: 10, borderRadius: 999, display: "inline-block" }}
            />
            Maîtrise
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              style={{ borderTop: "2px dashed var(--color-fg-dim)", width: 16, display: "inline-block" }}
            />
            Vu (couverture)
          </span>
        </div>
      )}
      {/* Exact per-skill figures — visually hidden (a radar reads poorly for precise values
          and the legend already carries series identity), kept in the DOM as the accessible
          table view (dataviz) + SSR text. */}
      <ul style={SR_ONLY}>
        {BAR_SKILLS.map((s) => (
          <li key={s}>
            {LABELS[s]} : maîtrise {mastery[s]}%{hasCov ? `, vu ${coverage[s]?.seen ?? 0}%` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
