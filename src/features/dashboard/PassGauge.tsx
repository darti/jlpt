import { passTier, type PassTier } from "../../lib/scoring.ts";
import { cssVar, useEChart } from "./useEChart.ts";

// Status tokens (reserved palette) + short zone words, so meaning never rides on colour alone.
const TIER_VAR: Record<PassTier, string> = {
  ok: "--color-status-completed", warn: "--color-prio-high", bad: "--color-status-failed",
};
const TIER_WORD: Record<PassTier, string> = { ok: "Prêt", warn: "Limite", bad: "Risque" };

// Small arrowhead pointer (ECharts "grade rating" gauge), sits out near the rim.
const ARROW = "path://M12.8,0.7l12,40.1H0.7L12.8,0.7z";

/**
 * Semicircular "grade" gauge for the estimated pass probability (0–100 %). Three risk zones
 * (passTier's own 40/70 thresholds) colour the arc; an arrowhead near the rim + the auto-tinted
 * ticks and centre number all inherit the value's zone colour; the arc is captioned Risque /
 * Limite / Prêt and the tier is repeated in words below (SSR/offline fallback, never colour-alone).
 * ECharts is tree-shaken + dynamically imported (see `useEChart`) so it lands in its own
 * runtime-cached chunk.
 */
export function PassGauge({ passPct }: { passPct: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(passPct)));
  const tier = passTier(pct);

  const ref = useEChart(
    async () => {
      const [{ GaugeChart }, { SVGRenderer }] = await Promise.all([
        import("echarts/charts"),
        import("echarts/renderers"),
      ]);
      return [GaugeChart, SVGRenderer];
    },
    () => {
      const bad = cssVar("--color-status-failed", "#bf616a");
      const warn = cssVar("--color-prio-high", "#ebcb8b");
      const ok = cssVar("--color-status-completed", "#a3be8c");
      const muted = cssVar("--color-fg-muted", "rgba(236,239,244,0.45)");
      return {
        series: [{
          type: "gauge",
          startAngle: 180, endAngle: 0,          // semicircle
          center: ["50%", "80%"], radius: "84%",
          min: 0, max: 100, splitNumber: 10,
          axisLine: { lineStyle: { width: 3, color: [[0.4, bad], [0.7, warn], [1, ok]] } },
          pointer: { icon: ARROW, length: "10%", width: 11, offsetCenter: [0, "-54%"], itemStyle: { color: "auto" } },
          anchor: { show: false },
          axisTick: { show: false },
          splitLine: { distance: -3, length: 5, lineStyle: { color: "auto", width: 1 } },
          axisLabel: {
            color: muted, fontSize: 9, distance: -26, rotate: "tangential",
            formatter: (v: number) =>
              (v === 20 ? TIER_WORD.bad : v === 50 ? TIER_WORD.warn : v === 90 ? TIER_WORD.ok : ""),
          },
          title: { show: false },
          detail: { show: false }, // value shown in the caption below the dial (no in-gauge number)
          data: [{ value: pct }],
        }],
      };
    },
    [pct, tier],
  );

  return (
    <div className="mb-3">
      <div
        ref={ref}
        role="img"
        aria-label={`Réussite estimée ${pct} %, ${TIER_WORD[tier]}`}
        style={{ width: "100%", height: 128 }}
      />
      {/* Value + zone label just below the dial (SSR/offline-safe, tests read it). */}
      <p className="text-fg-dim text-center m-0" style={{ marginTop: -6, fontSize: 15 }}>
        <b style={{ color: `var(${TIER_VAR[tier]})` }}>{pct}%</b> · {TIER_WORD[tier]}
      </p>
    </div>
  );
}
