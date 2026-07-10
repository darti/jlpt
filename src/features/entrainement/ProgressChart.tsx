import { useEffect, useRef } from "react";

// cssVar is only ever called inside the effect (browser), so `document` is defined there.
function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Session-score trend (line, /180 over time) with a « seuil 95 » target markLine.
 * Single series → no legend (the caption names it); the threshold line is set apart
 * by a dashed stroke + text label (secondary encoding, never color alone). ECharts is
 * tree-shaken and dynamically imported so it lands in its own runtime-cached chunk and
 * never touches the DOM under SSR; empty-state below covers `scores.length < 2`.
 */
export function ProgressChart({ scores }: { scores: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scores.length < 2 || !ref.current) return;
    let chart: { resize: () => void; dispose: () => void } | null = null;
    let onResize: (() => void) | null = null;
    let disposed = false;
    (async () => {
      try {
        const echarts = await import("echarts/core");
        const { LineChart } = await import("echarts/charts");
        const { GridComponent, MarkLineComponent, TooltipComponent } = await import("echarts/components");
        const { SVGRenderer } = await import("echarts/renderers");
        echarts.use([LineChart, GridComponent, MarkLineComponent, TooltipComponent, SVGRenderer]);
        if (disposed || !ref.current) return;
        const c = echarts.init(ref.current, undefined, { renderer: "svg" });
        chart = c; // narrow binding kept only for dispose() in cleanup
        const accent = cssVar("--color-accent", "#88c0d0");
        const ok = cssVar("--color-status-completed", "#a3be8c");
        const muted = cssVar("--color-fg-muted", "rgba(236,239,244,0.45)");
        c.setOption({
          grid: { left: 36, right: 12, top: 12, bottom: 24 },
          tooltip: { trigger: "axis" }, // axis crosshair + tooltip (dataviz: hover layer on line charts)
          xAxis: {
            type: "category",
            data: scores.map((_, i) => (i === 0 ? "1er" : i === scores.length - 1 ? "récent" : String(i + 1))),
            axisLine: { lineStyle: { color: muted } },
            axisTick: { show: false },
            axisLabel: { color: muted, fontSize: 11 },
          },
          yAxis: {
            type: "value",
            min: 0,
            max: 180,
            axisLabel: { color: muted, fontSize: 11 },
            splitLine: { lineStyle: { color: muted, opacity: 0.4 } }, // recessive grid
          },
          series: [{
            type: "line",
            data: scores,
            smooth: true,
            symbolSize: 8, // dataviz: markers ≥ 8px
            lineStyle: { color: accent, width: 2 }, // dataviz: thin 2px line
            itemStyle: { color: accent },
            markLine: {
              silent: true,
              symbol: "none",
              lineStyle: { color: ok, type: "dashed" }, // dashed + label = secondary encoding
              data: [{ yAxis: 95, label: { formatter: "seuil 95", color: ok } }],
            },
          }],
        });
        onResize = () => c.resize();
        window.addEventListener("resize", onResize);
      } catch { /* ECharts chunk unavailable (offline first visit) → summary-only fallback below */ }
    })();
    return () => { disposed = true; if (onResize) window.removeEventListener("resize", onResize); chart?.dispose(); };
  }, [scores]);

  if (scores.length < 2) {
    return <p className="text-fg-dim text-sm">Au moins 2 diagnostics sont nécessaires pour tracer la courbe. Continue !</p>;
  }
  const delta = Math.round(scores[scores.length - 1] - scores[0]);
  return (
    <div>
      <div ref={ref} className="progress-chart" style={{ width: "100%", height: 150 }} />
      <p className="text-fg-dim text-sm mt-1">
        Évolution : <b className={delta >= 0 ? "text-status-completed" : "text-status-failed"}>{delta >= 0 ? "+" : ""}{delta} pts</b> sur {scores.length} diagnostics (estimé /180).
      </p>
    </div>
  );
}
