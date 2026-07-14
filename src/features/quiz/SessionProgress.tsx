/** Session progress indicator for the quiz flow: a « Question X / N » counter (or « Test · question
 *  X / N » in diagnostic) plus a thin position bar. Shown on the question AND corrigé phases so a
 *  resumed session immediately says where you are — the counter used to exist only for diagnostics.
 *  Pure/prop-driven → SSR-safe. Bar height is inline (the vendored Tailwind lacks `h-1.5`). */
export function SessionProgress({ index, count, mode }: {
  index: number; count: number; mode?: "normal" | "diagnostic";
}) {
  if (count <= 0) return null;
  const pos = Math.min(Math.max(index, 0) + 1, count);
  const pct = Math.round((pos / count) * 100);
  const label = mode === "diagnostic" ? `Test · question ${pos} / ${count}` : `Question ${pos} / ${count}`;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-fg-dim text-sm m-0">{label}</p>
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
