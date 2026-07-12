import { useEffect, useRef } from "react";
import { passTier, type PassTier } from "../../lib/scoring.ts";

// Status tokens (reserved palette) + the tier stated in words, so colour is never alone.
const TIER_VAR: Record<PassTier, string> = {
  ok: "--color-status-completed", warn: "--color-prio-high", bad: "--color-status-failed",
};
const TIER_WORD: Record<PassTier, string> = {
  ok: "en bonne voie", warn: "à confirmer", bad: "à risque",
};

// cssVar is only ever read inside the effect (browser), so `document` is defined there.
function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Semicircular gauge for the estimated pass probability (0–100 %). The arc carries the three
 * risk zones (passTier's own 40/70 thresholds) as red→amber→green bands and a pointer marks
 * the value; the caption below spells out the value + tier in words (SSR/offline fallback, and
 * so status never rides on colour alone). ECharts is tree-shaken + dynamically imported so it
 * lands in its own runtime-cached chunk and never touches the DOM under SSR.
 */
export function PassGauge({ passPct }: { passPct: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(passPct)));
  const tier = passTier(pct);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let chart: { resize: () => void; dispose: () => void } | null = null;
    let onResize: (() => void) | null = null;
    let disposed = false;
    (async () => {
      try {
        const echarts = await import("echarts/core");
        const { GaugeChart } = await import("echarts/charts");
        const { SVGRenderer } = await import("echarts/renderers");
        echarts.use([GaugeChart, SVGRenderer]);
        if (disposed || !ref.current) return;
        const c = echarts.init(ref.current, undefined, { renderer: "svg" });
        chart = c;
        const bad = cssVar("--color-status-failed", "#bf616a");
        const warn = cssVar("--color-prio-high", "#ebcb8b");
        const ok = cssVar("--color-status-completed", "#a3be8c");
        const notch = cssVar("--color-panel", "#3b4252");
        const muted = cssVar("--color-fg-muted", "rgba(236,239,244,0.45)");
        const tierColor = tier === "ok" ? ok : tier === "warn" ? warn : bad;
        c.setOption({
          series: [{
            type: "gauge",
            startAngle: 180, endAngle: 0,          // semicircle
            center: ["50%", "78%"], radius: "90%",
            min: 0, max: 100, splitNumber: 5,
            axisLine: { lineStyle: { width: 14, color: [[0.4, bad], [0.7, warn], [1, ok]] } },
            pointer: { length: "58%", width: 6, itemStyle: { color: tierColor } },
            anchor: {
              show: true, size: 14, showAbove: true,
              itemStyle: { color: tierColor, borderColor: notch, borderWidth: 2 },
            },
            axisTick: { show: false },
            splitLine: { distance: -14, length: 14, lineStyle: { color: notch, width: 2 } }, // notches at 20/40/60/80
            axisLabel: { distance: 16, color: muted, fontSize: 10 },
            title: { show: false },
            detail: { show: false },              // value shown in the HTML caption (no needle overlap)
            data: [{ value: pct }],
          }],
        });
        onResize = () => c.resize();
        window.addEventListener("resize", onResize);
      } catch { /* ECharts chunk unavailable (offline first visit) → caption below is the fallback */ }
    })();
    return () => { disposed = true; if (onResize) window.removeEventListener("resize", onResize); chart?.dispose(); };
  }, [pct, tier]);

  return (
    <div className="mb-3">
      <div
        ref={ref}
        role="img"
        aria-label={`Réussite estimée ${pct} %, ${TIER_WORD[tier]}`}
        style={{ width: "100%", height: 118 }}
      />
      <p className="text-sm text-fg-dim text-center m-0">
        <b style={{ color: `var(${TIER_VAR[tier]})` }}>{pct}%</b> · {TIER_WORD[tier]}
      </p>
    </div>
  );
}
