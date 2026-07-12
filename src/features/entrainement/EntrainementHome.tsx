import { SessionCard } from "./SessionCard.tsx";
import type { ResumeState } from "../quiz/useQuiz.ts";

/** Entraînement hub (phase "home") : une seule carte de session auto-pilotée par l'état
 *  (`SessionCard`). Stats + graphe de progression vivent sur l'Accueil ; réglages + synchro
 *  sur Paramétrage. Pure / prop-driven. */
export function EntrainementHome(props: {
  minutes: number;
  resume: ResumeState | null;
  onSetMinutes: (m: number) => void;
  onStart: () => void;
  onResumeNow: () => void;
  onDismissResume: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SessionCard
        resume={props.resume}
        minutes={props.minutes}
        onSetMinutes={props.onSetMinutes}
        onStart={props.onStart}
        onResumeNow={props.onResumeNow}
        onDismissResume={props.onDismissResume}
      />
    </div>
  );
}
