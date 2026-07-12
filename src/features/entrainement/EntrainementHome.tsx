import { Dashboard } from "../dashboard/Dashboard.tsx";
import { ProgressChart } from "./ProgressChart.tsx";
import { QuizHome } from "../quiz/QuizHome.tsx";
import { ResumeBanner } from "../quiz/ResumeBanner.tsx";
import type { DashboardModel } from "../../lib/scoring.ts";
import type { ResumeState } from "../quiz/useQuiz.ts";
import type { Skill } from "../../types/progress.ts";

// Diagnostic/SRS are deferred to a later strangler slice (their vanilla code drops from
// the tree, recoverable from git) — shown as disabled «bientôt disponible» cards so the
// hub's shape matches the eventual full app.
const STUBS = [
  { key: "diagnostic", label: "Diagnostic", desc: "Évalue ton niveau réel" },
  { key: "apprendre", label: "Apprendre", desc: "Cours et nouveaux points" },
  { key: "erreurs", label: "Réviser les erreurs", desc: "Reprends tes fautes" },
];

/** Entraînement hub (phase "home"): resumable-session banner + progress overview (reused
 *  `Dashboard`) + session-score chart + the quiz start card (`QuizHome`) + deferred stubs.
 *  Réglages + synchro now live on the Paramétrage route. Pure/prop-driven; the leaf
 *  components own their SSR-guarded effects. */
export function EntrainementHome(props: {
  model: DashboardModel | null;
  days: number;
  scores: number[];
  selected: Set<Skill>;
  minutes: number;
  resume: ResumeState | null;
  onToggleCat: (c: Skill) => void;
  onSetMinutes: (m: number) => void;
  onStart: () => void;
  onResumeNow: () => void;
  onDismissResume: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ResumeBanner resume={props.resume} onResume={props.onResumeNow} onDismiss={props.onDismissResume} />
      <Dashboard model={props.model} days={props.days} />
      <section className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
        <h2 className="text-fg text-lg font-bold mt-0 mb-3">Progression</h2>
        <ProgressChart scores={props.scores} />
      </section>
      <QuizHome
        selected={props.selected}
        minutes={props.minutes}
        onToggleCat={props.onToggleCat}
        onSetMinutes={props.onSetMinutes}
        onStart={props.onStart}
      />
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STUBS.map((s) => (
          <div
            key={s.key}
            aria-disabled="true"
            className="bg-panel border border-line rounded-xl p-4 shadow-card surface-blur opacity-60"
          >
            <h3 className="text-fg text-sm font-bold m-0">{s.label}</h3>
            <p className="text-fg-dim text-xs mt-1 mb-2">{s.desc}</p>
            <span className="text-meta text-fg-muted">bientôt disponible</span>
          </div>
        ))}
      </section>
    </div>
  );
}
