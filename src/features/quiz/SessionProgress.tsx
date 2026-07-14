/** Session progress indicator for the quiz flow: a « Question X / N » counter (or « Test · question
 *  X / N » in diagnostic) plus a thin position bar, and a running ✓ bonnes / ✗ mauvaises tally.
 *  Shown on the question AND corrigé phases so a resumed session immediately says where you are and
 *  how it's going — the counter used to exist only for diagnostics. The score tally is hidden in
 *  diagnostic mode (answers stay concealed until the end-of-test corrigé). Pure/prop-driven →
 *  SSR-safe. Bar height is inline (the vendored Tailwind lacks `h-1.5`). */
export function SessionProgress({ index, count, mode, right, answered }: {
  index: number; count: number; mode?: "normal" | "diagnostic";
  right?: number; answered?: number;
}) {
  if (count <= 0) return null;
  const pos = Math.min(Math.max(index, 0) + 1, count);
  const pct = Math.round((pos / count) * 100);
  const label = mode === "diagnostic" ? `Test · question ${pos} / ${count}` : `Question ${pos} / ${count}`;

  // Live tally (normal mode only): wrong = answered − right, clamped so a stale/partial resume
  // blob can never render a negative count.
  const done = Math.max(0, answered ?? 0);
  const good = Math.min(Math.max(right ?? 0, 0), done);
  const bad = done - good;
  const showTally = mode !== "diagnostic" && done > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-fg-dim text-sm m-0">{label}</p>
        {showTally && (
          <p className="text-sm m-0 whitespace-nowrap" aria-label={`${good} bonnes, ${bad} mauvaises`}>
            <span className="text-status-completed font-bold">✓ {good}</span>
            <span className="text-fg-dim"> · </span>
            <span className="text-status-failed font-bold">✗ {bad}</span>
          </p>
        )}
      </div>
      <div
        className="bg-surface-2 rounded-full overflow-hidden"
        style={{ height: 6 }}
        role="progressbar"
        aria-valuenow={pos}
        aria-valuemin={1}
        aria-valuemax={count}
        aria-label={label}
      >
        <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
