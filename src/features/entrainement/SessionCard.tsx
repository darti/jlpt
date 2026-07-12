import type { ResumeState } from "../quiz/useQuiz.ts";

const DURATIONS = [5, 10, 15];

/** Carte de session unique du hub Entraînement : rend l'état « Reprendre » (session en
 *  cours) ou l'état « Session » minimal (sélecteur de temps + Commencer). Le mélange composé
 *  reste caché (parti pris « magique »). Pure / prop-driven. */
export function SessionCard({
  resume, minutes, onSetMinutes, onStart, onResumeNow, onDismissResume,
}: {
  resume: ResumeState | null;
  minutes: number;
  onSetMinutes: (m: number) => void;
  onStart: () => void;
  onResumeNow: () => void;
  onDismissResume: () => void;
}) {
  if (resume) {
    const pos = `${Math.min(resume.qi + 1, resume.ids.length)}/${resume.ids.length}`;
    return (
      <div className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
        <h2 className="text-fg text-lg font-bold mt-0 mb-1">Reprendre ta session</h2>
        <p className="text-fg-dim text-sm mt-0 mb-4">{pos} · {resume.right} bonne(s) réponse(s)</p>
        <button
          type="button"
          onClick={() => onResumeNow()}
          className="w-full bg-accent text-fg-on-accent border-none rounded-xl px-4 py-3 font-bold text-base cursor-pointer"
        >
          Continuer
        </button>
        <button
          type="button"
          onClick={onDismissResume}
          className="w-full bg-transparent border border-line text-fg-dim rounded-xl px-4 py-2.5 text-sm cursor-pointer mt-2"
        >
          Nouvelle session
        </button>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
      <h2 className="text-fg text-lg font-bold mt-0 mb-3">Ta session du moment</h2>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-fg-dim text-sm">J'ai</span>
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onSetMinutes(m)}
            aria-pressed={minutes === m}
            className={minutes === m
              ? "bg-accent text-fg-on-accent border-none rounded-full min-w-9 h-9 text-sm font-bold cursor-pointer"
              : "bg-surface-2 border border-line text-fg-dim rounded-full min-w-9 h-9 text-sm cursor-pointer"}
          >
            {m}
          </button>
        ))}
        <span className="text-fg-dim text-sm">min</span>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="w-full bg-accent text-fg-on-accent border-none rounded-xl px-4 py-3 font-bold text-base cursor-pointer"
      >
        Commencer
      </button>
    </div>
  );
}
