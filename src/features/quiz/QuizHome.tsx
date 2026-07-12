import { SKILLS, type Skill } from "../../types/progress.ts";

const CAT_LABELS: Record<Skill, string> = {
  grammaire: "Grammaire", vocabulaire: "Vocab", kanji: "Kanji", lecture: "Lecture", ecoute: "Écoute",
};
const DURATIONS = [5, 10, 15];

/** Home screen: category picker + session duration — port of legacy `renderCats`
 * (app-n3.html:664-668) and the `ch5/ch10/ch15` duration chips (app-n3.html:208-210). */
export function QuizHome({
  selected, minutes, onToggleCat, onSetMinutes, onStart,
}: {
  selected: Set<Skill>;
  minutes: number;
  onToggleCat: (c: Skill) => void;
  onSetMinutes: (m: number) => void;
  onStart: () => void;
}) {
  return (
    <div className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
      <h2 className="text-fg text-lg font-bold mt-0 mb-3">Lancer une session</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {SKILLS.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onToggleCat(cat)}
            aria-pressed={selected.has(cat)}
            className={selected.has(cat)
              ? "bg-accent text-fg-on-accent border-none rounded-full px-3 py-1.5 text-sm font-bold cursor-pointer"
              : "bg-surface-2 border border-line text-fg-dim rounded-full px-3 py-1.5 text-sm cursor-pointer"}
          >
            {CAT_LABELS[cat]}
          </button>
        ))}
      </div>
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
