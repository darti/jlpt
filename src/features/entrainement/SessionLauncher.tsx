import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sessionHref } from "./nav.ts";

const DURATIONS = [5, 10, 15];

/** «J'ai xx minutes» — picks a session length (chips 5/10/15 + free input) and hands off
 *  to the quiz route via `/quiz?min=N` (in-app navigation, no full reload). */
export function SessionLauncher() {
  const [minutes, setMinutes] = useState(10);
  const navigate = useNavigate();
  const go = () => { navigate(sessionHref(minutes)); };

  return (
    <div className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
      <h2 className="text-fg text-lg font-bold mt-0 mb-3">Lancer une session</h2>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-fg-dim text-sm">J'ai</span>
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutes(m)}
            aria-pressed={minutes === m}
            className={minutes === m
              ? "bg-accent text-fg-on-accent border-none rounded-full min-w-9 h-9 text-sm font-bold cursor-pointer"
              : "bg-surface-2 border border-line text-fg-dim rounded-full min-w-9 h-9 text-sm cursor-pointer"}
          >
            {m}
          </button>
        ))}
        <input
          type="number"
          min={1}
          max={45}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          aria-label="Durée en minutes"
          className="w-16 bg-surface-2 border border-line text-fg rounded-lg px-2 h-9 text-sm"
        />
        <span className="text-fg-dim text-sm">minutes</span>
      </div>
      <button
        type="button"
        onClick={go}
        className="w-full bg-accent text-fg-on-accent border-none rounded-xl px-4 py-3 font-bold text-base cursor-pointer"
      >
        Démarrer ma session
      </button>
    </div>
  );
}
