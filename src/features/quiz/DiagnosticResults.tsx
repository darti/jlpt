import type { DashboardModel } from "../../lib/scoring.ts";
import { SKILLS, SKILL_LABELS } from "../../types/progress.ts";
import type { Question } from "../../types/quiz.ts";
import { QuestionCard } from "./QuestionCard.tsx";
import { Corrige } from "./Corrige.tsx";
import { speakQuestion } from "../../lib/tts.ts";
import { resolveRappel, type RappelIndex } from "./rappel.ts";
import { PANEL, BTN_PRIMARY } from "../../ui/styles.ts";

/** Diagnostic report: estimated level (from `dashboardModel`) + a per-skill score derived from
 *  THIS test's answers (covers all 5 tested categories — `barMastery` omits `ecoute`, MAJOR #3) +
 *  a full corrigé per answered question (reuses QuestionCard + Corrige). Pure / prop-driven. */
export function DiagnosticResults({
  model, answers, onDone, coursIndex,
}: {
  model: DashboardModel;
  answers: { question: Question; chosen: number }[];
  onDone: () => void;
  coursIndex?: RappelIndex | null;
}) {
  const right = answers.filter((a) => a.chosen === a.question.a).length;
  // Per-skill breakdown from the answers themselves — every tested category appears, in SKILLS order.
  const perSkill = SKILLS
    .map((s) => {
      const rows = answers.filter((a) => a.question.cat === s);
      return { skill: s, total: rows.length, right: rows.filter((a) => a.chosen === a.question.a).length };
    })
    .filter((r) => r.total > 0);
  return (
    <div className="flex flex-col gap-4">
      <div className={`${PANEL} text-center`}>
        <p className="text-fg-dim text-sm mb-1">Ton niveau estimé</p>
        <p className="text-4xl font-bold text-accent mb-1">{model.level}</p>
        <p className="text-fg-dim text-sm mb-3">
          {model.passPct}% de réussite estimée · {right}/{answers.length} au test
        </p>
        <div className="flex flex-col gap-1 text-left">
          {perSkill.map((r) => (
            <div key={r.skill} className="flex items-center justify-between text-sm">
              <span className="text-fg-dim">{SKILL_LABELS[r.skill]}</span>
              <span className="text-fg font-bold">{r.right}/{r.total}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-fg text-base font-bold m-0">Correction</p>
      {answers.map((a) => (
        <div key={a.question.id} className="flex flex-col gap-2">
          <QuestionCard question={a.question} chosen={a.chosen} answered={true} onChoose={() => {}} onSpeak={() => speakQuestion(a.question)} />
          <Corrige question={a.question} correct={a.chosen === a.question.a} rappel={resolveRappel(a.question, coursIndex ?? null)} />
        </div>
      ))}
      <button
        type="button"
        onClick={onDone}
        className={`w-full ${BTN_PRIMARY}`}
      >
        Terminé
      </button>
    </div>
  );
}
